import { gsap } from './smooth';
import { sceneState as S, type SceneState } from '../three/state';
import type { SceneController } from '../three/scene';

type Partial3D = Partial<SceneState>;

export type SectionsOptions = {
  scene: SceneController | null;
  /** 1 on wide layouts (object sits beside the text), 0 on mobile (object centred above text) */
  shift: number;
};

const root = document.documentElement;
/**
 * ScrollTrigger renders every scrubbed timeline at progress 0 on refresh, which would apply the
 * "from" values of any tween placed exactly at 0. Nudging all positions past 0 keeps the initial
 * scene state untouched until the section is actually reached.
 */
const EPS = 0.001;
const at = (p: number) => Math.max(p, EPS);

/** fromTo on the flat scene state: explicit start & end so scrubbing backwards is deterministic. */
function seg(tl: gsap.core.Timeline, start: number, end: number, from: Partial3D, to: Partial3D): void {
  tl.fromTo(S, from, { ...to, duration: end - at(start), ease: 'none', immediateRender: false }, at(start));
}
/** background driver: CSS custom properties on <html> (fallback) + numeric state for the shader */
function bg(tl: gsap.core.Timeline, start: number, end: number, from: Record<string, string>, to: Record<string, string>): void {
  tl.fromTo(root, from, { ...to, duration: end - at(start), ease: 'none', immediateRender: false }, at(start));
  const num = (v: Record<string, string>): Partial3D => {
    const o: Partial3D = {};
    if (v['--bg-x']) o.bgX = parseFloat(v['--bg-x']) / 100;
    if (v['--bg-y']) o.bgY = parseFloat(v['--bg-y']) / 100;
    if (v['--bg-c']) o.bgWarm = v['--bg-c'].toLowerCase() === '#3a2a6e' ? 1 : 0;
    return o;
  };
  seg(tl, start, end, num(from), num(to));
}

/** Unpinned list items: plain per-element entrance, always fully readable once on screen. */
function revealEach(els: HTMLElement[]): void {
  for (const el of els) {
    gsap.set(el, { opacity: 1 });
    gsap.from(el, {
      opacity: 0, y: 16, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
    });
  }
}

function sectionTimeline(id: string, trigger: Partial<ScrollTrigger.Vars> = {}): gsap.core.Timeline {
  return gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: `#${id}`,
      start: 'top top',
      end: 'bottom top',
      // scrub: true (no lag tween). Adjacent sections tween the same scene properties; a lagged
      // scrub would let two timelines fight for 0.8s at every hand-off. Lenis provides the easing.
      scrub: true,
      ...trigger,
    },
  });
}

