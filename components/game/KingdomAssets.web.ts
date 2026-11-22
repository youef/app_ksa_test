import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AvatarKey } from './KingdomWorld3D.web';

const BASE = '/kingdom/kaykit/';
const MEDIEVAL = BASE + 'medieval/addons/kaykit_medieval_hexagon_pack/Assets/gltf/';
const CHARACTERS = BASE + 'adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/';
const characters: Record<AvatarKey, string> = {
  knight: 'Knight', ranger: 'Rogue', warrior: 'Barbarian', desert: 'Rogue_Hooded', captain: 'Knight', mage: 'Mage',
};
export type BuildingPlacement = { model: string; x: number; z: number; width: number; replaces?: string | string[] };
export const KINGDOM_BUILDINGS: BuildingPlacement[] = [
  { model: 'building_castle_blue', x: 0, z: -69, width: 35, replaces: 'castle' },
  { model: 'building_barracks_blue', x: -65, z: -87, width: 16, replaces: 'house:-62:-87' },
  { model: 'building_mine_blue', x: 77, z: -85, width: 22, replaces: ['house:81:-86', 'mine'] },
  { model: 'building_home_A_blue', x: 12, z: 78, width: 10, replaces: 'house:12:78' },
  { model: 'building_home_B_blue', x: -12, z: 79, width: 11, replaces: 'house:-12:79' },
  { model: 'building_tavern_blue', x: 25, z: 66, width: 12, replaces: 'house:25:66' },
  { model: 'building_market_blue', x: -27, z: 64, width: 14, replaces: 'house:-27:64' },
  { model: 'building_blacksmith_blue', x: 9, z: 100, width: 12, replaces: 'house:9:100' },
  { model: 'building_home_A_blue', x: -18, z: 103, width: 10, replaces: 'house:-18:103' },
  { model: 'building_windmill_blue', x: 62, z: 31, width: 13, replaces: 'house:62:31' },
  { model: 'building_watermill_blue', x: 83, z: 37, width: 13, replaces: 'house:83:37' },
  { model: 'building_home_B_blue', x: 123, z: 98, width: 10, replaces: 'house:123:98' },
  { model: 'building_archeryrange_blue', x: -85, z: -95, width: 14 },
  { model: 'building_lumbermill_blue', x: -102, z: -35, width: 15 },
  { model: 'building_tower_A_blue', x: -26, z: -51, width: 7 },
  { model: 'building_tower_B_blue', x: 26, z: -51, width: 7 },
  { model: 'building_well_blue', x: -1, z: 93, width: 5 },
  { model: 'building_church_blue', x: -35, z: 104, width: 16 },
  { model: 'building_tower_A_blue', x: -34, z: -66, width: 8 },
  { model: 'building_tower_B_blue', x: 34, z: -66, width: 8 },
  { model: 'building_home_A_blue', x: 36, z: 82, width: 10 },
  { model: 'building_home_B_blue', x: -35, z: 84, width: 10 },
  { model: 'building_well_blue', x: 16, z: 91, width: 5 },
  { model: 'building_market_blue', x: 43, z: 65, width: 14 },
];

/** Dispose late async results as well as meshes detached during replacement. */
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
}
function normalize(root: THREE.Object3D, size: number, byHeight = false) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const dimensions = bounds.getSize(new THREE.Vector3());
  const factor = size / Math.max(.001, byHeight ? dimensions.y : Math.max(dimensions.x, dimensions.z));
  const wrapper = new THREE.Group();
  wrapper.add(root); root.scale.multiplyScalar(factor);
  root.position.x -= (bounds.min.x + bounds.max.x) * .5 * factor;
  root.position.z -= (bounds.min.z + bounds.max.z) * .5 * factor;
  root.position.y -= bounds.min.y * factor;
  root.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  return wrapper;
}
export function loadKingdomCharacter(key: AvatarKey, parent: THREE.Object3D, onReady: () => void, onFailure: () => void) {
  let disposed = false;
  let root: THREE.Object3D | undefined;
  let mixer: THREE.AnimationMixer | undefined;
  let current: THREE.AnimationAction | undefined;
  const actions = new Map<string, THREE.AnimationAction>();
  new GLTFLoader().load(CHARACTERS + characters[key] + '.glb', gltf => {
    if (disposed) { disposeObject(gltf.scene); return; }
    root = normalize(gltf.scene, 2.9, true);
    parent.add(root);
    mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
    onReady();
  }, undefined, () => { if (!disposed) onFailure(); });
  return {
    update(dt: number, moving: boolean, running: boolean, jumping: boolean) {
      if (!mixer) return;
      const name = jumping ? 'Jump_Idle' : moving ? running ? 'Running_A' : 'Walking_A' : 'Idle';
      const action = actions.get(name) || actions.get('Idle');
      if (action && current !== action) {
        current?.fadeOut(.16); action.reset().fadeIn(.16).play(); current = action;
      }
      mixer.update(dt);
    },
    dispose() {
      disposed = true; mixer?.stopAllAction();
      if (mixer) mixer.uncacheRoot(mixer.getRoot());
      if (root) { root.removeFromParent(); disposeObject(root); }
    },
  };
}

