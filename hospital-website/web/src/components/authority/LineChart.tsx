export function LineChart({
  data,
  xKey,
  lines,
  height = 220,
  xFormat,
}: {
  data: any[];
  xKey: string;
  lines: { key: string; color: string; label: string }[];
  height?: number;
  xFormat?: (value: string) => string;
}) {
  const formatX = xFormat ?? ((value: string) => value.slice(5));
  if (data.length === 0) return <div className="text-muted">No data</div>;

  const width = 640;
  const left = 34;
  const right = 14;
  const top = 16;
  const bottom = 32;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  const max = Math.max(1, ...data.flatMap((d) => lines.map((l) => Number(d[l.key]) || 0)));
  const xAt = (i: number) => (data.length === 1 ? left + plotW / 2 : left + (i / (data.length - 1)) * plotW);
  const yAt = (v: number) => top + plotH - (v / max) * plotH;

  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
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

        {lines.map((l) => {
          const pts = data.map((d, i) => `${xAt(i)},${yAt(Number(d[l.key]) || 0)}`);
          const area = `${left},${top + plotH} ${pts.join(' ')} ${xAt(data.length - 1)},${top + plotH}`;
          return (
            <g key={l.key}>
              <polygon points={area} fill={l.color} opacity={0.08} />
              <polyline points={pts.join(' ')} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" />
              {data.map((d, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(Number(d[l.key]) || 0)} r={2.5} fill={l.color}>
                  <title>{`${String(d[xKey])} · ${l.label}: ${Number(d[l.key]) || 0}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={xAt(i)} y={height - 12} textAnchor="middle" fontSize={9} fill="var(--muted)">
              {formatX(String(d[xKey]))}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3">
        {lines.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
