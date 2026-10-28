const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../src/worlds.js');
require('../src/engine.js');
const C = globalThis.Corsair;
const fresh = () => C.create(1668);
const advance = (s, seconds, input = {}) => { for (let i = 0; i < seconds * 60; i++) C.step(s, input); };
const atPort = (s, id) => { const p=C.portById(s,id).port; s.player.x = p.x + 25; s.player.z = p.z; s.player.speed = 0; return C.dock(s); };
function chapter(index) {
  const kind = ['salvage','raider','escort','chart','convoy','flagship'][index];
  const theme = ({salvage:'relic',raider:'bounty',escort:'passage',chart:'relic',convoy:'prize',flagship:'bounty'})[kind];
  const s = fresh();
  let v; do { v = C.generateVoyage(s,theme); } while (!v.legs.some(m=>m.kind===kind));
  v.legs = [v.legs.find(m=>m.kind===kind)]; s.voyage=v; s.legIndex=0; s.chapter=index; s.chapterSpawned=-1; s.ships=[]; s.loot=[]; C.spawnChapter(s); return s;
}

test('onboarding voyage has linked objectives, three salvage targets, and navigable port approaches', () => {
  const s = fresh(); assert.equal(s.voyage.legs.length, 2); assert.equal(C.ISLANDS.length,10);
  assert.equal(s.loot.filter(l => l.mission === C.mission(s).objective).length, 3);
  for (const l of s.loot) for (const i of C.ISLANDS) assert.ok(C.landDistance(l,i)>0, `cargo inside ${i.name}`);
  for (const i of C.ISLANDS.filter(i => i.port)) assert.ok(C.landDistance(i.port,i)>C.CLASSES.frigate.beam);
});
test('wind polar favors a reach over headwind; reefing trades speed for handling', () => {
  assert.ok(C.polar(0, Math.PI, 'sloop') < C.polar(Math.PI / 2, Math.PI, 'sloop'));
  const full = fresh(), reef = fresh(); full.ships = []; reef.ships = []; full.weather = []; reef.weather = [];
  for (const s of [full, reef]) { s.player.x = 0; s.player.z = 0; s.player.angle = 1.6; }
  advance(full, 2, { helm: 1, sail: 1 }); advance(reef, 2, { helm: 1, sail: 0 });
  assert.ok(full.player.speed > reef.player.speed); assert.ok(reef.player.angle < full.player.angle);
});
test('fixed-seed simulation is repeatable and remains finite under prolonged input', () => {
  const a = fresh(), b = fresh();
  for (let i = 0; i < 18000; i++) { const input = { helm: Math.sin(i / 100), fire: i % 400 === 0, sail: i % 900 < 450 ? 1 : 0 }; C.step(a, input); C.step(b, input); }
  assert.equal(C.serialize(a), C.serialize(b));
  for (const v of [a.player, ...a.ships]) assert.ok([v.x, v.z, v.speed, v.hull, v.crew, v.sails].every(Number.isFinite));
});
test('broadside needs a target beside the ship and firing respects reload', () => {
  const s = chapter(1), t = s.ships[0]; s.player.x = 0; s.player.z = 0; s.player.angle = 0;
  t.x = 0; t.z = 160; assert.equal(C.fire(s, s.player), false);
  t.x = 160; t.z = 0; assert.equal(C.fire(s, s.player), true); assert.equal(s.shots.length, 4);
  assert.equal(C.fire(s, s.player), false); assert.equal(s.stats.shots, 1);
});
test('cannonballs describe visible arcs and expire at sea level', () => {
  const s = chapter(1), t = s.ships[0]; s.player.x = 0; s.player.z = 0; s.player.angle = 0; t.x = 200; t.z = 0;
  C.fire(s, s.player); const p = s.shots[0]; p.age = p.life / 2; assert.ok(C.shotHeight(p) > 15); p.age = p.life; assert.equal(C.shotHeight(p), 0);
});
test('swept projectiles hit and each ammunition type emphasizes its designated resource', () => {
  function hit(ammo) {
    const s = chapter(1), t = s.ships[0]; s.player.x = -600; s.player.z = 0; t.x = 0; t.z = 0; t.speed = 0; t.angle = 0;
    s.shots = [{ id: 999, owner: 'player', friendly: true, ammo, x: -3, z: 0, vx: 105, vz: 0, age: .2, life: 2, arc: 16, power: 10 }];
    const before = { hull: t.hull, sails: t.sails, crew: t.crew }; C.step(s);
    return { hull: before.hull - t.hull, sails: before.sails - t.sails, crew: before.crew - t.crew };
  }
  const r = hit('round'), c = hit('chain'), g = hit('grape'); assert.ok(r.hull > c.hull); assert.ok(c.sails > r.sails); assert.ok(g.crew > r.crew);
});
test('a ship cannot be boarded at full strength or from a distance', () => {
  const s = chapter(1), t = s.ships[0]; t.x = s.player.x + 30; t.z = s.player.z;
  assert.equal(C.board(s), false); t.sails = 30; t.x = s.player.x + 100; assert.equal(C.board(s), false);
  t.x = s.player.x + 30; assert.equal(C.board(s), true); assert.equal(s.stats.captured, 1); assert.ok(s.cargo > 0); assert.equal(s.progress, 1);
});
test('strong enemy crews must be weakened before boarding even with damaged sails', () => {
  const s = chapter(4), t = s.ships.find(v => v.role === 'convoy'); t.x = s.player.x + 25; t.z = s.player.z; t.sails = 10; t.crew = 120;
  assert.equal(C.board(s), false); t.crew = 20; assert.equal(C.board(s), true); assert.equal(s.progress, 1);
});
test('cargo collects once, mission progress persists until delivery, and wrong port cannot complete it', () => {
  const s = fresh(); s.ships = [];
  for (const l of [...s.loot.filter(l => l.mission)]) { s.player.x = l.x; s.player.z = l.z; s.player.speed = 0; C.step(s); }
  assert.equal(s.progress, 3); assert.equal(s.cargo, 135);
  atPort(s, 'surat'); assert.equal(s.chapter, 0); assert.equal(s.gold, 455); C.leavePort(s);
  const reward=C.mission(s).reward;atPort(s,'calicut');assert.equal(s.chapter,1);assert.equal(s.gold,455+reward);
  C.leavePort(s); atPort(s, 'calicut'); assert.equal(s.gold,455+reward,'reward cannot be claimed twice');
});
test('port purchases deduct coin, enforce caps and locks, transfer upgrades and replenish new ships', () => {
  const s = fresh(); s.gold = 10000; atPort(s, 'calicut');
  assert.equal(C.buyShip(s, 'brig'), false); assert.equal(C.upgrade(s, 'sails'), true); assert.equal(s.player.upgrades.sails, 1); assert.equal(s.gold, 9820);
  C.upgrade(s, 'sails'); C.upgrade(s, 'sails'); assert.equal(C.upgrade(s, 'sails'), false);
  s.chapter = 2; assert.equal(C.buyShip(s, 'brig'), true); assert.equal(s.player.upgrades.sails, 3); assert.equal(s.player.hull, C.maxHull(s.player));
  s.chapter = 4; assert.equal(C.buyShip(s, 'frigate'), true); assert.equal(C.buyShip(s, 'brig'), false);
  s.player.hull -= 40; s.player.sails -= 25; s.player.crew -= 10; const price = C.repairCost(s), gold = s.gold;
  assert.equal(C.repair(s), true); assert.equal(s.gold, gold - price); assert.equal(C.repairCost(s), 0);
  C.leavePort(s); assert.equal(C.upgrade(s, 'hull'), false); assert.equal(C.repair(s), false);
});
test('storms damage exposed ships; reefing and weather glass mitigate the damage', () => {
  function storm(reef, glass) {
    const s = fresh(); s.ships = []; s.player.x=s.weather[0].x;s.player.z=s.weather[0].z; s.player.invulnerable=0;s.player.upgrades.weather = glass; s.player.sails = 100;
    advance(s, 1, { sail: reef ? 0 : 1 }); return s.player.sails;
  }
  const full = storm(false, 0), reef = storm(true, 0), glass = storm(false, 1); assert.ok(full < reef); assert.ok(full < glass);
});
test('escort waits when separated, can arrive, and a lost escort can be relaunched', () => {
  const s = chapter(2), v = s.ships.find(v => v.role === 'escort'); s.player.x = 800; s.player.z = 700;
  const old = { x: v.x, z: v.z }; advance(s, 2); assert.equal(v.x, old.x); assert.equal(v.z, old.z);
  s.player.x = v.goal.x + 30; s.player.z = v.goal.z; v.x = v.goal.x; v.z = v.goal.z; C.step(s); assert.equal(s.progress, 1);
  const b = chapter(2), lost = b.ships.find(v => v.role === 'escort'); C.defeatShip(b, lost); assert.equal(b.escortLost, true); atPort(b, 'calicut'); assert.equal(b.escortLost, false); assert.ok(b.ships.some(v => v.role === 'escort' && !v.removed));
});
test('sinking the treasure galleon does not complete a capture mission and spawns a replacement', () => {
  const s = chapter(4), v = s.ships.find(v => v.role === 'convoy'); C.defeatShip(s, v); assert.equal(s.progress, 0); advance(s, 19); assert.ok(s.ships.some(v => v.role === 'convoy' && v.hull > 0));
});
function finishLeg(s) {
  const m=C.mission(s);
  if (['salvage','chart','relic'].includes(m.kind)) for (const l of [...s.loot.filter(l=>l.mission===m.objective)]) { s.player.x=l.x; s.player.z=l.z; s.player.speed=0; C.step(s); }
  else if(m.kind==='escort') { const v=s.ships.find(v=>v.role==='escort'); v.x=v.goal.x; v.z=v.goal.z; s.player.x=v.x+25;s.player.z=v.z; C.step(s); }
  else { const v=s.ships.find(v=>v.mission===m.objective); assert.ok(v); C.defeatShip(s,v,m.kind==='convoy'); }
  assert.equal(s.progress,m.requirement); assert.ok(atPort(s,m.port));
}

