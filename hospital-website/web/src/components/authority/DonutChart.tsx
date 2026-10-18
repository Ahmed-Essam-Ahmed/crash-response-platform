import { PALETTE, pct } from './chart';

export function DonutChart({
  data,
  labelKey,
  valueKey,
  size = 160,
  stroke = 22,
  palette = PALETTE,
  centerLabel,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  size?: number;
  stroke?: number;
  palette?: string[];
  centerLabel?: string;
}) {
  const slices = data
    .map((d) => ({ label: String(d[labelKey] ?? '—'), value: Number(d[valueKey]) || 0 }))
    .filter((s) => s.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="grid place-items-center text-muted" style={{ height: size }}>
        No data
      </div>
    );
  }

  const mid = size / 2;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {slices.map((s, i) => {
          const dash = (s.value / total) * C;
          const el = (
            <circle
              key={s.label + i}
              cx={mid}
              cy={mid}
              r={r}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${mid} ${mid})`}
            >
              <title>{`${s.label}: ${s.value} (${pct(s.value, total)})`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
        <text x={mid} y={mid - 2} textAnchor="middle" fontSize={size * 0.16} fontWeight={700} fill="var(--ink)">
          {total}
        </text>
        <text x={mid} y={mid + size * 0.11} textAnchor="middle" fontSize={size * 0.08} fill="var(--muted)">
          {centerLabel ?? 'total'}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {slices.map((s, i) => (
          <li key={s.label + i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: palette[i % palette.length] }} />
            <span className="min-w-0 flex-1 truncate capitalize">{s.label.replace(/_/g, ' ')}</span>
            <span className="text-muted">{s.value}</span>
            <span className="w-9 text-right tabular-nums text-muted">{pct(s.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
