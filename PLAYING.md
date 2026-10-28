# Crescent Seas: Empires of the Monsoon

A standalone, client-side 3D naval adventure across the Muslim maritime world. Serve regional courts, defend trade, confront armed European colonial and imperial fleets, recover artifacts, and improve your ship through generated voyages. It has its own engine, interface, artwork, and progression; it does not use the shared game toolkit elsewhere in this workspace.

## Run

Open `index.html` directly in a modern browser with WebGL enabled. There are no packages to install, no build step, no CDN requests, and no backend. Graphics, illustrations, and sound are generated locally.

For a consistent browser-storage origin, a local static server also works:

```sh
cd /Users/muhammad/Documents/GitHub/ummah-games/crescent-seas
python3 -m http.server 8771 --bind 127.0.0.1
```

Then visit [the local game](http://127.0.0.1:8771/). Saving is per browser and origin; a `file:` launch and a local-server launch have separate profiles.

## Sail and fight

| Input | Action |
| --- | --- |
| Left/right arrows, A/D, numpad 4/6 | Turn the helm to port/starboard |
| Up arrow, W, numpad 8 | Full sails |
| Down arrow, S, numpad 2 | Reef sails for tighter turns and less storm exposure |
| Space, numpad 5 | Fire at an enemy within either broadside |
| Q / R | Fire the port / starboard battery manually |
| 1 / 2 / 3 | Round / chain / grape shot |
| Numpad 3 / 7 / 1 | Round / chain / grape shot, classic keypad layout |
| B | Board a nearby, weakened enemy |
| E | Dock at a nearby harbor |
| M / J / H | Sea chart / voyage journal / handbook |
| G / T / K | Sea atlas / nearby Turning Water / history and legend |
| N | Follow a plotted waypoint, or the current objective if none is plotted |
| C | Toggle chase camera |
| Drag on the sea / mouse wheel | Orbit the camera / zoom |
| Escape / P | Pause |

Touch controls provide helm buttons, sail settings, ammunition, firing, boarding, and harbor actions. Click the full chart to plot a course. Manual steering cancels navigation assistance.

Your ship keeps moving when you release the controls. Wind direction changes its best course; reefing reduces speed and tightens the turn. Ships, islands, and cannonballs are 3D meshes. Cannonballs have visible travel time and parabolic vertical arcs, giving a turning ship an opportunity to evade a volley.

Round shot emphasizes hull damage at long range; chain shot emphasizes sails at medium range; grape emphasizes crew at short range. A weakened ship can be boarded within 53 world yards. Its sails must be below 43%, its crew below roughly half its starting complement, or its hull below 43%; your boarding party must also be strong enough. Capturing pays more than sinking.

Sail over floating cargo to collect it. Docking sells it automatically. Repairs replenish hull, rigging, and crew. Purchasing a larger ship transfers fittings and artifact bonuses, and supplies a full crew. If your ship sinks, a tender returns you to your last harbor with your equipment intact and a loss of some coin and cargo.

## Seas, patrons, and centuries

The setting follows [Crescent_Seas_Game_Concept.md](Crescent_Seas_Game_Concept.md). This implementation keeps the Free Captain structure: there is no mandatory sequence of scripted acts.

| Open sea | Era layer | Available patrons |
| --- | --- | --- |
| Malabar & Gujarat | 1530 | Marakkar captains serving Calicut’s Zamorin; Gujarat Sultanate |
| Red Sea & Arabia | 1510 | Mamluk Sultanate; Arab merchant houses |
| Ottoman Eastern Mediterranean | 1580 | Ottoman Empire; Arab merchant houses |
| Maghrebi Corsair Seas | 1600 | Algiers captains; Tunis court; Ottoman Empire |
| Atlantic Morocco | 1630 | Moroccan sultanate; Salé captains |
| Swahili & Omani Sea Routes | 1700 | Swahili merchant councils; Omani maritime power |
| Aceh & the Malacca Strait | 1635 | Aceh Sultanate; Johor court |

Each theater has a separate, larger map, ten landmasses, four or five friendly harbors, regional winds, squalls, opposing fleets, patron offers, and a visual palette. Maps range from 4,400–5,000 by 3,400–3,800 world units, compared with the prototype’s 2,800 by 2,100. Geography is compressed and fictionalized. Distinct silhouettes loosely evoke the tapering Indian coast, the Red Sea corridor, long Crete, pointed Cyprus, Sardinia, Zanzibar and Pemba, the Moroccan Atlantic shore, and diagonal Sumatra opposite a Malay peninsula. Continental shores continue beyond the chart edge; atolls have visible shallow lagoons whose reef footprint remains hazardous to ships. These are playable interpretations, not accurate coastal surveys.

Port models use regional variations in vegetation, roof forms, masonry, towers, and dock buildings. Your ship uses lateen sails in Indian Ocean and Atlantic settings, and oared galley-inspired rigs in the Mediterranean. European armed ships retain a contrasting square-rigged silhouette. Ship tiers and equipment remain accessible gameplay abstractions rather than exact year-by-year technology reconstructions.

Patrons appear on voyage cards. Accepting a commission changes your active service and applies that patron’s advantage. Examples include Gujarati commission credit, Marakkar coastal speed, Mamluk refit support, Ottoman cannon reach, and Moroccan storm pilotage. Delivered commissions increase the issuing patron’s standing. The harbor’s **Patrons** tab can request offers from a particular local court when you have no active voyage.

Opposing ships belong to armed colonial or imperial squadrons, including Portuguese forces, Spanish and Venetian fleets, Hospitaller forces, and later Dutch or other company squadrons according to theater. Independent traders, including European merchants, can be neutral. Generated names and individual missions are fictional.

### Rare Turning Waters

Every completed voyage contributes one star-path fragment. After **three completed voyages**, the Astrolabe charts a luminous whirlpool in the current sea. This is an earned progression event, not a frequent random hazard or a mandatory story transition.

1. Finish the active voyage and open the atlas with **G**.
2. Plot the charted Turning Water, then sail to it. It remains charted until used.
3. Within 120 world yards, press **T** or use the context button.
4. Choose a revealed passage. Early crossings reveal a new sea; later ones can also offer a known return destination.
5. The ship, crew, condition, cargo, gold, equipment, artifacts, and captain progression cross together. The new sea receives fresh encounters and commissions.

Crossing consumes three fragments and requires three more completed voyages before another passage. There is no instant world-selection fast travel in the atlas. You can stay in any theater indefinitely and keep generating voyages there.

The current world ID also fixes the era. The first outward passage can therefore move from Malabar in 1530 back to the Red Sea in 1510; later crossings are not a chronological level ladder. The atlas shows dates and visited seas, while the history/legend panel distinguishes the concept’s historical inspirations from the invented Turning Waters.

## Generated voyages

A new captain begins with a short two-leg introduction to salvage and bounty hunting. Thereafter the harbor board offers three generated voyages at a time. Each has two or three linked objectives. Completing a voyage pays a bonus and creates three new offers; there is no fixed final campaign.

Four voyage families use seven objective types:

| Voyage family | Example chains |
| --- | --- |
| Prize hunting | Recover a chart → capture a named treasure ship |
| Lost artifacts | Recover supplies → find a rare navigation instrument |
| Letters of marque | Hunt a raider → defeat a fortified warship |
| Merchant charters | Escort a merchant → hunt the ship threatening its route |

The generator varies routes, objective locations, delivery ports, ship names and classes, swift/armored/veteran traits, artifact types and rarities, payouts, and chain composition. Renown raises the generation tier, with caps on encounter strength. A chart can explicitly lead to the next target. Each region has deliberately designed geography; its voyages, weather placement, and encounters vary.

The 3D terrain, atlas, full chart, collisions, and route planner share the same coastline polygons. Mission cargo and ships spawn clear of those actual outlines, including long peninsulas and adjoining mainland features. Harbor approaches face seaward. Escorts plan routes using a coastline visibility graph weighted by sailing efficiency. Lost escorts can be relaunched by docking; sinking a ship that must be captured triggers a replacement. Entity limits keep repeated voyages from accumulating an unbounded world.

The generator is seeded and deterministic, so a particular seed can be reproduced in tests. This is a rule-based generator using authored objective families and vocabulary, not an online text-generation service.

## Your ship

The shipwright uses illustrated fittings, level pips, and before/after numbers:

- Cotton sails improve speed; copper plating improves handling.
- Iron scantlings strengthen the hull; fine powder extends range.
- Bronze cannon improve damage and grouping; veteran gunners improve reloads and crew capacity.
- A weather glass reduces storm damage.

The medium ship tier unlocks after two delivered commissions, and the heavy tier after four; displayed vessel families vary by theater. The harbor offers teal, indigo, and ochre liveries. Copper and reinforced hull fittings also change the 3D ship’s appearance.

Artifact voyages can yield compasses, sextants, lanterns, and pennants. Deliver discoveries to port to retain them and apply small, capped bonuses to speed, range, storm resistance, or boarding. The illustrated cabinet shows the most recent 24 curiosities; the ship’s aggregate bonuses remain bounded even after more discoveries.

## Saving

The game deliberately saves a **captain profile**, not an exact simulation snapshot:

- Gold, cargo value, renown/level, delivered-commission and completed-voyage counts.
- Ship class, hull/sail/crew condition, livery, and upgrade levels.
- Retained curiosities and their aggregate ship bonuses.
- A few totals such as prizes captured, enemies defeated, and cargo recovered.
- Current sea/era, last regional harbor, discovered seas, court standing, and bounded whirlpool progression counters.

On resume, you return near the last harbor **in the saved sea and era**, with your captain and ship. That sea receives fresh encounters and a new choice of voyages. Earned whirlpool eligibility and discovered regions remain. Active objectives, enemy positions, projectiles, dropped cargo, chart waypoints, and a history of every accomplishment are intentionally not restored.

Profiles save automatically during play, on purchases, at ports, when pausing, and when leaving the page. Browser storage failures leave the current session playable and show a notice. New-voyage confirmation resets the profile. The initial prototype’s older save can be migrated into this profile format.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | Game shell, HUD, menus, responsive layout |
| `src/worlds.js` | Seven theater definitions, regional ports, patrons, eras, ship labels, and palettes |
| `src/engine.js` | Fixed-step simulation, combat, generation, route planning, progression, profile persistence |
| `src/renderer.js` | Native WebGL, procedural geometry, water shader, camera, particles, visible ship fittings |
| `src/art.js` | Original vector illustrations for equipment, vessels, tasks, and artifacts |
| `src/game.js` | Input, menus, chart, audio, save scheduling, and simulation/render loop |
| `tests/engine.test.cjs` | Node standard-library simulation and generation tests |
| `README.md` | Original Pirates! research, with a link to this implementation |

Run the tests from the workspace root:

```sh
node --test crescent-seas/tests/engine.test.cjs
```

Tests cover wind and sail handling, firing geometry, projectile arcs, ammunition effects, capture, delivery, purchases, weather, recovery, repeated generated voyages, generation across 250 seeds, all harbor-to-harbor escort routes, artifact bonuses, and compact profile persistence. Additional tests cover all seven theaters, 100 regional escort routes, polygon coast clearance, safe harbor approaches, distinct patron service, earned whirlpool access, cross-era travel, and world-aware profile restoration. Browser QA covers WebGL startup, portrait and desktop layouts, patron and atlas screens, and the production renderer across all seven seas. `tests/visual.html` is a clearly labeled renderer/transition fixture that does not read or write captain saves.

The game is an original compact interpretation of the researched sailing/combat ideas. Boarding resolves as a crew contest; it does not include a separate sword-fighting game. No original Pirates! code, models, audio, or textures are included.
