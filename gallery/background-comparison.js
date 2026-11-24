import { installViDirectionalBackground } from './vi-directional-background.js?v=4';
export function installBackgroundComparison(stage,model,pauseTour){
  const graphic=installViDirectionalBackground(model.parentElement,model);
  // The approved VI is the public default. Art-direction controls are opt-in.
  if(new URL(location.href).searchParams.get('compare')!=='backgrounds'){
    model.removeAttribute('skybox-image');model.setAttribute('skybox-height','0m');document.body.dataset.environment='vi';graphic.setVisible(true);return;
  }
  const versions={
    vi:{label:'A · VI 动态版'},
    studio:{label:'B · 空间贴图'},
  };
  const group=document.createElement('section');group.className='environment-comparison';group.setAttribute('aria-label','背景版本对比');
  const label=document.createElement('span');label.textContent='背景对比';group.append(label);
  const buttons=new Map();
  function select(key,updateUrl=true){
    if(updateUrl)pauseTour();
    model.removeAttribute('skybox-image');model.setAttribute('skybox-height','0m');graphic.setVisible(key==='vi');document.body.dataset.environment=key;
    for(const [value,button]of buttons)button.setAttribute('aria-pressed',String(value===key));
    if(updateUrl){const url=new URL(location.href);url.searchParams.set('background',key);history.replaceState(history.state,'',url);}
  }
  for(const [key,version]of Object.entries(versions)){
    const button=document.createElement('button');button.type='button';button.textContent=version.label;button.dataset.background=key;button.addEventListener('click',()=>select(key));buttons.set(key,button);group.append(button);
  }
  stage.append(group);
  const key=new URL(location.href).searchParams.get('background');select(Object.hasOwn(versions,key)?key:'vi',false);
}
