import fs from 'node:fs';
import zlib from 'node:zlib';
import { Matrix4, Vector3, Quaternion } from '../three.module.min.js';

import { curateRacks } from './gallery-rack-projects.mjs';
import { finishGallery } from './gallery-joinery.mjs';

const assets = new URL('../gallery/assets/', import.meta.url);
const resolution = 768;
const width = 22, depth = 18.195;
function png(w,h,rgb) {
  const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  const chunk=(type,data)=>{const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);let c=0xffffffff;for(const v of Buffer.concat([t,data]))c=crcTable[(c^v)&255]^(c>>>8);b.writeUInt32BE((c^0xffffffff)>>>0,b.length-4);return b;};
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(w);hdr.writeUInt32BE(h,4);hdr[8]=8;hdr[9]=2;
  const scan=Buffer.alloc(h*(w*3+1));for(let y=0;y<h;y++)rgb.copy(scan,y*(w*3+1)+1,y*w*3,(y+1)*w*3);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
function blur(src,radius) {
  let out=src;
  for(let pass=0;pass<3;pass++){
    const tmp=new Float32Array(out.length),dest=new Float32Array(out.length);
    for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){let s=0;for(let d=-radius;d<=radius;d++)s+=out[y*resolution+Math.max(0,Math.min(resolution-1,x+d))];tmp[y*resolution+x]=s/(radius*2+1);}
    for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){let s=0;for(let d=-radius;d<=radius;d++)s+=tmp[Math.max(0,Math.min(resolution-1,y+d))*resolution+x];dest[y*resolution+x]=s/(radius*2+1);}
    out=dest;
  }return out;
}
function raster(mask, points) {
  const p=points.map(([x,z])=>[(x+11)/width*(resolution-1),(z+9)/depth*(resolution-1)]);
  const [a,b,c]=p,edge=(u,v,x,y)=>(x-u[0])*(v[1]-u[1])-(y-u[1])*(v[0]-u[0]);
  const sign=Math.sign(edge(a,b,c[0],c[1]));if(!sign)return;
  const x0=Math.max(0,Math.floor(Math.min(...p.map(v=>v[0])))),x1=Math.min(resolution-1,Math.ceil(Math.max(...p.map(v=>v[0]))));
  const y0=Math.max(0,Math.floor(Math.min(...p.map(v=>v[1])))),y1=Math.min(resolution-1,Math.ceil(Math.max(...p.map(v=>v[1]))));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(edge(a,b,x+.5,y+.5)*sign>=0&&edge(b,c,x+.5,y+.5)*sign>=0&&edge(c,a,x+.5,y+.5)*sign>=0)mask[y*resolution+x]=1;
}

