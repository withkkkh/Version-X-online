import { TOUR_DURATION, tourFrame } from './tour-timeline.js?v=1';
export function installWalk(stage, model, setView, applyTourCamera) {
  const player=stage.querySelector('#tour-player'),title=player.querySelector('#tour-title'),caption=player.querySelector('#tour-caption');
  const progress=player.querySelector('#tour-progress'),clock=player.querySelector('#tour-time'),pauseButton=player.querySelector('#tour-pause');
  const exit=player.querySelector('#tour-exit'),replay=stage.querySelector('#tour-replay');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let state='idle',elapsed=0,began=0,frame,sceneIndex=-1;
  const now=()=>performance.now();
  const currentTime=()=>state==='playing'?Math.min(TOUR_DURATION,elapsed+(now()-began)/1000):elapsed;
  function changeState(next){
    state=next;player.dataset.state=next;
    stage.classList.toggle('tour-active',['playing','paused','waiting'].includes(next));
    model.toggleAttribute('data-touring',next==='playing');
    pauseButton.textContent=next==='playing'?'暂停':'继续播放';pauseButton.disabled=next==='waiting';progress.disabled=next==='waiting';
  }
  function clearHighlight(){stage.querySelectorAll('[data-tour-highlight]').forEach(n=>n.removeAttribute('data-tour-highlight'));}
  function render(time,forceCamera=false){
    const result=tourFrame(time);
    if(sceneIndex!==result.index){
      sceneIndex=result.index;title.textContent=result.scene.title;caption.textContent=result.scene.text;clearHighlight();
      for(const key of result.scene.keys){
        const [kind,team]=key.split('-');
        stage.querySelectorAll('[slot="hotspot-'+key+'"],.still-points [data-'+(kind==='team'?'team':'zone')+'="'+team+'"]').forEach(n=>n.setAttribute('data-tour-highlight',''));
      }
    }
    progress.value=time;clock.textContent='00:'+String(Math.floor(time)).padStart(2,'0')+' / 00:30';
    if(model.loaded&&(!reducedMotion.matches||forceCamera))applyTourCamera(result.view);
  }
  function stop({reset=false,restoreFocus=false,complete=false}={}){
    if(state==='idle')return;cancelAnimationFrame(frame);changeState(complete?'complete':'idle');player.hidden=true;
    stage.classList.remove('tour-active');clearHighlight();
    if(reset)setView('overview',true);if(restoreFocus)replay.focus({preventScroll:true});
  }
  function tick(){
    if(state!=='playing')return;const time=currentTime();render(time);
    if(time>=TOUR_DURATION){elapsed=TOUR_DURATION;stop({reset:true,restoreFocus:player.contains(document.activeElement),complete:true});return;}
    frame=requestAnimationFrame(tick);
  }
  function pause(){if(state!=='playing')return;elapsed=currentTime();cancelAnimationFrame(frame);changeState('paused');}
  function resume(){if(state!=='paused'||document.hidden)return;render(elapsed,true);began=now();changeState('playing');frame=requestAnimationFrame(tick);}
  function beginPlayback(){if(state!=='waiting')return;elapsed=0;sceneIndex=-1;render(0,true);began=now();changeState('playing');frame=requestAnimationFrame(tick);}
  function start(){
    stop();stage.querySelector('.directory').open=false;model.dispatchEvent(new CustomEvent('tour-start'));
    player.hidden=false;progress.value=0;clock.textContent='00:00 / 00:30';title.textContent='正在准备展馆';caption.textContent='模型准备好后，带你用30秒认识这里。';
    changeState('waiting');exit.focus({preventScroll:true});if(model.loaded)beginPlayback();
  }
  model.addEventListener('load',beginPlayback);model.addEventListener('error',()=>stop());
  pauseButton.addEventListener('click',()=>state==='playing'?pause():resume());exit.addEventListener('click',()=>stop({reset:true,restoreFocus:true}));
  progress.addEventListener('pointerdown',pause);
  progress.addEventListener('input',()=>{
    elapsed=Number(progress.value);began=now();render(elapsed,true);
    progress.setAttribute('aria-valuetext',Math.round(elapsed)+'秒，共30秒');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  stage.addEventListener('click',event=>{if(event.target.closest('[data-view],#reset,summary,.team-hotspot,#expand'))stop();},true);
  model.addEventListener('pointerdown',pause,true);model.addEventListener('wheel',pause,{capture:true,passive:true});
  model.addEventListener('focusin',event=>{if(event.target.closest('.team-hotspot'))pause();});
  model.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-'].includes(event.key))pause();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&['playing','paused','waiting'].includes(state)){event.preventDefault();stop({reset:true,restoreFocus:true});}});
  return {start,stop,get active(){return ['playing','paused','waiting'].includes(state);}};
}
