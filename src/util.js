import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export const dampAngle = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));

export const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Merge several (indexed or not) BufferGeometries into one non-indexed geometry. */
export function mergeGeometries(geoms) {
  const parts = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const hasColor = parts.every((g) => g.attributes.color);
  const col = hasColor ? new Float32Array(count * 3) : null;
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) col.set(g.attributes.color.array, o * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Free GPU resources for everything in a scene graph, except shared/cached items. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData.keep) continue;
      for (const k of ['map', 'alphaMap', 'emissiveMap']) {
        if (m[k] && !m[k].userData.keep) m[k].dispose();
      }
      m.dispose();
    }
  });
}

// ---------- 2D collision helpers (XZ plane) ----------

/** Push a circle (obj.x, obj.z, radius r) out of an axis-aligned box. Returns true on contact. */
export function resolveCircleBox(obj, r, b) {
  const cx = clamp(obj.x, b.minX, b.maxX);
  const cz = clamp(obj.z, b.minZ, b.maxZ);
  const dx = obj.x - cx;
  const dz = obj.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    obj.x += (dx / d) * (r - d);
    obj.z += (dz / d) * (r - d);
  } else {
    const pl = obj.x - b.minX, pr = b.maxX - obj.x, pu = obj.z - b.minZ, pd = b.maxZ - obj.z;
    const m = Math.min(pl, pr, pu, pd);
    if (m === pl) obj.x = b.minX - r;
    else if (m === pr) obj.x = b.maxX + r;
    else if (m === pu) obj.z = b.minZ - r;
    else obj.z = b.maxZ + r;
  }
  return true;
}

/** Ray (origin o, unit dir d) vs box, returns distance or -1. */
export function rayBox(ox, oz, dx, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  if (Math.abs(dx) < 1e-9) {
    if (ox < b.minX || ox > b.maxX) return -1;
  } else {
    let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < b.minZ || oz > b.maxZ) return -1;
  } else {
    let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

/** Ray vs circle, returns distance or -1. */
export function rayCircle(ox, oz, dx, dz, cx, cz, r, maxT) {
  const fx = ox - cx, fz = oz - cz;
  const b = fx * dx + fz * dz;
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  if (t < 0 || t > maxT) return -1;
  return t;
}
