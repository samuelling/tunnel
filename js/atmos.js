// The hall. The plant used to stand in a dark void; this gives it a place to be: floodlights with
// shafts of light through the haze, dust drifting in them, a painted and puddled floor, a ribbed
// wall with a stencilled name, warning lights, and a yard of stacked shipping containers waiting
// their turn. Everything here is scenery (no physics), sized in real metres so it sells the scale.
import * as THREE from 'three';
import { TUN0, PORTAL0, S } from './config.js';

function tex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const SHAFT_VS = `varying vec3 vN; varying vec3 vV; varying float vH;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }`;
const SHAFT_FS = `uniform vec3 uCol; uniform float uK, uTime, uSeed; varying vec3 vN; varying vec3 vV; varying float vH;
void main(){
  float f = abs(dot(normalize(vN), normalize(vV)));          // brightest looking through the middle of the cone
  float a = pow(f, 2.2) * smoothstep(0.0, 0.25, vH) * (0.25 + 0.75 * vH);   // fades toward the floor
  a *= 0.85 + 0.15 * sin(uTime * 0.7 + uSeed + vH * 5.0);
  gl_FragColor = vec4(uCol * a * uK, 1.0);
}`;

export function buildAtmosphere(scene, { low = false } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const HALL_R = 52 * S, HALL_H = 36 * S, LAMP_R = 18 * S, LAMP_Y = 30 * S;
  const tick = [];

  // ---- floodlights: a bright fixture (it blooms) and a shaft of light through the haze
  const fixMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(5) });
  const hoodMat = new THREE.MeshStandardMaterial({ color: '#15171b', metalness: 0.6, roughness: 0.5 });
  const shaftGeo = new THREE.CylinderGeometry(1.2, 9 * S, LAMP_Y, 28, 1, true);
  const shafts = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * LAMP_R, z = Math.sin(a) * LAMP_R;
    const fix = new THREE.Mesh(new THREE.BoxGeometry(2.4 * S, 0.1 * S, 0.9 * S), fixMat); fix.position.set(x, LAMP_Y - 0.12 * S, z); fix.rotation.y = -a; g.add(fix);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.7 * S, 0.3 * S, 1.2 * S), hoodMat); hood.position.set(x, LAMP_Y + 0.1 * S, z); hood.rotation.y = -a; g.add(hood);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, HALL_H - LAMP_Y, 6), hoodMat); rod.position.set(x, (HALL_H + LAMP_Y) / 2, z); g.add(rod);
    if (low && i % 2) continue;   // phones get half the shafts
    const mat = new THREE.ShaderMaterial({ vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color('#f3ead8') }, uK: { value: 0.034 }, uTime: { value: 0 }, uSeed: { value: i * 1.7 } } });
    const sh = new THREE.Mesh(shaftGeo, mat); sh.position.set(x * 0.93, LAMP_Y / 2, z * 0.93); sh.renderOrder = 3; g.add(sh); shafts.push(mat);
  }
  tick.push((t) => { for (const m of shafts) m.uniforms.uTime.value = t; });

  // ---- dust in the air: slow motes, brighter where they catch the light
  const N = low ? 500 : 1400, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, r = 6 + Math.sqrt(Math.random()) * 30 * S; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 26 * S; pos[i * 3 + 2] = Math.sin(a) * r; seed[i] = Math.random() * 100; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uPx: { value: 900 } },
    vertexShader: `attribute float seed; uniform float uTime, uPx; varying float vA;
      void main(){ vec3 p = position; p.x += sin(uTime * 0.11 + seed) * 2.5; p.z += cos(uTime * 0.09 + seed * 1.3) * 2.5; p.y += sin(uTime * 0.07 + seed * 2.1) * 1.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.05 + 0.05 * fract(seed)) * uPx / -mv.z, 1.0, 5.0);
        vA = (0.25 + 0.75 * fract(seed * 7.3)) * smoothstep(240.0, 30.0, -mv.z) * smoothstep(1.5, 6.0, -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * vA * 0.5 * smoothstep(0.5, 0.1, r), 1.0); }` });
  const dust = new THREE.Points(dg, dustMat); dust.frustumCulled = false; dust.renderOrder = 4; g.add(dust);
  tick.push((t) => { dustMat.uniforms.uTime.value = t; });

  // ---- floor paint: a hatched keep-out zone round the plant, a truck lane, stencils
  const paint = tex(2048, 2048, (c, W, H) => {
    const m = W / (64 * S);                       // px per metre: the decal covers 64·S m
    const cx = W / 2, cy = H / 2, R1 = (PORTAL0.R + 2.4) * S * m, R2 = R1 + 2.2 * m;
    c.clearRect(0, 0, W, H);
    // hatched ring
    c.save(); c.beginPath(); c.arc(cx, cy, R2, 0, 7); c.arc(cx, cy, R1, 0, 7, true); c.clip();
    c.fillStyle = 'rgba(242,179,17,0.9)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(20,20,22,0.92)'; c.lineWidth = 1.1 * m;
    for (let i = -H; i < W + H; i += 2.6 * m) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); }
    c.restore();
    // truck lane coming in from +x, with centre dashes and a stop bar
    const lw = 9 * m, y0 = cy + R2 + 6 * m;
    c.strokeStyle = 'rgba(235,235,225,0.75)'; c.lineWidth = 0.25 * m;
    for (const y of [y0, y0 + lw]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.setLineDash([4 * m, 5 * m]); c.strokeStyle = 'rgba(242,179,17,0.8)'; c.beginPath(); c.moveTo(0, y0 + lw / 2); c.lineTo(W, y0 + lw / 2); c.stroke(); c.setLineDash([]);
    // stencils
    c.fillStyle = 'rgba(235,235,225,0.7)'; c.textAlign = 'center'; c.font = `900 ${3.2 * m}px Impact, "Arial Black", sans-serif`;
    c.fillText('DROP ZONE  ·  HARD HATS  ·  NO LOITERING', cx, y0 - 1.6 * m);
    c.font = `900 ${5 * m}px Impact, "Arial Black", sans-serif`; c.fillStyle = 'rgba(242,179,17,0.75)';
    for (const x of [cx - 52 * m, cx + 52 * m]) c.fillText('➜  INTAKE QUEUE', x, y0 + lw / 2 + 1.8 * m);
    // wear: scuffs and tyre marks over everything
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.5})`; const x = Math.random() * W, y = Math.random() * H; c.fillRect(x, y, 1 + Math.random() * 14, 1 + Math.random() * 3); }
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(12,12,12,0.35)'; c.lineWidth = 0.5 * m;
    for (let k = 0; k < 7; k++) { const yy = y0 + lw * (0.2 + 0.6 * Math.random()); c.beginPath(); c.moveTo(Math.random() * W * 0.3, yy); c.bezierCurveTo(W * 0.4, yy + (Math.random() - 0.5) * 6 * m, W * 0.6, yy + (Math.random() - 0.5) * 6 * m, W, yy + (Math.random() - 0.5) * 3 * m); c.stroke(); }
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(64 * S, 64 * S), new THREE.MeshStandardMaterial({ map: paint, transparent: true, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  decal.rotation.x = -Math.PI / 2; decal.position.y = 0.008; decal.receiveShadow = true; decal.renderOrder = 1; g.add(decal);

  // ---- puddles: dark, glossy patches that pick up the lights
  const pudGeo = new THREE.CircleGeometry(1, 28), pudMat = new THREE.MeshStandardMaterial({ color: '#0c0e12', roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, envMapIntensity: 3 });
  const nP = low ? 10 : 22, puddles = new THREE.InstancedMesh(pudGeo, pudMat, nP), M = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), E = new THREE.Euler();
  for (let i = 0; i < nP; i++) {
    const a = Math.random() * 6.283, r = (PORTAL0.R + 5) * S + Math.random() * 26 * S;
    M.compose(new THREE.Vector3(Math.cos(a) * r, 0.011, Math.sin(a) * r), Q.clone().multiply(new THREE.Quaternion().setFromEuler(E.set(0, 0, Math.random() * 3))), new THREE.Vector3(1.5 + Math.random() * 5, 1 + Math.random() * 2.5, 1));
    puddles.setMatrixAt(i, M);
  }
  puddles.renderOrder = 1; g.add(puddles);

  // ---- the wall: ribbed cladding, a hazard band, the name in letters four storeys high
  const wallTex = tex(4096, 1024, (c, W, H) => {
    const grd = c.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#0b0d11'); grd.addColorStop(0.55, '#1b1f26'); grd.addColorStop(1, '#22262d');
    c.fillStyle = grd; c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x, 0, 3, H); c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(x + 3, 0, 2, H); }
    for (let x = 0; x < W; x += 256) { c.fillStyle = '#2c3138'; c.fillRect(x, 0, 14, H); }   // columns
    // rust and streaks
    for (let i = 0; i < 500; i++) { const x = Math.random() * W, y = Math.random() * H * 0.9, h = 30 + Math.random() * 200; const g2 = c.createLinearGradient(0, y, 0, y + h); g2.addColorStop(0, `rgba(120,62,28,${0.05 + Math.random() * 0.12})`); g2.addColorStop(1, 'rgba(120,62,28,0)'); c.fillStyle = g2; c.fillRect(x, y, 2 + Math.random() * 7, h); }
    // hazard band near the floor
    const by = H * 0.9; c.fillStyle = '#16161a'; c.fillRect(0, by, W, H * 0.06);
    c.save(); c.beginPath(); c.rect(0, by, W, H * 0.06); c.clip(); c.fillStyle = 'rgba(242,179,17,0.85)';
    for (let x = -100; x < W + 100; x += 120) { c.beginPath(); c.moveTo(x, by); c.lineTo(x + 60, by); c.lineTo(x + 60 + H * 0.06, by + H * 0.06); c.lineTo(x + H * 0.06, by + H * 0.06); c.fill(); }
    c.restore();
    // the name, twice round
    c.textAlign = 'center'; c.font = '900 210px Impact, "Arial Black", sans-serif';
    for (const x of [W * 0.25, W * 0.75]) {
      c.fillStyle = 'rgba(232,226,210,0.3)'; c.fillText('THE SHRED HOLE', x, H * 0.62);
      c.font = '900 64px Impact, "Arial Black", sans-serif'; c.fillStyle = 'rgba(242,179,17,0.4)'; c.fillText('UNIT 1  ·  EVERYTHING MUST GO  ·  megaZINE INDUSTRIES', x, H * 0.72);
      c.font = '900 210px Impact, "Arial Black", sans-serif';
    }
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; c.fillRect(Math.random() * W, H * (0.4 + Math.random() * 0.35), 2 + Math.random() * 10, 2 + Math.random() * 5); }
  });
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.x = -1;   // seen from inside: flip so the lettering reads
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(HALL_R, HALL_R, HALL_H, 72, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, metalness: 0.2, side: THREE.BackSide }));
  wall.position.y = HALL_H / 2; g.add(wall);
  const roof = new THREE.Mesh(new THREE.CircleGeometry(HALL_R, 48), new THREE.MeshStandardMaterial({ color: '#07080b', roughness: 1, side: THREE.DoubleSide }));
  roof.rotation.x = Math.PI / 2; roof.position.y = HALL_H; g.add(roof);
  // roof trusses, so the dark overhead has structure in it
  const trussMat = new THREE.MeshStandardMaterial({ color: '#1d2127', metalness: 0.7, roughness: 0.5 });
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(HALL_R * 2, 1.2, 0.5), trussMat); b.rotation.y = i / 6 * Math.PI; b.position.y = HALL_H - 2.2; g.add(b); }

  // warning lights round the wall: slow red blink, out of step
  const nW = 16, warn = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), nW), wc = new THREE.Color();
  for (let i = 0; i < nW; i++) { const a = i / nW * Math.PI * 2; M.makeTranslation(Math.cos(a) * (HALL_R - 0.8), HALL_H * 0.82, Math.sin(a) * (HALL_R - 0.8)); warn.setMatrixAt(i, M); }
  g.add(warn);
  tick.push((t) => { for (let i = 0; i < nW; i++) { const k = Math.pow(Math.max(0, Math.sin(t * 1.3 + i * 0.9)), 6); warn.setColorAt(i, wc.setRGB(0.25 + 5 * k, 0.02 + 0.2 * k, 0.02)); } warn.instanceColor.needsUpdate = true; });

  // ---- the yard: stacks of shipping containers along the wall, waiting their turn
  const cTex = tex(256, 128, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 8) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x, 0, 3, H); } c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, W, 5); c.fillRect(0, H - 5, W, 5); });
  const cols = ['#b5462b', '#1e5aa8', '#2f7d4f', '#c9a227', '#7a2e2e', '#3c4a5c', '#d8d3c6', '#8a4b1f'];
  const stacks = [];
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    if (Math.abs(Math.sin(a - 0.6)) < 0.18) continue;                    // leave gaps
    const r = HALL_R - 6 - Math.random() * 14, n = 1 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) stacks.push({ a, r, y: 1.3 + j * 2.6, yaw: -a + Math.PI / 2 + (Math.random() - 0.5) * 0.1, c: cols[Math.floor(Math.random() * cols.length)] });
  }
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(12.2, 2.6, 2.44), new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.7, metalness: 0.35 }), stacks.length);
  stacks.forEach((s, i) => { M.compose(new THREE.Vector3(Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r), new THREE.Quaternion().setFromEuler(E.set(0, s.yaw, 0)), new THREE.Vector3(1, 1, 1)); boxes.setMatrixAt(i, M); boxes.setColorAt(i, wc.set(s.c)); });
  boxes.castShadow = !low; boxes.receiveShadow = true; g.add(boxes);

  return { group: g, tick(t) { for (const f of tick) f(t); } };
}
