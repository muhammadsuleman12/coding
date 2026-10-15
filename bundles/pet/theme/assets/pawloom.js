/* Pawloom theme helpers: hero load moment, countdowns. No dependencies. */
(() => {
  const ready = () => {
    document.querySelectorAll('.pl-hero').forEach((el) => requestAnimationFrame(() => el.classList.add('is-ready')));

    document.querySelectorAll('[data-pl-countdown]').forEach((el) => {
      const end = Date.parse(el.dataset.plCountdown);
      if (Number.isNaN(end)) { el.hidden = true; return; }
      const parts = ['d', 'h', 'm', 's'].map((k) => el.querySelector(`[data-u="${k}"]`));
      const pad = (n) => String(n).padStart(2, '0');
      const tick = () => {
        const left = Math.max(0, end - Date.now());
        if (!left) { el.hidden = true; clearInterval(timer); return; }
        const s = Math.floor(left / 1000);
        [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
          .forEach((v, i) => { if (parts[i]) parts[i].textContent = pad(v); });
      };
      const timer = setInterval(tick, 1000);
      tick();
      el.hidden = Date.now() >= end;
    });

    shipBy();
    // open review form after submit
    document.querySelectorAll('.pl-rform').forEach((d) => { if (d.querySelector('.pl-rform__msg')) { d.open = true; d.scrollIntoView({ block: 'center' }); } });
  };
  const shipBy = () => {
    document.querySelectorAll('[data-pl-shipby]').forEach((el) => {
      let n = parseInt(el.dataset.plShipby, 10) || 0; const d = new Date();
      while (n > 0) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n--; }
      el.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    });
  };
  // refresh price box when a variant is chosen
  document.addEventListener('shopify:product:select', (e) => {
    if (!(e.target instanceof Element) || e.target.closest('product-card') || !e.promise) return;
    e.promise.then((res) => {
      const html = res && res.detail && res.detail.html; if (!html) return;
      const doc = typeof html === 'string' ? new DOMParser().parseFromString(html, 'text/html') : html;
      document.querySelectorAll('[data-pl-live]').forEach((el) => {
        const next = doc.querySelector(`[data-pl-live="${el.dataset.plLive}"]`);
        if (next) { el.innerHTML = next.innerHTML; }
      });
      shipBy();
    }).catch(() => {});
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
