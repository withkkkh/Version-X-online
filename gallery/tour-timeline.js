// Seconds are measured only while playing; tab switches and manual pauses do not consume time.
export const TOUR_DURATION = 30;
const camera = (target, orbit, fov = 42) => ({ target, orbit, fov });
export const TOUR_SCENES = [
  { at: 0, title: '欢迎来到未完之境', text: '四个展区，四种创造路径。在这里，看见作品，也看见它们怎样发生。', keys: [], camera: camera([0,-1.5,0],[24,58,34]) },
  { at: 4, title: '软件 · 把想法运行起来', text: '从真实需求出发，探索代码如何成为可用的作品。', keys: ['zone-software'], camera: camera([0,1.25,6.36],[12,62,12]) },
  { at: 8, title: '硬件 · 让构想动起来', text: '从结构到电路，让一个想法在反复调试中成形。', keys: ['zone-hardware'], camera: camera([7.57,1.25,0],[90,62,12]) },
  { at: 12, title: '设计 · 让问题有新解', text: '从观察到取舍，寻找设计与真实生活的连接。', keys: ['zone-design'], camera: camera([0,1.25,-6.36],[180,62,12]) },
  { at: 16, title: '运营 · 让创造被看见', text: '连接内容与人，让一次想法成为持续发生的交流。', keys: ['zone-operations'], camera: camera([-7.57,1.25,0],[270,62,12]) },
  { at: 20, title: '作品背后，还有知识的连接', text: '中央四座蓝色展台，通往各团队的知识图谱。', keys: ['team-design','team-software','team-hardware','team-operations'], camera: camera([0,2.3,0],[335,65,15]) },
  { at: 26, title: '接下来，由你探索', text: '点击展区看作品与故事；拖动旋转，找到你感兴趣的方向。', keys: [], camera: camera([0,-1.5,0],[384,58,34]) },
];

export function tourFrame(seconds) {
  const time = Math.max(0, Math.min(TOUR_DURATION, seconds));
  let index = 0;
  for (let i = 1; i < TOUR_SCENES.length; i++) if (time >= TOUR_SCENES[i].at) index = i;
  const scene = TOUR_SCENES[index];
  const previous = TOUR_SCENES[Math.max(0, index - 1)].camera;
  const from = index === 1 ? {...previous,orbit:[12,...previous.orbit.slice(1)]} : previous;
  const duration = index === 5 ? 2.3 : index === 6 ? 2.5 : 1.8;
  const p = Math.min(1, (time - scene.at) / duration);
  const eased = p * p * (3 - 2 * p);
  const mix = (a,b) => a + (b-a)*eased;
  // Unwrapped azimuths keep the route moving around the room in one direction.
  const view = {
    target: scene.camera.target.map((v,i) => mix(from.target[i], v)),
    orbit: scene.camera.orbit.map((v,i) => mix(from.orbit[i], v)),
    fov: mix(from.fov, scene.camera.fov),
    tour: true,
  };
  if (index === 0) view.orbit[0] = 24 - 12 * Math.min(1,time/4);
  return { index, scene, view, progress: time / TOUR_DURATION };
}
