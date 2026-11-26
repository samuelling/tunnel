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

// the vest: fluorescent orange with two silver bands and braces, wrapped round whatever torso (and backpack) the suit has
let vestTex = null;
function vestTexture() {
  if (vestTex) return vestTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#ff5a0a'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#e9eef2'; x.fillRect(0, 78, 256, 13); x.fillRect(0, 100, 256, 13);
  for (const u of [40, 88, 168, 216]) x.fillRect(u - 6, 0, 12, 78);            // braces over the shoulders, front and back
  x.fillStyle = '#d7ff3a'; x.fillRect(0, 91, 256, 9);
  vestTex = new THREE.CanvasTexture(c); vestTex.colorSpace = THREE.SRGBColorSpace; vestTex.wrapS = THREE.RepeatWrapping;
  return vestTex;
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
  // the vest, sized to this suit's torso
  const tg = meshes.find(o => o.name === 'torso').geometry; tg.computeBoundingBox(); const bb = tg.boundingBox;
  const w = (bb.max.x - bb.min.x) / 2, d = (bb.max.z - bb.min.z) / 2, h = bb.max.y - bb.min.y;
  const vest = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h * 0.62, 28, 1, true), new THREE.MeshStandardMaterial({ map: vestTexture(), emissiveMap: vestTexture(), emissive: '#ffffff', emissiveIntensity: 0.22, color: '#bbbbbb', roughness: 0.8, side: THREE.DoubleSide }));
  vest.scale.set(w * 1.05, 1, d * 1.07); vest.position.set((bb.min.x + bb.max.x) / 2, bb.min.y + h * 0.47, (bb.min.z + bb.max.z) / 2); vest.castShadow = true; B.torso.add(vest);
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
