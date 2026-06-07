'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number changing from its previous value to the new value.
 * - Counts up or down smoothly over `duration` milliseconds
 * - Shows a "+" prefix for positive numbers
 * - Renders inside the parent's color/font styling
 *
 * Usage: <AnimatedScore value={42} className="..." />
 */
export default function AnimatedScore({
  value,
  duration = 800,
  className,
  style,
  prefix = true, // show + for positive
}) {
  const [display, setDisplay] = useState(value ?? 0);
  const prevRef = useRef(value ?? 0);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value ?? 0;
    if (start === end) {
      setDisplay(end);
      return;
    }

    const startTime = performance.now();
    const diff = end - start;

    function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic for a satisfying decel
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const sign = prefix && display > 0 ? '+' : '';
  return (
    <span className={className} style={style}>
      {sign}{display}
    </span>
  );
}