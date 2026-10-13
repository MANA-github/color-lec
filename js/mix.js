(function () {
  'use strict';

  const stage = document.getElementById('mixStage');
  const readoutEl = document.getElementById('mixReadout');
  const optionsEl = document.getElementById('mixOptions');
  const modeBtns = document.querySelectorAll('#mixMode button');

  const DEFAULTS = {
    rgb: [
      { key: 'R', name: '赤', ch: 0, x: 0.22, y: 0.30, v: 255 },
      { key: 'G', name: '緑', ch: 1, x: 0.78, y: 0.30, v: 255 },
      { key: 'B', name: '青', ch: 2, x: 0.50, y: 0.74, v: 255 },
    ],
    cmy: [
      { key: 'C', name: 'シアン', ch: 0, x: 0.22, y: 0.30, v: 255 },
      { key: 'M', name: 'マゼンタ', ch: 1, x: 0.78, y: 0.30, v: 255 },
      { key: 'Y', name: 'イエロー', ch: 2, x: 0.50, y: 0.74, v: 255 },
    ],
    probe: { x: 0.5, y: 0.42 },
  };


  const clone = o => JSON.parse(JSON.stringify(o));
  const state = {
    mode: 'rgb',
    cards: { rgb: clone(DEFAULTS.rgb), cmy: clone(DEFAULTS.cmy) },
    probe: { rgb: clone(DEFAULTS.probe), cmy: clone(DEFAULTS.probe) },
  };
  const els = { cards: [], probe: null };

  function cardRGB(mode, c) {
    const out = mode === 'rgb' ? [0, 0, 0] : [255, 255, 255];
    out[c.ch] = mode === 'rgb' ? c.v : 255 - c.v;
    return out;
  }
  function fullRGB(mode, c) { return cardRGB(mode, Object.assign({}, c, { v: 255 })); }

  function stageSize() {
    const W = stage.clientWidth, H = stage.clientHeight;
    return { W, H, D: Math.round(Math.min(W, H) * 0.4) };
  }

  function mixAt(fx, fy) {
    const { W, H, D } = stageSize();
    const r = D / 2;
    const mode = state.mode;
    let c = mode === 'rgb' ? [0, 0, 0] : [1, 1, 1];
    const hits = [];
    state.cards[mode].forEach(card => {
      const dx = (fx - card.x) * W, dy = (fy - card.y) * H;
      if (dx * dx + dy * dy <= r * r) {
        hits.push(card);
        const k = cardRGB(mode, card).map(v => v / 255);
        c = c.map((a, i) => (mode === 'rgb' ? 1 - (1 - a) * (1 - k[i]) : a * k[i]));
      }
    });
    return { rgb: c.map(v => Math.round(v * 255)), hits };
  }

  const NAMES = {
    '0,0,0': '黒', '255,0,0': '赤', '0,255,0': '緑', '0,0,255': '青',
    '255,255,0': '黄（イエロー）', '0,255,255': 'シアン', '255,0,255': 'マゼンタ', '255,255,255': '白',
  };
  function colorName(rgb) {
    const key = rgb.join(',');
    if (NAMES[key]) return NAMES[key];
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < 16) return max < 40 ? '黒に近い色' : max > 215 ? '白に近い色' : '灰色';
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    const table = [[15, '赤'], [45, 'オレンジ'], [70, '黄'], [160, '緑'], [200, 'シアン'], [255, '青'], [290, '紫'], [335, 'マゼンタ'], [361, '赤']];
    const base = table.find(([lim]) => h < lim)[1];
    const tone = max < 128 ? '暗い' : min > 160 ? '淡い' : '';
    return `${tone}${base}系の色`;
  }


    function build() {
    stage.innerHTML = '';
    stage.className = 'stage stage-' + state.mode;
    els.cards = []; els.probe = null;
    modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));

    buildCards();

    layout();
    renderOptions();
    updateReadout();
  }

  function buildCards() {
    const mode = state.mode;
    state.cards[mode].forEach(c => {
      const el = document.createElement('div');
      el.className = 'mix-card';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${c.name}のカード（矢印キーで移動）`);
      el.innerHTML = `<span class="mix-card-label">${c.name}<small>${c.key}</small></span>`;
      el.style.background = App.hex(cardRGB(mode, c));
      makeDraggable(el, c, () => { const { D } = stageSize(); return [D / 2, D / 2]; }, probeToEvent);
      stage.appendChild(el);
      els.cards.push({ el, c });
    });

    const probe = document.createElement('div');
    probe.className = 'probe';
    probe.tabIndex = 0;
    probe.setAttribute('role', 'button');
    probe.setAttribute('aria-label', '色を調べる位置（矢印キーで移動）');
    makeDraggable(probe, state.probe[mode], () => [0, 0]);
    stage.appendChild(probe);
    els.probe = probe;
  }

  function place(el, obj, w, h) {
    const { W, H } = stageSize();
    el.style.transform = `translate(${obj.x * W - w / 2}px, ${obj.y * H - h / 2}px)`;
  }

  function layout() {
    const { W, H, D } = stageSize();
    if (!W || !H) return;
    stage.style.setProperty('--d', D + 'px');
    els.cards.forEach(({ el, c }) => place(el, c, D, D));
    if (els.probe) place(els.probe, state.probe[state.mode], 30, 30);
  }

  function makeDraggable(el, obj, margins, onTap) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      const r0 = stage.getBoundingClientRect();
      const offX = e.clientX - r0.left - obj.x * r0.width;
      const offY = e.clientY - r0.top - obj.y * r0.height;

      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const move = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true;
        const r = stage.getBoundingClientRect();
        moveTo(obj, (ev.clientX - r.left - offX) / r.width, (ev.clientY - r.top - offY) / r.height, margins);
      };
      const up = ev => {
        if (!moved && ev.type === 'pointerup' && onTap) onTap(ev);
        el.classList.remove('dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });

    el.addEventListener('keydown', e => {
      const step = e.shiftKey ? 0.08 : 0.02;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      moveTo(obj, obj.x + d[0], obj.y + d[1], margins);
    });
  }

  function moveTo(obj, fx, fy, margins) {
    const { W, H } = stageSize();
    const [mx, my] = margins();
    obj.x = App.clamp(fx, mx / W, 1 - mx / W);
    obj.y = App.clamp(fy, my / H, 1 - my / H);
    layout();
    updateReadout();
  }

  function probeToEvent(e) {
    const r = stage.getBoundingClientRect();
    moveTo(state.probe[state.mode], (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, () => [0, 0]);
  }
  stage.addEventListener('pointerdown', e => {
    if (e.target !== stage) return;
    probeToEvent(e);
  });

    function barRows(labels, values, colors, subFn) {
    return `<table class="vals">${labels.map((l, i) => `
      <tr><th>${l}</th>
        <td><div class="bar"><span style="width:${(values[i] / 255) * 100}%;background:${colors[i]}"></span></div></td>
        <td class="num">${values[i]}</td>
        ${subFn ? `<td class="sub">${subFn(values[i])}</td>` : ''}
      </tr>`).join('')}</table>`;
  }

  function updateReadout() {
    const mode = state.mode;
    const p = state.probe[mode];
    const { rgb, hits } = mixAt(p.x, p.y);
    const cmy = rgb.map(v => 255 - v);
    const formula = hits.length
      ? hits.map(h => h.name).join(' ＋ ')
      : mode === 'rgb' ? '光なし' : 'インクなし（紙の白）';
    const rgbRows = barRows(['R', 'G', 'B'], rgb, ['#e53935', '#2e9d43', '#2f5bd8']);
    const cmyRows = barRows(['C', 'M', 'Y'], cmy, ['#00b7d4', '#d6249f', '#e8c100'], v => Math.round((v / 255) * 100) + '%');

    readoutEl.innerHTML = `
      <h2 class="box-title">◎ の位置の色</h2>
      <div class="readout-main">
        <div class="swatch" style="background:${App.hex(rgb)}"></div>
        <div><div class="formula">${formula}</div><div class="result-name">→ ${colorName(rgb)}</div></div>
      </div>
      ${mode === 'rgb' ? rgbRows : cmyRows}
      <div class="kv"><span>HEX</span><b>${App.hex(rgb)}</b></div>
    `;
  }

  function renderOptions() {
    const mode = state.mode;
    const cards = state.cards[mode];
    optionsEl.innerHTML = `
      <h2 class="box-title">${mode === 'rgb' ? '光の強さ' : 'インクの量'}（0〜255）</h2>
      ${cards.map(c => `
        <div class="slider-row">
          <span class="dot" style="background:${App.hex(fullRGB(mode, c))}"></span>
          <label for="mix-sl-${c.key}">${c.name}（${c.key}）</label>
          <input type="range" min="0" max="255" step="1" id="mix-sl-${c.key}" data-key="${c.key}" value="${c.v}">
          <output>${c.v}</output>
        </div>`).join('')}`;

    optionsEl.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener('input', () => {
        const c = cards.find(k => k.key === input.dataset.key);
        c.v = +input.value;
        input.nextElementSibling.textContent = c.v;
        const entry = els.cards.find(e => e.c === c);
        if (entry) entry.el.style.background = App.hex(cardRGB(mode, c));
        updateReadout();
      });
    });
  }

    modeBtns.forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    build();
  }));

  document.getElementById('mixReset').addEventListener('click', () => {
    state.cards[state.mode] = clone(DEFAULTS[state.mode]);
    state.probe[state.mode] = clone(DEFAULTS.probe);
    build();
  });

  new ResizeObserver(() => { layout(); updateReadout(); }).observe(stage);
  App.onTab('mix', layout);

  build();
})();
