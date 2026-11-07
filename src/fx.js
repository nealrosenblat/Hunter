import * as THREE from 'three';
import { rand } from './util.js';

const PVERT = `
attribute float size;
attribute vec4 pcolor;
varying vec4 vColor;
uniform float scale;
void main() {
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(48.0, size * scale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = `
varying vec4 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5 || vColor.a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * smoothstep(0.5, 0.18, d));
}`;

class Particles {
  constructor(scene, cap, additive) {
    this.cap = cap;
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.base = new Float32Array(cap * 4);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('pcolor', this.aCol);
    g.setAttribute('size', this.aSize);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 160 } },
      vertexShader: PVERT, fragmentShader: PFRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, a = 1, grav = 0, grow = 0) {
    let i = this.n;
    if (i >= this.cap) i = Math.floor(Math.random() * this.cap);
    else this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size; this.grav[i] = grav; this.grow[i] = grow;
    this.base[i * 4] = r; this.base[i * 4 + 1] = g; this.base[i * 4 + 2] = b; this.base[i * 4 + 3] = a;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) this.copy(j, i);
        continue;
      }
      const t = this.life[i] / this.maxLife[i];
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
      this.size[i] += this.grow[i] * dt;
      this.col[i * 4] = this.base[i * 4];
      this.col[i * 4 + 1] = this.base[i * 4 + 1];
      this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, t * 2);
      i++;
    }
    for (let k = this.n; k < Math.min(this.cap, this.n + 64); k++) this.col[k * 4 + 3] = 0;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  }
  copy(from, to) {
    for (let k = 0; k < 3; k++) { this.pos[to * 3 + k] = this.pos[from * 3 + k]; this.vel[to * 3 + k] = this.vel[from * 3 + k]; }
    for (let k = 0; k < 4; k++) this.base[to * 4 + k] = this.base[from * 4 + k];
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.size[to] = this.size[from]; this.grav[to] = this.grav[from]; this.grow[to] = this.grow[from];
  }
}

const _v = new THREE.Vector3();

export class FX {
  constructor(scene, { lights = 2 } = {}) {
    this.scene = scene;
    this.soft = new Particles(scene, 1400, false);
    this.glow = new Particles(scene, 900, true);
    this.debris = [];
    this.balls = [];
    this.tracers = [];
    this.flashes = [];
    this.lights = [];
    for (let i = 0; i < lights; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 18, 1.6);
      scene.add(l);
      this.lights.push({ l, t: 0 });
    }
    this.fireGeo = new THREE.IcosahedronGeometry(1, 1);
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xfff2a0, transparent: true });
    this.flashGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
    this.groundY = () => 0;
  }

  setScale(s) { this.soft.mat.uniforms.scale.value = s; this.glow.mat.uniforms.scale.value = s; }

  sparks(p, n = 8, color = [1, 0.85, 0.4], speed = 6) {
    for (let i = 0; i < n; i++) {
      this.glow.spawn(p.x, p.y, p.z, rand(-1, 1) * speed, rand(0, 1.2) * speed, rand(-1, 1) * speed, rand(0.15, 0.4), rand(0.05, 0.12), ...color, 1, 18);
    }
  }
  dust(p, n = 6, color = [0.6, 0.55, 0.48]) {
    for (let i = 0; i < n; i++) this.soft.spawn(p.x, p.y, p.z, rand(-1.5, 1.5), rand(0.3, 2), rand(-1.5, 1.5), rand(0.4, 0.9), rand(0.2, 0.4), ...color, 0.7, 2, 0.8);
  }
  smoke(p, size = 0.5, color = [0.25, 0.25, 0.27], vel = null) {
    this.soft.spawn(p.x + rand(-0.2, 0.2), p.y, p.z + rand(-0.2, 0.2), (vel?.x ?? 0) + rand(-0.4, 0.4), (vel?.y ?? 0) + rand(1, 2.2), (vel?.z ?? 0) + rand(-0.4, 0.4), rand(0.8, 1.6), size, ...color, 0.55, -0.4, size * 1.2);
  }
  blood(p) { // TV-friendly: just a puff of fabric dust
    for (let i = 0; i < 5; i++) this.soft.spawn(p.x, p.y, p.z, rand(-1, 1), rand(0, 2), rand(-1, 1), 0.35, 0.12, 0.85, 0.85, 0.8, 0.8, 8);
  }
  confetti(p, n = 40) {
    for (let i = 0; i < n; i++) {
      const c = [[1, 0.25, 0.65], [0.25, 0.95, 1], [1, 0.85, 0.25], [0.5, 1, 0.4]][i % 4];
      this.soft.spawn(p.x, p.y, p.z, rand(-4, 4), rand(2, 7), rand(-4, 4), rand(1, 2), 0.12, ...c, 1, 9);
    }
  }

  explosion(p, scale = 1) {
    for (const [color, s0, s1, life] of [[0xffd040, 0.4, 2.6, 0.35], [0xff6a1a, 0.6, 3.4, 0.55], [0x552211, 0.8, 4.2, 0.9]]) {
      const m = new THREE.Mesh(this.fireGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
      m.position.copy(p); m.position.y += 0.6 * scale;
      this.scene.add(m);
      this.balls.push({ m, t: 0, life, s0: s0 * scale, s1: s1 * scale });
    }
    for (let i = 0; i < 40 * scale; i++) this.glow.spawn(p.x, p.y + 0.5, p.z, rand(-1, 1) * 9 * scale, rand(0.2, 1.5) * 8 * scale, rand(-1, 1) * 9 * scale, rand(0.3, 0.8), rand(0.12, 0.3), 1, rand(0.4, 0.8), 0.15, 1, 14);
    for (let i = 0; i < 18 * scale; i++) this.smoke(_v.set(p.x + rand(-1, 1) * scale, p.y + rand(0.5, 2) * scale, p.z + rand(-1, 1) * scale), rand(0.8, 1.6) * scale, [0.18, 0.16, 0.15]);
    const L = this.lights.reduce((a, b) => (a.t < b.t ? a : b));
    L.l.position.set(p.x, p.y + 2, p.z);
    L.t = 0.5;
    L.l.intensity = 40 * scale;
  }

  muzzle(p, color = 0xfff0a0) {
    const m = new THREE.Mesh(this.flashGeo, this.flashMat);
    m.position.copy(p);
    m.rotation.set(rand(0, 3), rand(0, 3), 0);
    m.scale.setScalar(rand(0.8, 1.4));
    this.scene.add(m);
    this.flashes.push({ m, t: 0.05 });
    this.glow.spawn(p.x, p.y, p.z, 0, 0.5, 0, 0.07, 0.3, 1, 0.9, 0.5, 0.8, 0);
  }

  tracer(a, b, color = 0xfff2a0) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const mat = this.tracerMat.clone();
    mat.color.setHex(color);
    const line = new THREE.Line(g, mat);
    this.scene.add(line);
    this.tracers.push({ line, t: 0.07 });
  }

  /** Fling a mesh as debris. Mesh must already be in world space (use scene.attach). */
  fling(obj, vel, ang, { life = 6, bounce = 0.35, ground = null, spin = 1 } = {}) {
    if (obj.parent !== this.scene) this.scene.attach(obj);
    this.debris.push({ obj, vel: vel.clone(), ang: ang.clone().multiplyScalar(spin), life, bounce, ground });
  }

  update(dt) {
    this.soft.update(dt);
    this.glow.update(dt);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vel.y -= 22 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      d.obj.rotation.x += d.ang.x * dt;
      d.obj.rotation.y += d.ang.y * dt;
      d.obj.rotation.z += d.ang.z * dt;
      const gy = d.ground ? d.ground(d.obj.position) : this.groundY(d.obj.position);
      if (d.obj.position.y < gy + 0.1) {
        d.obj.position.y = gy + 0.1;
        if (d.vel.y < 0) d.vel.y *= -d.bounce;
        d.vel.x *= 0.7; d.vel.z *= 0.7; d.ang.multiplyScalar(0.7);
      }
      if (d.life < 1) d.obj.visible = Math.floor(d.life * 12) % 2 === 0;
      if (d.life <= 0) { d.obj.removeFromParent(); this.debris.splice(i, 1); }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.t += dt;
      const k = b.t / b.life;
      b.m.scale.setScalar(b.s0 + (b.s1 - b.s0) * Math.sqrt(Math.min(1, k)));
      b.m.material.opacity = 0.95 * (1 - k);
      b.m.position.y += dt * 1.5;
      if (k >= 1) { b.m.removeFromParent(); b.m.material.dispose(); this.balls.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= dt;
      if (f.t <= 0) { f.m.removeFromParent(); this.flashes.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t -= dt;
      t.line.material.opacity = Math.max(0, t.t / 0.07);
      if (t.t <= 0) { t.line.removeFromParent(); t.line.geometry.dispose(); t.line.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (const L of this.lights) {
      if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, L.l.intensity * Math.pow(0.002, dt)); if (L.t <= 0) L.l.intensity = 0; }
    }
  }
}
