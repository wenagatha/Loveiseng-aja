(() => {
  const W = 800, H = 760;
  const UNIT = 14.5;
  const CENTER = [W / 2, H / 2 - 2.5 * UNIT];
  const SIZE = 1.25; // ukuran tiap stitch
  const ROW_SCALES = [1.0, 0.915, 0.83, 0.745, 0.66, 0.575, 0.49];
  const STITCH_STEP = 9;
  const BASE = [214, 40, 52];

  const canvas = document.getElementById('c');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');

  // kanvas permanen untuk stitch yang sudah jadi
  const layer = document.createElement('canvas');
  layer.width = canvas.width; layer.height = canvas.height;
  const lctx = layer.getContext('2d');

  // ---------- bentuk hati ----------
  function heartPoints(scale, n = 4000) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = Math.PI + (2 * Math.PI * i) / (n - 1); // mulai dari ujung bawah
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([CENTER[0] + x * UNIT * scale, CENTER[1] - y * UNIT * scale]);
    }
    return pts;
  }

  function resample(pts, step) {
    const dist = [0];
    for (let i = 1; i < pts.length; i++)
      dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const out = [];
    let j = 0;
    for (let d = 0; d < dist[dist.length - 1]; d += step) {
      while (dist[j + 1] < d) j++;
      const u = (d - dist[j]) / (dist[j + 1] - dist[j] || 1);
      out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u,
                pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u]);
    }
    return out;
  }

  function buildPath() {
    const path = [];
    ROW_SCALES.forEach((s, r) => {
      const p = resample(heartPoints(s), STITCH_STEP * (0.85 + 0.15 * s));
      p.forEach((pt, i) => {
        const a = p[Math.min(i + 1, p.length - 1)], b = p[Math.max(i - 1, 0)];
        path.push({ x: pt[0], y: pt[1], ang: Math.atan2(a[1] - b[1], a[0] - b[0]), row: r });
      });
    });
    return path;
  }

  // ---------- stitch ----------
  const rgb = (c, k, add = 0) =>
    `rgb(${c.map(v => Math.max(0, Math.min(255, v * k + add)) | 0).join(',')})`;

  function loop(c, col) {
    const g = c.createRadialGradient(0, 0, 0.5, 0, 0, 9);
    g.addColorStop(0, rgb(col, 1.25, 20));
    g.addColorStop(0.6, rgb(col, 1));
    g.addColorStop(1, rgb(col, 0.35));
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgb(col, 1.35, 25); c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-5, -0.5); c.lineTo(5, -1); c.stroke();
  }

  function drawStitch(c, x, y, ang, k) {
    const col = BASE.map(v => v * k);
    c.save();
    c.translate(x, y); c.rotate(ang); c.scale(SIZE, SIZE);
    [[1, -3], [-1, 3]].forEach(([sign, off]) => {
      c.save();
      c.translate(off, 0);
      c.rotate((sign * 38 * Math.PI) / 180);
      loop(c, col);
      c.restore();
    });
    c.restore();
  }

  // ---------- benang ----------
  function strandPoints(p0, p1, t, sag) {
    const cx = (p0[0] + p1[0]) / 2 + Math.sin(t * 1.3) * 12;
    const cy = (p0[1] + p1[1]) / 2 + sag + Math.sin(t * 0.9) * 8;
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const u = i / 32, v = 1 - u;
      pts.push([v * v * p0[0] + 2 * v * u * cx + u * u * p1[0],
                v * v * p0[1] + 2 * v * u * cy + u * u * p1[1]]);
    }
    return pts;
  }

  function line(c, pts, color, w) {
    c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
  }

  // ---------- state ----------
  const path = buildPath();
  let idx = 0, speed = 3;
  let end = [W - 40, 120], target = [W - 40, 120];

  lctx.scale(dpr, dpr);
  ctx.scale(dpr, dpr);

  function pointerMove(e) {
    const r = canvas.getBoundingClientRect();
    target = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerMove);

  const speedBtn = document.getElementById('speed');
  function toggleSpeed() {
    speed = speed > 1 ? 1 : 12;
    speedBtn.textContent = speed > 1 ? 'Lambat' : 'Cepat';
  }
  function restart() { lctx.clearRect(0, 0, W, H); idx = 0; }
  function save() {
    const a = document.createElement('a');
    a.download = 'crochet_heart.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
  speedBtn.onclick = toggleSpeed;
  document.getElementById('restart').onclick = restart;
  document.getElementById('save').onclick = save;
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); toggleSpeed(); }
    else if (e.key === 'r' || e.key === 'R') restart();
    else if (e.key === 's' || e.key === 'S') save();
  });

  function frame(ms) {
    const t = ms / 1000;
    for (let i = 0; i < speed && idx < path.length; i++, idx++) {
      const s = path[idx];
      drawStitch(lctx, s.x, s.y, s.ang, 0.72 + Math.random() * 0.5);
    }
    end[0] += (target[0] - end[0]) * 0.08;
    end[1] += (target[1] - end[1]) * 0.08;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(layer, 0, 0, W, H);

    const s = path[Math.min(idx, path.length - 1)];
    const dist = Math.hypot(end[0] - s.x, end[1] - s.y);
    const pts = strandPoints([s.x, s.y], end, t, Math.min(90, dist * 0.15));
    line(ctx, pts, 'rgb(150,25,35)', 4);
    line(ctx, pts, 'rgb(235,85,95)', 2);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
