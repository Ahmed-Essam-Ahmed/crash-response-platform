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
import { Icons, Panel, StatCard } from './DashboardUI';
import { duration } from './chart';
import { AuthorityLiveMap } from './AuthorityLiveMap';
import { Tabs } from '../ui/Tabs';

type View = 'analytics' | 'live';

const REFRESH_MS = 15_000;
const FILTERS_REFRESH_MS = 60_000;
const HIDDEN_PARAMS = new Set(['view']);

function initialParams() {
  const search = new URLSearchParams(window.location.search);
  return Object.fromEntries(Array.from(search.entries()).filter(([key]) => !HIDDEN_PARAMS.has(key)));
}

function initialView(search = window.location.search): View {
  return new URLSearchParams(search).get('view') === 'live' ? 'live' : 'analytics';
}

function syncUrl(params: Record<string, string>, view: View) {
  const query = new URLSearchParams(params);
  if (view === 'live') query.set('view', 'live');
  const next = query.toString();
  const url = `${window.location.pathname}${next ? `?${next}` : ''}`;
  window.history.replaceState(null, '', url);
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse p-4">
      <div className="h-7 w-24 rounded bg-[var(--surface-2)]" />
      <div className="mt-3 h-6 w-16 rounded bg-[var(--surface-2)]" />
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-5" aria-label="Loading national analytics">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card h-[430px] animate-pulse bg-[var(--surface-2)]" />
        <div className="card h-[430px] animate-pulse bg-[var(--surface-2)]" />
      </section>
    </div>
  );
}

