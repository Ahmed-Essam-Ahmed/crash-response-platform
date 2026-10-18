import { useCallback, useEffect, useMemo, useRef } from 'react';

const DEMO = { minLat: 30.026, maxLat: 30.05, minLon: 31.23, maxLon: 31.254 };

function boundsFor(hotspots: any[]) {
  if (hotspots.length === 0) return { ...DEMO, spacing: 0.004 };
  const lats = hotspots.map((h) => h.lat);
  const lons = hotspots.map((h) => h.lon);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  const padLat = Math.max((maxLat - minLat) * 0.1, 0.002);
  const padLon = Math.max((maxLon - minLon) * 0.1, 0.002);
  minLat -= padLat;
  maxLat += padLat;
  minLon -= padLon;
  maxLon += padLon;
  return { minLat, maxLat, minLon, maxLon, spacing: Math.max((maxLon - minLon) / 8, 0.002) };
}

const SCALE: { min: number; color: string; label: string }[] = [
  { min: 8, color: '#ff3b3b', label: 'Critical ≥8' },
  { min: 7, color: '#ff7a1a', label: 'Severe ≥7' },
  { min: 5, color: '#ffb020', label: 'Moderate ≥5' },
  { min: 0, color: '#4fbf86', label: 'Mild' },
];

function colorFor(severity: number) {
  return SCALE.find((s) => severity >= s.min)!.color;
}

export function HeatMap({ hotspots }: { hotspots: any[] }) {
  const world = useMemo(() => boundsFor(hotspots), [hotspots]);
  const toXY = useCallback(
    (lat: number, lon: number, w: number, h: number) => {
      const x = ((lon - world.minLon) / (world.maxLon - world.minLon)) * w;
      const y = (1 - (lat - world.minLat) / (world.maxLat - world.minLat)) * h;
      return { x, y };
    },
    [world],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(wrap.clientWidth * dpr);
      canvas.height = Math.round(320 * dpr);
      const w = canvas.width;
      const h = canvas.height;

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0b1a25');
      bg.addColorStop(1, '#0e2430');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(93, 156, 184, 0.18)';
      ctx.lineWidth = 1;
      const cols = Math.round((world.maxLon - world.minLon) / world.spacing);
      const rows = Math.round((world.maxLat - world.minLat) / world.spacing);
      for (let c = 0; c <= cols; c++) {
        const p = toXY(world.minLat, world.minLon + c * world.spacing, w, h);
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, h);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        const p = toXY(world.minLat + r * world.spacing, world.minLon, w, h);
        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(w, p.y);
        ctx.stroke();
      }

      const maxCount = Math.max(1, ...hotspots.map((c) => c.count));
      for (const cell of hotspots) {
        const { x, y } = toXY(cell.lat, cell.lon, w, h);
        const color = colorFor(cell.max_severity);
        const r = 12 + (cell.count / maxCount) * 20;

        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
        glow.addColorStop(0, color);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.9;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${Math.max(11, r * 0.85)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cell.count), x, y + 0.5);
      }
      ctx.globalAlpha = 1;
    };

    draw();
    const obs = new ResizeObserver(draw);
    obs.observe(wrap);
    return () => obs.disconnect();
  }, [hotspots, world, toXY]);

  return (
    <div className="overflow-hidden rounded-[0.9rem] border border-line">
      <div ref={wrapRef} style={{ width: '100%', height: 320 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 320, display: 'block' }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-[#0b1a25] px-3 py-2">
        {SCALE.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-white/70">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-white/50">bubble size ∝ incidents</span>
      </div>
    </div>
  );
}
