import { useEffect, useRef } from 'react';

export default function Landing3D() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let cleanup = () => {};

    import('three').then((THREE) => {
      if (!host.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0.1, 9.2);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.current.clientWidth, host.current.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      host.current.appendChild(renderer.domElement);

      const emblem = new THREE.Group();
      scene.add(emblem);

      // Premium faceted silhouette inspired by the Kingdom of Saudi Arabia.
      const shape = new THREE.Shape();
      [
        [-1.82, 0.62], [-1.42, 0.98], [-0.78, 1.25], [-0.1, 1.18],
        [0.48, 0.98], [1.02, 0.68], [1.62, 0.3], [1.48, -0.18],
        [1.1, -0.4], [0.9, -0.86], [0.38, -1.08], [-0.04, -1.38],
        [-0.52, -1.18], [-0.98, -1.02], [-1.24, -0.58], [-1.62, -0.34],
        [-1.5, 0.02], [-1.84, 0.28]
      ].forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
      shape.closePath();

      const mapGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.3,
        bevelEnabled: true,
        bevelSegments: 4,
        bevelSize: 0.07,
        bevelThickness: 0.06,
        curveSegments: 4,
      });
      mapGeo.center();

      const mapMat = new THREE.MeshPhysicalMaterial({
        color: 0x087f5b,
        roughness: 0.16,
        metalness: 0.72,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0.96,
      });
      const map = new THREE.Mesh(mapGeo, mapMat);
      map.scale.set(1.12, 1.12, 1.12);
      emblem.add(map);

      // Fine golden inner border gives the mark a premium national-emblem feel.
      const border = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-1.82, 0.62, 0.19), new THREE.Vector3(-1.42, 0.98, 0.19),
          new THREE.Vector3(-0.78, 1.25, 0.19), new THREE.Vector3(-0.1, 1.18, 0.19),
          new THREE.Vector3(0.48, 0.98, 0.19), new THREE.Vector3(1.02, 0.68, 0.19),
          new THREE.Vector3(1.62, 0.3, 0.19), new THREE.Vector3(1.48, -0.18, 0.19),
          new THREE.Vector3(1.1, -0.4, 0.19), new THREE.Vector3(0.9, -0.86, 0.19),
          new THREE.Vector3(0.38, -1.08, 0.19), new THREE.Vector3(-0.04, -1.38, 0.19),
          new THREE.Vector3(-0.52, -1.18, 0.19), new THREE.Vector3(-0.98, -1.02, 0.19),
          new THREE.Vector3(-1.24, -0.58, 0.19), new THREE.Vector3(-1.62, -0.34, 0.19),
          new THREE.Vector3(-1.5, 0.02, 0.19), new THREE.Vector3(-1.84, 0.28, 0.19)
        ]),
        new THREE.LineBasicMaterial({ color: 0xd7b56d, transparent: true, opacity: 0.95 })
      );
      border.scale.set(1.12, 1.12, 1.12);
      emblem.add(border);

      // Relationship network: luminous nodes connected across the Kingdom.
      const nodes = [
        [-1.0, 0.42, 0.27], [-0.3, 0.73, 0.27], [0.42, 0.46, 0.27],
        [0.92, 0.1, 0.27], [0.58, -0.4, 0.27], [0.02, -0.75, 0.27],
        [-0.58, -0.5, 0.27], [-1.12, -0.03, 0.27]
      ];
      const edges = [[0,1],[1,2],[2,3],[2,4],[4,5],[5,6],[6,7],[7,0],[1,6],[0,2],[2,5]];
      const positions: number[] = [];
      edges.forEach(([a, b]) => positions.push(...nodes[a], ...nodes[b]));

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const lines = new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xf5e2b8, transparent: true, opacity: 0.82 })
      );
      lines.scale.set(1.12, 1.12, 1.12);
      emblem.add(lines);

      const nodeGeo = new THREE.SphereGeometry(0.065, 16, 16);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0xfff4d6,
        emissive: 0xd7b56d,
        emissiveIntensity: 5,
        roughness: 0.12,
        metalness: 0.65,
      });
      nodes.forEach(([x, y, z]) => {
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.set(x * 1.12, y * 1.12, z);
        emblem.add(node);
      });

      // Abstract palm at the heart of the mark.
      const palm = new THREE.Group();
      palm.position.set(0.02, 0.03, 0.36);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.065, 0.72, 10),
        new THREE.MeshStandardMaterial({ color: 0xd7b56d, metalness: 0.5, roughness: 0.25 })
      );
      palm.add(trunk);

      const frondMat = new THREE.MeshStandardMaterial({
        color: 0xf1d38d,
        emissive: 0x5a3b12,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.22,
      });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.46, 3, 8), frondMat);
        frond.position.set(Math.cos(angle) * 0.17, 0.38 + Math.sin(angle) * 0.12, 0);
        frond.rotation.z = Math.PI / 2 - angle;
        palm.add(frond);
      }
      emblem.add(palm);

      // Two elegant sweeping blades, an abstract reference to the Kingdom's emblem.
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xe8edf0,
        metalness: 0.92,
        roughness: 0.12,
        emissive: 0x173b31,
        emissiveIntensity: 0.35,
      });
      [-1, 1].forEach((side) => {
        const blade = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 1.15, 4, 10), bladeMat);
        blade.position.set(0, -0.42, 0.39);
        blade.rotation.z = side * 0.62;
        emblem.add(blade);
      });

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.014, 10, 180),
        new THREE.MeshBasicMaterial({ color: 0xd7b56d, transparent: true, opacity: 0.34 })
      );
      halo.rotation.x = Math.PI / 2.1;
      emblem.add(halo);

      const halo2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.38, 0.008, 8, 180),
        new THREE.MeshBasicMaterial({ color: 0x19a974, transparent: true, opacity: 0.22 })
      );
      halo2.rotation.x = Math.PI / 2.25;
      emblem.add(halo2);

      scene.add(new THREE.AmbientLight(0xe9fff6, 1.8));
      const greenLight = new THREE.PointLight(0x18b77d, 22, 11);
      greenLight.position.set(-2.5, 2.5, 4.5);
      scene.add(greenLight);
      const goldLight = new THREE.PointLight(0xd7b56d, 16, 9);
      goldLight.position.set(2.5, -1.5, 3.2);
      scene.add(goldLight);

      const particleGeo = new THREE.BufferGeometry();
      const count = 650;
      const particlePositions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 10;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 6.5;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particles = new THREE.Points(
        particleGeo,
        new THREE.PointsMaterial({ color: 0xd7b56d, size: 0.012, transparent: true, opacity: 0.5 })
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
        const t = Date.now() * 0.001;
        emblem.rotation.y += 0.0022;
        emblem.rotation.x = Math.sin(t * 0.42) * 0.035;
        emblem.position.y = Math.sin(t * 0.7) * 0.055;
        halo.rotation.z += 0.0035;
        halo2.rotation.z -= 0.0022;
        particles.rotation.y -= 0.00015;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        mapGeo.dispose();
        mapMat.dispose();
        (border.geometry as THREE.BufferGeometry).dispose();
        (border.material as THREE.Material).dispose();
        lineGeo.dispose();
        (lines.material as THREE.Material).dispose();
        nodeGeo.dispose();
        nodeMat.dispose();
        (halo.geometry as THREE.BufferGeometry).dispose();
        (halo.material as THREE.Material).dispose();
        (halo2.geometry as THREE.BufferGeometry).dispose();
        (halo2.material as THREE.Material).dispose();
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
