import * as THREE from 'three';

export const PACK = { width: 2.64, height: 4.04, tearY: 1.65, seam: 0.22 };

// A closed pillow pouch: front/back grids share the same serrated perimeter.
// The body is inflated; the heat-sealed ends remain flat and finely ribbed.
export function pouchPoint(u, v, side = 1) {
  const h = PACK.height / 2;
  const yBase = v * h;
  const sealed = Math.abs(yBase) > h - PACK.seam;
  const endTooth = Math.abs(v) > 0.999 ? (Math.round((u + 1) * 40) % 2) * 0.025 : 0;
  const y = yBase - Math.sign(v) * endTooth;
  const x = u * PACK.width / 2 * (0.975 + 0.025 * Math.abs(v));
  const edge = Math.max(0, 1 - u * u);
  const inflateY = Math.max(0, 1 - Math.pow(Math.abs(yBase) / (h - 0.13), 6));
  const pillow = 0.255 * Math.pow(edge * inflateY, 0.52);
  const sideFold = 0.024 * Math.sin(33 * v + 8 * u) * Math.exp(-Math.pow((Math.abs(u) - 0.89) / 0.13, 2));
  const cornerFold = 0.023 * Math.sin(u * 31 + v * 16) * Math.pow(Math.abs(v), 6) * edge;
  const seamRib = 0.009 * Math.sin(yBase * 220) * edge;
  const z = side * (0.012 + (sealed ? seamRib : pillow + sideFold + cornerFold));
  return [x, y, z];
}

export function createPouchPart(yMin, yMax) {
  const nx = 80;
  const ny = Math.max(12, Math.round(100 * (yMax - yMin) / PACK.height));
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
  for (let i = 0; i < nx; i++) { connect(i + 1, i); connect(ny * row + i, ny * row + i + 1); }
  for (let j = 0; j < ny; j++) { connect(j * row, (j + 1) * row); connect((j + 1) * row + nx, j * row + nx); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Assign distinct original front/back artworks and the silver edge.
  const surfaceIndexCount = nx * ny * 6;
  geometry.addGroup(0, surfaceIndexCount, 0);
  geometry.addGroup(surfaceIndexCount, surfaceIndexCount, 1);
  geometry.addGroup(surfaceIndexCount * 2, indices.length - surfaceIndexCount * 2, 2);
  geometry.computeVertexNormals();
  geometry.userData.original = Float32Array.from(positions);
  return geometry;
}

export function openPouchMouth(geometry, amount) {
  const position = geometry.attributes.position;
  const original = geometry.userData.original;
  for (let i = 0; i < position.count; i++) {
    const y = original[i * 3 + 1], z = original[i * 3 + 2];
    const t = THREE.MathUtils.smoothstep(y, 1.03, PACK.tearY);
    position.setZ(i, z + Math.sign(z || 1) * t * amount * 0.18);
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
