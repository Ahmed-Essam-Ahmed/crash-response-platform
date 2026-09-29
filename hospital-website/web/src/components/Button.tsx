import { motion, useReducedMotion } from 'motion/react';
import type { ComponentProps, ReactNode } from 'react';

type Props = Omit<ComponentProps<typeof motion.button>, 'children' | 'className'> & {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
};

export function Button({ children, variant = 'primary', className = '', ...rest }: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      {...rest}
      whileTap={reduce || rest.disabled ? undefined : { scale: 0.97 }}
      className={`press btn ${
        variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-ghost'
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}
