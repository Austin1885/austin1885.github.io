// Wiring only: scene + map + lantern + hotspots + story card.
import * as THREE from 'three';
import { createScene } from './scene.js';
import { loadMapPlane } from './mapPlane.js';
import { createLantern } from './lantern.js';
import { createHotspots } from './hotspots.js';
import { createStoryCard } from './storyCard.js';

// breadcrumbs: if anything ever stalls, these lines in the console (F12) say why
window.addEventListener('error', (e) => console.error('austin1885 uncaught:', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('austin1885 rejection:', e.reason));

function showFallback() {
  document.getElementById('scene').style.display = 'none';
  document.getElementById('vignette').style.display = 'none';
  document.getElementById('fallback').style.display = 'block';
}

const stops = (window.AUSTIN1885_STOPS || { features: [] }).features;
const calibrated = window.AUSTIN1885_SITES || [];

// Web-page-only adjustments — the walking-tour app is untouched by these.
// OMIT_ORDERS hides a stop from this page; EXTRA_LINES adds a sentence to a
// card (rendered as web_extra by storyCard.js). Both are empty: stop 2 was
// briefly omitted while its clip froze some browsers, and restored once the
// real cause (hardware video decoding) was removed by switching every clip
// to animated WebP.
const OMIT_ORDERS = new Set();
const EXTRA_LINES = {};

// join QGIS squares → stop properties by `order`
const sites = calibrated.map((sq) => {
  if (OMIT_ORDERS.has(sq.order)) return null;
  const stop = stops.find((f) => f.properties.order === sq.order);
  if (!stop) { console.warn('site square with no stop, order', sq.order); return null; }
  return { ...sq, props: { ...stop.properties, web_extra: EXTRA_LINES[sq.order] || '' } };
}).filter(Boolean).sort((a, b) => a.order - b.order);

// Warm the browser cache so each card's clip is ready the instant it opens.
// ?v= must match storyCard.js — bump both when the .webp files change.
sites.forEach((s) => { const img = new Image(); img.src = `assets/clips/stop-0${s.order}.webp?v=4`; });

let ctx;
try {
  ctx = createScene(document.getElementById('scene'));
} catch (e) {
  console.warn('WebGL unavailable:', e);
  showFallback();
}

if (ctx) {
  loadMapPlane(ctx.scene, (mapPlane) => {
    ctx.setMapSize(mapPlane.planeW, mapPlane.planeD);
    const card = createStoryCard();
    const lantern = createLantern({ uniforms: mapPlane.uniforms, sites });

    const project = (point) => {
      const p = point.clone().project(ctx.camera);
      return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
    };

    const hotspots = createHotspots({
      scene: ctx.scene, sites, mapPlane, lantern, uniforms: mapPlane.uniforms,
      callbacks: {
        onHover(it) {
          const s = project(it.point);
          card.show(it.site.props, s.x, s.y);
          ctx.autoZoomIn(); // lean in over the lit site...
        },
        onLeave() { card.hide(); ctx.autoZoomOut(); }, // ...and settle back out
      },
    });

    document.getElementById('zoom-in').addEventListener('click', () => ctx.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => ctx.zoomOut());

    // The mouse never moves the map or the light. Its one power: clicking an
    // ember sends the lantern there and pins the card; clicking empty map (or
    // closing the card) releases the light back to its tour.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pickSite(e) {
      ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, ctx.camera);
      const hit = raycaster.intersectObject(mapPlane.mesh, false)[0];
      if (!hit || !hit.uv) return null;
      const u = hit.uv.x, v = hit.uv.y;
      // generous hit area: the owner's square, never smaller than a fingertip
      return sites.find((s) =>
        Math.abs(u - s.u) < Math.max(s.halfW, 0.015) * 1.8 &&
        Math.abs(v - s.v) < Math.max(s.halfH, 0.015) * 1.8) || null;
    }

    let pinnedAt = 0; // for the walk-away timeout below
    window.addEventListener('pointerdown', (e) => {
      pinnedAt = performance.now();
      if (e.target.closest('#zoom-ui, #promo, #story-card')) return; // UI clicks aren't map clicks
      const site = pickSite(e);
      if (site) {
        const s = project(mapPlane.uvToWorld(site.u, site.v));
        card.pin(site.props, s.x, s.y);
        lantern.goTo(site); // the light glides over; flare + zoom follow it
      } else {
        card.unpin();
        lantern.release();
      }
    });
    card.onUnpin(() => lantern.release()); // ✕ or Escape also resumes the tour

    // cursor becomes a pointer over a clickable ember — an affordance, not a reaction
    window.addEventListener('pointermove', (e) => {
      ctx.renderer.domElement.style.cursor = pickSite(e) ? 'pointer' : 'default';
    });

    ctx.onTick((t, dt) => {
      lantern.update(t, dt);
      hotspots.update(t);
      // zoom pulls toward wherever the lantern is
      ctx.zoomAnchor.copy(mapPlane.uvToWorld(lantern.pos.x, lantern.pos.y));
      // keep the card glued to its marker while the camera zooms
      const it = hotspots.getCurrent();
      if (it) { const s = project(it.point); card.place(s.x, s.y); }
      // Walk-away timeout: a pinned card holds the tour by design, but if the
      // visitor clicks nothing for 45 s, release the light back to its rounds.
      if (card.isPinned() && performance.now() - pinnedAt > 45000) card.unpin();
    });

    if (!sites.length) console.info('No calibrated sites — see web/README.md.');
  }, (err) => {
    console.warn('map texture failed to load:', err);
    showFallback();
  });
}
