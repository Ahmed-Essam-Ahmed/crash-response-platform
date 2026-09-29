import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ApiError,
  acceptCase,
  advanceCase,
  cancelCase,
  declineCase,
  fetchCase,
  fetchCases,
  fetchFleet,
  patchBeds,
  patchFleet,
} from '../api';
import { useAuth } from '../auth';
import { useStream } from '../lib/useStream';
import { withViewTransition } from '../lib/viewTransition';
import { AuroraBackground } from './AuroraBackground';
import { TopBar } from './TopBar';
import { StatRow } from './StatRow';
import { IncidentCard } from './IncidentCard';
import { OfferCard } from './OfferCard';
import { LiveMap } from './LiveMap';
import { ResourcePanel } from './ResourcePanel';
import { StaffSheet } from './StaffSheet';
import { DetailSheet } from './DetailSheet';
import { Toaster } from './Toaster';
import type { Toast } from './Toaster';
import type { Ambulance, CasesResponse, Hospital, Incident, StreamEvent } from '../types';

type Filter = 'all' | 'critical' | 'inbound';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'inbound', label: 'Arriving' },
];

const INBOUND = new Set(['en_route_to_hospital', 'at_hospital']);
const EMPTY_CASES: CasesResponse = { assigned: [], recent: [], offers: [] };

