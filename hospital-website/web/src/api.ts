import type {
  Ambulance,
  CasesResponse,
  GeoResult,
  Hospital,
  Incident,
  Session,
  User,
} from './types';

const API = import.meta.env.VITE_API ?? 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS ?? 'ws://localhost:8000';
const TOKEN_KEY = 'hospital-console-token';

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function getToken() {
  return token;
}

export function setToken(next: string | null) {
  token = next;
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the response service');
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (res.status === 401) {
    if (token) setToken(null);
    const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : null;
    throw new ApiError(
      401,
      typeof detail === 'string'
        ? detail
        : 'Your session has ended, please sign in again',
    );
  }

  if (!res.ok) {
    throw new ApiError(res.status, readableError(body, res.status));
  }
  return body as T;
}

function readableError(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg.replace(/^Value error, /, '');
    }
  }
  return `Request failed (${status})`;
}

export const register = (body: Record<string, unknown>) =>
  request<Session>('/auth/register', { method: 'POST', body: JSON.stringify(body) });

export const login = (email: string, password: string) =>
  request<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const logout = () => request<{ signed_out: boolean }>('/auth/logout', { method: 'POST' });

export const fetchMe = () => request<{ user: User; hospital: Hospital }>('/auth/me');

export const fetchStaff = () => request<User[]>('/auth/staff');

export const addStaff = (body: { email: string; password: string; full_name?: string; role: string }) =>
  request<User>('/auth/staff', { method: 'POST', body: JSON.stringify(body) });

export const removeStaff = (userId: number) =>
  request<{ removed: boolean }>(`/auth/staff/${userId}`, { method: 'DELETE' });

export const geoSearch = (q: string) =>
  request<{ query: string; results: GeoResult[] }>(`/geo/search?q=${encodeURIComponent(q)}`);

export const fetchCases = () => request<CasesResponse>('/me/cases');

export const fetchCase = (alertId: string) =>
  request<Incident>(`/me/cases/${encodeURIComponent(alertId)}`);

export const acceptCase = (alertId: string) =>
  request<Incident>(`/me/cases/${encodeURIComponent(alertId)}/accept`, { method: 'POST' });

export const declineCase = (alertId: string) =>
  request<{ declined: boolean }>(`/me/cases/${encodeURIComponent(alertId)}/decline`, { method: 'POST' });

export const advanceCase = (alertId: string) =>
  request<Incident>(`/me/cases/${encodeURIComponent(alertId)}/advance`, { method: 'POST' });

export const cancelCase = (alertId: string) =>
  request<Incident>(`/me/cases/${encodeURIComponent(alertId)}/cancel`, { method: 'POST' });

export const fetchFleet = () =>
  request<{ hospital: Hospital; ambulances: Ambulance[] }>('/me/fleet');

export const patchFleet = (body: { ambulances_total?: number; ambulances_available?: number }) =>
  request<{ hospital: Hospital; ambulances: Ambulance[] }>('/me/fleet', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const fetchBeds = () => request<Hospital>('/me/beds');

export const patchBeds = (body: { beds_total: number }) =>
  request<Hospital>('/me/beds', { method: 'PATCH', body: JSON.stringify(body) });

export function streamUrl() {
  return `${WS_BASE}/me/stream?token=${encodeURIComponent(token ?? '')}`;
}
