import {TOUR_ATTENTION} from './tour-motion-spec.js?v=1';

// All subjects share one attention cue and the camera tour's clock.
const subjects = new Set(['poster','software','hardware','design','operations','knowledge']);

export function installTourMotion(model) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const originalCrossfade = model.getAttribute('animation-crossfade-duration');
  let ready = false, revision = 0, pendingTime = 0, delay = 0;
  function clear() {
    revision++;
    ready = false;
    if (model.animationName?.startsWith('tour-')) {
      model.pause();
      model.currentTime = 0;
      model.animationName = undefined;
    }
    if (originalCrossfade === null) model.removeAttribute('animation-crossfade-duration');
    else model.setAttribute('animation-crossfade-duration', originalCrossfade);
  }
  function sample(seconds) {
    pendingTime = seconds;
    if (!ready) return;
    if (reduced.matches) { clear(); return; }
    model.currentTime = Math.max(0, Math.min(TOUR_ATTENTION.duration, seconds-delay));
  }
  async function show(scene) {
    clear();
    const clip = 'tour-'+scene.motion;
    if (reduced.matches || !subjects.has(scene.motion) || !model.availableAnimations?.includes(clip)) return;
    const current = ++revision;
    delay = scene.move+TOUR_ATTENTION.arrivalDelay;
    pendingTime = 0;
    model.setAttribute('animation-crossfade-duration','0');
    model.animationName = clip;
    await model.updateComplete;
    if (current !== revision) return;
    model.pause();
    ready = true;
    sample(pendingTime);
  }
  model.addEventListener('load', clear);
  reduced.addEventListener('change', () => { if (reduced.matches) clear(); });
  return {show,sample,clear};
}
