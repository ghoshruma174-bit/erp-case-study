const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

export async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("erp-token");
  const headers = new Headers(options.headers || {});

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") {
      window.dispatchEvent(new Event("erp:unauthorized"));
    }
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
}
