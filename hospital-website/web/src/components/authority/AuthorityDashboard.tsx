import { useEffect, useState } from 'react';
import { fetchFilters, fetchSummary, type AnalyticsFilters, type AnalyticsSummary } from '../../api-analytics';
import { useAuth } from '../../auth';
import { AuroraBackground } from '../AuroraBackground';
import { TopBar } from '../TopBar';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { FilterBar } from './FilterBar';
import { Gauge } from './Gauge';
import { HBarChart } from './HBarChart';
import { RedZoneMap } from './RedZoneMap';
import { LineChart } from './LineChart';
import { ScatterChart } from './ScatterChart';
import { Icons, Panel, StatCard } from './DashboardUI';
import { duration } from './chart';

export function AuthorityDashboard() {
  const { session, signOut } = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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
        setUpdatedAt(new Date());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  const t = summary?.totals;
  const rt = summary?.response_times;

  const kpis = [
    { label: 'Incidents', value: t?.incidents ?? 0, icon: Icons.incident, tone: 'mild' as const },
    { label: 'Avg severity', value: (t?.avg_severity ?? 0).toFixed(1), icon: Icons.severity, tone: 'moderate' as const },
    { label: 'Severe (≥8)', value: t?.severe ?? 0, icon: Icons.severe, tone: 'serious' as const },
    { label: 'Critical (≥7)', value: t?.critical ?? 0, icon: Icons.critical, tone: 'critical' as const },
    { label: 'Unclaimed', value: t?.unclaimed ?? 0, icon: Icons.unclaimed, tone: 'moderate' as const },
    { label: 'Avg response', value: duration(t?.avg_response_seconds ?? 0), icon: Icons.response, tone: 'mild' as const },
    { label: 'Hospitals active', value: t?.hospitals_active ?? 0, icon: Icons.hospital, tone: 'mild' as const },
    { label: 'Regions active', value: t?.regions_active ?? 0, icon: Icons.region, tone: 'mild' as const },
  ];

  return (
    <div className="min-h-dvh">
      <AuroraBackground />
      {session && (
        <TopBar
          hospital={null}
          user={session.user}
          connected={!error}
          onStaff={() => undefined}
          onSignOut={() => void signOut()}
        />
      )}

      <main className="relative mx-auto max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" data-tone="critical">
              <span className="size-1.5 rounded-full bg-current" />
              National overview · all of Egypt
            </span>
            <h1 className="mt-3 text-[length:var(--text-2xl)] font-semibold tracking-tight">
              Road Safety Authority Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted">
              Red zones, demographics, response times and hospital performance across the country.
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            {loading ? (
              <span>Updating…</span>
            ) : updatedAt ? (
              <span className="tnum">Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ) : null}
            {error && <p className="mt-1 text-[var(--sev-critical)]">{error}</p>}
          </div>
        </div>

        <FilterBar filters={filters} params={params} onChange={setParams} />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {kpis.map((k, i) => (
            <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} delay={i * 0.03} />
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Red Zones — Accident Hotspots" hint="color = peak severity · size and number = incidents">
            <RedZoneMap hotspots={summary?.hotspots ?? []} />
          </Panel>
          <Panel title="Incident Trend" hint="incidents per day">
            <LineChart
              data={summary?.trend ?? []}
              xKey="date"
              lines={[{ key: 'count', color: 'var(--primary)', label: 'Incidents' }]}
            />
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Incidents by Hour" hint="0–23h, national">
            <BarChart
              data={summary?.by_hour ?? []}
              xKey="hour"
              yKey="count"
              formatLabel={(d) => String(d.hour).padStart(2, '0')}
            />
          </Panel>
          <Panel title="Incidents by Weekday">
            <BarChart data={summary?.by_weekday ?? []} xKey="day" yKey="count" />
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Incidents per Year" hint="annual caseload">
            <LineChart
              data={summary?.by_year ?? []}
              xKey="year"
              xFormat={(v) => v}
              lines={[{ key: 'count', color: 'var(--primary)', label: 'Incidents' }]}
            />
          </Panel>
          <Panel title="Age vs Incidents" hint="each point is an age · number of incidents at that age">
            <ScatterChart data={summary?.by_age ?? []} xKey="age" yKey="count" color="var(--sev-serious)" />
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <Panel title="Severity Distribution" hint="severity buckets" delay={0}>
            <DonutChart data={summary?.severity_distribution ?? []} labelKey="bucket" valueKey="count" centerLabel="cases" />
          </Panel>
          <Panel title="Demographics — Sex" delay={0.05}>
            <DonutChart data={summary?.demographics?.by_sex ?? []} labelKey="sex" valueKey="count" centerLabel="patients" />
          </Panel>
          <Panel title="Demographics — Age Group" delay={0.1}>
            <BarChart data={summary?.demographics?.by_age_group ?? []} xKey="group" yKey="count" color="var(--sev-mild)" />
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Destination" hint="where casualties were taken">
            <DonutChart data={summary?.destination_distribution ?? []} labelKey="key" valueKey="count" centerLabel="cases" />
          </Panel>
          <Panel title="Incident Status" hint="current lifecycle stage">
            <DonutChart data={summary?.status_distribution ?? []} labelKey="key" valueKey="count" centerLabel="cases" />
          </Panel>
        </section>

        <Panel title="Response Times" hint={`total time from report to hand-over · ${rt?.count ?? 0} completed cases`}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="grid grid-cols-3 gap-2">
              <Gauge value={rt?.avg_total_seconds ?? 0} max={1800} label="Average" caption="target 30 min" />
              <Gauge value={rt?.p50 ?? 0} max={1800} label="Median (p50)" tone="var(--primary)" />
              <Gauge value={rt?.p90 ?? 0} max={1800} label="90th percentile" />
            </div>
            <div className="self-center">
              <BarChart data={rt?.buckets ?? []} xKey="label" yKey="count" height={180} color="var(--sev-serious)" />
            </div>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-xs font-medium text-muted">Average time per stage</p>
            <HBarChart
              data={[
                { stage: 'Accept', seconds: rt?.avg_accept_seconds ?? 0 },
                { stage: 'Scene travel', seconds: rt?.avg_scene_travel_seconds ?? 0 },
                { stage: 'Hospital travel', seconds: rt?.avg_hospital_travel_seconds ?? 0 },
                { stage: 'Total', seconds: rt?.avg_total_seconds ?? 0 },
              ]}
              labelKey="stage"
              valueKey="seconds"
              valueFormat={duration}
              color="var(--sev-moderate)"
              maxRows={4}
            />
          </div>
        </Panel>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Incidents by Region" hint="top governorates · caseload and avg severity">
            <HBarChart
              data={summary?.by_region ?? []}
              labelKey="region"
              valueKey="count"
              secondaryKey="avg_severity"
              secondaryFormat={(v) => `avg ${v}`}
            />
          </Panel>
          <Panel title="Top Hospitals" hint="caseload · average total response">
            <HBarChart
              data={summary?.by_hospital ?? []}
              labelKey="hospital_name"
              valueKey="count"
              secondaryKey="avg_response_seconds"
              secondaryFormat={duration}
              color="var(--sev-serious)"
            />
          </Panel>
        </section>
      </main>
    </div>
  );
}
