import { installViGraphicBackground } from './vi-graphic-background.js?v=2';

// The VI environment is evaluated per screen pixel from a world-space ray.
// No finite-resolution panorama sits between the camera and the graphics.
export function installViDirectionalBackground(screen,model){
  const canvas=document.createElement('canvas');canvas.className='vi-graphic-background';canvas.setAttribute('aria-hidden','true');
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
  if(!gl)return installViGraphicBackground(screen);
  const vertex=`#version 300 es
    void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const fragment=`#version 300 es
    precision highp float;
    uniform vec2 resolution;
    uniform vec3 outward;
    uniform vec3 rightward;
    uniform vec3 upward;
    uniform vec2 lens;
    out vec4 pixel;
    const float PI=3.14159265359;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      vec2 ndc=(gl_FragCoord.xy/resolution)*2.-1.;
      vec3 ray=normalize(-outward+rightward*ndc.x*lens.x+upward*ndc.y*lens.y);
      vec2 uv=vec2(atan(ray.x,ray.z)/(2.*PI)+.5,acos(clamp(ray.y,-1.,1.))/PI);
      float azimuth=uv.x*2.*PI;
      float drift=.5+.5*sin(azimuth*2.+.65*sin(uv.y*2.*PI));
      float silver=.5+.5*cos(azimuth+.6+.45*sin(uv.y*2.*PI));
      vec3 cobalt=vec3(.28,.49,.71),ice=vec3(.77,.88,.96);
      vec3 color=mix(cobalt,ice,pow(silver,.8));
      // Fixed silver softboxes in the virtual world sweep through the view as
      // the camera turns; this changes light and color rather than just dots.
      float ribbon=pow(.5+.5*cos(azimuth*2.+.8*sin(uv.y*2.*PI)),18.);
      float frost=pow(.5+.5*sin(azimuth*3.-uv.y*3.4),8.);
      color=mix(color,vec3(.98,.995,1.),ribbon*.62+frost*.17);
      // World-space halftone: derivative antialiasing preserves crisp dots at
      // every zoom, including the longitude seam and the spherical poles.
      vec2 grid=uv*vec2(360.,180.);
      vec2 cell=fract(grid)-.5;
      float wave=.5+.5*sin(uv.x*12.*PI+1.6*cos(uv.y*6.*PI));
      vec2 q=abs(cell)-vec2(.04+wave*.08);
      float distance=length(max(q,0.))+min(max(q.x,q.y),0.)-.065;
      float smoothing=clamp(length(fwidth(grid))*.52,.008,.4);
      float dot=1.-smoothstep(-smoothing,smoothing,distance);
      float density=(.055+wave*.10)*(.45+.55*drift);
      vec3 ink=mix(vec3(.81,.92,1.),vec3(.27,.49,.68),silver);
      color=mix(color,ink,dot*density);
      color+=(hash(gl_FragCoord.xy)-.5)*.012;
      pixel=vec4(color,1.);
    }`;
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;}
  let program;
  try{
    program=gl.createProgram();const vs=compile(gl.VERTEX_SHADER,vertex),ps=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,ps);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(ps);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  }catch{gl.getExtension('WEBGL_lose_context')?.loseContext();return installViGraphicBackground(screen);}
  gl.useProgram(program);
  const uniforms=Object.fromEntries(['resolution','outward','rightward','upward','lens'].map(key=>[key,gl.getUniformLocation(program,key)]));
  let visible=true,frame,drawCount=0;
  function draw(){
    frame=undefined;if(!visible||gl.isContextLost())return;
    const {width,height}=screen.getBoundingClientRect();if(!width||!height)return;
    const scale=Math.min(2,devicePixelRatio||1),w=Math.ceil(width*scale),h=Math.ceil(height*scale);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    let theta=24*Math.PI/180,phi=58*Math.PI/180,fov=42;
    if(model.getCameraOrbit){const orbit=model.getCameraOrbit();theta=orbit.theta;phi=orbit.phi;fov=model.getFieldOfView();}
    const st=Math.sin(theta),ct=Math.cos(theta),sp=Math.sin(phi),cp=Math.cos(phi);
    const aspect=width/height,halfHeight=Math.tan(fov*Math.PI/360)/Math.min(1,aspect);
    gl.uniform2f(uniforms.resolution,w,h);gl.uniform2f(uniforms.lens,halfHeight*aspect,halfHeight);
    gl.uniform3f(uniforms.outward,sp*st,cp,sp*ct);gl.uniform3f(uniforms.rightward,ct,0,-st);gl.uniform3f(uniforms.upward,-cp*st,sp,-cp*ct);
    gl.drawArrays(gl.TRIANGLES,0,3);
    canvas.dataset.renderScale=String(scale);canvas.dataset.yaw=theta.toFixed(4);canvas.dataset.pitch=phi.toFixed(4);canvas.dataset.drawCount=String(++drawCount);canvas.dataset.renderer='directional';
  }
  function schedule(){if(visible&&!frame)frame=requestAnimationFrame(draw);}
  screen.prepend(canvas);new ResizeObserver(schedule).observe(screen);window.addEventListener('resize',schedule);
  model.addEventListener('camera-change',schedule);model.addEventListener('load',schedule);schedule();
  return {setVisible(value){visible=value;canvas.hidden=!value;if(value)schedule();}};
}
