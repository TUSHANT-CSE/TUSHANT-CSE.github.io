export function createScene(canvas) {
  const inert = { setPaused() {}, destroy() {} };
  let ctx;
  try {
    ctx = canvas?.getContext?.('2d');
  } catch {
    return inert;
  }
  const doc = canvas?.ownerDocument;
  const view = doc?.defaultView;
  if (!ctx || !view || typeof view.requestAnimationFrame !== 'function') return inert;

  const TAU = Math.PI * 2;
  const CAMERA = 6.4;
  const LIME = '#ceff75';
  const LAVENDER = '#b4a7eb';
  const LAYERS = 28;
  const vertices = [];
  const edges = [];
  const landmarks = [];
  const projected = [];
  const buckets = Array.from({ length: LAYERS }, () => ({
    mesh: [], rails: [[], [], [], []], trails: [], dots: []
  }));
  // Fixed low-discrepancy samples: no randomness, twinkling, or additional clock.
  const stars = Array.from({ length: 36 }, (_, i) => ({
    x: 0.06 + ((i * 0.61803398875 + 0.17) % 1) * 0.88,
    y: 0.06 + ((i * 0.41421356237 + 0.31) % 1) * 0.88,
    radius: i % 9 === 0 ? 1 : 0.45 + (i % 3) * 0.18,
    alpha: 0.12 + (i % 5) * 0.045,
    lime: i % 13 === 0,
    cross: i % 17 === 0
  }));
  let width = 0;
  let height = 0;
  let dpr = 1;
  let elapsed = 0;
  let frame = null;
  let lastTime = null;
  let destroyed = false;
  let paused = false;
  let intersecting = false;
  let resizeObserver;
  let intersectionObserver;
  let resolutionQuery;
  const motionQuery = typeof view.matchMedia === 'function'
    ? view.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reducedMotion = Boolean(motionQuery?.matches);
  const tilt = { x: 0, y: 0, vx: 0, vy: 0, targetX: 0, targetY: 0 };

  function listen(query, handler, add) {
    if (!query) return;
    if (typeof query.addEventListener === 'function') {
      query[add ? 'addEventListener' : 'removeEventListener']('change', handler);
    } else {
      query[add ? 'addListener' : 'removeListener']?.(handler);
    }
  }

  function rotate(point, x, y, z) {
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);
    const a = point.x * cy + point.z * sy;
    const b = point.z * cy - point.x * sy;
    const c = point.y * cx - b * sx;
    const d = point.y * sx + b * cx;
    return { x: a * cz - c * sz, y: a * sz + c * cz, z: d };
  }

  const orbits = [
    { radius: 1.48, tilt: 1.38, yaw: -0.3, roll: -0.48,
      color: LIME, rgb: '206,255,117', phase: 0.82, speed: 0.19 },
    { radius: 1.72, tilt: 0.96, yaw: 0.08, roll: 0.68,
      color: LAVENDER, rgb: '180,167,235', phase: 3.6, speed: -0.14 }
  ];
  for (const orbit of orbits) {
    orbit.u = rotate({ x: orbit.radius, y: 0, z: 0 }, orbit.tilt, orbit.yaw, orbit.roll);
    orbit.v = rotate({ x: 0, y: orbit.radius, z: 0 }, orbit.tilt, orbit.yaw, orbit.roll);
  }

  function orbitPoint(orbit, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: orbit.u.x * c + orbit.v.x * s,
      y: orbit.u.y * c + orbit.v.y * s,
      z: orbit.u.z * c + orbit.v.z * s
    };
  }

  function spherePoint(latitude, longitude) {
    const r = Math.cos(latitude);
    return { x: r * Math.cos(longitude), y: Math.sin(latitude), z: r * Math.sin(longitude) };
  }

  function curve(samples, closed, pointAt, orbit = -1) {
    const start = vertices.length;
    const count = closed ? samples : samples + 1;
    for (let i = 0; i < count; i++) vertices.push(pointAt(i / samples));
    for (let i = 0; i < samples; i++) {
      edges.push({ a: start + i, b: start + (i + 1) % count, orbit,
        angle: (i + 0.5) / samples * TAU });
    }
  }

  // A regular spherical lattice, not screen-space ellipses or scattered particles.
  for (let latitude = -75; latitude <= 75; latitude += 15) {
    curve(72, true, t => spherePoint(latitude * Math.PI / 180, t * TAU));
  }
  for (let i = 0; i < 18; i++) {
    curve(48, false, t => spherePoint(-Math.PI / 2 + t * Math.PI, i / 18 * TAU));
  }
  for (let latitude = -30; latitude <= 30; latitude += 30) {
    for (let i = 0; i < 6; i++) {
      landmarks.push(vertices.length);
      vertices.push(spherePoint(latitude * Math.PI / 180, i / 6 * TAU));
    }
  }
  orbits.forEach((orbit, i) => {
    curve(128, true, t => orbitPoint(orbit, t * TAU), i);
    // Calibration ticks share the rails' depth sorting and silhouette occlusion.
    for (let j = 0; j < 12; j++) {
      const angle = j / 12 * TAU;
      const point = orbitPoint(orbit, angle);
      const outer = j % 3 === 0 ? 1.023 : 1.011;
      const start = vertices.length;
      vertices.push(point, { x: point.x * outer, y: point.y * outer, z: point.z * outer });
      edges.push({ a: start, b: start + 1, orbit: i, angle, tick: true });
    }
  });

  function render() {
    if (destroyed || !width || !height || doc.hidden) return;
    // Even the outer ticks fit within 48% of the short axis at any rotation.
    const scale = Math.min(width, height) * 0.26;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const detailScale = Math.max(0.72, Math.min(1.1, Math.min(width, height) / 560));
    const silhouette = scale * CAMERA / Math.sqrt(CAMERA * CAMERA - 1);
    const angleX = -0.28 + tilt.x;
    const angleY = 0.48 + elapsed * 0.075 + tilt.y;
    const cx = Math.cos(angleX), sx = Math.sin(angleX);
    const cy = Math.cos(angleY), sy = Math.sin(angleY);
    const cz = Math.cos(-0.08), sz = Math.sin(-0.08);

    function project(point) {
      const x = point.x * cy + point.z * sy;
      const z = point.z * cy - point.x * sy;
      const y = point.y * cx - z * sx;
      const depth = point.y * sx + z * cx;
      const perspective = CAMERA / (CAMERA - depth);
      return {
        x: centerX + (x * cz - y * sz) * scale * perspective,
        y: centerY - (x * sz + y * cz) * scale * perspective,
        z: depth
      };
    }

    function layer(z) {
      return Math.max(0, Math.min(LAYERS - 1, Math.floor((z + 1.8) / 3.6 * LAYERS)));
    }

    // A distant rail inside the globe's perspective silhouette is a faint ghost.
    function behindGlobe(x, y, z) {
      return z < 1 / CAMERA &&
        (x - centerX) ** 2 + (y - centerY) ** 2 < silhouette * silhouette;
    }

    for (const bucket of buckets) {
      bucket.mesh.length = 0;
      bucket.rails.forEach(rail => { rail.length = 0; });
      bucket.trails.length = 0;
      bucket.dots.length = 0;
    }
    for (let i = 0; i < vertices.length; i++) projected[i] = project(vertices[i]);
    const phases = orbits.map(orbit => orbit.phase + elapsed * orbit.speed);
    for (const edge of edges) {
      const a = projected[edge.a], b = projected[edge.b];
      const z = (a.z + b.z) * 0.5;
      const bucket = buckets[layer(z)];
      if (edge.orbit < 0) {
        bucket.mesh.push(edge);
      } else {
        const ghost = behindGlobe((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, z);
        bucket.rails[edge.orbit + (ghost ? 2 : 0)].push(edge);
        const direction = Math.sign(orbits[edge.orbit].speed);
        const distance = ((phases[edge.orbit] - edge.angle) * direction % TAU + TAU) % TAU;
        if (!edge.tick && !ghost && distance < 0.42) {
          bucket.trails.push({ edge, alpha: (1 - distance / 0.42) * 0.7 });
        }
      }
    }
    for (const index of landmarks) {
      const point = projected[index];
      if (point.z > 0.05) buckets[layer(point.z)].dots.push({ point, orbit: -1 });
    }
    orbits.forEach((orbit, i) => {
      for (let j = 0; j < 2; j++) {
        const point = project(orbitPoint(orbit, phases[i] + j * Math.PI));
        buckets[layer(point.z)].dots.push({ point, orbit: i, small: j === 1,
          ghost: behindGlobe(point.x, point.y, point.z) });
      }
    });

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const star of stars) {
      const x = star.x * width, y = star.y * height;
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.lime ? LIME : LAVENDER;
      ctx.beginPath();
      ctx.arc(x, y, star.radius * detailScale, 0, TAU);
      ctx.fill();
      if (star.cross) {
        const arm = 3 * detailScale;
        ctx.globalAlpha = star.alpha * 0.6;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        ctx.stroke();
      }
    }
    const aura = ctx.createRadialGradient(
      centerX - scale * 0.12, centerY - scale * 0.18, scale * 0.1,
      centerX, centerY, scale * 1.42
    );
    aura.addColorStop(0, 'rgba(180,167,235,0.085)');
    aura.addColorStop(0.62, 'rgba(180,167,235,0.055)');
    aura.addColorStop(0.8, 'rgba(180,167,235,0.025)');
    aura.addColorStop(1, 'rgba(180,167,235,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = aura;
    ctx.fillRect(centerX - scale * 1.45, centerY - scale * 1.45, scale * 2.9, scale * 2.9);

    function strokeEdges(list, color, alpha, lineWidth) {
      if (!list.length) return;
      ctx.beginPath();
      for (const edge of list) {
        const a = projected[edge.a], b = projected[edge.b];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    function drawBody() {
      // Insert the translucent volume at the perspective tangent plane, not
      // above the whole scene: near rails, trails, and markers stay in front.
      const body = ctx.createRadialGradient(
        centerX - scale * 0.32, centerY - scale * 0.35, scale * 0.04,
        centerX, centerY, silhouette
      );
      body.addColorStop(0, 'rgba(64,56,86,0.72)');
      body.addColorStop(0.32, 'rgba(36,31,50,0.78)');
      body.addColorStop(0.72, 'rgba(18,16,23,0.84)');
      body.addColorStop(0.92, 'rgba(21,18,29,0.72)');
      body.addColorStop(1, 'rgba(48,40,68,0.48)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(centerX, centerY, silhouette, 0, TAU);
      ctx.fill();

      // Broad, low-alpha strokes supply bounded glow without shadowBlur.
      ctx.strokeStyle = LAVENDER;
      ctx.globalAlpha = 0.045;
      ctx.lineWidth = 9 * detailScale;
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 3 * detailScale;
      ctx.stroke();
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 0.85;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, silhouette, Math.PI * 1.02, Math.PI * 1.72);
      ctx.globalAlpha = 0.52;
      ctx.lineWidth = 1.15 * detailScale;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, silhouette, Math.PI * 0.08, Math.PI * 0.36);
      ctx.strokeStyle = LIME;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      ctx.beginPath();
      buckets.forEach((bucket, i) => {
        if ((i + 0.5) / LAYERS * 3.6 - 1.8 < 1 / CAMERA) return;
        for (const edge of bucket.mesh) {
          const a = projected[edge.a], b = projected[edge.b];
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      });
      ctx.strokeStyle = LAVENDER;
      ctx.globalAlpha = 0.075;
      ctx.lineWidth = 2.6 * detailScale;
      ctx.stroke();
    }

    // Quantized back-to-front drawing keeps fine lines crisp with few stroke calls.
    let bodyDrawn = false;
    buckets.forEach((bucket, i) => {
      const depth = (i + 0.5) / LAYERS * 3.6 - 1.8;
      if (!bodyDrawn && depth >= 1 / CAMERA) {
        drawBody();
        bodyDrawn = true;
      }
      const front = Math.max(0, Math.min(1, (depth + 1) / 2));
      strokeEdges(bucket.mesh, LAVENDER, 0.065 + 0.56 * front ** 1.7,
        0.65 + 0.2 * front);
      for (let rail = 0; rail < 4; rail++) {
        strokeEdges(bucket.rails[rail], orbits[rail % 2].color,
          rail > 1 ? 0.075 : 0.28 + 0.4 * front, 0.85);
      }
      for (const trail of bucket.trails) {
        strokeEdges([trail.edge], orbits[trail.edge.orbit].color, trail.alpha, 1.3);
      }
      for (const dot of bucket.dots) {
        const { point } = dot;
        const orbit = dot.orbit < 0 ? null : orbits[dot.orbit];
        const radius = (orbit ? (dot.small ? 1.55 : 3.1) : 0.95) * detailScale;
        const opacity = dot.ghost ? 0.13 : (dot.small ? 0.48 : 0.95);
        if (orbit && !dot.small) {
          const glowRadius = 14 * detailScale;
          const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius);
          glow.addColorStop(0, `rgba(${orbit.rgb},0.55)`);
          glow.addColorStop(0.3, `rgba(${orbit.rgb},0.18)`);
          glow.addColorStop(1, `rgba(${orbit.rgb},0)`);
          ctx.globalAlpha = opacity;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(point.x, point.y, glowRadius, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = orbit ? opacity : 0.32 + front * 0.3;
        ctx.fillStyle = orbit ? orbit.color : LAVENDER;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, TAU);
        ctx.fill();
        if (orbit && !dot.small && !dot.ghost) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#f3ffe2';
          ctx.beginPath();
          ctx.arc(point.x - radius * 0.2, point.y - radius * 0.2, radius * 0.38, 0, TAU);
          ctx.fill();
        }
      }
    });
    ctx.restore();
  }

  function canAnimate() {
    return !destroyed && !paused && !reducedMotion && !doc.hidden &&
      intersecting && width > 0 && height > 0;
  }

  function stopFrame() {
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    tilt.vx = 0;
    tilt.vy = 0;
  }

  function sync() {
    if (destroyed) return;
    if (canAnimate()) {
      if (frame === null) frame = view.requestAnimationFrame(tick);
    } else {
      stopFrame();
      render();
    }
  }

  function tick(now) {
    frame = null;
    if (!canAnimate()) {
      sync();
      return;
    }
    const dt = lastTime === null ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;
    // Damped springs are time-based; tab returns never produce a rotation jump.
    tilt.vx += ((tilt.targetX - tilt.x) * 55 - tilt.vx * 15) * dt;
    tilt.vy += ((tilt.targetY - tilt.y) * 55 - tilt.vy * 15) * dt;
    tilt.x += tilt.vx * dt;
    tilt.y += tilt.vy * dt;
    render();
    frame = view.requestAnimationFrame(tick);
  }

  function measure(entry) {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(0, entry?.contentRect?.width ?? canvas.clientWidth ?? rect.width);
    height = Math.max(0, entry?.contentRect?.height ?? canvas.clientHeight ?? rect.height);
    dpr = Math.min(2, Math.max(1, view.devicePixelRatio || 1));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    if (!intersectionObserver) {
      intersecting = rect.bottom > 0 && rect.right > 0 &&
        rect.top < view.innerHeight && rect.left < view.innerWidth;
    }
    render();
    sync();
  }

  function onResize() { measure(); }
  function onPointer(event) {
    if (!canAnimate()) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    tilt.targetX = y * 0.18;
    tilt.targetY = x * 0.24;
  }
  function resetPointer() { tilt.targetX = 0; tilt.targetY = 0; }
  function onVisibility() {
    resetPointer();
    sync();
  }
  function onMotion() {
    reducedMotion = Boolean(motionQuery?.matches);
    resetPointer();
    sync();
  }
  function watchResolution() {
    listen(resolutionQuery, onResolution, false);
    resolutionQuery = typeof view.matchMedia === 'function'
      ? view.matchMedia(`(resolution: ${view.devicePixelRatio || 1}dppx)`) : null;
    listen(resolutionQuery, onResolution, true);
  }
  function onResolution() {
    if (destroyed) return;
    watchResolution();
    measure();
  }

  canvas.addEventListener('pointermove', onPointer, { passive: true });
  canvas.addEventListener('pointerleave', resetPointer);
  canvas.addEventListener('pointercancel', resetPointer);
  doc.addEventListener('visibilitychange', onVisibility);
  view.addEventListener('resize', onResize, { passive: true });
  listen(motionQuery, onMotion, true);
  watchResolution();
  if (typeof view.ResizeObserver === 'function') {
    resizeObserver = new view.ResizeObserver(entries => {
      const entry = entries.find(item => item.target === canvas);
      if (entry) measure(entry);
    });
    resizeObserver.observe(canvas);
  }
  if (typeof view.IntersectionObserver === 'function') {
    intersectionObserver = new view.IntersectionObserver(entries => {
      if (destroyed) return;
      const entry = entries.find(item => item.target === canvas);
      if (!entry) return;
      intersecting = entry.isIntersecting && entry.intersectionRatio > 0;
      if (!intersecting) resetPointer();
      sync();
    }, { threshold: 0 });
    intersectionObserver.observe(canvas);
  } else {
    view.addEventListener('scroll', onResize, { passive: true, capture: true });
  }
  measure();

  return {
    setPaused(value) {
      if (destroyed) return;
      paused = Boolean(value);
      resetPointer();
      sync();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopFrame();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      listen(motionQuery, onMotion, false);
      listen(resolutionQuery, onResolution, false);
      canvas.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('pointerleave', resetPointer);
      canvas.removeEventListener('pointercancel', resetPointer);
      doc.removeEventListener('visibilitychange', onVisibility);
      view.removeEventListener('resize', onResize);
      view.removeEventListener('scroll', onResize, true);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      vertices.length = edges.length = landmarks.length = projected.length = buckets.length = stars.length = 0;
    }
  };
}
