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
    // Dispose the outgoing video BEFORE innerHTML discards it. A dropped <video>
    // keeps its hardware decoder until GC; churn enough cards and the browser's
    // decoder pool runs dry — the next clip simply stalls (the biggest file,
    // Eliza Shelley's, always hit that wall first). Pause + clear src + load()
    // is the standard way to release the decoder immediately.
    const old = el.querySelector('video');
    if (old) { old.pause(); old.removeAttribute('src'); old.load(); }
    // orders 1-7 have a compressed flyover loop (web/assets/clips/, see README);
    // onerror removes the element so a missing file never shows a broken box
    const clip = props.order >= 1 && props.order <= 7
      ? `<video class="clip" src="assets/clips/stop-0${props.order}.mp4"
           muted playsinline autoplay onerror="this.remove()"></video>
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
      <h3>${props.victim}</h3>
      <div class="date">${formatDate(props.date)} · ${props.title}</div>
      <div class="addr">${props.period_address || props.historic_address || ''}</div>
      <div class="blurb">${firstSentence}</div>
      ${props.web_extra ? `<div class="blurb">${props.web_extra}</div>` : ''}
      ${video}`;
    el.querySelector('.close').addEventListener('click', unpin);
    // replay: rewind the card's own video — pure DOM, touches nothing else
    el.querySelector('.replay')?.addEventListener('click', () => {
      const v = el.querySelector('video');
      if (v) { v.currentTime = 0; v.play(); }
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
    place(x, y, true); // snap on first show — no glide from the previous card's spot
  }
  function hide() {
    if (pinned) return;
    el.querySelector('video')?.pause(); // display:none alone doesn't stop playback
    el.style.display = 'none';
  }
  function pin(props, x, y) {
    pinned = false; show(props, x, y); // refill, then lock
    pinned = true;
    el.classList.add('pinned');
  }
  function unpin() {
    pinned = false; el.classList.remove('pinned');
    el.querySelector('video')?.pause();
    el.style.display = 'none';
    if (onUnpinCb) onUnpinCb();
  }

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') unpin(); });
  closeBtn.addEventListener('click', unpin);

  return { show, hide, pin, unpin, place, isPinned: () => pinned, onUnpin(fn) { onUnpinCb = fn; } };
}
