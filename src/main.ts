import './styles/index.css';
import { gsap, ScrollTrigger, createSmoothScroll } from './scroll/smooth';
import { setupReveals, buildRevealTimeline } from './scroll/reveal';
import { setupSections } from './scroll/sections';
import { createScene, hasWebGL, type SceneController } from './three/scene';
import { sceneState, REDUCED_STATE } from './three/state';
import { setupHeader } from './ui/header';
import { setupIndicator } from './ui/indicator';
import { setupCursor } from './ui/cursor';
import { splitChars, layoutTitleGradient, setupProgress, setupSectionNumerals, setupTilt, runPreloader } from './ui/effects';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// point count / DPR are chosen once at load; scroll timelines are rebuilt per breakpoint below
const isMobile = window.matchMedia('(max-width: 767px)').matches;

/* ---------- 3D ---------- */
let scene: SceneController | null = null;
const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
if (canvas && hasWebGL()) {
  scene = createScene(canvas, { isMobile, interactive: !reduced });
  if (scene) {
    // one recovery attempt; if the context is not restored within 4s (or is lost again) fall back
    let restored = false;
    let lostTimer = 0;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (restored) { disableWebGL(); return; }
      restored = true;
      lostTimer = window.setTimeout(disableWebGL, 4000);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      window.clearTimeout(lostTimer);
      if (!reduced) scene?.start(); else scene?.renderOnce();
    });
  }
}
if (!scene) disableWebGL();

function disableWebGL(): void {
  scene?.dispose();
  scene = null;
  document.documentElement.dataset.webgl = '0';
  canvas?.remove();
}

/* ---------- Scroll / UI ---------- */
const smooth = createSmoothScroll(!reduced);
const header = setupHeader(smooth);
const indicator = setupIndicator(smooth);

/* Active section = the last section whose top has passed the middle of the viewport. */
const sectionEls = Array.from(document.querySelectorAll<HTMLElement>('section[data-section]'));
let activeId = '';
let activeTick = false;
const updateActive = () => {
  activeTick = false;
  const mid = window.innerHeight * 0.5;
  let current = sectionEls[0];
  for (const el of sectionEls) {
    if (el.getBoundingClientRect().top <= mid) current = el;
  }
  const id = current?.id ?? '';
  if (id !== activeId) {
    activeId = id;
    header.setActive(id);
    indicator.setActive(id);
  }
};
window.addEventListener('scroll', () => {
  if (!activeTick) { activeTick = true; requestAnimationFrame(updateActive); }
}, { passive: true });
updateActive();

const heroChars = splitChars(document.getElementById('hero-title')!);
layoutTitleGradient(document.getElementById('hero-title')!);
if (document.fonts?.ready) document.fonts.ready.then(() => layoutTitleGradient(document.getElementById('hero-title')!));
setupProgress();
setupSectionNumerals(reduced);
setupTilt();
setupCursor();

if (reduced) {
  Object.assign(sceneState, REDUCED_STATE);
  scene?.renderOnce();
  setupReveals(document, true);
  gsap.set('#hero-inner, #scroll-hint', { opacity: 1 });
  void runPreloader(true);
} else {
  // gsap.matchMedia reverts every tween / ScrollTrigger made inside when a breakpoint is crossed
  const mm = gsap.matchMedia();
  mm.add(
    { wide: '(min-width: 768px)', mobile: '(max-width: 767px)' },
    (ctx) => {
      const c = ctx.conditions as { wide: boolean; mobile: boolean };
      return setupSections({ scene, shift: c.mobile ? 0 : 1 });
    },
  );
  setupReveals(document, false);
  gsap.set(heroChars, { yPercent: 110 });
  gsap.set('#hero [data-reveal], #scroll-hint, .header .wordmark', { opacity: 0 });
  smooth.stop();
  scene?.start();
  void runPreloader(false).then(() => { smooth.start(); heroIntro(); });
}

/* ---------- Hero intro (time-based, once) ---------- */
function heroIntro(): void {
  const items = gsap.utils.toArray<HTMLElement>('#hero [data-reveal]');
  const hint = document.getElementById('scroll-hint')!;
  gsap.set(hint, { opacity: 0 });
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, delay: 0.15 });
  tl.fromTo('.header .wordmark', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0);
  tl.to(heroChars, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.04 }, 0.1);
  buildRevealTimeline(tl, items);
  tl.to(hint, { opacity: 1, duration: 0.8 }, '+=0.3');
  tl.call(() => {
    const loop = gsap.to(hint, { y: 8, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    const stopHint = () => {
      loop.kill();
      gsap.to(hint, { opacity: 0, y: 0, duration: 0.4, overwrite: true });
      window.removeEventListener('scroll', stopHint);
    };
    if (window.scrollY > 10) stopHint();
    else window.addEventListener('scroll', stopHint, { passive: true, once: true });
  });
}

/* ---------- Layout refresh & hash landing ---------- */
const refresh = () => ScrollTrigger.refresh();
if (document.fonts?.ready) document.fonts.ready.then(refresh);
window.addEventListener('load', () => {
  refresh();
  const hash = location.hash;
  if (hash && hash !== '#top' && document.getElementById(hash.slice(1))) {
    requestAnimationFrame(() => { smooth.scrollTo(hash, { immediate: true }); header.keepVisible(2500); });
  }
});
let lastWidth = window.innerWidth;
let refreshTimer = 0;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth) return; // ignore mobile address-bar height changes
  lastWidth = window.innerWidth;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => { layoutTitleGradient(document.getElementById('hero-title')!); refresh(); }, 200);
});
