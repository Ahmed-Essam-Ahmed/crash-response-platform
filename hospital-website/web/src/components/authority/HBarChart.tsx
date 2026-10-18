export function HBarChart({
  data,
  labelKey,
  valueKey,
  secondaryKey,
  secondaryFormat,
  valueFormat,
  color = 'var(--primary)',
  maxRows = 12,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  secondaryKey?: string;
  secondaryFormat?: (v: number) => string;
  valueFormat?: (v: number) => string;
  color?: string;
  maxRows?: number;
}) {
  const rows = data.slice(0, maxRows);
  if (rows.length === 0) return <div className="text-muted">No data</div>;
  const max = Math.max(1, ...rows.map((d) => Number(d[valueKey]) || 0));

  return (
    <ul className="space-y-2">
      {rows.map((d, i) => {
        const value = Number(d[valueKey]) || 0;
        const w = (value / max) * 100;
        return (
          <li key={String(d[labelKey]) + i} className="text-xs">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate" title={String(d[labelKey] ?? '—')}>
                {String(d[labelKey] ?? '—')}
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {valueFormat ? valueFormat(value) : value}
                {secondaryKey && d[secondaryKey] != null ? (
                  <span className="ml-2 text-muted/80">
                    {secondaryFormat ? secondaryFormat(Number(d[secondaryKey])) : String(d[secondaryKey])}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
              <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
