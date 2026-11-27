// The crew are astronauts from the Garden of Delight (linglab.org/blackhole): the same hard-shell suits, the garden's own and two
// made from NASA's models, here on shift at the Shred Hole with hi-vis vests over them. Each suit is a model of fifteen rigid shells
// named for their parts, each with its origin at its joint (the garden's tools/blender/build_astronaut.py), hung on a tree of groups.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const PARENT = { pelvis: null, torso: 'pelvis', head: 'torso', armU_L: 'torso', armL_L: 'armU_L', hand_L: 'armL_L', armU_R: 'torso', armL_R: 'armU_R', hand_R: 'armL_R',
  thigh_L: 'pelvis', shin_L: 'thigh_L', foot_L: 'shin_L', thigh_R: 'pelvis', shin_R: 'thigh_R', foot_R: 'shin_R' };
export const SUITS = ['astronaut', 'suit_eva', 'suit_aces'];

// the garden keeps its models as glTF JSON with the buffer inline: packed into a .glb in memory and parsed
async function loadModel(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url);
  const g = await r.json(), b = g.buffers && g.buffers[0]; let bin = null;
  if (b && b.uri && b.uri.startsWith('data:')) { const s = atob(b.uri.slice(b.uri.indexOf(',') + 1)); bin = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i); delete b.uri; }
  const enc = new TextEncoder().encode(JSON.stringify(g)), jl = (enc.length + 3) & ~3, bl = bin ? (bin.length + 3) & ~3 : 0;
  const glb = new ArrayBuffer(20 + jl + (bin ? 8 + bl : 0)), dv = new DataView(glb), u8 = new Uint8Array(glb);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.byteLength, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); u8.set(enc, 20); u8.fill(0x20, 20 + enc.length, 20 + jl);
  if (bin) { dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004E4942, true); u8.set(bin, 28 + jl); }
  return new Promise((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(glb, url.slice(0, url.lastIndexOf('/') + 1), o => res(o.scene), rej));
}
const cache = new Map();
export function loadSuit(id) {
  if (!cache.has(id)) cache.set(id, loadModel(new URL(`../assets/astro/${id}.json`, import.meta.url).href).catch(e => { cache.delete(id); throw e; }));
  return cache.get(id);
}

// the suit's paint: vertex colours, whose alpha names the surface (0.6 = the glowing strips, 0.8 = gloss: the visor)
let suitMat = null;
function suitMaterial() {
  if (suitMat) return suitMat;
  suitMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.5, 0.5, 0.5), roughness: 0.6, metalness: 0.1 });   // toned down: the suit's white is brighter than the floodlit hall's bloom threshold
  suitMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_COLOR_ALPHA
      if (vColor.a > 0.5 && vColor.a < 0.7) totalEmissiveRadiance += vColor.rgb * 2.2;
      if (vColor.a >= 0.7 && vColor.a < 0.9) { roughnessFactor = 0.12; metalnessFactor = 0.85; }
      diffuseColor.a = 1.0;
      #endif`);
  };
  return suitMat;
}

