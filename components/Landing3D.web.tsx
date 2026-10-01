import { useEffect, useRef } from 'react';

export default function Landing3D() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let cleanup = () => {};

    import('three').then((THREE) => {
      if (!host.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0.25, 8.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.setSize(host.current.clientWidth, host.current.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.current.appendChild(renderer.domElement);

      const emblem = new THREE.Group();
      emblem.rotation.x = -0.1;
      scene.add(emblem);

      // Stylized, faceted silhouette inspired by the outline of Saudi Arabia.
      const shape = new THREE.Shape();
      shape.moveTo(-1.72, 0.7);
      shape.lineTo(-1.22, 1.1);
      shape.lineTo(-0.4, 1.28);
      shape.lineTo(0.22, 1.1);
      shape.lineTo(0.92, 0.76);
      shape.lineTo(1.55, 0.34);
      shape.lineTo(1.4, -0.08);
      shape.lineTo(1.12, -0.3);
      shape.lineTo(0.86, -0.82);
      shape.lineTo(0.34, -1.08);
      shape.lineTo(-0.08, -1.32);
      shape.lineTo(-0.54, -1.1);
      shape.lineTo(-0.98, -1.0);
      shape.lineTo(-1.25, -0.58);
      shape.lineTo(-1.58, -0.34);
      shape.lineTo(-1.48, 0.04);
      shape.lineTo(-1.78, 0.34);
      shape.closePath();

      const mapGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.24,
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.055,
        bevelThickness: 0.045,
        curveSegments: 3,
      });
      mapGeo.center();

      const mapMat = new THREE.MeshPhysicalMaterial({
        color: 0x38d9b0,
        roughness: 0.22,
        metalness: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.9,
      });

      const map = new THREE.Mesh(mapGeo, mapMat);
      map.scale.set(1.15, 1.15, 1.15);
      emblem.add(map);

      const nodes = [
        [-0.92, 0.38, 0.18], [-0.25, 0.72, 0.2], [0.42, 0.42, 0.19],
        [0.9, 0.1, 0.2], [0.56, -0.42, 0.19], [0.02, -0.72, 0.2],
        [-0.58, -0.5, 0.19], [-1.08, -0.04, 0.18],
      ];

      const edges = [[0,1],[1,2],[2,3],[2,4],[4,5],[5,6],[6,7],[7,0],[1,6],[0,2],[2,5]];
      const positions: number[] = [];
      edges.forEach(([a,b]) => positions.push(...nodes[a], ...nodes[b]));

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const lines = new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xe5fff8, transparent: true, opacity: 0.72 })
      );
      lines.position.z = 0.2;
      lines.scale.set(1.15, 1.15, 1.15);
      emblem.add(lines);

      const nodeGeo = new THREE.SphereGeometry(0.075, 12, 12);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x63e6be,
        emissiveIntensity: 3,
        roughness: 0.2,
        metalness: 0.25,
      });

      nodes.forEach(([x, y, z]) => {
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.set(x * 1.15, y * 1.15, z);
        emblem.add(node);
      });

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.018, 8, 160),
        new THREE.MeshBasicMaterial({ color: 0x63e6be, transparent: true, opacity: 0.26 })
      );
      halo.rotation.x = Math.PI / 2.15;
      emblem.add(halo);

      scene.add(new THREE.AmbientLight(0xd8fff5, 2.1));
      const keyLight = new THREE.PointLight(0x63e6be, 18, 10);
      keyLight.position.set(2.2, 2.8, 3.8);
      scene.add(keyLight);

      const particleGeo = new THREE.BufferGeometry();
      const count = 420;
      const particlePositions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 9;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 5.8;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particles = new THREE.Points(
        particleGeo,
        new THREE.PointsMaterial({ color: 0x9fffe5, size: 0.015, transparent: true, opacity: 0.48 })
      );
      scene.add(particles);

      const resize = () => {
        if (!host.current) return;
        const w = host.current.clientWidth;
        const h = host.current.clientHeight;
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', resize);

      const animate = () => {
        frame = requestAnimationFrame(animate);
        emblem.rotation.y += 0.0024;
        emblem.rotation.x = -0.1 + Math.sin(Date.now() * 0.00035) * 0.035;
        halo.rotation.z += 0.003;
        particles.rotation.y -= 0.00018;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        mapGeo.dispose();
        mapMat.dispose();
        lineGeo.dispose();
        (lines.material as THREE.Material).dispose();
        nodeGeo.dispose();
        nodeMat.dispose();
        (halo.geometry as THREE.BufferGeometry).dispose();
        (halo.material as THREE.Material).dispose();
        particleGeo.dispose();
        (particles.material as THREE.Material).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => cleanup();
  }, []);

  return <div ref={host} style={{ width: '100%', height: '100%', minHeight: 420 }} />;
}
