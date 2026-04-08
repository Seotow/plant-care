import Constants from "expo-constants";
import { Platform } from "react-native";

function getBaseUrl() {
  // Explicit override via app.json extra or env
  const override = Constants.expoConfig?.extra?.apiUrl;
  if (override) return override;

  // Web inside Docker: backend is at same host, port 8000
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }

  // Expo Go on device: hostUri contains dev machine IP
  const host = Constants.expoConfig?.hostUri?.split(":").shift();
  if (host) return `http://${host}:8000`;
  return "http://localhost:8000";
}

const BASE_URL = getBaseUrl();

class ApiService {
  constructor() {
    this.token = null;
    this.baseUrl = BASE_URL;
  }

  setToken(token) {
    this.token = token;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...options.headers };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ── Auth ──
  login(username, password) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  register(data) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getProfile() {
    return this.request("/api/auth/me");
  }

  updateProfile(data) {
    return this.request("/api/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ── Dashboard ──
  getDashboard() {
    return this.request("/api/dashboard/");
  }

  // ── Gardens ──
  getGardens() {
    return this.request("/api/gardens/");
  }

  createGarden(data) {
    return this.request("/api/gardens/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getGarden(id) {
    return this.request(`/api/gardens/${id}`);
  }

  updateGarden(id, data) {
    return this.request(`/api/gardens/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  deleteGarden(id) {
    return this.request(`/api/gardens/${id}`, { method: "DELETE" });
  }

  // ── Scan ──
  async uploadScan(gardenId, imageUri) {
    const formData = new FormData();

    if (Platform.OS === "web") {
      // On web, fetch the URI as a Blob (data URL or object URL)
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append("file", blob, "scan.jpg");
    } else {
      // React Native: use the {uri, type, name} convention
      const uri = imageUri.startsWith("ph://")
        ? imageUri.replace("ph://", "file://")
        : imageUri;
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType =
        ext === "png" ? "image/png" : ext === "heic" ? "image/heic" : "image/jpeg";
      formData.append("file", { uri, type: mimeType, name: `scan.${ext}` });
    }

    formData.append("garden_id", String(gardenId));

    return this.request("/api/scan/", {
      method: "POST",
      body: formData,
    });
  }

  // ── History ──
  getDetections(gardenId = null) {
    const params = gardenId ? `?garden_id=${gardenId}` : "";
    return this.request(`/api/detections/${params}`);
  }

  getDetection(id) {
    return this.request(`/api/detections/${id}`);
  }

  // ── Tasks ──
  getTasks() {
    return this.request("/api/tasks/");
  }

  createTask(data) {
    return this.request("/api/tasks/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  toggleTask(id) {
    return this.request(`/api/tasks/${id}/toggle`, { method: "PUT" });
  }

  deleteTask(id) {
    return this.request(`/api/tasks/${id}`, { method: "DELETE" });
  }

  // ── Utils ──
  getImageUrl(path) {
    return `${this.baseUrl}${path}`;
  }
}

export default new ApiService();
