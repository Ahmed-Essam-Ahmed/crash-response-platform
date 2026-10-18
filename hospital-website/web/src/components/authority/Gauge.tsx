import { duration } from './chart';

export function Gauge({
  value,
  max,
  label,
  caption,
  size = 150,
  tone,
}: {
  value: number;
  max: number;
  label: string;
  caption?: string;
  size?: number;
  tone?: string;
}) {
  const safeMax = Math.max(max, 1);
  const frac = Math.max(0, Math.min(1, value / safeMax));
  const mid = size / 2;
  const cy = size * 0.58;
  const r = size * 0.42;
  const thick = size * 0.1;
  const C = 2 * Math.PI * r;
  const half = C / 2;
  const status =
    frac < 0.34 ? 'var(--sev-mild)' : frac < 0.67 ? 'var(--sev-moderate)' : 'var(--sev-critical)';
  const color = tone ?? status;
  const height = size * 0.66;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        <g transform={`rotate(180 ${mid} ${cy})`}>
          <circle
            cx={mid}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--line)"
            strokeWidth={thick}
            strokeLinecap="round"
            strokeDasharray={`${half} ${C}`}
          />
          <circle
            cx={mid}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thick}
            strokeLinecap="round"
            strokeDasharray={`${half * frac} ${C}`}
          >
            <title>{`${label}: ${duration(value)}`}</title>
          </circle>
        </g>
        <text x={mid} y={size * 0.54} textAnchor="middle" fontSize={size * 0.13} fontWeight={700} fill="var(--ink)">
          {duration(value)}
        </text>
      </svg>
      <p className="text-xs font-medium">{label}</p>
      {caption && <p className="text-xs text-muted">{caption}</p>}
    </div>
  );
}
