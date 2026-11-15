import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  fetchPlatformRegistry,
  getPlatformKey,
  reviewHospitalClaim,
  setPlatformKey,
  type PlatformRegistry,
} from '../api';
import { AppShell } from './AppShell';
import { Alert } from './ui/Alert';
import { Badge } from './ui/Badge';
import { Button } from './Button';
import { Card, CardHeader } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Field, Input } from './ui/Field';
import { Icon } from './ui/Icon';
import { Spinner } from './ui/Spinner';
import { StatCard } from './ui/StatCard';
import {
  Building2,
  CheckCircle2,
  Clock3,
  KeyRound,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from '../theme';

const EMPTY: PlatformRegistry = { generated_at: '', hospitals: [], pending_claims: [] };

function ageLabel(iso: string | null) {
  if (!iso) return 'Just now';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return minutes < 1 ? 'Just now' : `${minutes}m ago`;
}

function AccessGate({ onAccess }: { onAccess: (key: string) => void }) {
  const theme = useTheme();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fetchPlatformRegistry(key);
      onAccess(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the registry console');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh">
      <div className="aurora">
        <div className="aurora-blob aurora-1" aria-hidden />
        <div className="aurora-blob aurora-2" aria-hidden />
        <div className="aurora-blob aurora-3" aria-hidden />
      </div>

      <div className="relative z-10 grid min-h-dvh place-items-center p-6">
        <form onSubmit={submit} className="card w-full max-w-md p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-fg shadow-soft">
                <Icon icon={ShieldCheck} size={22} />
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">Rescue+ / Registry admin</p>
                <h1 className="font-display text-2xl font-semibold tracking-tight">Hospital registry</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => theme.toggle()}
              className="btn btn-ghost grid size-10 place-items-center rounded-xl"
              aria-label="Toggle theme"
            >
              <Icon icon={theme.mode === 'dark' ? Moon : Sun} size={18} />
            </button>
          </div>

          <p className="mb-6 text-sm text-muted">
            Review hospital claims and manage which facilities are on the platform.
          </p>

          <Field label="Platform review key" required>
            <Input
              id="platform-key"
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter secure review key"
              required
            />
          </Field>

          {error && (
            <div className="mt-4">
              <Alert tone="signal">{error}</Alert>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} className="mt-6">
            {busy ? 'Verifying access…' : 'Enter registry'}
          </Button>

          <div className="mt-6 flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--success)] shadow-[0_0_8px_var(--success)]" aria-hidden />
            Hospital onboarding channel
            <span className="ml-auto">Admin console</span>
          </div>
        </form>
      </div>
    </main>
  );
}

export function PlatformAdmin({ initialKey = '', onExit }: { initialKey?: string; onExit?: () => void }) {
  const [key, setKey] = useState(initialKey || getPlatformKey());
  const [data, setData] = useState<PlatformRegistry>(EMPTY);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [working, setWorking] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (!key) return;
    if (showLoading) setLoading(true);
    try {
      setData(await fetchPlatformRegistry(key));
      setConnected(true);
      setError('');
    } catch (err) {
      setConnected(false);
      if (err instanceof ApiError && err.status === 401) {
        setPlatformKey('');
        setKey('');
      }
      setError(err instanceof Error ? err.message : 'Registry feed unavailable');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (key) {
      setPlatformKey(key);
      void refresh(true);
    }
  }, [key, refresh]);

  useEffect(() => {
    if (!key) return;
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [key, refresh]);

  const stats = useMemo(() => {
    const claimed = data.hospitals.filter((hospital) => hospital.claimed !== false);
    return {
      pending: data.pending_claims.length,
      hospitals: data.hospitals.length,
      levelThree: claimed.filter((hospital) => hospital.trauma_level === 3).length,
      verified: claimed.length,
    };
  }, [data]);

  const filteredHospitals = data.hospitals.filter((hospital) =>
    `${hospital.name} ${hospital.address ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );

  const decideClaim = async (id: number, decision: 'approve' | 'reject') => {
    setWorking(id);
    try {
      await reviewHospitalClaim(key, id, decision);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review claim');
    } finally {
      setWorking(null);
    }
  };

  if (!key) {
    return (
      <AccessGate
        onAccess={(value) => {
          setPlatformKey(value);
          setKey(value);
        }}
      />
    );
  }

  return (
    <AppShell
      title="Platform admin"
      role={'staff' as any}
      userName="Platform Admin"
      maxWidth="wide"
      onSignOut={() => {
        setPlatformKey('');
        setKey('');
        onExit?.();
      }}
      onOpenAccount={() => {}}
      actions={
        <div className="flex items-center gap-2">
          <span
            className={`chip hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sm:inline-flex ${
              connected ? '' : 'opacity-70'
            }`}
            data-tone={connected ? 'mild' : 'moderate'}
          >
            <span
              className={`size-2 shrink-0 rounded-full bg-current ${connected ? '' : 'animate-pulse'}`}
              aria-hidden
            />
            {connected ? 'Registry live' : 'Reconnecting'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void refresh(true)} disabled={loading}>
            {loading ? <Spinner size={16} /> : <Icon icon={RefreshCw} size={16} />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">
            Hospital onboarding · Egypt
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Registry console</h1>
          <p className="mt-1 text-sm text-muted">
            Approve or reject hospital claims, and keep an eye on who is registered.
          </p>
        </div>

        {error && (
          <Alert tone="signal">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => void refresh(true)}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Registry statistics">
          <StatCard
            label="Registry queue"
            value={String(stats.pending).padStart(2, '0')}
            sub={stats.pending ? 'Review required' : 'All clear'}
            icon={Clock3}
          />
          <StatCard
            label="Hospitals"
            value={String(stats.hospitals).padStart(2, '0')}
            sub={`${stats.verified} verified`}
            icon={Building2}
          />
          <StatCard
            label="Level III trauma"
            value={String(stats.levelThree).padStart(2, '0')}
            sub="Highest acuity"
            icon={ShieldCheck}
          />
          <StatCard
            label="Verified"
            value={String(stats.verified).padStart(2, '0')}
            sub="Linked to a claim"
            icon={CheckCircle2}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Pending claims"
              subtitle="Onboarding queue"
              action={
                <span className="chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium" data-tone="mild">
                  <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden />
                  Live
                </span>
              }
            />
            <div className="max-h-[clamp(390px,48vh,590px)] overflow-y-auto px-4 pb-4">
              {data.pending_claims.length ? (
                data.pending_claims.map((claim) => (
                  <article key={claim.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 mb-3 last:mb-0">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge tone="warning">New request</Badge>
                      <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">{ageLabel(claim.created_at)}</span>
                    </div>
                    <p className="font-semibold">{claim.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {claim.governorate} Governorate · {claim.lat?.toFixed(4) ?? '—'}, {claim.lon?.toFixed(4) ?? '—'}
                    </p>
                    <p className="mt-2 text-2xs font-semibold uppercase tracking-[0.04em] text-muted">
                      Requested by <b className="text-ink">{claim.claimed_by_name}</b> ·{' '}
                      <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${encodeURIComponent(claim.claimed_by_email)}`}>
                        {claim.claimed_by_email}
                      </a>
                    </p>
                    {claim.address && (
                      <p className="mt-1 text-2xs font-semibold uppercase tracking-[0.04em] text-muted">Address · {claim.address}</p>
                    )}
                    {claim.phone && (
                      <p className="mt-1 text-2xs font-semibold uppercase tracking-[0.04em] text-muted">Phone · {claim.phone}</p>
                    )}
                    {claim.evidence && (
                      <p className="mt-2 border-l-2 border-[var(--warning)] bg-[var(--surface-3)] px-3 py-2 text-xs italic text-muted">
                        “{claim.evidence}”
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={working === claim.id}
                        onClick={() => void decideClaim(claim.id, 'approve')}
                        icon={<Icon icon={CheckCircle2} size={14} />}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={working === claim.id}
                        onClick={() => void decideClaim(claim.id, 'reject')}
                        icon={<Icon icon={X} size={14} />}
                      >
                        Reject
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Registry queue clear"
                  description="New hospital requests will appear here."
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Registered hospitals"
              subtitle="Read-only roster"
              action={
                <div className="relative">
                  <Input
                    ref={searchRef}
                    aria-label="Search registered hospitals"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search hospitals…"
                    className="min-w-40"
                  />
                </div>
              }
            />
            <div className="max-h-[clamp(390px,48vh,590px)] overflow-y-auto px-4 pb-4">
              {filteredHospitals.length ? (
                filteredHospitals.map((hospital) => (
                  <div key={hospital.id} className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                        hospital.claimed === false ? 'bg-surface-3 text-muted' : 'bg-primary-soft text-primary'
                      }`}
                    >
                      <Icon icon={Building2} size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{hospital.name}</p>
                      <p className="truncate text-2xs uppercase tracking-[0.04em] text-muted">
                        {hospital.claimed === false
                          ? `${(hospital as { governorate?: string }).governorate ?? ''} · Registry entry`
                          : `${hospital.address || 'Location confirmed'} · ${
                              hospital.trauma_level === 3 ? 'Level III trauma' : `Trauma level ${hospital.trauma_level}`
                            }`}
                      </p>
                      <p className="truncate text-2xs uppercase tracking-[0.04em] text-muted">
                        {hospital.claimed === false
                          ? 'Not yet claimed'
                          : `${hospital.registry_id ? `Registry ${hospital.registry_id}` : 'Legacy record'} · ${hospital.staff_count} staff`}
                      </p>
                    </div>
                    {hospital.claimed === false ? (
                      <Badge tone="neutral" className="shrink-0">Unclaimed</Badge>
                    ) : (
                      <span className="size-1.5 shrink-0 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success)]" aria-hidden />
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Building2}
                  title="No hospitals found"
                  description={query ? 'Nothing matches that search.' : 'Approved hospitals will appear here.'}
                />
              )}
            </div>
          </Card>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
          <span>
            Rescue+ <b className="text-ink">v3.0</b>
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`size-1.5 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`}
              aria-hidden
            />
            {connected ? 'Registry connected' : 'Reconnecting'}
          </span>
          <span>Egypt national emergency grid</span>
        </footer>
      </div>
    </AppShell>
  );
}
