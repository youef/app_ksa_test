import { useEffect, useRef } from 'react';

export default function Landing3D() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let cleanup = () => {};
    import('three').then((THREE) => {
      if (!host.current) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 1.2, 8.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.setSize(host.current.clientWidth, host.current.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.current.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(2.25, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x16a085, transparent: true, opacity: 0.045 })
      );
      group.add(glow);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.65, 0.012, 8, 128),
        new THREE.MeshBasicMaterial({ color: 0x63e6be, transparent: true, opacity: 0.22 })
      );
      ring.rotation.x = Math.PI / 2.35;
      group.add(ring);

      const points = new THREE.Group();
      const houseMat = new THREE.MeshStandardMaterial({ color: 0x5eead4, roughness: 0.7, metalness: 0.1 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x1f8f78, roughness: 0.8 });
      const roadMat = new THREE.MeshBasicMaterial({ color: 0x78a99f, transparent: true, opacity: 0.18 });

      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const r = 1.2 + (i % 4) * 0.36;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const h = 0.22 + (i % 5) * 0.07;

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.28), houseMat);
        base.position.set(x, h / 2 - 0.25, z);
        points.add(base);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.18, 4), roofMat);
        roof.position.set(x, h + 0.02 - 0.25, z);
        roof.rotation.y = Math.PI / 4;
        points.add(roof);
      }
      group.add(points);

      for (let i = 0; i < 9; i++) {
        const road = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 5.6), roadMat);
        road.rotation.y = (i / 9) * Math.PI;
        group.add(road);
      }

      const starGeo = new THREE.BufferGeometry();
      const starCount = 500;
      const pos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 10;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fffe5, size: 0.018, transparent: true, opacity: 0.65 }));
      scene.add(stars);

      scene.add(new THREE.AmbientLight(0xbfffee, 2.2));
      const light = new THREE.PointLight(0x63e6be, 15, 12);
      light.position.set(2, 4, 4);
      scene.add(light);

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
        group.rotation.y += 0.0028;
        group.rotation.x = Math.sin(Date.now() * 0.00035) * 0.035;
        stars.rotation.y -= 0.00025;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => cleanup();
  }, []);

  return <div ref={host} style={{ width: '100%', height: '100%', minHeight: 420 }} />;
}
