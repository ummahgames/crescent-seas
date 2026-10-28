const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../src/engine.js');
const C = globalThis.Corsair;
const fresh = () => C.create(1668);
const advance = (s, seconds, input = {}) => { for (let i = 0; i < seconds * 60; i++) C.step(s, input); };
const atPort = (s, id) => { const p = C.ISLANDS.find(i => i.id === id).port; s.player.x = p.x + 25; s.player.z = p.z; s.player.speed = 0; return C.dock(s); };
function chapter(index) {
  const kind = ['salvage','raider','escort','chart','convoy','flagship'][index];
  const theme = ({salvage:'relic',raider:'bounty',escort:'passage',chart:'relic',convoy:'prize',flagship:'bounty'})[kind];
  const s = fresh();
  let v; do { v = C.generateVoyage(s,theme); } while (!v.legs.some(m=>m.kind===kind));
  v.legs = [v.legs.find(m=>m.kind===kind)]; s.voyage=v; s.legIndex=0; s.chapter=index; s.chapterSpawned=-1; s.ships=[]; s.loot=[]; C.spawnChapter(s); return s;
}

test('onboarding voyage has linked objectives, three salvage targets, and navigable port approaches', () => {
  const s = fresh(); assert.equal(s.voyage.legs.length, 2); assert.equal(C.ISLANDS.length, 8);
  assert.equal(s.loot.filter(l => l.mission === C.mission(s).objective).length, 3);
  for (const l of s.loot) for (const i of C.ISLANDS) assert.ok(C.dist(l, i) > i.r * .94, `cargo inside ${i.name}`);
  for (const i of C.ISLANDS.filter(i => i.port)) assert.ok(C.dist(i, i.port) > i.r + C.CLASSES.frigate.beam);
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
  atPort(s, 'maren'); assert.equal(s.chapter, 0); assert.equal(s.gold, 455); C.leavePort(s);
  atPort(s, 'haven'); assert.equal(s.chapter, 1); assert.equal(s.gold, 675);
  C.leavePort(s); atPort(s, 'haven'); assert.equal(s.gold, 675, 'reward cannot be claimed twice');
});
test('port purchases deduct coin, enforce caps and locks, transfer upgrades and replenish new ships', () => {
  const s = fresh(); s.gold = 10000; atPort(s, 'haven');
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
    const s = fresh(); s.ships = []; s.player.x = 80; s.player.z = -430; s.player.upgrades.weather = glass; s.player.sails = 100;
    advance(s, 1, { sail: reef ? 0 : 1 }); return s.player.sails;
  }
  const full = storm(false, 0), reef = storm(true, 0), glass = storm(false, 1); assert.ok(full < reef); assert.ok(full < glass);
});
test('escort waits when separated, can arrive, and a lost escort can be relaunched', () => {
  const s = chapter(2), v = s.ships.find(v => v.role === 'escort'); s.player.x = 800; s.player.z = 700;
  const old = { x: v.x, z: v.z }; advance(s, 2); assert.equal(v.x, old.x); assert.equal(v.z, old.z);
  s.player.x = v.goal.x + 30; s.player.z = v.goal.z; v.x = v.goal.x; v.z = v.goal.z; C.step(s); assert.equal(s.progress, 1);
  const b = chapter(2), lost = b.ships.find(v => v.role === 'escort'); C.defeatShip(b, lost); assert.equal(b.escortLost, true); atPort(b, 'haven'); assert.equal(b.escortLost, false); assert.ok(b.ships.some(v => v.role === 'escort' && !v.removed));
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
        for(const i of C.ISLANDS) assert.ok(C.dist(m.location,i)>i.r*.94,`bad spawn for ${m.kind}: ${i.id}`);
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
  const s = fresh(); s.player.hull = -1; s.player.upgrades.sails = 2; s.cargo = 100; s.gold = 20; C.step(s);
  assert.equal(s.stats.defeats, 1); assert.ok(s.player.hull > 0); assert.equal(s.player.upgrades.sails, 2); assert.equal(s.gold, 16); assert.equal(s.cargo, 40); assert.ok(s.player.invulnerable > 0);
});
test('captain-profile saves preserve equipment, level and currency while generating a fresh world', () => {
  const s = chapter(3); s.player.upgrades.hull = 2; s.player.hull = C.maxHull(s.player); s.gold = 900;
  const restored = C.restore(C.serialize(s)); assert.ok(restored); assert.equal(restored.chapter, 3); assert.equal(restored.gold, 900); assert.equal(restored.player.upgrades.hull, 2); assert.equal(restored.complete,true); assert.equal(restored.contracts.length,3); assert.equal(restored.shots.length,0); assert.ok(!Object.hasOwn(JSON.parse(C.serialize(s)),'ships')); assert.ok(C.serialize(s).length<7000);
  for (const bad of ['null', '{}', '{', '[]', 'x'.repeat(200001)]) assert.equal(C.restore(bad), null);
  const changed = JSON.parse(C.serialize(s)); changed.ship.hull = null; assert.equal(C.restore(JSON.stringify(changed)), null);
});
test('paused and docked states freeze combat and sailing', () => {
  const s = fresh(); atPort(s, 'haven'); const before = C.serialize(s); advance(s, 2, { fire: true, helm: 1 }); assert.equal(C.serialize(s), before);
});

test('every generated escort port pair has an island-safe route and can finish under sail',()=>{
  const ports=C.ISLANDS.filter(i=>i.port);
  for(const start of ports) for(const end of ports) {
    if(start===end) continue;
    const s=chapter(2), m=C.mission(s); m.startPort=start.id;m.port=end.id;
    s.chapterSpawned=-1;s.ships=[];C.spawnChapter(s);
    const e=s.ships.find(v=>v.role==='escort');s.ships=[e];
    for(let i=0;i<60*240&&!e.arrived;i++){s.player.x=e.x+45;s.player.z=e.z+35;C.step(s,{sail:0});}
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
