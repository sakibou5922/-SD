import type { Smooth } from '../scroll/smooth';

export function setupIndicator(smooth: Smooth): { setActive(id: string): void } {
  const items = Array.from(document.querySelectorAll<HTMLLIElement>('#indicator li'));
  for (const li of items) {
    const btn = li.querySelector('button')!;
    btn.addEventListener('click', () => {
      const t = btn.dataset.target!;
      if (t === '#hero') smooth.scrollTo(0); else smooth.scrollTo(t);
    });
  }
  return {
    setActive(id) {
      for (const li of items) {
        const t = li.querySelector('button')!.dataset.target;
        li.dataset.active = t === `#${id}` ? 'true' : 'false';
      }
    },
  };
}
