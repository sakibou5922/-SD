import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export type Smooth = {
  lenis: Lenis | null;
  scrollTo(target: string | number, opts?: { immediate?: boolean }): void;
  stop(): void;
  start(): void;
};

export function createSmoothScroll(enabled: boolean): Smooth {
  const headerOffset = () => -parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || -64;

  if (!enabled) {
    return {
      lenis: null,
      scrollTo(target, opts) {
        const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : null;
        const top = typeof target === 'number' ? target : el ? el.getBoundingClientRect().top + window.scrollY + headerOffset() : 0;
        window.scrollTo({ top, behavior: opts?.immediate ? 'auto' : 'smooth' });
      },
      stop() {},
      start() {},
    };
  }

  const lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: false,
    anchors: false,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  // pins change the document height; keep Lenis' scroll limit in sync with ScrollTrigger
  ScrollTrigger.addEventListener('refresh', () => lenis.resize());

  return {
    lenis,
    scrollTo(target, opts) {
      // Lenis clamps targets to a cached limit that is refreshed asynchronously (ResizeObserver);
      // recompute it synchronously so a jump right after layout changes (hash landing) is exact.
      lenis.resize();
      lenis.scrollTo(target, {
        offset: headerOffset(),
        duration: 1.2,
        easing: (t: number) => 1 - Math.pow(2, -10 * t),
        immediate: !!opts?.immediate,
      });
    },
    stop: () => lenis.stop(),
    start: () => lenis.start(),
  };
}

export { gsap, ScrollTrigger };
