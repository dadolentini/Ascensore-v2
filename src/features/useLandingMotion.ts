import { useLayoutEffect, useRef } from 'react';

/** Motion belongs to the introduction; the simulator and its clock stay independent. */
export default function useLandingMotion() {
  const anchor = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const main = anchor.current?.closest<HTMLElement>('#landing-main');
    if (!main || typeof window.matchMedia !== 'function') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reveals = [...main.querySelectorAll<HTMLElement>('[data-landing-reveal]')];
    const picture = main.querySelector<HTMLElement>('[data-landing-parallax]');
    let observer: IntersectionObserver | undefined;
    let removePointerEvents: (() => void) | undefined;
    let frame = 0;

    const reveal = (element: HTMLElement, instant = false) => {
      element.dataset.landingRevealed = 'true';
      if (instant) element.dataset.landingRevealInstant = 'true';
      observer?.unobserve(element);
    };

    const resetPicture = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      picture?.style.removeProperty('--landing-pointer-x');
      picture?.style.removeProperty('--landing-pointer-y');
      picture?.removeAttribute('data-landing-parallax-active');
    };

    const stop = () => {
      observer?.disconnect();
      observer = undefined;
      removePointerEvents?.();
      removePointerEvents = undefined;
      resetPicture();
      main.removeAttribute('data-landing-motion');
    };

    const start = () => {
      stop();
      if (main.hidden || document.hidden) return;
      if (reducedMotion.matches) {
        reveals.forEach(element => reveal(element, true));
        return;
      }

      // Reveal styles are enabled only after a working observer exists.
      // Without support, every element remains in its original visible state.
      if (typeof window.IntersectionObserver === 'function') {
        try {
          observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (entry.isIntersecting) reveal(entry.target as HTMLElement);
            });
          }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
          reveals.forEach(element => {
            const delay = Number(element.dataset.landingDelay ?? 0);
            element.style.setProperty('--landing-reveal-delay', `${Math.min(250, Math.max(0, Number.isFinite(delay) ? delay : 0))}ms`);
            if (element.dataset.landingRevealed === 'true') return;
            if (element.getBoundingClientRect().bottom <= 0) reveal(element, true);
            else {
              element.dataset.landingRevealed = 'false';
              observer?.observe(element);
            }
          });
          main.dataset.landingMotion = 'on';
        } catch {
          observer?.disconnect();
          observer = undefined;
          main.removeAttribute('data-landing-motion');
        }
      }

      if (!picture || !finePointer.matches) return;
      let pointerX = 0;
      let pointerY = 0;
      const move = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          if (main.hidden || document.hidden || reducedMotion.matches) return;
          const bounds = picture.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          const x = Math.max(-1, Math.min(1, 2 * (pointerX - bounds.left) / bounds.width - 1));
          const y = Math.max(-1, Math.min(1, 2 * (pointerY - bounds.top) / bounds.height - 1));
          picture.style.setProperty('--landing-pointer-x', `${(x * 6).toFixed(2)}px`);
          picture.style.setProperty('--landing-pointer-y', `${(y * 6).toFixed(2)}px`);
          picture.dataset.landingParallaxActive = 'true';
        });
      };
      picture.addEventListener('pointermove', move, { passive: true });
      picture.addEventListener('pointerleave', resetPicture);
      window.addEventListener('blur', resetPicture);
      removePointerEvents = () => {
        picture.removeEventListener('pointermove', move);
        picture.removeEventListener('pointerleave', resetPicture);
        window.removeEventListener('blur', resetPicture);
      };
    };

    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      let element: HTMLElement | null = event.target;
      while (element && element !== main) {
        if (element.hasAttribute('data-landing-reveal')) reveal(element, true);
        element = element.parentElement;
      }
    };
    const visibility = new MutationObserver(start);
    visibility.observe(main, { attributes: true, attributeFilter: ['hidden'] });
    reducedMotion.addEventListener('change', start);
    finePointer.addEventListener('change', start);
    document.addEventListener('visibilitychange', start);
    main.addEventListener('focusin', focus);
    start();

    return () => {
      stop();
      visibility.disconnect();
      reducedMotion.removeEventListener('change', start);
      finePointer.removeEventListener('change', start);
      document.removeEventListener('visibilitychange', start);
      main.removeEventListener('focusin', focus);
      reveals.forEach(element => {
        element.removeAttribute('data-landing-revealed');
        element.removeAttribute('data-landing-reveal-instant');
        element.style.removeProperty('--landing-reveal-delay');
      });
    };
  }, []);

  return anchor;
}
