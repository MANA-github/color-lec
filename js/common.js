(function () {
  'use strict';

  const MAX_SIDE = 2048;

  const imageListeners = [];
  const tabListeners = {};
  let currentTab = 'mix';

  const App = (window.App = {
    image: null,
    get tab() { return currentTab; },
    onImage(cb) {
      imageListeners.push(cb);
      if (App.image) cb(App.image);
    },
    onTab(name, cb) {
      (tabListeners[name] = tabListeners[name] || []).push(cb);
    },
    toast,
    loadFile,
    useSample,
    showTab,
    hex(rgb) {
      return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    },
    clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
  });

    function setImage(source, sw, sh, name) {
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    App.image = { canvas, width: w, height: h, data, name, scaled: scale < 1, origWidth: sw, origHeight: sh };

    document.getElementById('imageName').textContent = name;
    document.getElementById('imageSize').textContent =
      `${w} × ${h} 画素` + (scale < 1 ? `（元は ${sw} × ${sh}。大きいので縮小しました）` : '');

    imageListeners.forEach(cb => cb(App.image));
  }

  function loadFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast('画像ファイルを選んでください');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img, img.naturalWidth, img.naturalHeight, file.name || '貼り付けた画像');
      URL.revokeObjectURL(url);
      toast('画像を読み込みました');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast('この画像は読み込めませんでした');
    };
    img.src = url;
  }

  function useSample() {
    const c = makeSample();
    setImage(c, c.width, c.height, 'サンプル画像');
  }

  function makeSample() {
    const w = 192, h = 128;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    const hue = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 6; i++) hue.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
    g.fillStyle = hue;
    g.fillRect(0, 0, w, 56);
    const shade = g.createLinearGradient(0, 0, 0, 56);
    shade.addColorStop(0, 'rgba(255,255,255,1)');
    shade.addColorStop(0.5, 'rgba(255,255,255,0)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = shade;
    g.fillRect(0, 0, w, 56);

    for (let i = 0; i < 16; i++) {
      const v = i * 17;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(i * 12, 56, 12, 14);
    }

    g.fillStyle = '#000';
    g.fillRect(0, 70, 96, 58);
    g.globalCompositeOperation = 'lighter';
    [['#ff0000', 38, 92], ['#00ff00', 58, 92], ['#0000ff', 48, 108]].forEach(([col, x, y]) => {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill();
    });

    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#fff';
    g.fillRect(96, 70, 96, 58);
    g.globalCompositeOperation = 'multiply';
    [['#00ffff', 134, 92], ['#ff00ff', 154, 92], ['#ffff00', 144, 108]].forEach(([col, x, y]) => {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill();
    });
    g.globalCompositeOperation = 'source-over';
    return c;
  }

    function showTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
    document.getElementById('imageBar').hidden = name === 'mix';
    try { localStorage.setItem('tab', name); } catch (e) {  }
    (tabListeners[name] || []).forEach(cb => cb());
  }

    let toastTimer = 0;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

    function setupSwitch(group, activeSel) {
    const thumb = document.createElement('span');
    thumb.className = 'switch-thumb';
    group.prepend(thumb);
    group.classList.add('has-thumb');
    let lastW = 0;

    const update = () => {
      const btn = group.querySelector(activeSel);
      if (!btn || !btn.offsetWidth) { lastW = 0; return; }
      if (!lastW) group.classList.add('thumb-instant');
      thumb.style.width = btn.offsetWidth + 'px';
      thumb.style.height = btn.offsetHeight + 'px';
      thumb.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
      lastW = btn.offsetWidth;
      if (group.classList.contains('thumb-instant')) {
        void thumb.offsetWidth;
        requestAnimationFrame(() => group.classList.remove('thumb-instant'));
      }
      group.classList.add('thumb-ready');
    };

    new MutationObserver(update).observe(group, { attributes: true, subtree: true, attributeFilter: ['aria-pressed', 'aria-selected'] });
    new ResizeObserver(update).observe(group);
    update();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tabs').forEach(g => setupSwitch(g, '[aria-selected="true"]'));
    document.querySelectorAll('.seg').forEach(g => setupSwitch(g, '[aria-pressed="true"]'));
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', () => {
      loadFile(fileInput.files[0]);
      fileInput.value = '';
    });
    document.getElementById('sampleBtn').addEventListener('click', () => {
      useSample();
      toast('サンプル画像に戻しました');
    });

    let dragDepth = 0;
    const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', e => {
      if (!hasFiles(e)) return;
      dragDepth++;
      document.body.classList.add('dragging-file');
    });
    window.addEventListener('dragleave', e => {
      if (!hasFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) document.body.classList.remove('dragging-file');
    });
    window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', e => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('dragging-file');
      const file = Array.from(e.dataTransfer.files).find(f => /^image\//.test(f.type));
      if (!file) { toast('画像ファイルをドロップしてください'); return; }
      if (currentTab === 'mix') showTab('pixel');
      loadFile(file);
    });

    window.addEventListener('paste', e => {
      const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find(i => /^image\//.test(i.type));
      if (!item) return;
      if (currentTab === 'mix') showTab('pixel');
      loadFile(item.getAsFile());
    });

    useSample();

    let saved = null;
    try { saved = localStorage.getItem('tab'); } catch (e) {  }
    showTab(['mix', 'pixel', 'channels'].includes(saved) ? saved : 'mix');
  });
})();
