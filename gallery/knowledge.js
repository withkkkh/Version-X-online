import { teams } from './teams.js';
import { layoutGraph } from './graph-layout.js?v=25';

const $ = selector => document.querySelector(selector);
const requested = new URLSearchParams(location.search).get('team');
const active = Object.hasOwn(teams, requested) ? requested : 'software';
const title = teams[active] + '知识图谱';
document.title = title + ' · VERSION X';
$('#graph-title').textContent = title;
$('.knowledge-back').href = './story-' + active + '.html';
$('#team-return-label').textContent = '返回' + teams[active].replace(/团队$/, '') + '展区';
document.querySelector('.map-teams [data-team="' + active + '"]').setAttribute('aria-current', 'page');

const viewport = $('#map-viewport');
const art = $('#map-art');
const space = $('#map-space');
const position = $('#map-position');
const inspector = $('#map-inspector');
const legend = $('#map-legend');
const legendButton = $('#map-legend-button');
const miniMap = $('#mini-map');
const prev = $('#map-prev');
const next = $('#map-next');
const minus = $('#map-minus');
const plus = $('#map-plus');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 650px), (pointer: coarse) and (max-height: 600px)');
const levels = { required: '必学', recommended: '建议掌握', advanced: '进阶拓展' };
const svgNS = 'http://www.w3.org/2000/svg';
const clamp = (number, min, max) => Math.min(Math.max(min, number), max);
let model;
let zoom = 1;
let artLeft = 0;
let minZoom = .64;
let selected = null;
let hovered = null;
let focused = null;
let highlighted = null;
let drag = null;
let ignoreClick = false;
let windowRect;
let resize;
const cardElements = new Map();
const edgeElements = new Map();

function svg(name, attrs) {
  const el = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function addEdge(layer, edge) {
  const group = svg('g', { class: 'map-edge ' + edge.style });
  group.append(svg('path', { d: edge.path }));
  for (const item of edge.markers) {
    if (item.circle) group.append(svg('circle', { cx: item.circle[0], cy: item.circle[1], r: 3.1 }));
    if (item.triangle) group.append(svg('polygon', { points: item.triangle.map(p => p.join(',')).join(' ') }));
  }
  for (const id of edge.neighbors) {
    if (!edgeElements.has(id)) edgeElements.set(id, []);
    edgeElements.get(id).push(group);
  }
  layer.append(group);
}

// Branch headings from the original team maps, keyed by Figma node ID.
const chapterNodes = new Set({
  operations: ['1:717', '1:830', '1:833', '1:836', '1:839', '1:842', '1:845'],
  design: ['1:396', '1:421', '1:429', '1:505', '1:568'],
  software: ['1:77', '1:116', '1:140', '1:144', '1:170', '1:182', '1:308'],
  hardware: ['1:933', '1:947', '1:999', '1:1092', '1:1099', '1:1120'],
}[active]);

function renderNode(node) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-node ' + node.level + (node.anchor ? ' anchor' : '');
  if (chapterNodes.has(node.id)) button.classList.add('chapter');
  button.dataset.node = node.id;
  button.setAttribute('aria-label', node.label.join('，') + '，' + levels[node.level]);
  button.setAttribute('aria-pressed', 'false');
  Object.assign(button.style, {
    left: node.x + 'px', top: node.y + 'px',
    width: node.width + 'px', height: node.height + 'px',
  });
  const marker = document.createElement('span');
  marker.className = 'map-node-marker';
  marker.setAttribute('aria-hidden', 'true');
  const label = document.createElement('strong');
  label.textContent = node.label[0];
  const pixels = document.createElement('span');
  pixels.className = 'map-node-pixels';
  pixels.setAttribute('aria-hidden', 'true');
  button.append(pixels, marker, label);
  if (node.label.length > 1) {
    const sub = document.createElement('small');
    sub.textContent = node.label.slice(1).join(' · ');
    button.append(sub);
  }
  button.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && !drag?.moved) {
      hovered = node.id;
      updateHighlight();
    }
  });
  button.addEventListener('pointerleave', () => {
    if (hovered === node.id) hovered = null;
    updateHighlight();
  });
  button.addEventListener('focus', () => {
    focused = node.id;
    updateHighlight();
  });
  button.addEventListener('blur', () => {
    if (focused === node.id) focused = null;
    updateHighlight();
  });
  button.addEventListener('click', () => {
    if (ignoreClick) return;
    if (selected === node.id) {
      closeDetails();
      return;
    }
    cardElements.get(selected)?.setAttribute('aria-pressed', 'false');
    selected = node.id;
    button.setAttribute('aria-pressed', 'true');
    $('#node-level').textContent = levels[node.level];
    $('#node-title').textContent = node.label[0];
    const detail = $('#node-detail');
    detail.textContent = node.label.slice(1).join('\n');
    detail.hidden = node.label.length === 1;
    inspector.hidden = false;
    updateHighlight();
  });
  cardElements.set(node.id, button);
  return button;
}

