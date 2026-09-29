import { useCallback, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

const TILT_MAX = 7;
const TILT_LIFT = -4;

export function useHoverFx() {
  const node = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | undefined>(undefined);
  const reduce = useReducedMotion();

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = node.current;
      if (!el || reduce) return;
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = undefined;
        el.style.transform = `perspective(1000px) rotateY(${(px - 0.5) * TILT_MAX * 2}deg) rotateX(${
          (0.5 - py) * TILT_MAX * 2
        }deg) translate3d(0, ${TILT_LIFT}px, 0)`;
      });
    },
    [reduce],
  );

  const onPointerLeave = useCallback(() => {
    const el = node.current;
    if (!el) return;
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.transform = '';
  }, []);

  return { node, onPointerMove, onPointerLeave, reduce };
}
