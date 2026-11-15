import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './ui/Spinner';

type Variant = 'primary' | 'signal' | 'soft' | 'ghost' | 'danger' | 'secondary';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  signal: 'btn-signal',
  soft: 'btn-soft',
  ghost: 'btn-ghost',
  secondary: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: '',
  lg: 'min-h-12 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { children, variant = 'primary', size = 'md', loading = false, icon, fullWidth = false, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`btn press ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} /> : icon}
      {children}
    </button>
  );
});