test('generated voyages continue beyond the original six steps and offer three distinct new themes',()=>{
  const s=fresh(); let commissions=0;
  for(let n=0;n<16;n++) {
    while(!s.complete) { if(s.phase==='port') C.leavePort(s); finishLeg(s); commissions++; }
    assert.equal(s.voyagesCompleted,n+1); assert.equal(s.contracts.length,3); assert.equal(new Set(s.contracts.map(v=>v.theme)).size,3);
    const offers=s.contracts.map(v=>v.id); const coins=s.gold; C.leavePort(s); atPort(s,C.mission(s).port); assert.equal(s.gold,coins,'no duplicate completion payment');
    assert.equal(C.acceptContract(s,offers[n%3]),true); assert.equal(C.acceptContract(s,offers[(n+1)%3]),false);
  }
  assert.ok(commissions>32); assert.equal(s.chapter,commissions); assert.equal(s.ships.length<30,true); assert.ok(s.artifacts.length>0);
});

test('generator produces deterministic, varied, valid objective chains across hundreds of seeds',()=>{
  const kinds=new Set(), names=new Set(), shipNames=new Set(), locations=new Set();
  for(let seed=0;seed<250;seed++) {
    const a=C.create(seed), b=C.create(seed); a.renown=b.renown=seed*10;
    for(const theme of Object.keys(C.THEMES)) {
      const x=C.generateVoyage(a,theme), y=C.generateVoyage(b,theme); assert.deepEqual(x,y); names.add(x.name);
      assert.ok(x.legs.length>=2&&x.legs.length<=3); assert.equal(new Set(x.legs.map(l=>l.id)).size,x.legs.length);
      for(const m of x.legs) {
        kinds.add(m.kind); shipNames.add(m.targetName); locations.add(`${Math.round(m.location.x)},${Math.round(m.location.z)}`);
        assert.ok(C.ISLANDS.some(i=>i.id===m.port&&i.port)); assert.ok(C.CLASSES[m.targetClass]); assert.ok(m.reward>0);
        if(m.kind==='escort') assert.notEqual(m.startPort,m.port);
        for(const i of C.ISLANDS) assert.ok(C.landDistance(m.location,i)>0,`bad spawn for ${m.kind}: ${i.id}`);
      }
    }
  }
  assert.equal(kinds.size,7); assert.ok(names.size>50); assert.ok(shipNames.size>100); assert.ok(locations.size>500);
});

