// The story card: plain DOM, no three.js. Filled from the stop's properties and
// positioned near the marker's projected screen position. Hover shows it; click
// pins it (also how touch works); Escape or ✕ unpins.
export function createStoryCard() {
  const el = document.getElementById('story-card');
  const closeBtn = el.querySelector('.close');
  let pinned = false;
  let onUnpinCb = null; // main.js uses this to resume the lantern's tour

  // "1884-12-30" → "December 30, 1884". timeZone UTC so the date can't slip a day.
  function formatDate(iso) {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US',
      { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  function fill(props) {
    // The clip is an animated WebP in a plain <img> — deliberately NOT a
    // <video>. Hardware video decoders share the GPU with WebGL (and whatever
    // else the machine runs); under load the decoder starved and clips froze
    // until a window switch reset it. Animated images decode on the CPU, so
    // that whole failure mode is gone. onerror removes the element so a
    // missing file never shows a broken box.
    // ?v= busts browser caches when clips are re-encoded — bump it (and the
    // matching one in main.js) whenever the .webp files change.
    const clip = props.order >= 1 && props.order <= 7
      ? `<img class="clip" src="assets/clips/stop-0${props.order}.webp?v=6" alt=""
           onerror="this.remove()">
         <div class="cliprow">
           <button class="replay" title="Play the transformation again">↻ replay</button>
           <span class="clipcap">the map becomes the city</span>
         </div>`
      : '';
    const firstSentence = (props.site_today || '').split(/(?<=\.)\s/)[0] || '';
    const video = props.youtube_id && props.youtube_id !== 'TBD'
      ? `<a href="https://www.youtube.com/watch?v=${props.youtube_id}" target="_blank" rel="noopener">Watch the episode →</a>`
      : '';
    el.innerHTML = `<span class="close" title="Close">✕</span>
      ${clip}
      <h3><span class="num">${props.order}</span>${props.victim}</h3>
      <div class="date">${formatDate(props.date)} · ${props.title}</div>
      <div class="addr">${props.period_address || props.historic_address || ''}</div>
      <div class="blurb">${firstSentence}</div>
      ${props.web_extra ? `<div class="blurb">${props.web_extra}</div>` : ''}
      ${video}`;
    el.querySelector('.close').addEventListener('click', unpin);
    // replay: re-setting the src restarts an animated image from frame one
    el.querySelector('.replay')?.addEventListener('click', () => {
      const img = el.querySelector('img.clip');
      if (img) { const s = img.src; img.src = ''; img.src = s; }
    });
  }

  let placedX = null, placedY = null;
  function place(x, y, snap = false) {
    // Dead zone: the marker jiggles a little every frame (camera drift), and a
    // card that copies every jiggle looks shaky. Ignore small moves; when a real
    // move happens (zoom), CSS transitions glide the card over (see index.html).
    if (!snap && placedX !== null && Math.abs(x - placedX) + Math.abs(y - placedY) < 14) return;
    placedX = x; placedY = y;
    if (snap) { el.style.transition = 'none'; }
    const w = el.offsetWidth, h = el.offsetHeight, pad = 12;
    el.style.left = Math.round(Math.min(Math.max(x + 24, pad), window.innerWidth - w - pad)) + 'px';
    el.style.top = Math.round(Math.min(Math.max(y - h / 2, pad), window.innerHeight - h - pad)) + 'px';
    if (snap) { el.offsetHeight; el.style.transition = ''; } // reflow, then re-arm the glide
  }

  function show(props, x, y) {
    if (pinned) return;
    fill(props);
    el.style.display = 'block';
    document.body.classList.add('card-open'); // promo pills fade out (index.html CSS)
    place(x, y, true); // snap on first show — no glide from the previous card's spot
  }
  function hide() {
    if (pinned) return;
    el.style.display = 'none';
    document.body.classList.remove('card-open');
  }
  function pin(props, x, y) {
    pinned = false; show(props, x, y); // refill, then lock
    pinned = true;
    el.classList.add('pinned');
  }
  function unpin() {
    pinned = false; el.classList.remove('pinned');
    el.style.display = 'none';
    document.body.classList.remove('card-open');
    if (onUnpinCb) onUnpinCb();
  }

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') unpin(); });
  closeBtn.addEventListener('click', unpin);

  return { show, hide, pin, unpin, place, isPinned: () => pinned, onUnpin(fn) { onUnpinCb = fn; } };
}
