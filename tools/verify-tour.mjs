import assert from 'node:assert/strict';
import { tourFrame, TOUR_DURATION } from '../gallery/tour-timeline.js';

assert.equal(TOUR_DURATION, 30);
for (const boundary of [4,8,12,16,20,26]) {
  const before = tourFrame(boundary - .00001).view;
  const after = tourFrame(boundary).view;
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(before.target[axis] - after.target[axis]) < .001, 'Target jumps at '+boundary);
    assert.ok(Math.abs(before.orbit[axis] - after.orbit[axis]) < .001, 'Orbit jumps at '+boundary);
  }
}
for (let time = 0; time <= 30; time += .05) {
  const {view} = tourFrame(time);
  assert.ok([...view.target,...view.orbit,view.fov].every(Number.isFinite));
  assert.ok(view.orbit[2] >= 12);
}
assert.equal((tourFrame(30).view.orbit[0] - tourFrame(0).view.orbit[0]) % 360, 0);
assert.deepEqual(tourFrame(30).view.target, tourFrame(0).view.target);
console.log('Tour camera continuity, bounds, and return-to-overview checks passed.');
