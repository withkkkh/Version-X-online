import { startModel } from './gallery-runtime.js?v=31';
import { installTeamHotspots } from './team-hotspots.js?v=30';

const model = document.querySelector('#model');
const status = document.querySelector('#status');
const stage = document.querySelector('#stage');
const expand = document.querySelector('#expand');
const opening = document.querySelector('#opening');
const enter = document.querySelector('#open-gallery');
const skip = document.querySelector('#tour-skip');
const siteChrome = [document.querySelector('.mast'), document.querySelector('main')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const defaultLimits = [model.getAttribute('min-camera-orbit'), model.getAttribute('max-camera-orbit')];

const views = {
  'rack-design': { target: [0, 1.33, -6.36], orbit: [9, 60, 5.5], fov: 39, fitByFov: true },
  'rack-software': { target: [0, 1.33, 6.36], orbit: [188, 60, 5.5], fov: 39, fitByFov: true },
  'rack-hardware': { target: [7.57, 1.33, 0], orbit: [-82, 67, 5.8], fov: 39, fitByFov: true },
  'rack-operations': { target: [-7.57, 1.33, 0], orbit: [82, 67, 5.8], fov: 39, fitByFov: true },
  overview: { target: [0, .35, 0], orbit: [24, 58, 37], fov: 42 },
  top: { target: [0, 0, 0], orbit: [0, 3, 40], fov: 42 },
  sculpture: { target: [0, 5.99, 0], orbit: [0, .1, 7], fov: 32 },
  facade: { target: [-6.32, .94, 9.11], orbit: [12, 85, 6.5], fov: 36 },
};
const presetButtons = [...document.querySelectorAll('[data-view]')];

let phase = 'opening';
let viewerError = false;
let tourDeadline;
let tourFrame;
let settleAnimation;
let tourImage;

installTeamHotspots(model, stage, openMap);

function units(values, suffix) {
  return values.map(value => value.toFixed(3) + suffix).join(' ');
}

function applyCamera({ target, orbit: [azimuth, elevation, radius], fov }, immediate = false) {
  model.setAttribute('camera-target', units(target, 'm'));
  model.setAttribute('camera-orbit', units([azimuth, elevation], 'deg') + ' ' + radius.toFixed(3) + 'm');
  model.setAttribute('field-of-view', fov.toFixed(2) + 'deg');
  if (immediate) model.jumpCameraToGoal?.();
}

function fittedView(view, { width, height }) {
  const multiplier = height > 0 && width > 0 ? Math.max(1, 1.40 * height / width) : 1;
  if (view.fitByFov) {
    const fov = Math.atan(multiplier * Math.tan(view.fov * Math.PI / 360)) * 360 / Math.PI;
    return { ...view, fov };
  }
  return { ...view, orbit: [...view.orbit.slice(0, 2), Math.round(view.orbit[2] * multiplier)] };
}

function setView(name, immediate = false) {
  const view = views[name];
  if (view.fitByFov) model.setAttribute('max-field-of-view', '80deg');
  else model.removeAttribute('max-field-of-view');
  applyCamera(fittedView(view, model.getBoundingClientRect()), immediate);
  for (const button of presetButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  }
}

const directory = stage.querySelector('.directory');
const directoryToggle = directory.querySelector('summary');
function closeDirectory(restoreFocus = false) {
  directory.open = false;
  if (restoreFocus) directoryToggle.focus({ preventScroll: true });
}
for (const button of presetButtons) button.addEventListener('click', () => {
  setView(button.dataset.view);
  if (directory.contains(button)) closeDirectory(true);
});
document.addEventListener('pointerdown', event => {
  if (directory.open && !directory.contains(event.target)) closeDirectory();
});
document.querySelector('#reset').addEventListener('click', () => setView('overview', true));
model.addEventListener('camera-change', (event) => {
  if (phase !== 'gallery' || event.detail.source !== 'user-interaction') return;
  for (const button of presetButtons) button.setAttribute('aria-pressed', 'false');
});

function setExpanded(show) {
  stage.classList.toggle('expanded', show);
  document.body.classList.toggle('with-expanded-stage', show);
  expand.setAttribute('aria-pressed', String(show));
  expand.setAttribute('aria-label', show ? '退出放大预览' : '放大预览');
  expand.querySelector('.expand-text').textContent = show ? '退出放大' : '放大';
}
expand.addEventListener('click', () => setExpanded(!stage.classList.contains('expanded')));
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (directory.open) closeDirectory(true);
  else if (phase === 'tour') finishTour();
  else if (stage.classList.contains('expanded')) setExpanded(false);
});