test('delivered artifacts apply bounded bonuses and persist with the ship profile',()=>{
  const s=chapter(3); const v=C.generateVoyage(s,'relic'); let relic=v.legs.find(m=>m.kind==='relic');
  v.legs=[relic]; s.voyage=v;s.legIndex=0;s.chapterSpawned=-1;C.spawnChapter(s); const before=s.gold;
  finishLeg(s); assert.equal(s.artifacts.length,1); const stat=C.RELICS[relic.relic.type].stat; assert.ok(s.player.relics[stat]>0); assert.ok(s.gold>before);
  const loaded=C.restore(C.serialize(s)); assert.equal(loaded.artifacts.length,1); assert.equal(loaded.player.relics[stat],s.player.relics[stat]);
});

test('defeat recovers to a safe harbor without destroying progression or creating negative balances', () => {
  const s = fresh(); s.player.hull = -1; s.player.upgrades.sails = 2; s.cargo = 100; s.gold = 20; C.step(s);assert.equal(s.phase,'sinking');advance(s,C.SINK_DURATION+.1);
  assert.equal(s.stats.defeats, 1); assert.ok(s.player.hull > 0); assert.equal(s.player.upgrades.sails, 2); assert.equal(s.gold, 16); assert.equal(s.cargo, 40); assert.ok(s.player.invulnerable > 0);
});
test('captain-profile saves preserve equipment, level and currency while generating a fresh world', () => {
  const s = chapter(3); s.player.upgrades.hull = 2; s.player.hull = C.maxHull(s.player); s.gold = 900;
  const restored = C.restore(C.serialize(s)); assert.ok(restored); assert.equal(restored.chapter, 3); assert.equal(restored.gold, 900); assert.equal(restored.player.upgrades.hull, 2); assert.equal(restored.complete,true); assert.equal(restored.contracts.length,3); assert.equal(restored.shots.length,0); assert.ok(!Object.hasOwn(JSON.parse(C.serialize(s)),'ships')); assert.ok(C.serialize(s).length<7000);
  for (const bad of ['null', '{}', '{', '[]', 'x'.repeat(200001)]) assert.equal(C.restore(bad), null);
  const changed = JSON.parse(C.serialize(s)); changed.ship.hull = null; assert.equal(C.restore(JSON.stringify(changed)), null);
});
test('paused and docked states freeze combat and sailing', () => {
  const s = fresh(); atPort(s, 'calicut'); const before = C.serialize(s); advance(s, 2, { fire: true, helm: 1 }); assert.equal(C.serialize(s), before);
});

