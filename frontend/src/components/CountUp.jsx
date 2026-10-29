import { useEffect, useRef } from "react";

// Counts from 0 up to `end` over `duration` ms when it mounts. The text is written
// straight to the element so the count doesn't re-render the page every frame.
export default function CountUp({ end, duration = 2000, format = String, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = format(end);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2); // gentle ease-out: keeps counting until the end
      el.textContent = format(Math.round(end * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [end, duration, format]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(0)}
    </span>
  );
}
