// The Instruments: things the Shred Hole fabricates for the garden's navigators. Like the Arsenal's guns they don't shred:
// they go through the portal whole, carrying a tool id (in the `weapon` field, the channel the garden already reads), and in the
// Garden of Delight each comes out of the wormhole as the real thing.
//
// The bubble sextant: an aircraft navigator's sextant, which carries its own horizon (a bubble) so it works where there is
// no sea to sight along. In the garden you climb a tree above the haze, shoot three stars with it, and work the ship's fix.
const BRASS = '#b08d3c', BLACK = '#17181a';
const arm = deg => { const a = deg * Math.PI / 180; return { shape: 'box', size: [0.16, 0.009, 0.005], pos: [+(0.08 * Math.cos(a)).toFixed(4), +(0.08 * Math.sin(a)).toFixed(4), 0], rot: [0, 0, deg], color: BRASS, material: 'metal' }; };
export const INSTRUMENTS = [{
  id: 'ins-sextant', weapon: 'sextant', name: 'Bubble sextant', icon: '🧭', mass: 1.3, unbreakable: true, spray: 'sparks', sound: 'clang', inner: BRASS,
  blend: 'IT DID NOT BLEND. Brass and patience: the blades skate off it.', survive: 'Through in one piece. Somebody in the garden can find out where we are.',
  fact: 'A bubble sextant carries its own horizon, so it works where there is no sea to sight along. Fabricated here from memory: sent to the Garden of Delight it lands by the wormhole, and with three stars from the top of a tree it fixes the ship’s position.',
  parts: [
    arm(-120), arm(-60),                                                                                                             // the frame, down from the pivot
    { shape: 'torus', size: [0.16, 0.006, 60], pos: [0, 0, 0], rot: [0, 0, -120], color: BRASS, material: 'metal' },                 // the limb: the arc the scale is cut on
    { shape: 'box', size: [0.175, 0.012, 0.004], pos: [0.0152, -0.0862, 0.006], rot: [0, 0, -80], color: BRASS, material: 'metal' }, // the index arm
    { shape: 'cylinder', size: [0.012, 0.014, 0.11], pos: [0.0, -0.05, 0.022], rot: [0, 0, 90], color: BLACK, material: 'metal' },    // the telescope
    { shape: 'sphere', size: [0.016], pos: [0, 0.004, 0.012], color: '#bfe8d8', material: 'glass' },                                  // the bubble chamber
    { shape: 'plate', size: [0.03, 0.002, 0.022], pos: [0, 0.0, 0.004], rot: [90, 0, 30], color: '#dfe6ea', material: 'chrome' },     // the index mirror
    { shape: 'capsule', size: [0.012, 0.07], pos: [-0.01, -0.09, -0.024], rot: [0, 0, 10], color: '#5a3b22', material: 'wood' },     // the handle
  ],
}];
export const TOOL_IDS = new Set(INSTRUMENTS.map(a => a.weapon));
