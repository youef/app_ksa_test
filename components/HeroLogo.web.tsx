import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Props = { size: number };

function radialTexture(inner: string, outer: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function houseGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-1, -1.1);
  shape.lineTo(1, -1.1);
  shape.lineTo(1, 0.2);
  shape.lineTo(0, 1.15);
  shape.lineTo(-1, 0.2);
  shape.closePath();

  const door = new THREE.Path();
  door.moveTo(-0.28, -0.8);
  door.lineTo(0.28, -0.8);
  door.lineTo(0.28, -0.22);
  door.absarc(0, -0.22, 0.28, 0, Math.PI, false);
  door.lineTo(-0.28, -0.8);
  shape.holes.push(door);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.45,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.1,
    bevelSegments: 6,
    curveSegments: 24,
  });
  geometry.center();
  return geometry;
}

export default function HeroLogo({ size }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const logo = new THREE.Group();
    scene.add(logo);

    const houseGeo = houseGeometry();
    const houseMat = new THREE.MeshPhysicalMaterial({
      color: '#10b981',
      metalness: 0.65,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.5,
    });
    const house = new THREE.Mesh(houseGeo, houseMat);
    logo.add(house);

    const ringGeo = new THREE.TorusGeometry(1.95, 0.018, 8, 160);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.4;
    scene.add(ring);

    const glowTex = radialTexture('rgba(52,211,153,0.55)', 'rgba(52,211,153,0)');
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(5.2, 5.2, 1);
    glow.position.z = -1;
    scene.add(glow);

    const sparkleCount = 140;
    const positions = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      const r = 1.9 + Math.random() * 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const sparkleGeo = new THREE.BufferGeometry();
    sparkleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparkleTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const sparkleMat = new THREE.PointsMaterial({
      size: 0.09,
      map: sparkleTex,
      color: '#a7f3d0',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
    scene.add(sparkles);

    scene.add(new THREE.AmbientLight('#ffffff', 0.3));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(3, 4, 5);
    scene.add(key);
    const shine = new THREE.PointLight('#ccfbf1', 40, 12);
    scene.add(shine);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      const t = reduceMotion ? 0.8 : clock.getElapsedTime();
      logo.rotation.y += (Math.sin(t * 0.6) * 0.55 + pointer.x * 0.35 - logo.rotation.y) * 0.06;
      logo.rotation.x += (pointer.y * 0.2 - logo.rotation.x) * 0.06;
      logo.position.y = Math.sin(t * 1.2) * 0.08;
      shine.position.set(Math.cos(t * 1.4) * 3, Math.sin(t * 0.9) * 1.6, 2.6);
      ring.rotation.z = t * 0.25;
      sparkles.rotation.y = t * 0.08;
      sparkleMat.opacity = 0.65 + Math.sin(t * 2) * 0.25;
      glowMat.opacity = 0.75 + Math.sin(t * 1.5) * 0.2;
      renderer.render(scene, camera);
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      [houseGeo, ringGeo, sparkleGeo].forEach((g) => g.dispose());
      [houseMat, ringMat, glowMat, sparkleMat].forEach((m) => m.dispose());
      [glowTex, sparkleTex, envTexture].forEach((tex) => tex.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [size]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`
        @keyframes hayna-shimmer { 0% { background-position: 150% 0; } 100% { background-position: -50% 0; } }
        .hayna-title {
          margin: 0;
          font-size: 56px;
          font-weight: 900;
          line-height: 1.2;
          letter-spacing: 1px;
          background: linear-gradient(110deg, #a7f3d0 0%, #a7f3d0 40%, #ffffff 50%, #a7f3d0 60%, #a7f3d0 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: hayna-shimmer 3.2s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) { .hayna-title { animation: none; } }
      `}</style>
      <div ref={mountRef} style={{ width: size, height: size }} />
      <h1 className="hayna-title" dir="rtl">حيّنا</h1>
    </div>
  );
}
