import type { Smooth } from '../scroll/smooth';

export type HeaderController = {
  setActive(id: string): void;
};

export function setupHeader(smooth: Smooth): HeaderController {
  const header = document.getElementById('header')!;
  const menuBtn = document.getElementById('menu-btn') as HTMLButtonElement;
  const menu = document.getElementById('menu')!;
  const main = document.getElementById('main')!;
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('#nav-list a[data-section]'));

  /* scrolled / hidden states */
  let lastY = window.scrollY;
  let ticking = false;
  /** while > now, programmatic (anchor) scrolling must not hide the header */
  let keepVisibleUntil = 0;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 80);
    const inHero = y < window.innerHeight * 0.9;
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (inHero || menu.classList.contains('is-open') || performance.now() < keepVisibleUntil) header.classList.remove('is-hidden');
    else if (goingDown) header.classList.add('is-hidden');
    else if (goingUp) header.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  /* anchor links → smooth scroll */
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href')!;
    if (href === '#') return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) closeMenu();
    if (href === '#top') {
      smooth.scrollTo(0);
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    if (!document.querySelector(href)) return;
    keepVisibleUntil = performance.now() + 1600;
    header.classList.remove('is-hidden');
    smooth.scrollTo(href);
    history.replaceState(null, '', href);
  });

  /* mobile menu */
  const focusable = () => Array.from(menu.querySelectorAll<HTMLElement>('a, button'));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { closeMenu(); menuBtn.focus(); return; }
    if (e.key !== 'Tab') return;
    const els = [menuBtn, ...focusable()];
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const openMenu = () => {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', 'メニューを閉じる');
    main.setAttribute('inert', '');
    smooth.stop();
    document.addEventListener('keydown', onKey);
    header.classList.remove('is-hidden');
  };
  const closeMenu = () => {
    menu.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'メニューを開く');
    main.removeAttribute('inert');
    smooth.start();
    document.removeEventListener('keydown', onKey);
    window.setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 450);
  };
  menuBtn.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) closeMenu(); else openMenu();
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

  return {
    setActive(id) {
      for (const a of navLinks) {
        if (a.dataset.section === id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      }
    },
  };
}
