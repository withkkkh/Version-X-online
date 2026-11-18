export function installTeamHotspots(model, stage) {
  const links = [...model.querySelectorAll('.team-hotspot')];
  const input = matchMedia('(max-width: 680px), (pointer: coarse), (hover: none)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active;
  let pose;
  let savedCamera;
  let gesture;
  let liftFrame;
  let liftRevision = 0;
  let hiding;
  let layoutFrame;
  const offsets = new WeakMap();

  // Keep the hit areas distinct when the four stands project close together.
  function spaceMarkers() {
    layoutFrame = undefined;
    if (!model.classList.contains('model-loaded') || !document.body.classList.contains('gallery-ready')) return;
    const points = links.map(link => {
      const rect = link.getBoundingClientRect();
      const previous = offsets.get(link) || [0, 0];
      const x = rect.left + rect.width / 2 - previous[0];
      const y = rect.top + rect.height / 2 - previous[1];
      return { link, x, y, anchorX: x, anchorY: y };
    });
    const spacing = input.matches ? 46 : 27;
    for (let step = 0; step < 9; step++) {
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          if (Math.hypot(dx, dy) < .01) dx = 1;
          const distance = Math.hypot(dx, dy);
          if (distance >= spacing) continue;
          const share = (spacing - distance) / (2 * distance);
          a.x -= dx * share;
          a.y -= dy * share;
          b.x += dx * share;
          b.y += dy * share;
        }
      }
    }
    const top = Math.min(...points.map(point => point.y));
    for (const point of points) {
      point.link.style.setProperty('--leader-height', (input.matches ? 29 + point.y - top : 29) + 'px');
      const [dx, dy] = [point.x - point.anchorX, point.y - point.anchorY];
      offsets.set(point.link, [dx, dy]);
      point.link.style.setProperty('--hotspot-x', dx + 'px');
      point.link.style.setProperty('--hotspot-y', dy + 'px');
      const longEnough = Math.hypot(dx, dy) > 8;
      point.link.style.setProperty('--anchor-length', (longEnough ? Math.hypot(dx, dy) : 0) + 'px');
      point.link.style.setProperty('--anchor-angle', Math.atan2(-dy, -dx) + 'rad');
    }
  }

  function queueMarkerLayout() {
    layoutFrame ??= requestAnimationFrame(spaceMarkers);
  }

  model.addEventListener('load', queueMarkerLayout);
  input.addEventListener('change', queueMarkerLayout);
  new ResizeObserver(queueMarkerLayout).observe(model);
  new MutationObserver(queueMarkerLayout).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  async function movePlatform(key, end) {
    const revision = ++liftRevision;
    cancelAnimationFrame(liftFrame);
    const changingClip = pose !== key;
    const start = changingClip ? 0 : (model.currentTime || 0);
    if (changingClip) {
      pose = key;
      model.animationName = 'lift-' + key;
      await model.updateComplete;
      if (revision !== liftRevision) return;
      model.pause();
      model.currentTime = 0;
    }
    let time;
    const duration = end === 1 ? 370 : 315;
    function step(now) {
      if (revision !== liftRevision) return;
      time ??= now;
      const t = reduced.matches ? 1 : Math.min(1, (now - time) / duration);
      model.currentTime = start + (end - start) * (t * t * (3 - 2 * t));
      if (t < 1) liftFrame = requestAnimationFrame(step);
    }
    liftFrame = requestAnimationFrame(step);
  }

  function clear(restore = false) {
    clearTimeout(hiding);
    hiding = undefined;
    model.classList.remove('terminal-hover');
    if (active) {
      movePlatform(active.dataset.team, 0);
      active.classList.remove('is-active');
      active = null;
      model.variantName = null;
      delete stage.dataset.activeTeam;
    }
    if (savedCamera && restore) {
      model.cameraOrbit = savedCamera.orbit;
      model.cameraTarget = savedCamera.target;
    }
    savedCamera = null;
  }

  function show(link) {
    clearTimeout(hiding);
    hiding = undefined;
    if (!model.loaded || active === link) return;
    const key = link.dataset.team;
    active?.classList.remove('is-active');
    active = link;
    link.classList.add('is-active');
    stage.dataset.activeTeam = key;
    model.variantName = key;
    movePlatform(key, 1);
  }

  function focusCamera(link) {
    const orbit = model.getCameraOrbit();
    const center = model.getCameraTarget();
    savedCamera ??= { orbit: orbit.toString(), target: [center.x, center.y, center.z].map(v => v + 'm').join(' ') };
    const [x, , z] = link.dataset.position.split(' ');
    const radius = Math.min(24, Math.max(8, orbit.radius * .54));
    model.cameraTarget = x + ' 1.1m ' + z;
    model.cameraOrbit = orbit.theta + 'rad ' + orbit.phi + 'rad ' + radius + 'm';
    if (reduced.matches) model.jumpCameraToGoal();
  }

  const meshLinks = new Map();
  const linksByTeam = new Map(links.map(link => [link.dataset.team, link]));
  let hoverFrame;
  let dragged = false;

  function indexTerminals() {
    meshLinks.clear();
    const nodes = model.originalGltfJson?.nodes || [];
    for (const node of nodes) {
      const prefix = 'Team terminal | ';
      if (!node.name?.startsWith(prefix)) continue;
      const link = linksByTeam.get(node.name.slice(prefix.length));
      if (!link) continue;
      for (const childIndex of node.children || []) {
        const mesh = nodes[childIndex].mesh;
        if (mesh !== undefined) meshLinks.set(mesh, link);
      }
    }
  }
  model.addEventListener('load', indexTerminals);
  if (model.loaded) indexTerminals();

  function terminalAt(x, y) {
    if (!meshLinks.size || !document.body.classList.contains('gallery-ready')) return;
    const surface = model.surfaceFromPoint?.(x, y);
    // model-viewer starts the surface identifier with the glTF mesh index.
    if (surface) return meshLinks.get(Number(surface.split(' ', 1)[0]));
  }

  function overActiveLabel(x, y) {
    if (!active) return false;
    const anchor = active.getBoundingClientRect();
    const title = active.querySelector('.team-hotspot-label').getBoundingClientRect();
    const lower = Math.max(anchor.bottom, title.bottom) + 5;
    const upper = Math.min(anchor.top, title.top) - 5;
    const center = (anchor.left + anchor.right) / 2;
    return Math.abs(x - center) <= 14 && y >= upper && y <= lower;
  }

  function hideSoon() {
    if (!active || active.matches(':focus-visible') || hiding !== undefined) return;
    hiding = setTimeout(() => clear(), 400);
  }

  function enterTerminal(link) {
    if (!input.matches || active === link) {
      window.location.assign(link.href);
    } else {
      show(link);
      focusCamera(link);
    }
  }

  for (const link of links) {
    link.addEventListener('focus', () => { if (link.matches(':focus-visible')) show(link); });
    link.addEventListener('blur', () => {
      if (!input.matches && !link.matches(':hover')) hideSoon();
    });
    link.addEventListener('pointerdown', event => event.stopPropagation());
    link.addEventListener('click', event => {
      if (!input.matches || event.detail === 0 || active === link || !model.loaded) return;
      event.preventDefault();
      show(link);
      focusCamera(link);
    });
  }

  model.addEventListener('pointerdown', event => {
    gesture = [event.clientX, event.clientY];
    dragged = false;
  });
  model.addEventListener('pointermove', event => {
    if (gesture && Math.hypot(event.clientX - gesture[0], event.clientY - gesture[1]) >= 7) {
      dragged = true;
    }
    if (input.matches || event.buttons) return;
    cancelAnimationFrame(hoverFrame);
    const label = event.target.closest('.team-hotspot.is-active');
    hoverFrame = requestAnimationFrame(() => {
      const link = label || terminalAt(event.clientX, event.clientY) ||
        (overActiveLabel(event.clientX, event.clientY) ? active : null);
      model.classList.toggle('terminal-hover', Boolean(link));
      if (link) show(link);
      else hideSoon();
    });
  });
  model.addEventListener('pointerleave', () => {
    cancelAnimationFrame(hoverFrame);
    model.classList.remove('terminal-hover');
    if (!input.matches) hideSoon();
  });
  model.addEventListener('pointerup', event => {
    if (gesture && Math.hypot(event.clientX - gesture[0], event.clientY - gesture[1]) >= 7) {
      dragged = true;
    }
    gesture = null;
  });
  model.addEventListener('pointercancel', () => {
    gesture = null;
    dragged = true;
  });
  model.addEventListener('click', event => {
    if (dragged || event.detail === 0 || event.target.closest('.team-hotspot')) return;
    const link = terminalAt(event.clientX, event.clientY);
    if (link) enterTerminal(link);
    else if (input.matches && active) clear(true);
  });
  model.addEventListener('camera-change', event => {
    queueMarkerLayout();
    if (event.detail.source === 'user-interaction' && active && input.matches) clear();
  });
  stage.addEventListener('click', event => {
    if (event.target.closest('[data-view], #reset')) clear();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) clear(true);
  });
}
