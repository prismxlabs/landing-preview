/* Prism landing — mock interactions. No network calls; nothing here talks to Prism's API. */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  /* ---------- Icons: <i data-icon="name"> → inline SVG from icons.js ---------- */
  const ICONS = window.PRISM_ICONS || {};
  $$('i[data-icon]').forEach((el) => {
    const body = ICONS[el.dataset.icon];
    if (!body) return;
    const cls = ('icon ' + el.className).trim();
    el.outerHTML = `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  });

  /* ---------- Light / dark ---------- */
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  // An explicit choice (the toggle, or the host page) sets data-theme; with none, the system setting decides.
  const theme = () => {
    const a = root.getAttribute('data-theme');
    return a === 'dark' || a === 'light' ? a : (systemDark.matches ? 'dark' : 'light');
  };
  function applyTheme() {
    const t = theme();
    root.classList.toggle('is-dark', t === 'dark');
    root.classList.toggle('is-light', t === 'light');
    $$('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
    mock.repaint();
    showFilm(t);
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('prism-theme', t); } catch (e) { /* private mode: the choice lasts this visit */ }
    applyTheme();
  }
  systemDark.addEventListener('change', () => applyTheme());
  new MutationObserver(() => applyTheme()).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Hero: mock video (canvas) until a real <video> plays ---------- */
  const hero = $('.hero');
  const canvas = $('#mock-video');
  const video = $('#hero-video');
  const PALETTES = {
    dark: {
      sky: ['#000000', '#050505', '#0b0b0c', '#0e0e0f'],
      blend: 'lighter',
      blobs: ['210,210,215,.10', '150,150,155,.10', '120,120,125,.16', '200,200,200,.05', '180,180,185,.12', '235,235,235,.05'],
    },
    light: {
      sky: ['#f6f6f6', '#efefef', '#e6e6e6', '#f3f3f3'],
      blend: 'source-over',
      blobs: ['255,255,255,.85', '190,190,192,.28', '150,170,210,.24', '225,225,225,.30', '255,255,255,.7', '210,210,212,.32'],
    },
  };
  const mock = (function () {
    const ctx = canvas.getContext('2d');
    const SCALE = 0.5; // render at half resolution; the softness suits the look
    let W = 2, H = 2, raf = 0, running = false, last = 8;
    const t0 = performance.now();
    const blobs = [
      { x: .14, y: .34, r: .50, fx: .07, fy: .05, p: 0 },
      { x: .86, y: .28, r: .44, fx: .05, fy: .08, p: 1.7 },
      { x: .55, y: .86, r: .58, fx: .06, fy: .04, p: 3.1 },
      { x: .24, y: .98, r: .40, fx: .04, fy: .06, p: 4.2 },
      { x: .78, y: .90, r: .36, fx: .08, fy: .05, p: 5.3 },
      { x: .50, y: .10, r: .30, fx: .09, fy: .07, p: 2.4 },
    ];

    function size() {
      const r = hero.getBoundingClientRect();
      W = Math.max(2, Math.round(r.width * SCALE));
      H = Math.max(2, Math.round(r.height * SCALE));
      canvas.width = W; canvas.height = H;
    }

    function draw(t) {
      last = t;
      const P = PALETTES[theme()];
      ctx.globalCompositeOperation = 'source-over';
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      [0, .45, .8, 1].forEach((o, i) => sky.addColorStop(o, P.sky[i]));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = P.blend;
      const m = Math.max(W, H);
      blobs.forEach((b, i) => {
        const [r0, g0, b0, a] = P.blobs[i].split(',');
        const c = `${r0},${g0},${b0}`;
        const x = (b.x + Math.sin(t * b.fx + b.p) * .09) * W;
        const y = (b.y + Math.cos(t * b.fy + b.p) * .06) * H;
        const r = b.r * m * (1 + Math.sin(t * .1 + b.p) * .06);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${c},${a})`);
        g.addColorStop(.5, `rgba(${c},${a * .35})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });

      ctx.globalCompositeOperation = 'source-over';
    }

    function loop(now) {
      draw((now - t0) / 1000);
      if (running) raf = requestAnimationFrame(loop);
    }
    function start() { if (running || reduced) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    function repaint() { if (!running) draw(last); }

    size();
    draw(8);
    window.addEventListener('resize', () => { size(); repaint(); });
    return { start, stop, repaint };
  })();

  applyTheme();
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => setTheme(theme() === 'dark' ? 'light' : 'dark')));

  const heroObserver = new IntersectionObserver(([e]) => {
    if (hero.classList.contains('has-video')) return;
    e.isIntersecting ? mock.start() : mock.stop();
  });
  heroObserver.observe(hero);

  /* The film has a dark cut and a light cut; the one playing follows the page mode */
  function showFilm(t) {
    const src = video.dataset[t];
    if (!src || video.getAttribute('src') === src) return;
    hero.classList.remove('has-video');
    video.addEventListener('playing', useRealVideo, { once: true });
    video.src = src;
    video.play().catch(() => {});
  }
  function useRealVideo() {
    hero.classList.add('has-video');
    setTimeout(() => { if (hero.classList.contains('has-video')) mock.stop(); }, 1300);
  }

  /* ---------- Spectra bar: suggested questions, Tab / → to complete, send goes to sign-in ---------- */
  const SIGN_IN_URL = 'https://updated.prismxlabs.com/#signin';
  const form = $('#spectra-bar');
  const input = $('#spectra-input');
  const ghost = $('.bar-ghost');
  const ghostTyped = $('.ghost-typed');
  const ghostRest = $('.ghost-rest');
  const tabKey = $('.bar-tab');
  const PREFIX = 'Ask Spectra ';
  // [what the placeholder types after "Ask Spectra ", the question Tab completes to]
  const PROMPTS = [
    ["what changed in HDFC Bank's margins last quarter", "What changed in HDFC Bank's margins last quarter?"],
    ['which power stocks gain when peak demand hits a record', 'Which power stocks gain when peak demand hits a record?'],
    ['to compare TCS and Infosys deal wins over eight quarters', 'Compare TCS and Infosys deal wins over eight quarters'],
    ['to screen mid-caps where promoters are buying', 'Screen mid-caps where promoters are buying'],
    ['how UPI volumes track retail spending since 2019', 'How do UPI volumes track retail spending since 2019?'],
    ["what Reliance's management promised on the last call", "What did Reliance's management promise on the last call?"],
  ];
  // what typing can complete to (case-insensitive prefix match)
  const QUESTIONS = PROMPTS.map((p) => p[1]).concat([
    'Which sectors are FIIs buying this month?',
    'How is the monsoon tracking against normal this year?',
    'What moved Nifty Bank today?',
    'Show me IPOs opening this week',
    'Compare HDFC Bank and ICICI Bank on asset quality',
    'Which states lead GST collections growth?',
  ]);
  const typer = (function () {
    let i = 0, n = 0, dir = 1, timer = 0, paused = false;
    function tick() {
      if (paused) return;
      const full = PROMPTS[i][0];
      n += dir;
      input.placeholder = PREFIX + full.slice(0, n) + (n >= full.length ? '…' : '');
      let wait = dir > 0 ? 34 + Math.random() * 40 : 14;
      if (dir > 0 && n >= full.length) { dir = -1; wait = 2400; }
      else if (dir < 0 && n <= 0) { dir = 1; i = (i + 1) % PROMPTS.length; wait = 380; }
      timer = setTimeout(tick, wait);
    }
    return {
      start() { if (reduced) { input.placeholder = PREFIX + PROMPTS[i][0] + '…'; return; } paused = false; n = 0; dir = 1; clearTimeout(timer); timer = setTimeout(tick, 600); },
      pause() { paused = true; clearTimeout(timer); },
      question() { return PROMPTS[i][1]; },
      step(d) { i = (i + d + PROMPTS.length) % PROMPTS.length; },
    };
  })();
  typer.start();

  function completion() {
    const v = input.value;
    if (!v.trim()) return typer.question();
    const low = v.toLowerCase();
    return QUESTIONS.find((q) => q.length > v.length && q.toLowerCase().startsWith(low)) || null;
  }
  function renderGhost() {
    const v = input.value, c = completion();
    const overflowing = input.scrollWidth > input.clientWidth + 1;
    ghost.hidden = !(v && c && !overflowing);
    if (!ghost.hidden) { ghostTyped.textContent = v; ghostRest.textContent = c.slice(v.length); }
    tabKey.hidden = !c;
  }
  function complete() {
    const c = completion();
    if (!c) return false;
    input.value = c;
    input.focus();
    input.setSelectionRange(c.length, c.length);
    typer.pause();
    renderGhost();
    return true;
  }
  input.addEventListener('focus', () => { typer.pause(); if (!input.value) input.placeholder = typer.question(); renderGhost(); });
  input.addEventListener('blur', () => { if (!input.value.trim()) typer.start(); });
  input.addEventListener('input', renderGhost);
  input.addEventListener('keydown', (e) => {
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowRight' && atEnd)) {
      if (complete()) e.preventDefault();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !input.value) {
      e.preventDefault();
      typer.step(e.key === 'ArrowDown' ? 1 : -1);
      input.placeholder = typer.question();
    }
  });
  tabKey.addEventListener('click', complete);
  renderGhost();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) input.value = typer.question();
    typer.pause();
    renderGhost();
    form.classList.add('is-thinking');
    setTimeout(() => {
      form.classList.remove('is-thinking');
      if (window.top === window.self) { window.location.href = SIGN_IN_URL; return; }
      $('#signin-go').click();
      $('#bar-reply').hidden = false;
    }, reduced ? 0 : 650);
  });

  /* ---------- Dashboard / Spectra switch: a segmented control with a sliding glass thumb ---------- */
  const seg = $('.product .seg');
  const thumb = $('.seg-thumb', seg);
  const groupTabs = $$('[role="tab"]', seg);
  let thumbTimer = 0;
  function placeThumb(tab, animate) {
    if (!animate) thumb.style.transition = 'none';
    thumb.style.left = tab.offsetLeft + 'px';
    thumb.style.width = tab.offsetWidth + 'px';
    if (!animate) { void thumb.offsetWidth; thumb.style.transition = ''; return; }
    thumb.classList.add('moving');
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => thumb.classList.remove('moving'), 260);
  }
  function selectGroup(tab, focus) {
    groupTabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const group = document.getElementById(t.getAttribute('aria-controls'));
      group.hidden = !on;
      group.classList.toggle('is-active', on);
    });
    placeThumb(tab, true);
    if (focus) tab.focus();
  }
  groupTabs.forEach((t, i) => {
    t.addEventListener('click', () => selectGroup(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      selectGroup(groupTabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + groupTabs.length) % groupTabs.length], true);
    });
  });
  const activeGroupTab = () => groupTabs.find((t) => t.getAttribute('aria-selected') === 'true');
  document.fonts.ready.then(() => placeThumb(activeGroupTab(), false));
  placeThumb(activeGroupTab(), false);
  window.addEventListener('resize', () => placeThumb(activeGroupTab(), false));

  /* ---------- Feature tabs inside each group (Koyfin-style): click, arrow keys or prev/next ---------- */
  $$('.feat-group').forEach((group) => {
    const tabs = $$('.feat-tabs [role="tab"]', group);
    const row = $('.feat-tabs-wrap', group);
    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        panel.hidden = !on;
        panel.classList.toggle('is-active', on);
      });
      row.scrollTo({ left: Math.max(0, tab.offsetLeft - row.clientWidth * .3), behavior: reduced ? 'auto' : 'smooth' });
      if (focus) tab.focus();
    }
    function step(d, focus) {
      const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      select(tabs[(i + d + tabs.length) % tabs.length], focus);
    }
    tabs.forEach((t) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1, true); }
      });
    });
    $$('.feat-arrow', group).forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.step))));
  });

  /* ---------- Founder video: appears once the file exists ---------- */
  const founder = $('#founder-video');
  if (founder) {
    fetch(founder.dataset.src, { method: 'HEAD' }).then((r) => {
      if (!r.ok) return;
      founder.src = founder.dataset.src;
      founder.closest('.founder').hidden = false;
    }).catch(() => {});
  }

  /* ---------- Nav ---------- */
  const nav = $('.nav');
  const menuBtn = $('.menu-btn');
  const links = $('#nav-links');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  function setMenu(open) {
    links.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', () => setMenu(!links.classList.contains('open')));
  $$('a', links).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Glass: specular highlight follows the pointer ---------- */
  let lit = null, pending = null;
  document.addEventListener('pointermove', (e) => {
    pending = e;
    if (lit) return;
    lit = requestAnimationFrame(() => {
      lit = null;
      const g = pending.target.closest && pending.target.closest('.glass');
      if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', ((pending.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      g.style.setProperty('--my', ((pending.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }, { passive: true });

  /* ---------- Liquid glass refraction (Chromium supports SVG filters in backdrop-filter) ----------
     Each .lg element gets a displacement map shaped like its own rounded rectangle: pixels near the
     rim are pulled inward, the way the curved edge of a glass lens bends what is behind it. */
  const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some((b) => /Chromium/.test(b.brand)));
  if (chromium && !reduced) {
    const defs = $('#lg-defs');
    const NS = 'http://www.w3.org/2000/svg';
    let uid = 0;

    function radiusOf(el, w, h) {
      const br = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      return Math.min(br, w / 2, h / 2);
    }
    function displacementMap(w, h, r, bezel) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      const img = cx.createImageData(w, h);
      const d = img.data;
      const hx = w / 2, hy = h / 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + .5 - hx, py = y + .5 - hy;
          const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
          let dist, nx, ny;
          if (qx > 0 && qy > 0) {
            const l = Math.hypot(qx, qy) || 1;
            dist = r - l; nx = qx / l * Math.sign(px); ny = qy / l * Math.sign(py);
          } else if (qx > qy) { dist = r - qx; nx = Math.sign(px); ny = 0; }
          else { dist = r - qy; nx = 0; ny = Math.sign(py); }
          let m = 0;
          if (dist < bezel) { const t = 1 - Math.max(dist, 0) / bezel; m = t * t; }
          const i = (y * w + x) * 4;
          d[i] = 128 - nx * m * 127;
          d[i + 1] = 128 - ny * m * 127;
          d[i + 2] = 128;
          d[i + 3] = 255;
        }
      }
      cx.putImageData(img, 0, 0);
      return c.toDataURL();
    }
    function build(el) {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (w < 8 || h < 8) return;
      const id = el.dataset.lg || ('lg-' + (++uid));
      let f = document.getElementById(id);
      if (!f) {
        f = document.createElementNS(NS, 'filter');
        f.setAttribute('id', id);
        f.setAttribute('color-interpolation-filters', 'sRGB');
        f.innerHTML = '<feImage x="0" y="0" result="map" preserveAspectRatio="none"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/>';
        defs.appendChild(f);
      }
      const bezel = Math.min(26, h * .32);
      const fe = f.firstChild;
      fe.setAttribute('width', w); fe.setAttribute('height', h);
      fe.setAttribute('href', displacementMap(w, h, radiusOf(el, w, h), bezel));
      f.lastChild.setAttribute('scale', Math.round(bezel * 1.5));
      el.dataset.lg = id;
      el.style.setProperty('--lg-filter', `url(#${id})`);
    }
    const ro = new ResizeObserver((entries) => entries.forEach((e) => build(e.target)));
    $$('.lg').forEach((el) => ro.observe(el));
    root.classList.add('lg-on');
  }

  /* ---------- Marquee: duplicate each row once for a seamless loop ---------- */
  $$('.marquee-row').forEach((row) => {
    $$('.tag', row).forEach((t) => {
      const c = t.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      row.appendChild(c);
    });
  });

  /* ---------- Reveal on scroll ---------- */
  const revealer = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    revealer.unobserve(e.target);
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => revealer.observe(el));
})();
