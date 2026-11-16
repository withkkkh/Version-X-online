import {
  AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, DirectionalLight,
  DoubleSide, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial,
  OrthographicCamera, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer
} from "./three.module.min.js";

const columns = 24;
const rows = 30;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ease = t => t * t * (3 - 2 * t);

export function createPaperEngine() {
  const canvas = document.createElement("canvas");
  canvas.className = "paper-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) return null;

  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));

  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, -1, 1, 1600);
  camera.position.z = 850;
  scene.add(new AmbientLight(0xe0eaf8, 2.12));
  const key = new DirectionalLight(0xfff9ee, 2.05);
  key.position.set(-320, 280, 220);
  scene.add(key);

  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 512;
  const ctx = textureCanvas.getContext("2d");
  const grainCanvas = makeGrain();
  const map = new CanvasTexture(textureCanvas);
  map.colorSpace = SRGBColorSpace;
  const bump = new CanvasTexture(grainCanvas);

  const sheet = new PlaneGeometry(1, 1, columns, rows);
  const surface = new MeshStandardMaterial({
    color: 0xf5f8ff, map, bumpMap: bump, bumpScale: .14,
    roughness: .96, metalness: 0, side: DoubleSide
  });
  const mesh = new Mesh(sheet, surface);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const lineGeometry = new BufferGeometry();
  const fiberPoints = new Float32Array(18 * 6);
  lineGeometry.setAttribute("position", new BufferAttribute(fiberPoints, 3));
  const fiberInk = new LineBasicMaterial({ color: 0xebeff2, transparent: true, opacity: .66 });
  const fibers = new LineSegments(lineGeometry, fiberInk);
  fibers.frustumCulled = false;
  scene.add(fibers);

  const paper = { bend: 0, sway: 0, stretch: 0, bendV: 0, swayV: 0, stretchV: 0 };
  let base, callback, mode, startTime, lastTime, frame;
  let targetBend = 0, targetSway = 0, targetStretch = 0;
  let viewWidth = 0, viewHeight = 0;
  let origin;

  function resize() {
    viewWidth = window.innerWidth;
    viewHeight = window.innerHeight;
    renderer.setSize(viewWidth, viewHeight, false);
    camera.right = viewWidth;
    camera.bottom = -viewHeight;
    camera.updateProjectionMatrix();
  }

  function drawLabel(text) {
    ctx.fillStyle = "#e1e8ef";
    ctx.fillRect(0, 0, 256, 512);
    ctx.globalAlpha = .19;
    ctx.drawImage(grainCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#253c55";
    ctx.fillRect(126, 54, 3, 29);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 56px "PingFang SC", "Microsoft YaHei", sans-serif';
    let y = 145;
    for (const character of text) {
      ctx.fillText(character, 128, y);
      y += 64;
    }
    map.needsUpdate = true;
  }

  function begin(rect, text) {
    if (mode) finish();
    base = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

    drawLabel(text);
    Object.assign(paper, { bend: .09, sway: 0, stretch: 0, bendV: 0, swayV: 0, stretchV: 0 });
    targetBend = .09;
    targetSway = targetStretch = 0;
    callback = null;
    lastTime = 0;
    origin = base;
    mode = "hold";
    resize();
    document.body.append(canvas);
    render(performance.now());
  }

  function pull(x, y) {
    if (mode !== "hold") return;
    const tension = clamp(y / 47, 0, 1.25);
    targetBend = .09 + tension * .69;
    targetStretch = clamp(y * .30, 0, 16);
    targetSway = clamp(x * .54, -22, 22);
  }

  function release(done) {
    mode = "release";
    startTime = performance.now();
    callback = done;
    targetBend = Math.max(.72, paper.bend);
    targetStretch = 14;
    paper.bendV += 2.1;
    paper.stretchV += 36;
  }

  function cancel(done) {
    mode = "cancel";
    startTime = performance.now();
    callback = done;
    targetBend = .09;
    targetSway = targetStretch = 0;
  }

  function finish() {
    cancelAnimationFrame(frame);
    canvas.remove();
    mode = null;
    const done = callback;
    callback = null;
    done?.(origin);
  }

  function spring(property, target, stiffness, damping, dt) {
    const velocity = property + "V";
    paper[velocity] += (stiffness * (target - paper[property]) - damping * paper[velocity]) * dt;
    paper[property] += paper[velocity] * dt;
  }

  function render(now) {
    const dt = clamp((now - (lastTime || now - 16)) / 1000, .004, .026);
    lastTime = now;
    const elapsed = mode === "hold" ? 0 : now - startTime;
    const separated = mode === "release" ? clamp(elapsed / 134, 0, 1) : 0;
    if (mode === "release") {
      const t = elapsed / 1000;
      targetBend = .36 + .32 * Math.cos(t * 18) * Math.exp(-t * 4.0);
      targetStretch = 14 + 38 * ease(clamp(t * 2.6, 0, 1));
      targetSway *= .94;
    }
    spring("bend", targetBend, 124, 14, dt);
    spring("sway", targetSway, 132, 13, dt);
    spring("stretch", targetStretch, 168, 17, dt);

    const positions = sheet.attributes.position;
    let down = 0, depth = 0;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let row = 0; row <= rows; row++) {
      const length = row / rows;
      if (row > 0) {
        const s = (row - .5) / rows;
        const angle = paper.bend * (s * .91 + Math.sin(s * Math.PI) * .45);
        down += Math.cos(angle) * base.height / rows;
        depth += Math.sin(angle) * base.height / rows;
      }
      for (let col = 0; col <= columns; col++) {
        const u = col / columns;
        const edge = u - .5;
        const split = separated ? ease(clamp((separated * 1.42 - u * .43) / .45, 0, 1)) : 0;
        const torn = split * (1.0 + Math.sin(col * 4.86) * .93 + Math.sin(col * 1.71) * .68);
        const stretch = separated ? paper.stretch * split : paper.stretch * length;
        const side = edge * base.width;
        const bendFalloff = Math.max(0, 1 - length * 11);
        const x = base.left + base.width / 2 + side * (1 + depth * .0015 - .028 * length * paper.bend) +
          paper.sway * length ** 1.7;
        const y = base.top + down + depth * .14 + stretch + torn * bendFalloff +
          edge * paper.sway * length * .09;
        const z = depth + paper.bend * edge * base.width * length * .29 +
          paper.bend * edge ** 2 * base.width * Math.sin(length * Math.PI) * .29;
        positions.setXYZ(row * (columns + 1) + col, x, -y, z);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    positions.needsUpdate = true;
    sheet.computeVertexNormals();
    origin = { left, top, width: right - left, height: bottom - top };
    for (let i = 0; i < 18; i++) {
      const col = 1 + ((i * 13) % (columns - 1));
      const x = positions.getX(col);
      const y = positions.getY(col);
      const z = positions.getZ(col) + .2;
      const size = 1 + (i % 5) * .72;
      fiberPoints.set([x, y - 1, z, x + Math.sin(i * 3.1) * size, y + size, z + .5], i * 6);
    }
    lineGeometry.attributes.position.needsUpdate = true;
    fibers.visible = separated > .02;
    renderer.render(scene, camera);

    if ((mode === "release" && elapsed >= 410) || (mode === "cancel" && elapsed >= 260)) finish();
    else frame = requestAnimationFrame(render);
  }

  window.addEventListener("resize", () => { if (mode) resize(); });
  return { begin, pull, release, cancel };
}

function makeGrain() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(256, 512);
  let seed = 235631;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = 180 + (random() - .5) * 76;
    pixels.data.set([value, value, value, 255], i);
  }
  context.putImageData(pixels, 0, 0);
  for (let i = 0; i < 2000; i++) {
    const x = random() * 256;
    const y = random() * 512;
    context.strokeStyle = i % 2 ? "#f1f3f63b" : "#17253325";
    context.lineWidth = .45;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + random() * 2.6 - 1.3, y + random() * 3.4);
    context.stroke();
  }
  return canvas;
}