test('every generated escort port pair has an island-safe route and can finish under sail',()=>{
  const ports=C.ISLANDS.filter(i=>i.port);
  for(const start of ports) for(const end of ports) {
    if(start===end) continue;
    const s=chapter(2), m=C.mission(s); m.startPort=start.id;m.port=end.id;
    s.chapterSpawned=-1;s.ships=[];C.spawnChapter(s);
    const e=s.ships.find(v=>v.role==='escort');s.ships=[e];
    for(let i=0;i<60*480&&!e.arrived;i++){s.player.x=e.x+45;s.player.z=e.z+35;C.step(s,{sail:0});}
    assert.ok(e.arrived,`${start.id} → ${end.id}`);
  }
});

test('helm and explicit port/starboard fire use the same physical orientation',()=>{
  const s=chapter(1);s.player.x=0;s.player.z=0;s.player.angle=0;
  C.step(s,{helm:1});assert.ok(s.player.angle<0,'right helm turns toward starboard');
  s.player.angle=0;s.player.reload=1;assert.equal(C.fire(s,s.player,1),true);assert.ok(s.shots.every(p=>p.vx<0),'starboard points to negative X when sailing south');
  s.shots=[];s.player.reload=1;C.fire(s,s.player,-1);assert.ok(s.shots.every(p=>p.vx>0));
});

test('profile size is independent of world entities and preserves livery instead of encounter state',()=>{
  const s=fresh();s.player.livery='indigo';const before=C.serialize(s);
  s.ships=Array(500).fill(s.ships[0]);s.shots=Array(500).fill({x:100,z:100});s.loot=Array(500).fill(s.loot[0]);
  assert.equal(C.serialize(s),before);const loaded=C.restore(before);assert.equal(loaded.player.livery,'indigo');assert.ok(loaded.ships.length<10);assert.equal(loaded.complete,true);assert.equal(loaded.contracts.length,3);
});

test('all seven seas generate local ports, patrons, fleets and valid offshore objectives',()=>{
  assert.equal(Object.keys(C.WORLDS).length,7);
  for(const id of Object.keys(C.WORLDS))for(let seed=0;seed<50;seed++){
    const s=C.create(seed,id),w=C.world(s),b=C.bounds(s);
    assert.ok(w.size[0]>2800&&w.size[1]>2100);assert.equal(s.checkpoint,w.home);
    for(const theme of Object.keys(C.THEMES)){
      const v=C.generateVoyage(s,theme);assert.equal(v.worldId,id);assert.ok(w.patrons.includes(v.patron));assert.ok(w.enemies.includes(v.enemy));
      for(const m of v.legs){
        assert.ok(w.islands.some(i=>i.id===m.port&&i.port));assert.ok(w.islands.some(i=>i.id===m.startPort&&i.port));
        assert.ok(Math.abs(m.location.x)<=b.x&&Math.abs(m.location.z)<=b.z);
        for(const i of w.islands)assert.ok(C.landDistance(m.location,i)>0,`${id}: ${i.name}`);
      }
    }
  }
});

