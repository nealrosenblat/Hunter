import * as THREE from 'three';
import { pick, rand } from './util.js';

// Tiny procedural textures, filtered bilinearly for that soft N64 look.
const cache = new Map();

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function finish(c, { clamp = false, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.userData.keep = true;
  return t;
}
function speckle(x, w, h, amt = 0.5, dark = 0.18, light = 0.12) {
  for (let i = 0; i < w * h * amt; i++) {
    const px = Math.random() * w | 0, py = Math.random() * h | 0;
    x.fillStyle = Math.random() < 0.55 ? `rgba(0,0,0,${Math.random() * dark})` : `rgba(255,255,255,${Math.random() * light})`;
    x.fillRect(px, py, 1, 1);
  }
}

const GEN = {
  concrete() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#8f8b84'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.7);
    for (let i = 0; i < 5; i++) {
      x.fillStyle = `rgba(70,55,40,${rand(0.05, 0.14)})`;
      x.beginPath(); x.ellipse(rand(0, 64), rand(0, 64), rand(4, 14), rand(3, 10), 0, 0, 7); x.fill();
    }
    x.fillStyle = '#5e5a54'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
    return finish(c);
  },
  concreteDark() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#5d5b57'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.8, 0.2, 0.08);
    for (let i = 0; i < 4; i++) {
      x.fillStyle = `rgba(20,15,10,${rand(0.08, 0.2)})`;
      x.beginPath(); x.ellipse(rand(0, 64), rand(0, 64), rand(5, 16), rand(3, 9), rand(0, 3), 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
    return finish(c);
  },
  water() {
    const [c, x] = cv(32, 64);
    x.fillStyle = '#3b6563'; x.fillRect(0, 0, 32, 64);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(150,210,200,${rand(0.1, 0.35)})`;
      x.fillRect(rand(0, 32) | 0, rand(0, 64) | 0, 1, rand(4, 14) | 0);
    }
    return finish(c);
  },
  dirt() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#8b7b55'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.9, 0.25, 0.1);
    for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(90,110,50,${rand(0.15, 0.35)})`; x.fillRect(rand(0, 64), rand(0, 64), rand(3, 9), rand(2, 5)); }
    return finish(c);
  },
  asphalt() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#3c3c40'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.9, 0.25, 0.1);
    return finish(c);
  },
  road() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#3c3c40'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.9, 0.25, 0.1);
    x.fillStyle = '#e8c33a'; x.fillRect(30, 0, 1.5, 64); x.fillRect(33, 0, 1.5, 64);
    x.fillStyle = '#ddd'; x.fillRect(3, 0, 1.2, 64); x.fillRect(60, 0, 1.2, 64);
    x.fillRect(16, 0, 1.2, 28); x.fillRect(47, 0, 1.2, 28);
    return finish(c);
  },
  sidewalk() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#b8b0a2'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.5, 0.12, 0.1);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 32, 64, 1); x.fillRect(0, 0, 1, 64);
    return finish(c);
  },
  brick() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#5a4a40'; x.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) {
      const ox = (r % 2) * 8;
      x.fillStyle = pick(['#8b3f2c', '#7c3626', '#94472f', '#6f3022', '#874232']);
      x.fillRect(k * 16 + ox + 1, r * 8 + 1, 14, 6);
    }
    speckle(x, 64, 64, 0.5, 0.2, 0.08);
    return finish(c);
  },
  panel() {
    const [c, x] = cv(64, 64);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = pick(['#7a4f2a', '#6e4524', '#83552e', '#744a27']);
      x.fillRect(i * 8, 0, 8, 64);
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(i * 8, 0, 1, 64);
      for (let j = 0; j < 6; j++) { x.fillStyle = `rgba(40,20,5,${rand(0.1, 0.3)})`; x.fillRect(i * 8 + rand(1, 7), rand(0, 64), 1, rand(6, 20)); }
    }
    return finish(c);
  },
  carpet() {
    const [c, x] = cv(32, 32);
    x.fillStyle = '#9a5a26'; x.fillRect(0, 0, 32, 32);
    speckle(x, 32, 32, 1.2, 0.3, 0.12);
    return finish(c);
  },
  ceiling() {
    const [c, x] = cv(32, 32);
    x.fillStyle = '#d8d4c8'; x.fillRect(0, 0, 32, 32);
    speckle(x, 32, 32, 0.6, 0.12, 0.05);
    x.fillStyle = '#8f8a7e'; x.fillRect(0, 0, 32, 1); x.fillRect(0, 0, 1, 32);
    return finish(c);
  },
  wood() {
    const [c, x] = cv(64, 32);
    x.fillStyle = '#6b4022'; x.fillRect(0, 0, 64, 32);
    for (let i = 0; i < 24; i++) { x.fillStyle = `rgba(30,14,4,${rand(0.15, 0.4)})`; x.fillRect(0, rand(0, 32), 64, 1); }
    return finish(c);
  },
  crate() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#b88a4f'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(70,40,10,.5)'; x.fillRect(0, i * 16, 64, 1); }
    speckle(x, 64, 64, 0.4, 0.2, 0.1);
    x.strokeStyle = '#7a5a30'; x.lineWidth = 6; x.strokeRect(3, 3, 58, 58);
    x.lineWidth = 5; x.beginPath(); x.moveTo(5, 5); x.lineTo(59, 59); x.stroke();
    x.fillStyle = 'rgba(40,20,0,.75)'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center';
    x.fillText('DUKE', 32, 24); x.fillText('IMPORTS', 32, 46);
    return finish(c);
  },
  cardboard() {
    const [c, x] = cv(32, 32);
    x.fillStyle = '#c49a62'; x.fillRect(0, 0, 32, 32);
    speckle(x, 32, 32, 0.4, 0.15, 0.1);
    x.fillStyle = '#e0c98f'; x.fillRect(13, 0, 6, 32);
    x.fillStyle = 'rgba(60,30,0,.7)'; x.font = 'bold 6px sans-serif'; x.fillText('▲UP', 2, 28);
    return finish(c);
  },
  metal() {
    const [c, x] = cv(32, 32);
    x.fillStyle = '#6d7a86'; x.fillRect(0, 0, 32, 32);
    speckle(x, 32, 32, 0.6, 0.2, 0.15);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 32, 1);
    return finish(c);
  },
  barrel() {
    const [c, x] = cv(64, 32);
    x.fillStyle = '#b8261d'; x.fillRect(0, 0, 64, 32);
    speckle(x, 64, 32, 0.4, 0.25, 0.08);
    x.fillStyle = '#7c140e'; x.fillRect(0, 7, 64, 2); x.fillRect(0, 23, 64, 2);
    x.fillStyle = '#ffd23f'; x.fillRect(20, 11, 24, 10);
    x.fillStyle = '#000'; x.font = 'bold 6px sans-serif'; x.fillText('DANGER', 22, 19);
    return finish(c);
  },
  blinds() {
    const [c, x] = cv(64, 64);
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#ffcf7a'); g.addColorStop(0.6, '#ff9a5a'); g.addColorStop(1, '#e8607a');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 4) { x.fillStyle = 'rgba(120,80,40,.75)'; x.fillRect(0, y, 64, 2); }
    x.fillStyle = 'rgba(60,40,20,.6)'; x.fillRect(31, 0, 2, 64);
    return finish(c);
  },
  windows() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#ddd'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.3, 0.12, 0.05);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      x.fillStyle = Math.random() < 0.25 ? '#ffe28a' : pick(['#2b3a55', '#34486a', '#243049']);
      x.fillRect(k * 16 + 3, r * 16 + 4, 10, 9);
    }
    return finish(c);
  },
  skyline() {
    const [c, x] = cv(512, 128);
    let px = 0;
    while (px < 512) {
      const w = rand(14, 40), h = rand(18, 100);
      x.fillStyle = pick(['#2a1d3d', '#241a36', '#31223f']);
      x.fillRect(px, 128 - h, w, h);
      for (let wy = 128 - h + 4; wy < 124; wy += 6) for (let wx = px + 3; wx < px + w - 3; wx += 5) {
        if (Math.random() < 0.18) { x.fillStyle = 'rgba(255,220,130,.9)'; x.fillRect(wx, wy, 2, 2); }
      }
      if (Math.random() < 0.1) { x.fillStyle = '#2a1d3d'; x.fillRect(px + w / 2 - 1, 128 - h - 14, 2, 14); }
      px += w + rand(-4, 3);
    }
    return finish(c);
  },
  fence() {
    const [c, x] = cv(32, 32);
    x.strokeStyle = 'rgba(200,200,200,.95)'; x.lineWidth = 1.4;
    for (let i = -32; i < 64; i += 8) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 32); x.stroke();
      x.beginPath(); x.moveTo(i + 32, 0); x.lineTo(i, 32); x.stroke();
    }
    x.fillStyle = '#999'; x.fillRect(0, 0, 32, 2);
    return finish(c);
  },
  palmLeaf() {
    const [c, x] = cv(64, 16);
    x.strokeStyle = '#3f6a26'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, 8); x.lineTo(64, 8); x.stroke();
    for (let i = 2; i < 62; i += 3) {
      const len = 7 * Math.sin((i / 64) * Math.PI) + 1;
      x.strokeStyle = pick(['#3d6b2a', '#56892f', '#4a7a2c']);
      x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(i, 8); x.lineTo(i + 3, 8 - len); x.stroke();
      x.beginPath(); x.moveTo(i, 8); x.lineTo(i + 3, 8 + len); x.stroke();
    }
    return finish(c, { clamp: true });
  },
  trunk() {
    const [c, x] = cv(16, 32);
    x.fillStyle = '#7a5a3a'; x.fillRect(0, 0, 16, 32);
    for (let y = 0; y < 32; y += 4) { x.fillStyle = 'rgba(40,25,10,.5)'; x.fillRect(0, y, 16, 1); }
    speckle(x, 16, 32, 0.4);
    return finish(c);
  },
  graffiti() {
    const [c, x] = cv(128, 64);
    const words = ['DUKE RULES', 'LA RIVER', 'TAGGZ', 'K-RAD', 'NO FEAR', 'DISCO LIVES', "'86", 'REX ♥ DD?', 'BROUGHAM SUX', 'RADICAL', 'WAVE', 'X-TRA'];
    x.font = 'bold 26px Impact, "Arial Black", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 5; x.strokeStyle = '#111';
    const w = pick(words);
    x.save(); x.translate(64, 32); x.rotate(rand(-0.15, 0.15));
    x.strokeText(w, 0, 0, 120);
    x.fillStyle = pick(['#ff3fa4', '#3ef2ff', '#ffd23f', '#7dff6a', '#ff7a2a', '#b07aff']);
    x.fillText(w, 0, 0, 120);
    x.restore();
    return finish(c, { clamp: true });
  },
  door() {
    const [c, x] = cv(32, 64);
    x.fillStyle = '#5b6b5e'; x.fillRect(0, 0, 32, 64);
    speckle(x, 32, 64, 0.5, 0.2, 0.08);
    x.fillStyle = '#2b3a40'; x.fillRect(9, 8, 14, 10);
    x.fillStyle = '#c9b23a'; x.fillRect(4, 30, 24, 7);
    x.fillStyle = '#000'; x.font = 'bold 5px sans-serif'; x.fillText('KEEP OUT', 5, 35.5);
    x.fillStyle = '#bbb'; x.fillRect(25, 38, 4, 2);
    x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeRect(0.5, 0.5, 31, 63);
    return finish(c);
  },
  rollup() {
    const [c, x] = cv(32, 32);
    x.fillStyle = '#8a8f93'; x.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 4) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, y, 32, 1); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(0, y + 1, 32, 1); }
    return finish(c);
  },
  shadow() {
    const [c, x] = cv(64, 64);
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return finish(c, { clamp: true });
  },
  denim() {
    const [c, x] = cv(32, 32);
    x.fillStyle = '#3a5a8a'; x.fillRect(0, 0, 32, 32);
    for (let i = -32; i < 32; i += 2) { x.strokeStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 32); x.stroke(); }
    speckle(x, 32, 32, 0.4);
    return finish(c);
  },
  neon() {
    const [c, x] = cv(256, 64);
    x.fillStyle = '#0b0614'; x.fillRect(0, 0, 256, 64);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'italic bold 34px "Brush Script MT", cursive';
    x.shadowColor = '#ff3fa4'; x.shadowBlur = 10; x.fillStyle = '#ffc6e6';
    x.fillText("The Duke's", 128, 22);
    x.font = 'bold 16px sans-serif'; x.shadowColor = '#3ef2ff'; x.fillStyle = '#cffcff';
    x.fillText('DISCO  •  DENIM  •  DELUXE', 128, 50);
    return finish(c, { clamp: true });
  },
  poster() {
    const [c, x] = cv(32, 48);
    x.fillStyle = '#ff3fa4'; x.fillRect(0, 0, 32, 48);
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(16, 18, 10, 0, 7); x.fill();
    x.fillStyle = '#000'; x.font = 'bold 6px sans-serif'; x.textAlign = 'center';
    x.fillText('DUKE', 16, 38); x.fillText('JEANS', 16, 45);
    return finish(c, { clamp: true });
  },
  // Episode 2: aerobics studio
  mirror() {
    const [c, x] = cv(64, 64);
    const gr = x.createLinearGradient(0, 0, 64, 64);
    gr.addColorStop(0, '#9fb4c8'); gr.addColorStop(0.5, '#c9d8e6'); gr.addColorStop(1, '#8aa0b6');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,.35)';
    for (const o of [10, 22, 44]) { x.beginPath(); x.moveTo(o, 64); x.lineTo(o + 10, 64); x.lineTo(o + 34, 0); x.lineTo(o + 24, 0); x.fill(); }
    x.fillStyle = '#5a6a7a'; x.fillRect(0, 0, 1, 64);
    return finish(c);
  },
  studioFloor() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#b8824a'; x.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 8; r++) {
      x.fillStyle = `rgba(90,50,20,${rand(0.05, 0.2)})`; x.fillRect(0, r * 8, 64, 8);
      x.fillStyle = 'rgba(60,30,10,.5)'; x.fillRect(0, r * 8, 64, 1);
      x.fillRect(((r * 23) % 64), r * 8, 1, 8);
    }
    for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(255,240,210,.12)'; x.fillRect(rand(0, 64) | 0, rand(0, 64) | 0, rand(4, 12) | 0, 1); }
    return finish(c);
  },
  frame() {
    const [c, x] = cv(32, 24);
    x.fillStyle = '#c9a24a'; x.fillRect(0, 0, 32, 24);
    x.fillStyle = '#5a7ab0'; x.fillRect(3, 3, 26, 18);
    x.fillStyle = '#e8d0a0'; x.fillRect(9, 8, 6, 9); x.fillRect(17, 9, 6, 8);
    return finish(c, { clamp: true });
  },
  wantedBoard() {
    const [c, x] = cv(64, 32);
    x.fillStyle = '#b48a55'; x.fillRect(0, 0, 64, 32);
    speckle(x, 64, 32, 0.6);
    for (let i = 0; i < 6; i++) { x.fillStyle = pick(['#eee', '#ffe9a8', '#f5d0d0']); x.fillRect(rand(2, 50), rand(2, 20), 11, 9); }
    x.strokeStyle = '#c11'; x.beginPath(); x.moveTo(10, 8); x.lineTo(40, 20); x.lineTo(55, 6); x.stroke();
    return finish(c, { clamp: true });
  },
  // ---- Episode 2: the Vigor Body Temple
  rubberFloor() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#26262c'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 380; i++) { x.fillStyle = pick(['rgba(255,63,164,.28)', 'rgba(62,242,255,.24)', 'rgba(255,255,255,.12)', 'rgba(0,0,0,.35)']); x.fillRect(Math.random() * 64 | 0, Math.random() * 64 | 0, 1, 1); }
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
    return finish(c);
  },
  lobbyTile() {
    const [c, x] = cv(64, 64);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#f2eee6' : '#e85aa8'; x.fillRect(i * 32, j * 32, 32, 32); }
    speckle(x, 64, 64, 0.25, 0.1, 0.1);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64); x.fillRect(0, 32, 64, 1); x.fillRect(32, 0, 1, 64);
    return finish(c);
  },
  gymWall() {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#efe9e2'; x.fillRect(0, 0, 64, 64);
    speckle(x, 64, 64, 0.2, 0.06, 0.06);
    x.fillStyle = '#14b8b0'; x.fillRect(0, 34, 64, 6);
    x.fillStyle = '#ff3fa4'; x.fillRect(0, 42, 64, 4);
    x.fillStyle = '#6b2fa3'; x.fillRect(0, 48, 64, 2);
    x.fillStyle = '#d6cfc6'; x.fillRect(0, 56, 64, 8);
    return finish(c);
  },
  mirror() {
    const [c, x] = cv(64, 64);
    const g = x.createLinearGradient(0, 0, 64, 64);
    g.addColorStop(0, '#b8d8ec'); g.addColorStop(0.5, '#6a8aa8'); g.addColorStop(1, '#9ec2da');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3;
    for (const o of [10, 30, 44]) { x.beginPath(); x.moveTo(o, 64); x.lineTo(o + 20, 0); x.stroke(); }
    x.fillStyle = '#c0c4c8'; x.fillRect(0, 0, 64, 2); x.fillRect(0, 62, 64, 2);
    return finish(c);
  },
  gymPoster() {
    const [c, x] = cv(48, 64);
    x.fillStyle = '#1a1030'; x.fillRect(0, 0, 48, 64);
    x.fillStyle = '#ff3fa4'; x.fillRect(0, 0, 48, 14);
    x.fillStyle = '#fff'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center';
    x.fillText('VIGOR', 24, 11);
    x.fillStyle = '#d08a5a'; x.fillRect(16, 18, 16, 20); x.fillRect(10, 22, 6, 12); x.fillRect(32, 22, 6, 12);
    x.fillStyle = '#e8c860'; x.fillRect(16, 16, 16, 5);
    x.fillStyle = '#3ef2ff'; x.font = 'bold 6px sans-serif';
    x.fillText('LIFETIME', 24, 46); x.fillText('MEMBERSHIP', 24, 53);
    x.fillStyle = '#ffd23f'; x.font = 'bold 8px sans-serif'; x.fillText('$9,999', 24, 62);
    return finish(c, { clamp: true });
  },
  cash() {
    const [c, x] = cv(32, 16);
    x.fillStyle = '#6aa86a'; x.fillRect(0, 0, 32, 16);
    x.fillStyle = '#2f5a2f'; x.fillRect(2, 2, 28, 12);
    x.fillStyle = '#9ad49a'; x.fillRect(4, 4, 24, 8);
    x.fillStyle = '#2f5a2f'; x.font = 'bold 8px sans-serif'; x.textAlign = 'center'; x.fillText('100', 16, 11);
    x.fillStyle = '#e8e2c8'; x.fillRect(14, 0, 4, 16);
    return finish(c, { clamp: true });
  },
};

