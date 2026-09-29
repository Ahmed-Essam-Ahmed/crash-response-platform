import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import { ApiError, addStaff, fetchStaff, removeStaff } from '../api';
import { clock } from '../lib/format';
import type { Role, User } from '../types';

const ROLE_HELP: Record<Role, string> = {
  admin: 'Full control, including the team and capacity',
  dispatcher: 'Accept cases and move them along',
  viewer: 'Read-only, can follow cases',
};

export function StaffSheet({
  open,
  canManage,
  onClose,
}: {
  open: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('dispatcher');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStaff(await fetchStaff());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your team');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    void load();
    setError(null);
    setNotice(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      restore.current?.focus();
    };
  }, [open, onClose, load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await addStaff({ email, password, full_name: fullName || undefined, role });
      setFullName('');
      setEmail('');
      setPassword('');
      setNotice(`${email} can now sign in.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this person');
    } finally {
      setBusy(false);
    }
  };

  const drop = async (user: User) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await removeStaff(user.user_id);
      setNotice(`${user.email} no longer has access.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this person');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-[oklch(0.15_0.02_264/0.35)] backdrop-blur-sm"
          />

          <motion.aside
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Team access"
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.18 } }
                : { x: '100%', transition: { type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] } }
            }
            transition={{ type: 'spring', stiffness: 320, damping: 36, mass: 0.9 }}
            className="relative flex h-full w-full max-w-[28rem] flex-col border-l border-line bg-surface/95 shadow-lift backdrop-blur-2xl outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line p-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Team access</h2>
                <p className="text-sm text-muted">
                  {canManage
                    ? 'Who at your hospital can use this console.'
                    : 'Only hospital admins can change this.'}
                </p>
              </div>
              <motion.button
                whileTap={reduce ? undefined : { scale: 0.92 }}
                onClick={onClose}
                aria-label="Close team access"
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </motion.button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-line">
                {staff.map((user) => (
                  <li key={user.user_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user.full_name || user.email}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                      <p className="mt-0.5 text-2xs text-muted">
                        {user.role}
                        {user.last_login_at ? ` · last seen ${clock(user.last_login_at)}` : ' · never signed in'}
                      </p>
                    </div>
                    {canManage && (
                      <Button variant="ghost" disabled={busy} onClick={() => void drop(user)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {canManage && (
                <form onSubmit={add} className="space-y-3">
                  <h3 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                    Add a colleague
                  </h3>
                  <label className="block">
                    <span className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                      Name
                    </span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Optional"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                      Work email
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colleague@hospital.org"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                      Temporary password
                    </span>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Access level">
                    {(['viewer', 'dispatcher', 'admin'] as Role[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={role === key}
                        onClick={() => setRole(key)}
                        className={`min-h-11 rounded-xl border text-sm font-semibold capitalize transition-colors ${
                          role === key
                            ? 'border-transparent bg-primary text-primary-fg'
                            : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted">{ROLE_HELP[role]}</p>
                  <Button type="submit" disabled={busy} className="w-full">
                    {busy ? 'Working…' : 'Give access'}
                  </Button>
                </form>
              )}

              {error && (
                <p role="alert" data-tone="critical" className="chip rounded-xl px-3.5 py-2.5 text-sm">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" data-tone="mild" className="chip rounded-xl px-3.5 py-2.5 text-sm">
                  {notice}
                </p>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