export function populateKingdom(scene: THREE.Scene, height: (x: number, z: number) => number, onProgress: (loaded: number, failed: number, total: number) => void) {
  let disposed = false, loaded = 0, failed = 0;
  const loader = new GLTFLoader();
  const imported = new THREE.Group(); imported.name = 'kaykit-world'; scene.add(imported);
  const obstacles: THREE.Box3[] = [];
  const placements = [...KINGDOM_BUILDINGS];
  const scenery: { path: string; x: number; z: number; width: number }[] = [
    { path: 'decoration/nature/mountain_A_grass_trees', x: 112, z: -117, width: 27 },
    { path: 'decoration/nature/mountain_B_grass', x: 140, z: -101, width: 24 },
    { path: 'decoration/nature/trees_A_large', x: -111, z: -8, width: 17 },
    { path: 'decoration/nature/trees_B_large', x: -75, z: -43, width: 16 },
    { path: 'decoration/props/weaponrack', x: -73, z: -75, width: 4 },
    { path: 'decoration/props/target', x: -93, z: -85, width: 3 },
    { path: 'decoration/props/barrel', x: -33, z: 58, width: 2 },
    { path: 'decoration/props/crate_A_big', x: 113, z: 96, width: 3 },
    { path: 'decoration/props/tent', x: -115, z: 110, width: 8 },
    { path: 'decoration/props/barrel', x: 35, z: 67, width: 2 },
    { path: 'decoration/props/barrel', x: 112, z: 108, width: 2 },
    { path: 'decoration/props/crate_A_big', x: 108, z: 101, width: 3 },
    { path: 'decoration/props/crate_A_big', x: 121, z: 98, width: 3 },
    { path: 'decoration/props/tent', x: -122, z: 115, width: 7 },
    { path: 'decoration/props/weaponrack', x: -78, z: -78, width: 4 },
    { path: 'decoration/props/target', x: -89, z: -88, width: 3 },
  ];
  const npcSpots = [
    { model: 'Knight', x: 4, z: 86, rotation: Math.PI },
    { model: 'Rogue', x: -24, z: 69, rotation: Math.PI / 2 },
    { model: 'Barbarian', x: -73, z: -79, rotation: -Math.PI / 2 },
    { model: 'Mage', x: 111, z: 100, rotation: -Math.PI / 2 },
  ];
  const npcs: THREE.AnimationMixer[] = [];
  const total = placements.length + scenery.length + npcSpots.length;
  const progress = () => { if (!disposed) onProgress(loaded, failed, total); };
  const add = (path: string, x: number, z: number, width: number, replacement?: string | string[], solid = false) => loader.load(MEDIEVAL + path + '.gltf', gltf => {
    if (disposed) { disposeObject(gltf.scene); return; }
    const model = normalize(gltf.scene, width);
    model.position.set(x, height(x, z), z); imported.add(model); model.updateMatrixWorld(true);
    if (solid) {
      const bounds = new THREE.Box3().setFromObject(model);
      // Tighten to the footprint; decorative roof overhangs should not block paths.
      bounds.expandByScalar(-.45); obstacles.push(bounds);
    }
    for (const name of replacement ? Array.isArray(replacement) ? replacement : [replacement] : []) {
      const fallback = scene.getObjectByName('fallback:' + name);
      if (fallback) { fallback.removeFromParent(); disposeObject(fallback); }
    }
    loaded++; progress();
  }, undefined, () => { failed++; progress(); });
  for (const item of placements) add('buildings/blue/' + item.model, item.x, item.z, item.width, item.replaces, true);
  for (const item of scenery) add(item.path, item.x, item.z, item.width);
  for (const npc of npcSpots) loader.load(CHARACTERS + npc.model + '.glb', gltf => {
    if (disposed) { disposeObject(gltf.scene); return; }
    const character = normalize(gltf.scene, 2.9, true);
    character.position.set(npc.x, height(npc.x, npc.z), npc.z);
    character.rotation.y = npc.rotation;
    imported.add(character);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const idle = gltf.animations.find(clip => clip.name === 'Idle') || gltf.animations[0];
    if (idle) mixer.clipAction(idle).play();
    npcs.push(mixer);
    loaded++; progress();
  }, undefined, () => { failed++; progress(); });
  return {
    update(dt: number) { for (const mixer of npcs) mixer.update(dt); },
    canMove(x: number, z: number) { return !obstacles.some(b => x > b.min.x - .65 && x < b.max.x + .65 && z > b.min.z - .65 && z < b.max.z + .65); },
    dispose() { disposed = true; imported.removeFromParent(); disposeObject(imported); obstacles.length = 0; },
  };
}