function hideOpening() {
  opening.hidden = true;
  opening.classList.remove('light-tour', 'slow-overview');
  document.body.classList.remove('opening-active');
  for (const element of siteChrome) element.inert = false;
}

function enterGallery() {
  phase = 'gallery';
  hideOpening();
  document.body.classList.add('gallery-ready');
  setView('overview', true);
  presetButtons[0].focus({ preventScroll: true });
}

function finishTour() {
  if (phase !== 'tour') return;
  clearTimeout(tourDeadline);
  cancelAnimationFrame(tourFrame);
  hideOpening();
  phase = 'gallery';
  skip.hidden = true;
  model.inert = false;
  model.setAttribute('min-camera-orbit', defaultLimits[0]);
  model.setAttribute('max-camera-orbit', defaultLimits[1]);
  model.setAttribute('camera-controls', '');
  stage.classList.remove('entering', 'waiting-for-tour');
  const image = tourImage;
  const settled = image && settleAnimation?.playState === 'finished';
  if (settled) image.style.transform = getComputedStyle(image).transform;
  settleAnimation?.cancel();
  tourImage = undefined;
  if (image) {
    const removeImage = () => {
      URL.revokeObjectURL(image.src);
      image.remove();
    };
    if (settled) {
      // Reveal a canvas that has already rendered at its final size.
      requestAnimationFrame(() => {
        image.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }).onfinish = removeImage;
      });
    } else {
      removeImage();
    }
  }
  settleAnimation = undefined;
  window.removeEventListener('resize', finishTour);
  document.body.classList.remove('tour-settling');
  document.body.classList.remove('camera-tour');
  document.body.classList.add('gallery-revealed', 'gallery-ready');
  setView('overview', true);
  presetButtons[0].focus({ preventScroll: true });
}
skip.addEventListener('click', finishTour);

const lerp = (from, to, progress) => from + (to - from) * progress;
const smooth = progress => progress * progress * (3 - 2 * progress);
const clamp = value => Math.max(0, Math.min(1, value));
const radians = degrees => degrees * Math.PI / 180;
const fadeTime = 560;
const facadeHold = 320;
const retreatTime = 1380;
const settleTime = 880;
const settleEase = "cubic-bezier(.35, 0, .25, 1)";

function getFacadeView() {
  const aspect = Math.max(.24, model.clientWidth / Math.max(model.clientHeight, 1));
  const portrait = aspect < 1;
  const facade = views.facade;
  const frontFov = 36;
  const frameHalfWidth = 1.53;
  const frameHalfHeight = .94;
  const closeDistance = Math.max(
    frameHalfWidth / (.91 * aspect),
    frameHalfHeight / (portrait ? .8 : .84),
  ) / Math.tan(radians(frontFov / 2)) * Math.min(1.05, .20 + .91 * aspect);
  return { ...facade, fov: frontFov, orbit: [4, 88, closeDistance] };
}

function measureGalleryScreen() {
  stage.classList.remove("entering");
  document.body.classList.remove("camera-tour");
  const rect = model.getBoundingClientRect();
  document.body.classList.add("camera-tour");
  stage.classList.add("entering");
  return rect;
}

