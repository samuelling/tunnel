// Walk Around: leave the fixed cameras and go on foot, as in the Garden of Delight. Eye height, first person.
//   Keyboard: W A S D or the arrows to walk, Shift to run, drag the mouse to look, Esc to stop.
//   Touch: the left thumb is a stick (drag from wherever it lands), the right thumb looks.
// Where you may go is the caller's business (keepIn): the hall floor, out through the hangar door, the yard to the brink.
import * as THREE from 'three';

const EYE = 1.68, WALK = 5.5, RUN = 13;   // brisk: the place is 460 m across

export function createWalk({ camera, canvas, keepIn }) {
  const W = { on: false, x: 0, z: 0, yaw: 0, pitch: 0, bob: 0, speed: 0 };
  const keys = new Set(), stick = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 }, look = { id: null, x: 0, y: 0 };
  const e3 = new THREE.Euler(0, 0, 0, 'YXZ');
  const MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

  addEventListener('keydown', (e) => { if (!W.on || e.target.tagName === 'INPUT') return; if (e.code in MOVE || e.code.startsWith('Shift')) { keys.add(e.code); e.preventDefault(); } }, true);
  addEventListener('keyup', (e) => keys.delete(e.code), true);
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', (e) => {
    if (!W.on) return;
    const r = canvas.getBoundingClientRect();
    if (e.pointerType === 'touch' && e.clientX - r.left < r.width * 0.42 && stick.id === null) Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
    else if (look.id === null) Object.assign(look, { id: e.pointerId, x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!W.on) return;
    if (e.pointerId === stick.id) { stick.dx = Math.max(-1, Math.min(1, (e.clientX - stick.x0) / 60)); stick.dy = Math.max(-1, Math.min(1, (e.clientY - stick.y0) / 60)); }
    else if (e.pointerId === look.id) {
      const k = e.pointerType === 'touch' ? 0.0055 : 0.0034;
      W.yaw -= (e.clientX - look.x) * k; W.pitch = Math.max(-1.2, Math.min(1.45, W.pitch - (e.clientY - look.y) * k));
      look.x = e.clientX; look.y = e.clientY;
    }
  });
  const up = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; } if (e.pointerId === look.id) look.id = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  return Object.assign(W, {
    /** Start walking from (x, z), looking toward (lx, lz). */
    enter(x, z, lx = 0, lz = 0) {
      W.on = true; W.x = x; W.z = z; W.yaw = Math.atan2(x - lx, z - lz); W.pitch = 0.22; W.bob = 0; keys.clear(); stick.id = look.id = null;
      W.step(0);
    },
    exit() { W.on = false; keys.clear(); stick.id = look.id = null; },
    step(dt) {
      let mx = stick.dx, my = -stick.dy;
      for (const k of keys) if (MOVE[k]) { mx += MOVE[k][0]; my += MOVE[k][1]; }
      const m = Math.hypot(mx, my), run = keys.has('ShiftLeft') || keys.has('ShiftRight') || m > 1.6;
      if (m > 1) { mx /= m; my /= m; }
      const v = (run ? RUN : WALK) * Math.min(1, m), s = Math.sin(W.yaw), c = Math.cos(W.yaw);
      // forward is where you face (-sin, -cos); right is (cos, -sin)
      const nx = W.x + (-s * my + c * mx) * v * dt, nz = W.z + (-c * my - s * mx) * v * dt;
      const p = keepIn(nx, nz, W.x, W.z);
      W.speed = dt > 0 ? Math.hypot(p[0] - W.x, p[1] - W.z) / dt : 0;
      W.x = p[0]; W.z = p[1];
      W.bob += W.speed * dt * 1.9;
      camera.position.set(W.x, EYE + Math.sin(W.bob) * 0.035 * Math.min(1, W.speed / 3), W.z);
      camera.quaternion.setFromEuler(e3.set(W.pitch, W.yaw, 0));
    },
  });
}
