import { gsap } from '../scroll/smooth';

/** Custom cursor (dot + ring) and magnetic buttons. Desktop fine-pointer only. */
export function setupCursor(): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.getElementById('cursor');
  if (!root) return;
  const dot = root.querySelector<HTMLElement>('.cursor__dot')!;
  const ring = root.querySelector<HTMLElement>('.cursor__ring')!;
  document.documentElement.classList.add('has-cursor');

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3.out' });

  let shown = false;
  window.addEventListener('pointermove', (e) => {
    if (!shown) { shown = true; root.classList.add('is-visible'); }
    dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY);
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('is-visible'));
  document.addEventListener('pointerenter', () => { if (shown) root.classList.add('is-visible'); });

  const HOVER = 'a, button, [data-cursor]';
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>(HOVER);
    root.classList.toggle('is-hover', !!t);
  });
  document.addEventListener('pointerdown', () => root.classList.add('is-down'));
  document.addEventListener('pointerup', () => root.classList.remove('is-down'));

  /* magnetic buttons */
  const magnets = Array.from(document.querySelectorAll<HTMLElement>('.btn, .menu-btn, .footer__top'));
  for (const el of magnets) {
    const toX = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
    const toY = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      toX(dx * 0.22); toY(dy * 0.22);
    });
    el.addEventListener('pointerleave', () => { toX(0); toY(0); });
  }
}
