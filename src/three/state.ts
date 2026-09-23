/**
 * Single flat state object for the 3D scene. Scroll timelines only tween these numbers;
 * the render loop reads them every frame. (docs/scroll-storyboard.md §8-5)
 */
export const sceneState = {
  // morph weights: cloud, sphere, lattice, grid, knot, slab, ring
  w0: 1, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0,
  noise: 0.12,
  pointSize: 2.6,
  opacity: 1,
  lineOpacity: 0,
  lineDraw: 1,
  accentMix: 0.1,
  /** 0 = primary (mint) accent, 1 = secondary (brass) accent */
  colorMix: 0,
  breath: 0.012,
  lit0: 0, lit1: 0, lit2: 0, lit3: 0,
  rotX: 0,
  rotY: 0,
  groupY: 0,
  idleSpeed: 0.04,
  knotOpacity: 0,
  slabOpacity: 0,
  /** About: planet body inside the ring of points */
  planetOpacity: 0,
  /** Contact: light travelling along the ring */
  orbitOpacity: 0,
  /** Hero: small ringed planet in the far background */
  farOpacity: 1,
  camX: 0, camY: 4.2, camZ: 8.0,
  tX: 0, tY: 0, tZ: 0,
  fov: 42,
};

export type SceneState = typeof sceneState;
export type SceneKey = keyof SceneState;

/** Static end-state used for prefers-reduced-motion (storyboard §5.3). */
export const REDUCED_STATE: Partial<SceneState> = {
  w0: 0, w1: 0, w2: 0, w3: 0, w4: 0.6, w5: 0, w6: 0.4,
  noise: 0, breath: 0, knotOpacity: 0.6, lineOpacity: 0, pointSize: 1.8,
  camX: 0, camY: 0.3, camZ: 6.5, rotX: 0.3, colorMix: 0.6, accentMix: 0.3,
};
