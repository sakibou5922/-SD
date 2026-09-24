import { gsap, ScrollTrigger } from '../scroll/smooth';

/** Split a heading's text into per-character spans wrapped for a mask reveal. */
export function splitChars(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const line of Array.from(el.querySelectorAll<HTMLElement>('.line > span'))) {
    const text = line.textContent ?? '';
    line.textContent = '';
    for (const ch of Array.from(text)) {
      const wrap = document.createElement('span');
      wrap.className = 'char';
      const inner = document.createElement('span');
      inner.textContent = ch === ' ' ? ' ' : ch;
      wrap.appendChild(inner);
      line.appendChild(wrap);
      out.push(inner);
    }
  }
  el.setAttribute('aria-label', Array.from(el.querySelectorAll('.line')).map((l) => l.textContent).join(''));
  return out;
}

/** The last headline line carries a text gradient; make it continuous across the split characters. */
export function layoutTitleGradient(el: HTMLElement): void {
  const line = el.querySelector<HTMLElement>('.line:last-child');
  if (!line) return;
  const chars = Array.from(line.querySelectorAll<HTMLElement>('.char > span'));
  const w = line.getBoundingClientRect().width || 1;
  for (const c of chars) {
    const wrap = c.parentElement as HTMLElement;
    c.style.setProperty('--gw', `${w}px`);
    c.style.setProperty('--gx', `${-wrap.offsetLeft}px`);
  }
}

/** Reading-progress bar in the header. */
export function setupProgress(): void {
  const bar = document.getElementById('progress');
  if (!bar) return;
  gsap.set(bar, { scaleX: 0 });
  gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 } });
}

/** Large faint section numerals with a slow parallax. */
export function setupSectionNumerals(reduced: boolean): void {
  for (const num of Array.from(document.querySelectorAll<HTMLElement>('.section-num'))) {
    if (reduced) continue;
    const sec = num.closest('section')!;
    gsap.fromTo(num, { yPercent: 18 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
  }
}

/** 3D tilt + sheen on the works cards (fine pointer only). */
export function setupTilt(): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  for (const card of Array.from(document.querySelectorAll<HTMLElement>('.work'))) {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      rx((0.5 - py) * 10); ry((px - 0.5) * 12);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}

/** Loader: counts to 100 while assets settle, then lifts away. Resolves when the page is revealed. */
export function runPreloader(reduced: boolean): Promise<void> {
  const el = document.getElementById('preloader');
  if (!el) return Promise.resolve();
  const fill = document.getElementById('preloader-fill')!;
  const count = document.getElementById('preloader-count')!;
  document.documentElement.classList.add('is-loading');

  const ready = Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    new Promise<void>((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', () => r(), { once: true }))),
  ]);

  let seen = false;
  try { seen = sessionStorage.getItem('sd-loaded') === '1'; sessionStorage.setItem('sd-loaded', '1'); } catch { /* private mode */ }

  if (reduced || seen) {
    return ready.then(() => {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      window.setTimeout(() => { el.remove(); document.documentElement.classList.remove('is-loading'); }, 320);
    });
  }

  const state = { p: 0 };
  const minTime = new Promise<void>((r) => window.setTimeout(r, 650));
  const counter = gsap.to(state, {
    p: 92, duration: 0.9, ease: 'power2.out',
    onUpdate: () => { count.textContent = String(Math.round(state.p)).padStart(3, '0'); fill.style.transform = `scaleX(${state.p / 100})`; },
  });

  return Promise.all([ready, minTime]).then(() => new Promise<void>((resolve) => {
    counter.kill();
    const tl = gsap.timeline();
    tl.to(state, {
      p: 100, duration: 0.2, ease: 'power2.inOut',
      onUpdate: () => { count.textContent = String(Math.round(state.p)).padStart(3, '0'); fill.style.transform = `scaleX(${state.p / 100})`; },
    });
    tl.to(el.querySelector('.preloader__inner'), { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in' }, '+=0.05');
    tl.to(el, { yPercent: -100, duration: 0.7, ease: 'power4.inOut', onStart: () => { document.documentElement.classList.remove('is-loading'); resolve(); } }, '-=0.1');
    tl.call(() => el.remove());
  }));
}

export { ScrollTrigger };
