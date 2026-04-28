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

  // ── Diseases ──
  getDiseases() {
    return this.request("/api/diseases/");
  }

  async createDisease(name, nameVi, imageUris) {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("name_vi", nameVi);

    for (let i = 0; i < imageUris.length; i++) {
      const uri = imageUris[i];
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        formData.append("files", blob, `sample_${i}.jpg`);
      } else {
        const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        formData.append("files", { uri, type: mime, name: `sample_${i}.${ext}` });
      }
    }

    return this.request("/api/diseases/", { method: "POST", body: formData });
  }

  async addDiseaseSamples(diseaseId, imageUris) {
    const formData = new FormData();
    for (let i = 0; i < imageUris.length; i++) {
      const uri = imageUris[i];
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        formData.append("files", blob, `sample_${i}.jpg`);
      } else {
        const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        formData.append("files", { uri, type: mime, name: `sample_${i}.${ext}` });
      }
    }
    return this.request(`/api/diseases/${diseaseId}/samples`, { method: "POST", body: formData });
  }

  deleteDisease(id) {
    return this.request(`/api/diseases/${id}`, { method: "DELETE" });
  }

  updateDisease(id, name, nameVi) {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("name_vi", nameVi);
    return this.request(`/api/diseases/${id}`, { method: "PATCH", body: formData });
  }

  // ── Detections: history with filters + progression ──
  getDetections(gardenId = null, { fromDate, toDate, limit } = {}) {
    const params = new URLSearchParams();
    if (gardenId) params.append("garden_id", gardenId);
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);
    if (limit) params.append("limit", limit);
    const qs = params.toString();
    return this.request(`/api/detections/${qs ? "?" + qs : ""}`);
  }

  getGardenProgression(gardenId, days = 30) {
    return this.request(`/api/detections/garden/${gardenId}/progression?days=${days}`);
  }

  // ── Disease submissions (UC13) ──
  async submitDisease(name, nameVi, symptoms, imageUris) {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("name_vi", nameVi);
    formData.append("symptoms", symptoms);
    for (let i = 0; i < imageUris.length; i++) {
      const uri = imageUris[i];
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        formData.append("files", blob, `sample_${i}.jpg`);
      } else {
        const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        formData.append("files", { uri, type: mime, name: `sample_${i}.${ext}` });
      }
    }
    return this.request("/api/submissions/", { method: "POST", body: formData });
  }

  getMySubmissions() {
    return this.request("/api/submissions/mine");
  }

  // ── Admin (UC14) ──
  adminGetSubmissions(status = "pending") {
    return this.request(`/api/admin/submissions?status=${status}`);
  }

  adminApproveSubmission(id) {
    return this.request(`/api/admin/submissions/${id}/approve`, { method: "POST" });
  }

  adminRejectSubmission(id, reason = "") {
    const formData = new FormData();
    formData.append("reason", reason);
    return this.request(`/api/admin/submissions/${id}/reject`, { method: "POST", body: formData });
  }

  adminGetMe() {
    return this.request("/api/admin/me");
  }

  // ── Admin Knowledge Base ──
  adminGetKnowledge(search = "") {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return this.request(`/api/admin/knowledge${q}`);
  }

  adminGetKnowledgeItem(id) {
    return this.request(`/api/admin/knowledge/${id}`);
  }

  adminUpdateKnowledge(id, { mo_ta, nguyen_nhan, xu_ly }) {
    const formData = new FormData();
    formData.append("mo_ta", mo_ta);
    formData.append("nguyen_nhan", nguyen_nhan);
    formData.append("xu_ly", JSON.stringify(xu_ly));
    return this.request(`/api/admin/knowledge/${id}`, { method: "PATCH", body: formData });
  }

  // ── Test Grad-CAM ──
  async testGradcam(imageUri, mode = "classifier") {
    const formData = new FormData();
    if (Platform.OS === "web") {
      const resp = await fetch(imageUri);
      const blob = await resp.blob();
      formData.append("file", blob, "test.jpg");
    } else {
      const ext = imageUri.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      formData.append("file", { uri: imageUri, type: mime, name: `test.${ext}` });
    }
    formData.append("mode", mode);
    return this.request("/api/scan/test-gradcam", { method: "POST", body: formData });
  }

  // ── Utils ──
  getImageUrl(path) {
    return `${this.baseUrl}${path}`;
  }
}

export default new ApiService();
