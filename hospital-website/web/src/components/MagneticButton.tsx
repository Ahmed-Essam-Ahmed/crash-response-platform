import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useRef } from 'react';
import type { ComponentProps, PointerEvent, ReactNode } from 'react';

const MAX_PULL = 9;

type Props = Omit<
  ComponentProps<typeof motion.button>,
  | 'children'
  | 'className'
  | 'style'
  | 'onPointerMove'
  | 'onPointerLeave'
  | 'whileHover'
  | 'whileTap'
> & {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  strength?: number;
  className?: string;
  onPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function MagneticButton({
  children,
  variant = 'primary',
  strength = 0.32,
  className = '',
  onPointerMove,
  onPointerLeave,
  ...rest
}: Props) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });
  const anchor = useRef<{ cx: number; cy: number } | null>(null);
  const surface = useRef<HTMLButtonElement | null>(null);

  const pull = (clientX: number, clientY: number) => {
    if (reduce || !anchor.current) return;
    const clamp = (v: number) => Math.max(-MAX_PULL, Math.min(MAX_PULL, v));
    x.set(clamp((clientX - anchor.current.cx) * strength));
    y.set(clamp((clientY - anchor.current.cy) * strength));
  };

  const measure = () => {
    const el = surface.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    anchor.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  return (
    <span
      className="magnetic"
      onPointerEnter={(event) => {
        measure();
        pull(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        pull(event.clientX, event.clientY);
        onPointerMove?.(event as unknown as PointerEvent<HTMLButtonElement>);
      }}
      onPointerLeave={(event) => {
        anchor.current = null;
        x.set(0);
        y.set(0);
        onPointerLeave?.(event as unknown as PointerEvent<HTMLButtonElement>);
      }}
    >
      <motion.button
        {...rest}
        ref={surface}
        style={{ x: springX, y: springY }}
        whileHover={reduce ? undefined : { scale: 1.04 }}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        className={`sheen-host btn ${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} ${
          variant === 'primary' ? 'fx fx-border' : ''
        } ${className}`}
      >
        <span className="sheen" aria-hidden />
        {children}
      </motion.button>
    </span>
  );
}
