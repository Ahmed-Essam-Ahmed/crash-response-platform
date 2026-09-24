import { useEffect, useRef, useState } from 'react';
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchSummary } from '../api';
import type { AnalyticsSummary, Hotspot } from '../types';

const WORLD = { minLat: 30.026, maxLat: 30.05, minLon: 31.23, maxLon: 31.254, spacing: 0.004 };

function toXY(lat: number, lon: number, w: number, h: number) {
  const x = ((lon - WORLD.minLon) / (WORLD.maxLon - WORLD.minLon)) * w;
  const y = (1 - (lat - WORLD.minLat) / (WORLD.maxLat - WORLD.minLat)) * h;
  return { x, y };
}

function Heatmap({ hotspots }: { hotspots: Hotspot[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(wrap.clientWidth * dpr);
      canvas.height = Math.round(320 * dpr);
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(wrap);

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0c1a26';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1d3a4f';
    ctx.lineWidth = 2;
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

    for (const cell of hotspots) {
      const { x, y } = toXY(cell.lat, cell.lon, w, h);
      const hot = cell.max_severity >= 7;
      const alpha = Math.min(0.35 + cell.count * 0.15, 0.9);
      ctx.fillStyle = hot ? `rgba(255,61,61,${alpha})` : `rgba(255,152,0,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 10 + cell.count * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${10 + cell.count}px Helvetica`;
      ctx.fillText(String(cell.count), x - 3, y + 3);
    }
    return () => obs.disconnect();
  }, [hotspots]);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: 320 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 320, display: 'block' }} />
    </div>
  );
}

export default function AnalyticsPanel() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    const load = () => fetchSummary().then(setSummary).catch(() => setSummary(null));
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const t = summary?.totals;
  const byHour = summary?.by_hour ?? [];
  const dist = summary?.severity_distribution ?? [];

  return (
    <div style={styles.root}>
      <section style={styles.stats}>
        <Stat label="Incidents" value={t?.incidents ?? 0} />
        <Stat label="Hot cells" value={t?.hot_cells ?? 0} />
        <Stat label="Severe (≥7)" value={t?.severe ?? 0} />
        <Stat label="Avg severity" value={t?.avg_severity ?? 0} />
      </section>

      <section style={styles.card}>
        <h3>Red Zones — Accident Hotspots</h3>
        <p style={styles.meta}>red = severity ≥ 7 · numbers = incidents per cell</p>
        <Heatmap hotspots={summary?.hotspots ?? []} />
      </section>

      <section style={styles.card}>
        <h3>Incidents by Hour of Day</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byHour}>
            <XAxis dataKey="hour" tick={{ fill: '#9ab3c8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ab3c8', fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#10222e', border: '1px solid #1f3a4b' }} />
            <Bar dataKey="count" fill="#ef6c00" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={styles.card}>
        <h3>Severity Distribution</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dist}>
            <XAxis dataKey="bucket" tick={{ fill: '#9ab3c8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ab3c8', fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#10222e', border: '1px solid #1f3a4b' }} />
            <Bar dataKey="count" fill="#c62828" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 14,
    background: '#0c1620', minHeight: '100%', fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  stats: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  stat: { background: '#10222e', border: '1px solid #1f3a4b', borderRadius: 10, padding: 14, color: '#dff1fa', textAlign: 'center' },
  statValue: { fontSize: 28, fontWeight: 700, color: '#7fd0f0' },
  statLabel: { fontSize: 12, color: '#8196a8', marginTop: 4 },
  card: { background: '#10222e', border: '1px solid #1f3a4b', borderRadius: 10, padding: 14, color: '#dff1fa' },
  meta: { color: '#8196a8', fontSize: 12, margin: '4px 0 10px 0' },
};
