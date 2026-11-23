import { installWalk } from './walk.js?v=tour2';
import { installStillHotspots } from './still-hotspots.js?v=1';
import { startModel } from './gallery-runtime.js?v=study1';
import { installTeamHotspots } from './team-hotspots.js?v=tour1';
const model=document.querySelector('#model');
if(new URL(location.href).searchParams.get('look')!=='original'){
  model.dataset.src='./assets/version-x-gallery-study.glb';model.dataset.mobileSrc='./assets/gallery-mobile-study.bin';
  model.setAttribute('exposure','.80');model.setAttribute('shadow-intensity','1');model.setAttribute('shadow-softness','.75');
}
customElements.whenDefined('model-viewer').then(()=>{
  const style=document.createElement('style');style.textContent='@media (any-pointer:fine){:host *{cursor:var(--exhibition-cursor)!important}}';model.shadowRoot?.append(style);
});
const stage=document.querySelector('#stage'),opening=document.querySelector('#opening'),preview=opening.querySelector('.facade-preview'),address=preview.querySelector('.opening-address');
const chrome=[document.querySelector('.mast'),document.querySelector('main')];
const status=document.querySelector('#status'),loading=document.querySelector('#model-loading'),screen=document.querySelector('.screen'),expand=document.querySelector('#expand');
const presetButtons=[...document.querySelectorAll('[data-view]')],directory=stage.querySelector('.directory');
let phase='opening';
const views={
  'rack-design':{target:[0,1.33,-6.36],orbit:[9,60,5.5],fov:39,fitByFov:true},
  'rack-software':{target:[0,1.33,6.36],orbit:[188,60,5.5],fov:39,fitByFov:true},
  'rack-hardware':{target:[7.57,1.33,0],orbit:[-82,67,5.8],fov:39,fitByFov:true},
  'rack-operations':{target:[-7.57,1.33,0],orbit:[82,67,5.8],fov:39,fitByFov:true},
  overview:{target:[0,-1.5,0],orbit:[24,58,34],fov:42},top:{target:[0,0,0],orbit:[0,3,40],fov:42},
  sculpture:{target:[0,5.99,0],orbit:[0,.1,7],fov:32},facade:{target:[-6.32,.94,9.11],orbit:[12,85,6.5],fov:36},
};
function fittedView(view){
  const {width,height}=model.getBoundingClientRect();
  if(view.tour&&view.fitByFov){
    // model-viewer preserves the smaller-axis field of view in portrait.
    const aspect=Math.max(1,width/Math.max(1,height));
    return {...view,fov:Math.min(110,Math.max(view.fov,Math.atan(view.frameWidth/(2*view.orbit[2]*.9*aspect))*360/Math.PI))};
  }
  const fit=width>0&&height>0?Math.max(1,(view===views.overview?1.48:1.4)*height/width):1;
  const multiplier=view===views.overview||view===views.top||view.tour?Math.min(1.65,fit):fit;
  if(view.fitByFov)return {...view,fov:Math.atan(multiplier*Math.tan(view.fov*Math.PI/360))*360/Math.PI};
  return {...view,orbit:[...view.orbit.slice(0,2),view.orbit[2]*multiplier]};
}
function applyCamera(view,immediate=false){
  model.setAttribute('camera-target',view.target.map(v=>v.toFixed(3)+'m').join(' '));
  model.setAttribute('camera-orbit',view.orbit.map((v,i)=>v.toFixed(3)+(i===2?'m':'deg')).join(' '));
  model.setAttribute('field-of-view',view.fov.toFixed(2)+'deg');if(immediate)model.jumpCameraToGoal?.();
}
function setView(name,immediate=false){
  const view=views[name];if(view.fitByFov)model.setAttribute('max-field-of-view','80deg');else model.removeAttribute('max-field-of-view');
  applyCamera(fittedView(view),immediate);presetButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
}
installTeamHotspots(model,stage,openMap);installStillHotspots(stage,model);
const walk=installWalk(stage,model,setView,view=>{model.setAttribute('max-field-of-view','110deg');applyCamera(view,true);presetButtons.forEach(b=>b.setAttribute('aria-pressed','false'));},view=>fittedView({...view,tour:true}));
function closeDirectory(restoreFocus=false){directory.open=false;if(restoreFocus)directory.querySelector('summary').focus({preventScroll:true});}
presetButtons.forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.view);if(directory.contains(b))closeDirectory(true);}));
document.querySelector('#reset').addEventListener('click',()=>setView('overview',true));
document.addEventListener('pointerdown',e=>{if(directory.open&&!directory.contains(e.target))closeDirectory();});
model.addEventListener('camera-change',e=>{if(phase==='gallery'&&e.detail.source==='user-interaction')presetButtons.forEach(b=>b.setAttribute('aria-pressed','false'));});
function setExpanded(show){
  stage.classList.toggle('expanded',show);document.body.classList.toggle('with-expanded-stage',show);
  expand.setAttribute('aria-pressed',String(show));expand.setAttribute('aria-label',show?'退出放大预览':'放大预览');expand.querySelector('.expand-text').textContent=show?'退出放大':'放大';
}
expand.addEventListener('click',()=>setExpanded(!stage.classList.contains('expanded')));
window.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented)return;if(directory.open)closeDirectory(true);else if(phase==='address')enterGallery();else if(stage.classList.contains('expanded'))setExpanded(false);});
function enterGallery(guided=false){
  phase='gallery';opening.hidden=true;preview.hidden=true;address.hidden=true;opening.classList.remove('waiting-facade');preview.classList.remove('reading-address');
  document.body.classList.remove('opening-active');document.body.classList.add('gallery-ready');chrome.forEach(el=>el.inert=false);setView('overview',true);
  if(guided&&!viewerError)walk.start();else presetButtons[0].focus({preventScroll:true});
}
function showIntroduction(){
  document.documentElement.classList.remove('direct-gallery');
  walk.stop();closeDirectory();phase='address';opening.hidden=false;preview.hidden=false;address.hidden=false;
  opening.classList.add('waiting-facade');preview.classList.add('reading-address');document.body.classList.add('opening-active');chrome.forEach(el=>el.inert=true);address.querySelector('h2').focus({preventScroll:true});
}
document.querySelector('#open-gallery').addEventListener('click',()=>enterGallery(true));document.querySelector('#explore-gallery').addEventListener('click',()=>enterGallery());
document.querySelector('#read-introduction').addEventListener('click',showIntroduction);document.querySelector('#read-introduction-again').addEventListener('click',showIntroduction);
address.querySelector('#start-walk').addEventListener('click',()=>enterGallery(true));address.querySelector('#skip-walk').addEventListener('click',()=>enterGallery());
document.querySelector('#tour-replay').addEventListener('click',()=>walk.start());
let waitNotice,lastProgress=-1,viewerError=false;
function onLoaded(){clearTimeout(waitNotice);viewerError=false;document.querySelector('#tour-replay').disabled=false;loading.hidden=true;status.hidden=true;loading.classList.remove('has-error');screen.setAttribute('aria-busy','false');model.classList.add('model-loaded');if(!walk.active)setView('overview',true);}
function showRetry(message){
  const retry=document.createElement('button');retry.type='button';retry.textContent='重新加载';retry.onclick=()=>{const url=new URL(location.href);url.searchParams.set('entry','return-from-map');location.assign(url);};status.replaceChildren(message,' ',retry);
}
function loadingError(){viewerError=true;document.querySelector('#tour-replay').disabled=true;clearTimeout(waitNotice);walk.stop();model.classList.remove('model-loaded');loading.hidden=false;status.hidden=false;loading.classList.add('has-error');screen.setAttribute('aria-busy','false');showRetry('三维模型暂时无法显示，可从「展区目录」继续参观。');}
model.addEventListener('load',onLoaded);model.addEventListener('error',loadingError);
model.addEventListener('progress',e=>{if(model.loaded||viewerError)return;const p=Math.min(99,Math.floor(e.detail.totalProgress*10)*10);if(p!==lastProgress){lastProgress=p;status.textContent='三维展馆加载中 '+p+'% · 可先浏览展区目录';}});
waitNotice=setTimeout(()=>{if(!model.loaded)showRetry('仍在准备三维展馆，可先从「展区目录」参观。');},18000);startModel(model).catch(loadingError);if(model.loaded)onLoaded();
if(document.documentElement.classList.contains('direct-gallery'))enterGallery();else{chrome.forEach(el=>el.inert=true);opening.focus({preventScroll:true});setView('overview',true);}
new ResizeObserver(()=>{if(walk.active)return;const selected=presetButtons.find(b=>b.getAttribute('aria-pressed')==='true');if(selected)setView(selected.dataset.view,true);}).observe(model);

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
