import { TOUR_SCENES, sceneFrame, isTeamSwitch } from './tour-timeline.js?v=3';
import { installSceneSlide } from './scene-slide.js?v=1';

export function installWalk(stage,model,setView,applyTourCamera,fitTourCamera) {
  const player=stage.querySelector('#tour-player'),title=player.querySelector('#tour-title'),caption=player.querySelector('#tour-caption');
  const pauseButton=player.querySelector('#tour-pause'),nextButton=player.querySelector('#tour-next');
  const exit=player.querySelector('#tour-exit'),replay=stage.querySelector('#tour-replay');
  const slide=installSceneSlide(model);
  const defaultMinimum=model.getAttribute('min-camera-orbit');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let state='idle',index=0,elapsed=0,began=0,frame,from,lastView,destination,pausedView,horizontal=false,revision=0;
  const active=()=>['playing','paused','waiting','preparing'].includes(state);
  const currentTime=()=>state==='playing'?elapsed+(performance.now()-began)/1000:elapsed;
  function changeState(next){
    state=next;player.dataset.state=next;
    stage.classList.toggle('tour-active',active());model.toggleAttribute('data-touring',next==='playing');
    pauseButton.textContent=next==='playing'?'暂停':'继续播放';
    pauseButton.disabled=['waiting','preparing'].includes(next);nextButton.disabled=['waiting','preparing'].includes(next);
  }
  function clearHighlight(){stage.querySelectorAll('[data-tour-highlight]').forEach(n=>n.removeAttribute('data-tour-highlight'));}
  function render(){
    const scene=TOUR_SCENES[index],time=currentTime();
    if(horizontal&&!reducedMotion.matches){
      const progress=Math.min(1,time/scene.move);
      lastView=slide.hasImage||progress>=.5?destination:from;
      applyTourCamera(lastView);slide.draw(progress);
      nextButton.disabled=progress<1;
    }else{
      lastView=sceneFrame(index,reducedMotion.matches?scene.move:time,from,destination);
      applyTourCamera(lastView);
    }
  }
  function describeScene(){
    const scene=TOUR_SCENES[index];player.dataset.scene=String(index);
    title.textContent=scene.title;caption.textContent=scene.text;
    nextButton.textContent=index===TOUR_SCENES.length-1?'开始自由参观':'下一幕';
    destination=fitTourCamera(scene.camera);clearHighlight();
    for(const key of scene.keys){
      const [kind,team]=key.split('-');
      stage.querySelectorAll('[slot="hotspot-'+key+'"],.still-points [data-'+(kind==='team'?'team':'zone')+'="'+team+'"]').forEach(n=>n.setAttribute('data-tour-highlight',''));
    }
  }
  function stop({reset=false,restoreFocus=false,complete=false}={}){
    if(state==='idle')return;
    revision++;slide.clear();horizontal=false;
    cancelAnimationFrame(frame);changeState(complete?'complete':'idle');player.hidden=true;clearHighlight();model.setAttribute('min-camera-orbit',defaultMinimum);model.removeAttribute('max-field-of-view');
    if(reset)setView('overview',true);if(restoreFocus)replay.focus({preventScroll:true});
  }
  function actualCamera(){
    const orbit=model.getCameraOrbit(),target=model.getCameraTarget();
    return {target:[target.x,target.y,target.z],orbit:[orbit.theta*180/Math.PI,orbit.phi*180/Math.PI,orbit.radius],fov:model.getFieldOfView()};
  }
  async function nextScene(){
    if(!['playing','paused'].includes(state)||nextButton.disabled)return;
    if(index===TOUR_SCENES.length-1){stop({reset:true,restoreFocus:player.contains(document.activeElement),complete:true});return;}
    const current=++revision;
    cancelAnimationFrame(frame);from=actualCamera();
    horizontal=isTeamSwitch(index+1)&&!reducedMotion.matches;
    if(horizontal){
      elapsed=currentTime();changeState('preparing');await slide.capture();
      if(current!==revision)return;
    }else slide.clear();
    index++;elapsed=0;began=performance.now();describeScene();changeState('playing');render();
    if(document.hidden){pause();return;}
    frame=requestAnimationFrame(tick);
  }
  function tick(){
    if(state!=='playing')return;
    render();const scene=TOUR_SCENES[index];
    if(currentTime()>=scene.move+scene.hold){nextScene();return;}
    frame=requestAnimationFrame(tick);
  }
  function pause(){if(state!=='playing')return;elapsed=currentTime();pausedView=actualCamera();cancelAnimationFrame(frame);changeState('paused');if(horizontal&&elapsed<TOUR_SCENES[index].move)nextButton.disabled=true;}
  function resume(){
    if(state!=='paused'||document.hidden)return;
    const current=actualCamera();
    const moved=current.target.some((v,i)=>Math.abs(v-pausedView.target[i])>.01)||current.orbit.some((v,i)=>Math.abs(i===0?((v-pausedView.orbit[i]+540)%360)-180:v-pausedView.orbit[i])>.01)||Math.abs(current.fov-pausedView.fov)>.01;
    if(moved){from=current;elapsed=0;}
    began=performance.now();changeState('playing');frame=requestAnimationFrame(tick);
  }
  function beginPlayback(){
    if(state!=='waiting')return;
    index=0;horizontal=false;elapsed=0;began=performance.now();describeScene();from=destination;
    changeState('playing');render();frame=requestAnimationFrame(tick);
  }
  function start(){
    stop();stage.querySelector('.directory').open=false;model.dispatchEvent(new CustomEvent('tour-start'));
    model.setAttribute('min-camera-orbit','auto auto 2m');
    player.dataset.scene='0';player.hidden=false;title.textContent='正在准备展馆';caption.textContent='展馆准备好后，带你从海报开始参观。';
    changeState('waiting');nextButton.focus({preventScroll:true});if(model.loaded)beginPlayback();
  }
  model.addEventListener('load',beginPlayback);model.addEventListener('error',()=>stop());
  pauseButton.addEventListener('click',()=>state==='playing'?pause():resume());
  nextButton.addEventListener('click',nextScene);exit.addEventListener('click',()=>stop({reset:true,restoreFocus:true}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  stage.addEventListener('click',event=>{if(event.target.closest('[data-view],#reset,summary,.team-hotspot,#expand'))stop();},true);
  function takeControl(){
    if(state==='preparing'){revision++;slide.clear();horizontal=false;pausedView=actualCamera();changeState('paused');return;}
    pause();if(horizontal){slide.clear();horizontal=false;elapsed=Math.max(elapsed,TOUR_SCENES[index].move);nextButton.disabled=false;}
  }
  model.addEventListener('pointerdown',takeControl,true);model.addEventListener('wheel',takeControl,{capture:true,passive:true});
  model.addEventListener('focusin',event=>{if(event.target.closest('.team-hotspot'))pause();});
  model.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-'].includes(event.key))takeControl();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active()){event.preventDefault();stop({reset:true,restoreFocus:true});}});
  return {start,stop,get active(){return active();}};
}
