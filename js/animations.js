/* ═══════════════════════════════════════════════════════════
   FINANZAS APP — GSAP Premium Animation System v4
   Requires: gsap 3.12+ loaded before this file

   Priority: instant content, no blank flashes, no bounce on navigation.
   GSAP only enhances counters and micro-interactions.
═══════════════════════════════════════════════════════════ */

(function () {
  if (typeof gsap === 'undefined') return;

  const reduced = '(prefers-reduced-motion: reduce)';
  function isReduced () { return window.matchMedia(reduced).matches; }

  const ease     = 'power3.out';
  const easeSoft = 'power2.out';
  const easeIn   = 'power2.in';

  // ──────────────────────────────────────────────────────────
  // CHART.JS GLOBAL ANIMATION DEFAULTS
  // ──────────────────────────────────────────────────────────
  function applyChartDefaults () {
    if (typeof Chart === 'undefined') { setTimeout(applyChartDefaults, 200); return; }
    Chart.defaults.animation = false;

    Chart.defaults.datasets.bar = Chart.defaults.datasets.bar || {};
    Chart.defaults.datasets.bar.animation = false;

    Chart.defaults.datasets.line = Chart.defaults.datasets.line || {};
    Chart.defaults.datasets.line.animation = false;

    Chart.defaults.datasets.doughnut = Chart.defaults.datasets.doughnut || {};
    Chart.defaults.datasets.doughnut.animation = false;
  }
  applyChartDefaults();

  // ──────────────────────────────────────────────────────────
  // OVERRIDE animateNumberText — GSAP-powered counter
  // ──────────────────────────────────────────────────────────
  window.animateNumberText = function (el, value, opts = {}) {
    if (!el) return;
    const num = Number(value);
    const formatter = typeof opts.formatter === 'function'
      ? opts.formatter
      : (n => `${opts.prefix || ''}${fmtN(n, opts.decimals)}${opts.suffix || ''}`);

    if (!isFinite(num)) { el.textContent = opts.fallback ?? '—'; return; }
    if (isReduced()) { el.textContent = formatter(num); return; }

    const from = Number.isFinite(opts.from) ? Number(opts.from) : 0;
    const duration = (opts.duration || 820) / 1000;
    const proxy = { val: from };

    gsap.killTweensOf(proxy);
    gsap.to(proxy, {
      val: num,
      duration,
      ease: 'power4.out',
      onUpdate() { el.textContent = formatter(proxy.val); },
      onComplete() { el.textContent = formatter(num); }
    });
  };

  // ──────────────────────────────────────────────────────────
  // OVERRIDE animateProgressBar — GSAP-powered
  // ──────────────────────────────────────────────────────────
  window.animateProgressBar = function (el, targetPct) {
    if (!el) return;
    const pct = Math.max(0, Math.min(100, Number(targetPct) || 0));
    if (isReduced()) { el.style.width = pct + '%'; return; }
    gsap.killTweensOf(el);
    gsap.fromTo(el,
      { width: '0%' },
      { width: pct + '%', duration: 0.9, ease: 'power3.out', delay: 0.1 }
    );
  };

  // ──────────────────────────────────────────────────────────
  // OVERRIDE animateDonutStroke — GSAP-powered
  // ──────────────────────────────────────────────────────────
  window.animateDonutStroke = function (el, targetPct, radius = 38) {
    if (!el) return;
    const pct = Math.max(0, Math.min(100, Number(targetPct) || 0));
    const circumference = 2 * Math.PI * radius;
    el.style.strokeDasharray = `${circumference}`;
    if (isReduced()) {
      el.style.strokeDashoffset = `${circumference - (pct / 100) * circumference}`;
      return;
    }
    const target = circumference - (pct / 100) * circumference;
    gsap.killTweensOf(el);
    gsap.fromTo(el,
      { strokeDashoffset: circumference },
      { strokeDashoffset: target, duration: 1.1, ease: 'power3.out', delay: 0.15 }
    );
  };

  // ──────────────────────────────────────────────────────────
  // SLIDING NAV INDICATOR
  // ──────────────────────────────────────────────────────────
  let _navIndicator = null;

  function createNavIndicator () {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || _navIndicator) return;
    const indicator = document.createElement('div');
    indicator.id = 'gsap-nav-indicator';
    indicator.style.cssText = [
      'position:absolute', 'left:6px', 'right:6px', 'height:36px',
      'border-radius:10px', 'background:var(--accent,rgba(100,180,255,0.13))',
      'pointer-events:none', 'z-index:0', 'opacity:0'
    ].join(';');
    sidebar.style.position = 'relative';
    sidebar.insertBefore(indicator, sidebar.firstChild);
    _navIndicator = indicator;
  }

  function moveNavIndicator (targetEl) {
    if (!_navIndicator || !targetEl) return;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const sRect = sidebar.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();
    const top = tRect.top - sRect.top + sidebar.scrollTop;

    if (parseFloat(getComputedStyle(_navIndicator).opacity) < 0.1) {
      gsap.set(_navIndicator, { top, height: tRect.height });
      gsap.to(_navIndicator, { opacity: 1, duration: 0.25, ease: easeSoft });
    } else {
      gsap.to(_navIndicator, { top, height: tRect.height, duration: 0.35, ease: easeSoft, overwrite: 'auto' });
    }
  }

  // ──────────────────────────────────────────────────────────
  // Keep page content visible immediately. No page entrance animation.
  // ──────────────────────────────────────────────────────────
  window.animatePageEnter = function (pageEl) {
    if (!pageEl) return;
    pageEl.classList.remove('page-enter');
    pageEl.querySelectorAll('.fade-up').forEach(el => {
      gsap.killTweensOf(el);
      el.style.animation = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  };

  // Patch nav() — only move the indicator, nothing else
  (function patchNav () {
    const origNav = window.nav;
    if (typeof origNav !== 'function') { setTimeout(patchNav, 100); return; }
    window.nav = function (page) {
      origNav.apply(this, arguments);
      if (isReduced()) return;
      const ni = document.getElementById('ni-' + page);
      if (ni) moveNavIndicator(ni);
    };
  }());

  // ──────────────────────────────────────────────────────────
  // HOVER MICRO-INTERACTIONS — delegated
  // ──────────────────────────────────────────────────────────
  const LIFT_TARGETS = [
    { sel: '.dkpi:not(.dash-hero-card)',    y: -6,  s: 1.014 },
    { sel: '.kpi-card',                      y: -6,  s: 1.014 },
    { sel: '.dash-hero-card',                y: -4,  s: 1.005 },
    { sel: '.dw-card',                       y: -5,  s: 1.012 },
    { sel: '.chart-card',                    y: -4,  s: 1.005 },
    { sel: '.tend-spark-card',               y: -6,  s: 1.012 },
    { sel: '.txn-summary-card',              y: -4,  s: 1.007 },
    { sel: '.cuota-card',                    y: -5,  s: 1.009 },
    { sel: '.sub-card',                      y: -5,  s: 1.009 },
    { sel: '.settings-nav-card',             y: -4,  s: 1.007 },
    { sel: '.rep-design-card',               y: -4,  s: 1.007 },
    { sel: '.table-card',                    y: -3,  s: 1.004 },
  ];

  document.addEventListener('mouseover', function (e) {
    if (isReduced()) return;
    for (const { sel, y, s } of LIFT_TARGETS) {
      const el = e.target.closest(sel);
      if (el) {
        gsap.to(el, { y, scale: s, duration: 0.24, ease: easeSoft, overwrite: 'auto' });
        break;
      }
    }
  });

  document.addEventListener('mouseout', function (e) {
    if (isReduced()) return;
    for (const { sel } of LIFT_TARGETS) {
      const el = e.target.closest(sel);
      if (el) {
        gsap.to(el, { y: 0, scale: 1, duration: 0.38, ease: ease, overwrite: 'auto', clearProps: 'transform' });
        break;
      }
    }
  });

  // ──────────────────────────────────────────────────────────
  // PRESS / TAP FEEDBACK
  // ──────────────────────────────────────────────────────────
  const PRESS_SEL = '.btn, .surface-toggle-btn, .eft-btn, .nav-item, .mob-nav-btn, .kpi-card-clickable, .dash-hero-clickable';

  document.addEventListener('mousedown', function (e) {
    if (isReduced()) return;
    const el = e.target.closest(PRESS_SEL);
    if (el) gsap.to(el, { scale: 0.96, duration: 0.1, ease: easeIn, overwrite: 'auto' });
  });

  document.addEventListener('mouseup', function (e) {
    if (isReduced()) return;
    const el = e.target.closest(PRESS_SEL);
    if (el) gsap.to(el, { scale: 1, duration: 0.28, ease: easeSoft, overwrite: 'auto', clearProps: 'transform' });
  });

  // ──────────────────────────────────────────────────────────
  // TOAST ANIMATION
  // ──────────────────────────────────────────────────────────
  new MutationObserver(function (muts) {
    muts.forEach(function (mut) {
      mut.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        const toast = node.classList?.contains('toast') ? node : node.querySelector?.('.toast');
        if (toast) {
          gsap.killTweensOf(toast);
          gsap.fromTo(toast,
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 0.3, ease: easeSoft }
          );
        }
      });
      if (mut.type === 'attributes' && mut.attributeName === 'class') {
        const el = mut.target;
        if (el.classList.contains('toast') && el.classList.contains('show')) {
          gsap.killTweensOf(el);
          gsap.fromTo(el,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.28, ease: easeSoft }
          );
        }
      }
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // ──────────────────────────────────────────────────────────
  // MODAL / BOTTOM SHEET ANIMATION
  // ──────────────────────────────────────────────────────────
  new MutationObserver(function (muts) {
    muts.forEach(function (mut) {
      if (mut.type !== 'attributes' || mut.attributeName !== 'class') return;
      const modal = mut.target;
      if (!modal.classList.contains('modal')) return;
      if (modal.classList.contains('open')) {
        const inner = modal.querySelector('.modal-sheet, .modal-inner, .bottom-sheet-inner, .modal-content');
        if (inner) {
          gsap.fromTo(inner,
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.35, ease: easeSoft }
          );
        }
      }
    });
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  // ──────────────────────────────────────────────────────────
  // INITIAL LOAD — sidebar + mob-nav entrance, nav indicator
  // ──────────────────────────────────────────────────────────
  window.addEventListener('load', function () {
    if (isReduced()) return;

    createNavIndicator();
    const activeNi = document.querySelector('.nav-item.active');
    if (activeNi) gsap.delayedCall(0.3, () => moveNavIndicator(activeNi));

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      gsap.fromTo(sidebar,
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, ease: ease, delay: 0.05 }
      );
    }

    const mob = document.querySelector('.mob-nav');
    if (mob) {
      gsap.fromTo(mob,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: ease, delay: 0.15 }
      );
    }
  });

})();
