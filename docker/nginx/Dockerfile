# ── Stage 1: Build Expo web ──────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /build

COPY frontend-mobile/package.json frontend-mobile/package-lock.json ./
RUN npm ci --prefer-offline

COPY frontend-mobile/ .

# Expo SDK 54: npx expo export --platform web → output: dist/
RUN npx expo export --platform web

# ── Stage 2: Nginx serving built frontend + proxy config ─────────────────
FROM nginx:1.27-alpine

COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /build/dist /usr/share/nginx/html

EXPOSE 80
