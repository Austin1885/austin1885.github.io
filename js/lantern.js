// The lantern is autonomous. It tours the crime scenes on its own — gliding site
// to site, lingering long enough for each card's clip to play out. The mouse never
// steers it: cursor-following made every hand twitch yank the light off a site
// mid-clip (cards vanished/restarted and read as freezes). Clicking a site calls
// goTo(), which holds the light there until release().
import * as THREE from 'three';

export function createLantern({ uniforms, sites }) {
  const target = new THREE.Vector2(0.5, 0.5);
  const pos = new THREE.Vector2(0.5, 0.5);
  let held = null;                 // where a click parked the light; pauses the tour
  let tourIndex = 0, tourDwell = 0;
  let sinceAdvance = 0;            // watchdog: a healthy visit is ~23s (glide+dwell)

  return {
    pos, // eased position in UV — hotspots read this to know what's lit
    // "settled" = the light has arrived somewhere and stopped moving. Hotspots
    // only flare a settled lantern, so gliding PAST a site never triggers it
    // (Eliza Shelley's and Mary Ramey's sites are a block apart — mid-glide
    // triggering made their cards fight and killed the video).
    isSettled() { return pos.distanceTo(target) < 0.015; },
    goTo(site) { held = new THREE.Vector2(site.u, site.v); },
    release() { held = null; },
    update(t, dt) {
      if (held) {
        target.lerp(held, Math.min(1, dt * 1.5)); // answer the click promptly
        sinceAdvance = 0;
      } else if (sites.length) {
        const s = sites[tourIndex % sites.length];
        sinceAdvance += dt;
        if (Math.hypot(s.u - target.x, s.v - target.y) < 0.01) {
          tourDwell += dt;
          // clip = 2s flyover + 3s street hold + ~7s timelapse, plus a beat to take it in
          if (tourDwell > 13) { tourDwell = 0; tourIndex++; sinceAdvance = 0; }
        } else {
          target.lerp(new THREE.Vector2(s.u, s.v), Math.min(1, dt * 0.38)); // unhurried
        }
        // Watchdog — the tour must never die quietly. If a visit somehow runs
        // long past any healthy timing, snap to the site; much longer, move on.
        if (sinceAdvance > 25 && sinceAdvance < 26) {
          console.info('lantern watchdog: snapping to site', s.u.toFixed(3), s.v.toFixed(3));
          target.set(s.u, s.v);
        } else if (sinceAdvance > 45) {
          console.info('lantern watchdog: forcing advance past stuck site');
          tourDwell = 0; tourIndex++; sinceAdvance = 0;
        }
      }
      pos.lerp(target, Math.min(1, dt * 4)); // the light has a little weight
      uniforms.uLantern.value.copy(pos);
      uniforms.uTime.value = t;
    },
  };
}
