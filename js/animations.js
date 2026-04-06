/* ═══════════════════════════════════════════════════════════
   FINANZAS APP — GSAP Premium Animation System v2
   Requires: gsap 3.12+ loaded before this file
═══════════════════════════════════════════════════════════ */

(function () {
  if (typeof gsap === 'undefined') return;

  const mm = gsap.matchMedia();
  const reduced = '(prefers-reduced-motion: reduce)';

  // ──────────────────────────────────────────────────────────
  // CHART.JS GLOBAL ANIMATION DEFAULTS
  // Barras crecen desde 0 con stagger entre columnas
  // Líneas se dibujan de izquierda a derecha
  // ──────────────────────────────────────────────────────────
  function applyChartDefaults () {
    if (typeof Chart === 'undefined') { setTimeout(applyChartDefaults, 200); return; }
    if (window.matchMedia(reduced).matches) return;

    // Stagger entre barras — cada barra aparece 28ms después que la anterior
    Chart.defaults.animation = {
      duration: 750,
      easing: 'easeOutQuart',
      delay: function (ctx) {
        if (ctx.type === 'data' && ctx.mode === 'default' && !ctx.dropped) {
          return ctx.dataIndex * 28;
        }
        return 0;
      }
    };

    // Barras: crecen desde 0 hacia arriba
    Chart.defaults.datasets.bar = Chart.defaults.datasets.bar || {};
    Chart.defaults.datasets.bar.animation = {
      numbers: { type: 'number', properties: ['x', 'y', 'base', 'width', 'height'] }
    };

    // Líneas: se dibujan progresivamente
    Chart.defaults.datasets.line = Chart.defaults.datasets.line || {};
    Chart.defaults.datasets.line.animation = {
      tension: {
        duration: 900,
        easing: 'easeOutCubic',
        from: 0,
        to: 0.4,
        loop: false
      }
    };

    // Doughnut: gira al entrar
    Chart.defaults.datasets.doughnut = Chart.defaults.datasets.doughnut || {};
    Chart.defaults.datasets.doughnut.animation = {
      animateRotate: true,
      animateScale: true,
      duration: 800,
      easing: 'easeOutBack'
    };
  }
  applyChartDefaults();

  const ease      = 'power3.out';
  const easeBack  = 'back.out(1.7)';
  const easeBackS = 'back.out(1.2)';
  const easeSoft  = 'power2.out';
  const easeIn    = 'power2.in';
  const easeElastic = 'elastic.out(1, 0.5)';

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

    if (window.matchMedia && window.matchMedia(reduced).matches) {
      el.textContent = formatter(num); return;
    }

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
    if (window.matchMedia && window.matchMedia(reduced).matches) {
      el.style.width = pct + '%'; return;
    }
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

    if (window.matchMedia && window.matchMedia(reduced).matches) {
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
      'position:absolute',
      'left:6px',
      'right:6px',
      'height:36px',
      'border-radius:10px',
      'background:var(--accent,rgba(100,180,255,0.13))',
      'pointer-events:none',
      'z-index:0',
      'opacity:0',
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
      gsap.set(_navIndicator, { top, opacity: 0, scaleY: 0.6 });
      gsap.to(_navIndicator, { opacity: 1, scaleY: 1, duration: 0.3, ease: easeBack });
    } else {
      gsap.to(_navIndicator, {
        top,
        height: tRect.height,
        duration: 0.38,
        ease: easeBack,
        overwrite: 'auto'
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // PATCH nav() — sliding indicator + page transition
  // ──────────────────────────────────────────────────────────
  (function patchNav () {
    const origNav = window.nav;
    if (typeof origNav !== 'function') { setTimeout(patchNav, 100); return; }

    window.nav = function (page) {
      origNav.apply(this, arguments);

      mm.add(`not ${reduced}`, () => {
        // Move indicator
        const ni = document.getElementById('ni-' + page);
        if (ni) moveNavIndicator(ni);

        // Animate page enter — fade suave, sin rebote
        const pageEl = document.getElementById('page-' + page);
        if (pageEl) {
          gsap.fromTo(pageEl,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'transform' }
          );
        }
      });
    };
  }());

  // ──────────────────────────────────────────────────────────
  // PAGE TRANSITIONS — override CSS-based animatePageEnter
  // ──────────────────────────────────────────────────────────
  window.animatePageEnter = function (pageEl) {
    if (!pageEl) return;
    pageEl.classList.remove('page-enter');

    mm.add(`not ${reduced}`, () => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.36 } });

      tl.fromTo(pageEl,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, clearProps: 'transform' }
      );

      const kids = pageEl.querySelectorAll(
        '.fade-up, .kpi-card, .dkpi, .dash-hero-card, ' +
        '.chart-card, .table-card, .dw-card, .tend-spark-card, ' +
        '.txn-summary-card, .cuota-card, .sub-card, .settings-nav-card, .rep-design-card'
      );
      if (kids.length) {
        kids.forEach(el => { el.style.animation = 'none'; });
        gsap.set(kids, { opacity: 0, y: 12 });
        tl.to(kids, {
          opacity: 1, y: 0,
          stagger: { each: 0.035, ease: 'power1.out' },
          duration: 0.34,
          ease: 'power2.out',
          clearProps: 'transform',
          onComplete() { kids.forEach(el => { el.style.animation = ''; }); }
        }, '-=0.2');
      }
    });
  };

  // ──────────────────────────────────────────────────────────
  // DASHBOARD — rich choreographed timeline
  // ──────────────────────────────────────────────────────────
  function animateDashboard () {
    const page = document.getElementById('page-dashboard');
    if (!page || !page.classList.contains('active')) return;

    mm.add(`not ${reduced}`, () => {
      const tl = gsap.timeline({ defaults: { ease, duration: 0.5 } });

      // Kill running animations on these elements
      const allEls = page.querySelectorAll(
        '.dash-hero-card, .dhc-eyebrow, .dhc-amount, ' +
        '.hero-mini-card, .hero-wide-card, .dkpi, .chart-card, .dw-card, .fade-up'
      );
      allEls.forEach(el => { el.style.animation = 'none'; });

      // ── Hero card — dramatic spring entrance
      const hero = page.querySelector('.dash-hero-card');
      if (hero) {
        gsap.set(hero, { opacity: 0, y: 28, scale: 0.97, rotateX: 4 });
        tl.to(hero, { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.65, ease: easeBack }, 0);
      }

      // ── Eyebrow + amount waterfall
      const eyebrow = page.querySelector('.dhc-eyebrow');
      const amount  = page.querySelector('.dhc-amount');
      const delta   = page.querySelector('.dhc-delta, .dhc-change');
      if (eyebrow) { gsap.set(eyebrow, { opacity: 0, y: 10 }); tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.28, clearProps: 'transform' }, 0.22); }
      if (amount)  { gsap.set(amount,  { opacity: 0, y: 14, scale: 0.94 }); tl.to(amount,  { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: easeBack, clearProps: 'transform' }, 0.3); }
      if (delta)   { gsap.set(delta,   { opacity: 0, x: -8 }); tl.to(delta,   { opacity: 1, x: 0, duration: 0.28, clearProps: 'transform' }, 0.44); }

      // ── Hero mini + wide cards
      const mini = page.querySelectorAll('.hero-mini-card, .hero-wide-card');
      if (mini.length) {
        gsap.set(mini, { opacity: 0, y: 10, scale: 0.95 });
        tl.to(mini, { opacity: 1, y: 0, scale: 1, stagger: 0.07, duration: 0.34, ease: easeBack, clearProps: 'transform' }, 0.36);
      }

      // ── KPI cards cascade
      const dkpis = page.querySelectorAll('.dkpi:not(.dash-hero-card)');
      if (dkpis.length) {
        gsap.set(dkpis, { opacity: 0, y: 22, scale: 0.95 });
        tl.to(dkpis, {
          opacity: 1, y: 0, scale: 1,
          stagger: { each: 0.06, ease: 'power1.out' },
          duration: 0.45, ease: easeBackS, clearProps: 'transform'
        }, 0.14);
      }

      // ── Chart cards slide in from bottom
      const charts = page.querySelectorAll('.chart-card');
      if (charts.length) {
        gsap.set(charts, { opacity: 0, y: 20 });
        tl.to(charts, { opacity: 1, y: 0, stagger: 0.08, duration: 0.44, clearProps: 'transform' }, 0.3);
      }

      // ── Widget row
      const widgets = page.querySelectorAll('.dw-card');
      if (widgets.length) {
        gsap.set(widgets, { opacity: 0, y: 14, scale: 0.97 });
        tl.to(widgets, {
          opacity: 1, y: 0, scale: 1,
          stagger: { each: 0.055, from: 'start' },
          duration: 0.38, ease: easeBackS, clearProps: 'transform'
        }, 0.42);
      }

      // ── Fade-up elements
      const fadeUps = page.querySelectorAll('.fade-up:not(.dkpi):not(.chart-card):not(.dw-card)');
      if (fadeUps.length) {
        gsap.set(fadeUps, { opacity: 0, y: 12 });
        tl.to(fadeUps, {
          opacity: 1, y: 0,
          stagger: { each: 0.05, ease: 'power1.out' },
          duration: 0.38, clearProps: 'transform'
        }, 0.35);
      }

      tl.call(() => { allEls.forEach(el => { el.style.animation = ''; }); });
    });
  }

  // Patch renderDashboard
  (function patchRenderDashboard () {
    const orig = window.renderDashboard;
    if (typeof orig === 'function') {
      window.renderDashboard = function () {
        orig.apply(this, arguments);
        requestAnimationFrame(() => setTimeout(animateDashboard, 80));
      };
    } else {
      setTimeout(patchRenderDashboard, 100);
    }
  }());

  // ──────────────────────────────────────────────────────────
  // TRANSACTION ROWS — stagger when list is rebuilt
  // ──────────────────────────────────────────────────────────
  function animateTransactionRows (container) {
    if (!container) return;
    mm.add(`not ${reduced}`, () => {
      const rows = container.querySelectorAll('.txn-row, .txn-item, tr[data-id], .transaction-row');
      if (!rows.length) return;
      gsap.set(rows, { opacity: 0, x: -10 });
      gsap.to(rows, {
        opacity: 1, x: 0,
        stagger: { each: 0.022, ease: 'power1.out' },
        duration: 0.3, ease: easeSoft, clearProps: 'transform',
        delay: 0.05
      });
    });
  }

  (function patchRenderTransactions () {
    const orig = window.renderTransactions;
    if (typeof orig === 'function') {
      window.renderTransactions = function () {
        orig.apply(this, arguments);
        requestAnimationFrame(() => {
          const container = document.querySelector('#page-transactions .txn-list, #page-transactions tbody, #page-transactions .transactions-container');
          animateTransactionRows(container);
        });
      };
    } else {
      setTimeout(patchRenderTransactions, 150);
    }
  }());

  // ──────────────────────────────────────────────────────────
  // TENDENCIA PAGE
  // ──────────────────────────────────────────────────────────
  (function patchRenderTendencia () {
    const orig = window.renderTendencia;
    if (typeof orig === 'function') {
      window.renderTendencia = function () {
        orig.apply(this, arguments);
        requestAnimationFrame(() => {
          mm.add(`not ${reduced}`, () => {
            const page = document.getElementById('page-tendencia');
            if (!page) return;
            const cards = page.querySelectorAll('.tend-spark-card, .chart-card, .fade-up, .kpi-card');
            if (!cards.length) return;
            gsap.set(cards, { opacity: 0, y: 18, scale: 0.97 });
            gsap.to(cards, {
              opacity: 1, y: 0, scale: 1,
              stagger: { each: 0.055, ease: 'power1.out' },
              duration: 0.42, ease: easeBackS, clearProps: 'transform',
              delay: 0.06
            });
          });
        });
      };
    } else {
      setTimeout(patchRenderTendencia, 150);
    }
  }());

  // ──────────────────────────────────────────────────────────
  // CUOTAS / COMPROMISOS PAGE
  // ──────────────────────────────────────────────────────────
  (function patchRenderCuotas () {
    const orig = window.renderCuotas;
    if (typeof orig === 'function') {
      window.renderCuotas = function () {
        orig.apply(this, arguments);
        requestAnimationFrame(() => {
          mm.add(`not ${reduced}`, () => {
            const page = document.getElementById('page-cuotas');
            if (!page) return;
            const cards = page.querySelectorAll('.cuota-card, .sub-card, .fade-up, .kpi-card');
            gsap.set(cards, { opacity: 0, y: 14 });
            gsap.to(cards, {
              opacity: 1, y: 0,
              stagger: { each: 0.045, ease: 'power1.out' },
              duration: 0.38, ease: easeSoft, clearProps: 'transform',
              delay: 0.04
            });
          });
        });
      };
    } else {
      setTimeout(patchRenderCuotas, 150);
    }
  }());

  // ──────────────────────────────────────────────────────────
  // SAVINGS PAGE
  // ──────────────────────────────────────────────────────────
  (function patchRenderSavings () {
    const orig = window.renderSavingsPage;
    if (typeof orig === 'function') {
      window.renderSavingsPage = function () {
        orig.apply(this, arguments);
        requestAnimationFrame(() => {
          mm.add(`not ${reduced}`, () => {
            const page = document.getElementById('page-savings');
            if (!page) return;
            const cards = page.querySelectorAll('.kpi-card, .chart-card, .fade-up');
            gsap.set(cards, { opacity: 0, y: 16, scale: 0.97 });
            gsap.to(cards, {
              opacity: 1, y: 0, scale: 1,
              stagger: { each: 0.055, ease: 'power1.out' },
              duration: 0.44, ease: easeBackS, clearProps: 'transform',
              delay: 0.06
            });
          });
        });
      };
    } else {
      setTimeout(patchRenderSavings, 150);
    }
  }());

  // ──────────────────────────────────────────────────────────
  // INCOME PAGE
  // ──────────────────────────────────────────────────────────
  (function patchRenderIncome () {
    const orig = window.renderIncomePage;
    if (typeof orig === 'function') {
      window.renderIncomePage = function () {
        orig.apply(this, arguments);
        requestAnimationFrame(() => {
          mm.add(`not ${reduced}`, () => {
            const page = document.getElementById('page-income');
            if (!page) return;
            const cards = page.querySelectorAll('.kpi-card, .chart-card, .fade-up, .table-card');
            gsap.set(cards, { opacity: 0, y: 14 });
            gsap.to(cards, {
              opacity: 1, y: 0,
              stagger: { each: 0.05, ease: 'power1.out' },
              duration: 0.4, ease: easeSoft, clearProps: 'transform',
              delay: 0.05
            });
          });
        });
      };
    } else {
      setTimeout(patchRenderIncome, 150);
    }
  }());

  // ──────────────────────────────────────────────────────────
  // REPORTS PAGE
  // ──────────────────────────────────────────────────────────
  (function patchRenderReportes () {
    const orig = window.renderReportesPage;
    if (typeof orig === 'function') {
      window.renderReportesPage = function () {
        orig.apply(this, arguments);
        requestAnimationFrame(() => {
          mm.add(`not ${reduced}`, () => {
            const page = document.getElementById('page-reportes');
            if (!page) return;
            const cards = page.querySelectorAll('.rep-design-card, .chart-card, .kpi-card, .fade-up');
            gsap.set(cards, { opacity: 0, y: 18, scale: 0.97 });
            gsap.to(cards, {
              opacity: 1, y: 0, scale: 1,
              stagger: { each: 0.06, ease: 'power1.out' },
              duration: 0.44, ease: easeBackS, clearProps: 'transform',
              delay: 0.06
            });
          });
        });
      };
    } else {
      setTimeout(patchRenderReportes, 150);
    }
  }());

  // ──────────────────────────────────────────────────────────
  // PERIOD CHANGE TRANSITION
  // Al cambiar Mes ↔ Ciclo TC, o seleccionar otro mes/ciclo,
  // los KPIs hacen fade-out rápido y vuelven contando desde cero
  // ──────────────────────────────────────────────────────────
  function animatePeriodChange (origFn, args) {
    // Llamar la función original INMEDIATAMENTE — sin delay de fade-out
    origFn.apply(window, args);

    const page = document.getElementById('page-dashboard');
    if (!page || window.matchMedia(reduced).matches) return;

    // Animar la entrada de los elementos actualizados
    requestAnimationFrame(() => {
      const targets = page.querySelectorAll(
        '.dkpi, .kpi-card, .dash-hero-card, .dhc-amount, ' +
        '.hero-mini-card, .hero-wide-card, .chart-card, .dw-card'
      );
      if (!targets.length) return;
      gsap.fromTo(targets,
        { opacity: 0.4, y: 8, scale: 0.988 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.38,
          ease: 'power2.out',
          stagger: { each: 0.025, ease: 'power1.out' },
          clearProps: 'transform',
          overwrite: 'auto'
        }
      );
    });
  }

  (function patchPeriodFunctions () {
    // setDashView — cambia Mes ↔ Ciclo TC
    const origSetDashView = window.setDashView;
    if (typeof origSetDashView === 'function') {
      window.setDashView = function (mode) {
        animatePeriodChange(origSetDashView, [mode]);
      };
    } else {
      setTimeout(patchPeriodFunctions, 150);
      return;
    }

    // setDashMonthFromSelect — cambia el mes/ciclo del selector
    const origSetDashMonth = window.setDashMonthFromSelect;
    if (typeof origSetDashMonth === 'function') {
      window.setDashMonthFromSelect = function (val) {
        animatePeriodChange(origSetDashMonth, [val]);
      };
    }
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
    if (window.matchMedia(reduced).matches) return;
    for (const { sel, y, s } of LIFT_TARGETS) {
      const el = e.target.closest(sel);
      if (el) {
        gsap.to(el, {
          y, scale: s,
          duration: 0.24,
          ease: easeSoft,
          overwrite: 'auto'
        });
        // Subtle inner glow on shadow
        gsap.to(el, { '--card-glow': '1', duration: 0.24, overwrite: 'auto' });
        break;
      }
    }
  });

  document.addEventListener('mouseout', function (e) {
    if (window.matchMedia(reduced).matches) return;
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
    if (window.matchMedia(reduced).matches) return;
    const el = e.target.closest(PRESS_SEL);
    if (el) gsap.to(el, { scale: 0.958, duration: 0.1, ease: easeIn, overwrite: 'auto' });
  });

  document.addEventListener('mouseup', function (e) {
    if (window.matchMedia(reduced).matches) return;
    const el = e.target.closest(PRESS_SEL);
    if (el) gsap.to(el, { scale: 1, duration: 0.3, ease: easeBack, overwrite: 'auto', clearProps: 'transform' });
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
            { opacity: 0, y: 22, scale: 0.88 },
            { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: easeBack }
          );
        }
      });
      // Also watch for class 'show' being added
      if (mut.type === 'attributes' && mut.attributeName === 'class') {
        const el = mut.target;
        if (el.classList.contains('toast') && el.classList.contains('show')) {
          gsap.killTweensOf(el);
          gsap.fromTo(el,
            { opacity: 0, y: 18, scale: 0.9 },
            { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: easeBack }
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
        // Backdrop fade
        gsap.fromTo(modal,
          { backgroundColor: 'rgba(0,0,0,0)' },
          { backgroundColor: 'rgba(0,0,0,0.55)', duration: 0.3, ease: 'power2.out' }
        );
        const inner = modal.querySelector('.modal-sheet, .modal-inner, .bottom-sheet-inner, .modal-content');
        if (inner) {
          gsap.fromTo(inner,
            { opacity: 0, y: 32, scale: 0.94 },
            { opacity: 1, y: 0, scale: 1, duration: 0.44, ease: easeBack }
          );
        }
      } else {
        // Closing
        const inner = modal.querySelector('.modal-sheet, .modal-inner, .bottom-sheet-inner, .modal-content');
        if (inner) {
          gsap.to(inner, { opacity: 0, y: 20, scale: 0.96, duration: 0.22, ease: easeIn });
        }
      }
    });
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  // ──────────────────────────────────────────────────────────
  // SIDEBAR COLLAPSE ANIMATION
  // ──────────────────────────────────────────────────────────
  (function patchToggleSidebar () {
    const orig = window.toggleSidebar;
    if (typeof orig !== 'function') { setTimeout(patchToggleSidebar, 200); return; }

    window.toggleSidebar = function () {
      orig.apply(this, arguments);
      mm.add(`not ${reduced}`, () => {
        const sidebar = document.querySelector('.sidebar');
        const openBtn = document.getElementById('sidebar-open-btn');
        if (sidebar) {
          const isCollapsed = sidebar.classList.contains('collapsed') ||
                              sidebar.style.display === 'none' ||
                              parseInt(getComputedStyle(sidebar).width) < 80;
          if (isCollapsed) {
            // Just opened
            gsap.fromTo(sidebar, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: easeBack });
          }
        }
        if (openBtn) {
          gsap.fromTo(openBtn, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.32, ease: easeBack });
        }
      });
    };
  }());

  // ──────────────────────────────────────────────────────────
  // SPLASH SCREEN GSAP TIMELINE
  // ──────────────────────────────────────────────────────────
  (function patchSplash () {
    function animateSplash () {
      const splash = document.getElementById('splash');
      if (!splash || splash.style.display === 'none') return;

      mm.add(`not ${reduced}`, () => {
        const inner  = splash.querySelector('.sp-inner, .splash-inner');
        const logo   = splash.querySelector('.sp-logo, .splash-logo, .logo');
        const title  = splash.querySelector('.sp-title, .splash-title, h1, h2');
        const sub    = splash.querySelector('.sp-sub, .splash-sub, .sp-greeting, p');
        const items  = splash.querySelectorAll('.sp-item, .sp-stat, .sp-section, .sp-row');
        const btn    = splash.querySelector('.sp-btn, .btn, button');

        const tl = gsap.timeline({ defaults: { ease, duration: 0.45 } });

        if (inner) {
          gsap.set(inner, { opacity: 0, y: 30, scale: 0.97 });
          tl.to(inner, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: easeBack }, 0);
        }
        if (logo)  { gsap.set(logo,  { opacity: 0, scale: 0.7 }); tl.to(logo,  { opacity: 1, scale: 1, duration: 0.4, ease: easeElastic }, 0.1); }
        if (title) { gsap.set(title, { opacity: 0, y: 14 });       tl.to(title, { opacity: 1, y: 0, duration: 0.35, clearProps: 'transform' }, 0.25); }
        if (sub)   { gsap.set(sub,   { opacity: 0, y: 10 });       tl.to(sub,   { opacity: 1, y: 0, duration: 0.3,  clearProps: 'transform' }, 0.35); }
        if (items.length) {
          gsap.set(items, { opacity: 0, y: 14 });
          tl.to(items, {
            opacity: 1, y: 0,
            stagger: { each: 0.07, ease: 'power1.out' },
            duration: 0.36, clearProps: 'transform'
          }, 0.4);
        }
        if (btn)   { gsap.set(btn,   { opacity: 0, y: 10, scale: 0.95 }); tl.to(btn, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: easeBack, clearProps: 'transform' }, 0.6); }
      });
    }

    // Watch for splash becoming visible
    new MutationObserver(function (muts) {
      muts.forEach(function (mut) {
        if (mut.type === 'attributes' && mut.attributeName === 'style') {
          const splash = mut.target;
          if (splash.id === 'splash' && splash.style.display !== 'none') {
            requestAnimationFrame(() => animateSplash());
          }
        }
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });

    // Also try on load
    window.addEventListener('load', () => setTimeout(animateSplash, 200));
  }());

  // ──────────────────────────────────────────────────────────
  // INITIAL LOAD — sidebar, mob-nav, dashboard boot
  // ──────────────────────────────────────────────────────────
  window.addEventListener('load', function () {
    mm.add(`not ${reduced}`, () => {
      // Create nav indicator
      createNavIndicator();
      // Position indicator on active nav item
      const activeNi = document.querySelector('.nav-item.active');
      if (activeNi) {
        gsap.delayedCall(0.3, () => moveNavIndicator(activeNi));
      }

      // Sidebar entrance
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        gsap.fromTo(sidebar,
          { x: -24, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.6, ease: ease, delay: 0.06 }
        );
      }

      // Mobile nav
      const mob = document.querySelector('.mob-nav');
      if (mob) {
        gsap.fromTo(mob,
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.52, ease: ease, delay: 0.18 }
        );
      }

      // Dashboard
      setTimeout(animateDashboard, 420);

      // ── Notification panel
      const origToggleNotif = window.toggleNotifPanel;
      if (typeof origToggleNotif === 'function') {
        window.toggleNotifPanel = function () {
          origToggleNotif.apply(this, arguments);
          const panel = document.getElementById('notif-panel');
          if (panel && panel.style.display !== 'none') {
            gsap.fromTo(panel,
              { opacity: 0, y: -14, scale: 0.96 },
              { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: easeBack }
            );
          }
        };
      }

      // ── Global search
      const origOpenSearch = window.openGlobalSearch;
      if (typeof origOpenSearch === 'function') {
        window.openGlobalSearch = function () {
          origOpenSearch.apply(this, arguments);
          requestAnimationFrame(function () {
            const box = document.querySelector('.global-search-box, #global-search-modal .modal-sheet');
            if (box) {
              gsap.fromTo(box,
                { opacity: 0, y: -18, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: easeBack }
              );
            }
          });
        };
      }
    });
  });

})();
