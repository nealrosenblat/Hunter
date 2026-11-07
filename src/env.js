import * as THREE from 'three';
import { tex, texR } from './textures.js';
import { M, B, box, cyl, blobShadow, makeWagon } from './models.js';
import { mergeGeometries, rand, pick } from './util.js';

export const LA_COLORS = [0xe8c9a0, 0xd98c6a, 0x9fc7c0, 0xe0a0b0, 0xc8b48a, 0xf0e0c0, 0xb0c8e0, 0xd0a878];

export function sky(scene, { top = 0x2a1b5e, mid = 0xe0507a, horizon = 0xffb347, bottom = 0x5a3a4a, sun = null } = {}) {
  const R = 900;
  const geo = new THREE.SphereGeometry(R, 24, 16);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const cT = new THREE.Color(top), cM = new THREE.Color(mid), cH = new THREE.Color(horizon), cB = new THREE.Color(bottom), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / R;
    if (y > 0.22) c.copy(cM).lerp(cT, Math.min(1, (y - 0.22) / 0.55));
    else if (y > 0) c.copy(cH).lerp(cM, y / 0.22);
    else c.copy(cH).lerp(cB, Math.min(1, -y * 5));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  m.frustumCulled = false;
  scene.add(m);
  if (sun) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(sun.size || 70, 20), new THREE.MeshBasicMaterial({ color: sun.color || 0xffe08a, fog: false, depthWrite: false }));
    s.position.copy(sun.dir).normalize().multiplyScalar(R * 0.92);
    s.lookAt(0, 0, 0);
    s.renderOrder = -9;
    m.add(s);
  }
  return m;
}

export function skylineRing(scene, { radius = 720, color = 0xffffff, y = 50 } = {}) {
  const g = new THREE.CylinderGeometry(radius, radius, 150, 40, 1, true);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: texR('skyline', 7, 1), transparent: true, alphaTest: 0.5, side: THREE.BackSide, fog: false, color, depthWrite: false }));
  m.position.y = y;
  m.renderOrder = -8;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}

const palmMat = () => M(0xffffff, { map: tex('trunk') });
const leafMat = () => M(0xffffff, { map: tex('palmLeaf'), alphaTest: 0.5, side: THREE.DoubleSide });

export function palm(h = rand(9, 13)) {
  const g = new THREE.Group();
  const segs = [];
  let x = 0, z = 0;
  const lx = rand(-0.06, 0.06), lz = rand(-0.06, 0.06);
  const n = 6, sh = h / n;
  for (let i = 0; i < n; i++) {
    const c = new THREE.CylinderGeometry(0.2 - i * 0.012, 0.25 - i * 0.012, sh * 1.02, 6);
    c.translate(x, sh * i + sh / 2, z);
    segs.push(c);
    x += lx * i; z += lz * i;
  }
  g.add(new THREE.Mesh(mergeGeometries(segs), palmMat()));
  const fronds = [];
  const k = 9;
  for (let i = 0; i < k; i++) {
    const p = new THREE.PlaneGeometry(4.4, 1.2);
    p.translate(2.2, 0, 0);
    p.rotateX(-Math.PI / 2);
    p.rotateZ(-rand(0.3, 0.75));
    p.rotateY((i / k) * Math.PI * 2 + rand(-0.2, 0.2));
    p.translate(x, h, z);
    fronds.push(p);
  }
  g.add(new THREE.Mesh(mergeGeometries(fronds), leafMat()));
  return g;
}

export function building(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, map: texR('windows', Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 5))) }));
  m.position.y = h / 2;
  const roof = box(w + 0.4, 0.4, d + 0.4, M(0x6a6058));
  roof.position.y = h / 2 + 0.2;
  m.add(roof);
  return m;
}

export function streetLight(armDir = 1) {
  const g = new THREE.Group();
  const pole = cyl(0.1, 0.14, 7, 6, M(0x5a5f66));
  pole.position.y = 3.5;
  g.add(pole);
  const arm = box(1.8, 0.1, 0.1, M(0x5a5f66));
  arm.position.set(armDir * 0.85, 6.95, 0);
  g.add(arm);
  const lamp = box(0.6, 0.18, 0.3, B(0xffe6a0));
  lamp.position.set(armDir * 1.65, 6.82, 0);
  g.add(lamp);
  return g;
}