function updateHighlight() {
  const id = hovered ?? focused ?? selected;
  if (id === highlighted) return;
  cardElements.get(highlighted)?.classList.remove('is-current');
  edgeElements.get(highlighted)?.forEach(edge => edge.classList.remove('is-lit'));
  highlighted = id;
  cardElements.get(id)?.classList.add('is-current');
  edgeElements.get(id)?.forEach(edge => edge.classList.add('is-lit'));
}

function closeDetails(restoreFocus = false) {
  const button = cardElements.get(selected);
  button?.setAttribute('aria-pressed', 'false');
  selected = null;
  inspector.hidden = true;
  updateHighlight();
  if (restoreFocus) button?.focus({ preventScroll: true });
}

function showLegend(open) {
  legend.hidden = !open;
  legendButton.setAttribute('aria-expanded', String(open));
}

function render(data) {
  resize?.disconnect();
  closeDetails();
  cardElements.clear();
  edgeElements.clear();
  art.replaceChildren();
  miniMap.replaceChildren();
  selected = hovered = focused = highlighted = null;
  model = layoutGraph(data, narrow.matches);
  const vertical = narrow.matches;
  $('.map-navigator').classList.toggle('is-vertical', vertical);
  const directions = vertical ? ['上', '下', '↑', '↓'] : ['左', '右', '←', '→'];
  for (const [i, button] of [prev, next].entries()) {
    button.textContent = directions[i + 2];
    button.title = '向' + directions[i] + '查看';
    button.setAttribute('aria-label', button.title + '图谱');
  }
  position.setAttribute('aria-label', vertical ? '图谱纵向进度' : '图谱横向位置');
  $('.touch-hint').textContent = vertical ? '上下滑动 · 点击节点' : '滑动画布 · 点击节点';
  Object.assign(art.style, { width: model.width + 'px', height: model.height + 'px' });
  const lines = svg('svg', { class: 'map-lines', viewBox: '0 0 ' + model.width + ' ' + model.height, 'aria-hidden': 'true' });
  model.edges.forEach(edge => addEdge(lines, edge));
  art.append(lines);
  const notes = document.createDocumentFragment();
  for (const note of model.notes) {
    const label = document.createElement('span');
    label.className = 'map-note';
    label.style.left = note.x + 'px';
    label.style.top = note.y + 'px';
    label.textContent = note.text;
    notes.append(label);
  }
  art.append(notes, ...model.nodes.map(renderNode));
  const miniature = svg('g', { class: 'mini-nodes' });
  for (const { x, y, width, height } of model.nodes) {
    miniature.append(svg('rect', { x: x / model.width * 700, y: y / model.height * 32, width: width / model.width * 700, height: height / model.height * 32 }));
  }
  windowRect = svg('rect', { class: 'mini-window', x: 0, y: .5, height: 31 });
  miniMap.append(miniature, windowRect);
  $('#map-status').hidden = true;
  home();
  resize = new ResizeObserver(syncNavigation);
  resize.observe(viewport);
}

function syncNavigation() {
  if (!model) return;
  const max = narrow.matches ? viewport.scrollHeight - viewport.clientHeight : viewport.scrollWidth - viewport.clientWidth;
  const current = narrow.matches ? viewport.scrollTop : viewport.scrollLeft;
  const visible = clamp(viewport.clientWidth / (model.width * zoom), 0, 1);
  const overviewX = visible >= 1 ? 0 : viewport.scrollLeft / (model.width * zoom) * 700;
  windowRect.setAttribute('x', overviewX);
  windowRect.setAttribute('width', Math.max(0, visible * 700 - .5));
  windowRect.setAttribute('y', Math.max(.5, viewport.scrollTop / (model.height * zoom) * 32));
  windowRect.setAttribute('height', Math.min(31, viewport.clientHeight / (model.height * zoom) * 32));
  position.value = max ? Math.round(current / max * 1000) : 0;
  position.setAttribute('aria-valuetext', Math.round(Number(position.value) / 10) + '%');
  prev.disabled = current < 1;
  next.disabled = max - current < 1;
  minus.disabled = zoom <= minZoom + .001;
  plus.disabled = zoom >= 1.52 - .001;
}