export function tex(name) {
  if (!cache.has(name)) cache.set(name, GEN[name]());
  return cache.get(name);
}
/** A repeated copy of a cached texture (shares the image). */
export function texR(name, rx, ry) {
  const t = tex(name).clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  t.userData.keep = false;
  return t;
}
/** Fresh, uncached variant (e.g. each graffiti tag). */
export function texFresh(name) {
  const t = GEN[name]();
  t.userData.keep = false;
  return t;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export function faceTex(spec) {
  const key = 'face:' + JSON.stringify(spec);
  if (cache.has(key)) return cache.get(key);
  const [c, x] = cv(64, 64);
  const skin = hex(spec.skin), hair = hex(spec.hair ?? 0x222222);
  x.fillStyle = skin; x.fillRect(0, 0, 64, 64);
  // cheek shading
  x.fillStyle = 'rgba(120,50,30,.12)'; x.fillRect(0, 34, 8, 30); x.fillRect(56, 34, 8, 30);
  if (spec.hairline !== false) { x.fillStyle = hair; x.fillRect(0, 0, 64, spec.hairline ?? 9); }
  if (spec.stubble) {
    for (let i = 0; i < 320; i++) { x.fillStyle = 'rgba(40,25,15,.35)'; x.fillRect(rand(6, 58), rand(40, 64), 1, 1); }
  }
  if (spec.blush) { x.fillStyle = 'rgba(255,90,120,.28)'; x.fillRect(8, 36, 12, 6); x.fillRect(44, 36, 12, 6); }
  // eyes
  if (spec.shades) {
    x.fillStyle = '#0c0c10'; x.fillRect(9, 23, 46, 9); x.fillRect(28, 23, 8, 3);
    x.fillStyle = 'rgba(160,200,255,.6)'; x.fillRect(13, 24, 6, 2); x.fillRect(41, 24, 6, 2);
  } else {
    for (const ex of [14, 38]) {
      x.fillStyle = '#fff'; x.fillRect(ex, 25, 12, 7);
      x.fillStyle = spec.eye || '#3a2a1a'; x.fillRect(ex + 4, 25, 5, 7);
      x.fillStyle = '#000'; x.fillRect(ex + 5, 27, 3, 3);
      if (spec.lashes) { x.fillStyle = '#111'; x.fillRect(ex - 1, 23, 14, 2); x.fillRect(ex - 2, 22, 2, 2); x.fillRect(ex + 12, 22, 2, 2); }
      if (spec.shadowLid) { x.fillStyle = 'rgba(80,140,220,.55)'; x.fillRect(ex, 21, 12, 3); }
    }
  }
  // brows
  x.fillStyle = hair;
  const bt = spec.brow === 'heavy' ? 4 : 2;
  if (spec.brow === 'angry') {
    x.fillRect(13, 19, 13, 3); x.fillRect(38, 19, 13, 3);
    x.fillRect(22, 21, 5, 2); x.fillRect(37, 21, 5, 2);
  } else if (!spec.shades) {
    x.fillRect(13, 20 - bt + 2, 14, bt); x.fillRect(37, 20 - bt + 2, 14, bt);
  }
  // nose
  x.fillStyle = 'rgba(110,50,30,.35)'; x.fillRect(31, 30, 3, 10); x.fillRect(28, 39, 9, 2);
  // mustache
  if (spec.mustache === true) { x.fillStyle = hair; x.fillRect(20, 42, 24, 5); x.fillRect(18, 45, 4, 4); x.fillRect(42, 45, 4, 4); }
  if (spec.mustache === 'thin') { x.fillStyle = hair; x.fillRect(23, 43, 18, 2); }
  // mouth
  const lip = spec.lipstick ? '#c8203f' : '#7a3326';
  x.fillStyle = lip;
  switch (spec.mouth) {
    case 'smirk': x.fillRect(24, 50, 16, 2); x.fillRect(38, 48, 4, 2); break;
    case 'frown': x.fillRect(24, 50, 16, 2); x.fillRect(22, 52, 3, 2); x.fillRect(39, 52, 3, 2); break;
    case 'grin': x.fillRect(22, 48, 20, 6); x.fillStyle = '#fff'; x.fillRect(24, 49, 16, 3); break;
    case 'smile': x.fillRect(24, 50, 16, 2); x.fillRect(22, 48, 3, 2); x.fillRect(39, 48, 3, 2); break;
    default: x.fillRect(25, 50, 14, spec.lipstick ? 3 : 2);
  }
  if (spec.scar) { x.fillStyle = 'rgba(150,60,60,.8)'; x.fillRect(46, 30, 2, 12); }
  const t = finish(c, { clamp: true });
  cache.set(key, t);
  return t;
}

/** Side texture for cars, laid out in profile coordinates (length L, height H). */
export function carSideTex(key, draw) {
  if (cache.has(key)) return cache.get(key);
  const [c, x] = cv(256, 64);
  draw(x, 256, 64);
  const t = finish(c, { clamp: true });
  cache.set(key, t);
  return t;
}
