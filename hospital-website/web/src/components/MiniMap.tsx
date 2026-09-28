import { useEffect, useRef } from 'react';
import type { Ambulance, Hospital, Incident } from '../types';
import { toneForSeverity } from '../lib/status';

const BOUNDS = { minLat: 30.0, maxLat: 30.12, minLon: 31.19, maxLon: 31.29 };

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#e11d48',
  serious: '#f97316',
  moderate: '#f59e0b',
  mild: '#10b981',
  neutral: '#10b981',
};

export function MiniMap({
  hospitals,
  ambulances,
  incidents,
}: {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    el.width = w * ratio;
    el.height = h * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const dark = document.documentElement.classList.contains('dark');
    const ink = dark ? '#eef2f8' : '#0f172a';
    const grid = dark ? 'rgba(148,163,184,0.10)' : 'rgba(100,116,139,0.12)';
    const road = dark ? 'rgba(148,163,184,0.20)' : 'rgba(100,116,139,0.22)';
    const surface = dark ? '#121a2b' : '#ffffff';

    const px = (lon: number) => ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * w;
    const py = (lat: number) => h - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h;

    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo((w / 6) * i, 0);
      ctx.lineTo((w / 6) * i, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (h / 5) * i);
      ctx.lineTo(w, (h / 5) * i);
      ctx.stroke();
    }

    ctx.strokeStyle = road;
    ctx.lineWidth = 2.5;
    for (const hospital of hospitals) {
      ctx.beginPath();
      ctx.moveTo(px(hospital.lon), py(hospital.lat));
      ctx.lineTo(w / 2, h / 2);
      ctx.stroke();
    }

    for (const amb of ambulances) {
      if (amb.status === 'available' || amb.status === 'out_of_service') continue;
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(px(amb.lon), py(amb.lat), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const incident of incidents) {
      if (incident.status === 'closed' || incident.status === 'cancelled') continue;
      const color = SEVERITY_COLORS[toneForSeverity(incident.severity)];
      const x = px(incident.lon);
      const y = py(incident.lat);
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fillStyle = `${color}26`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = surface;
      ctx.stroke();
    }

    for (const hospital of hospitals) {
      const x = px(hospital.lon);
      const y = py(hospital.lat);
      ctx.fillStyle = ink;
      ctx.fillRect(x - 4.5, y - 4.5, 9, 9);
      ctx.fillStyle = surface;
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
  }, [hospitals, ambulances, incidents]);

  return (
    <div className="card shadow-soft overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-sm font-semibold">Where things are happening</h2>
        <span className="text-xs text-[var(--color-muted)]">Live</span>
      </div>
      <canvas ref={canvas} className="h-64 w-full" />
      <div className="flex flex-wrap gap-4 px-5 py-3.5 text-[11px] text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Critical
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Serious
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Moderate
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Mild
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Ambulance
        </span>
      </div>
    </div>
  );
}
