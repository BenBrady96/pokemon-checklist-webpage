const COLORS = ['#FFE9A3', '#F7D774', '#F2C14E', '#E3A72F', '#FFFFFF', '#FFCB05', '#3B4CCA', '#FF7A6E'];
const DURATION = 2800;

function launch(parts, { x, y, angle, spread, count }) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const speed = 9 + Math.random() * 11;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      wobble: Math.random() * Math.PI * 2,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      round: Math.random() < 0.25,
    });
  }
}

export function celebrate() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  (document.querySelector('dialog[open]:not(.is-closing)') || document.body).append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const parts = [];
  const count = Math.round(Math.min(90, w / 8));
  launch(parts, { x: 0, y: h * 0.85, angle: -Math.PI / 3, spread: 0.9, count });
  launch(parts, { x: w, y: h * 0.85, angle: (-2 * Math.PI) / 3, spread: 0.9, count });

  const start = performance.now();
  let last = start;
  function frame(now) {
    const dt = Math.min(3, (now - last) / 16.67);
    last = now;
    const elapsed = now - start;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Math.max(0, Math.min(1, (DURATION - elapsed) / 700));
    for (const p of parts) {
      p.vy += 0.28 * dt;
      p.vx *= 0.985 ** dt;
      p.vy *= 0.985 ** dt;
      p.x += (p.vx + Math.sin(p.wobble) * 0.6) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.wobble += 0.12 * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.scale(1, Math.cos(p.wobble));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
