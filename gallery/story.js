(() => {
  'use strict';
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const stage = document.querySelector('.stage');
  const svg = document.querySelector('.leads');
  const notes = Array.from(document.querySelectorAll('.note'));
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
  // Sample the current mesh frame at low resolution to soften only the glass cells.
  const sample=document.createElement('canvas');
  const sampler=sample.getContext('2d');
  let pointer=null;
  const leaders=notes.map((note,index)=>{
    const group=vector('g',{'class':'callout-line'},svg);
    const path=vector('path',{fill:'none',stroke:'currentColor','stroke-width':1},group);
    const marker=vector('g',{},group);
    vector('rect',{x:-8,y:-8,width:16,height:16,fill:'none',stroke:'currentColor'},marker);
    vector('rect',{x:-3.5,y:-3.5,width:7,height:7,fill:'currentColor'},marker);
    note.addEventListener('pointerenter',()=>note.classList.add('active'));
    note.addEventListener('pointerleave',()=>note.classList.remove('active'));
    return {path,marker,group,period:2180+index*487};
  });
  function drawGlass(){
    if(paused || !sampler)return;
    const tile=Math.max(22,Math.round(Math.min(width,height)*.174));
    const interval=pointer?360:680;
    const beat=Math.floor(clock/interval);
    const positions=[[-1,-1],[0,1],[1,0],[-2,0],[0,-2],[-1,1],[1,-1]];
    if(!pointer && beat%7===4)return;
    const originX=pointer?Math.round((pointer.x-width/2)/tile):0;
    const originY=pointer?Math.round((pointer.y-height/2)/tile):0;
    const [col,row]=positions[beat%positions.length];
    const left=width/2+(pointer?originX+(col%2)*.5:col)*tile;
    const top=height/2+(pointer?originY+(row%2)*.5:row)*tile;
    sampler.imageSmoothingQuality="high";
    sampler.clearRect(0,0,sample.width,sample.height);
    sampler.drawImage(canvas,0,0,sample.width,sample.height);
    const count=beat%3===0?2:1;
    for(let i=0;i<count;i++){
      const x=Math.round(left+i*tile),y=Math.round(top);
      ctx.save();
      ctx.beginPath();ctx.rect(x,y,tile,tile);ctx.clip();
      ctx.fillStyle='#fcfcfb';ctx.fillRect(x,y,tile,tile);
      const zoom=1.10;
      const cx=x+tile/2,cy=y+tile/2;
      ctx.filter="blur(1.8px)";
      ctx.drawImage(sample,cx*(1-zoom)+2,cy*(1-zoom)-2,width*zoom,height*zoom);
      ctx.filter="none";
      const tint=ctx.createLinearGradient(x,y,x+tile,y+tile);
      tint.addColorStop(0,'rgba(255,255,255,.32)');tint.addColorStop(.46,'rgba(232,240,244,.12)');
      tint.addColorStop(1,'rgba(154,171,183,.22)');ctx.fillStyle=tint;ctx.fillRect(x,y,tile,tile);
      ctx.strokeStyle='rgba(111,123,134,.42)';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,tile-1,tile-1);
      ctx.fillStyle='rgba(255,255,255,.65)';ctx.fillRect(x+1,y+1,tile-2,1);
      ctx.restore();
    }
  }
  let bounds, anchors, width,height,scale,frame=0,last=0,heading=.27,pitch=-.43;
  let paused=preference.matches,visible=true,clock=0;
  function measure(){
    const board=stage.getBoundingClientRect(), box=canvas.getBoundingClientRect();
    width=box.width;height=box.height;
    const ratio=Math.min(devicePixelRatio||1,1.75);
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    scale=Math.min(width,height)*.477/radius;
    bounds={x:box.left-board.left+width/2,y:box.top-board.top+height/2};
    sample.width=Math.max(1,Math.round(width/6));sample.height=Math.max(1,Math.round(height/6));
    anchors=(compact.matches?pins:notes).map((note,i)=>{
      const b=note.getBoundingClientRect();
      const left=b.left-board.left,top=b.top-board.top;
      const onLeft=left+b.width/2<bounds.x;
      return {x:onLeft?left+b.width:left,y:top+(i===2&&!compact.matches?0:b.height)-.5,side:onLeft?1:-1};
    });
    leaders.forEach(leader=>leader.pose=null);
    draw();schedule();
  }
  function draw(){
    const yaw=heading,tilt=pitch+.17*Math.sin(heading*1.48),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(tilt),sp=Math.sin(tilt);
    const points=vertices.map(([x,y,z])=>{
      const xx=x*cy-z*sy,zz=x*sy+z*cy;
      return [xx,y*cp-zz*sp,y*sp+zz*cp];
    });
    ctx.clearRect(0,0,width,height);
    const ordered=mesh.map((ids,i)=>({ids,i,z:ids.reduce((d,id)=>d+points[id][2],0)/ids.length})).sort((a,b)=>a.z-b.z);
    const project=p=>[width/2+p[0]*scale,height/2-p[1]*scale];
    const screen = points.map(project);

    for(const {ids,i} of ordered){
      const p=points[ids[0]], normal=normalize(cross(minus(points[ids[1]],p),minus(points[ids[2]],p)));
      const sign=normal[2]<0?-1:1, light=.24+.69*Math.max(0,sign*(-normal[0]*.42+normal[1]*.64+normal[2]*.58));
      const sheen = Math.pow(Math.max(0,sign*(-.18*normal[0]+.32*normal[1]+.93*normal[2])),16)*.22;
      const tone = Math.min(1,Math.max(0,(light-.43)*1.3+.42+sheen));
      const rgb=palette.map(n=>Math.round(n+(246-n)*tone));
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.strokeStyle='rgba(39,57,73,.36)';ctx.lineWidth=.55;
      ctx.beginPath();ids.forEach((id,k)=>{const [x,y]=screen[id];k?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.closePath();ctx.fill();ctx.stroke();
      if(i%11===0 && normal[2]*sign>.5 && width>230){
        const [x,y]=project(p);ctx.fillStyle='#30465895';ctx.font='6px monospace';ctx.fillText(i%2?'·':'+',x,y);
      }
    }
    drawGlass();
    leaders.forEach((leader,i)=>{
      const {path,group,marker,period}=leader;
      const elapsed=paused?0:clock+i*543;
      const cycle=Math.floor(elapsed/period),phase=elapsed%period;
      // Hold one drawing, snap through two alternate registrations, then settle.
      const shot=phase<80?1:phase<162?2:phase<254?3:0;
      const pose=cycle*4+shot;
      if(leader.pose===pose)return;
      leader.pose=pose;
      const end=anchors[i];
      const dx=end.x-bounds.x,dy=end.y-bounds.y,dist=Math.hypot(dx,dy)||1;
      const reach=Math.min(dist*.67,Math.min(width,height)*.45);
      const amp=compact.matches?.36:1;
      const offset=(salt)=>Math.sin((cycle+1)*7.73+i*5.83+salt);
      const shift=paused?0:amp*(shot===1?26:shot===2?-20:shot===3?13:8);
      const x=Math.round(bounds.x+dx/dist*reach+shift*offset(1.12));
      const y=Math.round(bounds.y+dy/dist*reach+shift*offset(4.87));
      const run=Math.max(14,Math.min(70,Math.abs(end.x-x)*.34));
      const elbow=end.x+end.side*(run+shift*.4);
      const shoulder=x+(elbow-x)*.46+shift*.44;
      path.setAttribute('d','M'+x+' '+y+' H'+shoulder+' L'+elbow+' '+end.y+' H'+end.x);
      marker.setAttribute('transform','translate('+x+' '+y+') scale('+(compact.matches?.68:1)+')');
      group.setAttribute('opacity',shot===2?'.55':'1');
    });
  }
  function tick(now){
    frame=0;if(!visible||document.hidden)return;
    if(now-last>32){
      if(!paused){
        const delta=Math.min(now-last,70);
        heading+=delta*(.00018+.00009*(1+Math.sin(clock*.00091)));clock+=delta;
      }
      draw();last=now;
    }
    if(!paused)schedule();
  }
  function schedule(){if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse' || preference.matches)return;
    const b=canvas.getBoundingClientRect();
    const x=e.clientX-b.left,y=e.clientY-b.top;
    pointer=Math.hypot((x-width/2)/width,(y-height/2)/height)<.46?{x,y}:null;
    if(paused)draw();
  });
  canvas.addEventListener('pointerleave',()=>{pointer=null;});
  function updateMotion(){
    stage.classList.toggle('motion-paused',paused);
    leaders.forEach(leader=>leader.pose=null);draw();schedule();
  }
  preference.addEventListener('change',()=>{paused=preference.matches;pointer=null;updateMotion();});
  document.addEventListener('visibilitychange',()=>{last=0;schedule();});
  const observer=new ResizeObserver(measure);observer.observe(stage);observer.observe(canvas);notes.forEach(n=>observer.observe(n));
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)schedule();}).observe(document.body.classList.contains("has-project-index") ? canvas : stage);
  compact.addEventListener('change', measure);
  measure();updateMotion();
})();
