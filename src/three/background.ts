import * as THREE from 'three';

/**
 * Full-screen background drawn inside the WebGL scene: base gradient, two slow nebulae,
 * a twinkling distant star field and a vignette. Replaces the CSS background whenever
 * WebGL is available so bloom / grain can be applied to the whole frame.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uBgPos;
uniform vec3 uBg;
uniform vec3 uBgC;
uniform vec3 uNebA;
uniform vec3 uNebB;
uniform float uStars;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 p = uv * vec2(aspect, 1.0);

  vec3 col = uBg;
  // moving centre glow (driven by the scroll timelines)
  vec2 d = (uv - uBgPos) * vec2(aspect, 1.0);
  float g = 1.0 - smoothstep(0.0, 0.8, length(d));
  col = mix(col, uBgC, g * g);

  // nebulae
  float n1 = fbm(p * 1.5 + vec2(uTime * 0.010, -uTime * 0.006));
  float n2 = fbm(p * 2.2 + vec2(-uTime * 0.007, uTime * 0.011) + 7.3);
  float mA = smoothstep(0.42, 0.82, n1) * (1.0 - smoothstep(0.0, 1.0, distance(p, vec2(0.85 * aspect, 0.85)) * 1.1));
  float mB = smoothstep(0.48, 0.86, n2) * (1.0 - smoothstep(0.0, 1.0, distance(p, vec2(0.12 * aspect, 0.12)) * 1.1));
  col += uNebA * mA * 0.42 + uNebB * mB * 0.34;

  // distant stars (cell hashed), gentle twinkle
  vec2 q = p * (uRes.y / 42.0);
  vec2 cell = floor(q), f = fract(q);
  float h = hash(cell);
  if (h < 0.16) {
    vec2 c = vec2(hash(cell + 3.1), hash(cell + 7.7)) * 0.8 + 0.1;
    float dist = length(f - c);
    float tw = 0.6 + 0.4 * sin(uTime * (1.2 + h * 3.0) + h * 40.0);
    float s = smoothstep(0.09, 0.0, dist) * tw * uStars;
    vec3 sc = mix(vec3(0.95, 0.97, 1.0), vec3(0.55, 0.85, 1.0), step(0.1, h));
    col += sc * s * (0.35 + 0.65 * hash(cell + 1.3));
  }

  // vignette
  float v = smoothstep(1.25, 0.3, length((uv - 0.5) * vec2(aspect, 1.0) * 1.15));
  col *= mix(0.6, 1.0, v);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createBackground(): { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform> } {
  const uniforms: Record<string, THREE.IUniform> = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uBgPos: { value: new THREE.Vector2(0.5, 0.6) },
    uBg: { value: new THREE.Color('#080b1c') },
    uBgC: { value: new THREE.Color('#141b3a') },
    uNebA: { value: new THREE.Color('#5a3fb0') },
    uNebB: { value: new THREE.Color('#2350b8') },
    uStars: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return { mesh, uniforms };
}