test('rare Turning Waters unlock through delivered voyages and reject premature or distant travel',()=>{
  const s=fresh();assert.equal(s.gate,null);assert.equal(C.travel(s,'redsea'),false);
  for(let n=0;n<3;n++){
    while(!s.complete){if(s.phase==='port')C.leavePort(s);finishLeg(s);}
    assert.equal(s.turning.fragments,n+1);assert.equal(!!s.gate,n===2);
    if(n<2)assert.equal(C.acceptContract(s,s.contracts[0].id),true);
  }
  assert.ok(s.events.some(e=>e.type==='gate'));assert.deepEqual(s.gate.destinations,['redsea']);
  assert.equal(C.travel(s,'redsea'),false,'cannot cross from a port menu');C.leavePort(s);
  assert.equal(C.travel(s,'redsea'),false,'must sail to the vortex');
  s.player.x=s.gate.x;s.player.z=s.gate.z;s.complete=false;assert.equal(C.travel(s,'redsea'),false,'finish the active commission');s.complete=true;
  assert.equal(C.travel(s,'aceh'),false,'only the charted passage is available');
  s.player.upgrades.hull=2;s.player.hull=135;s.player.sails=77;s.player.crew=31;s.cargo=240;
  s.player.coastCooldown=999;const gold=s.gold,rep={...s.standing};assert.equal(C.travel(s,'redsea'),true);
  assert.equal(s.worldId,'redsea');assert.equal(s.player.coastCooldown,0);assert.equal(C.world(s).year,1510);assert.equal(s.gold,gold);assert.equal(s.cargo,240);
  assert.equal(s.player.hull,135);assert.equal(s.player.sails,77);assert.equal(s.player.crew,31);assert.equal(s.player.upgrades.hull,2);assert.deepEqual(s.standing,rep);
  assert.equal(s.turning.fragments,0);assert.equal(s.turning.nextAt,6);assert.equal(s.gate,null);assert.equal(s.contracts.length,3);assert.equal(s.checkpoint,'jeddah');
  assert.ok(s.visitedWorlds.includes('india')&&s.visitedWorlds.includes('redsea'));
});

test('current world, standing, discovered seas and whirlpool progress survive compact profile saves',()=>{
  const s=C.create(51,'aceh');s.voyagesCompleted=8;s.turning={fragments:3,nextAt:8,passages:2};s.visitedWorlds=['india','redsea','aceh'];s.standing.aceh=120;s.checkpoint='johor';s.player.livery='indigo';C.updateGate(s);
  const loaded=C.restore(C.serialize(s));assert.equal(loaded.worldId,'aceh');assert.equal(C.world(loaded).year,1635);assert.equal(loaded.checkpoint,'johor');assert.equal(loaded.standing.aceh,120);assert.ok(loaded.gate);assert.equal(loaded.turning.passages,2);assert.equal(loaded.player.livery,'indigo');
  assert.deepEqual(new Set(loaded.visitedWorlds),new Set(s.visitedWorlds));assert.ok(C.serialize(s).length<8000);
  const bad=JSON.parse(C.serialize(s));bad.worldId='unknown-ocean';assert.equal(C.restore(JSON.stringify(bad)),null);
  const old=JSON.parse(C.serialize(s));old.version=3;delete old.worldId;assert.equal(C.restore(JSON.stringify(old)).worldId,'india');
});

test('patron commissions change service and increase only the issuing court’s standing',()=>{
  const s=fresh();s.complete=true;atPort(s,'calicut');C.generateOffers(s,'gujarat');assert.ok(s.contracts.every(v=>v.patron==='gujarat'));
  assert.ok(C.acceptContract(s,s.contracts[0].id));assert.equal(s.affiliation,'gujarat');assert.equal(s.player.patron,'gujarat');
  C.leavePort(s);finishLeg(s);assert.equal(s.standing.gujarat,20);assert.equal(s.standing.marakkar||0,0);
  for(const v of s.ships.filter(v=>!v.friendly))assert.ok(v.faction);
});

