export function BarChart({ data, xKey, yKey, height = 180 }: { data: any[]; xKey: string; yKey: string; height?: number }) {
  if (data.length === 0) return <div className="text-muted">No data</div>;
  const max = Math.max(...data.map((d) => Number(d[yKey]) || 0)) || 1;
  const width = 100;
  const barWidth = width / data.length / 1.2;
  const gap = barWidth * 0.2;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = ((Number(d[yKey]) || 0) / max) * (height - 20);
        const x = (i * width) / data.length + gap;
        const y = height - h - 4;
        const label = d[xKey]?.toString() ?? '';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={h} rx={1} ry={1} fill="var(--primary)" opacity={0.85} />
            <text x={x + barWidth / 2} y={height - 1} fontSize={2} textAnchor="middle" fill="var(--muted)">
              {label.length > 6 ? label.slice(0, 3) : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