async function settleGallery(rect) {
  const full = model.getBoundingClientRect();
  const idealAspect = model.getIdealAspect?.() || 1;
  const projectedHeight = ({ width, height }) => Math.min(height, width / idealAspect);
  const scale = projectedHeight(rect) / projectedHeight(full);
  const x = rect.left + rect.width / 2 - (full.left + full.width / 2);
  const y = rect.top + rect.height / 2 - (full.top + full.height / 2);
  skip.hidden = true;
  let frame = stage;
  let image;
  try {
    const blob = await model.toBlob({ mimeType: 'image/png' });
    if (blob && phase === 'tour') {
      image = new Image();
      image.alt = '';
      image.className = 'tour-snapshot';
      image.src = URL.createObjectURL(blob);
      await image.decode();
    }
  } catch {
    if (image) URL.revokeObjectURL(image.src);
    image = undefined;
  }
  if (phase !== 'tour') {
    if (image) URL.revokeObjectURL(image.src);
    return;
  }
  document.body.classList.add('tour-settling');
  if (image) {
    Object.assign(image.style, {
      left: full.left + 'px', top: full.top + 'px',
      width: full.width + 'px', height: full.height + 'px',
    });
    document.body.append(image);
    frame = tourImage = image;
    stage.classList.add('waiting-for-tour');
    stage.classList.remove('entering');
    setView('overview', true);
  }
  settleAnimation = frame.animate([
    { transform: "translate(0px, 0px) scale(1)" },
    { transform: "translate(" + x + "px, " + y + "px) scale(" + scale + ")" },
  ], { duration: settleTime, easing: settleEase, fill: "forwards" });
  settleAnimation.onfinish = finishTour;
}

function playTour() {
  if (reducedMotion.matches) {
    enterGallery();
    return;
  }

  phase = 'tour';
  tourDeadline = setTimeout(finishTour, 4800);
  stage.classList.add('entering');
  document.body.classList.add('camera-tour');
  model.inert = true;
  model.removeAttribute('camera-controls');
  model.setAttribute('min-camera-orbit', 'auto auto 2m');
  model.setAttribute('max-camera-orbit', 'auto auto 190m');
  window.addEventListener("resize", finishTour, { once: true });
  const screenRect = measureGalleryScreen();
  const close = getFacadeView();
  const full = fittedView(views.overview, screenRect);
  applyCamera(close, true);

  let started;
  let revealed = false;
  tourFrame = requestAnimationFrame(() => {
    tourFrame = requestAnimationFrame(function draw(now) {
      if (phase !== 'tour') return;
      started ??= now;
      const elapsed = now - started;
      if (!revealed) {
        revealed = true;
        opening.classList.add('leaving');
      }
      if (elapsed >= fadeTime && !opening.hidden) {
        hideOpening();
        skip.hidden = false;
        skip.focus({ preventScroll: true });
      }
      const retreat = smooth(clamp((elapsed - fadeTime - facadeHold) / retreatTime));
      const distanceProgress = 1 - (1 - retreat) ** 1.8;
      applyCamera({
        target: close.target.map((value, i) => lerp(value, full.target[i], retreat)),
        orbit: [
          lerp(close.orbit[0], full.orbit[0], retreat),
          lerp(close.orbit[1], full.orbit[1], retreat),
          lerp(close.orbit[2], full.orbit[2], distanceProgress),
        ],
        fov: lerp(close.fov, full.fov, retreat),
      }, true);
      tourFrame = requestAnimationFrame(retreat === 1 ? () => settleGallery(screenRect) : draw);
    });
  });
}

