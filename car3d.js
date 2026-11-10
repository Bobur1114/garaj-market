import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

const wrap = document.getElementById('car3d-wrap');
const art = document.querySelector('.hero-art');

if (wrap && art) {
  init().catch(() => {
    art.classList.remove('car3d-on');
  });
}

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const sun = new THREE.DirectionalLight(0xffe6b0, 2.2);
  sun.position.set(2.5, 3.2, 1.5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe0d5, 0.7);
  fill.position.set(-2.2, 1.4, 3);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x2c3a32, 0.9));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  const gltf = await new GLTFLoader().loadAsync('models/bmw-m2.glb');
  const car = gltf.scene;

  car.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.frustumCulled = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      const n = (m.name || '').toLowerCase();
      if (n.includes('window') || n.includes('glass')) {
        m.transparent = true;
        m.opacity = n.includes('red') ? 0.55 : 0.4;
        m.roughness = 0.05;
        m.metalness = 0.1;
      }
      if (n.includes('interior')) {
        m.transparent = false;
        m.opacity = 1;
      }
      if (n.includes('paint')) {
        m.envMapIntensity = 1.2;
        m.roughness = Math.min(m.roughness ?? 0.4, 0.35);
      }
      if (n.includes('tireblur')) {
        obj.visible = false;
      }
    }
  });

  const rawBox = new THREE.Box3().setFromObject(car);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  car.scale.setScalar(4.6 / Math.max(rawSize.x, rawSize.y, rawSize.z));

  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5;

  const pivot = new THREE.Group();
  car.position.sub(center);
  pivot.add(car);
  scene.add(pivot);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const w = wrap.clientWidth || 1;
    const h = wrap.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fitDist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.98;
    camera.position.set(fitDist * 1.02, radius * 0.42, fitDist * 0.5);
    camera.lookAt(0, -radius * 0.02, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(wrap);

  let pointerX = 0;
  art.addEventListener('pointermove', (e) => {
    const r = art.getBoundingClientRect();
    pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
  });
  art.addEventListener('pointerleave', () => { pointerX = 0; });

  art.classList.add('car3d-on');

  const clock = new THREE.Clock();
  function frame() {
    const t = clock.getElapsedTime();
    const sway = reduceMotion ? 0 : Math.sin(t * 0.28) * 0.55;
    pivot.rotation.y = 2.35 + sway + pointerX * 0.3;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}
