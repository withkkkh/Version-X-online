import { slideFrame } from './tour-timeline.js?v=3';

// Copy the rendered canvas without encoding it: no second 3D scene or GPU load.
export function installSceneSlide(model) {
  const screen=model.parentElement;
  let image,revision=0;
  function clear(){
    revision++;if(image){image.remove();image.width=0;image.height=0;}image=undefined;
    model.style.removeProperty('transform');model.style.removeProperty('will-change');
  }
  async function capture(){
    clear();const current=revision;
    try{
      // model-viewer keeps a hidden poster canvas beside the live WebGL canvas.
      const source=[...(model.shadowRoot?.querySelectorAll('canvas')||[])].find(canvas=>canvas.getBoundingClientRect().width>0);
      if(!source||!source.width||!source.height)return false;
      image=document.createElement('canvas');image.width=source.width;image.height=source.height;
      image.className='tour-slide-frame';image.setAttribute('aria-hidden','true');
      image.getContext('2d').drawImage(source,0,0);
      if(current!==revision)return false;
      screen.append(image);return true;
    }catch{if(current===revision)clear();return false;}
  }
  function draw(progress){
    if(progress>=1){clear();return;}
    model.style.willChange='transform';
    if(image){
      const pose=slideFrame(progress);image.style.transform=`translateX(${pose.outgoing}%)`;
      model.style.transform=`translateX(${pose.incoming}%)`;
    }else{
      const p=progress<.5?slideFrame(progress*2).outgoing:slideFrame((progress-.5)*2).incoming;
      model.style.transform=`translateX(${p}%)`;
    }
  }
  return {capture,draw,clear,get hasImage(){return Boolean(image);}};
}
