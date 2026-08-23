# Austin, 1885 — The Servant Girl Murders

The front page for the Austin 1885 project: the 1887 Augustus Koch bird's-eye
map of Austin sunk in darkness, explored by a wandering pool of gaslight.

**Live site:** https://austin1885.github.io

## How the page behaves

- The lantern tours the seven murder sites on its own, in chronological order,
  lingering at each long enough for its story card and clip to play out.
- Each site smolders in the dark and flares when the light reaches it, opening
  a card: the victim's name, the date, the address, a short map clip, and a
  link to that stop's episode.
- Clicking a glowing site sends the lantern there and pins the card; clicking
  empty map (or the card's ✕) releases the light back to its rounds.
- Zoom with the mouse wheel or the +/− buttons.

## What's in the repo

- `index.html` — the whole page: styles, layout, and the script imports.
- `js/` — small single-purpose modules: `scene.js` (camera + zoom),
  `mapPlane.js` (the map in darkness), `lantern.js` (the self-touring light),
  `hotspots.js` (when a site counts as lit), `storyCard.js` (the cards),
  `sites.js` (where the seven sites sit on the map), `main.js` (wires it all).
- `data/stops.js` — the stop data: victims, dates, addresses, episode links.
- `assets/` — the 1887 map image and the short card clips.

Everything is plain JavaScript served as static files — no build step, no
framework. three.js loads from a CDN. To run it locally, serve the folder with
any static server (e.g. `python3 -m http.server`) and open it in a browser.

## About the history

The page memorializes the victims of the 1884–1885 "Servant Girl Annihilator"
murders in Austin, Texas. Most of the victims were Black servant women whose
deaths were under-investigated in their own time; the project's rule throughout
is a respectful memorial tone — victims led with as people, no gore, no
invented details, and lore always labeled as lore.

## Contact

**contact@austin1885.city**
