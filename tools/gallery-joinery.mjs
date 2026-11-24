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

  // Size the rebate from the actual print and seat the frame on the finished floor.
  const wall = g.nodes.find(n => n.name.startsWith('长侧围墙') && n.rotation);
  const wallBounds = g.accessors[g.meshes[wall.mesh].primitives[0].attributes.POSITION];
  const poster = g.nodes.find(n => n.name.includes('原图直接落地'));
  const frame = g.nodes.find(n => n.name.includes('无脚球接头'));
  const print = g.accessors[g.meshes[poster.mesh].primitives[0].attributes.POSITION];
  const frameHeight = wallBounds.max[1] + .24, rim = .055, overlap = .006;
  const printHeight = frameHeight - 2 * (rim - overlap);
  const scale = printHeight / (print.max[1] - print.min[1]);
  const printWidth = (print.max[0] - print.min[0]) * scale;
  const width = printWidth + 2 * (rim - overlap);
  const back = -wallBounds.min[2] + .003;
  const cx = -6.32;
  poster.scale = [scale,scale,1];
  poster.translation = [cx - (print.max[0]+print.min[0])*scale/2,
    rim-overlap-print.min[1]*scale, back+.032-print.min[2]];
  frame.name = '玻璃立面｜落地银铝海报框';

  function aluminium(name, grey, roughness) {
    return g.materials.push({name, pbrMetallicRoughness:{
      baseColorFactor:[grey,grey,grey,1], metallicFactor:.96, roughnessFactor:roughness
    }})-1;
  }
  const silver = aluminium('外框｜缎面银铝',.66,.25);
  const bevel = aluminium('外框｜抛光银色倒角',.89,.15);
  const recess = aluminium('外框｜铝型材凹槽',.34,.34);
  // Each adjacent pair in the extrusion section forms a continuous mitered band.
  // The outer bevel catches light and the recessed groove stays legible head-on.
  const section = [[0,0], [0,.038], [.009,.052], [.014,.055],
    [.018,.050], [.039,.050], [.048,.041], [rim,.039], [rim,.031], [rim,0], [0,0]];
  const finishes = [silver,bevel,silver,recess,silver,bevel,recess,recess,recess,silver];
  function ring([inset,depth]) {
    const left=cx-width/2+inset, right=cx+width/2-inset;
    return [[left,inset,back+depth],[right,inset,back+depth],
      [right,frameHeight-inset,back+depth],[left,frameHeight-inset,back+depth]];
  }
  const bands = new Map();
  section.slice(1).forEach((edge,i) => {
    const material=finishes[i], outer=ring(section[i]), inner=ring(edge);
    if (!bands.has(material)) bands.set(material,{positions:[],normals:[]});
    const {positions,normals}=bands.get(material);
    for (let k=0;k<4;k++) {
      const j=(k+1)%4, a=outer[k], b=outer[j], c=inner[j], d=inner[k];
      const u=b.map((v,k)=>v-a[k]), v=d.map((v,k)=>v-a[k]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const length=Math.hypot(...n);
      for (const corner of [a,b,c,a,c,d]) {
        positions.push(...corner); normals.push(...n.map(value=>value/length));
      }
    }
  });
  g.meshes[frame.mesh].primitives = Array.from(bands,([material,{positions,normals}]) =>
    ({material,attributes:attributes(positions,normals)}));

  // Build a solid fluted core. The original two logo outlines and the silver
  // crown share one plane and boundary edges, even in the straight-down view.
  const sculpture = g.nodes.find(n => n.name === '04 中央互动雕塑');
  const mark = g.nodes.find(n => n.name === 'X-Lab | Floating mark');
  const height = 5.48, segments = 96;
  mark.name = 'X-Lab | Crown inlay';
  mark.translation = [0,height,0]; mark.scale = [1,1,1];
  const holes = [];
  for (const child of mark.children) {
    const p = g.meshes[g.nodes[child].mesh].primitives[0];
    const enamel = g.materials[p.material];
    const blue = enamel.name.includes('雾蓝');
    enamel.pbrMetallicRoughness = {
      baseColorFactor:blue ? [.018,.105,.25,1] : [.018,.30,.34,1],
      metallicFactor:.08,roughnessFactor:.54
    };
    delete enamel.extensions;
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
  g.materials.push({name:'Sculpture | satin silver',pbrMetallicRoughness:{baseColorFactor:[.79,.87,.91,1],metallicFactor:.23,roughnessFactor:.49}});
  // A narrow waist leaves daylight between the original folded blades.
  // Across the top, four shallow lobes follow the diagonal arms of the mark.
  const profile=[[.23,.23,.025],[1.2,.15,.03],[3.6,.115,.025],[4.45,.15,.035],
    [4.96,.23,.05],[5.23,.39,.075],[5.40,.62,.11],[5.46,.715,.145],[height,.71,.145]];
  const rings=profile.map(([y,r,flute])=>Array.from({length:segments},(_,i)=>{
    const a=2*Math.PI*i/segments, rr=r-flute*Math.cos(4*a);
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
