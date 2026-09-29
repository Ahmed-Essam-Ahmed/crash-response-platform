import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../auth';
import { ApiError, geoSearch } from '../api';
import { Button } from './Button';
import { AuroraBackground } from './AuroraBackground';
import type { GeoResult } from '../types';

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-[var(--primary)]';

const labelClass = 'text-2xs font-semibold tracking-[0.08em] text-muted uppercase';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

interface Draft {
  name: string;
  address: string;
  phone: string;
  emergency_phone: string;
  trauma_level: number;
  lat: number | null;
  lon: number | null;
  location_label: string;
  ambulances_total: number;
  ambulances_available: number;
  beds_total: number;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}

const EMPTY: Draft = {
  name: '',
  address: '',
  phone: '',
  emergency_phone: '',
  trauma_level: 1,
  lat: null,
  lon: null,
  location_label: '',
  ambulances_total: 2,
  ambulances_available: 2,
  beds_total: 10,
  admin_name: '',
  admin_email: '',
  admin_password: '',
};

const STEP_LABELS = ['Hospital', 'Location', 'Capacity', 'Account'];

function LocationStep({
  draft,
  update,
}: {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
}) {
  const [query, setQuery] = useState(draft.location_label);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setNotice(null);
    try {
      const found = await geoSearch(query.trim());
      setResults(found.results);
      if (found.results.length === 0) {
        setNotice('No matches. Add the coordinates by hand below.');
      }
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Search is unavailable, add coordinates by hand.');
      setManual(true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
          placeholder="Search for the hospital or its street"
          aria-label="Search for a location"
        />
        <Button type="submit" variant="ghost" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {notice && <p className="text-sm text-muted">{notice}</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-line">
          {results.map((result) => {
            const chosen = draft.lat === result.lat && draft.lon === result.lon;
            return (
              <li key={`${result.lat}-${result.lon}`}>
                <button
                  type="button"
                  onClick={() =>
                    update({ lat: result.lat, lon: result.lon, location_label: result.label })
                  }
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors ${
                    chosen ? 'bg-primary-soft text-primary-ink' : 'hover:bg-surface-2'
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-xs uppercase text-muted">{result.type}</span>
                  <span className="min-w-0">{result.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setManual((v) => !v)}
        className="min-h-10 text-sm font-medium text-primary-ink underline-offset-2 hover:underline"
      >
        {manual ? 'Hide manual coordinates' : 'Enter coordinates by hand'}
      </button>

      {manual && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitude">
            <input
              type="number"
              step="any"
              value={draft.lat ?? ''}
              onChange={(e) => update({ lat: e.target.value === '' ? null : Number(e.target.value) })}
              className={inputClass}
              placeholder="30.0480"
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step="any"
              value={draft.lon ?? ''}
              onChange={(e) => update({ lon: e.target.value === '' ? null : Number(e.target.value) })}
              className={inputClass}
              placeholder="31.2320"
            />
          </Field>
        </div>
      )}

      {draft.lat != null && draft.lon != null && (
        <p data-tone="mild" className="chip rounded-xl px-3.5 py-2.5 text-sm">
          Pinned at {draft.lat.toFixed(4)}, {draft.lon.toFixed(4)}
          {draft.location_label ? ` — ${draft.location_label}` : ''}
        </p>
      )}
    </div>
  );
}

function Register() {
  const { signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const canContinue = () => {
    if (step === 0) return draft.name.trim().length >= 2;
    if (step === 1) return draft.lat != null && draft.lon != null;
    if (step === 2) return draft.beds_total >= 0 && draft.ambulances_available <= draft.ambulances_total;
    return draft.admin_email.includes('@') && draft.admin_password.length >= 8;
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signUp({
        name: draft.name.trim(),
        lat: draft.lat,
        lon: draft.lon,
        address: draft.address.trim() || null,
        phone: draft.phone.trim() || null,
        emergency_phone: draft.emergency_phone.trim() || null,
        trauma_level: draft.trauma_level,
        ambulances_total: draft.ambulances_total,
        ambulances_available: draft.ambulances_available,
        beds_total: draft.beds_total,
        admin: {
          email: draft.admin_email.trim(),
          password: draft.admin_password,
          full_name: draft.admin_name.trim(),
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
      setBusy(false);
    }
  };

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
              <Field label="Hospital name">
                <input
                  value={draft.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className={inputClass}
                  placeholder="Riverside Trauma Centre"
                />
              </Field>
              <Field label="Street address" hint="Optional, shown to crews on the case card.">
                <input
                  value={draft.address}
                  onChange={(e) => update({ address: e.target.value })}
                  className={inputClass}
                  placeholder="12 Corniche El Nil, Cairo"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Main phone">
                  <input
                    value={draft.phone}
                    onChange={(e) => update({ phone: e.target.value })}
                    className={inputClass}
                    placeholder="+20 2 1234 5678"
                  />
                </Field>
                <Field label="Emergency line">
                  <input
                    value={draft.emergency_phone}
                    onChange={(e) => update({ emergency_phone: e.target.value })}
                    className={inputClass}
                    placeholder="+20 2 8765 4321"
                  />
                </Field>
              </div>
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
                      aria-checked={draft.trauma_level === level}
                      onClick={() => update({ trauma_level: level })}
                      className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold transition-colors ${
                        draft.trauma_level === level
                          ? 'border-transparent bg-primary text-primary-fg'
                          : 'border-line text-muted hover:text-ink'
                      }`}
                    >
                      Level {level}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && <LocationStep draft={draft} update={update} />}

          {step === 2 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ambulances owned">
                  <input
                    type="number"
                    min={0}
                    value={draft.ambulances_total}
                    onChange={(e) => update({ ambulances_total: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ambulances ready now">
                  <input
                    type="number"
                    min={0}
                    max={draft.ambulances_total}
                    value={draft.ambulances_available}
                    onChange={(e) => update({ ambulances_available: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Beds" hint="Capacity is how many patients you can hold at once.">
                <input
                  type="number"
                  min={0}
                  value={draft.beds_total}
                  onChange={(e) => update({ beds_total: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <p className="text-sm text-muted">
                A case is only offered to you when you have both a free bed and a ready ambulance.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Your name">
                <input
                  value={draft.admin_name}
                  onChange={(e) => update({ admin_name: e.target.value })}
                  className={inputClass}
                  placeholder="Dr. Nadia Hassan"
                />
              </Field>
              <Field label="Work email">
                <input
                  type="email"
                  value={draft.admin_email}
                  onChange={(e) => update({ admin_email: e.target.value })}
                  className={inputClass}
                  placeholder="you@hospital.org"
                />
              </Field>
              <Field label="Password" hint="At least 8 characters.">
                <input
                  type="password"
                  value={draft.admin_password}
                  onChange={(e) => update({ admin_password: e.target.value })}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </Field>
              <p className="text-sm text-muted">
                You will be the hospital admin, and can add dispatchers and viewers afterwards.
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
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue()}>
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
  const [mode, setMode] = useState<'signin' | 'register'>('signin');

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
            <p className="text-sm text-muted">Hospital sign in</p>
          </div>
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Sign in or register">
            {(['signin', 'register'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                aria-pressed={mode === key}
                className={`min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
                  mode === key ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
                }`}
              >
                {key === 'signin' ? 'Sign in' : 'Register a hospital'}
              </button>
            ))}
          </div>

          {mode === 'signin' ? <SignIn /> : <Register />}
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Cases arrive from the road-safety app and are offered to the nearest hospital with capacity.
        </p>
      </motion.div>
    </div>
  );
}
