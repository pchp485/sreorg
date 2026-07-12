import type {
  AuditEvent,
  CommandResponse,
  DeviceInfo,
  Health,
  User,
} from "../types";

// Token is stored in-memory + localStorage for the dashboard session.
const TOKEN_KEY = "parentai_token";

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(path, { ...init, headers });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`${resp.status}: ${detail}`);
  }
  return (await resp.json()) as T;
}

export const api = {
  health: () => request<Health>("/health"),
  login: (userId: string) =>
    request<{ access_token: string }>(`/api/users/${userId}/token`, {
      method: "POST",
    }),
  listUsers: () => request<User[]>("/api/users"),
  setEnabled: (userId: string, enabled: boolean) =>
    request<User>(`/api/users/${userId}/enabled?enabled=${enabled}`, {
      method: "POST",
    }),
  listDevices: () => request<DeviceInfo[]>("/api/devices"),
  audit: (limit = 100) => request<AuditEvent[]>(`/api/audit?limit=${limit}`),
  permissions: () => request<Record<string, string[]>>("/api/permissions"),
  command: (text: string, speaker: string | null, confidence = 0.99) =>
    request<CommandResponse>("/api/voice/command", {
      method: "POST",
      body: JSON.stringify({ text, speaker, confidence }),
    }),
  enroll: async (userId: string, file: File) => {
    const form = new FormData();
    form.append("sample", file);
    const token = getToken();
    const resp = await fetch(`/api/users/${userId}/enroll`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  },
};
