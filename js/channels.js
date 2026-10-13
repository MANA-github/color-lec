(function () {
  'use strict';

  const origCv = document.getElementById('chOrig');
  const chCv = [0, 1, 2].map(i => document.getElementById('ch' + i));
  const compCv = document.getElementById('chCompCanvas');
  const compChecks = document.getElementById('chCompChecks');
  const compCap = document.getElementById('chCompCap');

  const INFO = {
    rgb: {
      keys: ['R', 'G', 'B'],
      titles: ['R（赤）', 'G（緑）', 'B（青）'],
    },
    cmy: {
      keys: ['C', 'M', 'Y'],
      titles: ['C（シアン）', 'M（マゼンタ）', 'Y（イエロー）'],
    },
  };

  const state = { mode: 'rgb', view: 'color', use: [true, true, true] };

  function sizeCanvas(c, img) {
    c.width = img.width;
    c.height = img.height;
    c.classList.toggle('pixelated', img.width < 360);
  }

  function render() {
    const img = App.image;
    if (!img) return;
    const info = INFO[state.mode];

    sizeCanvas(origCv, img);
    origCv.getContext('2d').drawImage(img.canvas, 0, 0);

    const { width: w, height: h, data: d } = img;
    const n = w * h * 4;
    const base = state.mode === 'rgb' ? 0 : 255;

    chCv.forEach((cv, ch) => {
      sizeCanvas(cv, img);
      const ctx = cv.getContext('2d');
      const out = ctx.createImageData(w, h);
      const o = out.data;
      for (let i = 0; i < n; i += 4) {
        const val = d[i + ch];
        if (state.view === 'gray') {
          o[i] = o[i + 1] = o[i + 2] = val;
        } else {
          o[i] = o[i + 1] = o[i + 2] = base;
          o[i + ch] = val;
        }
        o[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      document.getElementById('chTitle' + ch).textContent = info.titles[ch];
      });

    renderChecks();
    renderComp();
  }

  function renderChecks() {
    const info = INFO[state.mode];
    compChecks.innerHTML = info.keys.map((k, i) =>
      `<label><input type="checkbox" data-i="${i}" ${state.use[i] ? 'checked' : ''}> ${info.titles[i]}</label>`).join('');
    compChecks.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => {
      state.use[+cb.dataset.i] = cb.checked;
      renderComp();
    }));
  }

  function renderComp() {
    const img = App.image;
    if (!img) return;
    const info = INFO[state.mode];
    sizeCanvas(compCv, img);
    const ctx = compCv.getContext('2d');
    const { width: w, height: h, data: d } = img;
    const out = ctx.createImageData(w, h);
    const o = out.data;
    const base = state.mode === 'rgb' ? 0 : 255;
    const [u0, u1, u2] = state.use;
    for (let i = 0; i < w * h * 4; i += 4) {
      o[i] = u0 ? d[i] : base;
      o[i + 1] = u1 ? d[i + 1] : base;
      o[i + 2] = u2 ? d[i + 2] : base;
      o[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);

    const on = info.keys.filter((_, i) => state.use[i]);
    let cap;
    if (on.length === 3) cap = on.join(' ＋ ');
    else if (on.length === 0) cap = 'なし';
    else cap = on.join(' ＋ ');
    compCap.textContent = cap;
  }

  function download(which) {
    const img = App.image;
    if (!img) return;
    const info = INFO[state.mode];
    const baseName = (img.name || 'image').replace(/\.[^.]+$/, '');
    let cv, suffix;
    if (which === 'comp') {
      cv = compCv;
      suffix = info.keys.filter((_, i) => state.use[i]).join('') || 'none';
    } else {
      cv = chCv[+which];
      suffix = info.keys[+which] + (state.view === 'gray' ? '_gray' : '');
    }
    cv.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${baseName}_${suffix}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  document.querySelectorAll('#chMode button').forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll('#chMode button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  document.querySelectorAll('#chView button').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    document.querySelectorAll('#chView button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  document.querySelectorAll('[data-dl]').forEach(b => b.addEventListener('click', () => download(b.dataset.dl)));

  App.onImage(render);
})();
