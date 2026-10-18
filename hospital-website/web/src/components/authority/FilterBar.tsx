import { useMemo } from 'react';
import type { AnalyticsFilters } from '../../api-analytics';

export function FilterBar({
  filters,
  params,
  onChange,
}: {
  filters: AnalyticsFilters | null;
  params: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
}) {
  const selectedRegions = useMemo(
    () => (params.region ? params.region.split(',').filter(Boolean) : []),
    [params.region],
  );
  const regions = filters?.regions ?? [];
  const sevMin = params.severity_min ?? String(filters?.severity_min ?? 0);
  const sevMax = params.severity_max ?? String(filters?.severity_max ?? 10);

  const set = (patch: Record<string, string | undefined>) => {
    const next = { ...params };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') delete next[key];
      else next[key] = value;
    }
    onChange(next);
  };

  const toggleRegion = (region: string) => {
    const has = selectedRegions.includes(region);
    const nextRegions = has ? selectedRegions.filter((r) => r !== region) : [...selectedRegions, region];
    set({ region: nextRegions.join(',') || undefined });
  };

  const activeCount =
    selectedRegions.length +
    (params.severity_min ? 1 : 0) +
    (params.severity_max ? 1 : 0) +
    (params.from ? 1 : 0) +
    (params.to ? 1 : 0);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">Filters</span>
        {activeCount > 0 && (
          <span className="chip rounded-full px-2 py-0.5 text-xs" data-tone="moderate">
            {activeCount} active
          </span>
        )}
        <button
          type="button"
          onClick={() => onChange({})}
          disabled={activeCount === 0}
          className="ml-auto text-xs text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40 disabled:hover:no-underline"
        >
          Reset
        </button>
      </div>

      {regions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {regions.map((region) => {
            const active = selectedRegions.includes(region);
            return (
              <button
                key={region}
                type="button"
                onClick={() => toggleRegion(region)}
                aria-pressed={active}
                className="press rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={
                  active
                    ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                    : { background: 'var(--surface-2)', color: 'var(--muted)' }
                }
              >
                {region}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">
            Severity {Number(sevMin).toFixed(1)} – {Number(sevMax).toFixed(1)}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={sevMin}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), Number(sevMax));
                set({ severity_min: v > 0 ? String(v) : undefined });
              }}
              className="w-full accent-[var(--primary)]"
            />
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={sevMax}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), Number(sevMin));
                set({ severity_max: v < 10 ? String(v) : undefined });
              }}
              className="w-full accent-[var(--primary)]"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">From</span>
          <input
            type="date"
            value={params.from ?? ''}
            onChange={(e) => set({ from: e.target.value })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-[var(--primary)]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">To</span>
          <input
            type="date"
            value={params.to ?? ''}
            onChange={(e) => set({ to: e.target.value })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-[var(--primary)]"
          />
        </label>
      </div>
    </div>
  );
}
