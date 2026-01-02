// src/api/client.ts
import { getToken, clearAuth } from "../auth/auth";

const API_BASE = "https://api.losnotables.cloud";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean; // por defecto true
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const auth = options.auth !== false;

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  // Si mandamos body JSON y no seteó content-type
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  // Si el token expiró o no es válido, limpiamos auth (evita loops raros)
  if (res.status === 401) {
    clearAuth();
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let payload: any = null;
  if (isJson) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  } else {
    // si backend devolvió texto
    try {
      payload = await res.text();
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const msg =
      (payload && (payload.message || payload.error)) ||
      `Error HTTP ${res.status}`;
    throw new ApiError(msg, res.status, payload);
  }

  return payload as T;
}
