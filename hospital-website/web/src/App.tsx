import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  advanceIncident,
  cancelIncident,
  fetchActive,
  fetchFleet,
  fetchHospitals,
  fetchIncident,
  reportCrash,
} from './api';
import { useStream } from './lib/useStream';
import { withViewTransition } from './lib/viewTransition';
import { AuroraBackground } from './components/AuroraBackground';
import { ThemeProvider } from './theme';
import { TopBar } from './components/TopBar';
import { StatRow } from './components/StatRow';
import { IncidentCard } from './components/IncidentCard';
import { MiniMap } from './components/MiniMap';
import { CapacityPanel } from './components/CapacityPanel';
import { DetailSheet } from './components/DetailSheet';
import { Toaster } from './components/Toaster';
import type { Toast } from './components/Toaster';
import type { Ambulance, Hospital, Incident, StreamEvent } from './types';

type Filter = 'all' | 'critical' | 'inbound';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'inbound', label: 'Arriving' },
];

const INBOUND = new Set(['en_route_to_hospital', 'at_hospital']);

function Console() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const reduce = useReducedMotion();

  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextIncidents, nextHospitals, nextFleet] = await Promise.all([
        fetchActive(),
        fetchHospitals(),
        fetchFleet(),
      ]);
      setIncidents(nextIncidents);
      setHospitals(nextHospitals);
      setAmbulances(nextFleet);
      setReady(true);
      setError(null);
    } catch {
      setError('Cannot reach the response service. Retrying…');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const onEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'incident_detected') {
        setIncidents((prev) =>
          prev.some((i) => i.alert_id === event.incident.alert_id)
            ? prev
            : [event.incident, ...prev],
        );
        notify(
          `New ${event.incident.severity >= 8 ? 'critical' : 'open'} case reported`,
          event.incident.severity >= 8 ? 'critical' : 'moderate',
        );
      }
      if (event.type === 'incident_status') {
        setIncidents((prev) =>
          prev.map((i) => (i.alert_id === event.alert_id ? { ...i, status: event.status } : i)),
        );
        setSelected((prev) =>
          prev?.alert_id === event.alert_id ? { ...prev, status: event.status } : prev,
        );
      }
      if (event.type === 'hospitals_update') setHospitals(event.hospitals);
      if (event.type === 'fleet_update') {
        setAmbulances((prev) => {
          const byId = new Map(event.ambulances.map((a) => [a.ambulance_id, a]));
          return prev.map((a) => byId.get(a.ambulance_id) ?? a);
        });
      }
    },
    [notify],
  );

  const { connected } = useStream(onEvent);

  const hospitalById = useMemo(
    () => new Map(hospitals.map((h) => [h.hospital_id, h])),
    [hospitals],
  );

  const visible = useMemo(() => {
    const sorted = [...incidents].sort(
      (a, b) => b.severity - a.severity || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
    );
    if (filter === 'critical') return sorted.filter((i) => i.severity >= 8);
    if (filter === 'inbound') return sorted.filter((i) => INBOUND.has(i.status));
    return sorted;
  }, [incidents, filter]);

  const stats = useMemo(
    () => ({
      active: incidents.length,
      critical: incidents.filter((i) => i.severity >= 8).length,
      ambulancesOut: ambulances.filter((a) => a.status !== 'available').length,
      fleetTotal: ambulances.length,
      bedsFree: hospitals.reduce((sum, h) => sum + h.free_beds, 0),
      bedsTotal: hospitals.reduce((sum, h) => sum + h.capacity, 0),
    }),
    [incidents, ambulances, hospitals],
  );

  const run = async (alertId: string, work: () => Promise<Incident>, success: string) => {
    setBusy(alertId);
    try {
      await work();
      await refresh();
      notify(success);
      if (selected?.alert_id === alertId) {
        const fresh = await fetchIncident(alertId).catch(() => null);
        if (fresh) setSelected(fresh);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That action could not be completed', 'critical');
    } finally {
      setBusy(null);
    }
  };

  const openDetails = async (incident: Incident) => {
    setSelected(incident);
    const fresh = await fetchIncident(incident.alert_id).catch(() => null);
    if (fresh) setSelected((current) => (current?.alert_id === fresh.alert_id ? fresh : current));
  };

  const report = async () => {
    setReporting(true);
    try {
      const created = await reportCrash({});
      await refresh();
      setSelected(created);
      notify('Test crash reported');
    } catch {
      notify('Could not report a test crash', 'critical');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <AuroraBackground />
      <a
        href="#cases"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-fg"
      >
        Skip to open cases
      </a>

      <TopBar
        connected={connected}
        onReport={report}
        reporting={reporting}
        criticalCount={stats.critical}
      />

      <main className="mx-auto max-w-[100rem] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-tone="moderate"
              role="alert"
              className="chip rounded-xl px-4 py-3 text-sm font-medium"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <StatRow {...stats} loading={!ready} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-6">
          <section id="cases" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">What needs you now</h1>
                <p className="mt-0.5 text-sm text-muted" aria-live="polite">
                  {ready
                    ? stats.active === 0
                      ? 'All clear'
                      : `${stats.active} open ${stats.active === 1 ? 'case' : 'cases'}`
                    : 'Loading the board'}
                </p>
              </div>

              <div
                className="surface-2 flex items-center gap-1 rounded-xl p-1"
                role="tablist"
                aria-label="Filter open cases"
              >
                {FILTERS.map((option) => {
                  const active = filter === option.key;
                  return (
                    <button
                      key={option.key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => withViewTransition(() => setFilter(option.key))}
                      className={`relative min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors ${
                        active ? 'text-ink' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="filter-pill"
                          transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                          className="absolute inset-0 rounded-lg bg-surface shadow-soft"
                        />
                      )}
                      <span className="relative">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!ready ? (
              <div className="space-y-4">
                {[0, 1].map((i) => (
                  <div key={i} className="card space-y-4 p-5">
                    <div className="skeleton h-5 w-24 rounded-full" />
                    <div className="skeleton h-5 w-2/3 rounded-lg" />
                    <div className="skeleton h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card grid place-items-center gap-3 px-6 py-16 text-center"
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--sev-mild)_14%,var(--surface))] text-[var(--sev-mild)]">
                  <motion.svg
                    viewBox="0 0 24 24"
                    className="size-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
                  >
                    <path d="m5 13 4 4L19 7" />
                  </motion.svg>
                </span>
                <p className="font-medium">
                  {incidents.length === 0 ? 'No open cases' : 'Nothing matches this filter'}
                </p>
                <p className="max-w-xs text-sm text-muted">
                  {incidents.length === 0
                    ? 'New crashes will appear here automatically the moment they are reported.'
                    : 'Try a different filter to see the rest of the board.'}
                </p>
              </motion.div>
            ) : (
              <motion.div layout className="space-y-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {visible.map((incident) => (
                    <IncidentCard
                      key={incident.alert_id}
                      incident={incident}
                      hospitalName={
                        hospitalById.get(incident.assignment.hospital_id ?? '')?.name ??
                        incident.assignment.hospital_id ??
                        'Choosing a hospital'
                      }
                      busy={busy === incident.alert_id}
                      onAdvance={() =>
                        void run(
                          incident.alert_id,
                          () => advanceIncident(incident.alert_id),
                          'Case moved forward',
                        )
                      }
                      onCancel={() =>
                        void run(
                          incident.alert_id,
                          () => cancelIncident(incident.alert_id),
                          'Call cancelled',
                        )
                      }
                      onOpen={() => void openDetails(incident)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            <MiniMap hospitals={hospitals} ambulances={ambulances} incidents={incidents} />
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CapacityPanel hospitals={hospitals} loading={!ready} />
          </aside>
        </div>
      </main>

      <DetailSheet
        incident={selected}
        hospitalName={hospitalById.get(selected?.assignment.hospital_id ?? '')?.name ?? '—'}
        onClose={() => setSelected(null)}
      />

      <Toaster
        toasts={toasts}
        dismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Console />
    </ThemeProvider>
  );
}
