// Crime-scene embers. Each site smolders faintly in the dark; when the lantern's
// light reaches it, it flares. "Hover" here means the LANTERN covers the site —
// not the raw cursor — so the idle self-tour reveals sites exactly like a visitor
// sweeping the light by hand would.
import * as THREE from 'three';

const EMBER_COLOR = 0xe8a13c; // --amber
const FLARE_COLOR = 0xf2d9a8; // --lit

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createHotspots({ scene, sites, mapPlane, lantern, uniforms, callbacks }) {
  const glow = makeGlowTexture();
  const aspect = mapPlane.planeW / mapPlane.planeD;

  const items = sites.map((site) => {
    const point = mapPlane.uvToWorld(site.u, site.v);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: EMBER_COLOR, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.position.copy(point).setY(0.012);
    scene.add(sprite);
    return { site, sprite, point };
  });

  let current = null;

  function update(t) {
    // Hysteresis: a site flares only when the settled lantern is well inside the
    // pool (enter), and stays flared until the light truly leaves (exit). Without
    // the gap, two neighboring sites at the radius boundary flip-flop and their
    // cards churn — restarting videos over and over.
    const enter = uniforms.uRadius.value * 0.4;
    const exit = uniforms.uRadius.value * 0.75;
    const dist = (it) => Math.hypot((it.site.u - lantern.pos.x) * aspect, it.site.v - lantern.pos.y);

    let hit = current;
    if (current && dist(current) > exit) hit = null;      // only lose a site by leaving it
    if (!hit && lantern.isSettled()) {                    // only gain a site once parked
      let best = Infinity;
      for (const it of items) {
        const d = dist(it);
        if (d < enter && d < best) { best = d; hit = it; }
      }
    }
    if (hit !== current) {
      current = hit;
      if (hit) callbacks.onHover(hit); else callbacks.onLeave();
    }
    for (const it of items) {
      const isHot = it === current;
      it.sprite.material.color.setHex(isHot ? FLARE_COLOR : EMBER_COLOR);
      const pulse = 1 + Math.sin(t * 2.2 + it.point.x * 9) * 0.15;
      it.sprite.scale.setScalar((isHot ? 0.06 : 0.03) * pulse);
      // embers stay dim so the dark keeps its secrets; the flare is unmistakable
      it.sprite.material.opacity = isHot ? 1 : 0.28;
    }
  }

  return { update, getCurrent: () => current };
}
