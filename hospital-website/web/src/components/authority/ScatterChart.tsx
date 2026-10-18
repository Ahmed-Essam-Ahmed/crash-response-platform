export function ScatterChart({
  data,
  xKey,
  yKey,
  height = 240,
  color = 'var(--primary)',
  xFormat,
}: {
  data: any[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
  xFormat?: (value: number) => string;
}) {
  if (data.length === 0) return <div className="text-muted">No data</div>;

  const width = 640;
  const left = 40;
  const right = 16;
  const top = 14;
  const bottom = 34;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  const xs = data.map((d) => Number(d[xKey]) || 0);
  const ys = data.map((d) => Number(d[yKey]) || 0);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs, xMin + 1);
  const yMax = Math.max(1, ...ys);

  const xAt = (v: number) => left + ((v - xMin) / (xMax - xMin)) * plotW;
  const yAt = (v: number) => top + plotH - (v / yMax) * plotH;
  const fmtX = xFormat ?? ((v: number) => String(v));
  const xTicks = 6;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = top + plotH - t * plotH;
        return (
          <g key={t}>
            <line x1={left} x2={width - right} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
              {Math.round(yMax * t)}
            </text>
          </g>
        );
      })}

      {Array.from({ length: xTicks + 1 }, (_, i) => {
        const v = xMin + ((xMax - xMin) * i) / xTicks;
        return (
          <text key={i} x={xAt(v)} y={height - 12} textAnchor="middle" fontSize={9} fill="var(--muted)">
            {fmtX(Math.round(v))}
          </text>
        );
      })}

      <line x1={left} x2={left} y1={top} y2={top + plotH} stroke="var(--line-strong)" strokeWidth={1} />
      <line x1={left} x2={width - right} y1={top + plotH} y2={top + plotH} stroke="var(--line-strong)" strokeWidth={1} />

      {data.map((d, i) => {
        const x = xAt(Number(d[xKey]) || 0);
        const y = yAt(Number(d[yKey]) || 0);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={6} fill={color} opacity={0.85}>
              <title>{`${fmtX(Number(d[xKey]))} · ${Number(d[yKey])} incidents`}</title>
            </circle>
            <circle cx={x} cy={y} r={2.4} fill="var(--surface)" />
          </g>
        );
      })}
    </svg>
  );
}
