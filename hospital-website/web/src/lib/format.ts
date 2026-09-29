export function ago(iso: string) {
  const then = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function clock(iso: string) {
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function minutes(secs: number | null) {
  if (secs == null) return '—';
  return `${Math.max(1, Math.round(secs / 60))} min`;
}

export function distance(metres: number | null) {
  if (metres == null) return '—';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function countdown(iso: string) {
  const then = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
  const secs = Math.max(0, Math.floor((then - Date.now()) / 1000));
  const mins = Math.floor(secs / 60);
  return `${mins}:${String(secs % 60).padStart(2, '0')}`;
}

export function todayTime(iso: string) {
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return d.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
