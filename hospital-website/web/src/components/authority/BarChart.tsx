export function BarChart({
  data,
  xKey,
  yKey,
  height = 180,
  color = 'var(--primary)',
  formatLabel,
}: {
  data: any[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
  formatLabel?: (d: any) => string;
}) {
  if (data.length === 0) return <div className="text-muted">No data</div>;

  const values = data.map((d) => Number(d[yKey]) || 0);
  const max = Math.max(...values, 1);
  const barW = 22;
  const gap = 10;
  const left = 34;
  const right = 10;
  const top = 18;
  const bottom = 22;
  const plotH = height - top - bottom;
  const width = left + data.length * (barW + gap) + right;
  const allInts = values.every((v) => Number.isInteger(v));

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map((t) => {
        const y = top + plotH - t * plotH;
        return (
          <g key={t}>
            <line x1={left} x2={width - right} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const v = Number(d[yKey]) || 0;
        const h = (v / max) * plotH;
        const x = left + i * (barW + gap);
        const y = top + plotH - h;
        const label = formatLabel ? formatLabel(d) : String(d[xKey] ?? '');
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={4} fill={color} opacity={0.9}>
              <title>{`${label}: ${allInts ? v : v.toFixed(1)}`}</title>
            </rect>
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="var(--ink-soft)">
              {allInts ? v : v.toFixed(1)}
            </text>
            <text x={x + barW / 2} y={height - 7} textAnchor="middle" fontSize={9} fill="var(--muted)">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
