import type { Ambulance, Hospital, Incident } from './types';

const API = import.meta.env.VITE_API ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const health = () => request<{ status: string; stream_clients: number }>('/health');
export const fetchActive = () => request<Incident[]>('/incidents/active');
export const fetchRecent = () => request<Incident[]>('/incidents?limit=50');
export const fetchHospitals = () => request<Hospital[]>('/hospitals');
export const fetchFleet = () => request<Ambulance[]>('/fleet');
export const fetchIncident = (alertId: string) =>
  request<Incident>(`/incidents/${encodeURIComponent(alertId)}`);

export const cancelIncident = (alertId: string) =>
  request<Incident>(`/incidents/${encodeURIComponent(alertId)}/cancel`, { method: 'POST' });

export const reportCrash = (body: Record<string, unknown>) =>
  request<Incident>('/incidents', { method: 'POST', body: JSON.stringify(body) });

export const WS_URL = import.meta.env.VITE_WS ?? 'ws://localhost:8000/stream';
