(() => {
  'use strict';
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const stage = document.querySelector('.stage');
  const svg = document.querySelector('.leads');
  const notes = Array.from(document.querySelectorAll('.note'));
  const motion = document.querySelector('.motion');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = 2 * Math.PI;
  const faces = [];
  const normalize = v => { const d = Math.hypot(...v) || 1; return v.map(n => n/d); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const minus = (a,b) => a.map((n,i)=>n-b[i]);
  function surface(rows, columns, sample) {
    const rings = Array.from({length:rows+1}, (_,i) =>
      Array.from({length:columns+1}, (_,j) => sample(i/rows,j/columns)));
    for(let i=0;i<rows;i++) for(let j=0;j<columns;j++)
      faces.push([rings[i][j],rings[i+1][j],rings[i+1][j+1],rings[i][j+1]]);
  }
  function tube(path, radius, rows, sides) {
    surface(rows,sides,(u,v) => {
      const p=path(u*tau), tangent=normalize(minus(path(u*tau+.002),path(u*tau-.002)));
      const normal=normalize(cross(tangent,[0,0,1])), binormal=cross(tangent,normal);
      return p.map((a,k)=>a+radius*(normal[k]*Math.cos(v*tau)+binormal[k]*Math.sin(v*tau)));
    });
  }
  const team=document.body.dataset.team;
  if(team==='software'){
    tube(t=>[(1+.38*Math.cos(3*t))*Math.cos(2*t),(1+.38*Math.cos(3*t))*Math.sin(2*t),.46*Math.sin(3*t)],.19,80,9);
  }else if(team==='design'){
    surface(78,12,(u,v)=>{
      const t=u*tau, w=(v-.5)*1.05;
      return [(1+w*Math.cos(t/2))*Math.cos(t),(1+w*Math.cos(t/2))*Math.sin(t),w*Math.sin(t/2)];
    });
  }else if(team==='operations'){
    for(const side of [-1,1]){
      const tilt=side===1?1.17:-.3;
      tube(t=>[side*.52+.79*Math.cos(t),.79*Math.sin(t)*Math.cos(tilt),.79*Math.sin(t)*Math.sin(tilt)],.16,52,9);
    }
  }else{
    const plate=(w,y,h,cut)=>{
      const outline=[[-w+cut,-w],[w-cut,-w],[w,-w+cut],[w,w-cut],[w-cut,w],[-w+cut,w],[-w,w-cut],[-w,-w+cut]];
      const ring=dy=>outline.map(([x,z])=>[x,y+dy,z]);
      const top=ring(h), bottom=ring(-h);
      faces.push(top,bottom);
      for(let i=0;i<8;i++){const j=(i+1)%8; faces.push([top[i],top[j],bottom[j],bottom[i]]);}
    };
    for (const y of [-.55,-.18,.18,.55]) plate(.92,y,.075,.18);
    plate(.56,.75,.10,.12);
  }
  const palette={software:[37,60,91],design:[61,56,87],hardware:[37,68,77],operations:[34,71,66]}[team];
  const radius=Math.max(...faces.flat().map(p=>Math.hypot(...p)));
  const ids=new Map(), vertices=[];
  const mesh=faces.map(face=>face.map(v=>{
    if(!ids.has(v)){ids.set(v,vertices.length);vertices.push(v);} return ids.get(v);
  }));
  const ns='http://www.w3.org/2000/svg';
  function vector(tag, attrs, parent) {
    const el=document.createElementNS(ns,tag);
    Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));parent.append(el);return el;
  }
  const compact = matchMedia('(max-width:1000px)');
  const pinGroup = document.createElement('div');
  pinGroup.className = 'mobile-pins';
  pinGroup.setAttribute('role','group');
  pinGroup.setAttribute('aria-label','选择要阅读的要素');
  const pins = notes.map((note,i)=>{
    note.id = 'question-'+(i+1);
    const pin = document.createElement('button');
    pin.type='button'; pin.className='pin pin-'+(i+1);
    pin.setAttribute('aria-controls',note.id);
    const ordinal = note.querySelector('.ordinal').cloneNode(true);
    const label = Array.from(note.querySelector('h2').childNodes).find(n=>n.nodeType===3).textContent;
    pin.append(ordinal,document.createTextNode(label));
    pin.addEventListener('click',()=>selectQuestion(i));
    pinGroup.append(pin);
    return pin;
  });
  function selectQuestion(index){
    notes.forEach((note,i)=>{
      note.classList.toggle('selected',i===index);
      pins[i].setAttribute('aria-pressed',String(i===index));
    });
  }
  document.querySelector('.specimen').append(pinGroup);
  stage.classList.add('has-pins');
  selectQuestion(0);
  const frost=document.querySelector('.frost');
  let pointer=null;
  const leaders=notes.map(note=>{
    const group=vector('g',{},svg);
    const path=vector('path',{fill:'none',stroke:'#61717f','stroke-width':1},group);
    const marker=vector('g',{},group);
    vector('rect',{x:-6,y:-6,width:12,height:12,fill:'#fcfcfb',stroke:'#435162'},marker);
    vector('rect',{x:-2.5,y:-2.5,width:5,height:5,fill:'#283748'},marker);
    note.addEventListener('pointerenter',()=>{path.setAttribute('stroke','#193f6c');note.classList.add('active');});
    note.addEventListener('pointerleave',()=>{path.setAttribute('stroke','#61717f');note.classList.remove('active');});
    return {path,marker,note};
  });
  let bounds, anchors, width,height,scale,frame=0,last=0,heading=.27,pitch=-.43;
  let paused=preference.matches,visible=true,step=-1,clock=0;
  function measure(){
    const board=stage.getBoundingClientRect(), box=canvas.getBoundingClientRect();
    width=box.width;height=box.height;
    const ratio=Math.min(devicePixelRatio||1,1.75);
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    scale=Math.min(width,height)*.43/radius;
    bounds={x:box.left-board.left+width/2,y:box.top-board.top+height/2};
    anchors=(compact.matches?pins:notes).map(note=>{
      const b=note.getBoundingClientRect();
      const x=b.left-board.left,y=b.top-board.top;
      return {x:bounds.x < x?x:bounds.x > x+b.width?x+b.width:Math.max(x+10,Math.min(x+b.width-10,bounds.x)),
        y:bounds.y < y?y:bounds.y > y+b.height?y+b.height:y+b.height*.6};
    });
    step=-1;draw();schedule();
  }
  function draw(){
    const yaw=heading,tilt=pitch,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(tilt),sp=Math.sin(tilt);
    const points=vertices.map(([x,y,z])=>{
      const xx=x*cy-z*sy,zz=x*sy+z*cy;
      return [xx,y*cp-zz*sp,y*sp+zz*cp];
    });
    ctx.clearRect(0,0,width,height);
    const ordered=mesh.map((ids,i)=>({ids,i,z:ids.reduce((d,id)=>d+points[id][2],0)/ids.length})).sort((a,b)=>a.z-b.z);
    const project=p=>[width/2+p[0]*scale,height/2-p[1]*scale];
    const screen = points.map(project);
    let overSurface = false;
    for(const {ids,i} of ordered){
      const p=points[ids[0]], normal=normalize(cross(minus(points[ids[1]],p),minus(points[ids[2]],p)));
      const sign=normal[2]<0?-1:1, light=.24+.69*Math.max(0,sign*(-normal[0]*.42+normal[1]*.64+normal[2]*.58));
      const rgb=palette.map(n=>Math.round(n+(239-n)*light));
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.strokeStyle='rgba(39,57,73,.36)';ctx.lineWidth=.55;
      ctx.beginPath();ids.forEach((id,k)=>{const [x,y]=screen[id];k?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.closePath();ctx.fill();ctx.stroke();
      if(pointer&&!overSurface){
        const ratio=canvas.width/width;
        overSurface=ctx.isPointInPath(pointer.x*ratio,pointer.y*ratio);
      }
      if(i%11===0 && normal[2]*sign>.5 && width>230){
        const [x,y]=project(p);ctx.fillStyle='#30465895';ctx.font='6px monospace';ctx.fillText(i%2?'·':'+',x,y);
      }
    }
    frost.classList.toggle('lit',overSurface);
    if(overSurface){
      frost.style.left=Math.round(pointer.x/8)*8+'px';
      frost.style.top=Math.round(pointer.y/8)*8+'px';
    }
    const tickIndex=Math.floor(clock/195);
    if(tickIndex===step)return;
    step=tickIndex;
    leaders.forEach(({path,marker},i)=>{
      const end=anchors[i], dx=end.x-bounds.x, dy=end.y-bounds.y;
      const mag=Math.hypot(dx,dy)||1, reach=Math.min(width,height)*.34;
      const burst=(step+i*3)%11;
      const jitter=!paused && burst<3;
      const x=Math.round(bounds.x+dx/mag*reach+(jitter?[3,-4,2][burst]:0));
      const y=Math.round(bounds.y+dy/mag*reach+(jitter?[-3,2,4][burst]:0));
      const elbow=Math.round(x+(end.x-x)*.42);
      path.setAttribute('d','M'+x+' '+y+' H'+elbow+' L'+end.x+' '+end.y);
      marker.setAttribute('transform','translate('+x+' '+y+')');
      path.setAttribute('opacity',jitter&&burst===1?'.48':'.91');
      marker.setAttribute('opacity',jitter&&burst===0?'.42':'1');
    });
  }
  function tick(now){
    frame=0;if(!visible||document.hidden)return;
    if(now-last>32){
      if(!paused){
        const delta=Math.min(now-last,70);
        heading+=delta*.00018;clock+=delta;
      }
      draw();last=now;
    }
    if(!paused)schedule();
  }
  function schedule(){if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse' || preference.matches)return;
    const b=canvas.getBoundingClientRect();
    pointer={x:e.clientX-b.left,y:e.clientY-b.top};
    if(paused)draw();
  });
  canvas.addEventListener('pointerleave',()=>{pointer=null;frost.classList.remove('lit');});
  function updateMotion(){
    motion.hidden=false;motion.textContent=paused?'▷':'Ⅱ';
    motion.setAttribute('aria-label',motion.title=paused?'继续旋转':'暂停旋转');step=-1;draw();schedule();
  }
  motion.addEventListener('click',()=>{paused=!paused;updateMotion();});
  preference.addEventListener('change',()=>{paused=preference.matches;pointer=null;updateMotion();});
  document.addEventListener('visibilitychange',()=>{last=0;schedule();});
  const observer=new ResizeObserver(measure);observer.observe(stage);observer.observe(canvas);notes.forEach(n=>observer.observe(n));
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)schedule();}).observe(stage);
  compact.addEventListener('change', measure);
  measure();updateMotion();
})();
