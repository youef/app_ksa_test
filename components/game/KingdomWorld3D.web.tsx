import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type AvatarKey = 'knight' | 'ranger' | 'warrior' | 'desert' | 'captain' | 'mage';
export type GameSite = 'castle' | 'forest' | 'farm' | 'barracks' | 'harbor' | 'mine' | 'arena' | 'village';
export type WorldPosition = { x: number; z: number; site: GameSite | null; siteName: string; distance: number };

export const AVATARS: { key: AvatarKey; name: string; title: string; color: string; emoji: string }[] = [
  { key: 'knight', name: 'الفارس', title: 'درع فولاذي وسيف', color: '#3D72B6', emoji: '🛡️' },
  { key: 'ranger', name: 'الصيّاد', title: 'حارس الغابات', color: '#3A8659', emoji: '🏹' },
  { key: 'warrior', name: 'المحارب', title: 'قائد المعارك', color: '#A84F37', emoji: '⚔️' },
  { key: 'desert', name: 'الرحّال', title: 'مستكشف الصحراء', color: '#C18C44', emoji: '🏜️' },
  { key: 'captain', name: 'القبطان', title: 'سيّد الأساطيل', color: '#177C92', emoji: '⚓' },
  { key: 'mage', name: 'الساحر', title: 'حارس الأسرار', color: '#8553AE', emoji: '🔮' },
];
export const SITES: { key: GameSite; name: string; x: number; z: number; action: 'collect' | 'recruit' | 'fortify' | 'upgrade' | 'pirates'; emoji: string }[] = [
  { key: 'castle', name: 'القلعة الملكية', x: 0, z: -69, action: 'upgrade', emoji: '🏰' },
  { key: 'forest', name: 'الغابة الخضراء', x: -93, z: -23, action: 'collect', emoji: '🌲' },
  { key: 'farm', name: 'مزارع المملكة', x: 69, z: 31, action: 'collect', emoji: '🌾' },
  { key: 'barracks', name: 'ثكنة المحاربين', x: -65, z: -87, action: 'recruit', emoji: '⚔️' },
  { key: 'harbor', name: 'ميناء الأساطيل', x: 117, z: 104, action: 'pirates', emoji: '⚓' },
  { key: 'mine', name: 'مناجم الذهب', x: 77, z: -85, action: 'collect', emoji: '⛏️' },
  { key: 'arena', name: 'ساحة الأبطال', x: -110, z: 92, action: 'fortify', emoji: '🛡️' },
  { key: 'village', name: 'القرية القديمة', x: 5, z: 76, action: 'collect', emoji: '🏡' },
];
export const WORLD_HALF = 185;

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let n = t;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function height(x: number, z: number) {
  const radius = Math.max(Math.abs(x), Math.abs(z));
  const coast = THREE.MathUtils.smoothstep(radius, 145, WORLD_HALF);
  const rolling = Math.sin(x * .037) * .85 + Math.cos(z * .031) * .7 + Math.sin((x + z) * .049) * .35;
  return 2.8 + rolling * (1 - coast) - coast * 7;
}
function surfaceMaterial(color: number | string, roughness = .88) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
function box(parent: THREE.Object3D, color: number | string, w: number, h: number, d: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surfaceMaterial(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function sphere(parent: THREE.Object3D, color: number | string, radius: number, x: number, y: number, z: number, width = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, width, 8), surfaceMaterial(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function cone(parent: THREE.Object3D, color: number | string, radius: number, h: number, x: number, y: number, z: number, segments = 6) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(radius, h, segments), surfaceMaterial(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function labelSprite(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 448; canvas.height = 110;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(7,42,41,.89)';
    ctx.beginPath(); ctx.roundRect(8, 8, 432, 94, 26); ctx.fill();
    ctx.strokeStyle = '#E5CD84'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.direction = 'rtl'; ctx.font = 'bold 42px system-ui, sans-serif'; ctx.fillText(text, 224, 56);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true }));
  sprite.scale.set(12, 2.95, 1);
  return sprite;
}
function buildAvatar(key: AvatarKey) {
  const profile = AVATARS.find(a => a.key === key) || AVATARS[0];
  const group = new THREE.Group();
  const costume = surfaceMaterial(profile.color, .7);
  const skin = surfaceMaterial(key === 'desert' ? '#B6815D' : '#E1B28D');
  const dark = surfaceMaterial('#202F32');
  const body = new THREE.Group();
  group.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.49, .76, 5, 10), costume);
  torso.position.y = 1.42; torso.castShadow = true; body.add(torso);
  const belt = box(body, '#45372F', 1.01, .15, .65, 0, 1.11, 0);
  belt.castShadow = true;
  sphere(body, '#EAB987', .38, 0, 2.2, 0, 14).material = skin;
  const hair = sphere(body, key === 'ranger' ? '#654A32' : '#2A2A29', .38, 0, 2.43, -.045);
  hair.scale.set(1.07, .48, 1.03);
  sphere(body, '#17252C', .046, -.15, 2.26, .36, 8);
  sphere(body, '#17252C', .046, .15, 2.26, .36, 8);
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.position.set(-.64, 1.81, 0); rightArm.position.set(.64, 1.81, 0);
  body.add(leftArm, rightArm);
  box(leftArm, profile.color, .28, .72, .32, 0, -.39, 0);
  box(rightArm, profile.color, .28, .72, .32, 0, -.39, 0);
  sphere(leftArm, '#E1B28D', .16, 0, -.78, 0);
  sphere(rightArm, '#E1B28D', .16, 0, -.78, 0);
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.position.set(-.24, .95, 0); rightLeg.position.set(.24, .95, 0);
  group.add(leftLeg, rightLeg);
  box(leftLeg, '#34465B', .34, .85, .35, 0, -.43, 0);
  box(rightLeg, '#34465B', .34, .85, .35, 0, -.43, 0);
  box(leftLeg, '#3E342C', .39, .22, .52, 0, -.87, .08);
  box(rightLeg, '#3E342C', .39, .22, .52, 0, -.87, .08);
  if (key === 'knight' || key === 'warrior') {
    cone(body, key === 'knight' ? '#C8D4DA' : '#49494D', .46, .43, 0, 2.63, 0, 9);
    box(leftArm, '#C6D1D5', .37, .24, .47, 0, -.07, 0);
    box(rightArm, '#C6D1D5', .37, .24, .47, 0, -.07, 0);
    box(rightArm, '#C9C6AB', .11, .92, .1, .12, -.92, .23);
  }
  if (key === 'ranger') {
    cone(body, '#2F5C3C', .57, .47, 0, 2.68, -.1, 8);
    box(body, '#5B3C27', .19, .9, .18, -.45, 1.48, -.3).rotation.z = -.2;
  }
  if (key === 'desert') {
    cone(body, '#E9DBB7', .49, .33, 0, 2.63, 0, 10);
    box(body, '#F2E5C8', 1.12, .34, .12, 0, 1.9, -.35);
    box(body, '#D9B16E', 1.2, .65, .1, 0, 1.38, -.42);
  }
  if (key === 'captain') {
    box(body, '#152F49', 1.08, .21, .72, 0, 2.62, 0);
    box(body, '#D7B05E', .17, .24, .13, .1, 1.42, .48);
    box(body, '#FFF6DE', .1, .6, .12, 0, 1.55, .48);
  }
  if (key === 'mage') {
    cone(body, '#4B3482', .65, .92, 0, 2.92, 0, 9);
    sphere(rightArm, '#82DCEF', .18, .17, -.93, .16);
    box(body, '#563A82', 1.28, .9, .15, 0, 1.2, -.44);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.77, 20), new THREE.MeshBasicMaterial({ color: '#00221A', transparent: true, opacity: .19, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .025;
  group.add(shadow);
  return { group, body, leftArm, rightArm, leftLeg, rightLeg };
}
function siteAt(x: number, z: number): WorldPosition {
  let nearest = SITES[0], distance = Infinity;
  for (const p of SITES) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < distance) { distance = d; nearest = p; }
  }
  return { x, z, site: distance < 16 ? nearest.key : null, siteName: nearest.name, distance };
}
function addHouse(scene: THREE.Scene, x: number, z: number, roof = '#BB694C', scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, height(x, z), z);
  group.scale.setScalar(scale);
  scene.add(group);
  box(group, '#F0D1A3', 8, 5, 7, 0, 2.5, 0);
  const roofMesh = cone(group, roof, 6.6, 4.3, 0, 7.5, 0, 4);
  roofMesh.rotation.y = Math.PI / 4;
  box(group, '#5E4B39', 1.9, 2.9, .3, 0, 1.5, 3.58);
  box(group, '#86AAB2', 1.5, 1.5, .25, -2.25, 3.4, 3.6);
  box(group, '#86AAB2', 1.5, 1.5, .25, 2.25, 3.4, 3.6);
}
function addTower(parent: THREE.Group, x: number, z: number) {
  box(parent, '#D7C49D', 5, 11, 5, x, 5.5, z);
  box(parent, '#F3DEB0', 6, 1.5, 6, x, 11, z);
  cone(parent, '#67918A', 4.6, 5.5, x, 14.5, z, 4).rotation.y = Math.PI / 4;
}
function castle(scene: THREE.Scene, x: number, z: number) {
  const c = new THREE.Group(); c.position.set(x, height(x, z), z); scene.add(c);
  box(c, '#E6D3AE', 25, 10, 21, 0, 5, 0);
  box(c, '#C3AF8C', 29, 7, 4, 0, 3.5, 13);
  box(c, '#C3AF8C', 29, 7, 4, 0, 3.5, -13);
  box(c, '#C3AF8C', 4, 7, 23, -15, 3.5, 0);
  box(c, '#C3AF8C', 4, 7, 23, 15, 3.5, 0);
  addTower(c, -15, -13); addTower(c, 15, -13); addTower(c, -15, 13); addTower(c, 15, 13);
  addTower(c, 0, 0);
  box(c, '#63513D', 5.5, 7, .5, 0, 3.5, 15.2);
  box(c, '#5C897A', .3, 7, .3, 0, 19, 0);
  box(c, '#E9BF56', 5, 3, .15, 2.4, 17.3, 0);
}
function makeRoad(scene: THREE.Scene, a: { x: number; z: number }, b: { x: number; z: number }, width = 5) {
  const x = b.x - a.x, z = b.z - a.z;
  const len = Math.hypot(x, z);
  const alongX = x / len, alongZ = z / len;
  const acrossX = -alongZ, acrossZ = alongX;
  const vertices: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = i / 20, t1 = (i + 1) / 20;
    const v = (t: number, side: number) => {
      const px = a.x + x * t + acrossX * side * width / 2;
      const pz = a.z + z * t + acrossZ * side * width / 2;
      return [px, height(px, pz) + .085, pz];
    };
    const p1 = v(t0, -1), p2 = v(t0, 1), p3 = v(t1, -1), p4 = v(t1, 1);
    vertices.push(...p1, ...p2, ...p3, ...p3, ...p2, ...p4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#D5BC87', side: THREE.DoubleSide, roughness: 1 }));
  scene.add(road);
}
function generateWorld(scene: THREE.Scene, detail: boolean) {
  const random = rng(72419);
  scene.background = new THREE.Color('#9ED8E7');
  scene.fog = new THREE.Fog('#ABD7CE', 125, 350);
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#59795B', 2.25));
  const sun = new THREE.DirectionalLight('#FFF5D4', 2.3);
  sun.position.set(-90, 145, -120); scene.add(sun);
  const ground = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, 70, 70);
  ground.rotateX(-Math.PI / 2);
  const positions = ground.getAttribute('position');
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), y = height(x, z);
    positions.setY(i, y);
    const coast = Math.max(Math.abs(x), Math.abs(z));
    if (coast > 145) color.set('#E4D0A3');
    else if (y > 4) color.set('#7DA66F');
    else color.set('#79B77A');
    color.offsetHSL((random() - .5) * .035, 0, (random() - .5) * .07);
    colors.push(color.r, color.g, color.b);
  }
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const land = new THREE.Mesh(ground, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  land.receiveShadow = true;
  scene.add(land);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1300, 1300), new THREE.MeshPhongMaterial({ color: '#339EBD', shininess: 75, transparent: true, opacity: .84 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -.55; scene.add(sea);
  const roads = [ { x: 0, z: 0 }, { x: 0, z: -69 }, { x: -65, z: -87 }, { x: 77, z: -85 },
    { x: -93, z: -23 }, { x: 69, z: 31 }, { x: 117, z: 104 }, { x: -110, z: 92 }, { x: 5, z: 76 } ];
  for (let i = 1; i < roads.length; i++) makeRoad(scene, roads[0], roads[i], i > 6 ? 4.2 : 5.2);
  castle(scene, 0, -69);
  for (const [x, z, color] of [
    [12, 78, '#B06F49'], [-12, 79, '#B57348'], [25, 66, '#648B87'], [-27, 64, '#A86C51'],
    [9, 100, '#C0805C'], [-18, 103, '#698B91'], [62, 31, '#C2A146'], [83, 37, '#BF8551'],
    [-62, -87, '#8A6467'], [81, -86, '#A37E53'], [123, 98, '#5D90A5'],
  ] as Array<[number, number, string]>) addHouse(scene, x, z, color);
  for (let i = 0; i < 32; i++) {
    const x = 35 + random() * 65, z = 8 + random() * 58;
    const crop = new THREE.Group();
    crop.position.set(x, height(x, z), z); scene.add(crop);
    sphere(crop, random() > .5 ? '#D2CC4A' : '#4A9B47', .7, 0, 1, 0, 6);
    box(crop, '#397E43', .12, 1, .12, 0, .48, 0);
  }
  const platform = new THREE.Group();
  platform.position.set(-110, height(-110, 92), 92); scene.add(platform);
  const arenaFloor = new THREE.Mesh(new THREE.CylinderGeometry(19, 20, 1.2, 12), surfaceMaterial('#D4B98D'));
  arenaFloor.position.y = .6; platform.add(arenaFloor);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10;
    box(platform, '#B5A487', 2.1, 6, 2.1, Math.sin(a) * 17, 3, Math.cos(a) * 17);
  }
  const mine = new THREE.Group();
  mine.position.set(77, height(77, -85), -85); scene.add(mine);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(11, 1), surfaceMaterial('#8E938C'));
  rock.scale.set(1.3, .8, 1); rock.position.y = 6; mine.add(rock);
  for (let i = 0; i < 7; i++) sphere(mine, '#E2BE56', 1.2, (random() - .5) * 18, .9, (random() - .5) * 15, 7);
  const dock = new THREE.Group(); dock.position.set(117, height(117, 104), 104); scene.add(dock);
  for (let i = 0; i < 6; i++) box(dock, '#75533B', 2, .45, 13, i * 2.2 - 5, .8, 4);
  box(dock, '#8C6142', 15, .8, 5, 0, 1.2, 13);
  const ship = new THREE.Group();
  ship.position.set(137, .2, 131); scene.add(ship);
  const hull = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 4), surfaceMaterial('#6B4632'));
  hull.rotation.x = Math.PI / 2; hull.scale.set(.8, .6, .6); ship.add(hull);
  box(ship, '#9A7955', .36, 12, .36, 0, 5.8, 0);
  const sail = box(ship, '#FFF0CE', 9.7, 8, .25, 0, 7, 0); sail.rotation.y = .22;
  const trunkGeo = new THREE.CylinderGeometry(.42, .7, 5, 5);
  const leafGeo = new THREE.ConeGeometry(3.4, 7.8, 7);
  const treeCount = detail ? 370 : 200;
  const trunkMat = surfaceMaterial('#825D3B');
  const leafMat = surfaceMaterial('#3B8558');
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeCount);
  const dummy = new THREE.Object3D();
  const leafColor = new THREE.Color();
  let accepted = 0, attempts = 0;
  while (accepted < treeCount && attempts < treeCount * 20) {
    attempts++;
    const x = (random() - .5) * 325, z = (random() - .5) * 325;
    if (Math.hypot(x, z) < 25) continue;
    if (SITES.some(site => Math.hypot(x - site.x, z - site.z) < 22)) continue;
    const nearRoad = roads.some(pt => {
      const abx = pt.x, abz = pt.z;
      const t = THREE.MathUtils.clamp((x * abx + z * abz) / (abx * abx + abz * abz || 1), 0, 1);
      return Math.hypot(x - abx * t, z - abz * t) < 5;
    });
    if (nearRoad) continue;
    const scale = .55 + random() * 1.45;
    const y = height(x, z);
    dummy.position.set(x, y + 2.5 * scale, z);
    dummy.scale.set(scale, scale, scale); dummy.rotation.y = random() * Math.PI * 2;
    dummy.updateMatrix(); trunks.setMatrixAt(accepted, dummy.matrix);
    dummy.position.y = y + 6.8 * scale;
    dummy.updateMatrix(); leaves.setMatrixAt(accepted, dummy.matrix);
    leafColor.setHSL(.29 + random() * .095, .35 + random() * .22, .31 + random() * .13);
    leaves.setColorAt(accepted, leafColor);
    accepted++;
  }
  trunks.count = accepted; leaves.count = accepted;
  trunks.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true;
  scene.add(trunks, leaves);
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), surfaceMaterial('#9F9E91'), detail ? 115 : 60);
  const stoneCount = stones.count;
  for (let i = 0; i < stoneCount; i++) {
    const x = (random() - .5) * 305, z = (random() - .5) * 305;
    const s = .5 + random() * 1.85;
    dummy.position.set(x, height(x, z) + s * .38, z);
    dummy.scale.set(s, s * .7, s);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
  }
  stones.instanceMatrix.needsUpdate = true; scene.add(stones);
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 18; i++) {
    const cl = new THREE.Group();
    cl.position.set((random() - .5) * 320, 58 + random() * 28, (random() - .5) * 300);
    sphere(cl, '#FFFFFF', 7 + random() * 4, 0, 0, 0, 10);
    sphere(cl, '#FFFFFF', 6, 7, -1, 0, 9);
    sphere(cl, '#F0F9FC', 5, -7, -2, 0, 9);
    cl.scale.setScalar(.65 + random() * .55);
    scene.add(cl); clouds.push(cl);
  }
  const markers: THREE.Object3D[] = [];
  for (const site of SITES) {
    const marker = new THREE.Group();
    marker.position.set(site.x, height(site.x, site.z) + .1, site.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, .45, 6, 32), new THREE.MeshBasicMaterial({ color: '#FFE49A', transparent: true, opacity: .9 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .42; marker.add(ring);
    const sprite = labelSprite(site.emoji + ' ' + site.name);
    sprite.position.y = 12;
    marker.add(sprite);
    scene.add(marker); markers.push(marker);
  }
  return { clouds, markers };
}
type Props = {
  avatarKey: AvatarKey;
  paused?: boolean;
  initialX?: number;
  initialZ?: number;
  onPosition: (position: WorldPosition) => void;
  onError?: (message: string) => void;
  onRemember?: (x: number, z: number) => void;
};
export default function KingdomWorld3D({ avatarKey, paused, initialX = 0, initialZ = 6, onPosition, onError, onRemember }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const onPositionRef = useRef(onPosition);
  const onErrorRef = useRef(onError);
  const onRememberRef = useRef(onRemember);
  const pausedRef = useRef(paused);
  const [stick, setStick] = useState({ x: 0, y: 0, active: false });
  const control = useRef({ x: 0, y: 0, sprint: false, jump: false });
  useEffect(() => { onPositionRef.current = onPosition; }, [onPosition]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onRememberRef.current = onRemember; }, [onRemember]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    const host = holder.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const clock = new THREE.Clock();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      onErrorRef.current?.('جهازك لا يدعم WebGL لتشغيل العالم ثلاثي الأبعاد في هذا المتصفح');
      return;
    }
    const mobile = window.innerWidth < 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(57, 1, .15, 600);
    const { clouds, markers } = generateWorld(scene, !mobile);
    const avatar = buildAvatar(avatarKey);
    scene.add(avatar.group);
    let px = THREE.MathUtils.clamp(initialX, -150, 150);
    let pz = THREE.MathUtils.clamp(initialZ, -150, 150);
    const keyboard = new Set<string>();
    let yaw = 0, pitch = .64, distance = mobile ? 15 : 19;
    let cameraDrag: { id: number; x: number; y: number } | null = null;
    let lastNotify = 0, lastSave = 0, jump = 0, jumpSpeed = 0, walkClock = 0;
    const cameraGoal = new THREE.Vector3();
    camera.position.set(px, 12, pz + distance);
    const setSize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    setSize();
    const observer = new ResizeObserver(setSize);
    observer.observe(host);
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const code = event.code.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright','space'].includes(code)) event.preventDefault();
      keyboard.add(code);
      if (code === 'space' && jump < .05) jumpSpeed = 8.7;
    };
    const onKeyUp = (event: KeyboardEvent) => keyboard.delete(event.code.toLowerCase());
    const onBlur = () => keyboard.clear();
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cameraDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!cameraDrag || cameraDrag.id !== e.pointerId) return;
      const dx = e.clientX - cameraDrag.x, dy = e.clientY - cameraDrag.y;
      yaw -= dx * .006;
      pitch = THREE.MathUtils.clamp(pitch - dy * .004, .30, 1.15);
      cameraDrag.x = e.clientX; cameraDrag.y = e.clientY;
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (cameraDrag?.id === e.pointerId) cameraDrag = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      distance = THREE.MathUtils.clamp(distance + Math.sign(e.deltaY) * 1.5, 9, 29);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerEnd);
    renderer.domElement.addEventListener('pointercancel', onPointerEnd);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.setAnimationLoop(() => {
      if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), .055);
      const time = clock.elapsedTime;
      const disabled = pausedRef.current;
      const strafe = disabled ? 0 : (Number(keyboard.has('keyd') || keyboard.has('arrowright'))
        - Number(keyboard.has('keya') || keyboard.has('arrowleft')) + control.current.x);
      const forward = disabled ? 0 : (Number(keyboard.has('keyw') || keyboard.has('arrowup'))
        - Number(keyboard.has('keys') || keyboard.has('arrowdown')) - control.current.y);
      const length = Math.hypot(strafe, forward);
      const moving = length > .08;
      if (moving) {
        const speed = (keyboard.has('shiftleft') || keyboard.has('shiftright') || control.current.sprint) ? 22 : 12.8;
        const f = forward / Math.max(1, length);
        const r = strafe / Math.max(1, length);
        const dx = (Math.cos(yaw) * r - Math.sin(yaw) * f);
        const dz = (-Math.sin(yaw) * r - Math.cos(yaw) * f);
        const nx = THREE.MathUtils.clamp(px + dx * speed * dt, -WORLD_HALF + 11, WORLD_HALF - 11);
        const nz = THREE.MathUtils.clamp(pz + dz * speed * dt, -WORLD_HALF + 11, WORLD_HALF - 11);
        px = nx; pz = nz;
        avatar.group.rotation.y = THREE.MathUtils.lerp(avatar.group.rotation.y, Math.atan2(dx, dz) + Math.PI, Math.min(1, dt * 12));
        walkClock += dt * (speed > 15 ? 12 : 8.6);
      }
      if (!disabled && control.current.jump && jump <= .01) {
        jumpSpeed = 8.7; control.current.jump = false;
      }
      if (jumpSpeed || jump) {
        jump += jumpSpeed * dt;
        jumpSpeed -= 20 * dt;
        if (jump < 0) { jump = 0; jumpSpeed = 0; }
      }
      avatar.group.position.set(px, height(px, pz) + jump, pz);
      const swing = moving ? Math.sin(walkClock) * .67 : 0;
      avatar.leftLeg.rotation.x = swing;
      avatar.rightLeg.rotation.x = -swing;
      avatar.leftArm.rotation.x = -swing * .65;
      avatar.rightArm.rotation.x = swing * .65;
      avatar.body.position.y = moving ? Math.abs(Math.sin(walkClock)) * .07 : Math.sin(time * 1.7) * .025;
      const horizontal = Math.cos(pitch) * distance;
      cameraGoal.set(px + Math.sin(yaw) * horizontal, height(px, pz) + 2.7 + Math.sin(pitch) * distance, pz + Math.cos(yaw) * horizontal);
      camera.position.lerp(cameraGoal, Math.min(1, dt * 5));
      camera.lookAt(px, height(px, pz) + 1.85, pz);
      for (let i = 0; i < markers.length; i++) {
        markers[i].position.y = height(SITES[i].x, SITES[i].z) + Math.sin(time * 2 + i) * .19;
      }
      for (let i = 0; i < clouds.length; i++) clouds[i].position.x += dt * (.30 + i % 5 * .1);
      if (time * 1000 - lastNotify > 275) {
        onPositionRef.current(siteAt(px, pz));
        lastNotify = time * 1000;
      }
      if (time * 1000 - lastSave > 1900) {
        onRememberRef.current?.(px, pz);
        lastSave = time * 1000;
      }
      renderer.render(scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerEnd);
      renderer.domElement.removeEventListener('pointercancel', onPointerEnd);
      renderer.domElement.removeEventListener('wheel', onWheel);
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
            material.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [avatarKey, initialX, initialZ]);
  const startStick = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateStick(e);
  };
  const updateStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointermove' && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = THREE.MathUtils.clamp((e.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * .36), -1, 1);
    const y = THREE.MathUtils.clamp((e.clientY - (bounds.top + bounds.height / 2)) / (bounds.height * .36), -1, 1);
    control.current.x = x; control.current.y = y;
    setStick({ x, y, active: true });
  };
  const endStick = () => {
    control.current.x = 0; control.current.y = 0;
    setStick({ x: 0, y: 0, active: false });
  };
  return <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', touchAction: 'none', backgroundColor: '#9FD8DC' }}>
    <div ref={holder} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} role="img" aria-label="عالم ممالك حيّنا ثلاثي الأبعاد، حرّك الشخصية باستخدام العصا أو الأسهم أو WASD" />
    <div aria-label="عصا الحركة" role="group"
      onPointerDown={startStick} onPointerMove={updateStick} onPointerUp={endStick} onPointerCancel={endStick}
      style={{ position: 'absolute', bottom: 'max(30px, env(safe-area-inset-bottom))', left: 22, width: 116, height: 116, border: '2px solid rgba(255,255,255,.5)',
        borderRadius: '50%', background: 'rgba(5,49,52,.31)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        touchAction: 'none', userSelect: 'none', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', background: stick.active ? '#DFF6D8' : 'rgba(255,255,255,.84)',
        boxShadow: '0 3px 15px rgba(6,47,38,.32)', transform: 'translate(' + (stick.x * 34) + 'px,' + (stick.y * 34) + 'px)',
        transition: stick.active ? 'none' : 'transform .12s' }} />
    </div>
    <div style={{ position: 'absolute', bottom: 'max(39px, env(safe-area-inset-bottom))', right: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button type="button" aria-label="الركض" onPointerDown={e => { e.preventDefault(); control.current.sprint = true; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerUp={() => { control.current.sprint = false; }} onPointerCancel={() => { control.current.sprint = false; }}
        style={{ width: 57, height: 57, borderRadius: 18, border: '1px solid rgba(255,255,255,.7)', background: 'rgba(6,67,62,.83)', color: '#FFFFFF', fontSize: 12, fontWeight: 800, touchAction: 'none' }}>🏃 ركض</button>
      <button type="button" aria-label="قفز" onClick={() => { control.current.jump = true; }}
        style={{ width: 57, height: 57, borderRadius: 18, border: '1px solid rgba(255,255,255,.7)', background: 'rgba(6,67,62,.83)', color: '#FFFFFF', fontSize: 12, fontWeight: 800 }}>↑ قفز</button>
    </div>
  </div>;
}
