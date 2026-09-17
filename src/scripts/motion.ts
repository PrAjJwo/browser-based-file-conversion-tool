/**
 * PureFile Lightweight Motion & Scroll Reveal Engine
 *
 * Zero external dependencies.
 * Uses native browser IntersectionObserver and respect prefers-reduced-motion.
 * One-shot reveal triggers that never re-trigger or cause scroll-jacking.
 */

export function initMotionSystem(): void {
  if (typeof window === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealElements = document.querySelectorAll<HTMLElement>('.reveal-on-scroll');

  if (revealElements.length === 0) return;

  // Immediately reveal everything if reduced motion is requested
  if (prefersReducedMotion) {
    revealElements.forEach((el) => {
      el.classList.add('is-revealed');
    });
    return;
  }

  // Check elements already visible in viewport or above the fold on initial load
  const windowHeight = window.innerHeight;
  const pendingElements: HTMLElement[] = [];

  revealElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    // If the element's top is already above or well inside the viewport, reveal immediately
    if (rect.top < windowHeight - 40) {
      el.classList.add('is-revealed');
    } else {
      pendingElements.push(el);
    }
  });

  if (pendingElements.length === 0) return;

  // If IntersectionObserver is not supported, fallback to immediate display
  if (!('IntersectionObserver' in window)) {
    pendingElements.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          target.classList.add('is-revealed');
          obs.unobserve(target);
        }
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -30px 0px',
      threshold: 0.08,
    }
  );

  pendingElements.forEach((el) => observer.observe(el));
}

// Auto-run on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initMotionSystem());
  } else {
    initMotionSystem();
  }

  // Handle client-side navigation if present
  document.addEventListener('astro:page-load', () => initMotionSystem());
}
