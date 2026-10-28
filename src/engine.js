/* Wake of the Corsair — deterministic, renderer-independent sea simulation. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const bearing = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const CLASSES = {
    sloop: { name: 'Sloop', guns: 8, hull: 120, crew: 40, speed: 43, turn: .86, length: 23, beam: 7, cost: 0 },
    brig: { name: 'Brig', guns: 14, hull: 190, crew: 65, speed: 39, turn: .65, length: 29, beam: 9, cost: 850 },
    frigate: { name: 'Frigate', guns: 20, hull: 280, crew: 95, speed: 42, turn: .49, length: 36, beam: 10, cost: 1800 },
    galleon: { name: 'Galleon', guns: 18, hull: 240, crew: 70, speed: 26, turn: .38, length: 34, beam: 12, cost: 0 },
    flagship: { name: 'War frigate', guns: 24, hull: 440, crew: 120, speed: 33, turn: .42, length: 42, beam: 13, cost: 0 }
  };
  const AMMO = {
    round: { name: 'Round shot', range: 285, speed: 105, arc: 16, damage: 7.5 },
    chain: { name: 'Chain shot', range: 210, speed: 78, arc: 27, damage: 4.5 },
    grape: { name: 'Grape shot', range: 125, speed: 112, arc: 8, damage: 3.5 }
  };
  const UPGRADES = [
    { id: 'sails', name: 'Cotton sails', icon: '◭', desc: 'Catch more wind. +12% sailing speed per level.', cost: 180, max: 3 },
    { id: 'copper', name: 'Copper plating', icon: '≋', desc: 'A clean, quick hull. +14% turning response per level.', cost: 160, max: 3 },
    { id: 'hull', name: 'Iron scantlings', icon: '⬡', desc: 'Reinforce the ribs. +25% maximum hull per level.', cost: 210, max: 3 },
    { id: 'powder', name: 'Fine-grain powder', icon: '✺', desc: 'Reach them first. +12% cannon range per level.', cost: 200, max: 3 },
    { id: 'bronze', name: 'Bronze cannon', icon: '●', desc: 'Tighter volleys, harder hits. +12% damage; less spread.', cost: 230, max: 3 },
    { id: 'crew', name: 'Veteran gunners', icon: '⚑', desc: 'A practiced crew. Faster reloads and stronger boarding.', cost: 190, max: 3 },
    { id: 'weather', name: 'Weather glass', icon: '⌁', desc: 'Read the squalls. Reduce storm damage by 70%.', cost: 240, max: 1 }
  ];
  const ISLANDS = [
    { id: 'haven', name: 'Port Haven', x: -1010, z: 475, r: 160, h: 54, port: { x: -808, z: 475 }, color: 0, subtitle: 'FREE PORT · SHIPWRIGHT' },
    { id: 'maren', name: 'Saint Maren', x: -350, z: -210, r: 154, h: 75, port: { x: -155, z: -195 }, color: 1, subtitle: 'MERCHANT REPUBLIC' },
    { id: 'bastion', name: 'Crown’s Reach', x: 535, z: -650, r: 175, h: 104, port: { x: 752, z: -610 }, color: 2, subtitle: 'THE OLD CITADEL' },
    { id: 'sol', name: 'Isla del Sol', x: 745, z: 420, r: 170, h: 64, port: { x: 952, z: 420 }, color: 0, subtitle: 'SOUTHERN TRADING POST' },
    { id: 'teeth', name: 'The Siren’s Teeth', x: 105, z: 320, r: 110, h: 60, color: 2 },
    { id: 'wreck', name: 'Wreckers’ Cay', x: -670, z: -640, r: 95, h: 38, color: 0 },
    { id: 'emerald', name: 'Emerald Shoal', x: 70, z: -760, r: 88, h: 37, color: 1 },
    { id: 'rock', name: 'The Watchman', x: 1080, z: -150, r: 65, h: 49, color: 2 }
  ];
  const RELICS = {
    compass: { name: 'Seafarer’s compass', stat: 'speed', bonus: .03, label: '+3% sailing speed' },
    sextant: { name: 'Celestial sextant', stat: 'range', bonus: .03, label: '+3% cannon range' },
    lantern: { name: 'Storm lantern', stat: 'storm', bonus: .08, label: '−8% storm damage' },
    pennant: { name: 'Corsair pennant', stat: 'boarding', bonus: .04, label: '+4% boarding strength' }
  };
  const THEMES = {
    prize: { name: 'Prize hunting', icon: 'convoy', routes: [['chart', 'convoy'], ['raider', 'convoy'], ['chart', 'raider', 'convoy']] },
    relic: { name: 'Lost artifacts', icon: 'relic', routes: [['chart', 'relic'], ['salvage', 'relic'], ['raider', 'chart', 'relic']] },
    bounty: { name: 'Letters of marque', icon: 'raider', routes: [['raider', 'flagship'], ['chart', 'raider'], ['raider', 'convoy', 'flagship']] },
    passage: { name: 'Merchant charters', icon: 'escort', routes: [['escort', 'raider'], ['salvage', 'escort'], ['raider', 'escort', 'relic']] }
  };
  const pick = (s, values) => values[Math.floor(random(s) * values.length)];
  const portById = id => ISLANDS.find(i => i.id === id && i.port) || ISLANDS[0];
  function namedShip(s) { return pick(s, ['Ivory', 'Crimson', 'Golden', 'Silent', 'Iron', 'Silver', 'Ashen', 'Midnight', 'Velvet', 'Jade', 'Wandering', 'Scarlet']) + ' ' + pick(s, ['Heron', 'Tempest', 'Crown', 'Promise', 'Sovereign', 'Dagger', 'Wren', 'Fortune', 'Orchid', 'Revenant', 'Voyager', 'Gambit']); }
  function generateVoyage(s, theme, originId = s.checkpoint, intro = false) {
    const level = Math.min(12, Math.floor(s.renown / 240)), home = portById(originId);
    theme = theme || pick(s, Object.keys(THEMES));
    const id = `voyage-${s.nextId++}`, destination = pick(s, ISLANDS.filter(i => i.port && i.id !== home.id));
    const route = intro ? ['salvage', 'raider'] : pick(s, THEMES[theme].routes);
    let departure = home;
    const adjective = pick(s, ['Amber', 'Sunken', 'Saffron', 'Broken', 'Moonlit', 'Forgotten', 'Gilded', 'Hidden', 'Saltwater', 'Jade']);
    const noun = pick(s, ['Passage', 'Bargain', 'Inheritance', 'Pursuit', 'Conspiracy', 'Horizon', 'Secret', 'Trail', 'Oath', 'Reckoning']);
    const voyage = { id, name: `The ${adjective} ${noun}`, theme, level, intro, legs: [], bonus: 160 + level * 55 };
    for (let index = 0; index < route.length; index++) {
      const kind = route[index], island = pick(s, ISLANDS), objective = `${id}-${index}`;
      let landing = index === route.length - 1 ? destination : pick(s, ISLANDS.filter(i => i.port));
      if (kind === 'escort' && landing.id === departure.id) landing = pick(s, ISLANDS.filter(i => i.port && i.id !== departure.id));
      const anchor = intro ? { x: -470, z: 320 } : safePosition(s, island.x + island.r * 1.5, island.z + (random(s) - .5) * 180);
      if (kind === 'chart' && random(s) > .45) { const w = pick(s, s.weather); anchor.x = w.x + 40; anchor.z = w.z + 30; }
      const targetName = namedShip(s), relicType = pick(s, Object.keys(RELICS)), rarity = pick(s, ['common', 'rare', 'rare', 'legendary']);
      const relic = { id: `${objective}-relic`, type: relicType, name: `${pick(s, ['Aurelian', 'Opaline', 'Admiral’s', 'Jade', 'Starlit', 'Saffron', 'Obsidian'])} ${RELICS[relicType].name.toLowerCase()}`, rarity, label: RELICS[relicType].label };
      const trait = pick(s, ['swift', 'armored', 'veteran']);
      const targetClass = kind === 'convoy' ? 'galleon' : kind === 'flagship' ? (level < 2 ? 'brig' : 'flagship') : level < 2 ? 'sloop' : pick(s, ['sloop', 'brig', 'brig', 'frigate']);
      const requirement = kind === 'salvage' ? (intro ? 3 : 2 + Math.floor(random(s) * 3)) : 1;
      const names = { salvage: 'Cargo in the shallows', chart: 'A chart without a captain', relic: relic.name, raider: `Hunt the ${targetName}`, convoy: `Take the ${targetName}`, escort: `Passage for ${targetName}`, flagship: `Break the ${targetName}` };
      const task = { id: objective, objective, kind, name: names[kind], short: THEMES[theme].name, port: intro ? 'haven' : landing.id, startPort: departure.id, requirement, location: anchor, targetName, targetClass, trait, relic, level, reward: Math.round(({ salvage: 220, chart: 260, relic: 370, raider: 390, convoy: 650, escort: 520, flagship: 800 }[kind] + level * 75) * (route.length === 3 ? 1.1 : 1)) };
      const port = portById(task.port);
      const instructions = {
        salvage: `Recover ${requirement} marked supply caches, then dock at ${port.name}.`,
        chart: `Recover the sealed chart near ${island.name}. Deliver it to ${port.name}.`,
        relic: `Find the ${relic.name}. Return to ${port.name} to add it to your ship’s cabinet.`,
        raider: `Defeat or capture ${targetName}. Claim your bounty at ${port.name}.`,
        convoy: `Capture ${targetName} intact with B. Disable sails or crew first. Return to ${port.name}.`,
        escort: `Meet ${targetName} outside ${departure.name}. Stay within 260 yards and escort her to ${port.name}.`,
        flagship: `Defeat the ${trait} warship ${targetName}, then dock at ${port.name}.`
      };
      if (kind === 'chart' && CdistToStorm(s, anchor) < 100) instructions.chart = `Recover the sealed chart inside the squall. Deliver it to ${port.name}.`;
      task.text = instructions[kind]; task.story = task.text;
      voyage.legs.push(task); departure = port;
    }
    voyage.reward = voyage.bonus + voyage.legs.reduce((v, m) => v + m.reward, 0);
    voyage.route = [...new Set([home.name, ...voyage.legs.map(m => portById(m.port).name)])];
    for(let i=0;i<voyage.legs.length-1;i++) if(voyage.legs[i].kind==='chart') {
      voyage.legs[i].clueFor=voyage.legs[i+1].id;
      voyage.legs[i].story=`The chart reveals the next lead: ${voyage.legs[i+1].name}. ${voyage.legs[i].text}`;
    }
    return voyage;
  }
  function CdistToStorm(s, p) { return Math.min(...s.weather.map(w => dist(w, p))); }
  function generateOffers(s) {
    const choices = [...Object.keys(THEMES)];
    for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
    s.contracts = choices.slice(0, 3).map(theme => generateVoyage(s, theme));
    return s.contracts;
  }
  function acceptContract(s, id) {
    if (!s.complete || s.phase !== 'port') return false;
    const offer = s.contracts.find(v => v.id === id); if (!offer) return false;
    s.voyage = offer; s.legIndex = 0; s.complete = false; s.contracts = []; s.chapterSpawned = -1; spawnChapter(s);
    event(s, 'message', { text: `Commission accepted: ${offer.name}.`, tone: 'good' }); return true;
  }
  function random(s) { s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0; return s.seed / 4294967296; }
  function event(s, type, data = {}) { s.events.push({ type, ...data }); }
  function maxHull(p) { return CLASSES[p.class].hull * (1 + (p.upgrades?.hull || 0) * .25); }
  function maxCrew(p) { return CLASSES[p.class].crew + (p.upgrades?.crew || 0) * 8; }
  function makeShip(id, cls, x, z, extra = {}) {
    const spec = CLASSES[cls];
    return { id, class: cls, x, z, angle: 1.7, speed: 0, hull: spec.hull, sails: 100, crew: spec.crew, reload: 1, sail: 1, ammo: 'round', aggro: false, shootTimer: 2, invulnerable: 0, ...extra };
  }
  function create(seed = 1668) {
    const s = { version: 2, seed, legIndex: 0, voyagesCompleted: 0, contracts: [], artifacts: [], time: 0, chapter: 0, progress: 0, complete: false, phase: 'sailing', gold: 320, cargo: 0, renown: 0, stats: { sunk: 0, captured: 0, shots: 0, recovered: 0, defeats: 0 }, wind: { angle: 2.4, strength: 13 }, ships: [], loot: [], shots: [], effects: [], events: [], nextId: 100, waypoint: null, checkpoint: 'haven', selected: null, chapterSpawned: -1, weather: [ { x: 80, z: -430, r: 185, seed: 5 }, { x: 560, z: 40, r: 145, seed: 12 } ] };
    s.player = makeShip('player', 'sloop', -752, 477, { name: 'The Wayfarer', livery: 'teal', upgrades: { sails: 0, copper: 0, hull: 0, powder: 0, bronze: 0, crew: 0, weather: 0 } });
    s.player.relics = { speed: 0, range: 0, storm: 0, boarding: 0 };
    s.weather[0].x += (random(s)-.5)*180; s.weather[0].z += (random(s)-.5)*120;
    s.weather[1].x += (random(s)-.5)*170; s.weather[1].z += (random(s)-.5)*140;
    s.voyage = generateVoyage(s, 'prize', 'haven', true);
    spawnChapter(s);
    for (let i = 0; i < 18; i++) {
      const p = safePosition(s, -1150 + random(s) * 2300, -850 + random(s) * 1700);
      s.loot.push({ id: s.nextId++, ...p, kind: i % 4 === 0 ? 'chest' : 'cargo', value: 30 + Math.floor(random(s) * 50), bob: random(s) * TAU });
    }
    addShip(s, 'sloop', -180, 560, { name: 'Salt Jack', role: 'patrol', home: { x: -180, z: 560 }, loot: 110 });
    addShip(s, 'brig', 460, 110, { name: 'Ember', role: 'patrol', home: { x: 460, z: 110 }, loot: 150 });
    addShip(s, 'sloop', -500, -700, { name: 'Sea Wasp', role: 'patrol', home: { x: -500, z: -700 }, loot: 100 });
    addShip(s, 'galleon', 1020, 650, { name: 'Marigold', role: 'friendly', home: { x: 1050, z: 600 }, friendly: true });
    return s;
  }
  function safePosition(s, x, z) {
    const p = { x: clamp(x, -1230, 1230), z: clamp(z, -900, 900) };
    for (const i of ISLANDS) {
      const d = dist(p, i), r = i.r * 1.09 + 30;
      if (d < r) { const a = Math.atan2(p.x - i.x, p.z - i.z); p.x = i.x + Math.sin(a) * r; p.z = i.z + Math.cos(a) * r; }
    }
    return p;
  }
  function addShip(s, cls, x, z, extra) { const v = makeShip(s.nextId++, cls, x, z, extra); s.ships.push(v); return v; }
  function mission(s) { return s.voyage.legs[Math.min(s.legIndex, s.voyage.legs.length - 1)]; }
  function objectivePosition(s) {
    if (s.complete) return null;
    const m = mission(s);
    if (s.progress >= m.requirement) return { ...ISLANDS.find(i => i.id === m.port).port, name: ISLANDS.find(i => i.id === m.port).name, type: 'port' };
    const cargo = s.loot.find(l => l.mission === m.objective);
    if (cargo) return { ...cargo, name: m.kind === 'relic' ? m.relic.name : m.kind === 'chart' ? 'Sealed chart' : 'Supply cache', type: 'loot' };
    const target = s.ships.find(v => v.mission === m.objective);
    return target ? { x: target.x, z: target.z, name: target.name, type: target.friendly ? 'escort' : 'enemy' } : null;
  }
  function spawnChapter(s) {
    if (s.complete || s.chapterSpawned === s.chapter) return;
    s.chapterSpawned = s.chapter; s.progress = 0;
    const m = mission(s), key = m.objective, at = m.location;
    s.loot = s.loot.filter(l => !l.mission).slice(-100);
    s.ships = s.ships.filter(v => !v.mission && v.role !== 'ambush').slice(-12);
    const named = (cls, location, extra) => {
      const upgrades = { hull: m.trait === 'armored' ? 1 : 0, sails: m.trait === 'swift' ? 1 : 0, crew: m.trait === 'veteran' ? 1 : 0 };
      const v = addShip(s, cls, location.x, location.z, { name: m.targetName, home: { ...location }, mission: key, trait: m.trait, upgrades, ...extra });
      v.hull = maxHull(v); return v;
    };
    if (m.kind === 'salvage') for (let i = 0; i < m.requirement; i++) {
      const p = s.voyage.intro ? [{ x: -650, z: 400 }, { x: -540, z: 490 }, { x: -460, z: 330 }][i] : safePosition(s, at.x + Math.cos(i * 2.4) * 80, at.z + Math.sin(i * 2.4) * 80);
      s.loot.push({ id: s.nextId++, ...p, mission: key, kind: 'mission', value: 45 + m.level * 8, bob: random(s) * TAU });
    }
    if (['chart', 'relic'].includes(m.kind)) {
      s.loot.push({ id: s.nextId++, ...at, mission: key, kind: m.kind === 'relic' ? 'relic' : 'mission', value: m.kind === 'relic' ? 180 : 85, bob: 1, relic: m.kind === 'relic' ? m.relic : null });
      if (m.kind === 'relic' && m.level > 0) { const p = safePosition(s, at.x + 130, at.z + 100); addShip(s, m.level > 3 ? 'brig' : 'sloop', p.x, p.z, { name: namedShip(s), role: 'guard', home: p, loot: 140 }); }
    }
    if (['raider', 'convoy', 'flagship'].includes(m.kind)) {
      named(m.targetClass, at, { role: m.kind === 'flagship' ? 'boss' : m.kind, loot: m.kind === 'convoy' ? 450 + m.level * 45 : 170 + m.level * 30 });
      if (m.kind !== 'raider' && m.level > 0) { const p = safePosition(s, at.x + 110, at.z + 70); addShip(s, m.level > 3 ? 'brig' : 'sloop', p.x, p.z, { name: namedShip(s), role: 'guard', home: p, loot: 140 }); }
    }
    if (m.kind === 'escort') {
      const start = portById(m.startPort).port, goal = portById(m.port).port;
      const v = named('galleon', { x: start.x + 90, z: start.z + 15 }, { role: 'escort', friendly: true, goal: { ...goal }, arrived: false }); v.hull = 340;
      const mid = safePosition(s, (start.x + goal.x) / 2 + 90, (start.z + goal.z) / 2 + 70);
      addShip(s, 'sloop', mid.x, mid.z, { name: namedShip(s), role: 'ambush', home: mid, loot: 140 });
    }
  }
  function windAt(s, p) {
    let gust = 0, hazard = 0;
    for (const w of s.weather) { const q = 1 - dist(p, w) / w.r; gust = Math.max(gust, clamp(q + .15, 0, 1) * 8); hazard = Math.max(hazard, clamp((q - .37) / .63, 0, 1)); }
    return { angle: s.wind.angle, strength: s.wind.strength + gust, hazard };
  }
  function polar(angle, wind, cls) {
    const d = Math.abs(angleDiff(angle, wind)); // zero = running with wind; pi = headwind
    const upwind = (1 + Math.cos(d)) * .5;
    const reach = Math.sin(d);
    return clamp((cls === 'sloop' ? .2 : .07) + .66 * upwind + .45 * reach, .06, 1.1);
  }
  function sailShip(s, v, helm, sail, dt) {
    const spec = CLASSES[v.class], w = windAt(s, v), u = v.upgrades || {};
    v.sail = sail;
    const hullFactor = clamp(v.hull / maxHull(v), .15, 1);
    const target = spec.speed * polar(v.angle, w.angle, v.class) * (w.strength / 13) ** .55 * (sail ? 1 : .49) * (.32 + .68 * v.sails / 100) * (.65 + .35 * hullFactor) * (1 + (u.sails || 0) * .12 + (v.relics?.speed || 0)) * clamp(v.crew / (spec.crew * .35), .45, 1);
    v.speed += (target - v.speed) * Math.min(1, dt * .72);
    const turn = spec.turn * (sail ? 1 : 1.42) * (1 + (u.copper || 0) * .14) * (.45 + .55 * v.sails / 100);
    v.angle = (v.angle - clamp(helm, -1, 1) * turn * dt) % TAU;
    const previous = { x: v.x, z: v.z };
    v.x += Math.sin(v.angle) * v.speed * dt; v.z += Math.cos(v.angle) * v.speed * dt;
    for (const i of ISLANDS) {
      const r = i.r * .94 + spec.beam, d = dist(v, i);
      if (d < r) {
        const a = Math.atan2(v.x - i.x, v.z - i.z);
        v.x = i.x + Math.sin(a) * (r + 1); v.z = i.z + Math.cos(a) * (r + 1); v.speed *= .4;
        if (v.id === 'player' && v.invulnerable <= 0) { v.hull -= 3; v.invulnerable = 1.5; event(s, 'message', { text: 'Shallows! Turn away from the island.', tone: 'warning' }); }
      }
    }
    if (Math.abs(v.x) > 1280 || Math.abs(v.z) > 950) {
      v.x = clamp(v.x, -1280, 1280); v.z = clamp(v.z, -950, 950); v.speed *= .9;
      if (v.id === 'player' && s.time - (s.edgeNotice || -99) > 8) { s.edgeNotice = s.time; event(s, 'message', { text: 'Open ocean beyond. Your fortunes lie within the archipelago.' }); }
      if (v.id !== 'player') v.angle = bearing(v, { x: 0, z: 0 });
    }
    v.invulnerable = Math.max(0, v.invulnerable - dt);
    v.reload = Math.min(1, v.reload + dt / (6.5 / (1 + (u.crew || 0) * .18)) * clamp(v.crew / spec.crew, .28, 1.2));
    if (w.hazard > .05 && v.id === 'player') {
      const shield = (u.weather ? .3 : 1) * (1 - (v.relics?.storm || 0));
      v.sails = Math.max(7, v.sails - w.hazard * dt * 2.3 * shield * (sail ? 1 : .5));
      v.hull -= w.hazard * dt * .75 * shield;
    }
    v.previous = previous;
  }
  function range(v) { return AMMO[v.ammo].range * (1 + (v.upgrades?.powder || 0) * .12 + (v.relics?.range || 0)); }
  function targetInBroadside(v, t, side = 0) {
    const diff = angleDiff(bearing(v, t), v.angle);
    const actual = diff > 0 ? -1 : 1;
    return (!side || side === actual) && Math.abs(Math.abs(diff) - Math.PI / 2) < .62;
  }
  function fire(s, v, side = 0) {
    if (s.phase !== 'sailing' || v.reload < .98 || v.hull <= 0) return false;
    const targets = v.id === 'player' ? s.ships.filter(t => !t.friendly && t.hull > 0) : [s.player, ...s.ships.filter(t => t.role === 'escort' && t.hull > 0)];
    const nearby = targets.filter(t => dist(v, t) < range(v) && targetInBroadside(v, t, side)).sort((a, b) => dist(v, a) - dist(v, b));
    const target = nearby[0];
    if (!target && !side) { if (v.id === 'player') event(s, 'message', { text: 'Bring an enemy alongside, within cannon range.' }); return false; }
    side = side || (angleDiff(bearing(v, target), v.angle) > 0 ? -1 : 1);
    const spec = CLASSES[v.class], ammo = AMMO[v.ammo], guns = Math.floor(spec.guns / 2), u = v.upgrades || {};
    let aim = v.angle - side * Math.PI / 2;
    if (target) {
      const t = dist(v, target) / ammo.speed;
      const lead = { x: target.x + Math.sin(target.angle) * target.speed * t * .8, z: target.z + Math.cos(target.angle) * target.speed * t * .8 };
      aim += clamp(angleDiff(bearing(v, lead), aim), -.38, .38);
      if (v.id === 'player') { target.aggro = true; s.selected = target.id; }
    }
    for (let j = 0; j < guns; j++) {
      const along = (j / Math.max(1, guns - 1) - .5) * spec.length * .65;
      const spread = (.095 - (u.bronze || 0) * .018) * (v.ammo === 'grape' ? 1.8 : 1);
      const a = aim + (random(s) - .5) * spread;
      const life = range(v) / ammo.speed;
      s.shots.push({ id: s.nextId++, owner: v.id, friendly: v.id === 'player' || v.friendly, ammo: v.ammo, x: v.x + Math.sin(v.angle) * along - Math.cos(v.angle) * spec.beam * side * .5, z: v.z + Math.cos(v.angle) * along + Math.sin(v.angle) * spec.beam * side * .5, vx: Math.sin(a) * ammo.speed, vz: Math.cos(a) * ammo.speed, age: -j * .065, life, arc: ammo.arc, power: ammo.damage * (1 + (u.bronze || 0) * .12) * (v.id === 'player' ? 1.25 : .8) });
    }
    v.reload = 0;
    event(s, 'fire', { x: v.x, z: v.z, player: v.id === 'player', side });
    if (v.id === 'player') s.stats.shots++;
    return true;
  }
  function shotHeight(p) { const q = clamp(p.age / p.life, 0, 1); return 3 * (1 - q) + 4 * p.arc * q * (1 - q); }
  function segmentDistance(a, b, p) {
    const dx = b.x - a.x, dz = b.z - a.z, d = dx * dx + dz * dz;
    const t = d ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / d, 0, 1) : 0;
    return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
  }
  function navigationRoute(s, from, to, cls = 'sloop') {
    const goal = safePosition(s, to.x, to.z), nodes = [{ x: from.x, z: from.z }, goal];
    // A visibility graph around island clearance rings, with open-water tacking nodes.
    const navigable = p => Math.abs(p.x) < 1275 && Math.abs(p.z) < 940 && ISLANDS.every(i => dist(p, i) > i.r * 1.04 + 16);
    for (const i of ISLANDS) for (let j = 0; j < 16; j++) {
      const a = j / 16 * TAU, r = i.r * 1.2 + 28, p = { x: i.x + Math.sin(a) * r, z: i.z + Math.cos(a) * r };
      if (navigable(p)) nodes.push(p);
    }
    for (let x = -1000; x <= 1000; x += 500) for (let z = -750; z <= 750; z += 500) if (navigable({ x, z })) nodes.push({ x, z });
    const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), used = new Set(); costs[0] = 0;
    for (let count = 0; count < nodes.length; count++) {
      let k = -1; for (let j = 0; j < nodes.length; j++) if (!used.has(j) && (k < 0 || costs[j] < costs[k])) k = j;
      if (k < 0 || !Number.isFinite(costs[k]) || k === 1) break;
      used.add(k);
      for (let j = 1; j < nodes.length; j++) {
        if (used.has(j) || ISLANDS.some(i => segmentDistance(nodes[k], nodes[j], i) < i.r * 1.04 + 16)) continue;
        const efficiency = Math.max(.13, polar(bearing(nodes[k], nodes[j]), s.wind.angle, cls));
        const cost = costs[k] + dist(nodes[k], nodes[j]) / efficiency;
        if (cost < costs[j]) { costs[j] = cost; previous[j] = k; }
      }
    }
    if (previous[1] < 0) return [goal];
    const path = []; let index = 1; while (index > 0) { path.unshift(nodes[index]); index = previous[index]; }
    return path;
  }
  function damage(s, t, shot) {
    if (t.id === 'player' && t.invulnerable > 0) return;
    const rake = Math.abs(Math.cos(angleDiff(Math.atan2(shot.vx, shot.vz), t.angle))) > .85 ? 1.3 : 1;
    const d = shot.power * rake;
    if (shot.ammo === 'round') { t.hull -= d; t.sails -= d * .16; t.crew -= d * .12; }
    if (shot.ammo === 'chain') { t.sails -= d * 2.6; t.hull -= d * .32; t.crew -= d * .08; }
    if (shot.ammo === 'grape') { t.crew -= d * 1.7; t.hull -= d * .23; t.sails -= d * .13; }
    t.sails = Math.max(5, t.sails); t.crew = Math.max(2, t.crew); t.aggro = true;
    event(s, 'hit', { x: shot.x, z: shot.z, player: t.id === 'player', ammo: shot.ammo });
  }
  function nearestPort(s, within = 98) { return ISLANDS.filter(i => i.port && dist(s.player, i.port) < within).sort((a, b) => dist(s.player, a.port) - dist(s.player, b.port))[0] || null; }
  function boardingTarget(s) { return s.ships.filter(v => !v.friendly && v.hull > 0 && dist(v, s.player) < 53 && (v.sails < 43 || v.crew < CLASSES[v.class].crew * .52 || v.hull < maxHull(v) * .43)).sort((a, b) => dist(a, s.player) - dist(b, s.player))[0] || null; }
  function board(s) {
    if (s.phase !== 'sailing') return false;
    const target = boardingTarget(s);
    if (!target) { event(s, 'message', { text: 'Close within 53 yards of a weakened ship. Use chain or grape first.' }); return false; }
    const strength = s.player.crew * (1.3 + s.player.upgrades.crew * .18 + (s.player.relics?.boarding || 0)), defense = target.crew * .8;
    if (strength < defense) { event(s, 'message', { text: 'Their crew is too strong. Thin their ranks with grape shot.', tone: 'warning' }); return false; }
    s.player.crew = Math.max(8, s.player.crew - target.crew * .12);
    defeatShip(s, target, true); return true;
  }
  function defeatShip(s, v, captured = false) {
    if (v.removed) return;
    v.removed = true; v.hull = 0;
    if (v.friendly) {
      if (v.role === 'escort') { s.chapterSpawned = -1; s.progress = 0; event(s, 'message', { text: `${v.name} was lost. Dock at any harbor to arrange another escort.`, tone: 'warning' }); s.escortLost = true; }
      return;
    }
    s.stats[captured ? 'captured' : 'sunk']++; s.renown += captured ? 35 : 20;
    const value = (v.loot || 120) * (captured ? 1.7 : 1);
    if (captured) { s.cargo += Math.round(value); event(s, 'message', { text: `${v.name} taken! Prize cargo worth ${Math.round(value)} doubloons.`, tone: 'good' }); }
    else { s.loot.push({ id: s.nextId++, x: v.x, z: v.z, kind: 'chest', value: Math.round(value), bob: 0 }); event(s, 'message', { text: `${v.name} struck her colors. Recover the floating cargo.`, tone: 'good' }); }
    event(s, 'sink', { x: v.x, z: v.z, captured });
    if (v.mission === mission(s).objective) {
      if (mission(s).kind === 'convoy' && !captured) { s.convoyRetry = 18; event(s, 'message', { text: 'The prize sank. Another treasure convoy will arrive. Capture it with B.', tone: 'warning' }); }
      else { s.progress = mission(s).requirement; event(s, 'objective', { text: `Commission secured. Make port at ${ISLANDS.find(i => i.id === mission(s).port).name}.` }); }
    }
  }
  function ai(s, v, dt) {
    if (v.hull <= 0) return;
    let target = s.player;
    const escort = s.ships.find(t => t.role === 'escort' && !t.arrived && t.hull > 0);
    if (escort && v.role === 'ambush' && dist(v, escort) < dist(v, s.player) * 1.2) target = escort;
    const d = dist(v, target);
    if (!v.friendly && d < (v.role === 'boss' ? 450 : 315)) v.aggro = true;
    if (!v.friendly && d > 620 && v.role !== 'boss') v.aggro = false;
    let desired, full = 1;
    if (v.role === 'escort') {
      if (v.arrived) { v.speed *= .93; return; }
      if (dist(v, v.goal) < 60) { v.arrived = true; s.progress = 1; event(s, 'objective', { text: `${v.name} is safe. Dock at ${portById(mission(s).port).name} to claim your reward.` }); return; }
      if (dist(v, s.player) > 260) { v.speed *= .97; return; }
      if (!v.route) v.route = navigationRoute(s, v, v.goal, 'galleon');
      while (v.route.length > 1 && dist(v, v.route[0]) < 48) v.route.shift();
      desired = bearing(v, v.route[0] || v.goal); v.speed = Math.min(v.speed, 23);
    } else if (v.friendly || !v.aggro) {
      const home = v.home || v;
      const goal = { x: home.x + Math.cos(s.time * .035 + v.id) * 100, z: home.z + Math.sin(s.time * .035 + v.id) * 90 };
      desired = bearing(v, goal); full = 0;
    } else {
      const toTarget = bearing(v, target);
      const side = v.id % 2 ? 1 : -1;
      const desiredRange = v.class === 'flagship' ? 200 : 170;
      if (d > desiredRange + 35) desired = toTarget + side * .45;
      else if (d < 90) desired = toTarget + side * 2;
      else { desired = toTarget + side * Math.PI / 2; full = 0; }
      v.ammo = v.role === 'boss' && Math.sin(s.time * .1) > .4 ? 'chain' : 'round';
      if (d < range(v) && targetInBroadside(v, target) && v.reload >= .98) fire(s, v);
    }
    // Look ahead and bend around solid island cores.
    const ahead = { x: v.x + Math.sin(desired) * 100, z: v.z + Math.cos(desired) * 100 };
    for (const i of ISLANDS) if (v.role !== 'escort' && dist(ahead, i) < i.r * 1.12 + 25) {
      const away = bearing(i, v); desired = away + (angleDiff(desired, away) > 0 ? 1 : -1) * .6;
    }
    sailShip(s, v, -clamp(angleDiff(desired, v.angle) * 2, -1, 1), full, dt);
    if (v.role === 'escort') v.speed = Math.min(v.speed, 23);
  }
  function collect(s) {
    const keep = [];
    for (const l of s.loot) {
      if (dist(l, s.player) < 26) {
        s.cargo += l.value; s.stats.recovered++;
        if (l.mission === mission(s).objective) { s.progress++; if (l.relic) s.pendingRelic = l.relic; }
        event(s, 'collect', { x: l.x, z: l.z, value: l.value });
        if (l.mission && s.progress >= mission(s).requirement) event(s, 'objective', { text: `Cargo secured. Deliver it to ${ISLANDS.find(i => i.id === mission(s).port).name}.` });
      } else keep.push(l);
    }
    s.loot = keep;
  }
  function step(s, input = {}, dt = 1 / 60) {
    s.events = [];
    if (s.phase !== 'sailing') return;
    dt = clamp(dt, 0, .05); s.time += dt;
    s.wind.angle = 2.4 + Math.sin(s.time / 90) * .25;
    s.wind.strength = 13 + Math.sin(s.time / 42) * 2;
    if (input.sail !== undefined) s.player.sail = input.sail;
    if (input.ammo && AMMO[input.ammo]) s.player.ammo = input.ammo;
    sailShip(s, s.player, input.helm || 0, s.player.sail, dt);
    for (const v of s.ships) ai(s, v, dt);
    if (input.fire) fire(s, s.player, input.side || 0);
    if (input.board) board(s);
    if (input.dock) dock(s);
    if (s.phase !== 'sailing') return;
    const moving = [];
    for (const p of s.shots) {
      p.age += dt;
      if (p.age < 0) { moving.push(p); continue; }
      const activeTime = Math.min(dt, p.age);
      const previous = { x: p.x, z: p.z };
      p.x += p.vx * activeTime; p.z += p.vz * activeTime;
      const candidates = p.friendly ? s.ships.filter(v => !v.friendly && v.hull > 0) : [s.player, ...s.ships.filter(v => v.role === 'escort' && v.hull > 0)];
      const hit = candidates.find(v => segmentDistance(previous, p, v) < CLASSES[v.class].beam * .55 + 3 && shotHeight(p) < 31);
      if (hit) { damage(s, hit, p); if (hit.hull <= 0 && hit.id !== 'player') defeatShip(s, hit); }
      else if (p.age >= p.life) event(s, 'splash', { x: p.x, z: p.z });
      else moving.push(p);
    }
    s.shots = moving; s.ships = s.ships.filter(v => !v.removed);
    collect(s);
    if (s.player.hull <= 0) respawn(s);
    if (s.convoyRetry > 0) { s.convoyRetry -= dt; if (s.convoyRetry <= 0) { s.chapterSpawned = -1; spawnChapter(s); } }
  }
  function dock(s) {
    if (s.phase !== 'sailing') return null;
    const port = nearestPort(s);
    if (!port) { event(s, 'message', { text: 'Sail closer to a harbor to dock.' }); return null; }
    s.phase = 'port'; s.port = port.id; s.checkpoint = port.id; s.player.speed = 0; s.shots = [];
    s.lastSale = s.cargo; s.gold += s.cargo; s.cargo = 0; s.lastReward = 0;
    if (!s.complete && s.progress >= mission(s).requirement && port.id === mission(s).port) {
      s.lastReward = mission(s).reward; s.gold += s.lastReward; s.renown += 100; s.chapter++;
      if (s.pendingRelic) {
        s.artifacts.push(s.pendingRelic); s.artifacts = s.artifacts.slice(-24);
        const relic = RELICS[s.pendingRelic.type]; s.player.relics[relic.stat] = Math.min(relic.bonus * 5, (s.player.relics[relic.stat] || 0) + relic.bonus);
        event(s, 'artifact', { relic: s.pendingRelic }); s.pendingRelic = null;
      }
      s.legIndex++;
      if (s.legIndex >= s.voyage.legs.length) {
        s.complete = true; s.voyagesCompleted++; s.gold += s.voyage.bonus; s.lastReward += s.voyage.bonus;
        generateOffers(s); event(s, 'victory');
      } else spawnChapter(s);
      event(s, 'chapter', { reward: s.lastReward, chapter: s.chapter });
    }
    if (s.escortLost) { s.escortLost = false; spawnChapter(s); }
    event(s, 'port', { id: port.id }); return port;
  }
  function leavePort(s) { if (s.phase === 'port') { s.phase = 'sailing'; s.player.invulnerable = 4; event(s, 'leave'); } }
  function repairCost(s) { const p = s.player; return Math.ceil((maxHull(p) - p.hull) * .48 + (100 - p.sails) * .3 + (maxCrew(p) - p.crew) * .9); }
  function repair(s) {
    if (s.phase !== 'port') return false;
    const cost = repairCost(s);
    if (s.gold < cost) return false;
    s.gold -= cost; s.player.hull = maxHull(s.player); s.player.sails = 100; s.player.crew = maxCrew(s.player); return true;
  }
  function upgradeCost(s, id) { const u = UPGRADES.find(u => u.id === id); return u ? Math.round(u.cost * (1 + s.player.upgrades[id] * .75)) : Infinity; }
  function upgrade(s, id) {
    const u = UPGRADES.find(u => u.id === id), cost = upgradeCost(s, id);
    if (s.phase !== 'port' || !u || s.player.upgrades[id] >= u.max || s.gold < cost) return false;
    s.gold -= cost; s.player.upgrades[id]++;
    if (id === 'hull') s.player.hull += CLASSES[s.player.class].hull * .25;
    if (id === 'crew') s.player.crew += 8;
    return true;
  }
  function buyShip(s, cls) {
    const spec = CLASSES[cls];
    if (s.phase !== 'port' || !['brig', 'frigate'].includes(cls) || cls === s.player.class || (s.player.class === 'frigate') || s.gold < spec.cost || s.chapter < (cls === 'brig' ? 2 : 4)) return false;
    s.gold -= spec.cost; s.player.class = cls; s.player.hull = maxHull(s.player); s.player.crew = maxCrew(s.player); s.player.sails = 100; return true;
  }
  function respawn(s) {
    s.stats.defeats++; s.gold = Math.max(0, s.gold - Math.min(s.gold * .2, 250)); s.cargo = Math.round(s.cargo * .4);
    const home = ISLANDS.find(i => i.id === s.checkpoint) || ISLANDS[0];
    s.player.x = home.port.x + 55; s.player.z = home.port.z; s.player.hull = maxHull(s.player); s.player.sails = 100; s.player.crew = maxCrew(s.player); s.player.speed = 0; s.player.angle = 1.7; s.player.invulnerable = 8; s.shots = [];
    for (const v of s.ships) { v.aggro = false; if (dist(v, s.player) < 300) { v.x += 350; v.z -= 150; } }
    event(s, 'rescued', { text: `A passing tender rescued you. Repairs are covered; some cargo and coin were lost. Back at ${home.name}.` });
  }
  // Save the captain, not a world snapshot. Loading generates fresh waters and offers.
  function serialize(s) {
    const p = s.player;
    return JSON.stringify({ version: 3, seed: s.seed, gold: s.gold, cargo: s.cargo, renown: s.renown, chapter: s.chapter, voyagesCompleted: s.voyagesCompleted, stats: s.stats, checkpoint: s.checkpoint, artifacts: s.artifacts.slice(-24), ship: { class: p.class, livery: p.livery, hull: p.hull, sails: p.sails, crew: p.crew, upgrades: { ...p.upgrades }, relics: { ...p.relics } } });
  }
  function restore(text) {
    try {
      if (typeof text !== 'string' || text.length > 25000) return null;
      let saved = JSON.parse(text);
      // Accept the first prototype’s profile, dropping its encounter snapshot.
      if (saved?.version === 1 && saved.player) saved = { ...saved, version: 3, ship: saved.player, voyagesCompleted: 0, artifacts: [] };
      if (saved?.version !== 3 || !saved.ship || !['sloop', 'brig', 'frigate'].includes(saved.ship.class)) return null;
      const p = saved.ship;
      if (![saved.seed, saved.gold, saved.cargo, saved.renown, saved.chapter, p.hull, p.sails, p.crew].every(Number.isFinite) || saved.gold < 0 || saved.cargo < 0 || saved.chapter < 0 || !p.upgrades) return null;
      for (const u of UPGRADES) if (!Number.isInteger(p.upgrades[u.id]) || p.upgrades[u.id] < 0 || p.upgrades[u.id] > u.max) return null;
      if (!saved.stats || !['sunk', 'captured', 'shots', 'recovered', 'defeats'].every(k => Number.isFinite(saved.stats[k]) && saved.stats[k] >= 0)) return null;
      const s = create((saved.seed ^ 0x73a7c251) >>> 0);
      s.gold = saved.gold; s.cargo = saved.cargo; s.renown = saved.renown; s.chapter = Math.floor(saved.chapter); s.stats = { ...saved.stats }; s.voyagesCompleted = Math.max(0, Math.floor(saved.voyagesCompleted || 0));
      s.checkpoint = portById(saved.checkpoint).id;
      s.player.class = p.class; s.player.livery = ['teal','indigo','ochre'].includes(p.livery)?p.livery:'teal'; s.player.upgrades = { ...p.upgrades };
      s.player.hull = clamp(p.hull, 1, maxHull(s.player)); s.player.sails = clamp(p.sails, 7, 100); s.player.crew = clamp(p.crew, 2, maxCrew(s.player));
      s.player.relics = { speed: 0, range: 0, storm: 0, boarding: 0 };
      if (p.relics) for (const [stat, limit] of Object.entries({ speed: .15, range: .15, storm: .4, boarding: .2 })) s.player.relics[stat] = clamp(Number(p.relics[stat]) || 0, 0, limit);
      s.artifacts = Array.isArray(saved.artifacts) ? saved.artifacts.filter(a => a && RELICS[a.type] && typeof a.name === 'string' && a.name.length < 100).slice(-24).map(a => ({ id: String(a.id).slice(0, 80), type: a.type, name: a.name, rarity: ['rare', 'legendary'].includes(a.rarity) ? a.rarity : 'common', label: RELICS[a.type].label })) : [];
      const port = portById(s.checkpoint); s.player.x = port.port.x + 48; s.player.z = port.port.z; s.player.speed = 0; s.player.invulnerable = 8;
      s.loot = s.loot.filter(l => !l.mission); s.ships = s.ships.filter(v => !v.mission); s.shots = []; s.events = []; s.complete = true; s.progress = 0; s.pendingRelic = null;
      generateOffers(s); return s;
    } catch { return null; }
  }
  root.Corsair = { TAU, clamp, dist, bearing, angleDiff, CLASSES, AMMO, UPGRADES, ISLANDS, RELICS, THEMES, generateVoyage, generateOffers, acceptContract, create, step, fire, board, dock, leavePort, repair, repairCost, upgrade, upgradeCost, buyShip, maxHull, maxCrew, range, windAt, polar, nearestPort, boardingTarget, mission, objectivePosition, targetInBroadside, shotHeight, defeatShip, spawnChapter, navigationRoute, serialize, restore };
})(typeof globalThis !== 'undefined' ? globalThis : this);
