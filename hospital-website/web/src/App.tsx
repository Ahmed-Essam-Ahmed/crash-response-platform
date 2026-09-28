import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  advanceIncident,
  cancelIncident,
  fetchActive,
  fetchFleet,
  fetchHospitals,
  fetchIncident,
  health,
  reportCrash,
} from './api';
import { useStream } from './lib/useStream';
import { isCritical } from './lib/status';
import { ThemeProvider } from './theme';
import { TopBar } from './components/TopBar';
import { StatRow } from './components/StatRow';
import { IncidentCard } from './components/IncidentCard';
import { MiniMap } from './components/MiniMap';
import { CapacityPanel } from './components/CapacityPanel';
import { DetailSheet } from './components/DetailSheet';
import type { Ambulance, Hospital, Incident, StreamEvent } from './types';

function Console() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          prev.some((i) => i.alert_id === event.incident.alert_id) ? prev : [event.incident, ...prev],
        );
      }
      if (event.type === 'incident_status') {
        setIncidents((prev) =>
          prev.map((i) => (i.alert_id === event.alert_id ? { ...i, status: event.status } : i)),
        );
        setSelected((prev) => (prev?.alert_id === event.alert_id ? { ...prev, status: event.status } : prev));
      }
      if (event.type === 'hospitals_update') setHospitals(event.hospitals);
      if (event.type === 'fleet_update') {
        setAmbulances((prev) => {
          const byId = new Map(event.ambulances.map((a) => [a.ambulance_id, a]));
          return prev.map((a) => byId.get(a.ambulance_id) ?? a);
        });
      }
    },
    [],
  );

  const { connected } = useStream(onEvent);

  const active = useMemo(
    () =>
      [...incidents].sort(
        (a, b) => b.severity - a.severity || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
      ),
    [incidents],
  );

  const hospitalById = useMemo(
    () => new Map(hospitals.map((h) => [h.hospital_id, h])),
    [hospitals],
  );

  const stats = useMemo(
    () => ({
      active: active.length,
      critical: active.filter((i) => isCritical(i.severity)).length,
      ambulancesOut: ambulances.filter((a) => a.status !== 'available').length,
      fleetTotal: ambulances.length,
      bedsFree: hospitals.reduce((sum, h) => sum + h.free_beds, 0),
      bedsTotal: hospitals.reduce((sum, h) => sum + h.capacity, 0),
    }),
    [active, ambulances, hospitals],
  );

  const withBusy = async (alertId: string, run: () => Promise<Incident>) => {
    setBusy(alertId);
    try {
      await run();
      await refresh();
      const fresh = await fetchIncident(alertId).catch(() => null);
      if (fresh && selected?.alert_id === alertId) setSelected(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const openDetails = async (incident: Incident) => {
    setSelected(incident);
    const fresh = await fetchIncident(incident.alert_id).catch(() => null);
    if (fresh) setSelected(fresh);
  };

  const report = async () => {
    setReporting(true);
    try {
      const created = await reportCrash({});
      await refresh();
      setSelected(created);
    } catch {
      setError('Could not report a test crash');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar connected={connected} onReport={report} reporting={reporting} />

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
        {error && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/25">
            {error}
          </div>
        )}

        <StatRow {...stats} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold tracking-tight">
                What needs you now
              </h1>
              <span className="text-xs text-[var(--color-muted)]">
                {stats.active === 0 ? 'All clear' : `${stats.active} open`}
              </span>
            </div>

            {active.length === 0 ? (
              <div className="card shadow-soft grid place-items-center gap-2 px-6 py-16 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                </span>
                <p className="font-medium">No open cases</p>
                <p className="max-w-xs text-sm text-[var(--color-muted)]">
                  New crashes will appear here automatically the moment they are reported.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {active.map((incident) => (
                  <IncidentCard
                    key={incident.alert_id}
                    incident={incident}
                    hospitalName={
                      hospitalById.get(incident.assignment.hospital_id ?? '')?.name ??
                      incident.assignment.hospital_id ??
                      'Choosing a hospital'
                    }
                    busy={busy === incident.alert_id}
                    onAdvance={() => withBusy(incident.alert_id, () => advanceIncident(incident.alert_id))}
                    onCancel={() => withBusy(incident.alert_id, () => cancelIncident(incident.alert_id))}
                    onOpen={() => void openDetails(incident)}
                  />
                ))}
              </div>
            )}

            <MiniMap hospitals={hospitals} ambulances={ambulances} incidents={active} />
          </section>

          <aside className="space-y-4">
            <CapacityPanel hospitals={hospitals} />
          </aside>
        </div>
      </main>

      <DetailSheet
        incident={selected}
        hospitalName={
          hospitalById.get(selected?.assignment.hospital_id ?? '')?.name ?? '—'
        }
        onClose={() => setSelected(null)}
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
