const story = document.querySelector('.story');
const summary = story.querySelector('summary');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let origin;
let animations = [];

function cancelEffects() {
  for (const animation of animations) animation.cancel();
  animations = [];
}

summary.addEventListener('click', event => {
  cancelEffects();
  origin = null;
  if (story.open || reducedMotion.matches || !Element.prototype.animate) return;
  const bubble = summary.querySelector('.bubble').getBoundingClientRect();
  const x = bubble.left + bubble.width / 2;
  const y = bubble.top + bubble.height / 2;
  const hit = event.detail > 0 && Math.hypot(event.clientX - x, event.clientY - y) < bubble.width / 2;
  origin = { x, y, radius: bubble.width / 2, hitX: hit ? event.clientX : x, hitY: hit ? event.clientY : y };
});

function burstPart(className, x, y, frames, duration, diameter) {
  const part = document.createElement('span');
  part.className = className;
  part.setAttribute('aria-hidden', 'true');
  Object.assign(part.style, { left:x+'px', top:y+'px', width:diameter+'px', height:diameter+'px' });
  document.body.append(part);
  const animation = part.animate(frames, { duration, easing:'cubic-bezier(.18,.62,.25,1)', fill:'forwards' });
  animations.push(animation);
  animation.finished.then(() => part.remove(), () => part.remove());
}

story.addEventListener('toggle', () => {
  if (!story.open || !origin || reducedMotion.matches) return;
  const {x,y,radius,hitX,hitY} = origin;
  origin = null;
  burstPart('burst-ring', x, y, [
    {transform:'translate(-50%,-50%) scale(.98)',opacity:.65},
    {transform:'translate(-50%,-50%) scale(1.28)',opacity:0}
  ], 460, radius*2);
  for(let i=0;i<12;i++) {
    const angle = i*Math.PI/6;
    const dx = Math.cos(angle)*radius*(i%2 ? 1.35 : 1.65);
    const dy = Math.sin(angle)*radius*(i%2 ? 1.35 : 1.65);
    burstPart('burst-drop',hitX,hitY,[
      {transform:'translate(-50%,-50%) scale(.5)',opacity:.85},
      {transform:'translate('+dx+'px,'+dy+'px) scale(.25)',opacity:0}
    ],440+(i%3)*60,6+(i%3)*3);
  }
  story.querySelectorAll('article').forEach((article,i) => {
    const rect = article.getBoundingClientRect();
    const dx = (x - rect.left - rect.width/2)*.42;
    const dy = Math.max(-170, Math.min(170,(y - rect.top)*.5));
    animations.push(article.animate([
      {opacity:0,transform:'translate('+dx+'px,'+dy+'px) scale(.87)'},
      {opacity:1,transform:'none'}
    ],{duration:520, delay:i*42, easing:'cubic-bezier(.16,.8,.24,1)',fill:'backwards'}));
  });
});
