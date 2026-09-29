import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Twisted chrome four-point star (CTA hero object).
 * three.js is imported lazily so it lands in its own chunk and never blocks first paint.
 */
export function ChromeStar({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cleanup = () => {};
    let cancelled = false;

    void (async () => {
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
      const { mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      scene.environment = envTexture;

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0, 8.4);

      // Parametric surface: astroid cross-section, pinched toward the poles, twisted and saddle-bent.
      const U = 280;
      const V = 110;
      const positions: number[] = [];
      const indices: number[] = [];
      for (let j = 0; j <= V; j++) {
        const v = -1 + (2 * j) / V;
        const pinch = 1 - Math.abs(v) ** 1.6;
        const twist = v * 0.18;
        const ct = Math.cos(twist);
        const st = Math.sin(twist);
        for (let i = 0; i <= U; i++) {
          const u = (i / U) * Math.PI * 2;
          const c = Math.cos(u);
          const s = Math.sin(u);
          const x0 = Math.sign(c) * Math.abs(c) ** 3 * 1.5 * pinch;
          const y0 = Math.sign(s) * Math.abs(s) ** 3 * 1.95 * pinch;
          // Saddle bend curls opposite arms toward/away from camera; tips flare with the square term.
          const z = v * 0.42 + (x0 * x0 - y0 * y0) * 0.2 + (x0 * y0) * 0.12;
          positions.push(x0 * ct - y0 * st, y0 * ct + x0 * st, z);
        }
      }
      for (let j = 0; j < V; j++) {
        for (let i = 0; i < U; i++) {
          const a = j * (U + 1) + i;
          const b = a + U + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const raw = new THREE.BufferGeometry();
      raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      raw.setIndex(indices);
      const geometry = mergeVertices(raw, 1e-5);
      raw.dispose();
      geometry.computeVertexNormals();

      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#cbbff2'),
        metalness: 1,
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
        side: THREE.DoubleSide,
      });
      const star = new THREE.Mesh(geometry, material);
      const pivot = new THREE.Group();
      pivot.add(star);
      pivot.rotation.set(0.55, -0.35, 0.62);
      scene.add(pivot);

      const rim = new THREE.PointLight('#b48cff', 30, 20);
      rim.position.set(-3, 2, 2);
      scene.add(rim);
      const fill = new THREE.PointLight('#ffffff', 18, 20);
      fill.position.set(3, -1, 4);
      scene.add(fill);

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = el;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });

      let visible = false;
      const io = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? false;
      });
      io.observe(el);

      const timer = new THREE.Timer();
      let raf = 0;
      const render = () => {
        timer.update();
        const t = timer.getElapsed();
        star.rotation.z = t * 0.12;
        star.rotation.y = Math.sin(t * 0.35) * 0.18;
        pivot.rotation.x += (0.55 + pointer.y * 0.15 - pivot.rotation.x) * 0.04;
        pivot.rotation.y += (-0.35 + pointer.x * 0.25 - pivot.rotation.y) * 0.04;
        pivot.position.y = Math.sin(t * 0.6) * 0.06;
        renderer.render(scene, camera);
      };
      const loop = () => {
        if (visible) render();
        raf = requestAnimationFrame(loop);
      };
      if (reduce) render();
      else loop();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener('pointermove', onPointer);
        geometry.dispose();
        material.dispose();
        envTexture.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [reduce]);

  return <div ref={host} className={className} aria-hidden="true" />;
}
