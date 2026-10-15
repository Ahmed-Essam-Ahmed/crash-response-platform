import { useEffect, useState } from 'react';
import { fetchFilters, fetchSummary, type AnalyticsFilters, type AnalyticsSummary } from '../../api-analytics';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { HeatMap } from './HeatMap';

export function AuthorityDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilters | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFilters()
      .then(setFilters)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSummary(params)
      .then((s) => {
        setSummary(s);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  const t = summary?.totals;
  return (
    <div className="min-h-dvh space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">National Road Safety — Authority Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted">Managing all of Egypt's incidents and hotspots</p>
        </div>
        {error && (
          <div className="chip rounded-xl px-4 py-2 text-sm font-medium" data-tone="moderate">
            {error}
          </div>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: 'Incidents', value: t?.incidents ?? 0 },
          { label: 'Avg severity', value: (t?.avg_severity ?? 0).toFixed(1) },
          { label: 'Severe (≥8)', value: t?.severe ?? 0 },
          { label: 'Critical (≥7)', value: t?.critical ?? 0 },
          { label: 'Unclaimed', value: t?.unclaimed ?? 0 },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Red Zones — Accident Hotspots</h3>
          <p className="mb-3 text-xs text-muted">red = severity ≥ 7 · numbers = incidents per cell</p>
          <HeatMap hotspots={summary?.hotspots ?? []} />
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Incidents by Hour</h3>
          <BarChart data={summary?.by_hour ?? []} xKey="hour" yKey="count" height={220} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Severity Distribution</h3>
          <DonutChart data={summary?.severity_distribution ?? []} labelKey="bucket" valueKey="count" size={180} />
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">By Sex</h3>
          <DonutChart data={summary?.demographics.by_sex ?? []} labelKey="sex" valueKey="count" size={180} />
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Destination</h3>
          <DonutChart data={summary?.destination_distribution ?? []} labelKey="key" valueKey="count" size={180} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">By Region</h3>
          <div className="space-y-2">
            {(summary?.by_region ?? []).slice(0, 12).map((r) => (
              <div key={r.region} className="flex items-center justify-between text-sm">
                <span>{r.region}</span>
                <span className="text-muted">{r.count} • avg {r.avg_severity}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Top Hospitals</h3>
          <div className="space-y-2">
            {(summary?.by_hospital ?? []).slice(0, 12).map((h) => (
              <div key={h.hospital_code + h.hospital_name} className="flex items-center justify-between text-sm">
                <span className="truncate">{h.hospital_name}</span>
                <span className="text-muted">{h.count} • avg {h.avg_severity}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