test('whirlpool passages can eventually visit every sea without resetting the captain',()=>{
  const s=fresh();s.complete=true;s.gold=1234;s.player.upgrades.sails=2;
  for(let n=0;n<6;n++){
    s.voyagesCompleted=s.turning.nextAt;s.turning.fragments=3;C.updateGate(s);s.player.x=s.gate.x;s.player.z=s.gate.z;
    const destination=s.gate.destinations.find(id=>!s.visitedWorlds.includes(id));assert.ok(destination);assert.ok(C.travel(s,destination));assert.equal(s.gold,1234);assert.equal(s.player.upgrades.sails,2);
    const restored=C.restore(C.serialize(s));assert.equal(restored.worldId,destination);
  }
  assert.equal(new Set(s.visitedWorlds).size,7);
});

test('all 100 regional harbor pairs remain reachable by an escorted ship',()=>{
  let count=0;
  for(const id of Object.keys(C.WORLDS)){
    const ports=C.WORLDS[id].islands.filter(i=>i.port);
    for(const start of ports)for(const end of ports){
      if(start===end)continue;
      const s=C.create(10,id);let voyage;
      do{voyage=C.generateVoyage(s,'passage');}while(!voyage.legs.some(m=>m.kind==='escort'));
      const m=voyage.legs.find(m=>m.kind==='escort');m.startPort=start.id;m.port=end.id;voyage.legs=[m];s.voyage=voyage;s.legIndex=0;s.chapterSpawned=-1;s.ships=[];s.loot=[];s.weather=[];s.atmosphere.disabled=true;C.spawnChapter(s);
      const ship=s.ships.find(v=>v.role==='escort');s.ships=[ship];
      for(let i=0;i<60*600&&!ship.arrived;i++){s.player.x=ship.x+45;s.player.z=ship.z+35;C.step(s,{sail:0});}
      assert.ok(ship.arrived,`${id}: ${start.name} → ${end.name}`);count++;
    }
  }
  assert.equal(count,100);
});

test('regional silhouettes govern offshore spawns, harbor approaches and every planned route segment',()=>{
  const med=C.create(92,'easternmed'),crete=C.islands(med).find(i=>i.id==='crete');
  const tip={x:crete.x-600,z:crete.z};assert.ok(C.dist(tip,crete)>crete.r);assert.ok(C.landDistance(tip,crete)<0,'long island tips remain solid beyond the former circle');
  assert.equal(C.clearSeaLeg(med,{x:tip.x,z:tip.z-300},{x:tip.x,z:tip.z+300}),false);
  for(const id of Object.keys(C.WORLDS)){
    const s=C.create(92,id),land=C.islands(s),ports=land.filter(i=>i.port);
    for(const p of [s.player,...s.ships,...s.loot])for(const i of land)assert.ok(C.landDistance(p,i)>15,`${id} spawn on ${i.name}`);
    for(const start of ports)for(const end of ports){
      if(start===end)continue;
      let previous=C.harborPoint(start,90);const path=C.navigationRoute(s,previous,end.port,'galleon');
      for(const next of path){assert.ok(C.clearSeaLeg(s,previous,next),`${id}: unsafe course ${start.id} → ${end.id}`);previous=next;}
      assert.ok(C.dist(previous,end.port)<10);
    }
  }
  const s=fresh(),home=C.portById(s,'calicut');assert.ok(C.harborPoint(home,55).x<home.port.x,'west-facing harbor starts to seaward');
});

test('wind fronts vary substantially and reproduce with the same seed without changing the voyage generator seed',()=>{
  const a=fresh(),b=fresh(),seed=a.seed,angles=[],speeds=[],kinds=new Set();let stormBirths=0;
  for(let j=0;j<600;j++){
    for(const s of [a,b]){s.time+=1;C.updateWeather(s,1);}
    angles.push(a.wind.angle);speeds.push(a.wind.strength);kinds.add(a.atmosphere.kind);if(a.events.some(e=>e.text?.includes('building offshore')))stormBirths++;
    a.events=[];b.events=[];assert.ok(a.weather.length<=3);
  }
  assert.equal(a.seed,seed);assert.deepEqual(a.wind,b.wind);assert.deepEqual(a.weather,b.weather);
  assert.ok(Math.max(...angles)-Math.min(...angles)>.8);assert.ok(Math.max(...speeds)-Math.min(...speeds)>10);assert.ok(kinds.size>=3);assert.ok(stormBirths>=2);
});

