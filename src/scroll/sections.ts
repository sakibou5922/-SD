import { gsap } from './smooth';
import { sceneState as S, type SceneState } from '../three/state';
import type { SceneController } from '../three/scene';

type Partial3D = Partial<SceneState>;

export type SectionsOptions = {
  scene: SceneController | null;
  /** pin Service / Process (desktop) */
  pinService: boolean;
  pinProcess: boolean;
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
/** background driver: CSS custom properties on <html> */
function bg(tl: gsap.core.Timeline, start: number, end: number, from: Record<string, string>, to: Record<string, string>): void {
  tl.fromTo(root, from, { ...to, duration: end - at(start), ease: 'none', immediateRender: false }, at(start));
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
  // lookAt x offsets: negative moves the object to the right of the screen (beside left-aligned text)
  const X_ABOUT = -1.1 * o.shift, X_SERVICE = -1.9 * o.shift, X_PROCESS = -1.5 * o.shift;
  const X_WORKS = 0, X_COMPANY = 1.2 * o.shift, X_CONTACT = 0;

  /* ---------- 1. Hero — 点 ---------- */
  {
    const tl = sectionTimeline('hero');
    // mobile: lift the (large) galaxy above the headline, settle to 0 before About
    const heroY = o.shift ? 0 : 1.2;
    S.groupY = heroY;
    seg(tl, 0, 1, { camX: 0, camY: 4.2, camZ: 8.0, pointSize: 2.6, groupY: heroY }, { camX: 0.4, camY: 2.6, camZ: 7.4, pointSize: 2.0, groupY: 0 });
    seg(tl, 0.75, 1, { w0: 1, w1: 0 }, { w0: 0.6, w1: 0.4 });
    tl.fromTo('#hero-inner', { y: 0, opacity: 1 }, { y: -80, opacity: 0, duration: 0.6, immediateRender: false }, EPS);
    tls.push(tl);
  }

  /* ---------- 2. About — 核 ---------- */
  {
    const tl = sectionTimeline('about');
    seg(tl, 0, 0.35, { w0: 0.6, w1: 0.4, noise: 0.12, accentMix: 0.1 }, { w0: 0, w1: 1, noise: 0.08, accentMix: 0.25 });
    seg(tl, 0, 0.4, { camX: 0.4, camY: 2.6, camZ: 7.4, tX: 0 }, { camX: 1.2, camY: 0.6, camZ: 6.5, tX: X_ABOUT });
    seg(tl, 0, 1, { rotY: 0 }, { rotY: 0.4 });
    bg(tl, 0, 0.4, { '--bg-x': '50%', '--bg-y': '60%' }, { '--bg-x': '62%', '--bg-y': '45%' });
    seg(tl, 0.8, 1, { w1: 1, w2: 0 }, { w1: 0.5, w2: 0.5 });
    tls.push(tl);
  }

  /* ---------- 3. Service — 格子 ---------- */
  {
    const tl = sectionTimeline('service', o.pinService ? { end: '+=240%', pin: true, anticipatePin: 1 } : {});
    seg(tl, 0, 0.3, { w1: 0.5, w2: 0.5, lineOpacity: 0, noise: 0.08 }, { w1: 0, w2: 1, lineOpacity: 0.3, noise: 0.02 });
    seg(tl, 0, 0.3, { camX: 1.2, camY: 0.6, camZ: 6.5, tX: X_ABOUT, tY: 0, fov: 42 }, { camX: 4.2, camY: 1.6, camZ: 6.3, tX: X_SERVICE, tY: 0.2, fov: 40 });
    bg(tl, 0, 0.3, { '--bg-x': '62%', '--bg-y': '45%' }, { '--bg-x': '40%', '--bg-y': '50%' });
    seg(tl, 0.3, 0.9, { camX: 4.2, camY: 1.6, camZ: 6.3 }, { camX: -3.3, camY: 1.2, camZ: 6.8 });

    const cards = gsap.utils.toArray<HTMLElement>('#service-cards .card');
    const litKeys = ['lit0', 'lit1', 'lit2', 'lit3'] as const;
    for (let i = 0; i < 4; i++) {
      const s = 0.12 + i * 0.18, e = s + 0.18;
      seg(tl, s, e, { [litKeys[i]]: 0 }, { [litKeys[i]]: 1 });
      if (i > 0) seg(tl, s, e, { [litKeys[i - 1]]: 1 }, { [litKeys[i - 1]]: 0.6 });
      if (!cards[i]) continue;
      if (o.pinService) {
        tl.fromTo(cards[i], { opacity: 0.6, x: 0, '--bar': 0 }, { opacity: 1, x: 12, '--bar': 1, duration: 0.1, ease: 'power2.out', immediateRender: false }, s);
      } else {
        // unpinned (mobile / tablet): cards are always readable; only the bar follows the section
        tl.fromTo(cards[i], { '--bar': 0 }, { '--bar': 1, duration: 0.1, ease: 'none', immediateRender: false }, s);
      }
    }
    if (!o.pinService) revealEach(cards);
    seg(tl, 0.9, 1, { lit3: 1, w2: 1, w3: 0 }, { lit3: 0.6, w2: 0.6, w3: 0.4 });
    tls.push(tl);
  }

  /* ---------- 4. Process — 設計図から結び目へ ---------- */
  {
    const tl = sectionTimeline('process', {
      ...(o.pinProcess ? { end: '+=300%', pin: true, anticipatePin: 1 } : {}),
      onUpdate: (self) => o.scene?.setLineMode(self.progress > 0.16 ? 'knot' : 'lattice'),
    });
    seg(tl, 0, 0.15, { w2: 0.6, w3: 0.4, lineOpacity: 0.3, lineDraw: 1 }, { w2: 0, w3: 1, lineOpacity: 0, lineDraw: 0 });
    seg(tl, 0, 0.15, { camX: -3.3, camY: 1.2, camZ: 6.8, tX: X_SERVICE, tY: 0.2, lit0: 0.6, lit1: 0.6, lit2: 0.6, lit3: 0.6 }, { camX: 0, camY: 3.2, camZ: 6.0, tX: X_PROCESS, tY: 0, lit0: 0, lit1: 0, lit2: 0, lit3: 0 });
    bg(tl, 0, 0.15, { '--bg-x': '40%', '--bg-y': '50%' }, { '--bg-x': '50%', '--bg-y': '70%' });
    seg(tl, 0.32, 0.49, { w3: 1, w4: 0, noise: 0.02, camY: 3.2 }, { w3: 0.55, w4: 0.45, noise: 0.18, camY: 2.2 });
    seg(tl, 0.49, 0.66, { w3: 0.55, w4: 0.45, lineOpacity: 0, lineDraw: 0, camX: 0, camY: 2.2, camZ: 6.0 }, { w3: 0, w4: 1, lineOpacity: 0.35, lineDraw: 1, camX: 2.2, camY: 1.0, camZ: 5.2 });
    seg(tl, 0.66, 0.83, { rotX: 0, colorMix: 0 }, { rotX: 0.5, colorMix: 0.5 });
    seg(tl, 0.83, 1, { breath: 0.012, noise: 0.18 }, { breath: 0.03, noise: 0.06 });

    const steps = gsap.utils.toArray<HTMLElement>('#process-steps .step');
    if (o.pinProcess) {
      for (let i = 0; i < steps.length; i++) {
        const s = (i === 0 ? 0.05 : 0.15 + i * 0.17);
        tl.fromTo(steps[i], { opacity: 0.6 }, { opacity: 1, duration: 0.06, ease: 'power2.out', immediateRender: false }, s);
        tl.fromTo(steps[i].querySelector('.step__index'), { scale: 0.9 }, { scale: 1, duration: 0.06, ease: 'power2.out', immediateRender: false }, s);
        if (i > 0) tl.fromTo(steps[i - 1], { opacity: 1 }, { opacity: 0.6, duration: 0.06, ease: 'power2.out', immediateRender: false }, s);
      }
    } else {
      revealEach(steps);
    }
    tls.push(tl);
  }

  /* ---------- 5. Works — 完成形 ---------- */
  {
    const tl = sectionTimeline('works');
    seg(tl, 0, 0.3, { knotOpacity: 0, pointSize: 2.0, lineOpacity: 0.35, accentMix: 0.25, colorMix: 0.5 }, { knotOpacity: 0.55, pointSize: 1.6, lineOpacity: 0.15, accentMix: 0.6, colorMix: 1 });
    seg(tl, 0, 0.3, { camX: 2.2, camY: 1.0, camZ: 5.2, tX: X_PROCESS, fov: 40 }, { camX: 0, camY: 0.3, camZ: 6.2, tX: X_WORKS, fov: 38 });
    bg(tl, 0, 0.3, { '--bg-x': '50%', '--bg-y': '70%', '--bg-c': '#141b3a' }, { '--bg-x': '50%', '--bg-y': '50%', '--bg-c': '#2a1638' });
    seg(tl, 0, 1, { tY: 0 }, { tY: 0.2 });
    // the solid fades out while the cards are still on screen (brief §3.1: glow stays a minority)
    seg(tl, 0.6, 0.8, { knotOpacity: 0.55 }, { knotOpacity: 0 });
    // lines fade before the slab morph: the knot index set would draw random long lines on the slab
    seg(tl, 0.7, 0.85, { lineOpacity: 0.15 }, { lineOpacity: 0 });
    seg(tl, 0.85, 1, { w4: 1, w5: 0 }, { w4: 0.5, w5: 0.5 });
    tls.push(tl);
  }

  /* ---------- 6. Company — 礎 ---------- */
  {
    const tl = sectionTimeline('company');
    seg(tl, 0, 0.3, { w4: 0.5, w5: 0.5, noise: 0.06, accentMix: 0.6, idleSpeed: 0.04, colorMix: 1, rotX: 0.5, breath: 0.03 },
      { w4: 0, w5: 1, noise: 0.02, accentMix: 0.15, idleSpeed: 0.01, colorMix: 0.3, rotX: 0, breath: 0.012 });
    seg(tl, 0.15, 0.4, { slabOpacity: 0 }, { slabOpacity: 0.8 });
    seg(tl, 0, 0.3, { camX: 0, camY: 0.3, camZ: 6.2, tX: X_WORKS, tY: 0.2, fov: 38 }, { camX: -1.6, camY: -0.8, camZ: 7.0, tX: X_COMPANY, tY: 0.6, fov: 42 });
    bg(tl, 0, 0.3, { '--bg-x': '50%', '--bg-y': '50%', '--bg-c': '#2a1638' }, { '--bg-x': '35%', '--bg-y': '55%', '--bg-c': '#141b3a' });
    tls.push(tl);
  }

  /* ---------- 7. Contact — 輪 (+ footer 余韻) ---------- */
  {
    // starts while the section is still entering (Company only animates in its first 40%)
    const tl = sectionTimeline('contact', { start: 'top 45%', end: 'max' });
    const morphEnd = o.shift ? 0.5 : 0.3;
    const groupY = o.shift ? -0.3 : 0.9; // mobile: the ring floats above the centred heading
    seg(tl, 0, morphEnd * 0.5, { slabOpacity: 0.8 }, { slabOpacity: 0 });
    seg(tl, 0, morphEnd, { w5: 1, w6: 0, pointSize: 1.6, noise: 0.02, breath: 0.012, accentMix: 0.15, idleSpeed: 0.01, colorMix: 0.3 },
      { w5: 0, w6: 1, pointSize: 2.0, noise: 0.05, breath: 0.02, accentMix: 0.4, idleSpeed: 0.04, colorMix: 1 });
    seg(tl, 0, morphEnd, { camX: -1.6, camY: -0.8, camZ: 7.0, tX: X_COMPANY, tY: 0.6, groupY: 0 }, { camX: 0, camY: 0.4, camZ: 7.5, tX: X_CONTACT, tY: 0, groupY });
    bg(tl, 0, morphEnd, { '--bg-x': '35%', '--bg-y': '55%' }, { '--bg-x': '50%', '--bg-y': '50%' });
    // footer tail
    seg(tl, 0.7, 1, { opacity: 1, camZ: 7.5 }, { opacity: 0.35, camZ: 8.5 });
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
