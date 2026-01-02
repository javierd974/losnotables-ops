// src/auth/auth.ts
export type AuthUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string; // "ADMIN" | "ENCARGADO" | etc.
};

const LS_TOKEN = "ln_access_token";
const LS_USER = "ln_user";

export function getToken(): string | null {
  return localStorage.getItem(LS_TOKEN);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(LS_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
}

export function isAuthed(): boolean {
  return !!getToken();
}
