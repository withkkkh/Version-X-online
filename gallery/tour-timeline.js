const camera = (target, orbit, fov = 44) => ({ target, orbit, fov });
export const OVERVIEW = {...camera([0,-1.5,0],[24,58,34],42),overview:true};
// Every arrival is followed by a still reading interval. Timing stays internal.
export const TOUR_SCENES = [
  { title:'VERSION X · 未完之境', text:'', keys:[], move:.8, hold:1.6, camera:{...camera([-6.32,.88,8.97],[4,88,3.6],36),fitByFov:true,frameWidth:4.15} },
  { title:'四种路径，一个创造现场', text:'软件、硬件、设计与运营，围绕中央雕塑展开。', keys:[], move:2.8, hold:1.8, camera:OVERVIEW },
  { title:'软件 · 把想法运行起来', text:'从真实需求出发，探索代码如何成为可用的作品。', keys:['zone-software'], move:2, hold:3.2, camera:{...camera([0,1.55,6.0],[180,88,3.8]),fitByFov:true,frameWidth:6.4} },
  { title:'硬件 · 让构想动起来', text:'从结构到电路，让一个想法在反复调试中成形。', keys:['zone-hardware'], move:.75, hold:3.2, camera:{...camera([7.2,1.55,0],[270,88,3.8]),fitByFov:true,frameWidth:6.4} },
  { title:'设计 · 让问题有新解', text:'从观察到取舍，寻找设计与真实生活的连接。', keys:['zone-design'], move:.75, hold:3.2, camera:{...camera([0,1.55,-6.0],[360,88,3.8]),fitByFov:true,frameWidth:6.4} },
  { title:'运营 · 让创造被看见', text:'连接内容与人，让一次想法成为持续发生的交流。', keys:['zone-operations'], move:.75, hold:3.2, camera:{...camera([-7.2,1.55,0],[450,88,3.8]),fitByFov:true,frameWidth:6.4} },
  { title:'作品背后，还有知识的连接', text:'中央四座蓝色展台，通往各团队的知识图谱。', keys:['team-design','team-software','team-hardware','team-operations'], move:2.2, hold:3, camera:camera([0,2.3,0],[384,65,15],42) },
  { title:'接下来，由你探索', text:'点击展区看作品与故事；也可以拖动模型，自由选择方向。', keys:[], move:2.4, hold:1.8, camera:{...OVERVIEW,orbit:[384,58,34]} },
];
export const TOUR_DURATION = TOUR_SCENES.reduce((sum,s)=>sum+s.move+s.hold,0);
const ease = p => p*p*(3-2*p);
function blend(from,to,p) {
  const mix=(a,b)=>a+(b-a)*p;
  return {target:from.target.map((v,i)=>mix(v,to.target[i])),orbit:from.orbit.map((v,i)=>mix(v,to.orbit[i])),fov:mix(from.fov,to.fov)};
}
export function sceneFrame(index,seconds,from=TOUR_SCENES[Math.max(0,index-1)].camera,to=TOUR_SCENES[index].camera) {
  const scene=TOUR_SCENES[index],p=scene.move?Math.max(0,Math.min(1,seconds/scene.move)):1;
  const destination={...to,orbit:[...to.orbit]};
  destination.orbit[0]=from.orbit[0]+((destination.orbit[0]-from.orbit[0]+540)%360)-180;
  return blend(from,destination,ease(p));
}

export const isTeamSwitch = index => index >= 3 && index <= 5;
export function slideFrame(progress) {
  const p=ease(Math.max(0,Math.min(1,progress)));
  return {outgoing:-100*p,incoming:100*(1-p)};
}
