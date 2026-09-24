import type { IncidentRow } from './types';

const API = 'http://localhost:8000';

export async function fetchIncidents(): Promise<IncidentRow[]> {
  const res = await fetch(`${API}/alerts`);
  return res.json();
}

export async function setSimConfig(mode?: 'scripted' | 'random', speed?: number) {
  const body = { mode, speed };
  const res = await fetch(`${API}/sim/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sim config error ${res.status}`);
  return res.json();
}