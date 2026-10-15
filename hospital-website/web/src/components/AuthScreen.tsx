import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../auth';
import {
  ApiError,
  fetchPlatformOverview,
  getPlatformKey,
  geoSearch,
  previewInvitation,
  searchRegistry,
  submitClaim,
  setPlatformKey as storePlatformKey,
  type RegistryEntry,
} from '../api';
import { Button } from './Button';
import { AuroraBackground } from './AuroraBackground';
import type { GeoResult } from '../types';

const PlatformAdmin = lazy(() => import('./PlatformAdmin').then((module) => ({ default: module.PlatformAdmin })));

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-[var(--primary)]';

const labelClass = 'text-2xs font-semibold tracking-[0.08em] text-muted uppercase';

const DEMO_SIGN_IN = {
  email: 'riverside@demo.hospital',
  password: 'hospital123',
};

const DEMO_PLATFORM_KEY = import.meta.env.VITE_PLATFORM_ADMIN_KEY ?? '';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(DEMO_SIGN_IN.email);
  const [password, setPassword] = useState(DEMO_SIGN_IN.password);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Work email">
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@hospital.org"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••"
        />
      </Field>

      {error && (
        <p role="alert" data-tone="critical" className="chip rounded-xl px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

function PlatformSignIn({ onAccess }: { onAccess: (key: string) => void }) {
  const [key, setKey] = useState(DEMO_PLATFORM_KEY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fetchPlatformOverview(key.trim());
      storePlatformKey(key.trim());
      onAccess(key.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the platform console');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">Full-network access for the Crash Response Platform administrator.</p>
      <Field label="Platform admin key" hint="Use the key configured for the response service.">
        <input
          type="password"
          autoComplete="current-password"
          required
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className={inputClass}
          placeholder="Enter platform admin key"
        />
      </Field>
      {error && (
        <p role="alert" data-tone="critical" className="chip rounded-xl px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !key.trim()} className="w-full">
        {busy ? 'Connecting…' : 'Open national operations'}
      </Button>
    </form>
  );
}

function inviteTokenFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)$/);
  return match ? match[1] : null;
}

function AcceptInvite({ token }: { token: string }) {
  const { acceptInvitation } = useAuth();
  const [details, setDetails] = useState<{
    hospital: string;
    role: string;
    email: string;
  } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    previewInvitation(token)
      .then((found) => {
        if (live) setDetails(found);
      })
      .catch((err) => {
        if (live) setError(err instanceof ApiError ? err.message : 'This invitation is not valid');
      });
    return () => {
      live = false;
    };
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await acceptInvitation(token, password, name.trim() || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set up your account');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Join your hospital</h2>
        {details ? (
          <p className="mt-1 text-sm text-muted">
            {details.hospital} invited you as a {details.role}. The account will use{' '}
            <span className="font-medium text-ink">{details.email}</span>.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Checking this invitation…</p>
        )}
      </div>

      {details && (
        <>
          <Field label="Your name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Dr. Nadia Hassan"
            />
          </Field>
          <Field label="Choose a password" hint="At least 8 characters. Nobody else can see this.">
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>
        </>
      )}

      {error && (
        <p role="alert" data-tone="critical" className="chip rounded-xl px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!details || busy || password.length < 8} className="w-full">
        {busy ? 'Setting up…' : 'Join hospital'}
      </Button>
    </form>
  );
}

function RegistryPicker({ onPick }: { onPick: (entry: RegistryEntry) => void }) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [governorate, setGovernorate] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let live = true;
    searchRegistry({ limit: 25 })
      .then((found) => {
        if (!live) return;
        setEntries(found.results);
        setGovernorates(found.governorates);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    const handle = setTimeout(() => {
      searchRegistry({ q: query, governorate: governorate || undefined, limit: 25 })
        .then((found) => {
          if (!live) return;
          setEntries(found.results);
          setSearched(true);
        })
        .catch(() => undefined)
        .finally(() => {
          if (live) setSearching(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(handle);
    };
  }, [query, governorate]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => {
          setSearching(true);
          setQuery(e.target.value);
        }}
        className={inputClass}
        placeholder="Search for your hospital"
        aria-label="Search for your hospital"
      />

      {governorates.length > 0 && (
        <select
          value={governorate}
          onChange={(e) => setGovernorate(e.target.value)}
          className={inputClass}
          aria-label="Filter by governorate"
        >
          <option value="">All governorates</option>
          {governorates.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}

      {entries.length > 0 ? (
        <ul className="max-h-72 divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-line">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onPick(entry)}
                disabled={entry.claimed}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 enabled:hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{entry.name}</span>
                  <span className="block text-xs text-muted">
                    {entry.governorate}
                    {entry.name_ar ? ` · ${entry.name_ar}` : ''}
                  </span>
                </span>
                {entry.claimed && (
                  <span className="shrink-0 text-2xs font-semibold tracking-wide text-muted uppercase">
                    Already registered
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {searched || searching
            ? 'No hospital matches that search. You can request it below.'
            : 'Loading the hospital list…'}
        </p>
      )}
    </div>
  );
}

function ClaimForm() {
  const [name, setName] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [evidence, setEvidence] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    searchRegistry({ limit: 1 })
      .then((found) => setGovernorates(found.governorates))
      .catch(() => undefined);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!point) {
      setError('Pick the hospital location so we can check it is not already listed.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const found = await submitClaim({
        name: name.trim(),
        governorate,
        lat: point.lat,
        lon: point.lon,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        claimed_by_name: contact.trim(),
        email: email.trim(),
        evidence: evidence.trim() || undefined,
      });
      setResult(found.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that request');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-3">
        <p data-tone="mild" className="chip rounded-xl px-3.5 py-2.5 text-sm">
          {result}
        </p>
        <Button type="button" variant="ghost" onClick={() => window.location.assign('/')} className="w-full">
        Back to sign in
      </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Hospital name">
        <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
      </Field>

      <Field label="Governorate">
        <select
          value={governorate}
          onChange={(e) => setGovernorate(e.target.value)}
          required
          className={inputClass}
        >
          <option value="">Choose a governorate</option>
          {governorates.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Find the location" hint="Used only to check it is not already in the list.">
        <input
          value={point ? point.label : ''}
          readOnly
          placeholder="Search below"
          className={inputClass}
        />
      </Field>
      <LocationSearch onPick={setPoint} />

      <Field label="Street address">
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hospital phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Your name">
          <input value={contact} onChange={(e) => setContact(e.target.value)} required className={inputClass} />
        </Field>
      </div>

      <Field label="Your work email" hint="We contact this address when the review finishes.">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
      </Field>

      <Field label="Anything that proves this is your hospital" hint="Optional, but it speeds up review.">
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Ministry registration number, health insurance code…"
        />
      </Field>

      {error && (
        <p role="alert" data-tone="critical" className="chip rounded-xl px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || !point} className="w-full">
        {busy ? 'Sending…' : 'Request this hospital'}
      </Button>
    </form>
  );
}

function LocationSearch({
  onPick,
}: {
  onPick: (point: { lat: number; lon: number; label: string }) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setResults((await geoSearch(query.trim())).results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
          placeholder="Hospital or street"
          aria-label="Search for a location"
        />
        <Button type="submit" variant="ghost" disabled={searching}>
          {searching ? '…' : 'Search'}
        </Button>
      </form>
      {results.length > 0 && (
        <ul className="max-h-48 divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-line">
          {results.map((result) => (
            <li key={`${result.lat}-${result.lon}`}>
              <button
                type="button"
                onClick={() =>
                  onPick({ lat: result.lat, lon: result.lon, label: result.label ?? query })
                }
                className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STEP_LABELS = ['Hospital', 'Capacity', 'Account'];

function Register() {
  const { joinHospital } = useAuth();
  const [step, setStep] = useState(0);
  const [entry, setEntry] = useState<RegistryEntry | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [phone, setPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [traumaLevel, setTraumaLevel] = useState(1);
  const [ambulances, setAmbulances] = useState(2);
  const [beds, setBeds] = useState(10);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsLocation = entry !== null && !entry.has_location;

  const canContinue = () => {
    if (step === 0) return entry !== null;
    if (step === 1) return !needsLocation || (point !== null);
    return email.includes('@') && password.length >= 8;
  };

  const submit = async () => {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      await joinHospital({
        registry_id: entry.id,
        trauma_level: traumaLevel,
        ambulances_total: ambulances,
        beds_total: beds,
        phone: phone.trim() || undefined,
        emergency_phone: emergencyPhone.trim() || undefined,
        lat: point?.lat,
        lon: point?.lon,
        admin: { email: email.trim(), password, full_name: name.trim() },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account');
      setBusy(false);
    }
  };

  if (claiming) return <ClaimForm />;
  if (!entry) {
    return (
      <div className="space-y-4">
        <RegistryPicker onPick={setEntry} />
        <button
          type="button"
          onClick={() => setClaiming(true)}
          className="min-h-10 w-full text-sm font-medium text-primary-ink underline-offset-2 hover:underline"
        >
          My hospital is not listed
        </button>
        {error && (
          <p role="alert" data-tone="critical" className="chip rounded-xl px-3.5 py-2.5 text-sm">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-1.5">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className="h-1 rounded-full transition-colors"
              style={{ backgroundColor: i <= step ? 'var(--primary)' : 'var(--line)' }}
            />
            <span className={`text-2xs font-medium ${i <= step ? 'text-ink' : 'text-muted'}`}>{label}</span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <div className="chip rounded-xl px-3.5 py-2.5 text-sm">
                <span className="block font-medium">{entry.name}</span>
                <span className="text-xs text-muted">{entry.governorate}</span>
              </div>
              {needsLocation ? (
                <>
                  <p className="text-sm text-muted">
                    We do not have a confirmed location for this hospital yet, so we need one from
                    you. Pick the right point, because ambulances route to it.
                  </p>
                  <LocationSearch onPick={(p) => setPoint({ lat: p.lat, lon: p.lon })} />
                  {point && (
                    <p className="text-sm text-muted">
                      Pinned at {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">
                  Location is already confirmed for this hospital, so you do not need to enter it.
                </p>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div role="radiogroup" aria-labelledby="trauma-label">
                <p id="trauma-label" className={labelClass}>
                  Trauma level
                </p>
                <p className="mt-1 text-xs text-muted">
                  Only level 3 hospitals are offered the most severe crashes.
                </p>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={traumaLevel === level}
                      onClick={() => setTraumaLevel(level)}
                      className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold transition-colors ${
                        traumaLevel === level
                          ? 'border-transparent bg-primary text-primary-fg'
                          : 'border-line text-muted hover:text-ink'
                      }`}
                    >
                      Level {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ambulances owned">
                  <input
                    type="number"
                    min={0}
                    value={ambulances}
                    onChange={(e) => setAmbulances(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Beds">
                  <input
                    type="number"
                    min={0}
                    value={beds}
                    onChange={(e) => setBeds(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Main phone">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="+20 2 1234 5678"
                  />
                </Field>
                <Field label="Emergency line">
                  <input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className={inputClass}
                    placeholder="+20 2 8765 4321"
                  />
                </Field>
              </div>

              <p className="text-sm text-muted">
                A case is only offered to you when you have both a free bed and a ready ambulance.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Your name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Dr. Nadia Hassan"
                />
              </Field>
              <Field label="Work email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@hospital.org"
                />
              </Field>
              <Field label="Password" hint="At least 8 characters.">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </Field>
              <p className="text-sm text-muted">
                You will be the hospital admin, and can invite dispatchers and viewers afterwards.
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p role="alert" data-tone="critical" className="chip rounded-xl px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (step === 0 ? setEntry(null) : setStep((s) => Math.max(0, s - 1)))}
          disabled={busy}
        >
          Back
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue()}
          >
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={!canContinue() || busy}>
            {busy ? 'Creating…' : 'Create hospital account'}
          </Button>
        )}
      </div>
    </div>
  );
}

export function AuthScreen() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'signin' | 'register' | 'platform'>('signin');
  const [platformKey, setPlatformKey] = useState(() => getPlatformKey());
  const inviteToken = inviteTokenFromUrl();

  if (platformKey) {
    return <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted">Opening national operations…</div>}>
      <PlatformAdmin initialKey={platformKey} onExit={() => { setPlatformKey(''); setMode('signin'); }} />
    </Suspense>;
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <AuroraBackground />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[0.875rem] bg-primary text-base font-bold text-primary-fg shadow-soft">
            R+
          </span>
          <div className="leading-tight">
            <h1 className="text-lg font-semibold tracking-tight">Response Hub</h1>
            <p className="text-sm text-muted">Hospital and platform access</p>
          </div>
        </div>

        {inviteToken ? (
          <AcceptInvite token={inviteToken} />
        ) : (
          <div className="card p-5 sm:p-6">
            <div
              className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1"
              role="group"
              aria-label="Choose account type"
            >
              {(['signin', 'register', 'platform'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  aria-pressed={mode === key}
                  className={`min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
                    mode === key ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
                  }`}
                >
                  {key === 'signin' ? 'Hospital sign in' : key === 'register' ? 'Register hospital' : 'Platform admin'}
                </button>
              ))}
            </div>

            {mode === 'signin' ? <SignIn /> : mode === 'register' ? <Register /> : <PlatformSignIn onAccess={setPlatformKey} />}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          Cases arrive from the road-safety app and are offered to the nearest hospital with capacity.
        </p>
      </motion.div>
    </div>
  );
}
