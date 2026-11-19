/** Shared world data: rendering, collision, bridges, atlas and export use one surface. */
export const TERRAIN_HALF = 185;
export const TERRAIN_SEGMENTS = 192;
export const SEA_LEVEL = 0;
export const RIVER_LEVEL = 1.4;
export type Point = { x: number; z: number };
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(x: number, z: number) { const n = Math.sin(x * 127.1 + z * 311.7 + 84.7) * 43758.5453; return n - Math.floor(n); }
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) + (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
}
export function fractal(x: number, z: number) {
  return noise(x * .022, z * .022) * .57 + noise(x * .052, z * .052) * .27 + noise(x * .12, z * .12) * .11 + noise(x * .28, z * .28) * .05;
}
export function riverX(z: number) { return 43 + Math.sin(z * .024) * 12 + Math.sin(z * .053 + 1) * 4; }
export const lakeDistance = (x: number, z: number) => Math.hypot((x + 88) / 24, (z - 41) / 18);
export function coastRadius(x: number, z: number) {
  const angle = Math.atan2(z, x);
  return Math.hypot(x, z) + Math.sin(angle * 3 + 1.2) * 7 + Math.sin(angle * 7 - .4) * 4;
}
const pads = [
  { x: 0, z: -69, radius: 32, y: 9 }, { x: -67, z: -88, radius: 28, y: 7.5 },
  { x: 77, z: -85, radius: 22, y: 9 }, { x: -110, z: 92, radius: 23, y: 6 },
  { x: 0, z: 85, radius: 48, y: 5.5 }, { x: 72, z: 30, radius: 35, y: 5.5 },
  { x: 117, z: 104, radius: 23, y: 3.6 }, { x: -93, z: -23, radius: 19, y: 7 },
  { x: 0, z: 0, radius: 20, y: 6 },
];
function rawHeight(x: number, z: number) {
  const f = fractal(x, z);
  let y = 5.8 + (f - .5) * 9;
  for (const [px, pz, h, rx, rz] of [[-115, -126, 60, 41, 38], [108, -140, 69, 43, 35], [-147, 23, 30, 28, 43], [133, 55, 18, 30, 34]]) {
    const d = ((x - px) / rx) ** 2 + ((z - pz) / rz) ** 2;
    y += h * Math.exp(-d * 1.6) * (.6 + f * .65);
  }
  for (const pad of pads) {
    const blend = 1 - smooth(pad.radius, pad.radius + 15, Math.hypot(x - pad.x, z - pad.z));
    y = y * (1 - blend) + pad.y * blend;
  }
  const lake = lakeDistance(x, z);
  y = y * smooth(.85, 1.3, lake) + 1.5 * (1 - smooth(.85, 1.3, lake));
  const channel = 1 - smooth(5.7, 11.5, Math.abs(x - riverX(z)));
  const riverEnd = smooth(-145, -113, z);
  y = y * (1 - channel * riverEnd) + (.2 + noise(x * .15, z * .15) * .4) * channel * riverEnd;
  const coast = smooth(151, 184, coastRadius(x, z));
  return y * (1 - coast) - 5.5 * coast;
}
export const TERRAIN_GRID = new Float32Array((TERRAIN_SEGMENTS + 1) ** 2);
for (let iz = 0; iz <= TERRAIN_SEGMENTS; iz++) for (let ix = 0; ix <= TERRAIN_SEGMENTS; ix++) {
  TERRAIN_GRID[iz * (TERRAIN_SEGMENTS + 1) + ix] = rawHeight(-185 + ix * 370 / TERRAIN_SEGMENTS, -185 + iz * 370 / TERRAIN_SEGMENTS);
}
/** Exact barycentric interpolation of the same diagonals used by PlaneGeometry. */
export function terrainHeight(x: number, z: number) {
  const gx = clamp((x + 185) / 370 * TERRAIN_SEGMENTS, 0, TERRAIN_SEGMENTS - .000001);
  const gz = clamp((z + 185) / 370 * TERRAIN_SEGMENTS, 0, TERRAIN_SEGMENTS - .000001);
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, stride = TERRAIN_SEGMENTS + 1;
  const a = TERRAIN_GRID[iz * stride + ix], b = TERRAIN_GRID[iz * stride + ix + 1];
  const c = TERRAIN_GRID[(iz + 1) * stride + ix], d = TERRAIN_GRID[(iz + 1) * stride + ix + 1];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
export function terrainSlope(x: number, z: number) {
  return Math.hypot(terrainHeight(x + 1, z) - terrainHeight(x - 1, z), terrainHeight(x, z + 1) - terrainHeight(x, z - 1)) / 2;
}
export const ROAD_ROUTES: { name: string; width: number; points: Point[] }[] = [
  { name: 'طريق القلعة', width: 4.5, points: [{ x: 0, z: 9 }, { x: -5, z: -20 }, { x: 2, z: -43 }, { x: 0, z: -69 }] },
  { name: 'درب الغابة', width: 3.5, points: [{ x: -5, z: -20 }, { x: -44, z: -8 }, { x: -75, z: -17 }, { x: -93, z: -23 }] },
  { name: 'درب الحراس', width: 3.5, points: [{ x: 0, z: -43 }, { x: -29, z: -56 }, { x: -47, z: -74 }, { x: -65, z: -87 }] },
  { name: 'طريق المنجم', width: 3.5, points: [{ x: 2, z: -43 }, { x: 32, z: -49 }, { x: 57, z: -65 }, { x: 77, z: -85 }] },
  { name: 'طريق القرية', width: 4.5, points: [{ x: 0, z: 9 }, { x: -8, z: 32 }, { x: -3, z: 57 }, { x: 5, z: 76 }] },
  { name: 'طريق المزارع', width: 3.6, points: [{ x: 0, z: 9 }, { x: 22, z: 17 }, { x: 47, z: 21 }, { x: 69, z: 31 }] },
  { name: 'طريق الميناء', width: 3.6, points: [{ x: 5, z: 76 }, { x: 41, z: 86 }, { x: 82, z: 94 }, { x: 117, z: 104 }] },
  { name: 'درب الأبطال', width: 3.2, points: [{ x: 5, z: 76 }, { x: -39, z: 105 }, { x: -77, z: 110 }, { x: -110, z: 92 }] },
];
function cubic(a: number, b: number, c: number, d: number, t: number) { return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); }
export const ROAD_SAMPLES = ROAD_ROUTES.map(route => {
  const result: Point[] = [];
  for (let i = 0; i < route.points.length - 1; i++) for (let step = 0; step <= 28; step++) {
    const a = route.points[Math.max(0, i - 1)], b = route.points[i], c = route.points[i + 1], d = route.points[Math.min(route.points.length - 1, i + 2)], t = step / 28;
    result.push({ x: cubic(a.x, b.x, c.x, d.x, t), z: cubic(a.z, b.z, c.z, d.z, t) });
  }
  return result;
});
export function roadDistance(x: number, z: number) {
  let best = Infinity;
  for (const points of ROAD_SAMPLES) for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / Math.max(.0001, dx * dx + dz * dz));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}
