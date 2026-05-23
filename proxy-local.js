/**
 * Local HTTP reverse proxy for demo (no TLS overhead).
 * Listens on port 3080 (HTTP), forwards:
 *   /api/* and /uploads/* → localhost:8000  (FastAPI backend)
 *   everything else       → localhost:8081  (Expo web dev server)
 *
 * Setup (run once as Admin):
 *   netsh interface portproxy add v4tov4 listenport=80 listenaddress=127.0.0.1 connectport=3080 connectaddress=127.0.0.1
 *   Add to C:\Windows\System32\drivers\etc\hosts:
 *     127.0.0.1  plantcare.local
 *
 * Then run: node proxy-local.js
 */

const http = require("http");
const net = require("net");

const FRONTEND_PORT = 8081;
const BACKEND_PORT = 8000;
const PROXY_PORT = 3080;

function resolveTarget(url) {
  return url.startsWith("/api/") || url.startsWith("/uploads/")
    ? BACKEND_PORT
    : FRONTEND_PORT;
}

function proxyHttp(req, res) {
  const port = resolveTarget(req.url);
  const headers = { ...req.headers, host: `localhost:${port}` };

  // Expo dev server rejects requests with an external Origin header.
  // Strip origin/referer so Metro sees it as a same-origin request.
  if (port === FRONTEND_PORT) {
    delete headers["origin"];
    delete headers["referer"];
  }

  const options = {
    hostname: "localhost",
    port,
    path: req.url,
    method: req.method,
    headers,
  };

  const upstream = http.request(options, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(upstream);
}

function proxyWebSocket(req, socket, head) {
  const port = resolveTarget(req.url);
  const upstream = net.connect(port, "localhost", () => {
    const headerLines = Object.entries(req.headers)
      .filter(([k]) => k !== "host")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");

    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      `Host: localhost:${port}\r\n` +
      headerLines +
      "\r\n\r\n"
    );

    if (head && head.length) upstream.write(head);

    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

const server = http.createServer(proxyHttp);
server.on("upgrade", proxyWebSocket);

server.listen(PROXY_PORT, "127.0.0.1", () => {
  console.log(`\n✓ Proxy ready → http://plantcare.local`);
  console.log(`  /api/* /uploads/*  →  localhost:${BACKEND_PORT} (FastAPI)`);
  console.log(`  /*                 →  localhost:${FRONTEND_PORT} (Expo web)\n`);
});
