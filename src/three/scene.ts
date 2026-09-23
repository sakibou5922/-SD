import * as THREE from 'three';
import { buildTargets, DESKTOP, MOBILE, type TargetSet } from './targets';
import { POINTS_VERT, POINTS_FRAG, FRESNEL_VERT, FRESNEL_FRAG } from './shaders';
import { sceneState as S } from './state';
import { createBackground } from './background';
import { createPost, type Post } from './post';

THREE.ColorManagement.enabled = false;

export type LineMode = 'lattice' | 'knot';

export type SceneController = {
  start(): void;
  stop(): void;
  renderOnce(): void;
  setLineMode(mode: LineMode): void;
  dispose(): void;
  readonly isMobile: boolean;
};

/** Overall object scale: the storyboard's camera path reads better with a slightly smaller object. */
const BASE_SCALE = 0.75;

const COLORS = {
  base: new THREE.Color('#c7d6f0'),   // cool starlight white
  primary: new THREE.Color('#8ad8ff'), // star cyan
  secondary: new THREE.Color('#f0c674'), // star gold
  knotBase: new THREE.Color('#1a1f3d'),
  knotRim: new THREE.Color('#f0c674'),
  slabBase: new THREE.Color('#2a3358'),
  slabRim: new THREE.Color('#e6e9f5'),
};