function applyZoom(nextZoom, origin) {
  if (!model) return;
  const center = origin ?? [
    (viewport.scrollLeft + viewport.clientWidth / 2 - artLeft) / zoom,
    (viewport.scrollTop + viewport.clientHeight / 2) / zoom,
  ];
  zoom = clamp(nextZoom, minZoom, 1.52);
  art.style.transform = 'scale(' + zoom + ')';
  const anchor = model.nodes.find(node => node.anchor);
  const anchorCenter = (anchor.x + anchor.width / 2) * zoom;
  const halfWidth = viewport.clientWidth / 2;
  artLeft = narrow.matches ? Math.max(0, halfWidth - anchorCenter) : 0;
  const rightInset = narrow.matches ? Math.max(0, halfWidth - (model.width * zoom - anchorCenter)) : 0;
  art.style.left = artLeft + 'px';
  space.style.setProperty('--grid-origin', artLeft + 'px');
  space.style.setProperty('--grid-major', 96 * zoom + 'px');
  space.style.setProperty('--grid-minor', 24 * zoom + 'px');
  space.style.width = Math.ceil(artLeft + model.width * zoom + rightInset) + 'px';
  space.style.height = Math.ceil(model.height * zoom) + 'px';
  viewport.scrollTo({ left: artLeft + center[0] * zoom - viewport.clientWidth / 2, top: center[1] * zoom - viewport.clientHeight / 2, behavior: 'instant' });
  $('#map-zoom').textContent = Math.round(zoom * 100) + '%';
  syncNavigation();
}

function home() {
  if (!model) return;
  const anchor = model.nodes.find(node => node.anchor);
  if (narrow.matches) {
    const startZoom = .6;
    minZoom = clamp(viewport.clientWidth / model.width, .25, startZoom);
    const originY = anchor.y + (viewport.clientHeight / 2 - 26) / startZoom;
    applyZoom(startZoom, [anchor.x + anchor.width / 2, originY]);
    return;
  }
  minZoom = clamp((viewport.clientHeight - 12) / model.height, .42, .64);
  const fit = clamp((viewport.clientHeight - 6) / model.height, .74, 1.05);
  applyZoom(fit, [viewport.clientWidth / (2 * fit), anchor.y + anchor.height / 2]);
}

function pageBy(direction) {
  const delta = narrow.matches ? { top: direction * viewport.clientHeight * .67 } : { left: direction * viewport.clientWidth * .67 };
  viewport.scrollBy({ ...delta, behavior: motion.matches ? 'instant' : 'smooth' });
}

viewport.addEventListener('scroll', syncNavigation, { passive: true });
viewport.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  ignoreClick = false;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
});
viewport.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  const x = event.clientX - drag.x;
  const y = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(x, y) < 6) return;
  if (!drag.moved) {
    viewport.setPointerCapture(event.pointerId);
    drag.moved = true;
    hovered = null;
    focused = null;
    viewport.focus({ preventScroll: true });
    viewport.classList.add('is-dragging');
    updateHighlight();
  }
  viewport.scrollTo({ left: drag.left - x, top: drag.top - y, behavior: 'instant' });
});
function stopDrag(event) {
  if (drag?.id !== event.pointerId) return;
  ignoreClick = drag.moved;
  drag = null;
  viewport.classList.remove('is-dragging');
  setTimeout(() => { ignoreClick = false; }, 0);
}
window.addEventListener('pointerup', stopDrag);
window.addEventListener('pointercancel', stopDrag);
viewport.addEventListener('lostpointercapture', stopDrag);
viewport.addEventListener('wheel', event => {
  if (event.ctrlKey || event.deltaX || !event.deltaY || event.shiftKey) return;
  if (viewport.scrollHeight - viewport.clientHeight > 24) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1);
  viewport.scrollLeft += delta;
  event.preventDefault();
}, { passive: false });

viewport.addEventListener('keydown', event => {
  if (event.target !== viewport || !model) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    viewport.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * 92, behavior: 'instant' });
  } else if (event.key === 'Home') {
    home();
  } else if (event.key === 'End') {
    if (narrow.matches) viewport.scrollTop = viewport.scrollHeight;
    else viewport.scrollLeft = viewport.scrollWidth;
  } else {
    return;
  }
  event.preventDefault();
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!legend.hidden) {
    showLegend(false);
    legendButton.focus();
  } else if (!inspector.hidden) {
    closeDetails(true);
  }
});

prev.addEventListener('click', () => pageBy(-1));
next.addEventListener('click', () => pageBy(1));
minus.addEventListener('click', () => applyZoom(zoom / 1.18));
plus.addEventListener('click', () => applyZoom(zoom * 1.18));
$('#map-home').addEventListener('click', home);
$('#node-close').addEventListener('click', () => closeDetails(true));
legendButton.addEventListener('click', () => showLegend(legend.hidden));
position.addEventListener('input', () => {
  const fraction = Number(position.value) / 1000;
  if (narrow.matches) viewport.scrollTop = fraction * (viewport.scrollHeight - viewport.clientHeight);
  else viewport.scrollLeft = fraction * (viewport.scrollWidth - viewport.clientWidth);
});

try {
  const response = await fetch('./assets/knowledge/' + active + '.json');
  if (!response.ok) throw new Error('Graph data request failed: ' + response.status);
  const data = await response.json();
  render(data);
  narrow.addEventListener('change', () => render(data));
} catch (error) {
  console.error(error);
  $('#map-status').textContent = '图谱暂时无法载入，请刷新页面重试。';
}
