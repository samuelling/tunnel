// The lens. The scene is rendered in HDR (half-float, 4× MSAA), anything brighter than white blooms
// (lamps, sparks, the portal, the beacon), and a final grade adds what a camera would: a vignette,
// a little grain, and on big impacts a punch of chromatic aberration and a flash of over-exposure.
//
// It costs a few full-screen passes, so it watches its own frame time: if the device can't hold
// ~35 fps it steps down (full → half-resolution effects → off, plain rendering) and stays there.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uPunch: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 }, uVig: { value: 0.42 }, uGrain: { value: 0.035 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uPunch, uFlash, uTime, uVig, uGrain, uAspect;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d * vec2(uAspect, 1.0), d * vec2(uAspect, 1.0));
      // a hit knocks the lens: colours split toward the edges and the frame bulges a touch
      vec2 off = d * (0.0012 + 0.016 * uPunch) * (0.35 + r2 * 2.2);
      vec2 uv = vUv - d * 0.02 * uPunch;
      vec3 c = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      c *= 1.0 + 0.9 * uFlash;                                   // over-exposure
      c *= mix(1.0, smoothstep(0.95, 0.12, r2), uVig);          // vignette
      // a gentle grade: cool shadows, warm highlights
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c * vec3(0.94, 1.0, 1.08), c * vec3(1.06, 1.0, 0.94), smoothstep(0.05, 0.9, l));
      c += (hash(vUv * 913.0 + fract(uTime) * 71.0) - 0.5) * uGrain * (0.25 + l);   // grain, stronger in the light
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const mkTarget = (pr, samples) => new THREE.WebGLRenderTarget(Math.max(2, size.x * pr), Math.max(2, size.y * pr), { type: THREE.HalfFloatType, samples });
  const basePR = renderer.getPixelRatio();
  let composer, bloom, grade;
  const build = (pr, samples) => {
    composer?.dispose();
    composer = new EffectComposer(renderer, mkTarget(pr, samples));
    composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x * pr, size.y * pr), 0.5, 0.55, 0.92);
    composer.addPass(bloom);
    grade = new ShaderPass(GradeShader);
    grade.uniforms.uAspect.value = size.x / Math.max(1, size.y);
    composer.addPass(grade);
    composer.addPass(new OutputPass());
  };
  // 2: full resolution with MSAA, 1: effects at a lower resolution, 0: off
  // ?post=0|1|2 pins the level (for testing); otherwise it adapts and remembers for the session
  const pin = new URLSearchParams(location.search).get('post');
  let level = 2;
  try { const sv = sessionStorage.getItem('shredPost'); if (sv === '0' || sv === '1') level = +sv; } catch { /* private mode */ }
  if (pin !== null && pin !== '') level = Math.max(0, Math.min(2, +pin || 0));
  const apply = () => { if (level === 2) build(basePR, 4); else if (level === 1) build(Math.min(1, basePR), 0); };
  let ok = true;
  try { apply(); } catch (e) { console.warn('post-processing off:', e); ok = false; level = 0; }

  let punch = 0, flash = 0, t = 0, slow = 0, frames = 0;
  return {
    get level() { return ok ? level : 0; },
    setSize(w, h) {
      size.set(w, h);
      if (!ok || !level) return;
      composer.setSize(w, h);
      grade.uniforms.uAspect.value = w / Math.max(1, h);
    },
    // an impact: k ~ 0.2 (a thump) … 1 (a bus into the fan)
    punch(k) { punch = Math.max(punch, Math.min(1, k)); flash = Math.max(flash, Math.min(1, k * k) * 0.22); },
    render(dt) {
      if (!ok || !level) { renderer.render(scene, camera); return; }
      t += dt; punch *= Math.pow(0.004, dt); flash *= Math.pow(0.0005, dt);
      grade.uniforms.uPunch.value = punch; grade.uniforms.uFlash.value = flash; grade.uniforms.uTime.value = t;
      try { composer.render(dt); } catch (e) { console.warn('post-processing off:', e); ok = false; renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
      // too slow for 3 s straight (after a 4 s warm-up, tab visible): step down a level
      frames++;
      if (pin === null && frames > 240 && !document.hidden) {
        slow = dt > 0.029 && dt < 0.25 ? slow + dt : Math.max(0, slow - dt * 2);
        if (slow > 3) {
          slow = 0; frames = 120; level--;
          try { sessionStorage.setItem('shredPost', String(level)); } catch { /* fine */ }
          if (level) apply(); else composer.dispose();
        }
      }
    },
  };
}
