/**
 * Reveals [data-animate] elements as they scroll into view.
 *
 * Sections opt in by adding data-animate="fade-up" | "fade-in" | "scale-in" to an
 * element, and (optionally) data-animate-group to a container of children that
 * should stagger in sequence. Actual motion (duration/distance/easing) is driven by
 * the --anim-reveal-* custom properties set in theme-styles-variables.liquid, scaled by the
 * "Scroll animation intensity" theme setting - this file only decides *when* to
 * reveal, never *how much*.
 */

const ANIMATE_SELECTOR = '[data-animate]';

/** @type {IntersectionObserver | null} */
let observer = null;

/**
 * @param {HTMLElement} root
 */
function assignStaggerIndex(root) {
  root.querySelectorAll('[data-animate-group]').forEach((group) => {
    Array.from(group.querySelectorAll(ANIMATE_SELECTOR)).forEach((el, index) => {
      el.style.setProperty('--anim-child-index', String(index));
    });
  });
}

/**
 * @param {HTMLElement} root
 */
function observeAll(root) {
  if (!observer) return;

  root.matches?.(ANIMATE_SELECTOR) && observer.observe(root);
  root.querySelectorAll?.(ANIMATE_SELECTOR).forEach((el) => observer.observe(el));
}

function init() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0 }
  );

  assignStaggerIndex(document.body);
  observeAll(document.body);

  // Sections can be hydrated/replaced after first paint (theme editor, paginated
  // lists, quick-view swaps) - keep watching for newly inserted [data-animate] nodes.
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        assignStaggerIndex(node);
        observeAll(node);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Added last, after the observer is wired up, so the hidden state never applies
  // without something guaranteed to reveal it.
  document.documentElement.classList.add('forge-animate-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
