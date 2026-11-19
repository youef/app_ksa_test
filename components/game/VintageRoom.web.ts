import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Vintage living room in the public Three.js kingdom.
 * Source asset: Renend Studio, "Modular Vintage Living Room - Game Ready PBR",
 * CC BY 4.0: https://sketchfab.com/3d-models/modular-vintage-living-room-game-ready-pbr-d83c3f837bae4c9aa52fafc476500386
 * Download the model through Sketchfab's official download flow and place a GLB
 * at public/kingdom/vintage-living-room.glb. No protected download is bypassed.
 * The playable hand-built room remains available when the GLB is absent.
 */
export const VINTAGE_ROOM = { x: 42, z: 116, width: 18, depth: 16 };
export function addVintageRoom(scene: THREE.Scene, terrainHeight: (x: number, z: number) => number) {
  const group = new THREE.Group();
  group.name = 'vintage-living-room';
  group.position.set(VINTAGE_ROOM.x, terrainHeight(VINTAGE_ROOM.x, VINTAGE_ROOM.z) + .2, VINTAGE_ROOM.z);
  scene.add(group);
  const furniture = new THREE.Group();
  group.add(furniture);
  const mat = (color: string, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness });
  function cube(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Entrance is the open span at the south-facing (+Z) wall.
  cube(group, 18, .25, 16, 0, -.12, 0, '#73523B');
  cube(group, 18, 5.7, .4, 0, 2.85, -8, '#BFA47B');
  cube(group, .4, 5.7, 16, -9, 2.85, 0, '#BFA47B');
  cube(group, .4, 5.7, 16, 9, 2.85, 0, '#BFA47B');
  cube(group, 7.3, 5.7, .4, -5.35, 2.85, 8, '#BFA47B');
  cube(group, 7.3, 5.7, .4, 5.35, 2.85, 8, '#BFA47B');
  cube(group, 3.4, 2.6, .4, 0, 4.4, 8, '#BFA47B');
  cube(group, 3.6, .14, 2, 0, .06, 8.4, '#B79362'); // threshold
  cube(furniture, 5.7, .2, 4.8, 0, .05, -1, '#9D4538'); // carpet
  cube(furniture, 5, 1.2, 1.7, 0, .65, -4.9, '#65412E'); // sofa
  cube(furniture, 5, 1.2, .45, 0, 1.5, -5.65, '#75472C');
  cube(furniture, 2.2, .6, 1.3, 0, .55, -.8, '#9F7851'); // coffee table
  cube(furniture, 2.1, 2.5, 1, -7.2, 1.25, -5.1, '#583D2D'); // bookcase
  cube(furniture, 2.1, 2.5, 1, 7.2, 1.25, -5.1, '#583D2D');
  cube(furniture, 2.8, 1.1, 1.7, -5.5, .56, 2.6, '#714E40');
  cube(furniture, 2.8, 1.1, 1.7, 5.5, .56, 2.6, '#714E40');
  const chandelier = new THREE.PointLight('#FFDAA1', 42, 21, 2);
  chandelier.position.set(0, 4.8, 0);
  group.add(chandelier);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFF1C1' }));
  bulb.position.copy(chandelier.position);
  group.add(bulb);
  // Load the *actual* licensed artist asset when supplied locally by the project owner.
  let cancelled = false;
  const loader = new GLTFLoader();
  loader.load('/kingdom/vintage-living-room.glb', gltf => {
    if (cancelled) return;
    const root = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = Math.min(15 / Math.max(.001, size.x), 13 / Math.max(.001, size.z), 5.4 / Math.max(.001, size.y));
    root.scale.setScalar(scale);
    root.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
    root.traverse(node => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    group.add(root);
    furniture.visible = false;
    group.userData.originalRoomLoaded = true;
  }, undefined, () => { group.userData.originalRoomLoaded = false; });
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512; labelCanvas.height = 96;
  const ctx = labelCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#133D36'; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#FFF2CF'; ctx.textAlign = 'center'; ctx.font = 'bold 39px sans-serif';
    ctx.fillText('الغرفة القديمة · ادخل', 256, 62);
  }
  const texture = new THREE.CanvasTexture(labelCanvas);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sign.position.set(0, 6.7, 8);
  sign.scale.set(12, 2.3, 1);
  group.add(sign);
  return {
    inside(x: number, z: number) {
      return Math.abs(x - VINTAGE_ROOM.x) < 8.7 && z > VINTAGE_ROOM.z - 7.7 && z < VINTAGE_ROOM.z + 7.7;
    },
    // Side and rear walls are solid; the south door is 3.4 m wide.
    canMove(x: number, z: number) {
      const dx = x - VINTAGE_ROOM.x, dz = z - VINTAGE_ROOM.z;
      const near = Math.abs(dx) < 9.8 && Math.abs(dz) < 8.8;
      if (!near) return true;
      if (Math.abs(dx) > 8.1 && Math.abs(dz) < 8.5) return false;
      if (dz < -7.1 && Math.abs(dx) < 8.5) return false;
      if (dz > 7.1 && Math.abs(dx) > 1.65 && Math.abs(dx) < 8.5) return false;
      // Keep the basic furniture away from the player's collision capsule.
      if (!group.userData.originalRoomLoaded && Math.abs(dx) < 3.2 && dz > -6.2 && dz < -3.2) return false;
      return true;
    },
    dispose() { cancelled = true; }
  };
}
