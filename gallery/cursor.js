(() => {
  const motion = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
  const root = document.documentElement;
  const cursor = document.createElement('div');
  cursor.className = 'exhibition-pointer';
  cursor.setAttribute('aria-hidden', 'true');
  const projectIcons = [...document.querySelectorAll('.object-picture')];
  const controls = 'a[href],button,summary,[role="button"]';
  const nativeInput = 'input,textarea,select,[contenteditable="true"],iframe';
  let mouseX = 0, mouseY = 0, x = 0, y = 0, vx = 0, vy = 0;
  let goalX = 0, goalY = 0, frame = 0, last = 0;
  let active = false, pressed = false, dirty = false;

  function hide() {
    active = false;
    pressed = false;
    cancelAnimationFrame(frame);
    frame = 0;
    root.classList.remove('has-moving-pointer');
    cursor.hidden = true;
  }

  function attract(box, strength, limit) {
    const dx = box.left + box.width / 2 - mouseX;
    const dy = box.top + box.height / 2 - mouseY;
    const ratio = Math.min(strength, limit / Math.max(1, Math.hypot(dx, dy)));
    goalX += dx * ratio;
    goalY += dy * ratio;
  }

  function chooseGoal() {
    dirty = false;
    goalX = mouseX;
    goalY = mouseY;
    cursor.classList.remove('is-drawn-in');
    if (pressed) return;
    const hit = document.elementFromPoint(mouseX, mouseY);
    if (!hit || hit.closest(nativeInput)) { hide(); return; }
    const control = hit.closest(controls);
    if (control?.matches(':disabled,[aria-disabled="true"]')) return;
    const insideIndex = hit.closest('.project-index');
    if (insideIndex && (!control || control.matches('.object-link'))) {
      let nearest = null, distance = 34;
      for (const icon of projectIcons) {
        if (control && !control.contains(icon)) continue;
        const box = icon.getBoundingClientRect();
        const dx = Math.max(box.left - mouseX, mouseX - box.right, 0);
        const dy = Math.max(box.top - mouseY, mouseY - box.bottom, 0);
        const gap = Math.hypot(dx, dy);
        if (gap < distance) { nearest = box; distance = gap; }
      }
      if (nearest) {
        const proximity = 1 - distance / 34;
        const weight = proximity * proximity * (3 - 2 * proximity);
        attract(nearest, .46 * weight, 19 * weight);
        cursor.classList.toggle('is-drawn-in', weight > .55);
        return;
      }
    }
    if (control) {
      const marker = hit.closest('.object-label') ||
        control.querySelector('.map-node-marker,.team-hotspot-dot') || control;
      attract(marker.getBoundingClientRect(), .28, 8);
      cursor.classList.add('is-drawn-in');
    }
  }

  function draw(now) {
    frame = 0;
    if (dirty) chooseGoal();
    if (!active) return;
    // Critically damped spring, integrated in seconds for consistent high-refresh tracking.
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    const frequency = pressed ? 75 : 40;
    const decay = Math.exp(-frequency * dt);
    const dx = x - goalX, dy = y - goalY;
    const ax = vx + frequency * dx, ay = vy + frequency * dy;
    x = goalX + (dx + ax * dt) * decay;
    y = goalY + (dy + ay * dt) * decay;
    vx = (vx - frequency * ax * dt) * decay;
    vy = (vy - frequency * ay * dt) * decay;
    const moving = Math.hypot(x - goalX, y - goalY) > .09 || Math.hypot(vx, vy) > 4;
    if (!moving) { x = goalX; y = goalY; vx = vy = 0; }
    cursor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    if (moving) frame = requestAnimationFrame(draw);
  }

  function refresh() {
    if (!active) return;
    dirty = true;
    if (!frame) { last = performance.now(); frame = requestAnimationFrame(draw); }
  }

  function point(e) {
    if (!motion.matches || e.pointerType !== 'mouse' || e.target.closest?.(nativeInput)) {
      if (active) hide();
      return;
    }
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!active) {
      (document.fullscreenElement || document.body).append(cursor);
      x = mouseX; y = mouseY; vx = vy = 0;
      cursor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      cursor.hidden = false;
      root.classList.add('has-moving-pointer');
      active = true;
    }
    pressed = e.buttons !== 0;
    refresh();
  }
  for (const type of ['pointermove','pointerdown','pointerup'])
    document.addEventListener(type, point, {passive:true, capture:true});
  document.addEventListener('pointerout', e => { if (!e.relatedTarget && active) hide(); });
  document.addEventListener('pointercancel', hide);
  document.addEventListener('scroll', refresh, {capture:true, passive:true});
  window.addEventListener('resize', refresh);
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  document.addEventListener('fullscreenchange', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Tab') hide(); });
  motion.addEventListener('change', hide);
})();