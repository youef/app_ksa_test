import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildAvatar, type AvatarKey } from './KingdomWorld3D.web';

export default function AvatarPreview3D({ avatarKey }: { avatarKey: AvatarKey }) {
  const holder = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = holder.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    renderer.setClearColor('#000000', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#557C65', 3.1));
    const sun = new THREE.DirectionalLight('#FFF0DA', 2.2);
    sun.position.set(-4, 9, 7); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(43, 1, .1, 35);
    camera.position.set(4.3, 3.7, 8.3);
    camera.lookAt(0, 1.38, 0);
    const rig = buildAvatar(avatarKey);
    scene.add(rig.group);
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.4, .38, 48),
      new THREE.MeshStandardMaterial({ color: '#B0D6B1', roughness: .92 })
    );
    floor.position.y = -.24;
    scene.add(floor);
    const clock = new THREE.Clock();
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    renderer.setAnimationLoop(() => {
      if (document.hidden) return;
      const delta = Math.min(clock.getDelta(), .05);
      const t = clock.elapsedTime;
      rig.group.rotation.y = Math.sin(t * .43) * .38;
      rig.body.position.y = Math.sin(t * 2.1) * .045;
      rig.leftArm.rotation.x = Math.sin(t * 1.6) * .13;
      rig.rightArm.rotation.x = -Math.sin(t * 1.6) * .13;
      rig.leftLeg.rotation.x = Math.sin(t * 1.3) * .06;
      rig.rightLeg.rotation.x = -Math.sin(t * 1.3) * .06;
      renderer.render(scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) material.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [avatarKey]);
  return <div ref={holder} aria-label="معاينة متحركة ثلاثية الأبعاد للشخصية"
    style={{ width: '100%', height: 205, background: 'radial-gradient(circle at 50% 70%,#609C83 0%,#315B5B 50%,#123B42 100%)', borderRadius: 16, overflow: 'hidden' }}/>;
}
