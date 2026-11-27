// Walk Around: leave the fixed cameras and go on foot. The controls are the Garden of Delight's (linglab.org/blackhole), so the two
// places feel like one ship:
//   Keyboard: W A S D or the arrows walk, Shift runs, Space jumps. Click takes the pointer and the mouse looks; Esc gives it back.
//             (Where the pointer cannot be taken, hold the button and drag to look.)
//   Touch: drag on the left half to walk (the further, the faster, up to a run), a quick flick up there jumps, drag on the right looks.
// Gravity is the bubble's, a little under half the Earth's, so a jump lifts you about 1.4 m and hangs.
// Where you may go is the caller's business (keepIn): the hall floor, out through the hangar door, the yard to the brink.
import * as THREE from 'three';

const EYE = 1.65, WALK = 1.6, RUN = 5.6;   // the garden's own pace: at a walk the hall is as big as it is
const JUMP_G = 4.2, JUMP_V = 3.4;
const paceFor = m => m <= 0.55 ? WALK * m / 0.55 : WALK + (RUN - WALK) * Math.pow((m - 0.55) / 0.45, 1.3);   // how hard the thumb pushes, to a speed: half way is the walk

export function createWalk({ camera, canvas, keepIn, onLock }) {
  const W = { on: false, x: 0, z: 0, yaw: 0, pitch: 0, bob: 0, speed: 0, jumpY: 0, jumpV: 0 };
  const keys = new Set(), touches = new Map(), e3 = new THREE.Euler(0, 0, 0, 'YXZ');
  let mouseDown = false;
  const locked = () => document.pointerLockElement === canvas;
  const look = (dx, dy, k) => { W.yaw -= dx * k; W.pitch = Math.max(-1.45, Math.min(1.35, W.pitch - dy * k)); };
  const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];

  addEventListener('keydown', (e) => {
    if (!W.on || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) W.jump(); return; }
    if (MOVE.includes(e.code)) { keys.add(e.code); e.preventDefault(); }
  }, true);
  addEventListener('keyup', (e) => keys.delete(e.code), true);
  addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('mousedown', () => { if (!W.on) return; mouseDown = true; if (!locked()) W.lock(); });
  addEventListener('mouseup', () => { mouseDown = false; });
  addEventListener('mousemove', (e) => { if (W.on && (locked() || mouseDown)) look(e.movementX, e.movementY, 0.0022); });
  document.addEventListener('pointerlockchange', () => { if (onLock) onLock(locked()); });
  canvas.addEventListener('touchstart', (e) => {
    if (!W.on) return; e.preventDefault();
    for (const t of e.changedTouches) touches.set(t.identifier, { type: t.clientX < innerWidth / 2 ? 'move' : 'look', x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() });
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!W.on) return; e.preventDefault();
    for (const t of e.changedTouches) { const o = touches.get(t.identifier); if (!o) continue; if (o.type === 'look') look(t.clientX - o.x, t.clientY - o.y, 0.0055); o.x = t.clientX; o.y = t.clientY; }
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      const o = touches.get(t.identifier);
      if (o && W.on && o.type === 'move' && performance.now() - o.t0 < 320 && o.y0 - o.y > 40 && Math.abs(o.x - o.x0) < o.y0 - o.y) W.jump();   // a quick flick up on the walking side
      touches.delete(t.identifier);
    }
  };
  canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);

  return Object.assign(W, {
    get locked() { return locked(); },
    lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed here: dragging still looks */ } },
    jump() { if (W.on && W.jumpY === 0) W.jumpV = JUMP_V; },
    /** Start walking from (x, z), looking toward (lx, lz). */
    enter(x, z, lx = 0, lz = 0) {
      W.on = true; W.x = x; W.z = z; W.yaw = Math.atan2(x - lx, z - lz); W.pitch = 0.22; W.bob = 0; W.jumpY = W.jumpV = 0; keys.clear(); touches.clear(); mouseDown = false;
      W.step(0);
    },
    exit() { W.on = false; keys.clear(); touches.clear(); mouseDown = false; if (locked()) document.exitPointerLock(); },
    step(dt) {
      let mx = 0, mz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      const byKey = mx !== 0 || mz !== 0;
      for (const o of touches.values()) if (o.type === 'move') { mx += (o.x - o.x0) / 110; mz -= (o.y - o.y0) / 110; }
      const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
      // keys walk, and run with Shift; a thumb goes at whatever pace it is pushed to
      const v = ml === 0 ? 0 : byKey ? (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) : paceFor(Math.min(1, ml));
      const s = Math.sin(W.yaw), c = Math.cos(W.yaw);   // forward is where you face (-sin, -cos); right is (cos, -sin)
      const p = keepIn(W.x + (-s * mz + c * mx) * v * dt, W.z + (-c * mz - s * mx) * v * dt, W.x, W.z);
      W.speed = dt > 0 ? Math.hypot(p[0] - W.x, p[1] - W.z) / dt : 0; W.x = p[0]; W.z = p[1];
      if (W.jumpV > 0 || W.jumpY > 0) { W.jumpV -= JUMP_G * dt; W.jumpY = Math.max(0, W.jumpY + W.jumpV * dt); if (W.jumpY === 0) W.jumpV = 0; }
      W.bob += dt * v * 2.2;
      camera.position.set(W.x, EYE + W.jumpY + (W.jumpY ? 0 : Math.sin(W.bob) * 0.035 * Math.min(1, ml)), W.z);
      camera.quaternion.setFromEuler(e3.set(W.pitch, W.yaw, 0));
    },
  });
}
