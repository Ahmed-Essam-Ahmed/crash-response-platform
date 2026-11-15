import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-[var(--primary)]';

export function AdminPasswordDialog({
  title,
  onSubmit,
  onCancel,
}: {
  title: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const [password, setPassword] = useState('');
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onCancel}
        className="absolute inset-0 bg-[oklch(0.15_0.02_264/0.45)] backdrop-blur-sm"
      />
      <motion.form
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={(event) => {
          event.preventDefault();
          if (password) onSubmit(password);
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm with hospital admin password"
        className="card relative w-full max-w-sm space-y-4 p-5"
      >
        <div>
          <h2 className="text-base font-semibold tracking-tight">Confirm this change</h2>
          <p className="mt-1 text-sm text-muted">
            {title} Enter your hospital admin password to continue. It is asked again for every change.
          </p>
        </div>
        <label className="block">
          <span className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
            Hospital admin password
          </span>
          <input
            ref={input}
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`mt-1.5 ${inputClass}`}
            placeholder="••••••••"
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!password}>
            Confirm
          </Button>
        </div>
      </motion.form>
    </div>
  );
}

export function AdminPasswordGate({
  open,
  title,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && <AdminPasswordDialog title={title} onSubmit={onSubmit} onCancel={onCancel} />}
    </AnimatePresence>
  );
}
