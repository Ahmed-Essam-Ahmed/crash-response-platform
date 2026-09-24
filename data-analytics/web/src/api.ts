import type { AnalyticsSummary } from './types';

const API = import.meta.env.VITE_ANALYTICS_API ?? 'http://localhost:8001';

export async function fetchSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API}/analytics/summary`);
  if (!res.ok) throw new Error(`analytics error ${res.status}`);
  return res.json();
}