test('storm cells drift, strengthen gradually, dissipate and only affect local water',()=>{
  const s=fresh();s.weather=[];const storm=C.spawnStorm(s),start={x:storm.x,z:storm.z};
  assert.equal(C.stormPower(storm),0);
  s.time+=20;C.updateWeather(s,20);assert.ok(C.dist(start,storm)>50);assert.ok(C.stormPower(storm)>.5);
  const local=C.windAt(s,storm),far=C.windAt(s,{x:storm.x+1000,z:storm.z+1000});assert.ok(local.hazard>.5);assert.equal(far.hazard,0);assert.ok(local.strength>far.strength);
  s.atmosphere.nextStorm=Infinity;storm.age=storm.life-1;s.time+=2;C.updateWeather(s,2);assert.ok(!s.weather.includes(storm));
});

test('hull collisions damage both participants, separate boats, respect speed and cannot farm damage every frame',()=>{
  function crash(speed){
    const s=chapter(1),other=s.ships[0];s.hazards=[];s.weather=[];s.atmosphere.disabled=true;s.player.invulnerable=0;
    Object.assign(s.player,{x:0,z:0,angle:0,speed});Object.assign(other,{x:0,z:19,angle:Math.PI,speed,invulnerable:0});s.time=10;
    const before=[s.player.hull,other.hull];C.collideShips(s);const losses=[before[0]-s.player.hull,before[1]-other.hull];assert.ok(C.dist(s.player,other)>19);const after=[s.player.hull,other.hull];C.collideShips(s);assert.deepEqual([s.player.hull,other.hull],after);return losses;
  }
  const gentle=crash(3),hard=crash(25);assert.ok(gentle.every(v=>v>0));assert.ok(hard.every((v,j)=>v>gentle[j]*3));
  const a={class:'frigate',x:0,z:0,angle:0},b={class:'frigate',x:18,z:0,angle:0};assert.equal(C.hullContact(a,b),null,'long hulls can pass broadside without a false circular collision');
});

test('coasts and charted reefs damage player and AI hulls; currents move both ships',()=>{
  function grounding(player,reef){
    const s=chapter(1);s.weather=[];s.atmosphere.disabled=true;const v=player?s.player:s.ships[0];s.player.invulnerable=0;v.invulnerable=0;
    if(reef){s.hazards=[{kind:'reef',x:0,z:0,r:35}];Object.assign(v,{x:-44,z:0,angle:Math.PI/2,speed:30});}
    else{const i=C.portById(s,'calicut');s.hazards=[];Object.assign(v,C.harborPoint(i,-51));v.angle=Math.PI/2;v.speed=30;}
    if(player)s.ships=[];else{s.ships=[v];s.player.x=-1000;s.player.z=0;v.home={x:v.x+100,z:v.z};}
    const before=v.hull;C.step(s,{},.05);assert.ok(v.hull<before,`${player?'player':'AI'} ${reef?'reef':'coast'} impact`);
  }
  for(const player of [true,false])for(const reef of [true,false])grounding(player,reef);
  const plain=fresh(),flow=fresh();for(const s of [plain,flow]){s.ships=[];s.weather=[];s.atmosphere.disabled=true;s.hazards=[];Object.assign(s.player,{x:0,z:0,angle:0});}
  flow.hazards=[{kind:'current',x:0,z:0,r:200,angle:Math.PI/2,strength:5,seed:0}];advance(plain,2);advance(flow,2);assert.ok(flow.player.x-plain.player.x>5);
});

test('new environmental encounters stay out of compact saves and regenerate safely on resume',()=>{
  const s=fresh(),before=C.serialize(s);assert.ok(s.hazards.some(h=>h.kind==='reef'));assert.ok(s.hazards.some(h=>h.kind==='current'));
  s.weather=Array(50).fill(s.weather[0]);s.contacts={test:Infinity};s.hazards=Array(50).fill(s.hazards[0]);assert.equal(C.serialize(s),before);
  const loaded=C.restore(before);assert.ok(loaded.hazards.length<=6);assert.ok(loaded.weather.length<=3);assert.equal(loaded.worldId,s.worldId);
  const snapshot=JSON.stringify({wind:loaded.wind,weather:loaded.weather});loaded.phase='port';advance(loaded,3);assert.equal(JSON.stringify({wind:loaded.wind,weather:loaded.weather}),snapshot);
});

