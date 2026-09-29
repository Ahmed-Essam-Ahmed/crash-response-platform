import { useEffect, useMemo, useRef } from 'react';
import { toneForSeverity } from '../lib/status';
import type { Tone } from '../lib/status';
import type { Ambulance, Hospital, Incident } from '../types';

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
  hospital,
  ambulances,
  incidents,
}: {
  hospital: Hospital;
  ambulances: Ambulance[];
  incidents: Incident[];
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const points = useMemo(() => {
    const list: { lat: number; lon: number }[] = [{ lat: hospital.lat, lon: hospital.lon }];
    for (const incident of incidents) {
      if (incident.status === 'closed' || incident.status === 'cancelled') continue;
      list.push(incident.location);
    }
    for (const amb of ambulances) {
      if (amb.status === 'out_of_service') continue;
      list.push({ lat: amb.lat, lon: amb.lon });
    }
    return list;
  }, [hospital, ambulances, incidents]);

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

    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLon = Math.min(...lons);
    let maxLon = Math.max(...lons);
    const padLat = Math.max((maxLat - minLat) * 0.25, 0.006);
    const padLon = Math.max((maxLon - minLon) * 0.25, 0.006);
    minLat -= padLat;
    maxLat += padLat;
    minLon -= padLon;
    maxLon += padLon;

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

    const px = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * w;
    const py = (lat: number) => h - ((lat - minLat) / (maxLat - minLat)) * h;

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
      const x = px(incident.location.lon);
      const y = py(incident.location.lat);
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

    const hx = px(hospital.lon);
    const hy = py(hospital.lat);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(hx - 5, hy - 5, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = surface;
    ctx.beginPath();
    ctx.roundRect(hx - 2.5, hy - 2.5, 5, 5, 1.5);
    ctx.fill();
  }, [points, hospital, ambulances, incidents]);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-baseline justify-between px-5 pt-4 pb-3">
        <h2 className="text-sm font-semibold tracking-tight">Around your hospital</h2>
        <span className="text-xs text-muted">Live positions</span>
      </div>
      <canvas
        ref={canvas}
        className="block h-52 w-full sm:h-64"
        aria-label="Map of your hospital, its ambulances and open cases"
        role="img"
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3.5 text-2xs text-muted">
        {(['critical', 'serious', 'moderate', 'mild'] as const).map((key) => (
          <li key={key} className="inline-flex items-center gap-1.5 capitalize">
            <span className="size-2 rounded-full" style={{ backgroundColor: SEVERITY[key] }} />
            {key}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          Ambulance out
        </li>
      </ul>
    </section>
  );
}
