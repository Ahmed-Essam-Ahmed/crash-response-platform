import { useEffect, useState } from 'react';
import { useMotionValue, useReducedMotion, useSpring } from 'motion/react';

export function AnimatedNumber({
  value,
  format = (n) => String(n),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const motion = useMotionValue(value);
  const spring = useSpring(motion, { stiffness: 90, damping: 18, mass: 0.6 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    motion.set(value);
  }, [value, reduce, motion]);

  useEffect(() => {
    if (reduce) return;
    return spring.on('change', (latest) => setDisplay(Math.round(latest)));
  }, [spring, reduce]);

  return <span className="tnum">{format(display)}</span>;
}