export function makeSign(text, { w = 4, h = 1, bg = '#1a2a6a', fg = '#ffffff', font = 'bold 40px sans-serif', glow = null } = {}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 * (h / w));
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font;
  if (glow) { x.shadowColor = glow; x.shadowBlur = 8; }
  x.fillStyle = fg;
  const lines = text.split('\n');
  lines.forEach((l, i) => x.fillText(l, c.width / 2, (c.height * (i + 0.5)) / lines.length, c.width - 10));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
}

/**
 * A sunny LA boulevard running along +Z: road x∈[-6,6], sidewalks, palms, low pastel buildings.
 */
export function buildStreet(scene, { time = 'sunset', zMin = -160, zMax = 360, station = false } = {}) {
  const sunset = time === 'sunset';
  scene.fog = new THREE.Fog(sunset ? 0xe8907a : 0x6a5a8a, 50, 360);
  sky(scene, sunset
    ? { top: 0x2a1b5e, mid: 0xd9507a, horizon: 0xffb04a, bottom: 0x8a5a5a, sun: { dir: new THREE.Vector3(0, 0.06, 1), color: 0xffe7a0, size: 75 } }
    : { top: 0x0f1238, mid: 0x55308a, horizon: 0xe0607a, bottom: 0x3a2a4a, sun: { dir: new THREE.Vector3(0.3, 0.01, 1), color: 0xff9a6a, size: 60 } });
  skylineRing(scene, { color: sunset ? 0xb06a8a : 0x6a4a8a });
  scene.add(new THREE.HemisphereLight(sunset ? 0xffd0b0 : 0x9a8ad0, 0x5a4a50, sunset ? 1.5 : 1.2));
  const sun = new THREE.DirectionalLight(sunset ? 0xffb070 : 0xffa0a0, sunset ? 2.2 : 1.4);
  sun.position.set(-20, 18, 60);
  scene.add(sun);

  const len = zMax - zMin, mid = (zMin + zMax) / 2;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, len), new THREE.MeshLambertMaterial({ map: texR('road', 1, len / 12) }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, mid);
  scene.add(road);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, len), new THREE.MeshLambertMaterial({ map: texR('sidewalk', 1, len / 3.2) }));
    sw.position.set(sx * 7.6, 0.08, mid);
    scene.add(sw);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, len), new THREE.MeshLambertMaterial({ map: texR('dirt', 40, len / 10) }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, mid);
  scene.add(ground);

  for (const sx of [-1, 1]) {
    let z = zMin;
    while (z < zMax) {
      const w = rand(10, 18), h = rand(6, 22), d = rand(10, 16);
      if (station && sx < 0 && z + w > -2 && z < 30) { z += w; continue; }
      const b = building(d, h, w, pick(LA_COLORS));
      b.position.x = sx * (9.4 + d / 2 + rand(0, 3));
      b.position.z = z + w / 2;
      scene.add(b);
      z += w + rand(1, 6);
    }
    for (let pz = zMin + 6; pz < zMax; pz += 24) {
      const p = palm();
      p.position.set(sx * 7.9, 0.16, pz + (sx > 0 ? 12 : 0));
      scene.add(p);
    }
    for (let lz = zMin + 20; lz < zMax; lz += 46) {
      if (station && sx < 0 && Math.abs(lz - 14) < 16) continue;
      const l = streetLight(-sx);
      l.position.set(sx * 6.6, 0.16, lz + (sx > 0 ? 23 : 0));
      scene.add(l);
    }
  }
  // parked cars
  for (let i = 0; i < 6; i++) {
    const c = makeWagon(pick([0x2a6a8a, 0xb0b0a0, 0x8a2a2a, 0xd0c070, 0x3a5a3a]));
    const sx = i % 2 ? 1 : -1;
    c.root.position.set(sx * 4.8, 0, zMin + 40 + i * 52);
    c.root.rotation.y = sx > 0 ? 0 : Math.PI;
    scene.add(c.root);
  }
  if (station) {
    const st = building(18, 14, 26, 0xd8d0c0);
    st.position.set(-17, 0, 14);
    scene.add(st);
    const sign = makeSign('METRO POLICE\nDIVISION 7', { w: 6, h: 1.65, bg: '#1b2a5a', fg: '#ffffff', font: 'bold 34px sans-serif' });
    sign.position.set(-7.9, 6.6, 14);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    const steps = box(1.4, 0.5, 6, M(0xbab2a4));
    steps.position.set(-8.6, 0.25, 14);
    scene.add(steps);
    const door = box(0.2, 3, 3, M(0x2b3a50));
    door.position.set(-7.95, 1.5, 14);
    scene.add(door);
  }
  return { groundY: () => 0 };
}