test('player loss breaks and sinks at sea before one rescue returns the captain to harbor',()=>{
  const s=fresh();s.ships=[];s.weather=[];s.atmosphere.disabled=true;s.player.upgrades.sails=2;s.gold=20;s.cargo=100;const at={x:s.player.x,z:s.player.z};s.player.hull=0;
  C.step(s);assert.equal(s.phase,'sinking');assert.equal(s.wrecks.length,1);assert.equal(s.wrecks[0].id,'player');assert.equal(s.events.filter(e=>e.type==='sink').length,1);assert.equal(s.stats.defeats,1);assert.equal(s.gold,16);assert.equal(s.cargo,40);
  advance(s,2,{helm:1,row:true,fire:true,dock:true});assert.equal(s.phase,'sinking');assert.deepEqual({x:s.player.x,z:s.player.z},at);assert.ok(s.wrecks[0].age>=1.9);assert.equal(C.fire(s,s.player,1),false);assert.equal(C.board(s),false);assert.equal(C.dock(s),null);assert.equal(C.travel(s,'redsea'),false);
  advance(s,C.SINK_DURATION);assert.equal(s.phase,'port');assert.equal(s.port,s.checkpoint);assert.equal(s.stats.defeats,1);assert.equal(s.gold,16);assert.equal(s.player.hull,C.maxHull(s.player));assert.equal(s.player.upgrades.sails,2);assert.equal(s.wrecks.length,0);
});

test('destroyed hostile and friendly boats leave animated wrecks; captured prizes do not',()=>{
  const s=chapter(1),enemy=s.ships[0];C.defeatShip(s,enemy);assert.equal(s.wrecks.length,1);assert.equal(s.wrecks[0].class,enemy.class);assert.ok(enemy.removed);advance(s,2);assert.ok(s.wrecks[0].age>1);advance(s,5);assert.equal(s.wrecks.length,0);
  const captured=chapter(4);C.defeatShip(captured,captured.ships.find(v=>v.role==='convoy'),true);assert.equal(captured.wrecks.length,0);assert.ok(!captured.events.some(e=>e.type==='sink'));
  const escort=chapter(2);C.defeatShip(escort,escort.ships.find(v=>v.role==='escort'));assert.equal(escort.wrecks.length,1);assert.equal(escort.escortLost,true);
});

test('oars are independent of canvas; furled sails give no hidden wind propulsion',()=>{
  function sail(setting,row){const s=fresh();s.ships=[];s.weather=[];s.hazards=[];s.atmosphere.disabled=true;s.wind={angle:0,strength:18};Object.assign(s.player,{x:0,z:0,angle:Math.PI,sail:setting,speed:0});advance(s,8,{row});return s;}
  const full=sail(1,false),furled=sail(-1,false),rowFull=sail(1,true),rowFurled=sail(-1,true);
  assert.equal(C.polar(Math.PI,0,'sloop'),0);assert.ok(full.player.speed<.001);assert.ok(furled.player.speed<.001);assert.ok(rowFurled.player.speed>rowFull.player.speed*2);assert.ok(rowFurled.player.z<-20);assert.ok(rowFurled.player.oarStamina<100);
  const coasting=sail(-1,false);coasting.player.speed=20;advance(coasting,8);assert.ok(coasting.player.speed<1,'canvas down allows momentum to decay');
});

test('rowing capability and crew endurance distinguish galleys, light craft and sailing ships',()=>{
  const s=fresh();assert.equal(C.canRow(s),true);s.player.class='brig';assert.equal(C.canRow(s),false);s.worldId='easternmed';assert.equal(C.canRow(s),true);s.player.class='frigate';assert.equal(C.canRow(s),false);
  s.player.class='sloop';s.player.crew=C.maxCrew(s.player);s.ships=[];s.weather=[];s.hazards=[];s.atmosphere.disabled=true;Object.assign(s.player,{x:0,z:0,sail:-1,angle:Math.PI});advance(s,27,{row:true});assert.ok(s.player.oarsTired);assert.equal(s.player.oarActive,false);advance(s,12,{row:false});assert.ok(s.player.oarStamina>25);assert.equal(s.player.oarsTired,false);
});

test('saving during loss preserves the paid loss and recovery ship without storing the cinematic',()=>{
  const s=fresh();s.gold=500;s.cargo=100;s.player.hull=0;C.step(s);const text=C.serialize(s),loaded=C.restore(text);
  assert.equal(loaded.gold,400);assert.equal(loaded.cargo,40);assert.equal(loaded.stats.defeats,1);assert.equal(loaded.player.hull,C.maxHull(loaded.player));assert.ok(!JSON.parse(text).wrecks);assert.notEqual(loaded.phase,'sinking');
});
