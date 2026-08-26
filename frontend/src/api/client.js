// Thin fetch wrapper: JSON by default, multipart when a FormData body is
// passed, JWT attached from the auth store, 401 triggers one silent
// refresh-token retry before giving up.
import { useAuthStore } from "../store/useAuthStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, { method = "GET", body, auth = true, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  const token = auth ? useAuthStore.getState().accessToken : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401 && auth && useAuthStore.getState().refreshToken) {
    const refreshed = await useAuthStore.getState().tryRefresh();
    if (refreshed) return request(path, { method, body, auth, isForm });
  }

  if (!res.ok) {
    let detail;
    try {
      detail = await res.json();
    } catch {
      detail = { detail: res.statusText };
    }
    const error = new Error(detail.detail || JSON.stringify(detail));
    error.status = res.status;
    error.data = detail;
    throw error;
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.blob();
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: "POST", body, ...opts }),
  patch: (path, body, opts = {}) => request(path, { method: "PATCH", body, ...opts }),
  delete: (path) => request(path, { method: "DELETE" }),
  publicGet: (path) => request(path, { auth: false }),
  publicPost: (path, body, opts = {}) => request(path, { method: "POST", body, auth: false, ...opts }),
};

export function mediaUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path}`;
}
