import * as THREE from 'three';

export const PACK = { width: 2.2, height: 4.8, tearY: 2.04, seam: 0.25 };

const gaussian = (value, center, width) => Math.exp(-Math.pow((value - center) / width, 2));

// A closed pillow pouch: front/back grids share the same serrated perimeter.
// The body is inflated; the heat-sealed ends remain flat and finely ribbed.
export function pouchPoint(u, v, side = 1) {
  const h = PACK.height / 2;
  const yBase = v * h;
  const sealed = Math.abs(yBase) > h - PACK.seam;
  const endTooth = Math.abs(v) > 0.999 ? (Math.round((u + 1) * 48) % 2) * 0.021 : 0;
  const y = yBase - Math.sign(v) * endTooth;
  const edge = Math.max(0, 1 - Math.pow(u, 4));
  const x = u * PACK.width / 2 * (0.984 + 0.016 * Math.abs(v)) + Math.sign(u) * 0.006 * Math.sin(v * 7 + 1) * Math.pow(Math.abs(u), 9) * (1 - Math.abs(v));
  const inflateY = Math.max(0, 1 - Math.pow(Math.abs(yBase) / (h - PACK.seam + 0.02), 10));
  const pillow = 0.172 * Math.pow(edge, 0.5) * Math.pow(inflateY, 0.52);
  const edgeChannel = -0.048 * gaussian(Math.abs(u), 0.88, 0.066) * (1 - Math.pow(v, 8));
  const rolledEdge = 0.026 * gaussian(Math.abs(u), 0.975, 0.035) * inflateY;
  const cornerStress = 0.032 * Math.sin(u * 27 + v * 17 + side * 0.8) * gaussian(Math.abs(u), 0.78, 0.27) * Math.pow(Math.abs(v), 7) * inflateY;
  const longCrease = 0.013 * Math.sin(v * 5 + u * 12) * gaussian(Math.abs(u), 0.78, 0.18) * inflateY;
  const filmWave = 0.0012 * Math.sin(u * 19 - v * 11) * edge * inflateY * (Math.pow(u, 6) + Math.pow(v, 8));
  const sealRib = 0.0045 * Math.cos(yBase * 148) * edge;
  const z = side * Math.max(0.008, sealed ? 0.012 + sealRib : 0.012 + pillow + edgeChannel + rolledEdge + cornerStress + longCrease + filmWave);
  return [x, y, z];
}

export function createPouchPart(yMin, yMax) {
  const nx = 96;
  const ny = Math.max(12, Math.round(128 * (yMax - yMin) / PACK.height));
  const positions = [], uvs = [], indices = [];
  const row = nx + 1;
  const surfaceSize = row * (ny + 1);
  for (const side of [1, -1]) {
    for (let j = 0; j <= ny; j++) {
      const y = yMin + (yMax - yMin) * j / ny;
      const v = y / (PACK.height / 2);
      for (let i = 0; i <= nx; i++) {
        const u = i / nx * 2 - 1;
        positions.push(...pouchPoint(u, v, side));
        uvs.push(side === 1 ? i / nx : 1 - i / nx, (v + 1) / 2);
      }
    }
  }
  for (let s = 0; s < 2; s++) {
    const o = s * surfaceSize;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = o + j * row + i, b = a + 1, c = a + row, d = c + 1;
      if (s === 0) indices.push(a, b, d, a, d, c);
      else indices.push(a, d, b, a, c, d);
    }
  }
  // Closed rim. It gives the pouch a visible edge at every rotation angle.
  const connect = (a, b) => {
    indices.push(a, a + surfaceSize, b, b, a + surfaceSize, b + surfaceSize);
  };
  const rimStart = indices.length;
  for (let i = 0; i < nx; i++) connect(i + 1, i);
  const topRimStart = indices.length;
  for (let i = 0; i < nx; i++) connect(ny * row + i, ny * row + i + 1);
  const sideRimStart = indices.length;
  for (let j = 0; j < ny; j++) { connect(j * row, (j + 1) * row); connect((j + 1) * row + nx, j * row + nx); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Assign distinct original front/back artworks and the silver edge.
  const surfaceIndexCount = nx * ny * 6;
  geometry.addGroup(0, surfaceIndexCount, 0);
  geometry.addGroup(surfaceIndexCount, surfaceIndexCount, 1);
  geometry.addGroup(rimStart, nx * 6, Math.abs(yMin - PACK.tearY) < 0.001 ? 3 : 2);
  geometry.addGroup(topRimStart, nx * 6, Math.abs(yMax - PACK.tearY) < 0.001 ? 3 : 2);
  geometry.addGroup(sideRimStart, indices.length - sideRimStart, 2);
  geometry.computeVertexNormals();
  geometry.userData.original = Float32Array.from(positions);
  geometry.userData.surfaceSize = surfaceSize;
  return geometry;
}

export function openPouchMouth(geometry, amount) {
  const position = geometry.attributes.position;
  const original = geometry.userData.original;
  for (let i = 0; i < position.count; i++) {
    const y = original[i * 3 + 1], z = original[i * 3 + 2];
    const t = THREE.MathUtils.smoothstep(y, PACK.tearY - 0.65, PACK.tearY);
    const side = i < geometry.userData.surfaceSize ? 1 : -1;
    position.setZ(i, z + side * t * amount * 0.22);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

// The released part curls around the moving tear front; its right end stays attached.
export function curlSeal(geometry, progress) {
  const position = geometry.attributes.position, original = geometry.userData.original;
  const cut = -1 + 2 * progress;
  for (let i = 0; i < position.count; i++) {
    const x = original[i * 3], y = original[i * 3 + 1], z = original[i * 3 + 2];
    const u = x / (PACK.width / 2), distance = Math.max(0, cut - u);
    const released = THREE.MathUtils.smoothstep(distance, 0, 0.35);
    const angle = released * progress * 0.8;
    const relative = x - cut * PACK.width / 2;
    position.setXYZ(i,
      x + relative * (Math.cos(angle) - 1),
      y + Math.abs(relative) * Math.sin(angle) * 0.24,
      z + released * progress * (0.06 + distance * 0.16)
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function roundedCardShape(width, height, radius) {
  const x = -width / 2, y = -height / 2, s = new THREE.Shape();
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

export function cardFaceGeometry(width = 2.12, height = 2.97) {
  const g = new THREE.ShapeGeometry(roundedCardShape(width, height, 0.09), 8);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / width + 0.5, p.getY(i) / height + 0.5);
  return g;
}

export const easeOutCubic = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const smooth = t => { const p = Math.min(1, Math.max(0, t)); return p * p * (3 - 2 * p); };
export const easeOutBack = t => { const p = Math.min(1, Math.max(0, t)) - 1; return 1 + 2.1 * p * p * p + 1.1 * p * p; };
