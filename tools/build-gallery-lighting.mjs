import fs from 'node:fs';
// Neutral linear-light RGBE map: broad overhead and side softboxes.
// Keep the VI panorama as the visible backdrop without tinting white walls blue.
const width=128,height=64,pixels=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const phi=(y+.5)/height*Math.PI,theta=(x+.5)/width*2*Math.PI;
  const dx=Math.sin(phi)*Math.cos(theta),dy=Math.cos(phi),dz=Math.sin(phi)*Math.sin(theta);
  const light=1.8*(.3+.34*Math.max(0,dy)+2.8*Math.exp(-((dx+.38)**2+(dy-.75)**2+(dz-.32)**2)/.19)+1.35*Math.exp(-((dx-.82)**2+(dy-.32)**2+(dz+.46)**2)/.13));
  const exponent=Math.floor(Math.log2(light))+1,scale=256/2**exponent,i=(y*width+x)*4;
  pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(light*scale);pixels[i+3]=exponent+128;
}
fs.writeFileSync(new URL('../gallery/assets/gallery-neutral-studio.hdr',import.meta.url),Buffer.concat([Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`),pixels]));
