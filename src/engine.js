/* Crescent Seas — deterministic, renderer-independent sea simulation. */
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
  const { WORLDS, FACTIONS } = root.CrescentWorlds;
  const world = s => WORLDS[s?.worldId] || WORLDS.india;
  const islands = s => world(s).islands;
  const ISLANDS = WORLDS.india.islands; // Legacy/default theater reference for simulation callers.
  const bounds = s => ({ x: world(s).size[0]/2-100, z: world(s).size[1]/2-100 });
  const shipName = (s, cls, hostile=false) => hostile ? ({sloop:'Light armed patrol',brig:'Armed escort',frigate:'Heavy warship',galleon:'Armed carrack',flagship:'Fleet flagship'}[cls]) : world(s).ships[['sloop','brig','frigate'].indexOf(cls)] || 'Merchant vessel';
  function portById(s,id) { return islands(s).find(i=>i.id===id&&i.port) || islands(s).find(i=>i.id===world(s).home); }
  const coastCache=new WeakMap();
  function coast(i){
    if(coastCache.has(i))return coastCache.get(i);
    const points=i.outline?i.outline.map(([x,z])=>({x:i.x+x*i.r,z:i.z+z*i.r})):Array.from({length:24},(_,j)=>{const a=j/24*TAU,r=i.r*(.97+.035*Math.sin(j*2.7+i.h));return{x:i.x+Math.cos(a)*r,z:i.z+Math.sin(a)*r};});
    let area=0;for(let j=0;j<points.length;j++){const a=points[j],b=points[(j+1)%points.length];area+=a.x*b.z-b.x*a.z;}
    const c={points,sign:area>0?1:-1,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};coastCache.set(i,c);return c;
  }
  const landOutline=i=>coast(i).points;
  function landInfo(p,i){
    const c=coast(i),v=c.points;let inside=false,best=Infinity,q=null,edge=null;
    for(let j=0,k=v.length-1;j<v.length;k=j++){
      const a=v[k],b=v[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
      const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz),0,1),hit={x:a.x+t*dx,z:a.z+t*dz},d=dist(p,hit);
      if(d<best){best=d;q=hit;edge={x:dz*c.sign,z:-dx*c.sign};}
    }
    let nx=inside?q.x-p.x:p.x-q.x,nz=inside?q.z-p.z:p.z-q.z,len=Math.hypot(nx,nz);if(len<.001){nx=edge.x;nz=edge.z;len=Math.hypot(nx,nz);}
    return {distance:inside?-best:best,x:q.x,z:q.z,nx:nx/len,nz:nz/len};
  }
  function landDistance(p,i){const c=coast(i);if(p.x<c.minX-150||p.x>c.maxX+150||p.z<c.minZ-150||p.z>c.maxZ+150)return Math.hypot(Math.max(c.minX-p.x,0,p.x-c.maxX),Math.max(c.minZ-p.z,0,p.z-c.maxZ));return landInfo(p,i).distance;}
  function harborPoint(i,offset=0,lateral=0){const d=i.portSide==='west'?{x:-1,z:0}:i.portSide==='north'?{x:0,z:-1}:{x:1,z:0};return{x:i.port.x+d.x*offset-d.z*lateral,z:i.port.z+d.z*offset+d.x*lateral,angle:Math.atan2(d.x,d.z)};}
  const RELICS = {
    compass: { name: 'Seafarer’s compass', stat: 'speed', bonus: .03, label: '+3% sailing speed' },
    sextant: { name:'Tide astrolabe', stat: 'range', bonus: .03, label: '+3% cannon range' },
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
  function namedShip(s,friendly=false) { return friendly ? pick(s,['Al-Amal','Zahra','Rahma','Najma','Sahra','Salsabil'])+' '+pick(s,['I','II','III','IV','V']) : pick(s,world(s).names)+' '+(1+Math.floor(random(s)*80)); }
  function generateVoyage(s,theme,originId=s.checkpoint,intro=false,patronId=null) {
    const level = Math.min(12, Math.floor(s.renown / 240)), home = portById(s,originId);
    theme = theme || pick(s, Object.keys(THEMES));
    const id = `voyage-${s.nextId++}`, destination = pick(s, islands(s).filter(i => i.port && i.id !== home.id));
    const route = intro ? ['salvage', 'raider'] : pick(s, THEMES[theme].routes);
    let departure = home;
    const adjective = pick(s, ['Amber', 'Sunken', 'Saffron', 'Broken', 'Moonlit', 'Forgotten', 'Gilded', 'Hidden', 'Saltwater', 'Jade']);
    const noun = pick(s, ['Passage', 'Bargain', 'Inheritance', 'Pursuit', 'Conspiracy', 'Horizon', 'Secret', 'Trail', 'Oath', 'Reckoning']);
    const patron=world(s).patrons.includes(patronId)?patronId:pick(s,world(s).patrons);
    const voyage = { worldId:s.worldId, patron, enemy:pick(s,world(s).enemies), id, name: `The ${adjective} ${noun}`, theme, level, intro, legs: [], bonus: 160 + level * 55 };
    for (let index = 0; index < route.length; index++) {
      const kind = route[index], island = pick(s,islands(s)), objective = `${id}-${index}`;
      let landing = index === route.length - 1 ? destination : pick(s, islands(s).filter(i => i.port));
      if (kind === 'escort' && landing.id === departure.id) landing = pick(s, islands(s).filter(i => i.port && i.id !== departure.id));
      const anchor = intro ? harborPoint(home,350,-120) : safePosition(s, island.x + island.r * 1.5, island.z + (random(s) - .5) * 180);
      if (kind === 'chart' && s.weather.length && random(s) > .45) { const w = pick(s, s.weather); anchor.x = w.x + 40; anchor.z = w.z + 30; }
      Object.assign(anchor,safePosition(s,anchor.x,anchor.z));
      const targetName = namedShip(s,kind==='escort'), relicType = pick(s, Object.keys(RELICS)), rarity = pick(s, ['common', 'rare', 'rare', 'legendary']);
      const relic = { id: `${objective}-relic`, type: relicType, name: `${pick(s, ['Aurelian', 'Opaline', 'Admiral’s', 'Jade', 'Starlit', 'Saffron', 'Obsidian'])} ${RELICS[relicType].name.toLowerCase()}`, rarity, label: RELICS[relicType].label };
      const trait = pick(s, ['swift', 'armored', 'veteran']);
      const targetClass = kind === 'convoy' ? 'galleon' : kind === 'flagship' ? (level < 2 ? 'brig' : 'flagship') : level < 2 ? 'sloop' : pick(s, ['sloop', 'brig', 'brig', 'frigate']);
      const requirement = kind === 'salvage' ? (intro ? 3 : 2 + Math.floor(random(s) * 3)) : 1;
      const names = { salvage: 'Cargo in the shallows', chart: 'A chart without a captain', relic: relic.name, raider: `Hunt the ${targetName}`, convoy: `Take the ${targetName}`, escort: `Passage for ${targetName}`, flagship: `Break the ${targetName}` };
      const task = { id: objective, objective, kind, name: names[kind], short: THEMES[theme].name, port: intro ? home.id : landing.id, startPort: departure.id, requirement, location: anchor, targetName, targetClass, trait, relic, level, patron, enemy:voyage.enemy, reward: Math.round(({ salvage: 220, chart: 260, relic: 370, raider: 390, convoy: 650, escort: 520, flagship: 800 }[kind] + level * 75) * (route.length === 3 ? 1.1 : 1)) };
      const port = portById(s,task.port);
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
      task.reward=Math.round(task.reward*(1+(FACTIONS[patron].pay||0)));
      if(['raider','convoy','flagship'].includes(kind)) instructions[kind]=instructions[kind].replace(targetName,`${targetName} (${voyage.enemy})`);
      task.text = instructions[kind]; task.story = task.text;
      voyage.legs.push(task); departure = port;
    }
    voyage.reward = voyage.bonus + voyage.legs.reduce((v, m) => v + m.reward, 0);
    voyage.route = [...new Set([home.name, ...voyage.legs.map(m => portById(s,m.port).name)])];
    for(let i=0;i<voyage.legs.length-1;i++) if(voyage.legs[i].kind==='chart') {
      voyage.legs[i].clueFor=voyage.legs[i+1].id;
      voyage.legs[i].story=`The chart reveals the next lead: ${voyage.legs[i+1].name}. ${voyage.legs[i].text}`;
    }
    return voyage;
  }
  function CdistToStorm(s, p) { return Math.min(...s.weather.map(w => dist(w, p))); }
  function generateOffers(s,patron=null) {
    const choices = [...Object.keys(THEMES)];
    for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
    s.contracts = choices.slice(0,3).map(theme=>generateVoyage(s,theme,s.checkpoint,false,patron));
    return s.contracts;
  }
  function acceptContract(s, id) {
    if (!s.complete || s.phase !== 'port') return false;
    const offer = s.contracts.find(v => v.id === id); if (!offer) return false;
    s.affiliation=offer.patron; s.player.patron=offer.patron;
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
  function create(seed = 1530, worldId = 'india') {
    if(!WORLDS[worldId]) worldId='india';
    const w=WORLDS[worldId];
    const s = { version:4, worldId, affiliation:w.patrons[0], standing:{}, visitedWorlds:[worldId], worldProgress:{[worldId]:{voyages:0}}, turning:{fragments:0,nextAt:3,passages:0}, gate:null, seed, legIndex:0, voyagesCompleted:0, contracts:[], artifacts:[], time:0, chapter:0, progress:0, complete:false, phase:'sailing', gold:320, cargo:0, renown:0, stats:{sunk:0,captured:0,shots:0,recovered:0,defeats:0}, wind:{angle:w.wind,strength:13}, ships:[],loot:[],shots:[],effects:[],events:[],nextId:100,waypoint:null,checkpoint:w.home,selected:null,chapterSpawned:-1,weather:[] };
    s.player=makeShip('player','sloop',0,0,{name:'Safina',livery:'teal',patron:s.affiliation,upgrades:{sails:0,copper:0,hull:0,powder:0,bronze:0,crew:0,weather:0},relics:{speed:0,range:0,storm:0,boarding:0}});
    resetSea(s,true); return s;
  }
  function resetSea(s,intro=false) {
    const w=world(s),b=bounds(s),home=portById(s,s.checkpoint);
    s.ships=[];s.loot=[];s.shots=[];s.effects=[];s.selected=null;s.waypoint=null;s.pendingRelic=null;s.escortLost=false;s.convoyRetry=0;s.progress=0;s.chapterSpawned=-1;s.legIndex=0;s.phase='sailing';s.time=0;
    Object.assign(s.player,harborPoint(home,55));s.player.speed=0;s.player.invulnerable=8;s.player.reload=1;s.player.coastCooldown=0;s.lastHazard=null;
    s.wind={angle:w.wind,strength:w.climate==='atlantic'?16:13};
    s.contacts={};s.hazards=[];
    s.atmosphere={seed:(s.seed^0xa3597f21)>>>0,nextFront:28,nextStorm:55,angle:w.wind,strength:s.wind.strength,kind:'Trade wind'};
    // Hazards are renewed with encounters; they do not enlarge the captain save.
    for(let j=0;j<6;j++){
      const i=w.islands[(j*3+2)%w.islands.length],jitter=(skyRandom(s)-.5)*.6,q=safePosition(s,i.x+i.r*(1.6+jitter),i.z+(j%2?160:-160)+jitter*i.r*.7);
      if(w.islands.some(i=>i.port&&dist(q,i.port)<210)||dist(q,s.player)<300)continue;
      s.hazards.push({...q,id:`danger-${j}`,kind:j<4?'reef':'current',r:j<4?32+j*5:130,angle:w.wind+(j%2?1.2:-1.2),strength:3+j*.35,seed:j*17+9});
    }
    s.weather=[];spawnStorm(s,true);
    s.voyage=generateVoyage(s,'prize',home.id,intro);s.complete=!intro;
    if(intro){s.affiliation=s.voyage.patron;s.player.patron=s.affiliation;spawnChapter(s);}else generateOffers(s);
    for(let i=0;i<24;i++){const p=safePosition(s,(random(s)*2-1)*(b.x-120),(random(s)*2-1)*(b.z-100));s.loot.push({id:s.nextId++,...p,kind:i%4===0?'chest':'cargo',value:30+Math.floor(random(s)*50),bob:random(s)*TAU});}
    for(let i=0;i<4;i++){let p;do{p=safePosition(s,(random(s)*2-1)*(b.x-200),(random(s)*2-1)*(b.z-180));}while(dist(p,s.player)<600);addShip(s,i%3===1?'brig':'sloop',p.x,p.z,{name:namedShip(s),role:'patrol',home:p,loot:110+i*20,faction:pick(s,w.enemies)});}
    for(let i=0;i<2;i++){const p=safePosition(s,b.x*.6,b.z*(i?-.7:.7));addShip(s,'galleon',p.x,p.z,{name:i?'Independent trader':namedShip(s,true),role:'friendly',friendly:true,neutral:!!i,faction:i?'Independent European merchant':FACTIONS[s.affiliation].name,home:p});}
    updateGate(s);
  }
  function updateGate(s) {
    if(s.voyagesCompleted<s.turning.nextAt||s.turning.fragments<3){s.gate=null;return;}
    const order=Object.keys(WORLDS),index=order.indexOf(s.worldId);
    const next=Array.from({length:order.length-1},(_,i)=>order[(index+i+1)%order.length]).find(id=>!s.visitedWorlds.includes(id))||order[(index+1)%order.length];
    const back=[...s.visitedWorlds].reverse().find(id=>id!==s.worldId&&id!==next);
    const appeared=!s.gate;s.gate={...safePosition(s,world(s).gate.x,world(s).gate.z),r:78,destinations:back?[next,back]:[next]};
    if(appeared) event(s,'gate',{text:'Three star-path fragments align. A Turning Water has been charted. Consult the sea atlas.'});
  }
  function travel(s,destination) {
    if(s.phase!=='sailing'||!s.complete||!s.gate||dist(s.player,s.gate)>120||!s.gate.destinations.includes(destination))return false;
    const from=s.worldId;s.worldId=destination;s.checkpoint=world(s).home;s.affiliation=world(s).patrons[0];s.player.patron=s.affiliation;
    s.turning.fragments-=3;s.turning.passages++;s.turning.nextAt=s.voyagesCompleted+3;
    if(!s.visitedWorlds.includes(destination))s.visitedWorlds.push(destination);
    if(!s.worldProgress[destination])s.worldProgress[destination]={voyages:0};
    resetSea(s,false);event(s,'travel',{from,to:destination,text:`${world(s).name} · ${world(s).year}. The ship is yours; the century has changed.`});return true;
  }
  function safePosition(s, x, z) {
    const b=bounds(s),p={x:clamp(x,-b.x+40,b.x-40),z:clamp(z,-b.z+40,b.z-40)};
    for(let pass=0;pass<30;pass++){
      let moved=false;
      for(const i of islands(s))if(landDistance(p,i)<36){const q=landInfo(p,i);p.x=q.x+q.nx*40;p.z=q.z+q.nz*40;moved=true;}
      for(const h of s.hazards||[])if(h.kind==='reef'&&dist(p,h)<h.r+40){const a=bearing(h,p);p.x=h.x+Math.sin(a)*(h.r+42);p.z=h.z+Math.cos(a)*(h.r+42);moved=true;}
      p.x=clamp(p.x,-b.x+40,b.x-40);p.z=clamp(p.z,-b.z+40,b.z-40);
      if(!moved&&islands(s).every(i=>landDistance(p,i)>=30))return p;
    }
    // Overlapping mainland edges or the chart boundary can trap a local projection.
    // Search outward for the nearest navigable patch, rather than spawn on land.
    for(let r=50;r<6000;r+=50)for(let j=0;j<32;j++){const a=j/32*TAU,q={x:clamp(p.x+Math.cos(a)*r,-b.x+40,b.x-40),z:clamp(p.z+Math.sin(a)*r,-b.z+40,b.z-40)};if(islands(s).every(i=>landDistance(q,i)>36)&&(s.hazards||[]).every(h=>h.kind!=='reef'||dist(q,h)>h.r+40))return q;}
    return p;
  }

  function addShip(s, cls, x, z, extra) { const v = makeShip(s.nextId++, cls, x, z, extra); s.ships.push(v); return v; }
  function mission(s) { return s.voyage.legs[Math.min(s.legIndex, s.voyage.legs.length - 1)]; }
  function objectivePosition(s) {
    if (s.complete) return null;
    const m = mission(s);
    if (s.progress >= m.requirement) return { ...islands(s).find(i => i.id === m.port).port, name: islands(s).find(i => i.id === m.port).name, type: 'port' };
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
      const v = addShip(s, cls, location.x, location.z, { name: m.targetName, home: { ...location }, mission:key,trait:m.trait,upgrades,faction:extra.friendly?FACTIONS[m.patron].name:m.enemy,...extra });
      v.hull = maxHull(v); return v;
    };
    if (m.kind === 'salvage') for (let i = 0; i < m.requirement; i++) {
      const p = s.voyage.intro ? (()=>{const p=harborPoint(portById(s,world(s).home),[150,260,340][i],[-75,15,-145][i]);return safePosition(s,p.x,p.z);})() : safePosition(s, at.x + Math.cos(i * 2.4) * 80, at.z + Math.sin(i * 2.4) * 80);
      s.loot.push({ id: s.nextId++, ...p, mission: key, kind: 'mission', value: 45 + m.level * 8, bob: random(s) * TAU });
    }
    if (['chart', 'relic'].includes(m.kind)) {
      s.loot.push({ id: s.nextId++, ...at, mission: key, kind: m.kind === 'relic' ? 'relic' : 'mission', value: m.kind === 'relic' ? 180 : 85, bob: 1, relic: m.kind === 'relic' ? m.relic : null });
      if (m.kind === 'relic' && m.level > 0) { const p = safePosition(s, at.x + 130, at.z + 100); addShip(s, m.level > 3 ? 'brig' : 'sloop', p.x, p.z, { name: namedShip(s), role:'guard',home:p,loot:140,faction:m.enemy }); }
    }
    if (['raider', 'convoy', 'flagship'].includes(m.kind)) {
      named(m.targetClass, at, { role: m.kind === 'flagship' ? 'boss' : m.kind, loot: m.kind === 'convoy' ? 450 + m.level * 45 : 170 + m.level * 30 });
      if (m.kind !== 'raider' && m.level > 0) { const p = safePosition(s, at.x + 110, at.z + 70); addShip(s, m.level > 3 ? 'brig' : 'sloop', p.x, p.z, { name: namedShip(s), role:'guard',home:p,loot:140,faction:m.enemy }); }
    }
    if (m.kind === 'escort') {
      const start = harborPoint(portById(s,m.startPort),90), goal = portById(s,m.port).port;
      const v = named('galleon', { x: start.x, z: start.z }, { role: 'escort', friendly: true, goal: { ...goal }, arrived: false }); v.hull = 340;
      const mid = safePosition(s, (start.x + goal.x) / 2 + 90, (start.z + goal.z) / 2 + 70);
      addShip(s, 'sloop', mid.x, mid.z, { name: namedShip(s), role:'ambush',home:mid,loot:140,faction:m.enemy });
    }
  }
  function skyRandom(s){const a=s.atmosphere;a.seed=(Math.imul(a.seed,1664525)+1013904223)>>>0;return a.seed/4294967296;}
  function stormPower(w){if(w.age===undefined)return w.intensity??1;return (w.intensity??1)*clamp(w.age/16,0,1)*clamp((w.life-w.age)/24,0,1);}
  function spawnStorm(s,initial=false){
    const a=s.atmosphere,rand=()=>skyRandom(s),angle=s.wind.angle+(rand()-.5)*1.8,d=initial?950:650+rand()*350;
    const origin=initial?{x:0,z:0}:s.player,q=safePosition(s,origin.x-Math.sin(angle)*d,origin.z-Math.cos(angle)*d);
    const strong=!initial&&rand()>.5;
    const cell={...q,id:`squall-${a.seed}`,r:strong?260+rand()*95:170+rand()*85,seed:rand()*1000,age:initial?28:0,life:initial?125:125+rand()*65,intensity:strong?1:.65,angle,drift:3.5+rand()*3,kind:strong?'Storm':'Squall'};
    s.weather.push(cell);
    if(!initial)event(s,'message',{text:`${strong?'Storm clouds':'A squall'} building offshore. Check the chart and reef before entering rough water.`,tone:'warning'});
    return cell;
  }
  function updateWeather(s,dt){
    const a=s.atmosphere;if(!a||a.disabled)return;
    if(s.time>=a.nextFront){
      const r=skyRandom(s);
      a.kind=r<.18?'Lull':r<.7?'Fresh breeze':'Gale front';
      a.strength=r<.18?5+skyRandom(s)*4:r<.7?11+skyRandom(s)*8:21+skyRandom(s)*5;
      a.angle=world(s).wind+(skyRandom(s)-.5)*(r>.7?4.8:3.2);
      a.nextFront=s.time+35+skyRandom(s)*40;
      event(s,'message',{text:`${a.kind}: the wind is shifting toward ${Math.round(a.strength)} knots. Watch your heading.`,tone:r>.7?'warning':''});
    }
    s.wind.angle+=angleDiff(a.angle+Math.sin(s.time*.11)*.1,s.wind.angle)*(1-Math.exp(-dt*.075));
    s.wind.strength+=(a.strength+Math.sin(s.time*.23)*1.5-s.wind.strength)*(1-Math.exp(-dt*.12));
    if(s.time>=a.nextStorm){if(s.weather.length<3)spawnStorm(s);a.nextStorm=s.time+65+skyRandom(s)*60;}
    for(const w of s.weather)if(w.age!==undefined){w.age+=dt;w.x+=Math.sin(w.angle)*w.drift*dt;w.z+=Math.cos(w.angle)*w.drift*dt;}
    s.weather=s.weather.filter(w=>w.age===undefined||w.age<w.life);
  }
  function windAt(s,p){
    let gust=0,hazard=0,shift=0;
    for(const cell of s.weather){const q=1-dist(p,cell)/cell.r,power=stormPower(cell);gust=Math.max(gust,clamp(q+.15,0,1)*12*power);const local=clamp(q/.8,0,1)*power;if(local>hazard){hazard=local;shift=Math.sin(s.time*.13+cell.seed)*.6*local;}}
    return {angle:s.wind.angle+shift,strength:clamp(s.wind.strength+gust,3,38),hazard};
  }
  function currentAt(s,p){let x=0,z=0;for(const h of s.hazards||[])if(h.kind==='current'){const q=clamp(1-dist(p,h)/h.r,0,1),strength=q*h.strength*(.75+.25*Math.sin(s.time*.1+h.seed));x+=Math.sin(h.angle)*strength;z+=Math.cos(h.angle)*strength;}return{x,z};}
  function seaHeight(s,p,t=s.time){const wind=windAt(s,p),along=p.x*Math.sin(s.wind.angle)+p.z*Math.cos(s.wind.angle),amp=.35+wind.strength*.025+wind.hazard*1.1;return Math.sin(along*.043-t*1.7)*amp+Math.cos(p.x*.026-p.z*.031-t*.9)*amp*.45;}
  function contactDamage(s,v,impact,label){
    if(v.hull<=0||v.invulnerable>0)return;
    const amount=Math.min(36,1.5+impact*impact*.025);v.hull-=amount;
    event(s,'collision',{x:v.x,z:v.z,power:amount});
    if(v.id==='player')event(s,'message',{text:`${label} · hull −${Math.ceil(amount)}. Reef and turn toward open water.`,tone:'warning'});
  }
  function polar(angle, wind, cls) {
    const d = Math.abs(angleDiff(angle, wind)); // zero = running with wind; pi = headwind
    const upwind = (1 + Math.cos(d)) * .5;
    const reach = Math.sin(d);
    return clamp((cls === 'sloop' ? .2 : .07) + .66 * upwind + .45 * reach, .06, 1.1);
  }
  function sailShip(s, v, helm, sail, dt) {
    const spec=CLASSES[v.class],w=windAt(s,v),u=v.upgrades||{},patron=FACTIONS[v.patron]||{};
    v.sail = sail;
    const hullFactor = clamp(v.hull / maxHull(v), .15, 1);
    const target = spec.speed * polar(v.angle, w.angle, v.class) * (w.strength / 13) ** .55 * (sail ? 1 : .49) * (.32 + .68 * v.sails / 100) * (.65 + .35 * hullFactor) * (1 + (u.sails || 0) * .12 + (v.relics?.speed || 0)+(patron.speed||0)) * clamp(v.crew / (spec.crew * .35), .45, 1);
    v.speed += (target - v.speed) * Math.min(1, dt * .72);
    const turn = spec.turn * (sail ? 1 : 1.42) * (1+(u.copper||0)*.14+(patron.turn||0)) * (.45 + .55 * v.sails / 100);
    v.angle = (v.angle - clamp(helm, -1, 1) * turn * dt) % TAU;
    const previous = { x: v.x, z: v.z };
    const current=currentAt(s,v);
    v.x += Math.sin(v.angle) * v.speed * dt; v.z += Math.cos(v.angle) * v.speed * dt;
    v.x+=current.x*dt;v.z+=current.z*dt;
    for(const i of islands(s)){
      const hull=hullSegment(v),samples=[hull.a,v,hull.b],at=samples.reduce((a,b)=>landDistance(a,i)<landDistance(b,i)?a:b);
      if(landDistance(at,i)<hull.r){
        const q=landInfo(at,i),impact=Math.max(0,-(Math.sin(v.angle)*q.nx+Math.cos(v.angle)*q.nz)*v.speed);
        v.x+=q.x+q.nx*(hull.r+1)-at.x;v.z+=q.z+q.nz*(hull.r+1)-at.z;v.speed*=.35;
        if(s.time>=(v.coastCooldown||0)){contactDamage(s,v,impact,'Grounding');v.coastCooldown=s.time+.9;}
      }
    }
    for(const h of s.hazards||[])if(h.kind==='reef'){
      const hull=hullSegment(v),dx=hull.b.x-hull.a.x,dz=hull.b.z-hull.a.z,t=clamp(((h.x-hull.a.x)*dx+(h.z-hull.a.z)*dz)/(dx*dx+dz*dz),0,1),at={x:hull.a.x+dx*t,z:hull.a.z+dz*t},d=dist(at,h);
      if(d<h.r+hull.r){
        const nx=d>.001?(at.x-h.x)/d:Math.sin(v.angle+Math.PI),nz=d>.001?(at.z-h.z)/d:Math.cos(v.angle+Math.PI),impact=Math.max(0,-(Math.sin(v.angle)*nx+Math.cos(v.angle)*nz)*v.speed),push=h.r+hull.r-d+1;
        v.x+=nx*push;v.z+=nz*push;v.speed*=.3;
        if(s.time>=(v.coastCooldown||0)){contactDamage(s,v,impact,'Reef strike');v.coastCooldown=s.time+.9;}
      }
    }

    const b=bounds(s);
    if(Math.abs(v.x)>b.x||Math.abs(v.z)>b.z) {
      v.x = clamp(v.x,-b.x,b.x); v.z = clamp(v.z,-b.z,b.z); v.speed *= .9;
      if (v.id === 'player' && s.time - (s.edgeNotice || -99) > 8) { s.edgeNotice = s.time; event(s, 'message', { text: 'Open ocean beyond. Your fortunes lie within the archipelago.' }); }
      if (v.id !== 'player') v.angle = bearing(v, { x: 0, z: 0 });
    }
    v.invulnerable = Math.max(0, v.invulnerable - dt);
    v.reload = Math.min(1, v.reload + dt / (6.5 / (1 + (u.crew || 0) * .18)) * clamp(v.crew / spec.crew, .28, 1.2));
    if(w.hazard>.05&&v.invulnerable<=0) {
      const shield = (u.weather ? .3 : 1) * (1-(v.relics?.storm||0))*(1-(patron.storm||0));
      v.sails = Math.max(7, v.sails - w.hazard * dt * 2.3 * shield * (sail ? 1 : .5));
      v.hull-=w.hazard*dt*.65*shield*(sail?1:.35);
    }
    v.previous = previous;
  }
  function range(v) { return AMMO[v.ammo].range * (1 + (v.upgrades?.powder || 0) * .12 + (v.relics?.range||0)+(FACTIONS[v.patron]?.range||0)); }
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
  function clearSeaLeg(s,a,b,padding=32){
    const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    if((s.hazards||[]).some(h=>h.kind==='reef'&&segmentDistance(a,b,h)<h.r+padding))return false;
    return islands(s).every(i=>{
      const c=coast(i);if(Math.max(a.x,b.x)<c.minX-padding||Math.min(a.x,b.x)>c.maxX+padding||Math.max(a.z,b.z)<c.minZ-padding||Math.min(a.z,b.z)>c.maxZ+padding)return true;
      if(landDistance(a,i)<padding||landDistance(b,i)<padding)return false;
      return c.points.every((u,j)=>{const v=c.points[(j+1)%c.points.length];if(cross(a,b,u)*cross(a,b,v)<0&&cross(u,v,a)*cross(u,v,b)<0)return false;return Math.min(segmentDistance(a,b,u),segmentDistance(a,b,v),segmentDistance(u,v,a),segmentDistance(u,v,b))>=padding;});
    });
  }
  function navigationRoute(s, from, to, cls = 'sloop') {
    const goal=safePosition(s,to.x,to.z),nodes=[{x:from.x,z:from.z},goal],b=bounds(s);
    const navigable=p=>Math.abs(p.x)<b.x-5&&Math.abs(p.z)<b.z-10&&islands(s).every(i=>landDistance(p,i)>30)&&(s.hazards||[]).every(h=>h.kind!=='reef'||dist(p,h)>h.r+30);
    // Offset actual coast vertices. The same shoreline drives visuals, collisions and routes.
    for(const i of islands(s)){
      const c=coast(i),v=c.points;
      for(let j=0;j<v.length;j++){
        const a=v[(j+v.length-1)%v.length],p=v[j],z=v[(j+1)%v.length];
        const d1=dist(a,p),d2=dist(p,z),nx=((p.z-a.z)/d1+(z.z-p.z)/d2)*c.sign,nz=(-(p.x-a.x)/d1-(z.x-p.x)/d2)*c.sign,len=Math.hypot(nx,nz)||1;
        const q={x:p.x+nx/len*85,z:p.z+nz/len*85};if(navigable(q))nodes.push(q);
      }
    }
    for(const h of s.hazards||[])if(h.kind==='reef')for(let j=0;j<12;j++){const a=j/12*TAU,q={x:h.x+Math.sin(a)*(h.r+65),z:h.z+Math.cos(a)*(h.r+65)};if(navigable(q))nodes.push(q);}
    for(let x=-b.x+180;x<b.x;x+=550)for(let z=-b.z+180;z<b.z;z+=550)if(navigable({x,z}))nodes.push({x,z});
    const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), used = new Set(); costs[0] = 0;
    for (let count = 0; count < nodes.length; count++) {
      let k = -1; for (let j = 0; j < nodes.length; j++) if (!used.has(j) && (k < 0 || costs[j] < costs[k])) k = j;
      if (k < 0 || !Number.isFinite(costs[k]) || k === 1) break;
      used.add(k);
      for (let j = 1; j < nodes.length; j++) {
        if (used.has(j) || !clearSeaLeg(s,nodes[k],nodes[j])) continue;
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
  function nearestPort(s, within = 98) { return islands(s).filter(i => i.port && dist(s.player, i.port) < within).sort((a, b) => dist(s.player, a.port) - dist(s.player, b.port))[0] || null; }
  function boardingTarget(s) { return s.ships.filter(v => !v.friendly && v.hull > 0 && dist(v, s.player) < 53 && (v.sails < 43 || v.crew < CLASSES[v.class].crew * .52 || v.hull < maxHull(v) * .43)).sort((a, b) => dist(a, s.player) - dist(b, s.player))[0] || null; }
  function board(s) {
    if (s.phase !== 'sailing') return false;
    const target = boardingTarget(s);
    if (!target) { event(s, 'message', { text: 'Close within 53 yards of a weakened ship. Use chain or grape first.' }); return false; }
    const strength = s.player.crew * (1.3 + s.player.upgrades.crew * .18 + (s.player.relics?.boarding||0)+(FACTIONS[s.player.patron]?.board||0)), defense = target.crew * .8;
    if (strength < defense) { event(s, 'message', { text: 'Their crew is too strong. Thin their ranks with grape shot.', tone: 'warning' }); return false; }
    s.player.crew = Math.max(8, s.player.crew - target.crew * .12);
    defeatShip(s, target, true); return true;
  }
  function defeatShip(s, v, captured = false, credited=true) {
    if (v.removed) return;
    v.removed = true; v.hull = 0;
    event(s,'sink',{x:v.x,z:v.z,captured});
    if (v.friendly) {
      if (v.role === 'escort') { s.chapterSpawned = -1; s.progress = 0; event(s, 'message', { text: `${v.name} was lost. Dock at any harbor to arrange another escort.`, tone: 'warning' }); s.escortLost = true; }
      return;
    }
    if(credited){s.stats[captured?'captured':'sunk']++;s.renown+=captured?35:20;}
    const value = (v.loot || 120) * (captured ? 1.7 : 1);
    if (captured) { s.cargo += Math.round(value); event(s, 'message', { text: `${v.name} taken! Prize cargo worth ${Math.round(value)} gold.`, tone: 'good' }); }
    else { s.loot.push({ id: s.nextId++, x: v.x, z: v.z, kind: 'chest', value: Math.round(value), bob: 0 }); event(s, 'message', { text: `${v.name} struck her colors. Recover the floating cargo.`, tone: 'good' }); }
    if (v.mission === mission(s).objective) {
      if (mission(s).kind === 'convoy' && !captured) { s.convoyRetry = 18; event(s, 'message', { text: 'The prize sank. Another treasure convoy will arrive. Capture it with B.', tone: 'warning' }); }
      else { s.progress = mission(s).requirement; event(s, 'objective', { text: `Commission secured. Make port at ${islands(s).find(i => i.id === mission(s).port).name}.` }); }
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
      if (dist(v, v.goal) < 60) { v.arrived = true; s.progress = 1; event(s, 'objective', { text: `${v.name} is safe. Dock at ${portById(s,mission(s).port).name} to claim your reward.` }); return; }
      if (dist(v, s.player) > 260) { v.speed *= .97; return; }
      if(!v.route||Math.abs(angleDiff(s.wind.angle,v.routeWind??s.wind.angle))>.5){v.route=navigationRoute(s,v,v.goal,'galleon');v.routeWind=s.wind.angle;}
      while (v.route.length > 1 && dist(v, v.route[0]) < 48) v.route.shift();
      desired=bearing(v,v.route[0]||v.goal);v.speed=Math.min(v.speed,23);
      if(Math.abs(angleDiff(desired,v.angle))>.5||windAt(s,v).hazard>.2)full=0;
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
    for (const i of islands(s)) if (v.role !== 'escort' && landDistance(ahead,i)<50) {
      const q=landInfo(ahead,i),away=Math.atan2(q.nx,q.nz); desired = away + (angleDiff(desired, away) > 0 ? 1 : -1) * .6;
    }
    for(const h of s.hazards||[])if(h.kind==='reef'&&v.role!=='escort'&&dist(ahead,h)<h.r+45){const away=bearing(h,v);desired=away+(angleDiff(desired,away)>0?1:-1)*.6;}
    // Avoid friendly hulls, while leaving deliberate player ramming possible.
    for(const other of [s.player,...s.ships])if(other!==v&&other.hull>0&&(v.role!=='escort'||other.id!=='player'||dist(v,other)<35)&&dist(v,other)<65&&dist(v,other)>25&&Math.abs(angleDiff(bearing(v,other),desired))<.5)desired+=v.id%2?.65:-.65;
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
        if (l.mission && s.progress >= mission(s).requirement) event(s, 'objective', { text: `Cargo secured. Deliver it to ${islands(s).find(i => i.id === mission(s).port).name}.` });
      } else keep.push(l);
    }
    s.loot = keep;
  }
  function hullSegment(v){const c=CLASSES[v.class],r=c.beam*.5+1,length=c.length*.5-r,dx=Math.sin(v.angle)*length,dz=Math.cos(v.angle)*length;return{a:{x:v.x-dx,z:v.z-dz},b:{x:v.x+dx,z:v.z+dz},r};}
  function hullContact(a,b){
    const u=hullSegment(a),v=hullSegment(b),dx=u.b.x-u.a.x,dz=u.b.z-u.a.z,ex=v.b.x-v.a.x,ez=v.b.z-v.a.z,rx=u.a.x-v.a.x,rz=u.a.z-v.a.z;
    const aa=dx*dx+dz*dz,ee=ex*ex+ez*ez,bb=dx*ex+dz*ez,cc=dx*rx+dz*rz,ff=ex*rx+ez*rz,den=aa*ee-bb*bb;
    let t=den?clamp((bb*ff-cc*ee)/den,0,1):0,q=(bb*t+ff)/ee;
    if(q<0){q=0;t=clamp(-cc/aa,0,1);}else if(q>1){q=1;t=clamp((bb-cc)/aa,0,1);}
    const x=v.a.x+ex*q-(u.a.x+dx*t),z=v.a.z+ez*q-(u.a.z+dz*t),d=Math.hypot(x,z);if(d>=u.r+v.r)return null;
    const fallback=bearing(a,b);return{nx:d>.001?x/d:Math.sin(fallback),nz:d>.001?z/d:Math.cos(fallback),overlap:u.r+v.r-d};
  }
  function collideShips(s){
    const ships=[s.player,...s.ships].filter(v=>v.hull>0&&!v.removed);s.contacts||={};
    for(let i=0;i<ships.length;i++)for(let j=i+1;j<ships.length;j++){
      const a=ships[i],b=ships[j];if(a.hull<=0||b.hull<=0)continue;if(dist(a,b)>(CLASSES[a.class].length+CLASSES[b.class].length)*.6)continue;
      const c=hullContact(a,b);if(!c)continue;
      const ma=CLASSES[a.class].hull,mb=CLASSES[b.class].hull,impact=Math.max(0,(Math.sin(a.angle)*a.speed-Math.sin(b.angle)*b.speed)*c.nx+(Math.cos(a.angle)*a.speed-Math.cos(b.angle)*b.speed)*c.nz);
      a.x-=c.nx*(c.overlap+.2)*mb/(ma+mb);a.z-=c.nz*(c.overlap+.2)*mb/(ma+mb);b.x+=c.nx*(c.overlap+.2)*ma/(ma+mb);b.z+=c.nz*(c.overlap+.2)*ma/(ma+mb);
      const key=`${a.id}:${b.id}`;
      if(impact>1.5&&s.time>=(s.contacts[key]||0)){
        const power=2+impact*impact*.018;
        if(a.invulnerable<=0)a.hull-=Math.min(maxHull(a)*.45,power*mb/(ma+mb)*2);
        if(b.invulnerable<=0)b.hull-=Math.min(maxHull(b)*.45,power*ma/(ma+mb)*2);
        s.contacts[key]=s.time+1.2;event(s,'collision',{x:(a.x+b.x)/2,z:(a.z+b.z)/2,power});
        if(a.id==='player'||b.id==='player')event(s,'message',{text:'Collision! Both hulls take damage. Turn clear before making another pass.',tone:'warning'});
      }
      if(impact>0){a.speed*=.4;b.speed*=.4;}
      for(const v of [a,b])if(v.hull<=0&&v.id!=='player')defeatShip(s,v,false,a.id==='player'||b.id==='player');
    }
    for(const key of Object.keys(s.contacts))if(s.contacts[key]<s.time-2)delete s.contacts[key];
  }
  function step(s, input = {}, dt = 1 / 60) {
    s.events = [];
    if (s.phase !== 'sailing') return;
    dt = clamp(dt, 0, .05); s.time += dt;
    updateWeather(s,dt);
    const danger=(s.hazards||[]).find(h=>dist(s.player,h)<h.r+70),key=danger?.id||null;
    if(key!==s.lastHazard){s.lastHazard=key;if(danger)event(s,'message',{text:danger.kind==='reef'?'Breaking water ahead: submerged reef. Give the rocks a wide berth.':'A crosscurrent is pulling across your course. Correct your heading.',tone:'warning'});}
    if (input.sail !== undefined) s.player.sail = input.sail;
    if (input.ammo && AMMO[input.ammo]) s.player.ammo = input.ammo;
    sailShip(s, s.player, input.helm || 0, s.player.sail, dt);
    for (const v of s.ships) ai(s, v, dt);
    collideShips(s);
    for(const v of s.ships)if(v.hull<=0&&!v.removed)defeatShip(s,v,false,false);
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
      s.lastReward = mission(s).reward; s.gold += s.lastReward; s.renown+=100;s.chapter++;const patron=s.voyage.patron;s.standing[patron]=(s.standing[patron]||0)+20;
      if (s.pendingRelic) {
        s.artifacts.push(s.pendingRelic); s.artifacts = s.artifacts.slice(-24);
        const relic = RELICS[s.pendingRelic.type]; s.player.relics[relic.stat] = Math.min(relic.bonus * 5, (s.player.relics[relic.stat] || 0) + relic.bonus);
        event(s, 'artifact', { relic: s.pendingRelic }); s.pendingRelic = null;
      }
      s.legIndex++;
      if (s.legIndex >= s.voyage.legs.length) {
        s.complete=true;s.voyagesCompleted++;s.worldProgress[s.worldId].voyages++;s.turning.fragments++;updateGate(s);s.gold += s.voyage.bonus; s.lastReward += s.voyage.bonus;
        generateOffers(s); event(s, 'victory');
      } else spawnChapter(s);
      event(s, 'chapter', { reward: s.lastReward, chapter: s.chapter });
    }
    if (s.escortLost) { s.escortLost = false; spawnChapter(s); }
    event(s, 'port', { id: port.id }); return port;
  }
  function leavePort(s) { if (s.phase === 'port') { s.phase = 'sailing'; s.player.invulnerable = 4; event(s, 'leave'); } }
  function repairCost(s) { const p = s.player; return Math.ceil(((maxHull(p)-p.hull)*.48+(100-p.sails)*.3+(maxCrew(p)-p.crew)*.9)*(1-(FACTIONS[s.affiliation]?.refit||0))); }
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
    const home = islands(s).find(i => i.id === s.checkpoint) || portById(s,world(s).home);
    Object.assign(s.player,harborPoint(home,55)); s.player.hull = maxHull(s.player); s.player.sails = 100; s.player.crew = maxCrew(s.player); s.player.speed = 0; s.player.invulnerable = 8; s.shots = [];
    for (const v of s.ships) { v.aggro = false; if (dist(v, s.player) < 300) { v.x += 350; v.z -= 150; } }
    event(s, 'rescued', { text: `A passing tender rescued you. Repairs are covered; some cargo and coin were lost. Back at ${home.name}.` });
  }
  // Save the captain, not a world snapshot. Loading generates fresh waters and offers.
  function serialize(s) {
    const p = s.player;
    return JSON.stringify({ version:4,worldId:s.worldId,affiliation:s.affiliation,standing:s.standing,visitedWorlds:s.visitedWorlds,worldProgress:s.worldProgress,turning:s.turning,seed:s.seed, gold: s.gold, cargo: s.cargo, renown: s.renown, chapter: s.chapter, voyagesCompleted: s.voyagesCompleted, stats: s.stats, checkpoint: s.checkpoint, artifacts: s.artifacts.slice(-24), ship: { class: p.class, livery: p.livery, hull: p.hull, sails: p.sails, crew: p.crew, upgrades: { ...p.upgrades }, relics: { ...p.relics } } });
  }
  function restore(text) {
    try {
      if (typeof text !== 'string' || text.length > 25000) return null;
      let saved = JSON.parse(text);
      // Accept the first prototype’s profile, dropping its encounter snapshot.
      if (saved?.version === 1 && saved.player) saved = { ...saved, version: 3, ship: saved.player, voyagesCompleted: 0, artifacts: [] };
      if (![3,4].includes(saved?.version) || (saved.version===4&&!WORLDS[saved.worldId]) || !saved.ship || !['sloop', 'brig', 'frigate'].includes(saved.ship.class)) return null;
      const p = saved.ship;
      if (![saved.seed, saved.gold, saved.cargo, saved.renown, saved.chapter, p.hull, p.sails, p.crew].every(Number.isFinite) || saved.gold < 0 || saved.cargo < 0 || saved.chapter < 0 || !p.upgrades) return null;
      for (const u of UPGRADES) if (!Number.isInteger(p.upgrades[u.id]) || p.upgrades[u.id] < 0 || p.upgrades[u.id] > u.max) return null;
      if (!saved.stats || !['sunk', 'captured', 'shots', 'recovered', 'defeats'].every(k => Number.isFinite(saved.stats[k]) && saved.stats[k] >= 0)) return null;
      const s=create((saved.seed^0x73a7c251)>>>0,saved.worldId||'india');
      s.gold = saved.gold; s.cargo = saved.cargo; s.renown = saved.renown; s.chapter = Math.floor(saved.chapter); s.stats = { ...saved.stats }; s.voyagesCompleted = Math.max(0, Math.floor(saved.voyagesCompleted || 0));
      s.checkpoint = portById(s,saved.checkpoint).id;
      s.player.class = p.class; s.player.livery = ['teal','indigo','ochre'].includes(p.livery)?p.livery:'teal'; s.player.upgrades = { ...p.upgrades };
      s.player.hull = clamp(p.hull, 1, maxHull(s.player)); s.player.sails = clamp(p.sails, 7, 100); s.player.crew = clamp(p.crew, 2, maxCrew(s.player));
      s.player.relics = { speed: 0, range: 0, storm: 0, boarding: 0 };
      if (p.relics) for (const [stat, limit] of Object.entries({ speed: .15, range: .15, storm: .4, boarding: .2 })) s.player.relics[stat] = clamp(Number(p.relics[stat]) || 0, 0, limit);
      s.artifacts = Array.isArray(saved.artifacts) ? saved.artifacts.filter(a => a && RELICS[a.type] && typeof a.name === 'string' && a.name.length < 100).slice(-24).map(a => ({ id: String(a.id).slice(0, 80), type: a.type, name: a.name, rarity: ['rare', 'legendary'].includes(a.rarity) ? a.rarity : 'common', label: RELICS[a.type].label })) : [];
      if(saved.version===4){
        s.affiliation=world(s).patrons.includes(saved.affiliation)?saved.affiliation:world(s).patrons[0];s.player.patron=s.affiliation;
        s.standing=Object.fromEntries(Object.entries(saved.standing||{}).filter(([k,v])=>FACTIONS[k]&&Number.isFinite(v)).map(([k,v])=>[k,clamp(v,0,1000000)]));
        s.visitedWorlds=[...new Set([s.worldId,...(Array.isArray(saved.visitedWorlds)?saved.visitedWorlds.filter(id=>WORLDS[id]):[])])];
        s.worldProgress=Object.fromEntries(Object.keys(WORLDS).map(id=>[id,{voyages:clamp(Math.floor(Number(saved.worldProgress?.[id]?.voyages)||0),0,100000)}]));
        s.turning={fragments:clamp(Math.floor(Number(saved.turning?.fragments)||0),0,10000),nextAt:Math.max(3,Math.floor(Number(saved.turning?.nextAt)||3)),passages:clamp(Math.floor(Number(saved.turning?.passages)||0),0,10000)};
      }else{s.turning.nextAt=s.voyagesCompleted+3;}
      resetSea(s,false);s.events=[];
      return s;
    } catch { return null; }
  }
  root.Corsair = { WORLDS,FACTIONS,world,islands,bounds,landOutline,landDistance,harborPoint,clearSeaLeg,updateWeather,spawnStorm,stormPower,currentAt,seaHeight,hullContact,collideShips,portById,shipName,updateGate,travel,TAU,clamp,dist,bearing, angleDiff, CLASSES, AMMO, UPGRADES, ISLANDS, RELICS, THEMES, generateVoyage, generateOffers, acceptContract, create, step, fire, board, dock, leavePort, repair, repairCost, upgrade, upgradeCost, buyShip, maxHull, maxCrew, range, windAt, polar, nearestPort, boardingTarget, mission, objectivePosition, targetInBroadside, shotHeight, defeatShip, spawnChapter, navigationRoute, serialize, restore };
})(typeof globalThis !== 'undefined' ? globalThis : this);
