import { useCallback, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

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
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = undefined;
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
      });
    },
    [reduce],
  );

  const onPointerLeave = useCallback(() => {
    const el = node.current;
    if (!el) return;
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
  }, []);

  return { node, onPointerMove, onPointerLeave, reduce };
}
