import { useEffect, useRef } from 'react';
import type { Ambulance, Hospital, Incident } from '../types';

const BOUNDS = { minLat: 30.026, maxLat: 30.050, minLon: 31.230, maxLon: 31.254 };
const SEVERITY_HIGH = 7;

interface Props {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (alertId: string) => void;
}

function project(lat: number, lon: number, w: number, h: number) {
  const x = ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * w;
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h;
  return { x, y };
}

function severityColor(severity: number) {
  if (severity >= SEVERITY_HIGH) return '#ff4d4d';
  if (severity >= 5.5) return '#ffab40';
  return '#ffd54f';
}

export default function MapCanvas({ hospitals, ambulances, incidents, selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ hospitals, ambulances, incidents, selectedId, onSelect });
  stateRef.current = { hospitals, ambulances, incidents, selectedId, onSelect };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(wrap.clientWidth * dpr);
      canvas.height = Math.round(wrap.clientHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let frame = 0;
    const draw = () => {
      const { hospitals: hs, ambulances: ambs, incidents: incs, selectedId: sel, onSelect: pick } = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0b1620';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(45,90,120,0.35)';
      ctx.lineWidth = 1 * (window.devicePixelRatio || 1);
      for (let i = 0; i <= 6; i++) {
        const x = (w / 6) * i;
        const y = (h / 6) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      for (const hospital of hs) {
        const { x, y } = project(hospital.lat, hospital.lon, w, h);
        const size = 16 * (window.devicePixelRatio || 1);
        ctx.fillStyle = hospital.trauma_level >= 3 ? '#26c6da' : hospital.trauma_level === 2 ? '#4fc3f7' : '#90caf9';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = '#fff';
        ctx.font = `${11 * (window.devicePixelRatio || 1)}px Helvetica`;
        ctx.fillText(hospital.hospital_id, x - 14 * (window.devicePixelRatio || 1), y - 14 * (window.devicePixelRatio || 1));
        ctx.fillStyle = '#8fb6d1';
        ctx.fillText(`${hospital.free_beds} beds`, x - 20 * (window.devicePixelRatio || 1), y + 26 * (window.devicePixelRatio || 1));
      }

      for (const amb of ambs) {
        if (amb.status === 'available') continue;
        const { x, y } = project(amb.lat, amb.lon, w, h);
        const r = 7 * (window.devicePixelRatio || 1);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = amb.status === 'on_scene' ? '#ff7043' : '#ffd166';
        ctx.fill();
        ctx.strokeStyle = '#0b1620';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const inc of incs) {
        const done = inc.status === 'closed' || inc.status === 'cancelled';
        const { x, y } = project(inc.lat, inc.lon, w, h);
        const pulse = 1 + 0.35 * Math.sin(Date.now() / 320);
        const base = (done ? 8 : 12) * (window.devicePixelRatio || 1);
        if (!done) {
          ctx.beginPath();
          ctx.arc(x, y, base * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `${severityColor(inc.severity)}33`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, base, 0, Math.PI * 2);
        ctx.fillStyle = done ? '#546e7a' : severityColor(inc.severity);
        ctx.fill();
        if (sel === inc.alert_id) {
          ctx.beginPath();
          ctx.arc(x, y, base * 1.9, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = '#0b1620';
        ctx.font = `bold ${10 * (window.devicePixelRatio || 1)}px Helvetica`;
        ctx.fillText(inc.severity.toFixed(1), x - 8 * (window.devicePixelRatio || 1), y + 4 * (window.devicePixelRatio || 1));
      }

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    const click = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (event.clientX - rect.left) * dpr;
      const y = (event.clientY - rect.top) * dpr;
      const { incidents: incs, onSelect: pick } = stateRef.current;
      for (const inc of incs) {
        const p = project(inc.lat, inc.lon, canvas.width, canvas.height);
        if (Math.hypot(p.x - x, p.y - y) < 16 * dpr) {
          pick(inc.alert_id);
          return;
        }
      }
    };
    canvas.addEventListener('click', click);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('click', click);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
