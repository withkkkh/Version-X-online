export function installStillHotspots(stage,model) {
  const hotspots=[...model.querySelectorAll('.team-hotspot')];
  const interactive=matchMedia('(max-width:680px), (pointer:coarse), (hover:none)');

  // Projected exhibit anchors in the overview’s 720 × 440 coordinate system.
  const coordinates={'zone-design':[424,121],'zone-software':[296,273],'zone-hardware':[530,237],'zone-operations':[190,157],
    'team-design':[345,200],'team-software':[328,220],'team-hardware':[392,211],'team-operations':[375,231]};
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

}
