// Renderer + a flat, top-down camera: slow Ken Burns drift, plus wheel zoom.
// Zoom is IN only — 1.0 is the base framing and the floor; it pulls toward the
// lantern (what's lit is what grows) and the view is clamped to the map edges.
import * as THREE from 'three';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f14); // --ink

  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10);
  camera.up.set(0, 0, -1); // looking straight down: screen-up = image-top (-Z)

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // Cap the backing resolution: rendering at full retina DPR kept the GPU pegged,
  // which starved <video> decoding on busy machines (cards froze until a tab
  // switch reset things). The lithograph loses nothing visible at 1.25.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  container.appendChild(renderer.domElement);

  // GPU context loss (driver reset under load — this machine often runs QGIS on
  // the same GPU) freezes the canvas AND GPU-decoded video in one stroke, which
  // is exactly the observed "everything froze, tab-switch fixes it" symptom.
  // preventDefault on 'lost' is what allows the browser to RESTORE the context;
  // three.js re-uploads its textures automatically on restore.
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('austin1885: WebGL context LOST — waiting for restore');
  }, false);
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.warn('austin1885: WebGL context restored');
  });

  const OVERSCAN = 1.0; // camera is static now — show as much map as cover-fit allows
  const MAX_ZOOM = 2.6;  // how much closer you can get
  const AUTO_ZOOM = 1.7; // how far the view leans in on its own over a lit site
  let planeW = 1.3, planeD = 1;
  let baseHeight = 1;
  let zoom = 1, zoomTarget = 1;

  // main.js keeps this synced to the lantern's position on the map
  const zoomAnchor = new THREE.Vector3(0, 0, 0);

  function frame() {
    camera.aspect = window.innerWidth / window.innerHeight;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hForHeight = planeD / (2 * tan);
    const hForWidth = planeW / (2 * tan * camera.aspect);
    baseHeight = Math.min(hForHeight, hForWidth) / OVERSCAN;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', frame);
  frame();

  // Manual zoom (wheel or buttons) takes priority: it cancels any pending
  // auto-zoom restore so the view never fights the visitor's hands.
  let preAuto = null; // zoom level to restore when the lantern leaves a site
  function manualZoom(v) {
    preAuto = null;
    zoomTarget = THREE.MathUtils.clamp(v, 1, MAX_ZOOM);
  }

  // wheel in = closer; wheel out only returns to the base framing, never past it
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    manualZoom(zoomTarget * Math.exp(-e.deltaY * 0.0014));
  }, { passive: false });

  const clock = new THREE.Clock();
  const tickers = [];
  let acc = 0;
  const FRAME = 1 / 30; // render at 30 fps — plenty for a slow lantern, and it
                        // leaves real headroom for the card videos to decode

  function animate() {
    requestAnimationFrame(animate);
    acc += clock.getDelta();
    if (acc < FRAME) return;
    const dt = Math.min(acc, 0.1);
    acc = 0;
    const t = clock.elapsedTime;

    zoom += (zoomTarget - zoom) * Math.min(1, dt * 1.6); // slow, museum-glass ease
    const h = baseHeight / zoom;

    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = 2 * h * tan * camera.aspect;
    const visH = 2 * h * tan;
    const mx = Math.max(0, (planeW - visW) / 2);
    const mz = Math.max(0, (planeD - visH) / 2);

    // The camera never wanders on its own (constant motion = constant GPU load,
    // and the drift starved video playback). It moves for exactly one reason:
    // zoom pulls the center toward the lantern (fully there when deep).
    const pull = 1 - 1 / zoom;
    let x = THREE.MathUtils.lerp(0, zoomAnchor.x, pull);
    let z = THREE.MathUtils.lerp(0, zoomAnchor.z, pull);
    x = THREE.MathUtils.clamp(x, -mx, mx); // never show past the map's edge
    z = THREE.MathUtils.clamp(z, -mz, mz);

    camera.position.set(x, h, z);
    camera.lookAt(x, 0, z);

    // one misbehaving ticker must never kill the whole page's rendering
    for (const fn of tickers) {
      try { fn(t, dt); } catch (err) { console.error('austin1885 ticker error:', err); }
    }
    renderer.render(scene, camera);
  }
  animate();

  return {
    scene, camera, renderer, zoomAnchor,
    onTick(fn) { tickers.push(fn); },
    setMapSize(w, d) { planeW = w; planeD = d; frame(); },
    zoomIn() { manualZoom(zoomTarget * 1.35); },
    zoomOut() { manualZoom(zoomTarget / 1.35); },
    // auto lean-in over a lit site; leaving restores whatever the visitor had
    autoZoomIn() { if (zoomTarget < AUTO_ZOOM) { preAuto = zoomTarget; zoomTarget = AUTO_ZOOM; } },
    autoZoomOut() { if (preAuto !== null) { zoomTarget = preAuto; preAuto = null; } },
  };
}