const replay = document.querySelector('#tour-replay');
let waitNotice;
function onLoaded() {
  clearTimeout(waitNotice);
  replay.hidden = false;
  status.hidden = true;
  model.classList.add('model-loaded');
  viewerError = false;
}
function loadingError() {
  viewerError = true;
  model.classList.remove('model-loaded');
  status.hidden = false;
  clearTimeout(waitNotice);
  showRetry('三维模型暂时无法显示，可从下方「展区入口」继续参观。');
}
let lastProgress = -1;
model.addEventListener('progress', event => {
  if (model.loaded || viewerError) return;
  const progress = Math.min(99, Math.floor(event.detail.totalProgress * 10) * 10);
  if (progress === lastProgress) return;
  lastProgress = progress;
  status.textContent = '三维展馆加载中 ' + progress + '% · 可先浏览下方展区目录';
});
model.addEventListener('load', onLoaded);
model.addEventListener('error', loadingError);
if (model.loaded) onLoaded();
function showRetry(message) {
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重新加载';
  retry.onclick = () => location.assign('./?entry=return-from-map');
  status.replaceChildren(message, ' ', retry);
}
let startedModel = false;
function prepareModel() {
  if (startedModel) return;
  startedModel = true;
  waitNotice = setTimeout(() => {
    if (!model.loaded) showRetry('仍在准备三维展馆，可先浏览下方「展区入口」。');
  }, 18000);
  startModel(model).catch(loadingError);
}
const cover = opening.querySelector('img');
if (cover.complete || document.documentElement.classList.contains('direct-gallery')) prepareModel();
else {
  cover.addEventListener('load', prepareModel, { once:true });
  cover.addEventListener('error', prepareModel, { once:true });
}
replay.addEventListener('click', () => {
  if (phase !== 'gallery' || !model.loaded) return;
  closeDirectory();
  if (stage.classList.contains('expanded')) setExpanded(false);
  opening.classList.remove('leaving');
  opening.hidden = false;
  document.body.classList.add('opening-active');
  for (const element of siteChrome) element.inert = true;
  playTour();
});

enter.addEventListener('click', () => {
  if (phase !== 'opening') return;
  prepareModel();
  if (model.loaded && !viewerError) {
    playTour();
    return;
  }
  if (reducedMotion.matches) { enterGallery(); return; }
  phase = 'light-tour';
  opening.classList.add('light-tour');
  setTimeout(() => {
    if (model.loaded && !viewerError) {
      playTour();
    } else {
      opening.classList.add('slow-overview');
      setTimeout(enterGallery, 1050);
    }
  }, 700);
});

if (document.documentElement.classList.contains('direct-gallery')) {
  enterGallery();
} else {
  for (const element of siteChrome) element.inert = true;
  opening.focus({ preventScroll: true });
  setView('overview', true);
}
new ResizeObserver(() => {
  if (phase === 'tour') return;
  const selected = presetButtons.find(button => button.getAttribute('aria-pressed') === 'true');
  if (selected) setView(selected.dataset.view, phase === 'opening');
}).observe(model);

const mapDialog = document.createElement('dialog');
mapDialog.className = 'gallery-map';
mapDialog.setAttribute('aria-label', '团队知识图谱');
document.body.append(mapDialog);
const galleryTitle = document.title;
function closeMap() {
  if (mapDialog.open) history.back();
}
function displayMap(url) {
  const frame = document.createElement('iframe');
  frame.title = '团队知识图谱';
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc?.querySelector('.knowledge-page')) {
      location.replace(url);
      return;
    }
    document.title = doc.title;
    doc.addEventListener('click', event => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link) return;
      const target = new URL(link.href);
      if (target.origin !== location.origin) return;
      if (target.searchParams.get('entry') === 'return-from-map') {
        event.preventDefault();
        closeMap();
      } else if (target.pathname.endsWith('/knowledge.html')) {
        event.preventDefault();
        openMap(target.href);
      }
    });
    doc.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeMap();
    });
    frame.focus();
  }, { once:true });
  frame.src = url;
  mapDialog.replaceChildren(frame);
  if (!mapDialog.open) mapDialog.showModal();
}
function openMap(href) {
  const url = new URL(href, location.href);
  const state = { galleryMap: url.href };
  if (mapDialog.open) history.replaceState(state, '', url);
  else history.pushState(state, '', url);
  displayMap(url.href);
}
mapDialog.addEventListener('cancel', event => { event.preventDefault(); closeMap(); });
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link || !new URL(link.href).pathname.endsWith('/knowledge.html')) return;
  event.preventDefault();
  openMap(link.href);
});
window.addEventListener('popstate', () => {
  if (history.state?.galleryMap) displayMap(history.state.galleryMap);
  else if (mapDialog.open) {
    mapDialog.close();
    mapDialog.replaceChildren();
    document.title = galleryTitle;
  }
});
