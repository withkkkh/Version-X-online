const stops = [
  ['展馆总览', '四组展架围绕中央雕塑展开。外围是团队故事，雕塑脚边的四座小展台通往知识图谱。'],
  ['设计展区', '从一张草图到一个方案，去看设计团队怎样发散、取舍和收敛。','zone-design'],
  ['软件展区', '沿着需求、选型和维护三个线索，看看团队为什么决定自己造一个轮子。','zone-software'],
  ['硬件展区', '从第一张图纸到第一次跑通，听听硬件团队在哪一步改变了方案。','zone-hardware'],
  ['运营展区', '一场活动或一项服务如何持续下去？这里记录团队发现需求、联结伙伴的过程。','zone-operations'],
  ['设计知识图谱', '中央的设计展台连接设计团队的知识图谱。','team-design'],
  ['软件知识图谱', '从这座展台进入软件团队的知识图谱。','team-software'],
  ['硬件知识图谱', '这座展台通往硬件团队的知识图谱。','team-hardware'],
  ['运营知识图谱', '这里可以打开运营团队的知识图谱。','team-operations'],
  ['自由参观', '右下方「导览入口」收录全部团队故事与知识图谱，也可以从那里重新开始导览。']
];

export function installWalk(stage, model, setView) {
  const panel=stage.querySelector('.walk-panel');
  const title=panel.querySelector('h2');
  const next=panel.querySelector('.walk-next');
  const directory=stage.querySelector('.directory');
  const hotspots=[...model.querySelectorAll('.team-hotspot')];
  const interactive=matchMedia('(max-width:680px), (pointer:coarse), (hover:none)');
  let index=-1;
  // Coordinates in the 720 × 440 overview rendered by the exhibition camera.
  const coordinates={'zone-design':[431,140],'zone-software':[272,273],'zone-hardware':[531,241],'zone-operations':[201,159],
    'team-design':[343,191],'team-software':[323,217],'team-hardware':[392,191],'team-operations':[374,225]};
  const plane=document.createElement('div');
  plane.className='still-points';
  const inner=document.createElement('div');
  plane.append(inner);
  stage.querySelector('.gallery-still').after(plane);
  const copies=new Map();
  let selected;
  function clearStill(){
    selected?.classList.remove('is-active');
    selected=null;
  }
  for(const link of hotspots){
    const key=link.slot.slice('hotspot-'.length);
    const copy=link.cloneNode(true);
    copy.removeAttribute('slot');
    const [x,y]=coordinates[key];
    copy.style.left=(100*x/720)+'%';
    copy.style.top=(100*y/440)+'%';
    if(key.startsWith('team-')){
      copy.style.setProperty('--spread-x',(x<360?-1:1)*(key.endsWith('software')||key.endsWith('hardware')?22:4)+'px');
      copy.style.setProperty('--spread-y',(y<205?-24:24)+'px');
    }
    copy.addEventListener('click',event=>{
      if(!interactive.matches || event.detail===0 || selected===copy)return;
      event.preventDefault();
      clearStill();
      selected=copy;
      copy.classList.add('is-active');
    });
    inner.append(copy);copies.set(key,copy);
  }
  stage.addEventListener('pointerdown',e=>{if(!e.target.closest('.team-hotspot'))clearStill()});
  function clearMark(){
    stage.querySelectorAll('.tour-mark').forEach(el=>el.classList.remove('tour-mark'));
    directory.classList.remove('tour-directory');
  }
  function finish(){
    if(index<0)return;
    index=-1;panel.hidden=true;clearMark();
    setView('overview',true);
    directory.querySelector('summary').focus({preventScroll:true});
  }
  function render(i){
    index=i;clearMark();clearStill();
    const [name,copy,key]=stops[i];
    const isMap=key?.startsWith('team-');
    setView(isMap && model.loaded?'sculpture':'overview',true);
    if(key){
      model.querySelector('[slot="hotspot-'+key+'"]').classList.add('tour-mark');
      copies.get(key).classList.add('tour-mark');
    }
    if(i===stops.length-1)directory.classList.add('tour-directory');
    panel.querySelector('.walk-count').textContent=String(i+1).padStart(2,'0')+' / '+stops.length;
    title.textContent=name;panel.querySelector('p').textContent=copy;
    next.textContent=i===stops.length-1?'开始自由参观':'下一站';
    panel.hidden=false;
  }
  model.addEventListener('load',()=>{if(index>=0)render(index)});
  next.addEventListener('click',()=>index===stops.length-1?finish():render(index+1));
  panel.querySelector('.walk-end').addEventListener('click',finish);
  stage.addEventListener('click',e=>{
    if(index>=0 && e.target.closest('[data-view],#reset,summary,.team-hotspot'))finish();
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&index>=0)finish()});
  return ()=>{render(0);title.focus({preventScroll:true});stage.scrollIntoView({block:'start',behavior:'instant'})};
}
