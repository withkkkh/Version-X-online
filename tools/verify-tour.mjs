import assert from 'node:assert/strict';
import { TOUR_SCENES, TOUR_DURATION, sceneFrame, OVERVIEW, isTeamSwitch, slideFrame } from '../gallery/tour-timeline.js';

assert.ok(TOUR_DURATION >= 30 && TOUR_DURATION <= 40);
let from=TOUR_SCENES[0].camera;
for (let index=0;index<TOUR_SCENES.length;index++) {
  const scene=TOUR_SCENES[index];
  const start=sceneFrame(index,0,from);
  for(const key of ['target','orbit'])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(start[key][axis]-from[key][axis])<1e-8,`Scene ${index} jumps on arrival`);
  for(let time=0;time<=scene.move+scene.hold;time+=.02){
    const view=sceneFrame(index,time,from);
    assert.ok([...view.target,...view.orbit,view.fov].every(Number.isFinite));
    assert.ok(view.orbit[2]>=2);
  }
  const end=sceneFrame(index,scene.move+scene.hold,from);
  const held=sceneFrame(index,scene.move+.1,from);
  assert.deepEqual(end,held,'Reading interval must hold the camera still');
  // An early Next must start at the partially completed camera pose.
  if(index<TOUR_SCENES.length-1){
    const partial=sceneFrame(index,scene.move*.3,from);
    const next=sceneFrame(index+1,0,partial);
    for(const key of ['target','orbit'])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(next[key][axis]-partial[key][axis])<1e-8,'Early Next jumps');
  }
  from=end;
}
assert.deepEqual(from.target,OVERVIEW.target);
assert.ok(Math.abs((from.orbit[0]-OVERVIEW.orbit[0])%360)<1e-8);
for(const scene of TOUR_SCENES.slice(2,6)) {
  assert.equal(scene.camera.orbit[1],88,'Exhibits should be viewed straight on');
  assert.ok(scene.camera.orbit[2]<4,'Camera must be in front of the sculpture');
}
assert.deepEqual(TOUR_SCENES.map((_,i)=>i).filter(isTeamSwitch),[3,4,5]);
assert.equal(TOUR_SCENES[0].text,'','Poster opening has no introduction');
assert.equal(TOUR_SCENES[1].camera,OVERVIEW);
assert.equal(TOUR_SCENES[7].camera.overview,true);
assert.equal(Math.abs(slideFrame(0).outgoing),0);assert.equal(slideFrame(0).incoming,100);
assert.deepEqual(slideFrame(1),{outgoing:-100,incoming:0});
let previous=100;
for(let progress=0;progress<=1;progress+=.01){
  const pose=slideFrame(progress);
  assert.ok(pose.incoming<=previous,'Pages must travel horizontally in one direction');
  assert.ok(Math.abs(pose.incoming-pose.outgoing-100)<1e-8,'Page edges must stay joined');
  previous=pose.incoming;
}
console.log('Tour continuity, horizontal page joins, frontal views and overview checks passed.');