export function waterLevel(x: number, z: number) {
  if (lakeDistance(x, z) < 1.06) return 3.05;
  if (z > -122 && Math.abs(x - riverX(z)) < 6.7) return RIVER_LEVEL;
  return SEA_LEVEL;
}
export function bridgeAt(x: number, z: number) {
  return z > -113 && Math.abs(x - riverX(z)) < 13 && roadDistance(x, z) < 3.5;
}
export function walkHeight(x: number, z: number) { return bridgeAt(x, z) ? Math.max(terrainHeight(x, z), 5.8) : terrainHeight(x, z); }
export function canTraverse(x: number, z: number, fromX: number, fromZ: number) {
  const h = walkHeight(x, z), previous = walkHeight(fromX, fromZ);
  if (h < waterLevel(x, z) + .35) return false;
  return Math.abs(h - previous) <= Math.max(.85, Math.hypot(x - fromX, z - fromZ) * 1.15);
}
export function safeSpawn(x: number, z: number): Point {
  if (walkHeight(x, z) > waterLevel(x, z) + .5 && terrainSlope(x, z) < 1.2) return { x, z };
  return { x: 0, z: 9 };
}
export function biomeColor(x: number, z: number): [number, number, number] {
  const h = terrainHeight(x, z), slope = terrainSlope(x, z), n = fractal(x, z);
  if (h < waterLevel(x, z)) return [38, 105, 115];
  if (coastRadius(x, z) > 148 || h < 2.7) return [184 + n * 32, 170 + n * 28, 129 + n * 24];
  const rock = smooth(.35, .95, slope) * .8 + smooth(25, 58, h) * .7;
  const g = [76 + n * 41, 104 + n * 41, 49 + n * 34], r = [126 + n * 20, 125 + n * 18, 112 + n * 18];
  return g.map((v, i) => v * (1 - clamp(rock)) + r[i] * clamp(rock)) as [number, number, number];
}