export function Console() {
  const { session, signOut, updateHospital } = useAuth();
  const [data, setData] = useState<CasesResponse>(EMPTY_CASES);
  const [fleet, setFleet] = useState<{ hospital: Hospital; ambulances: Ambulance[] } | null>(null);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [staffOpen, setStaffOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const pending = useRef<number | undefined>(undefined);
  const reduce = useReducedMotion();

  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextCases, nextFleet] = await Promise.all([fetchCases(), fetchFleet()]);
      setData(nextCases);
      setFleet(nextFleet);
      updateHospital(nextFleet.hospital);
      setReady(true);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError('Cannot reach the response service. Retrying…');
    }
  }, [updateHospital]);

  const scheduleRefresh = useCallback(() => {
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => void refresh(), 400);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const onEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'case_offered') {
        notify('A new case is being offered to your hospital', 'moderate');
      }
      if (event.type === 'case_escalated') {
        notify('That case is now open to every hospital', 'moderate');
      }
      scheduleRefresh();
    },
    [notify, scheduleRefresh],
  );

  const { connected } = useStream(onEvent);

  useEffect(
    () => () => {
      if (pending.current) window.clearTimeout(pending.current);
    },
    [],
  );

  const { assigned, offers, recent } = data;

  const visible = useMemo(() => {
    const sorted = [...assigned].sort(
      (a, b) => b.severity - a.severity || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
    );
    if (filter === 'critical') return sorted.filter((i) => i.severity >= 8);
    if (filter === 'inbound') return sorted.filter((i) => INBOUND.has(i.status));
    return sorted;
  }, [assigned, filter]);

  const stats = useMemo(
    () => ({
      offers: offers.length,
      active: assigned.length,
      critical: assigned.filter((i) => i.severity >= 8).length,
      ambulancesAvailable: fleet?.hospital.ambulances_available ?? 0,
      ambulancesTotal: fleet?.hospital.ambulances_total ?? 0,
      bedsFree: fleet?.hospital.free_beds ?? 0,
      bedsTotal: fleet?.hospital.beds_total ?? 0,
    }),
    [offers, assigned, fleet],
  );

  const user = session?.user;
  const canAct = user ? user.role !== 'viewer' : false;
  const canManage = user ? user.role === 'admin' : false;

  const fail = (err: unknown) =>
    notify(err instanceof Error ? err.message : 'That action could not be completed', 'critical');

  const run = async (alertId: string, work: () => Promise<unknown>, success: string) => {
    setBusy(alertId);
    try {
      await work();
      await refresh();
      notify(success);
      if (selected?.alert_id === alertId) {
        const fresh = await fetchCase(alertId).catch(() => null);
        if (fresh) setSelected(fresh);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const openDetails = async (alertId: string) => {
    const cached =
      offers.find((o) => o.alert_id === alertId)?.incident ??
      assigned.find((i) => i.alert_id === alertId) ??
      recent.find((i) => i.alert_id === alertId) ??
      null;
    setSelected(cached);
    const fresh = await fetchCase(alertId).catch(() => null);
    if (fresh) setSelected((current) => (current?.alert_id === fresh.alert_id ? fresh : current));
  };

  const closeDetails = useCallback(() => setSelected(null), []);
  const closeStaff = useCallback(() => setStaffOpen(false), []);

  const saveCapacity = async (body: { beds_total?: number; ambulances_total?: number }) => {
    setBusy('capacity');
    try {
      if (body.ambulances_total != null) setFleet(await patchFleet({ ambulances_total: body.ambulances_total }));
      if (body.beds_total != null) updateHospital(await patchBeds({ beds_total: body.beds_total }));
      await refresh();
      notify('Capacity updated');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-dvh">
      <AuroraBackground />
      <a
        href="#cases"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-fg"
      >
        Skip to your cases
      </a>

      <TopBar
        hospital={session.hospital}
        user={session.user}
        connected={connected}
        onStaff={() => setStaffOpen(true)}
        onSignOut={() => void signOut()}
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

        {offers.length > 0 && (
          <section aria-labelledby="offers-heading" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="offers-heading" className="text-lg font-semibold tracking-tight">
                Waiting on you
              </h2>
              <p className="text-sm text-muted">
                Take the first one you can reach, the others move on to the next hospital.
              </p>
            </div>
            <motion.div layout className="space-y-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {offers.map((offer) => (
                  <OfferCard
                    key={offer.offer_id}
                    offer={offer}
                    busy={busy === offer.alert_id}
                    canAct={canAct}
                    onAccept={() =>
                      void run(offer.alert_id, () => acceptCase(offer.alert_id), 'This case is yours')
                    }
                    onDecline={() =>
                      void run(offer.alert_id, () => declineCase(offer.alert_id), 'Passed to the next hospital')
                    }
                    onOpen={() => void openDetails(offer.alert_id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
            {!canAct && (
              <p className="text-sm text-muted">
                Your account can follow cases but not accept them. Ask an admin for dispatcher access.
              </p>
            )}
          </section>
        )}

        <StatRow {...stats} loading={!ready} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-6">
          <section id="cases" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Cases in your care</h1>
                <p className="mt-0.5 text-sm text-muted" aria-live="polite">
                  {ready
                    ? stats.active === 0
                      ? 'All clear, nothing open right now'
                      : `${stats.active} open ${stats.active === 1 ? 'case' : 'cases'}`
                    : 'Loading your board'}
                </p>
              </div>

              <div
                className="surface-2 flex items-center gap-1 rounded-xl p-1"
                role="tablist"
                aria-label="Filter your cases"
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
                  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                </span>
                <p className="font-medium">
                  {assigned.length === 0 ? 'No open cases' : 'Nothing matches this filter'}
                </p>
                <p className="max-w-xs text-sm text-muted">
                  {assigned.length === 0
                    ? 'When a crash is offered to your hospital it will show up here.'
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
                      busy={busy === incident.alert_id}
                      canAct={canAct}
                      onAdvance={() =>
                        void run(incident.alert_id, () => advanceCase(incident.alert_id), 'Case moved forward')
                      }
                      onCancel={() => void run(incident.alert_id, () => cancelCase(incident.alert_id), 'Case cancelled')}
                      onOpen={() => void openDetails(incident.alert_id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {recent.length > 0 && (
              <details className="card group px-5 py-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold tracking-tight">
                  Recently finished ({recent.length})
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <ul className="mt-3 divide-y divide-[var(--line)]">
                  {recent.slice(0, 8).map((incident) => (
                    <li key={incident.alert_id}>
                      <button
                        type="button"
                        onClick={() => void openDetails(incident.alert_id)}
                        className="flex w-full min-h-11 items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-primary-ink"
                      >
                        <span className="min-w-0 truncate">{incident.patient?.name ?? incident.alert_id}</span>
                        <span className="shrink-0 text-xs text-muted capitalize">
                          {incident.status.replace(/_/g, ' ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {fleet && (
              <LiveMap
                hospital={fleet.hospital}
                ambulances={fleet.ambulances}
                incidents={[...offers.map((o) => o.incident), ...assigned]}
                focus={mapFocus}
                onFocusCase={(alertId) => setMapFocus(alertId)}
              />
            )}
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            {fleet && (
              <ResourcePanel
                hospital={fleet.hospital}
                ambulances={fleet.ambulances}
                busy={busy === 'capacity'}
                canManage={canManage}
                onSave={saveCapacity}
              />
            )}
          </aside>
        </div>
      </main>

      <DetailSheet incident={selected} onClose={closeDetails} />
      <StaffSheet open={staffOpen} canManage={canManage} onClose={closeStaff} />

      <Toaster
        toasts={toasts}
        dismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
