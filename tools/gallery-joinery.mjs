import { ShapeUtils, Vector2 } from '../three.module.min.js';

// The exhibit exporter packs several objects into each material primitive.
// Replace only the two backing faces behind each print, retaining other objects.
export function finishGallery(g, values, accessor) {
  function attributes(positions, normals) {
    const count = positions.length / 3;
    const POSITION = accessor(Float32Array.from(positions), 'VEC3', count);
    const bounds = g.accessors[POSITION];
    bounds.min = [Infinity, Infinity, Infinity];
    bounds.max = [-Infinity, -Infinity, -Infinity];
    positions.forEach((v, i) => {
      const k = i % 3;
      bounds.min[k] = Math.min(bounds.min[k], Math.fround(v));
      bounds.max[k] = Math.max(bounds.max[k], Math.fround(v));
    });
    return { POSITION, NORMAL: accessor(Float32Array.from(normals), 'VEC3', count) };
  }

  for (const mesh of g.meshes) {
    const prints = mesh.primitives.filter(p => g.materials[p.material]?.name.startsWith('Exhibit print |'));
    if (!prints.length) continue;
    const frame = mesh.primitives.find(p => g.materials[p.material].name === 'Exhibit | ink frame');
    const original = values(frame.attributes.POSITION), normals = values(frame.attributes.NORMAL);
    const faces = prints.map(p => g.accessors[p.attributes.POSITION]);
    const pos = [], norm = [];
    let cut = 0;
    for (let i = 0; i < original.length;) {
      const [x,y,z] = original.slice(i,i+3), sign = normals[i+2];
      const face = faces.find(f => Math.abs(sign) === 1 &&
        Math.abs(z - (sign > 0 ? f.max[2] : f.min[2]) + sign * .001) < .00001 &&
        Math.abs(y - (f.min[1] - .009)) < .00001 &&
        Math.abs(x - (sign > 0 ? f.min[0] - .009 : f.max[0] + .009)) < .00001);
      if (!face) {
        pos.push(...original.slice(i,i+9)); norm.push(...normals.slice(i,i+9)); i += 9; continue;
      }
      const [x0,y0] = face.min, [x1,y1] = face.max, b = .009;
      for (const [l,d,r,u] of [[x0-b,y0-b,x1+b,y0],[x0-b,y1,x1+b,y1+b],[x0-b,y0,x0,y1],[x1,y0,x1+b,y1]]) {
        const corners = [[l,d],[r,d],[r,u],[l,u]];
        for (const j of sign > 0 ? [0,1,2,0,2,3] : [0,2,1,0,3,2]) {
          pos.push(...corners[j],z); norm.push(0,0,sign);
        }
      }
      i += 18; cut++;
    }
    if (cut !== prints.length*2) throw Error('Unmatched backing faces: '+mesh.name);
    frame.attributes = attributes(pos,norm);
    // Seat the printed faces exactly in the two apertures.
    for (const p of prints) {
      const coords = values(p.attributes.POSITION), ns = values(p.attributes.NORMAL);
      for (let i=2;i<coords.length;i+=3) coords[i] -= ns[i]*.001;
      Object.assign(p.attributes, attributes(coords,ns));
    }
  }
  for (const m of g.materials) {
    if (m.name.includes('Exhibit print |')) m.doubleSided = false;
    if (m.name.includes('室内展架｜')) {
      m.pbrMetallicRoughness.roughnessFactor = .68;
      m.pbrMetallicRoughness.metallicFactor = .38;
    }
  }
  for (const n of g.nodes) {
    if (['不锈钢光轴立柱','不锈钢光轴横梁','搭接光轴'].includes(n.name)) {
      n.scale[0] = Math.max(.035,n.scale[0]); n.scale[2] = Math.max(.035,n.scale[2]);
    }
  }

  // Build a solid fluted core. The original two logo outlines and the silver
  // crown share one plane and boundary edges, even in the straight-down view.
  const sculpture = g.nodes.find(n => n.name === '04 中央互动雕塑');
  const mark = g.nodes.find(n => n.name === 'X-Lab | Floating mark');
  const height = 5.48, radius = .91, segments = 72;
  mark.name = 'X-Lab | Crown inlay';
  mark.translation = [0,height,0]; mark.scale = [1,1,1];
  const holes = [];
  for (const child of mark.children) {
    const p = g.meshes[g.nodes[child].mesh].primitives[0];
    const src = values(p.attributes.POSITION), indices = values(p.indices);
    const top = g.accessors[p.attributes.POSITION].max[1];
    const points = [], pointIds = new Map(), boundary = new Map(), pos = [], norm = [];
    function point(i) {
      const x = Math.fround(src[i*3]*.42), z = Math.fround(src[i*3+2]*.42), key = x+','+z;
      if (!pointIds.has(key)) { pointIds.set(key, points.length); points.push(new Vector2(x,z)); }
      return pointIds.get(key);
    }
    for (let i=0;i<indices.length;i+=3) {
      const tri=indices.slice(i,i+3);
      if (tri.some(j=>src[j*3+1] < top-.0001)) continue;
      const ids=tri.map(point);
      ids.forEach((a,k)=>{
        const b=ids[(k+1)%3], key=Math.min(a,b)+','+Math.max(a,b);
        if (boundary.has(key)) boundary.delete(key); else boundary.set(key,[a,b]);
        pos.push(points[a].x,0,points[a].y); norm.push(0,1,0);
      });
    }
    const next=new Map(boundary.values()), loop=[];
    let id=next.keys().next().value;
    while(next.has(id)) {loop.push(points[id]);const end=next.get(id);next.delete(id);id=end;}
    if(next.size || loop.length<3) throw Error('Invalid inlay outline');
    holes.push(loop); delete p.indices; p.attributes=attributes(pos,norm);
  }
  const mat=g.materials.length;
  g.materials.push({name:'Sculpture | satin silver',pbrMetallicRoughness:{baseColorFactor:[.62,.72,.79,1],metallicFactor:.52,roughnessFactor:.42}});
  const profile=[[.23,.47,.06],[.45,.45,.06],[1.4,.36,.09],[2.8,.34,.10],[3.9,.40,.11],[4.7,.55,.09],[5.15,.74,.05],[5.42,.92,0],[height,radius,0]];
  const rings=profile.map(([y,r,flute])=>Array.from({length:segments},(_,i)=>{
    const a=2*Math.PI*i/segments, rr=r+flute*Math.cos(4*a-.65*y);
    return [rr*Math.cos(a),y,rr*Math.sin(a)];
  }));
  const pos=[],norm=[];
  function triangle(a,b,c) {
    const u=b.map((x,i)=>x-a[i]), v=c.map((x,i)=>x-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const len=Math.hypot(...n); if (!len) return;
    for(const pt of [a,b,c]) {pos.push(...pt);norm.push(...n.map(x=>x/len));}
  }
  for(let r=1;r<rings.length;r++) for(let i=0;i<segments;i++) {
    const j=(i+1)%segments,a=rings[r-1],b=rings[r];
    triangle(a[i],b[i],a[j]);triangle(a[j],b[i],b[j]);
  }
  const outline=rings.at(-1).map(([x,,z])=>new Vector2(x,z));
  const faces=ShapeUtils.triangulateShape(outline,holes), all=outline.concat(...holes);
  for(const [a,b,c] of faces) triangle(...[a,c,b].map(i=>[all[i].x,height,all[i].y]));
  for(let i=1;i<segments-1;i++) triangle(rings[0][0],rings[0][i],rings[0][i+1]);
  sculpture.children.push(g.nodes.length);
  g.nodes.push({name:'中央雕塑｜旋纹银芯',mesh:g.meshes.length});
  g.meshes.push({name:'Satin core and flush cut crown',primitives:[{attributes:attributes(pos,norm),material:mat}]});
}
