const horizontalScale = 2.45;
const verticalScale = .44;
const padding = 48;

function depthProjection(nodes, top, scale) {
  const boxes = nodes.map(({ p }) => [p[1], p[1] + p[3]]).sort((a, b) => a[0] - b[0]);
  let previousEnd = top;
  let saved = 0;
  const gaps = [];
  for (const [start, end] of boxes) {
    const gap = start - previousEnd;
    if (gap > 108) {
      const compression = 1 - 108 / gap;
      gaps.push({ start: previousEnd, end: start, saved, compression });
      saved += gap * compression;
    }
    previousEnd = Math.max(previousEnd, end);
  }
  return (sourceY) => {
    const gap = gaps.findLast(({ start }) => start <= sourceY);
    const reduced = gap ? gap.saved + (Math.min(gap.end, sourceY) - gap.start) * gap.compression : 0;
    return padding + (sourceY - top - reduced) * scale;
  };
}

function marker(cap, [x, y], [ox, oy]) {
  if (cap === 'CIRCLE_FILLED') return { circle: [x, y] };
  if (!cap.startsWith('ARROW')) return null;
  const length = Math.hypot(x - ox, y - oy);
  if (length < .1) return null;
  const ux = (x - ox) / length;
  const uy = (y - oy) / length;
  return { triangle: [[x, y], [x - ux * 7 - uy * 3.4, y - uy * 7 + ux * 3.4], [x - ux * 7 + uy * 3.4, y - uy * 7 - ux * 3.4]] };
}

function edgeNeighbors(points, source, boxes) {
  const degrees = points.map(() => 0);
  for (const [a, b] of source.parts) {
    degrees[a] += 1;
    degrees[b] += 1;
  }
  const neighbors = new Set();
  points.forEach(([x, y], index) => {
    if (degrees[index] !== 1) return;
    let nearest = null;
    let minDistance = 23;
    for (const box of boxes) {
      const distance = Math.hypot(
        Math.max(box.x - x, x - box.x - box.width, 0),
        Math.max(box.y - y, y - box.y - box.height, 0),
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = box.id;
      }
    }
    if (nearest) neighbors.add(nearest);
  });
  return neighbors;
}

function layoutEdge(source, project, boxes) {
  const points = source.points.map(project);
  const from = new Map();
  const to = new Map();
  for (const segment of source.parts) {
    const [a, b] = segment;
    if (!from.has(a)) from.set(a, []);
    if (!to.has(b)) to.set(b, []);
    from.get(a).push(segment);
    to.get(b).push(segment);
  }
  const visited = new Set();
  const path = [];
  const walk = ([start], segment) => {
    path.push('M' + points[start].join(' '));
    while (segment && !visited.has(segment)) {
      visited.add(segment);
      const [, end, ...curve] = segment;
      const target = points[end].join(' ');
      path.push(curve.length ? 'C' + [project(curve.slice(0, 2)), project(curve.slice(2)), points[end]].map(p => p.join(' ')).join(' ') : 'L' + target);
      const onward = from.get(end) ?? [];
      segment = onward.length === 1 && to.get(end)?.length === 1 ? onward[0] : null;
    }
  };
  for (const segment of source.parts) {
    const [start] = segment;
    if (to.get(start)?.length !== 1 || from.get(start)?.length !== 1) walk(segment, segment);
  }
  for (const segment of source.parts) {
    if (!visited.has(segment)) walk(segment, segment);
  }
  const markers = source.caps.flatMap((cap, i) => {
    if (!cap || cap === 'NONE') return [];
    const incoming = to.get(i)?.[0];
    const outgoing = from.get(i)?.[0];
    const neighbor = incoming ? points[incoming[0]] : outgoing ? points[outgoing[1]] : points[i];
    return marker(cap, points[i], neighbor) ?? [];
  });
  const style = source.dash.length ? source.dash[0] < 10 ? 'inclusion' : 'supplementary' : 'prerequisite';
  return { path: path.join(' '), markers, style, neighbors: edgeNeighbors(points, source, boxes) };
}

export function layoutGraph(data, verticalFlow = false) {
  const bounds = data.nodes.flatMap(({ p: [x, y, w, h] }) => [[x, y], [x + w, y + h]])
    .concat(data.edges.flatMap(edge => edge.points));
  const top = Math.min(...bounds.map(p => p[1]));
  const bottom = Math.max(...bounds.map(p => p[1]));
  const left = Math.min(...bounds.map(p => p[0]));
  const right = Math.max(...bounds.map(p => p[0]));
  const depth = depthProjection(data.nodes, top, verticalFlow ? 1.2 : horizontalScale);
  const across = x => padding + (x - left) * (verticalFlow ? .8 : verticalScale);
  const project = verticalFlow
    ? ([x, y]) => [across(x), depth(y)]
    : ([x, y]) => [depth(y), across(x)];
  const nodes = data.nodes.map((node, index) => {
    const [x, y, w, h] = node.p;
    const level = node.fill?.every(channel => channel === 1) ? 'advanced'
      : node.fill?.every(channel => channel === .9) ? 'recommended' : 'required';
    const [x1, y1] = project([x, y]);
    const [x2, y2] = project([x + w, y + h]);
    return {
      id: node.id, label: node.label, level, anchor: index === 0,
      x: x1, y: y1, width: x2 - x1, height: y2 - y1,
    };
  }).sort((a, b) => verticalFlow ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y);
  const notes = data.notes.map(({ p: [x, y, w, h], text }) => {
    const [left, top] = project([x + w / 2, y + h / 2]);
    return { x: left, y: top, text };
  });
  const edges = data.edges.map(edge => layoutEdge(edge, project, nodes));
  const [endX, endY] = project([right, bottom]);
  return { nodes, edges, notes, width: endX + padding, height: endY + padding };
}
