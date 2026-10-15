// EPH General Store: reveal motion, quick add, tabs, deal filters, recommendations, dialogs.
import { CartAddEvent } from '@forge/events';

const root = document.documentElement;
root.classList.add('gs-js');

function initReveal(scope = document) {
  const items = scope.querySelectorAll('[data-gs-reveal]:not(.is-in)');
  if (!('IntersectionObserver' in window) || document.body.classList.contains('gs-motion-off')) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const sibs = [...e.target.parentElement.children].filter((c) => c.hasAttribute('data-gs-reveal'));
      e.target.style.setProperty('--i', Math.min(sibs.indexOf(e.target), 6));
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  items.forEach((el) => io.observe(el));
}

// Quick add (single-variant products)
document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('form[data-gs-add]');
  if (!form) return;
  ev.preventDefault();
  const btn = form.querySelector('button');
  btn?.classList.add('is-loading');
  const fd = new FormData(form);
  const ids = [...document.querySelectorAll('forge-cart-items-component')].map((c) => c.dataset.sectionId).filter(Boolean);
  if (ids.length) fd.append('sections', ids.join(','));
  try {
    const res = await fetch((window.Theme?.routes?.cart_add_url) || '/cart/add.js', {
      method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }
    });
    const data = await res.json();
    if (data.status) { alert(data.description || data.message); return; }
    btn?.classList.add('is-added');
    setTimeout(() => btn?.classList.remove('is-added'), 1600);
    form.dispatchEvent(new CartAddEvent({}, String(fd.get('id')), {
      source: 'gs-quick-add', itemCount: 1, productId: String(data.product_id || ''), sections: data.sections
    }));
  } catch (e) {
    form.submit();
  } finally {
    btn?.classList.remove('is-loading');
  }
});

// Tabs: [data-gs-tabs] > [role=tab][aria-controls]
function initTabs(scope = document) {
  scope.querySelectorAll('[data-gs-tabs]').forEach((list) => {
    if (list.dataset.ready) return; list.dataset.ready = '1';
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) initReveal(panel);
      list.dispatchEvent(new CustomEvent('gs:tab', { detail: tab }));
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        n.focus(); select(n);
      });
    });
  });
}

// Deals under $X: filter cards by data-price (cents)
function initDeals(scope = document) {
  scope.querySelectorAll('[data-gs-deals]').forEach((sec) => {
    if (sec.dataset.ready) return; sec.dataset.ready = '1';
    const cards = [...sec.querySelectorAll('[data-price]')];
    const max = parseInt(sec.dataset.max || '8', 10);
    const empty = sec.querySelector('[data-gs-empty]');
    const apply = (cap) => {
      let shown = 0;
      cards.forEach((c) => {
        const ok = parseInt(c.dataset.price, 10) <= cap && shown < max;
        c.hidden = !ok; if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      initReveal(sec);
    };
    sec.querySelectorAll('[data-cap]').forEach((b) => b.addEventListener('click', () => {
      sec.querySelectorAll('[data-cap]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      apply(parseInt(b.dataset.cap, 10));
    }));
    const first = sec.querySelector('[data-cap][aria-pressed="true"]') || sec.querySelector('[data-cap]');
    if (first) apply(parseInt(first.dataset.cap, 10));
  });
}

// Related products via Shopify recommendations
function initRelated(scope = document) {
  scope.querySelectorAll('[data-gs-related]').forEach(async (el) => {
    if (el.dataset.ready) return; el.dataset.ready = '1';
    try {
      const html = await (await fetch(el.dataset.url)).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-gs-related]');
      if (fresh && fresh.querySelector('.gs-card')) { el.innerHTML = fresh.innerHTML; el.closest('.gs-section')?.removeAttribute('hidden'); initReveal(el); }
    } catch (e) { /* leave hidden */ }
  });
}

// Dialogs (size guide)
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-gs-open]');
  if (open) { document.getElementById(open.dataset.gsOpen)?.showModal(); return; }
  const close = e.target.closest('[data-gs-close]');
  if (close) close.closest('dialog')?.close();
  if (e.target.tagName === 'DIALOG' && e.target.classList.contains('gs-dialog')) e.target.close();
});

function initAll(scope) { initReveal(scope); initTabs(scope); initDeals(scope); initRelated(scope); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll(document)); else initAll(document);
document.addEventListener('shopify:section:load', (e) => initAll(e.target));
