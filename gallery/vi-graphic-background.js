// Screen-resolution VI graphics. No panoramic bitmap or texture magnification.
export function installViGraphicBackground(screen){
  const canvas=document.createElement('canvas');canvas.className='vi-graphic-background';canvas.setAttribute('aria-hidden','true');screen.prepend(canvas);
  const context=canvas.getContext('2d',{alpha:false});
  const grain=document.createElement('canvas');grain.width=grain.height=128;
  const grainContext=grain.getContext('2d'),noise=grainContext.createImageData(128,128);
  let seed=29119;
  for(let i=0;i<noise.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed>>>24;noise.data[i]=noise.data[i+1]=noise.data[i+2]=value;noise.data[i+3]=255;}
  grainContext.putImageData(noise,0,0);
  let visible=true,frame;
  function draw(){
    frame=undefined;if(!visible||!context)return;
    const {width:w,height:h}=screen.getBoundingClientRect();if(!w||!h)return;
    const dpr=Math.min(3,devicePixelRatio||1);
    canvas.width=Math.ceil(w*dpr);canvas.height=Math.ceil(h*dpr);canvas.dataset.renderScale=String(dpr);
    const ctx=context;ctx.setTransform(dpr,0,0,dpr,0,0);
    const base=ctx.createLinearGradient(0,0,w,h);base.addColorStop(0,'#a3c3da');base.addColorStop(.42,'#d7e6ef');base.addColorStop(1,'#9cbdd5');ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
    const light=ctx.createRadialGradient(w*.57,h*.23,0,w*.57,h*.23,w*.62);light.addColorStop(0,'#f1f6faad');light.addColorStop(.6,'#d7e8f32e');light.addColorStop(1,'#789fb900');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    // Round-square halftone cells are drawn as vectors at the actual screen scale.
    const pitch=w<600?17:20;
    for(let row=0,y=9;y<h;y+=pitch,row++)for(let col=0,x=9;x<w;x+=pitch,col++){
      const edge=Math.abs(x/w-.5)*2,fade=Math.max(0,Math.min(1,(edge-.33)/.55));
      const wave=(Math.sin(col*.24+Math.cos(row*.16)*1.9)+1)/2;
      const size=1.8+wave*3.6;if(fade<.015)continue;
      ctx.fillStyle=`rgba(72,128,168,${(.055+wave*.12)*fade})`;ctx.beginPath();ctx.roundRect(x-size/2,y-size/2,size,size,size*.35);ctx.fill();
    }
    // Grain is one physical pixel, rather than an enlarged patch of a photograph.
    ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.075;ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  new ResizeObserver(schedule).observe(screen);window.addEventListener('resize',schedule);
  schedule();
  return {setVisible(value){visible=value;canvas.hidden=!value;if(value)schedule();}};
}
