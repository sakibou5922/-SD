import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/** Final grade: film grain, vignette and a trace of chromatic aberration at the edges. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.04 },
    uVignette: { value: 0.26 },
    uCA: { value: 0.0009 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uCA;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * uCA * r2 * 6.0;
      float r = texture2D(tDiffuse, vUv + off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - off).b;
      vec3 c = vec3(r, g, b);
      float n = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.31) * 100.0);
      c += (n - 0.5) * uGrain;
      c *= 1.0 - uVignette * smoothstep(0.3, 1.0, length(d) * 1.45);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export type Post = {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  setSize(w: number, h: number): void;
  setPixelRatio(r: number): void;
  dispose(): void;
};

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.45, 0.72);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return {
    composer, bloom, grade,
    setSize: (w, h) => { composer.setSize(w, h); bloom.setSize(w, h); },
    setPixelRatio: (r) => composer.setPixelRatio(r),
    dispose: () => { composer.dispose(); bloom.dispose(); grade.dispose(); },
  };
}
