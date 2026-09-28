import { useEffect, useRef } from 'react';
import { toneForSeverity } from '../lib/status';
import type { Tone } from '../lib/status';
import type { Ambulance, Hospital, Incident } from '../types';

const BOUNDS = { minLat: 30.0, maxLat: 30.12, minLon: 31.19, maxLon: 31.29 };
const SEVERITY: Record<Tone, string> = {
  critical: 'var(--sev-critical)',
  serious: 'var(--sev-serious)',
  moderate: 'var(--sev-moderate)',
  mild: 'var(--sev-mild)',
};

function readVar(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

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
    if (!w || !h) return;
    el.width = w * ratio;
    el.height = h * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const root = document.documentElement;
    const surface = readVar(root, '--surface');
    const line = readVar(root, '--line');
    const ink = readVar(root, '--ink');
    const primary = readVar(root, '--primary');
    const palette = {
      critical: readVar(root, '--sev-critical'),
      serious: readVar(root, '--sev-serious'),
      moderate: readVar(root, '--sev-moderate'),
      mild: readVar(root, '--sev-mild'),
    };

    const px = (lon: number) => ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * w;
    const py = (lat: number) => h - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h;

    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.round((w / 6) * i) + 0.5, 0);
      ctx.lineTo(Math.round((w / 6) * i) + 0.5, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, Math.round((h / 5) * i) + 0.5);
      ctx.lineTo(w, Math.round((h / 5) * i) + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    for (const hospital of hospitals) {
      ctx.beginPath();
      ctx.moveTo(px(hospital.lon), py(hospital.lat));
      ctx.lineTo(w / 2, h / 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const amb of ambulances) {
      if (amb.status === 'available' || amb.status === 'out_of_service') continue;
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(px(amb.lon), py(amb.lat), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = surface;
      ctx.stroke();
    }

    for (const incident of incidents) {
      if (incident.status === 'closed' || incident.status === 'cancelled') continue;
      const color = palette[toneForSeverity(incident.severity)];
      const x = px(incident.lon);
      const y = py(incident.lat);
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
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
      ctx.beginPath();
      ctx.roundRect(x - 5, y - 5, 10, 10, 3);
      ctx.fill();
      ctx.fillStyle = surface;
      ctx.beginPath();
      ctx.roundRect(x - 2.5, y - 2.5, 5, 5, 1.5);
      ctx.fill();
    }
  }, [hospitals, ambulances, incidents]);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-baseline justify-between px-5 pt-4 pb-3">
        <h2 className="text-sm font-semibold tracking-tight">Where things are happening</h2>
        <span className="text-xs text-muted">Live positions</span>
      </div>
      <canvas ref={canvas} className="block h-56 w-full @2xl:h-72" aria-label="Map of hospitals, ambulances and open cases" role="img" />
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3.5 text-2xs text-muted">
        {(['critical', 'serious', 'moderate', 'mild'] as const).map((key) => (
          <li key={key} className="inline-flex items-center gap-1.5 capitalize">
            <span className="size-2 rounded-full" style={{ backgroundColor: SEVERITY[key] }} />
            {key}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />Ambulance
        </li>
      </ul>
    </section>
  );
}
