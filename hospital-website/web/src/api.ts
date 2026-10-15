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

export interface RegistryEntry {
  id: number;
  name: string;
  name_ar: string | null;
  governorate: string;
  lat: number | null;
  lon: number | null;
  address: string | null;
  has_location: boolean;
  claimed: boolean;
}

export const searchRegistry = (params: { q?: string; governorate?: string; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.governorate) query.set('governorate', params.governorate);
  query.set('limit', String(params.limit ?? 20));
  return request<{ query: string; results: RegistryEntry[]; governorates: string[] }>(
    `/auth/registry?${query}`,
  );
};

export const joinHospital = (body: {
  registry_id: number;
  admin: { email: string; password: string; full_name?: string };
  trauma_level?: number;
  ambulances_total?: number;
  ambulances_available?: number;
  beds_total?: number;
  phone?: string;
  emergency_phone?: string;
  lat?: number;
  lon?: number;
}) => request<Session>('/auth/join', { method: 'POST', body: JSON.stringify(body) });

export const submitClaim = (body: {
  name: string;
  governorate: string;
  lat: number;
  lon: number;
  address?: string;
  phone?: string;
  claimed_by_name: string;
  email: string;
  evidence?: string;
}) =>
  request<{ status: string; message: string; registry_id?: number; claim_id?: number }>(
    '/auth/claims',
    { method: 'POST', body: JSON.stringify(body) },
  );

export interface PlatformOverview {
  generated_at: string;
  hospitals: (Hospital & { id: number; staff_count: number; registry_id: number | null })[];
  ambulances: (Ambulance & { hospital_name: string; incident_alert_id: string | null })[];
  incidents: (Incident & {
    lat: number;
    lon: number;
    location_label: string | null;
    created_at: string | null;
    updated_at: string | null;
    hospital_name: string | null;
    hospital_id: number | null;
    ambulance_ids: string[];
  })[];
  pending_claims: { id: number; name: string; governorate: string; lat: number | null; lon: number | null; address: string | null; phone: string | null; claimed_by_name: string; claimed_by_email: string; evidence: string | null; created_at: string | null }[];
}

const PLATFORM_KEY = 'crash-platform-review-key';

export function getPlatformKey() {
  return localStorage.getItem(PLATFORM_KEY) ?? '';
}

export function setPlatformKey(value: string) {
  if (value) localStorage.setItem(PLATFORM_KEY, value);
  else localStorage.removeItem(PLATFORM_KEY);
}

export async function platformRequest<T>(path: string, key: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Review-Key', key);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the response service');
  }
  const text = await response.text();
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status})`;
    throw new ApiError(response.status, detail);
  }
  return body as T;
}

export const fetchPlatformOverview = (key: string) =>
  platformRequest<PlatformOverview>('/auth/review/overview', key);

export const fetchPlatformIncident = (key: string, alertId: string) =>
  platformRequest<Incident>(`/auth/review/incidents/${encodeURIComponent(alertId)}`, key);

export const reviewHospitalClaim = (key: string, claimId: number, decision: 'approve' | 'reject') =>
  platformRequest<{ status: string; claim_id: number; mail_sent: boolean }>(
    `/auth/review/claims/${claimId}/${decision}`,
    key,
    { method: 'POST', body: JSON.stringify({}) },
  );

export const updatePlatformCapacity = (
  key: string,
  hospitalId: number,
  body: { beds_total?: number; ambulances_total?: number; ambulances_available?: number },
) => platformRequest<Hospital>(`/auth/review/hospitals/${hospitalId}/capacity`, key, {
  method: 'PATCH', body: JSON.stringify(body),
});

export const interveneOnIncident = (key: string, alertId: string, action: 'advance' | 'cancel') =>
  platformRequest<{ alert_id: string; status: string }>(
    `/auth/review/incidents/${encodeURIComponent(alertId)}/${action}`,
    key,
    { method: 'POST', body: JSON.stringify({}) },
  );

export const previewInvitation = (token: string) =>
  request<{
    hospital: string;
    address: string | null;
    role: string;
    email: string;
    expires_at: string;
  }>(`/auth/invitations/${encodeURIComponent(token)}`);

export const acceptInvitation = (token: string, body: { password: string; full_name?: string }) =>
  request<Session>(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const login = (email: string, password: string) =>
  request<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const logout = () => request<{ signed_out: boolean }>('/auth/logout', { method: 'POST' });

export const fetchMe = () => request<{ user: User; hospital: Hospital }>('/auth/me');

export const fetchStaff = () => request<User[]>('/auth/staff');

export interface Invitation {
  id: number;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export const fetchInvitations = () =>
  request<(Invitation & { invite_link?: string })[]>('/auth/staff/invitations');

export const inviteStaff = (body: { email: string; role: string }) =>
  request<Invitation & { invite_link: string; mail_sent: boolean; mail_configured: boolean }>(
    '/auth/staff/invitations',
    { method: 'POST', body: JSON.stringify(body) },
  );

export const revokeInvitation = (invitationId: number) =>
  request<{ revoked: boolean }>(`/auth/staff/invitations/${invitationId}`, { method: 'DELETE' });

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