function MethodologyPanel() {
  return (
    <Panel title="How to read this dashboard" hint="scope, method and known limits">
      <div className="grid gap-4 text-sm text-muted md:grid-cols-2">
        <div className="space-y-2">
          <p>
            <strong className="text-ink">Synthetic operational data.</strong> The live feed and
            the historical caseload are generated for demonstration. They are shaped to match
            Egyptian governorates and road corridors, not real patients.
          </p>
          <p>
            <strong className="text-ink">Red zones are descriptive.</strong> The map uses a
            severity-weighted kernel density estimate to show where recorded crashes cluster.
            It does not estimate risk for places that were never reported.
          </p>
        </div>
        <div className="space-y-2">
          <p>
            <strong className="text-ink">Response time</strong> is report-to-handover for cases
            that reached a hospital. Cases cancelled before assignment are excluded.
          </p>
          <p>
            <strong className="text-ink">National coverage</strong> counts governorates with
            recorded incidents, not every road or every hospital in Egypt. Registry entries
            without a claimed hospital account are excluded from operational counts.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function AuthorityDashboard() {
  const { session, signOut } = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>(initialParams);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [view, setView] = useState<View>(() => initialView());

  const changeView = (next: View) => {
    setView(next);
    syncUrl(params, next);
  };

  const changeParams = (next: Record<string, string>) => {
    setParams(next);
    syncUrl(next, view);
  };

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchFilters()
        .then((value) => {
          if (!cancelled) setFilters(value);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    };
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, FILTERS_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let first = true;

    const load = () => {
      fetchSummary(params)
        .then((value) => {
          if (cancelled) return;
          setSummary(value);
          setError(null);
          setUpdatedAt(new Date());
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (cancelled) return;
          if (first) setLoading(false);
          first = false;
        });
    };

    setLoading(true);
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [params]);

  const t = summary?.totals;
  const rt = summary?.response_times;
  const noRows = summary !== null && (t?.incidents ?? 0) === 0;

  const kpis = [
    { label: 'Incidents', value: t?.incidents ?? 0, icon: Icons.incident, tone: 'mild' as const },
    { label: 'Avg severity', value: (t?.avg_severity ?? 0).toFixed(1), icon: Icons.severity, tone: 'moderate' as const },
    { label: 'Severe (≥8)', value: t?.severe ?? 0, icon: Icons.severe, tone: 'serious' as const },
    { label: 'Unassigned', value: t?.unclaimed ?? 0, icon: Icons.unclaimed, tone: 'moderate' as const },
    { label: 'Avg response', value: duration(t?.avg_response_seconds ?? 0), icon: Icons.response, tone: 'mild' as const },
    { label: 'Hospitals reporting', value: t?.hospitals_active ?? 0, icon: Icons.hospital, tone: 'mild' as const },
    { label: 'Governorates', value: t?.regions_active ?? 0, icon: Icons.region, tone: 'mild' as const },
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
              {view === 'analytics'
                ? 'Where crashes cluster, who is affected, and how the response is performing.'
                : 'Operating hospitals, active cases and ambulances, updated live.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right text-xs text-muted">
            <Tabs<View>
              items={[
                { key: 'analytics', label: 'Analytics' },
                { key: 'live', label: 'Live map' },
              ]}
              value={view}
              onChange={changeView}
            />
            {view === 'analytics' ? (
              <>
                {loading ? (
                  <span>Updating…</span>
                ) : updatedAt ? (
                  <span className="tnum">
                    Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                ) : null}
                {error && <p className="mt-1 max-w-xs text-[var(--sev-critical)]">{error}</p>}
              </>
            ) : null}
          </div>
        </div>

        {view === 'live' ? (
          <AuthorityLiveMap />
        ) : (
          <>
            <FilterBar filters={filters} params={params} onChange={changeParams} />

            {loading && !summary ? (
              <LoadingDashboard />
            ) : error && !summary ? (
              <div className="card space-y-3 p-6 text-sm">
                <p className="font-semibold text-ink">National analytics could not be loaded.</p>
                <p className="text-muted">{error}</p>
                <button
                  type="button"
                  onClick={() => changeParams({ ...params })}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  {kpis.map((k, i) => (
                    <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} delay={i * 0.03} />
                  ))}
                </section>

                {noRows && (
                  <div className="card p-5 text-sm text-muted">
                    No incidents match these filters. Clear a filter or widen the date range.
                  </div>
                )}

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
                  <Panel title="Incidents by Hour" hint="0–23h, local time">
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

                <section className="grid gap-5 lg:grid-cols-3">
                  <Panel title="Severity Distribution" hint="recorded incident severity">
                    <DonutChart data={summary?.severity_distribution ?? []} labelKey="bucket" valueKey="count" centerLabel="cases" />
                  </Panel>
                  <Panel title="Casualties by Sex" delay={0.05}>
                    <DonutChart data={summary?.demographics?.by_sex ?? []} labelKey="sex" valueKey="count" centerLabel="patients" />
                  </Panel>
                  <Panel title="Casualties by Age Group" delay={0.1}>
                    <BarChart data={summary?.demographics?.by_age_group ?? []} xKey="group" yKey="count" color="var(--sev-mild)" />
                  </Panel>
                </section>

                <Panel title="Response Times" hint={`report to hand-over · ${rt?.count ?? 0} completed cases`}>
                  <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                    <div className="grid grid-cols-3 gap-2">
                      <Gauge value={rt?.avg_total_seconds ?? 0} max={1800} label="Average" caption="target 30 min" />
                      <Gauge value={rt?.p50 ?? 0} max={1800} label="Median (p50)" tone="var(--primary)" />
                      <Gauge value={rt?.p90 ?? 0} max={1800} label="90th percentile" />
                    </div>
                    <div className="self-center">
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
                  </div>
                </Panel>

                <section className="grid gap-5 lg:grid-cols-2">
                  <Panel title="Destination" hint="where casualties were taken">
                    <DonutChart data={summary?.destination_distribution ?? []} labelKey="key" valueKey="count" centerLabel="cases" />
                  </Panel>
                  <Panel title="Incidents by Governorate" hint="caseload and average severity">
                    <HBarChart
                      data={summary?.by_region ?? []}
                      labelKey="region"
                      valueKey="count"
                      secondaryKey="avg_severity"
                      secondaryFormat={(v) => `avg ${v}`}
                    />
                  </Panel>
                </section>

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

                <MethodologyPanel />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
