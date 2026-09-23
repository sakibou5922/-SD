/* GLSL sources for the point cloud, its line pass and the fresnel solids. */

const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

export const POINTS_VERT = /* glsl */ `
attribute vec3 aCloud;
attribute vec3 aSphere;
attribute vec3 aLattice;
attribute vec3 aGrid;
attribute vec3 aKnot;
attribute vec3 aSlab;
attribute vec3 aRing;
attribute float aSeed;
attribute float aCluster;
attribute float aGal;

uniform float uW[7];
uniform float uTime;
uniform float uNoiseAmp;
uniform float uPointSize;
uniform float uSizeMul;
uniform float uDpr;
uniform float uBreath;
uniform float uOpacity;
uniform float uAccentMix;
uniform float uFog;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uGalCore;
uniform vec3 uGalArm;
uniform vec3 uGalRim;
uniform float uClusterLit[4];

varying vec3 vColor;
varying float vAlpha;

${SIMPLEX}

void main() {
  vec3 target = aCloud * uW[0] + aSphere * uW[1] + aLattice * uW[2] + aGrid * uW[3]
              + aKnot * uW[4] + aSlab * uW[5] + aRing * uW[6];
  float mx = 1.0 - max(max(max(uW[0], uW[1]), max(uW[2], uW[3])), max(max(uW[4], uW[5]), uW[6]));
  // noise is sampled in target space (no per-point offset) so neighbours move together
  vec3 q = target * 0.6 + uTime * 0.05;
  vec3 n = vec3(snoise(q), snoise(q + 31.7), snoise(q + 77.3));
  vec3 pos = target + n * (uNoiseAmp + mx * 0.6);
  pos *= 1.0 + uBreath * sin(uTime * 0.8 + aSeed * 6.2831);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  float lit = 0.0;
  if (aCluster < 0.5) lit = uClusterLit[0];
  else if (aCluster < 1.5) lit = uClusterLit[1];
  else if (aCluster < 2.5) lit = uClusterLit[2];
  else lit = uClusterLit[3];

  float accent = step(1.0 - uAccentMix, fract(aSeed * 13.37));
  vec3 col = mix(uColorA, uColorB, accent);
  col = mix(col, uColorB, lit * 0.85);
  col *= 1.0 + 0.2 * step(0.7, aSeed);
  // galaxy ramp (only while the T0 target dominates): warm core → cyan arms → violet rim
  vec3 gcol = mix(uGalCore, uGalArm, smoothstep(0.0, 0.45, aGal));
  gcol = mix(gcol, uGalRim, smoothstep(0.6, 1.0, aGal));
  gcol *= 1.0 + 0.35 * (1.0 - smoothstep(0.0, 0.3, aGal));
  col = mix(col, gcol, uW[0]);
  vColor = col;

  float d = -mv.z;
  float fog = exp(-uFog * uFog * d * d);
  vAlpha = uOpacity * fog * (0.55 + 0.45 * aSeed);

  #ifdef LINE
    vAlpha *= 0.9;
  #else
    float core = uW[0] * (1.0 - smoothstep(0.0, 0.25, aGal));
    gl_PointSize = uPointSize * uSizeMul * uDpr * (0.7 + 0.7 * aSeed) * (1.0 + 0.35 * lit) * (1.0 + 0.4 * core) * (6.0 / d);
  #endif
  gl_Position = projectionMatrix * mv;
}
`;

export const POINTS_FRAG = /* glsl */ `
precision highp float;
uniform float uGlow;       // 1.0 = core pass, >1 = glow pass (larger, dimmer)
uniform float uLineOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  #ifdef LINE
    float a = vAlpha * uLineOpacity;
  #else
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.15, d) * vAlpha * uGlow;
  #endif
  gl_FragColor = vec4(vColor * a, a);
}
`;

export const FRESNEL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const FRESNEL_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBase;
uniform vec3 uRim;
uniform float uPower;
uniform float uOpacity;
uniform float uBodyAlpha;   // opacity of the face-on body (0.15 = glassy, 0.9 = solid planet)
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPower);
  vec3 c = mix(uBase, uRim, f);
  float a = (uBodyAlpha + (1.0 - uBodyAlpha) * f) * uOpacity;
  gl_FragColor = vec4(c * a, a);
}
`;