// ------------------------------------------------------------------------------------------------ the vest
// A tabard tailored to each suit. The torso (pack, chest box and all) is measured by casting rays at it ring by ring; each ring
// is pulled taut (its convex hull) as cloth would be, hangs from the ring above instead of clinging, and sits a centimetre
// proud. The top edge is cut for this suit's own shoulders: armholes, a V neck, a scooped back, straps carried over the top.
const NT = 96, NY = 30, GAP = 0.013;
function hull(pts) {   // Andrew's monotone chain, counter-clockwise
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function measureVest(torso, pelvis, joint) {
  const rayMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), tm = new THREE.Mesh(torso.geometry, rayMat), pm = new THREE.Mesh(pelvis.geometry, rayMat);
  pm.position.copy(joint.pelvis).sub(joint.torso); tm.updateMatrixWorld(); pm.updateMatrixWorld();
  torso.geometry.computeBoundingBox(); const bb = torso.geometry.boundingBox, cz = (bb.min.z + bb.max.z) / 2;
  const rc = new THREE.Raycaster(), O = new THREE.Vector3(), D = new THREE.Vector3();
  const cast = (ox, oy, oz, dx, dy, dz, objs) => { rc.set(O.set(ox, oy, oz), D.set(dx, dy, dz)); const h = rc.intersectObjects(objs, false); return h.length ? h[0] : null; };
  // this suit's shoulders, relative to the torso's joint
  const sh = joint.armU_L.clone().sub(joint.torso); sh.x = Math.abs(sh.x);
  const arm = new THREE.Box3().setFromBufferAttribute(torso.parent.getObjectByName('armU_L').geometry.attributes.position), armR = Math.min(0.14, Math.max(0.06, (arm.max.z - arm.min.z) / 2));
  const sw = 0.075, xs = Math.max(0.1, sh.x - armR - sw * 0.35);   // the strap: its width, and how far out from the spine it runs
  const top = cast(xs, 3, sh.z, 0, -1, 0, [tm]);
  const ys = Math.min(top ? top.point.y : 9, sh.y + armR * 0.9) - 0.025, ya = sh.y - armR - 0.07, yb = -0.11;
  // the rings
  const R = [];
  for (let j = 0; j <= NY; j++) {
    const y = yb + (ys - yb) * j / NY, pts = [];
    for (let i = 0; i < NT; i++) { const a = i / NT * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), h = cast(c * 3, y, cz + s * 3, -c, 0, -s, [tm, pm]); if (h && h.distance < 3) pts.push([h.point.x, h.point.z - cz]); }
    const row = new Float32Array(NT); R.push(row);
    if (pts.length < 3) { if (j) row.set(R[j - 1]); continue; }
    const H = hull(pts);
    for (let i = 0; i < NT; i++) {   // where the ray from the middle leaves the hull
      const a = i / NT * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); let r = 0;
      for (let k = 0; k < H.length; k++) {
        const p = H[k], q = H[(k + 1) % H.length], ex = q[0] - p[0], ez = q[1] - p[1], den = c * ez - s * ex; if (Math.abs(den) < 1e-9) continue;
        const t = (p[0] * ez - p[1] * ex) / den, u = (p[0] * s - p[1] * c) / den; if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) r = Math.max(r, t);
      }
      row[i] = r || (j ? R[j - 1][i] : 0.2);
    }
  }
  // cloth hangs: below a bulge it falls nearly straight rather than tucking in under it
  const dy = (ys - yb) / NY;
  for (let j = NY - 1; j >= 0; j--) for (let i = 0; i < NT; i++) R[j][i] = Math.max(R[j][i], R[j + 1][i] - dy * (j > NY * 0.75 ? 3 : 0.3));
  for (let n = 0; n < 2; n++) for (const row of R) { const o = row.slice(); for (let i = 0; i < NT; i++) row[i] = (o[(i + NT - 1) % NT] + o[i] * 2 + o[(i + 1) % NT]) / 4; }
  return { R, cz, ys, ya, yb, xs, sw, sh, armR, cast: (x, z) => { const h = cast(x, 3, z, 0, -1, 0, [tm]); return h ? h.point.y : -9; } };
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function vestTexture(V, topV, strapU) {
  const W = 1024, Hh = 512, c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'), Y = (v) => Hh * (1 - v);
  x.fillStyle = '#ff5208'; x.fillRect(0, 0, W, Hh);
  // the mesh weave of the cloth
  x.globalAlpha = 0.09; x.fillStyle = '#5a1500'; for (let yy = 0; yy < Hh; yy += 4) for (let xx = (yy / 4 % 2) * 2; xx < W; xx += 4) x.fillRect(xx, yy, 2, 2); x.globalAlpha = 1;
  const tape = (x0, y0, w, h) => {   // retroreflective tape on a lime backing
    x.fillStyle = '#d4f531'; x.fillRect(x0 - (h > w ? 5 : 0), y0 - (h > w ? 0 : 5), w + (h > w ? 10 : 0), h + (h > w ? 0 : 10));
    const g = h > w ? x.createLinearGradient(x0, 0, x0 + w, 0) : x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#c9d0d6'); g.addColorStop(0.5, '#f4f7f9'); g.addColorStop(1, '#bcc4cb');
    x.fillStyle = g; x.fillRect(x0, y0, w, h);
    x.globalAlpha = 0.16; x.fillStyle = '#6c7780'; for (let yy = y0; yy < y0 + h; yy += 5) for (let xx = x0 + ((yy - y0) / 5 % 2) * 3; xx < x0 + w; xx += 6) x.fillRect(xx, yy, 2, 2); x.globalAlpha = 1;
  };
  const bw = W * V.sw / (Math.PI * 2 * 0.24) * 0.6;
  for (const u of strapU) tape(u * W - bw / 2, 0, bw, Y(0.33));   // braces, down from the shoulders to the upper band
  tape(0, Y(0.42), W, Hh * 0.085); tape(0, Y(0.2), W, Hh * 0.085);   // two bands round the body
  // the front zip and its placket
  x.fillStyle = 'rgba(120,30,0,0.35)'; x.fillRect(W * 0.75 - 9, 0, 18, Hh); x.fillStyle = '#2a2d31'; x.fillRect(W * 0.75 - 2, 0, 4, Hh);
  x.fillStyle = '#8d949b'; for (let yy = 2; yy < Hh; yy += 6) x.fillRect(W * 0.75 - 3, yy, 6, 2);
  // the badge pocket on the chest, and the firm's name across the back
  x.fillStyle = '#e44a06'; x.fillRect(W * 0.75 + 26, Y(0.62), 46, 34); x.strokeStyle = 'rgba(90,20,0,0.6)'; x.lineWidth = 2; x.strokeRect(W * 0.75 + 26, Y(0.62), 46, 34);
  x.fillStyle = '#f2f4f5'; x.fillRect(W * 0.75 + 33, Y(0.62) + 7, 32, 20); x.fillStyle = '#20242a'; x.fillRect(W * 0.75 + 37, Y(0.62) + 11, 9, 11); x.fillRect(W * 0.75 + 49, Y(0.62) + 12, 13, 2); x.fillRect(W * 0.75 + 49, Y(0.62) + 17, 10, 2);
  x.fillStyle = '#20242a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 30px "Arial Narrow", Arial, sans-serif'; x.fillText('SHRED HOLE', W * 0.25, Y(0.6), Math.abs(strapU[3] - strapU[2]) * W - bw - 14);
  x.font = '700 15px Arial, sans-serif'; x.fillText('CREW', W * 0.25, Y(0.6) + 24);
  // binding along every cut edge: the hem, and the top as this suit's shoulders shaped it
  x.strokeStyle = '#1d2024'; x.lineWidth = 9; x.lineJoin = 'round'; x.beginPath(); for (let i = 0; i <= NT; i++) { const px = (1 - i / NT) * W, py = Y(topV[i % NT]) ; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  x.fillStyle = '#1d2024'; x.fillRect(0, Hh - 7, W, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function buildVest(model, torso, pelvis, joint) {
  if (model.userData.vest) return model.userData.vest;
  const V = measureVest(torso, pelvis, joint), { R, cz, ys, ya, yb, xs, sw } = V;
  const ring = (y, i) => { const f = Math.min(NY, Math.max(0, (y - yb) / (ys - yb) * NY)), j = Math.min(NY - 1, Math.floor(f)), k = f - j; return R[j][i] * (1 - k) + R[j + 1][i] * k; };
  // the cut of the top edge, round the body: full height at the straps, a V at the throat, a scoop at the nape, low under the arms
  const topY = new Float32Array(NT), jm = Math.round((ya - yb) / (ys - yb) * NY);
  for (let i = 0; i < NT; i++) {
    const a = i / NT * Math.PI * 2, r = R[jm][i], px = Math.abs(Math.cos(a) * r), front = Math.sin(a) > 0;
    const neck = 1 - sstep(xs - sw * 0.9, xs - sw * 0.35, px), armh = sstep(xs + sw * 0.4, xs + sw * 1.0, px);
    topY[i] = ys - neck * (front ? 0.05 + 0.13 * (1 - px / Math.max(0.01, xs - sw * 0.5)) : 0.045) - armh * (ys - ya);
  }
  const pos = [], uv = [], idx = [], P = (i, j) => { const y = yb + (topY[i % NT] - yb) * j / NY, a = i / NT * Math.PI * 2; let r = ring(y, i % NT) + GAP; let px = Math.cos(a) * r, pz = Math.sin(a) * r;
    // under the arm the cloth passes between arm and body, not round the outside of the arm
    const lim = V.sh.x - V.armR - 0.004 + 9 * sstep(V.armR * 0.9, V.armR + 0.07, Math.abs(pz + cz - V.sh.z)); if (Math.abs(px) > lim && y > ya - 0.3) px = Math.sign(px) * (lim + (Math.abs(px) - lim) * sstep(0, 0.3, ya - y));
    return [px, y, pz + cz]; };
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NT; i++) { const p = P(i, j); pos.push(...p); uv.push(1 - i / NT, (p[1] - yb) / (ys - yb)); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) { const a = j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  // where the straps stand on the texture, and the straps themselves carried over the shoulders from the front panel to the back
  const strapU = []; const edge = (sx, front) => { let best = 0, bd = 9; for (let i = 0; i < NT; i++) { const a = i / NT * Math.PI * 2; if ((Math.sin(a) > 0) !== front) continue; const d = Math.abs(Math.cos(a) * (R[NY][i] + GAP) - sx); if (d < bd) { bd = d; best = i; } } return best; };
  for (const [sx, front] of [[xs, true], [-xs, true], [-xs, false], [xs, false]]) strapU.push(1 - edge(sx, front) / NT);
  for (const sx of [xs, -xs]) {
    const f = P(edge(sx, true), NY), b = P(edge(sx, false), NY), n = 12, base = pos.length / 3, uF = 1 - edge(sx, true) / NT, du = sw / (Math.PI * 2 * 0.24) * 0.3;
    for (let k = 0; k <= n; k++) {
      const t = k / n, z = f[2] + (b[2] - f[2]) * t, ends = Math.sin(t * Math.PI);
      let y = Math.max(V.cast(sx - sw * 0.3, z), V.cast(sx, z), V.cast(sx + sw * 0.3, z)); y = Math.min(Math.max(y, ys) + GAP, ys + 0.035) * ends + (f[1] + (b[1] - f[1]) * t) * (1 - ends) + 0.004;
      for (const s of [-1, 1]) { pos.push(sx + s * sw * 0.5 * Math.sign(sx), y, z); uv.push(uF + s * du, 0.9); }
    }
    for (let k = 0; k < n; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const nr = g.attributes.normal; for (let j = 0; j <= NY; j++) { const a = j * (NT + 1), b = a + NT, v = new THREE.Vector3(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize(); nr.setXYZ(a, v.x, v.y, v.z); nr.setXYZ(b, v.x, v.y, v.z); }
  const tex = vestTexture(V, Array.from(topY, y => (y - yb) / (ys - yb)), strapU);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.2, color: '#b8b8b8', roughness: 0.82, side: THREE.DoubleSide });
  return (model.userData.vest = { g, mat });
}

/**
 * An astronaut in a vest, standing at the origin and facing +x (as the Shred Hole's people do).
 * Returns { group, swing(side, joint, angle) }: side 0/1, joint 'leg' | 'arm' | 'armSide', angle in radians forward.
 */
export function buildAstronaut(model) {
  model.updateMatrixWorld(true);
  const meshes = []; model.traverse(o => { if (o.isMesh && o.name in PARENT) meshes.push(o); });
  if (meshes.length < 15) return null;
  const B = {}, joint = {}, rig = new THREE.Group();
  for (const n in PARENT) { B[n] = new THREE.Group(); B[n].name = n; } for (const n in PARENT) (PARENT[n] ? B[PARENT[n]] : rig).add(B[n]);
  for (const o of meshes) joint[o.name] = o.getWorldPosition(new THREE.Vector3());
  const mat = suitMaterial();
  for (const o of meshes) {
    const n = o.name, p = PARENT[n];
    B[n].position.copy(joint[n]); if (p) B[n].position.sub(joint[p]);
    const m = new THREE.Mesh(o.geometry, mat); m.castShadow = true; B[n].add(m);
  }
  // the vest, cut to this suit
  const V = buildVest(model, meshes.find(o => o.name === 'torso'), meshes.find(o => o.name === 'pelvis'), joint);
  const vest = new THREE.Mesh(V.g, V.mat); vest.castShadow = true; B.torso.add(vest);
  // the model faces +z; the Shred Hole's people face +x
  rig.rotation.y = Math.PI / 2;
  const group = new THREE.Group(); group.add(rig);
  // side 0 is the model's +x side (which lands on -z, where the stand-in figure's first limb is)
  const order = joint.thigh_L.x > joint.thigh_R.x ? ['L', 'R'] : ['R', 'L'];
  return {
    group,
    swing(side, part, a) {
      const s = order[side];
      if (part === 'leg') B['thigh_' + s].rotation.x = -a;
      else if (part === 'arm') B['armU_' + s].rotation.x = -a;
      else if (part === 'armSide') B['armU_' + s].rotation.z = a;
    },
  };
}
