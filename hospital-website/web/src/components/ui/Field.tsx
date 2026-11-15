import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="field-label">
        {label}
        {required && <span className="text-[var(--signal)]"> *</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-[var(--signal-ink)]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`input ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`input min-h-24 resize-y py-2.5 ${className}`}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={`input appearance-none pr-9 ${className}`} {...rest}>
      {children}
    </select>
  );
});

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  id?: string;
  disabled?: boolean;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <button
      id={fieldId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
        checked ? 'border-transparent bg-[var(--primary)]' : 'border-line surface-3'
      }`}
    >
      <span
        className={`ml-1 size-5 rounded-full bg-surface shadow-[var(--shadow-soft)] transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
