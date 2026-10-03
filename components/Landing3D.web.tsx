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
      camera.position.set(0, 0.2, 8.8);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.current.clientWidth, host.current.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      host.current.appendChild(renderer.domElement);

      const emblem = new THREE.Group();
      scene.add(emblem);

      const green = 0x087f5b;
      const brightGreen = 0x24c98a;
      const gold = 0xd7b56d;
      const ivory = 0xf5f0df;

      const houseMat = new THREE.MeshPhysicalMaterial({
        color: green,
        roughness: 0.2,
        metalness: 0.62,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
      const roofMat = new THREE.MeshPhysicalMaterial({
        color: 0x0b5f46,
        roughness: 0.18,
        metalness: 0.7,
        clearcoat: 1,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: gold,
        emissive: 0x60461a,
        emissiveIntensity: 0.8,
        metalness: 0.75,
        roughness: 0.2,
      });
      const windowMat = new THREE.MeshStandardMaterial({
        color: ivory,
        emissive: 0x7ff0c2,
        emissiveIntensity: 2.8,
        metalness: 0.25,
        roughness: 0.15,
      });

      // A small 3D home: a place, a family, and a sense of belonging.
      const createHouse = (scale: number, central = false) => {
        const house = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.55, 0.52),
          houseMat
        );
        body.position.y = 0.05;
        house.add(body);

        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.49, 0.38, 4),
          roofMat
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 0.5;
        house.add(roof);

        const door = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.24, 0.035),
          goldMat
        );
        door.position.set(0, -0.12, 0.275);
        house.add(door);

        [-0.18, 0.18].forEach((x) => {
          const window = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.1, 0.035),
            windowMat
          );
          window.position.set(x, 0.08, 0.275);
          house.add(window);
        });

        if (central) {
          const crown = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 16, 16),
            new THREE.MeshStandardMaterial({
              color: ivory,
              emissive: gold,
              emissiveIntensity: 4,
              metalness: 0.7,
              roughness: 0.12,
            })
          );
          crown.position.y = 0.83;
          house.add(crown);
        }

        house.scale.setScalar(scale);
        return house;
      };

      // Seven connected homes form one neighborhood.
      const homes = [
        { x: 0, y: 0.12, z: 0.38, s: 1.28, central: true },
        { x: -1.05, y: 0.18, z: 0.1, s: 0.92 },
        { x: 1.05, y: 0.18, z: 0.1, s: 0.92 },
        { x: -0.72, y: -0.78, z: 0.02, s: 0.86 },
        { x: 0.72, y: -0.78, z: 0.02, s: 0.86 },
        { x: -1.48, y: -0.45, z: -0.05, s: 0.7 },
        { x: 1.48, y: -0.45, z: -0.05, s: 0.7 },
      ];

      homes.forEach((h) => {
        const house = createHouse(h.s, h.central);
        house.position.set(h.x, h.y, h.z);
        emblem.add(house);
      });

      // Glowing relationship network: every home belongs to the same community.
      const centers = homes.map((h) => new THREE.Vector3(h.x, h.y + 0.15, h.z + 0.35));
      const edgePairs = [
        [0,1],[0,2],[0,3],[0,4],[1,3],[1,5],[2,4],[2,6],[3,4],[3,5],[4,6],[5,6]
      ];
      const linePositions: number[] = [];
      edgePairs.forEach(([a,b]) => linePositions.push(
        centers[a].x, centers[a].y, centers[a].z,
        centers[b].x, centers[b].y, centers[b].z
      ));

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      const network = new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xd7b56d, transparent: true, opacity: 0.62 })
      );
      emblem.add(network);

      const nodeGeo = new THREE.SphereGeometry(0.055, 14, 14);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: ivory,
        emissive: brightGreen,
        emissiveIntensity: 4,
        metalness: 0.5,
        roughness: 0.15,
      });
      centers.forEach((p) => {
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.copy(p);
        node.position.z += 0.03;
        emblem.add(node);
      });

      // A luminous ring turns the neighborhood into a single identity mark.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.026, 12, 180),
        new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.55 })
      );
      ring.rotation.x = Math.PI / 2.15;
      ring.rotation.z = 0.18;
      emblem.add(ring);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.009, 8, 180),
        new THREE.MeshBasicMaterial({ color: brightGreen, transparent: true, opacity: 0.22 })
      );
      ring2.rotation.x = Math.PI / 2.2;
      emblem.add(ring2);

      // Subtle palm-like center mark: الوطن حوله والبيوت تحته.
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.025, 0.38, 10),
        goldMat
      );
      trunk.position.set(0, 0.82, 0.42);
      emblem.add(trunk);

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.012, 0.2, 3, 8),
          goldMat
        );
        frond.position.set(Math.cos(angle) * 0.075, 0.99 + Math.sin(angle) * 0.045, 0.42);
        frond.rotation.z = Math.PI / 2 - angle;
        emblem.add(frond);
      }

      scene.add(new THREE.AmbientLight(0xe9fff6, 1.9));
      const key = new THREE.PointLight(brightGreen, 22, 10);
      key.position.set(-2.5, 3, 4.5);
      scene.add(key);
      const warm = new THREE.PointLight(gold, 14, 8);
      warm.position.set(2.5, -1, 3.5);
      scene.add(warm);

      const particleGeo = new THREE.BufferGeometry();
      const count = 520;
      const particles = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        particles[i * 3] = (Math.random() - 0.5) * 9;
        particles[i * 3 + 1] = (Math.random() - 0.5) * 6;
        particles[i * 3 + 2] = (Math.random() - 0.5) * 4.5 - 1;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particles, 3));
      const particleSystem = new THREE.Points(
        particleGeo,
        new THREE.PointsMaterial({ color: gold, size: 0.012, transparent: true, opacity: 0.42 })
      );
      scene.add(particleSystem);

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
        emblem.rotation.y += 0.002;
        emblem.rotation.x = Math.sin(t * 0.45) * 0.028;
        emblem.position.y = Math.sin(t * 0.72) * 0.045;
        ring.rotation.z += 0.003;
        ring2.rotation.z -= 0.0018;
        particleSystem.rotation.y -= 0.00012;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        lineGeo.dispose();
        (network.material as any).dispose();
        nodeGeo.dispose();
        nodeMat.dispose();
        (ring.geometry as any).dispose();
        (ring.material as any).dispose();
        (ring2.geometry as any).dispose();
        (ring2.material as any).dispose();
        particleGeo.dispose();
        (particleSystem.material as any).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => cleanup();
  }, []);

  return <div ref={host} style={{ width: '100%', height: '100%', minHeight: 420 }} />;
}
