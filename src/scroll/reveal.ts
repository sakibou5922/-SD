import { gsap } from './smooth';

/**
 * Shared DOM entrance utilities (storyboard §3.0 / §8-9).
 * Elements opt in with data-reveal="lines|block|rule|keywords|row|card".
 */
export function setupReveals(root: ParentNode, reduced: boolean): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));

  if (reduced) {
    // opacity-only, no movement
    for (const el of els) {
      gsap.set(el, { opacity: 0 });
      gsap.to(el, {
        opacity: 1,
        duration: 0.3,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    }
    return;
  }

  // Group elements by section so a section's items play as one staggered sequence.
  const sections = new Map<Element, HTMLElement[]>();
  for (const el of els) {
    const sec = el.closest('section, footer') ?? document.body;
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(el);
  }

  for (const [sec, items] of sections) {
    // hero plays on load (handled in main.ts) — skip here
    if ((sec as HTMLElement).id === 'hero') continue;
    const tl = gsap.timeline({
      // trigger on the first revealed element (sections are taller than their content)
      scrollTrigger: { trigger: items[0], start: 'top 85%', toggleActions: 'play none none reverse' },
      defaults: { ease: 'power2.out' },
    });
    buildRevealTimeline(tl, items);
  }
}

export function buildRevealTimeline(tl: gsap.core.Timeline, items: HTMLElement[]): gsap.core.Timeline {
  let pos = 0;
  for (const el of items) {
    const kind = el.dataset.reveal;
    switch (kind) {
      case 'lines': {
        const lines = el.querySelectorAll<HTMLElement>('.line > span');
        gsap.set(lines, { clipPath: 'inset(0 0 100% 0)', y: 28 });
        tl.to(lines, { clipPath: 'inset(0 0 0% 0)', y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, pos);
        pos += 0.4;
        break;
      }
      case 'rule': {
        gsap.set(el, { scaleX: 0 });
        tl.to(el, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, pos - 0.2);
        break;
      }
      case 'keywords': {
        const li = el.querySelectorAll('li');
        gsap.set(li, { opacity: 0, x: -12 });
        tl.to(li, { opacity: 1, x: 0, duration: 0.6, stagger: 0.12 }, pos);
        pos += 0.15;
        break;
      }
      case 'row': {
        const cells = el.querySelectorAll('th, td');
        gsap.set(cells, { opacity: 0, x: 12 });
        tl.to(cells, { opacity: 1, x: 0, duration: 0.6 }, pos);
        pos += 0.06;
        break;
      }
      case 'card': {
        gsap.set(el, { opacity: 0, y: 32, rotateX: 6, transformPerspective: 1000 });
        tl.to(el, { opacity: 1, y: 0, rotateX: 0, duration: 0.9, ease: 'power3.out' }, pos);
        pos += 0.12;
        break;
      }
      default: {
        gsap.set(el, { opacity: 0, y: 16 });
        tl.to(el, { opacity: 1, y: 0, duration: 0.7 }, pos);
        pos += 0.1;
      }
    }
  }
  return tl;
}
