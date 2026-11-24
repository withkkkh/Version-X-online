// Slide the outgoing still over the next view. The WebGL viewer stays mounted
// and in the viewport, so switching exhibits never requires a blank canvas.
export function installSceneSlide(model) {
  const screen = model.parentElement;
  let image;

  function clear() {
    image?.remove();
    image = undefined;
    model.style.removeProperty('clip-path');
  }

  function capture() {
    clear();
    const source = [...(model.shadowRoot?.querySelectorAll('canvas') || [])]
      .find(canvas => canvas.getBoundingClientRect().width > 0 && canvas.width && canvas.height);
    if (!source) return false;
    try {
      const still = document.createElement('canvas');
      still.width = Math.min(source.width, Math.ceil(screen.clientWidth * 1.5));
      still.height = Math.round(still.width * screen.clientHeight / Math.max(1, screen.clientWidth));
      const ctx = still.getContext('2d');
      // Some drivers clear the WebGL drawing buffer after presentation.
      // Fall back to an ordinary live camera move if there is no exhibit in it.
      const sample = document.createElement('canvas');
      sample.width = sample.height = 16;
      const probe = sample.getContext('2d');
      probe.drawImage(source, 0, 0, 16, 16);
      if (!probe.getImageData(0, 0, 16, 16).data.some((v, i) => i % 4 === 3 && v > 32)) return false;
      ctx.drawImage(source, 0, 0, still.width, still.height);
      still.className = 'tour-slide-frame';
      still.setAttribute('aria-hidden','true');
      screen.append(still);
      image = still;
      return true;
    } catch {
      clear();
      return false;
    }
  }

  function draw(progress) {
    if (!image) return;
    if (progress >= 1) { clear(); return; }
    const eased = progress * progress * (3 - 2 * progress);
    image.style.transform = 'translateX(' + (-100 * eased) + '%)';
    model.style.clipPath = 'inset(0 0 0 ' + (100 * (1 - eased)) + '%)';
  }

  return { capture, draw, clear };
}
