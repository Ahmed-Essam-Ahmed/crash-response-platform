import type { Role } from './types';

const API = import.meta.env.VITE_ANALYTICS_API ?? 'http://localhost:8001';
const TOKEN_KEY = 'hospital-console-token';

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function getToken() {
  return token;
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
    throw new ApiError(0, 'Cannot reach analytics service');
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
    const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : null;
    throw new ApiError(401, typeof detail === 'string' ? detail : 'Unauthorised');
  }

  if (!res.ok) {
    const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : null;
    throw new ApiError(res.status, typeof detail === 'string' ? detail : `Request failed (${res.status})`);
  }
  return body as T;
}

export interface AnalyticsFilters {
  regions: string[];
  hospitals: { code: string; name: string }[];
  sexes: string[];
  age_groups: string[];
  destinations: string[];
  statuses: string[];
  date_from: string | null;
  date_to: string | null;
  severity_min: number;
  severity_max: number;
}

export interface Hotspot {
  lat: number;
  lon: number;
  count: number;
  max_severity: number;
}

export interface PointCount {
  hour?: number;
  day?: string;
  count: number;
  avg_severity?: number;
  date?: string;
  bucket?: string;
  region?: string;
  severe?: number;
  hospital_code?: string;
  hospital_name?: string;
  avg_response_seconds?: number;
  group?: string;
  sex?: string;
  key?: string;
}

export interface ResponseTimes {
  count: number;
  avg_accept_seconds: number;
  avg_scene_travel_seconds: number;
  avg_hospital_travel_seconds: number;
  avg_total_seconds: number;
  p50: number;
  p90: number;
  buckets: { label: string; count: number }[];
}

export interface Demographics {
  by_sex: { sex: string; count: number }[];
  by_age_group: { group: string; count: number }[];
}

export interface AnalyticsSummary {
  totals: {
    incidents: number;
    avg_severity: number;
    severe: number;
    critical: number;
    avg_response_seconds: number;
    avg_scene_seconds: number;
    hospitals_active: number;
    regions_active: number;
    unclaimed: number;
  };
  hotspots: Hotspot[];
  by_hour: { hour: number; count: number }[];
  by_weekday: { day: string; count: number }[];
  by_age: { age: number; count: number }[];
  by_year: { year: number; count: number }[];
  trend: { date: string; count: number; avg_severity: number }[];
  severity_distribution: { bucket: string; count: number }[];
  by_region: { region: string; count: number; avg_severity: number; severe: number }[];
  by_hospital: { hospital_code: string; hospital_name: string; count: number; avg_severity: number; avg_response_seconds: number }[];
  demographics: Demographics;
  response_times: ResponseTimes;
  destination_distribution: { key: string; count: number }[];
  status_distribution: { key: string; count: number }[];
}

export async function fetchFilters(): Promise<AnalyticsFilters> {
  return request<AnalyticsFilters>('/analytics/filters');
}

export async function fetchSummary(params: Record<string, string> = {}): Promise<AnalyticsSummary> {
  const qs = new URLSearchParams(params).toString();
  return request<AnalyticsSummary>(`/analytics/summary${qs ? `?${qs}` : ''}`);
}

export async function fetchIncidents(params: Record<string, string> = {}): Promise<any[]> {
  const qs = new URLSearchParams(params).toString();
  return request<any[]>(`/analytics/incidents${qs ? `?${qs}` : ''}`);
}
