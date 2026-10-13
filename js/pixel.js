(function () {
  'use strict';

  const wrap = document.getElementById('pxViewport');
  const cv = document.getElementById('pxCanvas');
  const ctx = cv.getContext('2d');
  const infoEl = document.getElementById('pxInfo');
  const zoomLabel = document.getElementById('pxZoomLabel');
  const opt = {
    grid: document.getElementById('pxGrid'),
    values: document.getElementById('pxValues'),
    sub: document.getElementById('pxSub'),
  };

  const MAX_S = 200;
  const BG = '#2a2a2e';
  let img = null;
  let W = 0, H = 0, dpr = 1;
  const v = { s: 1, ox: 0, oy: 0 };
  let sel = null;
  let needsFit = true;
  let raf = 0;

    function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cx = W / 2, cy = H / 2;
    const oldW = W;
    dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    if (needsFit) fit();
    else if (oldW) { v.ox += W / 2 - cx; v.oy += H / 2 - cy; }
    draw();
    return true;
  }

  function minS() {
    return img ? Math.min(1, Math.min(W / img.width, H / img.height) * 0.5) : 1;
  }

  function fit() {
    if (!img || !W) return;
    const s = Math.min(W / img.width, H / img.height) * 0.92;
    v.s = s;
    v.ox = (W - img.width * s) / 2;
    v.oy = (H - img.height * s) / 2;
    needsFit = false;
    updateZoomLabel();
    schedule();
  }

  function zoomAt(px, py, factor) {
    const ns = App.clamp(v.s * factor, minS(), MAX_S);
    const k = ns / v.s;
    v.ox = px - (px - v.ox) * k;
    v.oy = py - (py - v.oy) * k;
    v.s = ns;
    updateZoomLabel();
    schedule();
  }

  function updateZoomLabel() {
    const s = v.s;
    zoomLabel.textContent = '×' + (s >= 10 ? Math.round(s) : s >= 1 ? s.toFixed(1) : s.toFixed(2));
    zoomLabel.title = `1画素 ＝ 画面上 ${s.toFixed(2)} px`;
  }

    function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  function draw() {
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (!img) return;

    const s = v.s, iw = img.width, d = img.data;
    const x0 = Math.max(0, Math.floor(-v.ox / s));
    const y0 = Math.max(0, Math.floor(-v.oy / s));
    const x1 = Math.min(img.width, Math.ceil((W - v.ox) / s));
    const y1 = Math.min(img.height, Math.ceil((H - v.oy) / s));
    if (x1 <= x0 || y1 <= y0) return;
    const count = (x1 - x0) * (y1 - y0);
    const X = x => Math.round((v.ox + x * s) * dpr);
    const Y = y => Math.round((v.oy + y * s) * dpr);

    const useSub = opt.sub.checked && s >= 8 && count <= 60000;
    ctx.imageSmoothingEnabled = false;

    if (useSub) {
      ctx.fillStyle = '#000';
      ctx.fillRect(X(x0), Y(y0), X(x1) - X(x0), Y(y1) - Y(y0));
      for (let y = y0; y < y1; y++) {
        const ya = Y(y), yh = Y(y + 1) - ya;
        for (let x = x0; x < x1; x++) {
          const i = (y * iw + x) * 4;
          const a = X(x), w = X(x + 1) - a;
          const t1 = a + Math.round(w / 3), t2 = a + Math.round((2 * w) / 3), b = a + w;
          const gap = w >= 12 ? 1 : 0;
          ctx.fillStyle = `rgb(${d[i]},0,0)`; ctx.fillRect(a, ya, t1 - a - gap, yh - gap);
          ctx.fillStyle = `rgb(0,${d[i + 1]},0)`; ctx.fillRect(t1, ya, t2 - t1 - gap, yh - gap);
          ctx.fillStyle = `rgb(0,0,${d[i + 2]})`; ctx.fillRect(t2, ya, b - t2 - gap, yh - gap);
        }
      }
    } else {
      ctx.drawImage(img.canvas, x0, y0, x1 - x0, y1 - y0, X(x0), Y(y0), X(x1) - X(x0), Y(y1) - Y(y0));
    }

    if (opt.grid.checked && s >= 6) {
      ctx.strokeStyle = useSub ? 'rgba(90,90,90,.9)' : 'rgba(128,128,128,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) { const px = X(x) + 0.5; ctx.moveTo(px, Y(y0)); ctx.lineTo(px, Y(y1)); }
      for (let y = y0; y <= y1; y++) { const py = Y(y) + 0.5; ctx.moveTo(X(x0), py); ctx.lineTo(X(x1), py); }
      ctx.stroke();
    }

    if (opt.values.checked && s >= 56 && count <= 5000) {
      const fs = Math.min(20, Math.max(9, s * 0.17)) * dpr;
      ctx.font = `700 ${fs}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * iw + x) * 4;
          const cx = (X(x) + X(x + 1)) / 2, cy = (Y(y) + Y(y + 1)) / 2;
          const lines = [`R ${d[i]}`, `G ${d[i + 1]}`, `B ${d[i + 2]}`];
          const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          lines.forEach((t, k) => {
            const ty = cy + (k - 1) * fs * 1.2;
            if (useSub) {
              ctx.lineWidth = fs * 0.28; ctx.strokeStyle = '#000'; ctx.strokeText(t, cx, ty);
              ctx.fillStyle = '#fff';
            } else {
              ctx.fillStyle = luma > 140 ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.92)';
            }
            ctx.fillText(t, cx, ty);
          });
        }
      }
    }

    if (sel) {
      const a = X(sel.x), b = Y(sel.y), w = X(sel.x + 1) - a, h = Y(sel.y + 1) - b;
      if (s >= 4) {
        ctx.lineWidth = 4 * dpr; ctx.strokeStyle = '#000'; ctx.strokeRect(a, b, w, h);
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#ffd400'; ctx.strokeRect(a, b, w, h);
      } else {
        const cx = a + w / 2, cy = b + h / 2, r = 12 * dpr;
        ctx.lineWidth = 4 * dpr; ctx.strokeStyle = '#000';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#ffd400';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

    function updateInfo() {
    if (!img || !sel) {
      infoEl.innerHTML = `<h2 class="box-title">選んだ画素</h2>
        <p class="px-empty">画素が選択されていません</p>`;
      return;
    }
    const i = (sel.y * img.width + sel.x) * 4;
    const rgb = [img.data[i], img.data[i + 1], img.data[i + 2]];
    const cmy = rgb.map(c => 255 - c);
    const bin = n => n.toString(2).padStart(8, '0');
    const row = (label, val, color, extra) => `
      <tr><th>${label}</th>
        <td><div class="bar"><span style="width:${(val / 255) * 100}%;background:${color}"></span></div></td>
        <td class="num">${val}</td><td class="sub ${extra.cls || ''}">${extra.text}</td></tr>`;

    infoEl.innerHTML = `
      <h2 class="box-title">選んだ画素</h2>
      <div class="readout-main">
        <div class="swatch" style="background:${App.hex(rgb)}"></div>
        <div>
          <div class="px-coord">座標 x = ${sel.x}, y = ${sel.y}</div>
          <div class="px-hex">${App.hex(rgb)}</div>
        </div>
      </div>
      <div class="sec-title">RGB</div>
      <table class="vals">
        ${row('R', rgb[0], '#e53935', { text: bin(rgb[0]), cls: 'bin' })}
        ${row('G', rgb[1], '#2e9d43', { text: bin(rgb[1]), cls: 'bin' })}
        ${row('B', rgb[2], '#2f5bd8', { text: bin(rgb[2]), cls: 'bin' })}
      </table>
      <div class="kv"><span>この画素のデータ量</span><b>8 bit × 3 ＝ 24 bit</b></div>
      <div class="sec-title">CMY</div>
      <table class="vals">
        ${row('C', cmy[0], '#00b7d4', { text: Math.round((cmy[0] / 255) * 100) + '%' })}
        ${row('M', cmy[1], '#d6249f', { text: Math.round((cmy[1] / 255) * 100) + '%' })}
        ${row('Y', cmy[2], '#e8c100', { text: Math.round((cmy[2] / 255) * 100) + '%' })}
      </table>`;
  }

  function selectAt(px, py) {
    if (!img) return;
    const x = Math.floor((px - v.ox) / v.s), y = Math.floor((py - v.oy) / v.s);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    sel = { x, y };
    updateInfo();
    schedule();
  }

    const pts = new Map();
  let gesture = null;
  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function startPan(p, moved) {
    gesture = { type: 'pan', sx: p.x, sy: p.y, ox: v.ox, oy: v.oy, moved };
  }

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    cv.focus({ preventScroll: true });
    pts.set(e.pointerId, local(e));
    if (pts.size === 1) startPan(local(e), false);
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      gesture = {
        type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: v.s, ox: v.ox, oy: v.oy,
      };
    }
  });

  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !gesture) return;
    pts.set(e.pointerId, local(e));
    if (gesture.type === 'pan') {
      const p = local(e);
      const dx = p.x - gesture.sx, dy = p.y - gesture.sy;
      if (!gesture.moved && Math.hypot(dx, dy) > 4) { gesture.moved = true; cv.classList.add('panning'); }
      if (gesture.moved) { v.ox = gesture.ox + dx; v.oy = gesture.oy + dy; schedule(); }
    } else if (gesture.type === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const nd = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ns = App.clamp(gesture.s * (nd / gesture.d), minS(), MAX_S);
      const ix = (gesture.mx - gesture.ox) / gesture.s, iy = (gesture.my - gesture.oy) / gesture.s;
      v.s = ns; v.ox = mx - ix * ns; v.oy = my - iy * ns;
      updateZoomLabel();
      schedule();
    }
  });

  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    const wasTap = gesture && gesture.type === 'pan' && !gesture.moved && pts.size === 1;
    const p = local(e);
    pts.delete(e.pointerId);
    if (wasTap && e.type === 'pointerup') selectAt(p.x, p.y);
    if (pts.size === 0) { gesture = null; cv.classList.remove('panning'); }
    else if (pts.size === 1) startPan([...pts.values()][0], true);
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);

  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const p = local(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(p.x, p.y, Math.exp(-dy * 0.0018));
  }, { passive: false });

  cv.addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=' || e.key === ';') { e.preventDefault(); zoomAt(W / 2, H / 2, 1.5); return; }
    if (e.key === '-') { e.preventDefault(); zoomAt(W / 2, H / 2, 1 / 1.5); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !img) return;
    e.preventDefault();
    if (!sel) sel = { x: Math.floor(img.width / 2), y: Math.floor(img.height / 2) };
    sel = { x: App.clamp(sel.x + d[0], 0, img.width - 1), y: App.clamp(sel.y + d[1], 0, img.height - 1) };
    const sx = v.ox + (sel.x + 0.5) * v.s, sy = v.oy + (sel.y + 0.5) * v.s;
    if (sx < 0 || sx > W) v.ox += W / 2 - sx;
    if (sy < 0 || sy > H) v.oy += H / 2 - sy;
    updateInfo();
    schedule();
  });

  document.getElementById('pxZoomIn').addEventListener('click', () => zoomAt(W / 2, H / 2, 2));
  document.getElementById('pxZoomOut').addEventListener('click', () => zoomAt(W / 2, H / 2, 0.5));
  document.getElementById('pxFit').addEventListener('click', fit);
  document.getElementById('pxOne').addEventListener('click', () => zoomAt(W / 2, H / 2, 1 / v.s));
  Object.values(opt).forEach(c => c.addEventListener('change', schedule));

  new ResizeObserver(() => resize()).observe(wrap);
  App.onTab('pixel', () => resize());
  App.onImage(image => {
    img = image;
    sel = null;
    needsFit = true;
    if (!resize()) needsFit = true;
    updateInfo();
  });
  updateInfo();
})();
