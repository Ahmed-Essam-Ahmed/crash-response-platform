import { useEffect, useRef } from 'react';
import type { EmergencyAlert, VehicleState } from '../types';

const WORLD = { minLat: 30.026, maxLat: 30.05, minLon: 31.23, maxLon: 31.254, spacing: 0.004 };
const HOSPITALS = [
  { code: 'hosp-01', lat: 30.05, lon: 31.23 },
  { code: 'hosp-02', lat: 30.042, lon: 31.238 },
  { code: 'hosp-03', lat: 30.034, lon: 31.25 },
];

type Ambulance = {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  startedAt: number;
  durationMs: number;
  etaSeconds: number;
};

type Props = {
  vehicles: VehicleState[];
  alerts: EmergencyAlert[];
};

function toXY(lat: number, lon: number, w: number, h: number) {
  const x = ((lon - WORLD.minLon) / (WORLD.maxLon - WORLD.minLon)) * w;
  const y = (1 - (lat - WORLD.minLat) / (WORLD.maxLat - WORLD.minLat)) * h;
  return { x, y };
}

function sevColor(sev: number) {
  if (sev >= 7) return '#ff5252';
  if (sev >= 4) return '#ff9800';
  return '#ffd54f';
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function CanvasView({ vehicles, alerts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const vehiclesRef = useRef<VehicleState[]>([]);
  const alertsRef = useRef<EmergencyAlert[]>([]);
  const ambulancesRef = useRef<Map<string, Ambulance>>(new Map());
  const prevPosRef = useRef<Map<string, { lat: number; lon: number }>>(new Map());

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    alertsRef.current = alerts;
    for (const alert of alerts) {
      if (ambulancesRef.current.has(alert.alert_id)) continue;
      const hospital = HOSPITALS.find((h) => h.code === alert.assignment?.hospital_id) ?? HOSPITALS[0];
      if (!alert.route || alert.route.length === 0) continue;
      const to = alert.route[alert.route.length - 1] ?? alert.location;
      ambulancesRef.current.set(alert.alert_id, {
        from: { lat: hospital.lat, lon: hospital.lon },
        to,
        startedAt: performance.now(),
        durationMs: clamp(alert.eta_seconds * 40, 3500, 5500),
        etaSeconds: alert.eta_seconds,
      });
    }
    if (ambulancesRef.current.size > 60) {
      ambulancesRef.current = new Map([...ambulancesRef.current].slice(-40));
    }
  }, [alerts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
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

    let raf = 0;
    const draw = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0c1a26';
      ctx.fillRect(0, 0, w, h);

      drawRoads(ctx, w, h);
      drawHospitals(ctx, w, h);
      drawVehicles(ctx, now);
      drawAmbulances(ctx, now);
      drawIncidents(ctx, now);
      drawLegend(ctx);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  function drawRoads(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = '#1d3a4f';
    ctx.lineWidth = 3;
    const cols = Math.round((WORLD.maxLon - WORLD.minLon) / WORLD.spacing);
    const rows = Math.round((WORLD.maxLat - WORLD.minLat) / WORLD.spacing);
    for (let c = 0; c <= cols; c++) {
      const p = toXY(WORLD.minLat, WORLD.minLon + c * WORLD.spacing, w, h);
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const p = toXY(WORLD.minLat + r * WORLD.spacing, WORLD.minLon, w, h);
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
    }
  }

  function drawHospitals(ctx: CanvasRenderingContext2D, w: number, h: number) {
    for (const hosp of HOSPITALS) {
      const { x, y } = toXY(hosp.lat, hosp.lon, w, h);
      ctx.fillStyle = '#2e7d32';
      ctx.strokeStyle = '#a5d6a7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(x - 7, y - 7, 14, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Helvetica';
      ctx.fillText('+', x - 3.5, y + 3);
      ctx.fillStyle = '#a5d6a7';
      ctx.font = '9px Helvetica';
      ctx.fillText(hosp.code, x - 14, y + 18);
    }
  }

  function drawVehicles(ctx: CanvasRenderingContext2D, now: number) {
    const prev = prevPosRef.current;
    for (const v of vehiclesRef.current) {
      const { x, y } = toXY(v.lat, v.lon, ctx.canvas.width, ctx.canvas.height);
      const old = prev.get(v.trip_id);
      let angle = -Math.PI / 2;
      if (old) angle = Math.atan2(v.lon - old.lon, v.lat - old.lat);
      prev.set(v.trip_id, { lat: v.lat, lon: v.lon });

      const crashed = v.status === 'crashed';
      ctx.fillStyle = crashed ? '#ff5252' : '#37b6ff';
      ctx.beginPath();
      ctx.arc(x, y, crashed ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (crashed) {
        ctx.strokeStyle = `rgba(255,82,82,${0.4 + 0.4 * Math.sin(now / 200)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#eaf7ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8);
        ctx.stroke();
      }
    }
  }

  function drawIncidents(ctx: CanvasRenderingContext2D, now: number) {
    for (const a of alertsRef.current) {
      const { x, y } = toXY(a.location.lat, a.location.lon, ctx.canvas.width, ctx.canvas.height);
      const color = sevColor(a.severity);
      const pulse = 0.6 + 0.4 * Math.sin(now / 150);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 7 + a.severity * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,60,60,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12 + (now / 40) % 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#0c1a26';
      ctx.font = 'bold 9px Helvetica';
      ctx.fillText(a.severity.toFixed(0), x - 3.5, y + 3.5);
    }
  }

  function drawAmbulances(ctx: CanvasRenderingContext2D, now: number) {
    for (const [id, amb] of ambulancesRef.current) {
      const since = now - amb.startedAt;
      const done = since >= amb.durationMs;
      const t = done ? 1 : since / amb.durationMs;
      const lat = amb.from.lat + (amb.to.lat - amb.from.lat) * t;
      const lon = amb.from.lon + (amb.to.lon - amb.from.lon) * t;

      const a1 = toXY(amb.from.lat, amb.from.lon, ctx.canvas.width, ctx.canvas.height);
      const a2 = toXY(amb.to.lat, amb.to.lon, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = 'rgba(255,213,79,0.35)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const p = toXY(lat, lon, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = done ? '#2e7d32' : '#ffd54f';
      ctx.strokeStyle = '#0c1a26';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0c1a26';
      ctx.font = 'bold 7px Helvetica';
      const label = done ? 'R' : Math.max(1, Math.round(amb.etaSeconds * (1 - t))).toFixed(0);
      ctx.fillText(label, p.x - 3, p.y + 2.5);

      if (done) ambulancesRef.current.delete(id);
    }
  }

  function drawLegend(ctx: CanvasRenderingContext2D) {
    ctx.font = '10px Helvetica';
    const items: Array<[string, string]> = [
      ['#37b6ff', 'vehicle'],
      ['#ff5252', 'crash/incident'],
      ['#ffd54f', 'ambulance (ETA s)'],
      ['#2e7d32', 'hospital'],
    ];
    let y = 14;
    ctx.textAlign = 'left';
    for (const [color, label] of items) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(14, y - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8c4d8';
      ctx.fillText(label, 24, y);
      y += 16;
    }
    ctx.textAlign = 'left';
  }

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', height: '100%', position: 'relative' },
};