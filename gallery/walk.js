import { TOUR_SCENES, sceneFrame, isTeamSwitch } from './tour-timeline.js?v=5';
import { installSceneSlide } from './scene-slide.js?v=2';

export function installWalk(stage, model, setView, applyTourCamera, fitTourCamera) {
  const player = stage.querySelector('#tour-player');
  const title = player.querySelector('#tour-title');
  const caption = player.querySelector('#tour-caption');
  const number = player.querySelector('.tour-count');
  const progress = player.querySelector('.tour-progress span');
  const exit = player.querySelector('#tour-exit');
  const replay = stage.querySelector('#tour-replay');
  const slide = installSceneSlide(model);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const defaultMinimum = model.getAttribute('min-camera-orbit');
  const locked = [model, stage.querySelector('.still-points'), stage.querySelector('.toolbar'),
    stage.querySelector('.stage-foot')].filter(Boolean);
  let state = 'idle', index = 0, elapsed = 0, began = 0, frame;
  let from, destination, lastView, sliding, cameraSettled;
  const active = () => state !== 'idle';
  const clock = () => elapsed + (state === 'playing' ? (performance.now() - began) / 1000 : 0);

  function changeState(value) {
    state = value;
    player.dataset.state = value;
  }
  function clearHighlight() {
    stage.querySelectorAll('[data-tour-highlight]').forEach(el => el.removeAttribute('data-tour-highlight'));
  }
  function stop({ reset = false, restoreFocus = false } = {}) {
    if (!active()) return;
    cancelAnimationFrame(frame);
    slide.clear();
    clearHighlight();
    changeState('idle');
    stage.classList.remove('tour-active');
    locked.forEach(el => { el.inert = false; });
    model.removeAttribute('data-touring');
    model.setAttribute('camera-controls', '');
    model.setAttribute('min-camera-orbit', defaultMinimum);
    model.removeAttribute('max-field-of-view');
    player.hidden = true;
    if (reset) setView('overview', true);
    if (restoreFocus) replay.focus({preventScroll:true});
  }
  function draw(time) {
    const scene = TOUR_SCENES[index];
    const p = Math.min(1, time / scene.move);
    if (!cameraSettled) {
      lastView = sliding || reduced.matches ? destination : sceneFrame(index, time, from, destination);
      applyTourCamera(lastView);
      cameraSettled = sliding || reduced.matches || p === 1;
    }
    if (sliding) slide.draw(p);
    progress.style.transform = 'scaleX(' + Math.min(1, time / (scene.move + scene.hold)) + ')';
  }
  function tick() {
    if (state !== 'playing') return;
    const scene = TOUR_SCENES[index], time = clock();
    draw(time);
    if (time >= scene.move + scene.hold) { advance(); return; }
    frame = requestAnimationFrame(tick);
  }
  function showScene(i) {
    cancelAnimationFrame(frame);
    index = i;
    const scene = TOUR_SCENES[i];
    slide.clear();
    sliding = isTeamSwitch(i) && !reduced.matches && slide.capture();
    destination = fitTourCamera(scene.camera);
    from = i === 0 ? destination : lastView;
    cameraSettled = false;
    elapsed = 0;
    began = performance.now();
    number.textContent = String(i + 1).padStart(2,'0') + ' / ' + String(TOUR_SCENES.length).padStart(2,'0');
    title.textContent = scene.title;
    caption.textContent = scene.text;
    clearHighlight();
    for (const key of scene.keys) model.querySelector('[slot="hotspot-' + key + '"]')?.setAttribute('data-tour-highlight','');
    changeState(document.hidden || state === 'paused' ? 'paused' : 'playing');
    draw(0);
    if (state === 'playing') frame = requestAnimationFrame(tick);
  }
  function advance() {
    if (state !== 'playing' && state !== 'paused') return;
    if (index + 1 < TOUR_SCENES.length) showScene(index + 1);
    else stop({reset:true, restoreFocus:player.contains(document.activeElement)});
  }
  function pause() {
    if (state !== 'playing') return;
    elapsed = clock();
    cancelAnimationFrame(frame);
    changeState('paused');
  }
  function start() {
    stop();
    stage.querySelector('.directory').open = false;
    model.dispatchEvent(new CustomEvent('tour-start'));
    model.removeAttribute('camera-controls');
    model.setAttribute('data-touring', '');
    model.setAttribute('min-camera-orbit','auto auto 2m');
    model.setAttribute('max-field-of-view','110deg');
    locked.forEach(el => { el.inert = true; });
    stage.classList.add('tour-active');
    changeState('waiting');
    player.hidden = false;
    number.textContent = '';
    title.textContent = '正在准备展馆';
    caption.textContent = '';
    progress.style.transform = 'scaleX(0)';
    exit.focus({preventScroll:true});
    if (model.loaded) showScene(0);
  }
  new ResizeObserver(() => {
    if (state !== 'playing' && state !== 'paused') return;
    destination = fitTourCamera(TOUR_SCENES[index].camera);
    cameraSettled = false;
    draw(clock());
  }).observe(model);
  model.addEventListener('load', () => { if (state === 'waiting') showScene(0); });
  exit.addEventListener('click', () => stop({reset:true,restoreFocus:true}));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (state === 'paused') {
      began = performance.now();
      changeState('playing');
      frame = requestAnimationFrame(tick);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active()) {
      event.preventDefault();
      stop({reset:true,restoreFocus:true});
    }
  });
  return {start,stop,get active(){return active();}};
}
