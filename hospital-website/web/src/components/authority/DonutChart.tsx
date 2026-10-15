export function DonutChart({
  data,
  labelKey,
  valueKey,
  size = 160,
  inner = 50,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  size?: number;
  inner?: number;
}) {
  const total = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);
  if (total === 0) {
    return (
      <div className="grid place-items-center text-muted" style={{ height: size }}>
        No data
      </div>
    );
  }
  let acc = 0;
  const radius = size / 2;
  const mid = radius;
  const colors = ['var(--sev-critical)', 'var(--sev-serious)', 'var(--sev-moderate)', 'var(--sev-mild)', 'var(--primary)', 'var(--ink)'];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${mid},${mid})`}>
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const start = (acc / total) * Math.PI * 2;
          acc += val;
          const end = (acc / total) * Math.PI * 2;
          const large = end - start > Math.PI ? 1 : 0;
          const x1 = radius * Math.cos(start);
          const y1 = radius * Math.sin(start);
          const x2 = radius * Math.cos(end);
          const y2 = radius * Math.sin(end);
          const path = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
          return <path key={i} d={path} fill={colors[i % colors.length]} opacity={0.85} />;
        })}
        <circle r={inner} fill="var(--surface)" />
      </g>
    </svg>
  );
}
