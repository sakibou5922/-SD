/**
 * Procedural morph targets for the persistent point cloud.
 * Pure functions, deterministic (mulberry32) so the same N always yields the same result.
 * See docs/scroll-storyboard.md §2.2.
 */

export type TargetSet = {
  n: number;
  cloud: Float32Array;
  sphere: Float32Array;
  lattice: Float32Array;
  grid: Float32Array;
  knot: Float32Array;
  slab: Float32Array;
  ring: Float32Array;
  seed: Float32Array;
  cluster: Float32Array;
  /** 0 at the galaxy core, 1 at the rim (colour ramp for the T0 target) */
  gal: Float32Array;
  idxLattice: Uint32Array;
  idxKnot: Uint32Array;
};

export type TargetOptions = {
  /** cube side for the lattice; N = side^3 */
  side: number;
  /** points around the knot tube */
  around: number;
  /** keep every k-th lattice line segment */
  latticeThin: number;
  /** keep every k-th knot line segment */
  knotThin: number;
};

export const DESKTOP: TargetOptions = { side: 23, around: 12, latticeThin: 1, knotThin: 2 };
export const MOBILE: TargetOptions = { side: 16, around: 8, latticeThin: 1, knotThin: 3 };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildTargets(opts: TargetOptions): TargetSet {
  const S = opts.side;
  const n = S * S * S;
  const rand = mulberry32(20260923);
  const seed = new Float32Array(n);
  const cluster = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = rand();

  /* T0 saturn — ring system around the hero planet (planet radius R_P = 1, scaled in the scene) */
  const cloud = new Float32Array(n * 3);
  const gal = new Float32Array(n);
  {
    // bands: [inner, outer, weight]
    const bands: [number, number, number][] = [[1.32, 1.68, 0.34], [1.74, 2.10, 0.30], [2.16, 2.36, 0.14], [2.42, 2.70, 0.14]];
    const wsum = bands.reduce((t, b) => t + b[2], 0);
    const gauss = () => { const u1 = Math.max(rand(), 1e-6), u2 = rand(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
    for (let i = 0; i < n; i++) {
      let x: number, y: number, z: number;
      if (i % 12 === 0) {
        // 8%: halo stars far from the planet
        const zz = rand() * 2 - 1, a2 = rand() * Math.PI * 2, sxy = Math.sqrt(1 - zz * zz);
        const r = 3.2 + rand() * 4.5;
        x = sxy * Math.cos(a2) * r; y = zz * r * 0.7; z = sxy * Math.sin(a2) * r;
      } else {
        let u = rand() * wsum, band = bands[0];
        for (const bnd of bands) { if (u < bnd[2]) { band = bnd; break; } u -= bnd[2]; }
        // density falls off towards the outer edge of each band
        const t = Math.pow(rand(), 0.8);
        const r = band[0] + (band[1] - band[0]) * t;
        const a2 = rand() * Math.PI * 2;
        x = r * Math.cos(a2); z = r * Math.sin(a2);
        y = gauss() * 0.012;
      }
      // stored untilted: the tilt (X 22°, Z -12°) and the ring's own spin are applied in the vertex shader
      cloud[i * 3] = x; cloud[i * 3 + 1] = y; cloud[i * 3 + 2] = z;
      gal[i] = Math.min(1, Math.max(0, (Math.hypot(x, z) - 1.3) / 1.4));
    }
  }

  /* T1 atom — three ellipses in the screen plane (a 2.0 / b 0.76) rotated -28°, 32°, 92°, a small nucleus and a faint cloud */
  const sphere = new Float32Array(n * 3);
  {
    const A = 2.0, B = 0.76, tube = 0.028;
    const angles = [-28, 32, 92].map((d) => (d * Math.PI) / 180);
    const gauss = () => { const u1 = Math.max(rand(), 1e-6), u2 = rand(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
    for (let i = 0; i < n; i++) {
      let x: number, y: number, z: number;
      const m = i % 20;
      if (m === 0) {
        x = gauss() * 0.15; y = gauss() * 0.15; z = gauss() * 0.15;                       // nucleus 5%
      } else if (m === 1) {
        const r = 0.5 + Math.abs(gauss()) * 1.2;                                            // cloud 5%
        const zz = rand() * 2 - 1, a2 = rand() * Math.PI * 2, sxy = Math.sqrt(1 - zz * zz);
        x = sxy * Math.cos(a2) * r; y = zz * r * 0.7; z = sxy * Math.sin(a2) * r * 0.5;
      } else {
        const k = i % 3;
        const t = 2 * Math.PI * ((i * 0.618034) % 1);
        const px = A * Math.cos(t) + gauss() * tube, py = B * Math.sin(t) + gauss() * tube;
        const ca = Math.cos(angles[k]), sa = Math.sin(angles[k]);
        x = px * ca - py * sa; y = px * sa + py * ca; z = gauss() * tube + (k - 1) * 0.06;
      }
      sphere[i * 3] = x; sphere[i * 3 + 1] = y; sphere[i * 3 + 2] = z;
    }
  }

  /* T2 lattice (x-major so (i, i+1) is a row neighbour) */
  const lattice = new Float32Array(n * 3);
  const edgeMask = new Uint8Array(n);
  {
    const step = 3.6 / (S - 1);
    const half = (S - 1) / 2;
    for (let i = 0; i < n; i++) {
      const x = i % S;
      const y = Math.floor(i / S) % S;
      const z = Math.floor(i / (S * S));
      lattice[i * 3] = (x - half) * step;
      lattice[i * 3 + 1] = (y - half) * step;
      lattice[i * 3 + 2] = (z - half) * step;
      cluster[i] = (x < S / 2 ? 0 : 1) + (y < S / 2 ? 0 : 2);
      // draw x-row segments only on the cube's outer faces so the lattice reads as a wire box
      const onFace = y === 0 || y === S - 1 || z === 0 || z === S - 1;
      edgeMask[i] = x < S - 1 && onFace ? 1 : 0;
    }
  }

  /* T3 grid (blueprint plane, XZ) */
  const grid = new Float32Array(n * 3);
  {
    const cols = Math.ceil(Math.sqrt(n * 1.01));
    const width = 7.7;
    const cell = width / cols;
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      grid[i * 3] = (c - cols / 2) * cell;
      grid[i * 3 + 1] = 0.08 * Math.sin(c * 0.25) * Math.cos(r * 0.25);
      grid[i * 3 + 2] = (r - cols / 2) * cell * 0.8;
    }
  }

  /* T4 knot (torus-knot tube surface, p=2 q=3) */
  const knot = new Float32Array(n * 3);
  {
    const P = 2, Q = 3, R = 1.7, r = 0.55, tube = 0.32;
    const AROUND = opts.around;
    const K = Math.floor(n / AROUND);
    const C = (t: number): [number, number, number] => {
      const rr = R + r * Math.cos(Q * t);
      return [rr * Math.cos(P * t), rr * Math.sin(P * t), r * Math.sin(Q * t)];
    };
    for (let i = 0; i < n; i++) {
      const k = Math.floor(i / AROUND);
      const j = i % AROUND;
      const t = (k / K) * Math.PI * 2;
      const c0 = C(t), c1 = C(t + 1e-3);
      let tx = c1[0] - c0[0], ty = c1[1] - c0[1], tz = c1[2] - c0[2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      // N = normalize(cross(T, up))
      let nx = ty * 0 - tz * 1, ny = tz * 0 - tx * 0, nz = tx * 1 - ty * 0;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      // B = cross(T, N)
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      const a = (j / AROUND) * Math.PI * 2 + seed[i] * 0.15;
      const ca = Math.cos(a) * tube, sa = Math.sin(a) * tube;
      knot[i * 3] = c0[0] + ca * nx + sa * bx;
      knot[i * 3 + 1] = c0[1] + ca * ny + sa * by;
      knot[i * 3 + 2] = c0[2] + ca * nz + sa * bz;
    }
  }

  /* T5 slab (box surface, 8% on edges) */
  const slab = new Float32Array(n * 3);
  {
    const sx = 1.6, sy = 3.4, sz = 0.4;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy]; // ±x, ±y, ±z
    const total = areas.reduce((a, b) => a + b, 0);
    const cum = areas.map(((s) => (v) => (s += v))(0)).map((v) => v / total);
    for (let i = 0; i < n; i++) {
      let px = 0, py = 0, pz = 0;
      if (i % 12 === 0) {
        // random point on one of the 12 edges
        const e = Math.floor(rand() * 12);
        const t = rand() * 2 - 1;
        const sgnA = e & 1 ? 1 : -1, sgnB = e & 2 ? 1 : -1;
        const axis = e >> 2; // 0: edges along x, 1: along y, 2: along z
        if (axis === 0) { px = t * hx; py = sgnA * hy; pz = sgnB * hz; }
        else if (axis === 1) { px = sgnA * hx; py = t * hy; pz = sgnB * hz; }
        else { px = sgnA * hx; py = sgnB * hy; pz = t * hz; }
      } else {
        const u = rand();
        let f = 0;
        while (f < 5 && u > cum[f]) f++;
        const a = rand() * 2 - 1, b = rand() * 2 - 1;
        switch (f) {
          case 0: px = -hx; py = a * hy; pz = b * hz; break;
          case 1: px = hx; py = a * hy; pz = b * hz; break;
          case 2: px = a * hx; py = -hy; pz = b * hz; break;
          case 3: px = a * hx; py = hy; pz = b * hz; break;
          case 4: px = a * hx; py = b * hy; pz = -hz; break;
          default: px = a * hx; py = b * hy; pz = hz; break;
        }
      }
      slab[i * 3] = px; slab[i * 3 + 1] = py + 0.2; slab[i * 3 + 2] = pz;
    }
  }

  /* T6 ring (torus, tilted 18° towards camera) */
  const ring = new Float32Array(n * 3);
  {
    const Rr = 2.6, rr = 0.12;
    const tilt = (18 * Math.PI) / 180;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let i = 0; i < n; i++) {
      const u = Math.PI * 2 * ((i * 0.618034) % 1);
      const v = rand() * Math.PI * 2;
      const x = (Rr + rr * Math.cos(v)) * Math.cos(u);
      const y = rr * Math.sin(v);
      const z = (Rr + rr * Math.cos(v)) * Math.sin(u);
      ring[i * 3] = x;
      ring[i * 3 + 1] = y * ct - z * st;
      ring[i * 3 + 2] = y * st + z * ct;
    }
  }

  /* line indices */
  const lat: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (edgeMask[i] && (i % opts.latticeThin === 0 || S <= 16)) lat.push(i, i + 1);
  }
  const kn: number[] = [];
  for (let i = 0; i + opts.around < n; i++) {
    if (i % opts.knotThin === 0) kn.push(i, i + opts.around);
  }

  return {
    n, cloud, sphere, lattice, grid, knot, slab, ring, seed, cluster, gal,
    idxLattice: new Uint32Array(lat),
    idxKnot: new Uint32Array(kn),
  };
}