export function createScene(canvas: HTMLCanvasElement, opts: { isMobile: boolean; interactive: boolean }): SceneController | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
  } catch {
    return null;
  }
  const maxDpr = opts.isMobile ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x080b1c, 1);
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(S.fov, window.innerWidth / window.innerHeight, 0.1, 40);
  const group = new THREE.Group();
  scene.add(group);

  /* background (gradient, nebulae, distant stars) drawn in-scene so post-processing covers it */
  const bgLayer = createBackground();
  scene.add(bgLayer.mesh);
  const BG_INDIGO = new THREE.Color('#141b3a'), BG_AMBER = new THREE.Color('#2a1638');
  const bgTmp = new THREE.Color();

  /* post-processing: bloom + grade on desktop; direct render on mobile */
  let post: Post | null = null;
  if (!opts.isMobile) {
    try { post = createPost(renderer, scene, camera); } catch { post = null; }
  }

  /* ---------- geometry ---------- */
  const targets: TargetSet = buildTargets(opts.isMobile ? MOBILE : DESKTOP);
  const geo = new THREE.BufferGeometry();
  const attr = (arr: Float32Array, size: number) => new THREE.BufferAttribute(arr, size);
  const aCloud = attr(targets.cloud, 3);
  geo.setAttribute('position', aCloud);
  geo.setAttribute('aCloud', aCloud);
  geo.setAttribute('aSphere', attr(targets.sphere, 3));
  geo.setAttribute('aLattice', attr(targets.lattice, 3));
  geo.setAttribute('aGrid', attr(targets.grid, 3));
  geo.setAttribute('aKnot', attr(targets.knot, 3));
  geo.setAttribute('aSlab', attr(targets.slab, 3));
  geo.setAttribute('aRing', attr(targets.ring, 3));
  geo.setAttribute('aSeed', attr(targets.seed, 1));
  geo.setAttribute('aCluster', attr(targets.cluster, 1));
  geo.setAttribute('aGal', attr(targets.gal, 1));
  // generous bounding sphere: never frustum-cull the cloud
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

  const lineGeo = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) lineGeo.setAttribute(name, geo.getAttribute(name));
  const idxLattice = new THREE.BufferAttribute(targets.idxLattice, 1);
  const idxKnot = new THREE.BufferAttribute(targets.idxKnot, 1);
  lineGeo.setIndex(idxLattice);
  lineGeo.boundingSphere = geo.boundingSphere;
  let lineMode: LineMode = 'lattice';

  /* ---------- materials ---------- */
  const uniforms = {
    uW: { value: new Float32Array([1, 0, 0, 0, 0, 0, 0]) },
    uTime: { value: 0 },
    uNoiseAmp: { value: S.noise },
    uPointSize: { value: S.pointSize },
    uDpr: { value: dpr },
    uBreath: { value: S.breath },
    uOpacity: { value: 1 },
    uAccentMix: { value: S.accentMix },
    uFog: { value: 0.055 },
    uColorA: { value: COLORS.base.clone() },
    uColorB: { value: COLORS.primary.clone() },
    uGalCore: { value: new THREE.Color('#ffe9c4') },
    uGalArm: { value: new THREE.Color('#8ad8ff') },
    uGalRim: { value: new THREE.Color('#a98bff') },
    uClusterLit: { value: new Float32Array(4) },
    uGlow: { value: 1 },
    uSizeMul: { value: 1 },
    uLineOpacity: { value: 0 },
  };
  const mkMaterial = (defines: Record<string, string>, glow: number, sizeMul = 1) =>
    new THREE.ShaderMaterial({
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      uniforms: { ...uniforms, uGlow: { value: glow }, uSizeMul: { value: sizeMul } },
      defines,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
  const pointsMat = mkMaterial({}, 1);
  const glowMat = mkMaterial({}, opts.isMobile ? 0.12 : 0.06, 3); // halo pass: 3x size (bloom adds the rest on desktop)
  const lineMat = mkMaterial({ LINE: '' }, 1);

  const points = new THREE.Points(geo, pointsMat);
  const glow = new THREE.Points(geo, glowMat);
  glow.visible = !opts.isMobile;
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.visible = false;
  group.add(points, glow, lines);

  const fresnel = (base: THREE.Color, rim: THREE.Color, power: number, bodyAlpha = 0.15, depthWrite = false) =>
    new THREE.ShaderMaterial({
      vertexShader: FRESNEL_VERT,
      fragmentShader: FRESNEL_FRAG,
      uniforms: {
        uBase: { value: base.clone() },
        uRim: { value: rim.clone() },
        uPower: { value: power },
        uOpacity: { value: 0 },
        uBodyAlpha: { value: bodyAlpha },
      },
      transparent: true,
      depthWrite,
      premultipliedAlpha: true,
    });
  const knotMat = fresnel(COLORS.knotBase, COLORS.knotRim, 2.6);
  const knotMesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1.7, 0.42, opts.isMobile ? 120 : 220, opts.isMobile ? 20 : 36, 2, 3), knotMat);
  knotMesh.visible = false;
  const slabMat = fresnel(COLORS.slabBase, COLORS.slabRim, 3.2);
  const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.4, 0.4), slabMat);
  slabMesh.position.y = 0.2;
  slabMesh.visible = false;
  group.add(knotMesh, slabMesh);

  /* About: planet body. Writes depth and draws first so the ring of points passes behind it. */
  const planetMat = fresnel(new THREE.Color('#152650'), new THREE.Color('#8ad8ff'), 2.2, 0.92, true);
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(1.9, opts.isMobile ? 32 : 56, opts.isMobile ? 20 : 36), planetMat);
  planetMesh.renderOrder = -2;
  planetMesh.visible = false;
  group.add(planetMesh);

  /* Contact: a light travelling along the ring (T6 geometry: R 2.6, tilted 18°) */
  const orbitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f6ff'), transparent: true, opacity: 0, depthWrite: false });
  const orbitMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), orbitMat);
  const orbitGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8ad8ff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const orbitGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), orbitGlowMat);
  orbitMesh.add(orbitGlow);
  orbitMesh.visible = false;
  group.add(orbitMesh);

  /* Hero: small ringed planet in the far background (world space, does not rotate with the group) */
  const farGroup = new THREE.Group();
  const farMat = fresnel(new THREE.Color('#1c2358'), new THREE.Color('#c9b8ff'), 2.4, 0.95, true);
  const farPlanet = new THREE.Mesh(new THREE.SphereGeometry(opts.isMobile ? 0.28 : 0.4, 32, 20), farMat);
  farPlanet.renderOrder = -2;
  const farRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#a98bff'), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const farRing = new THREE.Mesh(new THREE.RingGeometry(opts.isMobile ? 0.38 : 0.55, opts.isMobile ? 0.55 : 0.8, 64), farRingMat);
  farRing.rotation.x = Math.PI / 2 - 0.35;
  farRing.rotation.z = 0.3;
  farGroup.add(farPlanet, farRing);
  // projected with the hero camera: desktop ≈ (1190px, 140px) of 1440×900, mobile ≈ (330px, 110px) of 390×844
  farGroup.position.set(opts.isMobile ? 1.1 : 3.4, opts.isMobile ? 2.6 : 1.8, opts.isMobile ? -0.6 : -1.4);
  scene.add(farGroup);

  /* ---------- interaction ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    mouse.tx = e.clientX / window.innerWidth - 0.5;
    mouse.ty = e.clientY / window.innerHeight - 0.5;
  };
  const parallaxEnabled = opts.interactive && !opts.isMobile && window.matchMedia('(pointer: fine)').matches;
  if (parallaxEnabled) window.addEventListener('pointermove', onPointer, { passive: true });

  /* ---------- loop ---------- */
  const w = uniforms.uW.value;
  const lit = uniforms.uClusterLit.value;
  const tmpColor = new THREE.Color();
  const lookAt = new THREE.Vector3();
  let raf = 0;
  let running = false;
  let last = performance.now();
  let idleY = 0;
  let time = 0;
  // adaptive DPR
  let frames = 0, acc = 0, goodStreak = 0;

  const applyState = (dt: number) => {
    // normalise morph weights
    let sum = S.w0 + S.w1 + S.w2 + S.w3 + S.w4 + S.w5 + S.w6;
    if (sum <= 1e-5) sum = 1;
    w[0] = S.w0 / sum; w[1] = S.w1 / sum; w[2] = S.w2 / sum; w[3] = S.w3 / sum;
    w[4] = S.w4 / sum; w[5] = S.w5 / sum; w[6] = S.w6 / sum;
    uniforms.uNoiseAmp.value = S.noise;
    uniforms.uPointSize.value = S.pointSize;
    uniforms.uBreath.value = S.breath;
    uniforms.uOpacity.value = S.opacity;
    uniforms.uAccentMix.value = S.accentMix;
    uniforms.uLineOpacity.value = S.lineOpacity;
    uniforms.uTime.value = time;
    lit[0] = S.lit0; lit[1] = S.lit1; lit[2] = S.lit2; lit[3] = S.lit3;
    tmpColor.lerpColors(COLORS.primary, COLORS.secondary, S.colorMix);
    uniforms.uColorB.value.copy(tmpColor);

    lines.visible = S.lineOpacity > 0.002;
    if (lines.visible) {
      const count = lineGeo.index ? lineGeo.index.count : 0;
      lineGeo.setDrawRange(0, Math.max(0, Math.floor(count * S.lineDraw) & ~1));
    }
    knotMesh.visible = S.knotOpacity > 0.002;
    knotMat.uniforms.uOpacity.value = S.knotOpacity;
    slabMesh.visible = S.slabOpacity > 0.002;
    slabMat.uniforms.uOpacity.value = S.slabOpacity;
    planetMesh.visible = S.planetOpacity > 0.002;
    planetMat.uniforms.uOpacity.value = S.planetOpacity;
    planetMesh.rotation.y = time * 0.05;
    // orbiting light: ring param → tilt 18° about X (matches the T6 target)
    orbitMesh.visible = S.orbitOpacity > 0.002;
    orbitMat.opacity = S.orbitOpacity * (opts.isMobile ? 0.5 : 0.8);
    orbitGlowMat.opacity = S.orbitOpacity * (opts.isMobile ? 0.10 : 0.12);
    {
      const a = time * 0.45, R = 2.6, tilt = (18 * Math.PI) / 180;
      const x = R * Math.cos(a), z = R * Math.sin(a);
      orbitMesh.position.set(x, -z * Math.sin(tilt), z * Math.cos(tilt));
    }
    bgLayer.uniforms.uTime.value = time;
    bgLayer.uniforms.uBgPos.value.set(S.bgX, 1 - S.bgY);
    bgTmp.lerpColors(BG_INDIGO, BG_AMBER, S.bgWarm);
    (bgLayer.uniforms.uBgC.value as THREE.Color).copy(bgTmp);
    if (post) post.grade.uniforms.uTime.value = time;
    farGroup.visible = S.farOpacity > 0.002;
    farMat.uniforms.uOpacity.value = S.farOpacity;
    farRingMat.opacity = S.farOpacity * 0.45;
    farGroup.rotation.y = time * 0.03;

    // idle + parallax
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    idleY += S.idleSpeed * dt + (parallaxEnabled ? mouse.x * 0.06 * dt : 0);
    group.rotation.set(S.rotX, idleY + S.rotY, 0);
    group.position.y = S.groupY + (opts.isMobile ? 0.8 : 0); // mobile: object sits above the text
    const breathe = 1 + 0.015 * Math.sin(time * 0.8);
    group.scale.setScalar(BASE_SCALE * breathe);

    camera.position.set(S.camX + (parallaxEnabled ? mouse.x * 0.5 : 0), S.camY - (parallaxEnabled ? mouse.y * 0.3 : 0), S.camZ);
    lookAt.set(S.tX, S.tY, S.tZ);
    camera.lookAt(lookAt);
    const fov = opts.isMobile ? 48 : S.fov;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };

  const render = () => {
    if (post) post.composer.render(); else renderer.render(scene, camera);
  };

  const setDpr = (v: number) => {
    dpr = v;
    renderer.setPixelRatio(dpr);
    uniforms.uDpr.value = dpr;
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    post?.setPixelRatio(dpr);
    post?.setSize(window.innerWidth, window.innerHeight);
    bgLayer.uniforms.uRes.value.set(window.innerWidth * dpr, window.innerHeight * dpr);
  };
  post?.setPixelRatio(dpr);
  post?.setSize(window.innerWidth, window.innerHeight);
  bgLayer.uniforms.uRes.value.set(window.innerWidth * dpr, window.innerHeight * dpr);

  let skip = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    // footer: 30fps when the scene is mostly faded out
    if (S.opacity < 0.3) { skip = !skip; if (skip) return; }
    applyState(dt);
    render();
    // adaptive DPR on the real frame interval (covers GPU-bound devices, not just JS time)
    acc += dt * 1000; frames++;
    if (frames >= 60) {
      const avg = acc / frames;
      acc = 0; frames = 0;
      if (avg > 22 && dpr > 1) { setDpr(Math.max(1, dpr - 0.25)); goodStreak = 0; }
      else if (avg > 22 && post) { post.dispose(); post = null; goodStreak = 0; } // still slow at DPR 1: drop post-processing
      else if (avg < 18) { goodStreak += 60; if (goodStreak >= 180 && dpr < maxDpr) { setDpr(Math.min(maxDpr, dpr + 0.25)); goodStreak = 0; } }
      else goodStreak = 0;
    }
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const renderOnce = () => {
    applyState(0);
    render();
  };

  /* ---------- resize / visibility ---------- */
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      post?.setSize(window.innerWidth, window.innerHeight);
      bgLayer.uniforms.uRes.value.set(window.innerWidth * dpr, window.innerHeight * dpr);
      if (!running) renderOnce();
    }, 150);
  };
  window.addEventListener('resize', onResize);
  const onVisibility = () => {
    if (!opts.interactive) return;
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const setLineMode = (mode: LineMode) => {
    if (mode === lineMode) return;
    lineMode = mode;
    lineGeo.setIndex(mode === 'lattice' ? idxLattice : idxKnot);
  };

  const dispose = () => {
    stop();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    geo.dispose(); lineGeo.dispose();
    pointsMat.dispose(); glowMat.dispose(); lineMat.dispose(); knotMat.dispose(); slabMat.dispose();
    planetMat.dispose(); orbitMat.dispose(); orbitGlowMat.dispose(); farMat.dispose(); farRingMat.dispose();
    knotMesh.geometry.dispose(); slabMesh.geometry.dispose(); planetMesh.geometry.dispose();
    orbitMesh.geometry.dispose(); orbitGlow.geometry.dispose(); farPlanet.geometry.dispose(); farRing.geometry.dispose();
    post?.dispose();
    (bgLayer.mesh.material as THREE.Material).dispose(); bgLayer.mesh.geometry.dispose();
    renderer.dispose();
  };

  if (import.meta.env.DEV) {
    (window as unknown as { __sd: unknown }).__sd = { S, uniforms, w, renderer, camera, group };
  }
  return { start, stop, renderOnce, setLineMode, dispose, isMobile: opts.isMobile };
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