function build(input,output) {
  let file=fs.readFileSync(new URL(input,assets));if(file[0]===31)file=zlib.gunzipSync(file);
  const jsonLength=file.readUInt32LE(12),g=JSON.parse(file.subarray(20,20+jsonLength));
  let bin=Buffer.from(file.subarray(28+jsonLength,28+jsonLength+file.readUInt32LE(20+jsonLength)));
  const append=(data,target)=>{const pad=(4-bin.length%4)%4;bin=Buffer.concat([bin,Buffer.alloc(pad)]);const index=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:bin.length,byteLength:data.length,...(target?{target}:{})});bin=Buffer.concat([bin,data]);return index;};
  const accessor=(array,type,count)=>{const i=g.accessors.length;g.accessors.push({bufferView:append(Buffer.from(array.buffer,array.byteOffset,array.byteLength),34962),componentType:5126,type,count});return i;};
  function values(i) {
    const a=g.accessors[i],v=g.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],read={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];
    const out=[];for(let n=0;n<a.count;n++)for(let c=0;c<size;c++)out.push(bin[read]((v.byteOffset||0)+(a.byteOffset||0)+n*(v.byteStride||size*bytes)+c*bytes));return out;
  }
  // Resize only exhibits about their own lower centre, keeping their shelf contact.
  for(const n of g.nodes){
    if(n.name==='光轴展架')n.scale=[1,1.06,1];
    if(/^(design|software|hardware|operations) \| /.test(n.name)&&n.mesh!==undefined){
      const mesh=g.meshes[n.mesh],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION];for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.min[k]);max[k]=Math.max(max[k],a.max[k]);}}
      const heading=n.name.endsWith('Team heading'),s=heading?[1.12,1.12,1.12]:[1.24,1.22,1.24];
      const centre=[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2];
      n.scale=s;n.translation=centre.map((v,k)=>v*(1-s[k])+(heading&&k===1?.15:0));
    }
  }
  for(const m of g.materials){
    const name=m.name,p=m.pbrMetallicRoughness;
    if(name==='地面'){p.baseColorFactor=[.40,.43,.46,1];p.roughnessFactor=.88;}
    if(name==='深灰收边')p.baseColorFactor=[.23,.28,.33,1];
    if(name==='弧形隔墙｜冷灰白'){p.baseColorFactor=[.78,.80,.82,1];p.roughnessFactor=.86;}
    if(name==='弧形隔墙｜浅灰白顶面')p.baseColorFactor=[.91,.92,.93,1];
    if(name.includes('室内展架｜')&&!name.includes(' | ')){p.baseColorFactor=[.16,.21,.27,1];p.roughnessFactor=.4;p.metallicFactor=.65;}
    if(name==='展板和薄托板｜雾灰')p.baseColorFactor=[.28,.34,.42,1];
    if(name==='不锈钢光轴｜细磨砂'){p.baseColorFactor=[.20,.28,.36,1];p.roughnessFactor=.36;}
  }
  finishGallery(g,values,accessor);
  curateRacks(g,append);
  const lightMaterial=g.materials.length;
  g.materials.push({name:'Study | discreet blue rail light',pbrMetallicRoughness:{baseColorFactor:[.06,.24,.49,1],metallicFactor:.4,roughnessFactor:.4},emissiveFactor:[.018,.09,.22]});
  for(const n of g.nodes)if(n.name==='不锈钢光轴横梁'&&n.translation?.[1]>2){const m=structuredClone(g.meshes[n.mesh]);for(const p of m.primitives){p.material=lightMaterial;delete p.extensions;}n.mesh=g.meshes.length;g.meshes.push(m);}
  const matrices=new Map();
  function visit(index,parent){const n=g.nodes[index];const local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));const world=parent.clone().multiply(local);matrices.set(index,world);for(const child of n.children||[])visit(child,world);}
  for(const root of g.scenes[g.scene||0].nodes)visit(root,new Matrix4());
  const shadow=new Float32Array(resolution*resolution),contact=new Float32Array(resolution*resolution);
  let triangles=0;
  for(const [index,matrix]of matrices){
    const n=g.nodes[index];if(n.mesh===undefined||index<8||index===225||index===226)continue;
    const mesh=g.meshes[n.mesh];
    for(const p of mesh.primitives){
      const pos=values(p.attributes.POSITION),world=[];
      for(let i=0;i<pos.length;i+=3)world.push(new Vector3(...pos.slice(i,i+3)).applyMatrix4(matrix));
      const ids=p.indices===undefined?Array.from({length:world.length},(_,i)=>i):values(p.indices);
      for(let i=0;i<ids.length;i+=3){const tri=ids.slice(i,i+3).map(id=>world[id]);if(tri.length<3||tri.some(v=>!v))continue;
        if(Math.max(...tri.map(v=>v.y))<.012)continue;
        raster(shadow,tri.map(v=>[v.x+.42*v.y,v.z+.26*v.y]));
        if(Math.min(...tri.map(v=>v.y))<.23)raster(contact,tri.map(v=>[v.x,v.z]));triangles++;
      }
      // Grounding gradient on curved partitions, with a restrained blue wash near the base.
      if(n.name==='弧形隔墙'){
        const colors=new Float32Array(world.length*3);
        world.forEach((v,i)=>{const foot=Math.exp(-Math.max(0,v.y)*3.5);colors.set([1-.22*foot,1-.17*foot,1-.10*foot],i*3);});
        p.attributes.COLOR_0=accessor(colors,'VEC3',world.length);
      }
    }
  }
  const soft=blur(shadow,3),ao=blur(contact,2),rgb=Buffer.alloc(resolution*resolution*3);
  const zones=[[0,-6.36],[0,6.36],[7.57,0],[-7.57,0]];
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const i=y*resolution+x,px=x/(resolution-1)*width-11,pz=y/(resolution-1)*depth-9;
    const shade=1-.25*soft[i]-.16*ao[i],grain=(Math.sin(x*127.1+y*311.7)*43758.5453)%1*.007;
    let wash=0;
    for(const [zx,zz]of zones){const dx=px-zx,dz=pz-zz;wash+=Math.exp(-(zx===0?dx*dx/9+dz*dz/.8:dx*dx/.8+dz*dz/7))* .14;}
    const values=[shade*(1-wash)+grain,shade*(1-wash*.48)+grain,Math.min(1,shade+wash*.12+grain)];
    values.forEach((v,k)=>rgb[i*3+k]=Math.round(Math.max(0,Math.min(1,v))*255));
  }
  const textureBytes=png(resolution,resolution,rgb),imageIndex=g.images.length;
  g.images.push({name:'Study | baked floor contact shadows and blue wash',mimeType:'image/png',bufferView:append(textureBytes)});
  const textureIndex=g.textures.length;g.textures.push({source:imageIndex});
  g.materials[0].pbrMetallicRoughness.baseColorTexture={index:textureIndex};
  // Keep backdrop/hover variants on the same grounded floor map.
  g.materials[1].pbrMetallicRoughness.baseColorTexture={index:textureIndex};
  for(const p of g.meshes[0].primitives){const pos=values(p.attributes.POSITION),uv=new Float32Array(pos.length/3*2);for(let i=0;i<pos.length/3;i++){uv[i*2]=(pos[i*3]+11)/width;uv[i*2+1]=(pos[i*3+2]+9)/depth;}p.attributes.TEXCOORD_0=accessor(uv,'VEC2',pos.length/3);}
  g.buffers[0].byteLength=bin.length;
  const json=Buffer.from(JSON.stringify(g)),jsonPad=Buffer.alloc((4-json.length%4)%4,32),binPad=Buffer.alloc((4-bin.length%4)%4);
  const jh=Buffer.alloc(8),bh=Buffer.alloc(8),header=Buffer.alloc(12);jh.writeUInt32LE(json.length+jsonPad.length);jh.write('JSON',4);bh.writeUInt32LE(bin.length+binPad.length);bh.writeUInt32LE(0x004e4942,4);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jsonPad.length+bin.length+binPad.length,8);
  const result=Buffer.concat([header,jh,json,jsonPad,bh,bin,binPad]);
  fs.writeFileSync(new URL(output,assets),output.endsWith('.bin')?zlib.gzipSync(result):result);
  console.log(JSON.stringify({input,output,triangles,bytes:result.length,unchangedArchitecture:true}));
}
build('version-x-gallery-v30.glb','version-x-gallery-study.glb');
build('gallery-mobile-v31.bin','gallery-mobile-study.bin');
