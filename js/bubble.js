// The ship. The Shred Hole is a building on a slab of ground torn out of somewhere, hanging inside a
// bubble of air that is hurtling through space: the same kind of ship as the Garden of Delight
// (linglab.org/blackhole), and part of the same story. You see it when you zoom out, and the game
// opens out there.
//
// The look follows the garden's (its src/field.js): a soap-film skin that shows where it turns away
// from you, a nebula dead ahead, dust streaming back past the bubble, and under the slab an
// upside-down mountain of soil and rock narrowing to a keel.
import * as THREE from 'three';
import { S } from './config.js';

export const HALL = { R: 52 * S, H: 36 * S };                       // the building (the hall atmos.js fits out inside)
export const DOOR = { az: 0.61, half: 0.17, H: 42 };                // the hangar door: toward the opening camera
export const RIM = 232;                                             // where the slab ends
export const BUBBLE = { y: 20, R: 252 };
export const HEAD = new THREE.Vector3(-0.96, 0.14, 0.24).normalize();   // where we are heading: the nebula

const NOISE = /* glsl */`
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.0, 5.0); a *= 0.5; } return s; }`;
const VERT = /* glsl */`varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;

function tex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// a wall of the hall with the door cut out of it: the wall round the rest of the circle, and a lintel over the door
export function hallWall(R, H, mat, lintelMat = mat) {
  const g = new THREE.Group(), th = Math.PI / 2 - DOOR.az;   // CylinderGeometry measures its angle from +z toward +x
  const main = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96, 1, true, th + DOOR.half, Math.PI * 2 - 2 * DOOR.half), mat); main.position.y = H / 2; g.add(main);
  const lint = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H - DOOR.H, 8, 1, true, th - DOOR.half, 2 * DOOR.half), lintelMat); lint.position.y = DOOR.H + (H - DOOR.H) / 2; g.add(lint);
  return g;
}

export function buildBubble(scene, { low = false } = {}) {
  const g = new THREE.Group(); g.name = 'ship'; scene.add(g);
  const U = { uTime: { value: 0 }, uHead: { value: HEAD } };
  const C = new THREE.Vector3(0, BUBBLE.y, 0);

  // ---- space: a nebula ahead, wisps elsewhere, and stars (which bloom)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = normalize(position); gl_Position = (projectionMatrix * modelViewMatrix * vec4(position, 1.0)).xyww; }   // at the far plane: only where nothing else was drawn`,
    fragmentShader: /* glsl */`uniform vec3 uHead; uniform float uTime; varying vec3 vD;${NOISE}
float sfbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * (vn(p.xy + p.z * 1.7) * 0.5 + vn(p.yz * 1.13 + p.x * 2.3 + 7.0) * 0.5); p = p * 2.07 + vec3(11.0, 5.0, 3.0); a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vD); float ah = dot(d, uHead), core = smoothstep(0.35, 0.995, ah);
  float n1 = sfbm(d * 2.2 + vec3(0.0, 0.0, uTime * 0.002)), n2 = sfbm(d * 5.5 + 13.0), fil = pow(1.0 - abs(2.0 * n2 - 1.0), 3.0);
  vec3 neb = mix(vec3(0.20, 0.05, 0.12), vec3(1.0, 0.55, 0.16), smoothstep(0.3, 0.8, n1 * (0.55 + core))) * (0.05 + 0.95 * core * core) * smoothstep(0.25, 0.75, n1 + 0.5 * core);
  neb += vec3(1.0, 0.86, 0.6) * pow(max(ah, 0.0), 60.0) * 0.9 + vec3(1.0, 0.7, 0.3) * fil * core * 0.5;
  float w2 = smoothstep(0.52, 0.85, sfbm(d.zxy * 1.7 + 4.0)) * (1.0 - core);
  vec3 wisp = mix(vec3(0.04, 0.10, 0.16), vec3(0.11, 0.05, 0.17), n2) * w2;
  gl_FragColor = vec4(neb * 0.38 + wisp * 0.16 + vec3(0.004, 0.005, 0.009), 1.0);
}` }));
  sky.renderOrder = 2; sky.frustumCulled = false; g.add(sky);   // after the solid things, so hidden pixels cost nothing
  const NSt = low ? 1800 : 4200, sp = new Float32Array(NSt * 3), sc = new Float32Array(NSt * 3), ss = new Float32Array(NSt);
  let seed = 9173; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < NSt; i++) {
    const z = rnd() * 2 - 1, a = rnd() * 6.2832, r = Math.sqrt(1 - z * z); sp.set([r * Math.cos(a) * 5500, z * 5500, r * Math.sin(a) * 5500], i * 3);
    const m = Math.pow(rnd(), 7), t = rnd(), b = 0.5 + 5 * m;                       // a few bright ones, many faint
    sc.set([b * (0.75 + 0.25 * t), b * 0.85, b * (1.0 - 0.3 * t)], i * 3); ss[i] = 1.2 + 2.6 * m;
  }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sgeo.setAttribute('color', new THREE.BufferAttribute(sc, 3)); sgeo.setAttribute('size', new THREE.BufferAttribute(ss, 1));
  const stars = new THREE.Points(sgeo, new THREE.ShaderMaterial({ depthWrite: false, fog: false, transparent: true, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 } },
    vertexShader: `attribute float size; attribute vec3 color; uniform float uPx; varying vec3 vC; void main(){ vC = color; gl_PointSize = size * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC * smoothstep(0.5, 0.05, r), 1.0); }` }));
  stars.renderOrder = -9; stars.frustumCulled = false; g.add(stars);

  // ---- the skin, both faces: a soap film, bright where it turns away, drifting bands of colour, warm toward the nebula
  const skin = (side) => new THREE.ShaderMaterial({ side, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: U, vertexShader: VERT,
    fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uHead; varying vec3 vW; varying vec3 vN;${NOISE}
void main(){
  vec3 N = normalize(vN) * ${side === THREE.BackSide ? '-1.0' : '1.0'}, V = normalize(cameraPosition - vW); float nv = clamp(dot(N, V), 0.0, 1.0);
  vec3 q = vW * 0.009; float th = fbm(q.xz + q.y * 0.7 + vec2(uTime * 0.012, 0.0)) * 1.3 + fbm(q.zy * 2.1 - uTime * 0.02) * 0.5 + vW.y * 0.002;
  vec3 irid = 0.5 + 0.5 * cos(6.2832 * (th * 2.0 + vec3(0.0, 0.33, 0.67)));
  float hgt = clamp(abs(vW.y) / ${(BUBBLE.R).toFixed(1)}, 0.0, 1.0), low = exp(-hgt * 5.5), bands = 0.5 + 0.5 * sin(hgt * 90.0 + th * 9.0);   // the film drains: thick and banded low down
  vec3 c = irid * (pow(1.0 - nv, 3.0) * 0.5 + low * (0.045 + 0.07 * bands) + 0.016) * (0.5 + 0.5 * fbm(q.xy * 3.0 + uTime * 0.03));
  c += vec3(0.62, 0.8, 1.0) * pow(1.0 - nv, 5.0) * 0.8;
  c += vec3(1.0, 0.94, 0.82) * 2.5 * pow(max(dot(reflect(-normalize(vec3(0.24, 0.8, 0.37)), N), V), 0.0), 320.0);   // the floodlit yard's glint
  float lead = max(dot(normalize(vN), uHead), 0.0);
  c += vec3(1.0, 0.6, 0.24) * (pow(lead, 3.0) * 0.07 + pow(max(dot(reflect(-uHead, N), V), 0.0), 22.0) * 0.2);
  c += vec3(1.0, 0.78, 0.5) * pow(lead, 9.0) * 0.14 * (0.55 + 0.45 * fbm(q.xz * 7.0 + uTime * 1.6));   // dust burning off the leading face
  gl_FragColor = vec4(c * ${side === THREE.BackSide ? '0.45' : '1.0'}, 1.0);
}` });
  const sphere = new THREE.SphereGeometry(BUBBLE.R, low ? 64 : 128, low ? 40 : 80);
  for (const side of [THREE.BackSide, THREE.FrontSide]) { const m = new THREE.Mesh(sphere, skin(side)); m.position.copy(C); m.renderOrder = side === THREE.BackSide ? 7 : 8; m.frustumCulled = false; g.add(m); }

  // ---- dust the ship is flying through: streaks from dead ahead, parting round the bubble
  const NS = low ? 1200 : 3000, pos = new Float32Array(NS * 6), sd = new Float32Array(NS * 8), end = new Float32Array(NS * 2);
  for (let i = 0; i < NS; i++) { const v = [rnd(), rnd(), rnd(), rnd()]; for (let k = 0; k < 2; k++) { sd.set(v, (i * 2 + k) * 4); end[i * 2 + k] = k; } }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4)); dg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const streaks = new THREE.LineSegments(dg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { ...U, uC: { value: C }, uR: { value: BUBBLE.R } },
    vertexShader: /* glsl */`attribute vec4 aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uHead; uniform vec3 uC; uniform float uR; varying vec3 vCol;
void main(){
  const float B = 2600.0;
  vec3 ax = normalize(cross(uHead, vec3(0.0, 1.0, 0.0))), ay = cross(ax, uHead);
  float v = 160.0 + 420.0 * aSeed.w * aSeed.w, along = B * 0.5 - mod(aSeed.z * B + uTime * v, B);
  vec3 rel = ax * (aSeed.x - 0.5) * B + ay * (aSeed.y - 0.5) * B + uHead * (along + aEnd * v * 0.16);
  float rp = length(rel - uHead * dot(rel, uHead)), ah = dot(rel, uHead);
  float wake = ah < 0.0 ? mix(smoothstep(uR * 0.95, uR * 1.35, rp), 1.0, smoothstep(0.0, uR * 6.0, -ah)) : 1.0;
  float clear = smoothstep(uR * 1.02, uR * 1.3, length(rel)) * wake, fade = smoothstep(B * 0.5, B * 0.36, abs(along));
  vCol = mix(vec3(1.0, 0.72, 0.42), vec3(0.72, 0.84, 1.0), fract(aSeed.x * 91.7)) * (0.25 + 0.75 * fract(aSeed.y * 57.3)) * clamp(clear, 0.0, 1.0) * fade * (1.0 - 0.75 * aEnd) * 0.8;
  gl_Position = projectionMatrix * viewMatrix * vec4(uC + rel, 1.0);
}`, fragmentShader: `varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }` }));
  streaks.frustumCulled = false; streaks.renderOrder = 9; g.add(streaks);

  // ---- the slab's underside: soil at the torn edge, then bedded rock in ridges down to a keel
  {
    const NT = low ? 120 : 220, NF = 26, NR = NF + 1, P = new Float32Array(NT * NR * 3), D = new Float32Array(NT * NR), idx = [];
    const h3 = (i, j, k) => { let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
    const sm = (t) => t * t * (3 - 2 * t), L = (a, b, t) => a + (b - a) * t;
    const n3 = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = sm(x - i), v = sm(y - j), w = sm(z - k);
      return L(L(L(h3(i, j, k), h3(i + 1, j, k), u), L(h3(i, j + 1, k), h3(i + 1, j + 1, k), u), v), L(L(h3(i, j, k + 1), h3(i + 1, j, k + 1), u), L(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), u), v), w) * 2 - 1; };
    for (let t = 0; t < NT; t++) {
      const a = t / NT * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const depth = 150 + 30 * Math.sin(2 * a + 1.0) + 18 * Math.sin(5 * a + 0.4) + 10 * Math.sin(11 * a + 2.0);
      const fin = Math.pow(1 - Math.abs(Math.sin(2.5 * a + 0.6)), 2.2) + 0.6 * Math.pow(1 - Math.abs(Math.sin(5.5 * a + 2.2)), 3) + 0.35 * Math.pow(1 - Math.abs(Math.sin(12.5 * a + 0.9)), 4);
      for (let k = 0; k < NR; k++) {
        const f = k === 0 ? 0 : Math.max(0.008 * k, Math.pow(k / NF, 1.6)), s = f * (depth + (165 - depth) * f * f);
        let rho = 1 - Math.pow(f, 1.25) - 0.02 * Math.min(1, f * 40) * (1 - f);
        const ramp = Math.min(1, Math.max(0, (f - 0.04) / 0.36));
        rho = rho * (1 - 0.11 * ramp + 0.5 * fin * ramp) + 0.1 * fin * Math.min(1, Math.max(0, (f - 0.3) / 0.5)) * (1 - f);
        let r = Math.max(0, rho) * RIM; const y = -0.2 - s, cx = 26 * Math.pow(f, 1.5), cz = -18 * Math.pow(f, 1.5);
        const x0 = cx + ca * r, z0 = cz + sa * r;
        const lump = (n3(x0 * 0.02, y * 0.025, z0 * 0.02) * (6 + 22 * f) + n3(x0 * 0.055, y * 0.065, z0 * 0.055) * (2.4 + 6 * f) + n3(x0 * 0.16, y * 0.2, z0 * 0.16) * 1.6) * Math.pow(1 - f, 0.4) * Math.min(1, f * 33);
        r = Math.max(0, r + lump);
        const o = (t * NR + k) * 3; P[o] = cx + ca * r; P[o + 1] = y; P[o + 2] = cz + sa * r; D[t * NR + k] = s;
      }
    }
    for (let t = 0; t < NT; t++) for (let k = 0; k < NR - 1; k++) { const t1 = (t + 1) % NT, a = t * NR + k, b = t1 * NR + k; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('aDepth', new THREE.BufferAttribute(D, 1)); geo.setIndex(idx); geo.computeBoundingSphere();
    const land = new THREE.Mesh(geo, new THREE.ShaderMaterial({ side: THREE.DoubleSide, fog: false, uniforms: U,
      vertexShader: `attribute float aDepth; varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vDepth = aDepth; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`uniform vec3 uHead; varying vec3 vW; varying float vDepth;${NOISE}
void main(){
  vec3 V = normalize(cameraPosition - vW), N = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(N, V) < 0.0) N = -N;   // broken rock: each face its own plane
  float az = atan(vW.z, vW.x); vec2 p = vec2(az * 34.0, vW.y * 0.25); float n = fbm(p), n2 = fbm(p * 3.7 + 9.0);
  float d = max(vDepth, 0.0) + (n - 0.5) * 4.0 * smoothstep(0.6, 6.0, vDepth);
  vec3 slab = vec3(0.16, 0.16, 0.17), sub = vec3(0.14, 0.09, 0.048), rock = mix(vec3(0.11, 0.1, 0.095), vec3(0.2, 0.175, 0.15), n2);
  float beds = 0.5 + 0.5 * sin(vW.y * 0.85 + n * 5.0 + az * 3.0); rock *= 0.7 + 0.42 * smoothstep(0.35, 0.65, beds);
  rock *= 1.0 - 0.5 * smoothstep(0.62, 0.7, fbm(vec2(az * 9.0, vW.y * 0.045) + 3.0));
  vec3 col = mix(mix(slab, sub, smoothstep(1.2, 3.5, d)), rock, smoothstep(7.0, 18.0, d));   // a concrete slab, fill, then bedrock
  float key = max(dot(N, normalize(vec3(0.24, 0.8, 0.37))), 0.0), neb = max(dot(N, uHead), 0.0), up = 0.5 + 0.5 * N.y;
  vec3 lit = col * (vec3(0.34, 0.37, 0.5) * (0.55 + 0.45 * up) + vec3(1.0, 0.95, 0.86) * key * 0.9 + vec3(1.0, 0.55, 0.2) * neb * 1.3 + vec3(0.5, 0.3, 0.9) * 0.08) * 1.5;
  gl_FragColor = vec4(lit, 1.0);
}` }));
    g.add(land);
  }

  // ---- the yard: a kerb and lamps round the brink, a ring road, a pad where the junk barges set down
  const M = new THREE.Matrix4(), col = new THREE.Color();
  const kerb = new THREE.Mesh(new THREE.TorusGeometry(RIM - 1.2, 0.5, 6, 160), new THREE.MeshStandardMaterial({ color: '#8d8f94', roughness: 0.9 })); kerb.rotation.x = Math.PI / 2; kerb.position.y = 0.2; g.add(kerb);
  const nL = low ? 24 : 40, posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 12, 6), new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.6, roughness: 0.5 }), nL);
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b0').multiplyScalar(6) }), nL);
  for (let i = 0; i < nL; i++) { const a = i / nL * Math.PI * 2, x = Math.cos(a) * (RIM - 6), z = Math.sin(a) * (RIM - 6); M.makeTranslation(x, 6, z); posts.setMatrixAt(i, M); M.makeTranslation(x, 12.4, z); lamps.setMatrixAt(i, M); }
  g.add(posts, lamps);
  const paint = new THREE.MeshBasicMaterial({ color: '#c9a21a', fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const flat = (geo, y = 0.03) => { const m = new THREE.Mesh(geo, paint); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; };
  flat(new THREE.RingGeometry(HALL.R + 30, HALL.R + 30.6, 160)); flat(new THREE.RingGeometry(HALL.R + 42, HALL.R + 42.6, 160));
  const padR = HALL.R + 36, pa = DOOR.az + Math.PI, pad = flat(new THREE.RingGeometry(13, 14, 48)); pad.position.set(Math.cos(pa) * padR, 0.03, Math.sin(pa) * padR);
  const padIn = flat(new THREE.RingGeometry(0, 3, 24)); padIn.position.copy(pad.position);
  // the approach to the door: two lines of ground lights
  const nA = 14, appr = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7df9ff').multiplyScalar(5) }), nA * 2);
  const dx = Math.cos(DOOR.az), dz = Math.sin(DOOR.az);
  for (let i = 0; i < nA; i++) for (const s of [-1, 1]) { const r = HALL.R + 4 + i * 5; M.makeTranslation(dx * r - dz * s * 22, 0.4, dz * r + dx * s * 22); appr.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), M); }
  g.add(appr);

  // ---- the building from outside: ribbed steel, the name, window strips, a lit crown; the roof's ribs, stacks and an oculus
  const wallTex = tex(4096, 1024, (c, W, H) => {
    const grd = c.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#39424c'); grd.addColorStop(1, '#232a31'); c.fillStyle = grd; c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 14) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, 0, 3, H); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x + 3, 0, 2, H); }
    for (let x = 0; x < W; x += 256) { c.fillStyle = '#4a545f'; c.fillRect(x, 0, 16, H); }
    for (let i = 0; i < 600; i++) { const x = Math.random() * W, y = Math.random() * H * 0.9, h = 30 + Math.random() * 220; const g2 = c.createLinearGradient(0, y, 0, y + h); g2.addColorStop(0, `rgba(140,72,30,${0.06 + Math.random() * 0.14})`); g2.addColorStop(1, 'rgba(140,72,30,0)'); c.fillStyle = g2; c.fillRect(x, y, 2 + Math.random() * 8, h); }
    const by = H * 0.93; c.fillStyle = '#16161a'; c.fillRect(0, by, W, H * 0.07); c.save(); c.beginPath(); c.rect(0, by, W, H * 0.07); c.clip(); c.fillStyle = 'rgba(242,179,17,0.9)';
    for (let x = -100; x < W + 100; x += 120) { c.beginPath(); c.moveTo(x, by); c.lineTo(x + 60, by); c.lineTo(x + 60 + H * 0.07, by + H * 0.07); c.lineTo(x + H * 0.07, by + H * 0.07); c.fill(); } c.restore();
    c.textAlign = 'center';
    for (const x of [W * 0.27, W * 0.73]) {
      c.font = '900 250px Impact, "Arial Black", sans-serif'; c.fillStyle = 'rgba(245,200,40,0.95)'; c.fillText('SHRED HOLE', x, H * 0.55, 1500);
      c.font = '900 62px Impact, "Arial Black", sans-serif'; c.fillStyle = 'rgba(232,226,210,0.8)'; c.fillText('UNIT 1  ·  EVERYTHING MUST GO  ·  megaZINE INDUSTRIES', x, H * 0.66, 1500);
    }
  });
  const glowTex = tex(2048, 512, (c, W, H) => {   // what is lit: window strips, the crown, the lettering a little
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    for (let x = 12; x < W; x += 64) { if (Math.random() < 0.18) continue; c.fillStyle = Math.random() < 0.8 ? '#ffd9a0' : '#9fe8ff'; c.fillRect(x, H * 0.2, 34, 9); if (Math.random() < 0.6) c.fillRect(x, H * 0.78, 34, 7); }
    c.fillStyle = '#ff5a2a'; c.fillRect(0, 2, W, 5);
  });
  const extMat = new THREE.MeshStandardMaterial({ map: wallTex, emissiveMap: glowTex, emissive: '#ffffff', emissiveIntensity: 3.2, roughness: 0.7, metalness: 0.45, fog: false });
  const plain = new THREE.MeshStandardMaterial({ color: '#2b333b', roughness: 0.7, metalness: 0.45, fog: false });
  g.add(hallWall(HALL.R + 0.6, HALL.H, extMat, plain));
  // door frame: hazard-yellow jambs and a lit header
  const jamb = new THREE.MeshStandardMaterial({ color: '#e2a90f', roughness: 0.6, metalness: 0.3, fog: false });
  for (const s of [-1, 1]) { const a = DOOR.az + s * DOOR.half, j = new THREE.Mesh(new THREE.BoxGeometry(3, DOOR.H, 3), jamb); j.position.set(Math.cos(a) * (HALL.R + 0.3), DOOR.H / 2, Math.sin(a) * (HALL.R + 0.3)); j.rotation.y = -a; g.add(j); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 2 * HALL.R * Math.sin(DOOR.half)), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(4), fog: false }));
  head.position.set(dx * (HALL.R * Math.cos(DOOR.half) + 1.2), DOOR.H + 1, dz * (HALL.R * Math.cos(DOOR.half) + 1.2)); head.rotation.y = -DOOR.az; g.add(head);
  // roof
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2a3138', roughness: 0.8, metalness: 0.4, fog: false });
  const roof = new THREE.Mesh(new THREE.RingGeometry(24, HALL.R + 0.6, 96, 1), roofMat); roof.rotation.x = -Math.PI / 2; roof.position.y = HALL.H + 0.15; g.add(roof);
  const parapet = new THREE.Mesh(new THREE.TorusGeometry(HALL.R + 0.6, 1.1, 6, 120), roofMat); parapet.rotation.x = Math.PI / 2; parapet.position.y = HALL.H + 0.6; g.add(parapet);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rib = new THREE.Mesh(new THREE.BoxGeometry(HALL.R - 26, 1.4, 1.6), roofMat); rib.position.set(Math.cos(a) * (HALL.R + 26) / 2, HALL.H + 0.8, Math.sin(a) * (HALL.R + 26) / 2); rib.rotation.y = -a; g.add(rib); }
  // the oculus over the intake: a glazed eye, lit from below by the plant
  const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 1.6, 8, 64), jamb); ring.rotation.x = Math.PI / 2; ring.position.y = HALL.H + 1; g.add(ring);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(24, 48), new THREE.ShaderMaterial({ fog: false, uniforms: U, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ vec2 d = vUv - 0.5; float r = length(d) * 2.0, a = atan(d.y, d.x);
      float sw = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 1.4); vec3 c = mix(vec3(0.5, 0.2, 1.0), vec3(0.25, 0.85, 1.0), sw) * (0.6 + 1.8 * (1.0 - r)) * (0.55 + 0.45 * sw);
      gl_FragColor = vec4(c * 0.85, 1.0); }` }));
  eye.rotation.x = -Math.PI / 2; eye.position.y = HALL.H + 0.6; g.add(eye);
  // stacks with red beacons
  const stackMat = new THREE.MeshStandardMaterial({ color: '#3b434c', roughness: 0.6, metalness: 0.6, fog: false }), beacons = [];
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4, x = Math.cos(a) * (HALL.R - 22), z = Math.sin(a) * (HALL.R - 22);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 26, 16), stackMat); st.position.set(x, HALL.H + 13, z); g.add(st);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff2a1a', fog: false })); b.position.set(x, HALL.H + 27, z); g.add(b); beacons.push(b); }

  return {
    group: g, centre: C,
    // out: 0 inside the hall … 1 well outside it
    tick(t, camera, pxScale = 1) {
      U.uTime.value = t;
      sky.position.copy(camera.position); stars.position.copy(camera.position);
      stars.material.uniforms.uPx.value = pxScale;
      beacons.forEach((b, i) => { const k = Math.pow(Math.max(0, Math.sin(t * 1.6 + i * 1.57)), 8); b.material.color.setRGB(0.4 + 7 * k, 0.03 + 0.3 * k, 0.02); });
    },
  };
}
