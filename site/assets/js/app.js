/* Projects Portfolio — vanilla port of the Claude Design "Projects Portfolio v2"
 * component. Content comes from data/projects.json, which
 * scripts/update_portfolio.py regenerates from the GitBook page. */
(() => {
  'use strict';

  const CYCLE_MS = 3600; // hero dot-form cycle (design prop `cycle`, default 3.6s)
  const ICONS = { 'Data Visualization': 'insights', 'AI / LLM': 'auto_awesome', 'Internal Analytics': 'dashboard' };
  const TYPE_ORDER = ['Data Visualization', 'AI / LLM', 'Internal Analytics'];
  const WHITE = 'rgba(255,255,255,0.95)', DIM = 'rgba(255,255,255,0.28)', TINT = 'rgba(178,214,242,0.95)', YEL = 'rgba(255,196,82,1)';
  const FORM_NAMES = ['Comparisons', 'Trends', 'Distributions', 'Shares', 'Indicators'];
  const N = 240;

  const root = document.documentElement;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reduced;
  root.classList.add('js');
  if (motion) root.classList.add('motion');

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  const pad2 = (n) => ('0' + n).slice(-2);
  const icon = (type) => ICONS[type] || 'category';
  const isWide = () => window.innerWidth >= 960;
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const state = { projects: [], filter: 'All', list: [], active: -1 };

  /* ---------------------------------------------------------------- data */

  fetch('data/projects.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch((err) => {
      console.error('[portfolio] could not load data/projects.json', err);
      $('#chapters').innerHTML = '<p class="noscript">The project list could not be loaded. See the portfolio on <a href="https://unesco.gitbook.io/unesco-data-ai/projects-portfolio">GitBook</a>.</p>';
    });

  function init(doc) {
    state.projects = doc.projects.map((p, i) => ({
      ...p, i,
      url: safeUrl(p.url),
      links: (p.links || []).filter((l) => safeUrl(l.href)),
    }));
    renderCaps(doc.capabilities || []);
    renderFilters();
    renderStory();
    renderGrid();
    renderUpdated(doc);
    bindScroll();
    initCanvases();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('mounted')));
    if (location.hash.startsWith('#p-')) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView(), 50);
    }
  }

  function types() {
    const present = [...new Set(state.projects.map((p) => p.type))];
    return ['All', ...TYPE_ORDER.filter((t) => present.includes(t)), ...present.filter((t) => !TYPE_ORDER.includes(t))];
  }

  function domainOf(p) {
    if (!p.url) return /power\s*bi/i.test(p.access) ? 'Power BI · internal dashboard' : 'Internal access';
    return p.url.replace(/^https?:\/\//, '').split(/[?#]/)[0].split('/').filter(Boolean).slice(0, 3).join('/');
  }

  function shot(p, eager) {
    return p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)}"${eager ? '' : ' loading="lazy"'}>`
      : '<div class="placeholder"><span class="material-icons" aria-hidden="true">insights</span><span>Visual to be added</span></div>';
  }

  /* ------------------------------------------------------------- render */

  function renderCaps(caps) {
    const bySlug = Object.fromEntries(state.projects.map((p) => [p.slug, p]));
    $('#caps').innerHTML = caps.map((c, k) => {
      const chips = c.projects.map((s) => bySlug[s]).filter(Boolean)
        .map((p) => `<button class="chip" type="button" data-go="${esc(p.slug)}">${esc(p.short || p.name)}</button>`).join('');
      return `<article class="cap">
        <canvas data-cap="${k % 4}" aria-hidden="true"></canvas>
        <div class="cap-body">
          <div class="cap-kicker"><span class="material-icons" aria-hidden="true">${esc(c.icon)}</span><span>${pad2(k + 1)}</span></div>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.body)}</p>
          <div class="chips">${chips}</div>
        </div>
      </article>`;
    }).join('');
  }

  function renderFilters() {
    $('#filters').innerHTML = types().map((t) => {
      const n = t === 'All' ? state.projects.length : state.projects.filter((p) => p.type === t).length;
      return `<button class="filter" type="button" data-filter="${esc(t)}" aria-pressed="${t === state.filter}">${esc(t === 'All' ? 'All projects' : t)}<span class="count">${n}</span></button>`;
    }).join('');
  }

  function renderStory() {
    const list = state.list = state.projects.filter((p) => state.filter === 'All' || p.type === state.filter);
    const total = pad2(state.projects.length);

    $('#chapters').innerHTML = list.map((p) => {
      const body = (p.description || []).map((b) => b.ul
        ? `<ul>${b.ul.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`
        : `<p>${esc(b.p)}</p>`).join('');
      const fig = p.fig ? `<div class="inline-fig"><b>${esc(p.fig.text)}</b><span>${esc(p.fig.label)}</span></div>` : '';
      const open = p.url
        ? `<a class="btn btn-blue btn-md" href="${esc(p.url)}" target="_blank" rel="noopener">Open project<span class="material-icons" aria-hidden="true">arrow_forward</span></a>`
        : `<div class="btn btn-muted btn-md"><span class="material-icons" aria-hidden="true">lock</span>${esc(/power\s*bi/i.test(p.access) ? 'Power BI · internal access' : 'Internal access')}</div>`;
      const links = (p.links || []).map((l) => `<a class="ext" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}<span class="material-icons" aria-hidden="true">open_in_new</span></a>`).join('');
      return `<article class="chapter" id="p-${esc(p.slug)}">
        ${p.img ? `<div class="shot">${shot(p)}</div>` : ''}
        <div class="chapter-kicker"><span class="num">${pad2(p.i + 1)} / ${total}</span><span class="type"><span class="material-icons" aria-hidden="true">${icon(p.type)}</span>${esc(p.type)}</span></div>
        <h3>${esc(p.name)}</h3>
        ${fig}
        ${body}
        <div class="chapter-actions">${open}${links}</div>
      </article>`;
    }).join('');

    $('#panels').innerHTML = list.map((p, k) => `<div class="panel" data-k="${k}">${shot(p, k === 0)}</div>`).join('');
    $('#rail').innerHTML = list.map((p, k) => `<button type="button" data-rail="${k}" title="${esc(p.name)}" tabindex="-1"><span></span></button>`).join('');
    state.active = -1;
    setActive(0);
  }

  function renderGrid() {
    $('#all-count').textContent = `${state.projects.length} projects`;
    $('#grid').innerHTML = state.projects.map((p) => {
      const ext = !!p.url;
      return `<a class="tile" href="${ext ? esc(p.url) : '#p-' + esc(p.slug)}"${ext ? ' target="_blank" rel="noopener"' : ` data-go="${esc(p.slug)}"`}>
        <div class="tile-shot">${shot(p)}<div class="tile-badge"><span class="material-icons" aria-hidden="true">${ext ? 'open_in_new' : 'arrow_upward'}</span></div></div>
        <div class="tile-kicker"><span class="num">${pad2(p.i + 1)}</span><span class="material-icons" aria-hidden="true">${icon(p.type)}</span>${esc(p.type)}</div>
        <h3>${esc(p.name)}</h3>
      </a>`;
    }).join('');
  }

  function renderUpdated(doc) {
    if (!doc.updated) return;
    const d = new Date(doc.updated);
    const when = isNaN(d) ? doc.updated : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    $('#updated').innerHTML = `Synced from <a href="${esc(doc.source)}" target="_blank" rel="noopener">GitBook</a> · ${esc(when)}`;
  }

  /* ------------------------------------------------ active chapter / stage */

  let figTimer, countRaf;
  function setActive(a) {
    if (a === state.active || !state.list.length) return;
    state.active = a;
    const cur = state.list[a];
    document.querySelectorAll('.chapter').forEach((el, k) => el.classList.toggle('on', k === a));
    document.querySelectorAll('.panel').forEach((el, k) => el.classList.toggle('on', k === a));
    document.querySelectorAll('#rail button').forEach((el, k) => {
      el.classList.toggle('now', k === a);
      el.classList.toggle('past', k < a);
    });
    $('#stage-domain').textContent = domainOf(cur);
    $('#stage-icon').textContent = cur.url ? 'lock' : 'bar_chart';

    const card = $('#fig-card'), fig = cur.fig;
    card.hidden = !fig;
    if (!fig) return;
    card.classList.add('out');
    clearTimeout(figTimer);
    figTimer = setTimeout(() => card.classList.remove('out'), 180);
    $('#fig-label').textContent = fig.label || '';
    const out = $('#fig-value');
    cancelAnimationFrame(countRaf);
    if (fig.value == null || !motion) { out.textContent = fig.text; return; }
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0 - 180) / 900), e = k <= 0 ? 0 : 1 - Math.pow(1 - k, 3);
      out.textContent = Math.round(fig.value * e) + (fig.suffix || '');
      if (k < 1) countRaf = requestAnimationFrame(tick);
    };
    out.textContent = '0' + (fig.suffix || '');
    countRaf = requestAnimationFrame(tick);
  }

  function goTo(k) {
    const el = document.querySelectorAll('.chapter')[k];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * (isWide() ? 0.3 : 0) - (isWide() ? 0 : 88);
    window.scrollTo({ top: y, behavior: motion ? 'smooth' : 'auto' });
  }

  function goToProject(slug) {
    let k = state.list.findIndex((p) => p.slug === slug);
    if (k < 0) {
      state.filter = 'All';
      renderFilters();
      renderStory();
      k = state.list.findIndex((p) => p.slug === slug);
    }
    goTo(k);
  }

  function bindScroll() {
    document.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { e.preventDefault(); goToProject(go.dataset.go); return; }
      const f = e.target.closest('[data-filter]');
      if (f) { state.filter = f.dataset.filter; renderFilters(); renderStory(); onScroll(); return; }
      const r = e.target.closest('[data-rail]');
      if (r) goTo(+r.dataset.rail);
    });

    const how = $('#how');
    let ticking = false;
    function onScroll() {
      const mid = window.innerHeight * 0.5;
      let a = 0;
      document.querySelectorAll('.chapter').forEach((el, i) => { if (el.getBoundingClientRect().top < mid) a = i; });
      setActive(a);
      if (!how.classList.contains('in') && how.getBoundingClientRect().top < window.innerHeight * 0.8) how.classList.add('in');
    }
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; onScroll(); });
    }, { passive: true });
    window.addEventListener('resize', onScroll);
    setTimeout(onScroll, 300);
  }

  /* ------------------------------------------------------------ canvases */

  function buildForms(a) {
    const F = [];
    const hs = [.42, .58, .5, .72, .64, .8, .7, .88, .76, .94, .84, 1], tot = hs.reduce((x, y) => x + y);
    const cnt = hs.map((h) => Math.round(h / tot * N)); cnt[11] += N - cnt.reduce((x, y) => x + y);
    const bars = [];
    cnt.forEach((c, b) => { for (let k = 0; k < c; k++) bars.push({ x: (b + .5) / 12 + ((k % 2) - .5) * .026, y: .97 - Math.floor(k / 2) * .066, c: b === 11 ? YEL : WHITE }); });
    F.push(bars);
    F.push(Array.from({ length: N }, (_, i) => { const s = i % 2, x = Math.floor(i / 2) / 119; return s ? { x, y: .82 - .62 * x + .07 * Math.sin(x * 11), c: YEL } : { x, y: .9 - .3 * x + .05 * Math.cos(x * 8), c: WHITE }; }));
    const cl = [[.22, .62, .085, WHITE], [.55, .34, .07, TINT], [.82, .7, .05, YEL]];
    F.push(Array.from({ length: N }, (_, i) => { const k = i < 110 ? 0 : i < 200 ? 1 : 2, u = Math.max(1e-4, rnd(i * 3 + 1)), v = rnd(i * 7 + 2), r = Math.sqrt(-2 * Math.log(u)) * cl[k][2]; return { x: cl[k][0] + r * Math.cos(6.283 * v) / a, y: cl[k][1] + r * Math.sin(6.283 * v), c: cl[k][3] }; }));
    const segs = [[.44, WHITE], [.27, TINT], [.17, DIM], [.12, YEL]];
    F.push(Array.from({ length: N }, (_, i) => { const f = i / N; let acc = 0, col = WHITE; for (const [p, c] of segs) { if (f < acc + p) { col = c; break; } acc += p; } const ang = -Math.PI / 2 + (f + segs.findIndex((s) => s[1] === col) * .006) * 6.283; const ring = .33 + (i % 3) * .045; return { x: .5 + ring * Math.cos(ang) / a, y: .5 + ring * Math.sin(ang), c: col }; }));
    F.push(Array.from({ length: N }, (_, i) => { const c = i % 20, r = Math.floor(i / 20); const cell = Math.min(1 / 20, (1 / 12) / a); return { x: .5 + (c - 9.5) * cell, y: .5 + (r - 5.5) * cell * a, c: i < 38 ? YEL : i < 150 ? WHITE : DIM }; }));
    return F;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const lerpC = (v) => `rgb(${Math.round(241 - 241 * v)},${Math.round(244 - 125 * v)},${Math.round(246 - 34 * v)})`;

  function fit(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return null;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv._resized = true; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    return { ctx, W, H };
  }

  const hero = { cv: null, pts: null, forms: null, key: '', mouse: { x: -9999, y: -9999 }, t0: 0 };

  function drawHero(t) {
    const f = fit(hero.cv); if (!f) return;
    const { ctx, W, H } = f;
    const wide = W >= 960, cw = Math.min(W, 1440), ox = (W - cw) / 2, g = Math.min(78, W * .054);
    const R = wide ? { x: ox + cw * .53, y: H * .2, w: cw * .47 - g, h: H * .56 } : { x: 24, y: H * .6, w: W - 48, h: H * .28 };
    const key = W + 'x' + H;
    if (hero.key !== key) { hero.forms = buildForms(R.w / R.h); hero.key = key; }
    const el = t - hero.t0, fi = motion ? Math.floor(el / CYCLE_MS) % hero.forms.length : 0, prog = motion ? (el % CYCLE_MS) / CYCLE_MS : 1;
    const F = hero.forms[fi];
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    if (fi <= 1) { ctx.beginPath(); ctx.moveTo(R.x, R.y + R.h + 8); ctx.lineTo(R.x + R.w, R.y + R.h + 8); ctx.stroke(); }
    const rad = wide ? 3.2 : 2.4;
    for (let i = 0; i < N; i++) {
      const p = hero.pts[i], fp = F[i];
      let tx = R.x + fp.x * R.w, ty = R.y + fp.y * R.h;
      const dx = tx - hero.mouse.x, dy = ty - hero.mouse.y, d = Math.hypot(dx, dy);
      if (d < 90) { const push = (1 - d / 90) * 26; tx += dx / (d || 1) * push; ty += dy / (d || 1) * push; }
      if (motion) { p.x += (tx - p.x) * p.k; p.y += (ty - p.y) * p.k; } else { p.x = tx; p.y = ty; }
      if (Math.hypot(tx - p.x, ty - p.y) < 40) p.c = fp.c;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283); ctx.fill();
    }
    const ly = R.y + R.h + 40;
    ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText(pad2(fi + 1) + '  ' + FORM_NAMES[fi].toUpperCase(), R.x, ly);
    const bw = Math.min(160, R.w * .3);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(R.x + R.w - bw, ly - 5, bw, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(R.x + R.w - bw, ly - 5, bw * prog, 2);
  }

  const CAPS = [
    function cap0(ctx, W, H, t) {
      const cols = 16, rows = 8, cell = Math.min((W - 48) / cols, (H - 48) / rows), ox = (W - cell * cols) / 2, oy = (H - cell * rows) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const edge = Math.hypot((c - 7.5) / 8, (r - 3.5) / 4.2); if (edge > 1.02 + .12 * Math.sin(c * 1.7 + r)) continue;
        const v = .5 + .5 * Math.sin(c * .55 + t * .0011) * Math.cos(r * .8 - t * .0008);
        ctx.fillStyle = lerpC(.15 + v * .85); ctx.beginPath(); ctx.arc(ox + (c + .5) * cell, oy + (r + .5) * cell, cell * .38, 0, 6.283); ctx.fill();
      }
      const hc = Math.floor((t / 900) % cols), hr = 3 + Math.round(Math.sin(t / 1400) * 2);
      ctx.strokeStyle = YEL; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + (hc + .5) * cell, oy + (hr + .5) * cell, cell * .5, 0, 6.283); ctx.stroke();
    },
    function cap1(ctx, W, H, t) {
      const p = t % 6500, pad = 20, bw = W - pad * 2;
      const a1 = Math.min(1, Math.max(0, (p - 200) / 300));
      ctx.globalAlpha = a1; ctx.fillStyle = '#0077D4'; rr(ctx, pad + bw * .38, 22, bw * .62, 36, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; rr(ctx, pad + bw * .38 + 14, 36, bw * .62 - 60, 8, 4); ctx.fill(); ctx.globalAlpha = 1;
      if (p > 900 && p < 1900) { for (let i = 0; i < 3; i++) { ctx.fillStyle = '#7F888F'; ctx.beginPath(); ctx.arc(pad + 16 + i * 12, 86 - Math.max(0, Math.sin((p / 140) - i)) * 4, 3.5, 0, 6.283); ctx.fill(); } }
      if (p >= 1900) {
        const k = Math.min(1, (p - 1900) / 1600), bh = 92;
        ctx.fillStyle = '#fff'; rr(ctx, pad, 70, bw * .86, bh, 8); ctx.fill();
        [.82, .74, .5].forEach((w, i) => { const lk = Math.min(1, Math.max(0, k * 3 - i)); if (lk > 0) { ctx.fillStyle = '#D5DADD'; rr(ctx, pad + 14, 86 + i * 16, (bw * .86 - 28) * w * lk, 8, 4); ctx.fill(); } });
        if (p > 3600) {
          const ca = Math.min(1, (p - 3600) / 300); ctx.globalAlpha = ca; ctx.font = '600 11px Inter, sans-serif';
          const txt = 'Source · chapter & page', tw = ctx.measureText(txt).width + 20;
          ctx.strokeStyle = '#0077D4'; ctx.lineWidth = 1; rr(ctx, pad + 14, 136, tw, 18, 9); ctx.stroke(); ctx.fillStyle = '#0077D4'; ctx.fillText(txt, pad + 24, 149); ctx.globalAlpha = 1;
        }
      }
    },
    function cap2(ctx, W, H, t) {
      const p = (t % 5200) / 5200, pad = 20, cw = (W - pad * 2 - 16) / 3;
      for (let i = 0; i < 3; i++) {
        const x = pad + i * (cw + 8); ctx.fillStyle = '#fff'; rr(ctx, x, 18, cw, 44, 6); ctx.fill();
        ctx.fillStyle = i === 0 ? '#0077D4' : '#212121'; ctx.font = '800 16px Inter, sans-serif';
        ctx.fillText(String(Math.round([72, 38, 91][i] * Math.min(1, p * 2.2))) + (i === 2 ? '%' : ''), x + 10, 46);
        ctx.fillStyle = '#D5DADD'; rr(ctx, x + 10, 52, cw * .5, 4, 2); ctx.fill();
      }
      const lx = pad, ly = 76, lw = (W - pad * 2) * .58, lh = H - ly - 18;
      ctx.fillStyle = '#fff'; rr(ctx, lx, ly, lw, lh, 6); ctx.fill();
      const k = Math.min(1, p * 1.6); ctx.strokeStyle = '#0077D4'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 40 * k; i++) { const x = i / 40, y = .75 - .5 * x + .1 * Math.sin(x * 9); const px = lx + 10 + x * (lw - 20), py = ly + 10 + y * (lh - 20); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
      const bx = lx + lw + 8, bwid = W - pad - bx; ctx.fillStyle = '#fff'; rr(ctx, bx, ly, bwid, lh, 6); ctx.fill();
      const hs = [.5, .8, .35, .65, .95];
      hs.forEach((h, i) => { const g = Math.min(1, Math.max(0, p * 2.4 - i * .12)), bb = (bwid - 20) / hs.length; ctx.fillStyle = i === 4 ? YEL : '#115A9E'; const bh2 = (lh - 20) * h * g; ctx.fillRect(bx + 10 + i * bb + 2, ly + lh - 10 - bh2, bb - 4, bh2); });
    },
    function cap3(ctx, W, H, t) {
      const p = t % 6000, pad = 20, word = 'heritage', typed = word.slice(0, Math.max(0, Math.min(word.length, Math.floor((p - 400) / 120))));
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#D5DADD'; ctx.lineWidth = 1; rr(ctx, pad, 16, W - pad * 2, 32, 4); ctx.fill(); ctx.stroke();
      ctx.font = '400 13px Inter, sans-serif'; ctx.fillStyle = '#212121'; ctx.fillText(typed, pad + 12, 36);
      if (Math.floor(p / 400) % 2 && typed.length < word.length) ctx.fillRect(pad + 13 + ctx.measureText(typed).width, 25, 1, 14);
      const f = Math.min(1, Math.max(0, (p - 1500) / 500)), match = [1, 4];
      for (let i = 0; i < 6; i++) {
        const m = match.includes(i), y = 58 + i * 22; ctx.globalAlpha = m ? 1 : 1 - f * .8;
        ctx.fillStyle = m && f > 0 ? '#fff' : 'rgba(255,255,255,.6)'; rr(ctx, pad, y, W - pad * 2, 18, 4); ctx.fill();
        ctx.fillStyle = m && f > 0 ? '#0077D4' : '#B1BABE'; ctx.beginPath(); ctx.arc(pad + 10, y + 9, 3, 0, 6.283); ctx.fill();
        ctx.fillStyle = m && f > 0 ? '#4C5054' : '#D5DADD'; rr(ctx, pad + 22, y + 6, (W - pad * 2) * (.35 + rnd(i) * .3), 6, 3); ctx.fill();
        rr(ctx, W - pad - 50, y + 6, 36, 6, 3); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  ];

  function initCanvases() {
    hero.cv = $('#hero-canvas');
    hero.pts = Array.from({ length: N }, (_, i) => ({ x: rnd(i) * 1600, y: rnd(i + 999) * 700, k: .045 + rnd(i + 50) * .05, c: WHITE }));
    hero.t0 = performance.now();
    const host = hero.cv.parentElement;
    host.addEventListener('mousemove', (e) => { const b = hero.cv.getBoundingClientRect(); hero.mouse.x = e.clientX - b.left; hero.mouse.y = e.clientY - b.top; });
    host.addEventListener('mouseleave', () => { hero.mouse.x = hero.mouse.y = -9999; });

    const caps = [...document.querySelectorAll('canvas[data-cap]')];
    // Only animate canvases that are on screen.
    const visible = new Set();
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => entries.forEach((en) => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target))))
      : null;
    [hero.cv, ...caps].forEach((c) => (io ? io.observe(c) : visible.add(c)));

    const drawCaps = (t) => caps.forEach((cv) => {
      if (!visible.has(cv) && motion) return;
      const f = fit(cv); if (f) CAPS[+cv.dataset.cap](f.ctx, f.W, f.H, t);
    });

    if (!motion) {
      const still = () => { drawHero(performance.now()); drawCaps(99999); };
      setTimeout(still, 300);
      window.addEventListener('resize', still);
      if (document.fonts) document.fonts.ready.then(still);
      return;
    }
    const loop = (t) => {
      if (visible.has(hero.cv)) drawHero(t);
      drawCaps(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
