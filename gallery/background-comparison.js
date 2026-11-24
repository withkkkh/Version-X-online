export function installBackgroundComparison(stage,model,pauseTour){
  const versions={
    vi:{label:'A · VI 冰蓝',src:'./assets/gallery-vi-skybox-source.png'},
    studio:{label:'B · 空间贴图',src:'./assets/gallery-studio-skybox.png'},
  };
  const group=document.createElement('section');group.className='environment-comparison';group.setAttribute('aria-label','背景版本对比');
  const label=document.createElement('span');label.textContent='背景对比';group.append(label);
  const buttons=new Map();
  function select(key,updateUrl=true){
    const version=versions[key];
    if(updateUrl)pauseTour();
    if(key==='studio')model.removeAttribute('skybox-image');else model.setAttribute('skybox-image',version.src);model.setAttribute('skybox-height','0m');document.body.dataset.environment=key;
    for(const [value,button]of buttons)button.setAttribute('aria-pressed',String(value===key));
    if(updateUrl){const url=new URL(location.href);url.searchParams.set('background',key);history.replaceState(history.state,'',url);}
  }
  for(const [key,version]of Object.entries(versions)){
    const button=document.createElement('button');button.type='button';button.textContent=version.label;button.dataset.background=key;button.addEventListener('click',()=>select(key));buttons.set(key,button);group.append(button);
  }
  stage.append(group);
  const key=new URL(location.href).searchParams.get('background');select(Object.hasOwn(versions,key)?key:'vi',false);
}