export function setupSections(o: SectionsOptions): () => void {
  const tls: gsap.core.Timeline[] = [];

  /* ---------- placements (object position / scale per section; hand-offs happen in the previous section's tail) ---------- */
  const W = o.shift;
  const P = {
    hero:    W ? { gx: 3.3, gy: 0.1, gs: 2.3 } : { gx: 1.1, gy: 3.1, gs: 1.05 },
    about:   W ? { gx: -3.1, gy: -1.5, gs: 1.0 } : { gx: 0, gy: 1.9, gs: 0.8 },
    service: W ? { gx: -2.8, gy: -1.6, gs: 0.65 } : { gx: 0.4, gy: 3.0, gs: 0.55 },
    process: W ? { gx: 3.7, gy: 2.1, gs: 0.7 } : { gx: 0.4, gy: 3.1, gs: 0.6 },
    works:   W ? { gx: 3.4, gy: -2.7, gs: 0.7 } : { gx: 0.6, gy: 3.3, gs: 0.6 },
    company: W ? { gx: -3.5, gy: -1.6, gs: 0.9 } : { gx: -0.6, gy: 3.1, gs: 0.7 },
    contact: W ? { gx: 0, gy: -0.7, gs: 1.05 } : { gx: 0, gy: 2.3, gs: 1.35 },
  };
  const HERO_CAM = { camX: 0, camY: 1.1, camZ: 9.0 };
  S.groupX = P.hero.gx; S.groupY = P.hero.gy; S.groupScale = P.hero.gs; S.heroPlanet = 1;

  /* ---------- 1. Hero — 環つき惑星 ---------- */
  {
    const tl = sectionTimeline('hero');
    seg(tl, 0, 0.6, { ...HERO_CAM, pointSize: 3.4 }, { camX: 0.2, camY: 1.4, camZ: 8.6, pointSize: 2.8 });
    // hand-off: the planet body fades, the ring loosens into the atom and travels to the About corner
    seg(tl, 0.55, 1, { heroPlanet: 1, groupX: P.hero.gx, groupY: P.hero.gy, groupScale: P.hero.gs, w0: 1, w1: 0, pointSize: 2.8 },
      { heroPlanet: 0, groupX: P.about.gx, groupY: P.about.gy, groupScale: P.about.gs, w0: 0, w1: 1, pointSize: 1.5 });
    seg(tl, 0.55, 1, { camX: 0.2, camY: 1.4, camZ: 8.6 }, { camX: 0, camY: 0.4, camZ: 8.0 });
    tl.fromTo('#hero-inner', { y: 0, opacity: 1 }, { y: -80, opacity: 0, duration: 0.6, immediateRender: false }, EPS);
    tls.push(tl);
  }

  /* ---------- 2. About — 原子軌道 ---------- */
  {
    const tl = sectionTimeline('about');
    seg(tl, 0, 1, { rotY: 0, noise: 0.02, accentMix: 0.1 }, { rotY: 0.25, noise: 0.01, accentMix: 0.25 });
    seg(tl, 0, 0.3, { idleSpeed: 0 }, { idleSpeed: 0.04 });
    bg(tl, 0, 0.4, { '--bg-x': '50%', '--bg-y': '60%' }, { '--bg-x': '62%', '--bg-y': '45%' });
    // → Service: atom → lattice, object sinks to the bottom-left corner
    seg(tl, 0.75, 1, { w1: 1, w2: 0, groupX: P.about.gx, groupY: P.about.gy, groupScale: P.about.gs, camX: 0, camY: 0.4, pointSize: 1.5 },
      { w1: 0, w2: 1, groupX: P.service.gx, groupY: P.service.gy, groupScale: P.service.gs, camX: 0.4, camY: 0.6, pointSize: 2.0 });
    tls.push(tl);
  }

  /* ---------- 3. Service — 格子 ---------- */
  {
    const tl = sectionTimeline('service');
    seg(tl, 0, 0.3, { lineOpacity: 0, noise: 0.02 }, { lineOpacity: 0.3, noise: 0.02 });
    bg(tl, 0, 0.3, { '--bg-x': '62%', '--bg-y': '45%' }, { '--bg-x': '40%', '--bg-y': '50%' });
    seg(tl, 0.3, 0.8, { camX: 0.4, camY: 0.6 }, { camX: -0.4, camY: 0.8 });
    // → Process: object crosses to the top-right, dims
    seg(tl, 0.8, 1, { groupX: P.service.gx, groupY: P.service.gy, groupScale: P.service.gs, opacity: 1 }, { groupX: P.process.gx, groupY: P.process.gy, groupScale: P.process.gs, opacity: 0.5 });

    const cards = gsap.utils.toArray<HTMLElement>('#service-cards .card');
    const litKeys = ['lit0', 'lit1', 'lit2', 'lit3'] as const;
    for (let i = 0; i < 4; i++) {
      const s = 0.12 + i * 0.18, e = s + 0.18;
      seg(tl, s, e, { [litKeys[i]]: 0 }, { [litKeys[i]]: 1 });
      if (i > 0) seg(tl, s, e, { [litKeys[i - 1]]: 1 }, { [litKeys[i - 1]]: 0.6 });
    }
    revealEach(cards);
    seg(tl, 0.9, 1, { lit3: 1, w2: 1, w3: 0 }, { lit3: 0.6, w2: 0.6, w3: 0.4 });
    tls.push(tl);
  }

  /* ---------- 4. Process — 設計図から結び目へ ---------- */
  {
    const tl = sectionTimeline('process', {
      onUpdate: (self) => o.scene?.setLineMode(self.progress > 0.16 ? 'knot' : 'lattice'),
    });
    seg(tl, 0, 0.15, { w2: 0.6, w3: 0.4, lineOpacity: 0.3, lineDraw: 1 }, { w2: 0, w3: 1, lineOpacity: 0, lineDraw: 0 });
    seg(tl, 0, 0.15, { camX: -0.4, camY: 0.8, camZ: 8.0, tX: 0, tY: 0, lit0: 0.6, lit1: 0.6, lit2: 0.6, lit3: 0.6 },
      { camX: 0, camY: 3.0, camZ: 7.5, tX: 0, tY: 0, lit0: 0, lit1: 0, lit2: 0, lit3: 0 });
    bg(tl, 0, 0.15, { '--bg-x': '40%', '--bg-y': '50%' }, { '--bg-x': '50%', '--bg-y': '70%' });
    seg(tl, 0.32, 0.49, { w3: 1, w4: 0, noise: 0.02, camY: 3.0 }, { w3: 0.55, w4: 0.45, noise: 0.18, camY: 2.2 });
    seg(tl, 0.49, 0.66, { w3: 0.55, w4: 0.45, lineOpacity: 0, lineDraw: 0, camX: 0, camY: 2.2, camZ: 7.5 }, { w3: 0, w4: 1, lineOpacity: 0.35, lineDraw: 1, camX: 1.0, camY: 1.0, camZ: 7.5 });
    seg(tl, 0.66, 0.83, { rotX: 0, colorMix: 0 }, { rotX: 0.5, colorMix: 0.5 });
    seg(tl, 0.83, 1, { breath: 0.012, noise: 0.18 }, { breath: 0.03, noise: 0.06 });
    // → Works: object to the bottom-right
    seg(tl, 0.8, 1, { groupX: P.process.gx, groupY: P.process.gy, groupScale: P.process.gs }, { groupX: P.works.gx, groupY: P.works.gy, groupScale: P.works.gs });

    revealEach(gsap.utils.toArray<HTMLElement>('#process-steps .step'));
    tls.push(tl);
  }

  /* ---------- 5. Works — 完成形 ---------- */
  {
    // starts while the section is entering (20vh after the Process pin releases)
    const tl = sectionTimeline('works', { start: 'top 80%' });
    seg(tl, 0, 0.25, { knotOpacity: 0, pointSize: 2.0, lineOpacity: 0.35, accentMix: 0.25, colorMix: 0.5 }, { knotOpacity: 0.55, pointSize: 1.6, lineOpacity: 0.15, accentMix: 0.6, colorMix: 1 });
    seg(tl, 0, 0.25, { camX: 1.0, camY: 1.0, camZ: 7.5, tX: 0, fov: 42, opacity: 0.6 }, { camX: 0, camY: 0.3, camZ: 7.5, tX: 0, fov: 42, opacity: 0.55 });
    bg(tl, 0, 0.25, { '--bg-x': '50%', '--bg-y': '70%', '--bg-c': '#1a3466' }, { '--bg-x': '50%', '--bg-y': '50%', '--bg-c': '#3a2a6e' });
    seg(tl, 0, 0.7, { tY: 0 }, { tY: 0.2 });
    // the solid fades while the cards are still on screen (brief §3.1: glow stays a minority)
    seg(tl, 0.55, 0.72, { knotOpacity: 0.55 }, { knotOpacity: 0 });
    // lines fade before the slab morph: the knot index set would draw random long lines on the slab
    seg(tl, 0.62, 0.76, { lineOpacity: 0.15 }, { lineOpacity: 0 });
    // knot → slab hand-off completes as the Company heading enters
    seg(tl, 0.74, 1, { w4: 1, w5: 0, noise: 0.06, accentMix: 0.6, colorMix: 1, rotX: 0.5, breath: 0.03 },
      { w4: 0, w5: 1, noise: 0.02, accentMix: 0.15, colorMix: 0.3, rotX: 0, breath: 0.012 });
    seg(tl, 0.74, 1, { camX: 0, camY: 0.3, camZ: 7.5, tX: 0, tY: 0.2, fov: 42, groupX: P.works.gx, groupY: P.works.gy, groupScale: P.works.gs, opacity: 0.55 },
      { camX: -0.6, camY: -0.4, camZ: 8.0, tX: 0, tY: 0.2, fov: 42, groupX: P.company.gx, groupY: P.company.gy, groupScale: P.company.gs, opacity: 0.9 });
    bg(tl, 0.74, 1, { '--bg-x': '50%', '--bg-y': '50%', '--bg-c': '#3a2a6e' }, { '--bg-x': '35%', '--bg-y': '55%', '--bg-c': '#1a3466' });
    seg(tl, 0.86, 1, { slabOpacity: 0 }, { slabOpacity: 0.8 });
    tls.push(tl);
  }

  /* ---------- 6. Company — 礎 ---------- */
  {
    // the slab is already complete here; only the idle rotation settles (礎は動かない)
    const tl = sectionTimeline('company');
    seg(tl, 0, 0.3, { idleSpeed: 0.04 }, { idleSpeed: 0.01 });
    tls.push(tl);
  }

  /* ---------- 7. Contact — 輪 (+ footer 余韻) ---------- */
  {
    // starts while the section is still entering (Company only animates in its first 40%)
    const tl = sectionTimeline('contact', { start: 'top 45%', end: 'max' });
    const morphEnd = o.shift ? 0.5 : 0.3;
    // desktop: the ring is pushed outside the text block (closer camera, lower); mobile: nearly edge-on above the heading
    const ringRotX = o.shift ? 0.3 : 0.75;
    const contactZ = o.shift ? 6.8 : 8.0;
    seg(tl, 0, morphEnd * 0.5, { slabOpacity: 0.8 }, { slabOpacity: 0 });
    seg(tl, 0, morphEnd, { w5: 1, w6: 0, pointSize: 1.6, noise: 0.02, breath: 0.012, accentMix: 0.15, idleSpeed: 0.01, colorMix: 0.3 },
      { w5: 0, w6: 1, pointSize: 2.0, noise: 0.05, breath: 0.02, accentMix: 0.4, idleSpeed: 0.04, colorMix: 1 });
    seg(tl, 0, morphEnd, { camX: -0.6, camY: -0.4, camZ: 8.0, tX: 0, tY: 0.2, groupX: P.company.gx, groupY: P.company.gy, groupScale: P.company.gs, rotX: 0, opacity: 0.9 },
      { camX: 0, camY: 0.4, camZ: contactZ, tX: 0, tY: 0, groupX: P.contact.gx, groupY: P.contact.gy, groupScale: P.contact.gs, rotX: ringRotX, opacity: 0.8 });
    bg(tl, 0, morphEnd, { '--bg-x': '35%', '--bg-y': '55%' }, { '--bg-x': '50%', '--bg-y': '50%' });
    seg(tl, morphEnd * 0.6, morphEnd, { orbitOpacity: 0 }, { orbitOpacity: 1 });
    // footer tail
    seg(tl, 0.7, 1, { opacity: 0.8, camZ: contactZ }, { opacity: 0.3, camZ: contactZ + 1 });
    bg(tl, 0.7, 1, { '--bg-y': '50%' }, { '--bg-y': '100%' });
    tls.push(tl);
  }

  return () => {
    for (const tl of tls) {
      tl.scrollTrigger?.kill();
      tl.kill();
    }
  };
}
