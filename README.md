# Crescent Seas: Empires of the Monsoon

An open-ended, client-side 3D naval adventure across the Muslim maritime world. Captain a ship, serve regional courts, protect trade, confront armed colonial and imperial fleets, collect prizes and artifacts, and improve your vessel through generated voyages.

[Play the game](index.html) · [Captain’s handbook](PLAYING.md) · [Setting concept](Crescent_Seas_Game_Concept.md)

## Run locally

Open `index.html` in a modern browser with WebGL enabled. The game uses plain HTML, CSS, and JavaScript, with no build step, packages, CDN assets, or backend.

For a consistent browser-storage origin, serve this folder:

```sh
cd crescent-seas
python3 -m http.server 8771 --bind 127.0.0.1
```

Visit [Crescent Seas locally](http://127.0.0.1:8771/). Browser profiles are stored separately for each origin.

## An open sea, an ongoing career

Sail, recover cargo, accept a commission, pursue its leads, return to a harbor, and invest the proceeds in your ship. The harbor offers three generated voyages at a time. Voyages combine two or three objectives drawn from salvage, chart recovery, artifact discovery, raider hunts, intact prize capture, merchant escort, and flagship combat. Completing one creates new offers; there is no fixed final campaign.

Routes, patrons, opponents, ship traits, rewards, and discoveries vary with the seeded generator and captain progression. Encounter strength and world entity counts have limits so the career can continue without unbounded difficulty or simulation growth.

## Seven seas and their patrons

| Open sea | Year | Patrons |
| --- | --- | --- |
| Malabar & Gujarat | 1530 | Marakkar captains; Gujarat Sultanate |
| Red Sea & Arabia | 1510 | Mamluk Sultanate; Arab merchant houses |
| Ottoman Eastern Mediterranean | 1580 | Ottoman Empire; Arab merchant houses |
| Maghrebi Corsair Seas | 1600 | Algiers captains; Tunis court; Ottoman Empire |
| Atlantic Morocco | 1630 | Salé captains; Moroccan sultanate |
| Swahili & Omani Sea Routes | 1700 | Swahili merchant councils; Omani maritime power |
| Aceh & the Malacca Strait | 1635 | Aceh Sultanate; Johor court |

Each theater has its own ports, winds, opposing armed fleets, patron advantages, architecture, vegetation, ship presentation, and sea palette. Coastlines loosely evoke major coastal forms and islands while remaining compressed, fictionalized sailing spaces. The same shoreline polygons drive the 3D terrain, charts, collisions, offshore placement, and route planning.

Accepting a commission establishes active service with its patron. Deliveries increase that court’s standing. The in-game history and legend panel distinguishes historical inspirations from fictional missions and time travel.

## The Turning Waters

Every completed voyage contributes a star-path fragment. Three completed voyages reveal a rare whirlpool. Finish the current commission, sail to the charted vortex, and choose a revealed passage to another sea and era.

Your ship, crew, condition, cargo, treasury, equipment, and progression cross together. Passage consumes three fragments; another crossing requires three more completed voyages. You can remain in any sea indefinitely and continue accepting generated work.

## Sailing, combat, and ship improvements

Canvas and oars are separate controls: V/X/Z select full, reefed, or furled sails, F cycles them, and holding ↑/W rows on eligible light craft and galleys. Furled sails provide no hidden wind power; sailing upwind requires tacking outside the no-go sector, or using oars. Crew endurance limits rowing, and larger sailing vessels rely on sail.

Wind angle, sail setting, hull condition, rigging damage, crew strength, fittings, and patron bonuses influence sailing. Seeded weather fronts bring lulls, fresh breezes, gale winds, and larger direction changes. Occasional storm cells build offshore, drift, and dissipate. Reefing sacrifices speed for tighter handling and reduced storm exposure. Moving squalls bring local gusts, rougher waves, rain, and damage to exposed ships.

Charted reef clusters can damage hulls, while crosscurrents pull ships off course. Ship-to-ship collisions damage both vessels according to closing speed and relative size. Grounding and reef strikes affect player and AI ships. Whitecaps, intermittent breaking crests, and ship heave/roll make sea conditions visible.

Cannons fire from the ship’s sides. Round shot emphasizes hull damage, chain shot disables rigging, and grape shot weakens crew. Visible projectile travel gives ships time to maneuver. Boarding requires a nearby, weakened opponent and a sufficiently strong crew; an intact prize is more valuable than a sinking.

Destroyed ships break apart and sink over several seconds, accompanied by synthesized timber cracks, creaks, and water sounds. Player destruction completes its 5.8-second sequence before rescue returns the captain to harbor. Captured prizes remain distinct from destroyed vessels.

Illustrated shipwright panels offer sails, copper plating, hull reinforcement, powder, cannon, gunners, and weather equipment. Larger vessels retain installed fittings and artifact bonuses. Liveries and some fittings change the visible ship model.

See [PLAYING.md](PLAYING.md) for controls, combat thresholds, upgrade details, and recovery rules.

## Simulation and graphics

The simulation advances at a fixed 60 steps per second, independently of the render rate. Forward motion uses `dx = sin(heading) × speed × dt` and `dz = cos(heading) × speed × dt`. A simplified wind polar sets sailing efficiency; speed eases toward its target instead of changing instantly. Navigation uses a coastline visibility graph weighted by wind efficiency.

Cannonballs combine horizontal velocity with an authored parabolic height curve:

```text
q = clamp(age / lifetime, 0, 1)
height = 3 × (1 − q) + 4 × arc × q × (1 − q)
```

This gives each ammunition type a readable flight arc and brings the shot to sea level at the end of its lifetime. Swept collision checks help fast shots register between simulation steps.

The native WebGL renderer builds low-poly ships, coastal terrain, vegetation, port buildings, and effects locally. Water uses animated shader waves, approximate coastal shallows, lighting, and distance fog. Regional lateen and galley-inspired rigs contrast with opposing square-rigged ships. Interface illustrations use locally authored SVG; audio is synthesized in the browser.

## Compact captain saves

The game saves the captain rather than the entire simulation: gold, cargo, progression, basic statistics, ship condition, fittings, livery, artifacts, court standing, discovered seas, current sea and harbor, and whirlpool progression.

Loading returns the captain to the saved sea with fresh encounters and voyage offers. Active missions, enemy positions, projectiles, dropped cargo, and a detailed accomplishment history are not restored. Saves use browser local storage and remain on the device and origin where the game is played.

## Source and validation

| File | Responsibility |
| --- | --- |
| `index.html`, `style.css` | Game shell, responsive HUD, and menus |
| `src/worlds.js` | Seas, coastline silhouettes, ports, eras, patrons, and palettes |
| `src/engine.js` | Sailing, combat, generation, navigation, progression, and saves |
| `src/renderer.js` | Native WebGL geometry, water, camera, and effects |
| `src/audio.js` | Shared timber-breaking, creaking, and sinking-water audio |
| `src/art.js` | Vector illustrations for ships, fittings, tasks, and artifacts |
| `src/game.js` | Input, UI, charts, audio, and simulation/render scheduling |
| `PLAYING.md` | Detailed player guide and implementation behavior |
| `tests/engine.test.cjs` | Simulation and progression regression tests |
| `tests/visual.html` | Isolated renderer and world-transition QA without captain saves |

Run the tests from this folder:

```sh
node --test tests/engine.test.cjs
```

Coverage includes separate sail/oar propulsion, crew endurance, timed sinking and rescue, friendly/hostile wrecks, capture distinctions, loss-aware saves, sailing, projectile arcs, ammunition, boarding, delivery, purchases, storms, generated voyages, profile persistence, patron service, rare passages, changing weather, collision damage, reef strikes, current drift, coastline clearance, and all 100 regional harbor-to-harbor escort routes.
