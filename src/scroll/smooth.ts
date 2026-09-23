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

  return {
    lenis,
    scrollTo(target, opts) {
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
