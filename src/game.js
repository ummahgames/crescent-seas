(function () {
  'use strict';
  const C = window.Corsair, Art = window.CorsairArt, $ = id => document.getElementById(id), SAVE = 'corsair-captain-v3';
  let autoRoute = [];
  let renderer;
  try { renderer = new window.CorsairRenderer($('sea')); } catch (e) { console.error(e); $('webgl-error').hidden = false; $('welcome').hidden = true; return; }
  let state = C.create(), started = false, currentModal = null, currentTab = 'services', saveWarning = false, autoSail = false, chaseCamera = false, lastUI = 0, lastSave = 0, target = null, soundEnabled = false;
  const keys = new Set(), presses = {}, touch = { left: false, right: false }, notices = [];
  let audio = null;
  function audioStart() {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC(), master = ctx.createGain(); master.gain.value = .35; master.connect(ctx.destination);
      const length = ctx.sampleRate * 3, buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
      let last = 0; for (let i = 0; i < length; i++) { last = (last + (Math.random() * 2 - 1) * .02) / 1.02; data[i] = last * 5; }
      const surf = ctx.createBufferSource(); surf.buffer = buffer; surf.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 550;
      const ambient = ctx.createGain(); ambient.gain.value = .11; surf.connect(filter); filter.connect(ambient); ambient.connect(master); surf.start();
      audio = { ctx, master, ambient, buffer };
    }
    audio.ctx.resume().catch(() => {}); audio.master.gain.value = soundEnabled ? .35 : 0;
  }
  function effect(type) {
    if (!audio || !soundEnabled) return;
    const { ctx, master, buffer } = audio, now = ctx.currentTime;
    const g = ctx.createGain(); g.connect(master);
    if (['fire', 'hit', 'sink', 'splash'].includes(type)) {
      const source = ctx.createBufferSource(); source.buffer = buffer;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = type === 'fire' ? 700 : type === 'splash' ? 1600 : 350;
      g.gain.setValueAtTime(type === 'fire' ? 3 : .9, now); g.gain.exponentialRampToValueAtTime(.001, now + (type === 'sink' ? 1.2 : .45));
      source.connect(f); f.connect(g); source.start(now); source.stop(now + 1.3);
      if (type !== 'splash') { const o = ctx.createOscillator(); o.frequency.setValueAtTime(type === 'fire' ? 110 : 75, now); o.frequency.exponentialRampToValueAtTime(28, now + .3); o.connect(g); o.start(); o.stop(now + .35); }
    } else {
      for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), eg = ctx.createGain(); o.type = 'sine'; o.frequency.value = [440, 554.37, 659.25][i]; eg.gain.setValueAtTime(0, now + i * .075); eg.gain.linearRampToValueAtTime(.12, now + i * .075 + .02); eg.gain.exponentialRampToValueAtTime(.001, now + i * .075 + .35); o.connect(eg); eg.connect(master); o.start(now + i * .075); o.stop(now + .6); }
    }
  }
  function notify(text, tone = '', duration = 5) {
    if (!started) return;
    const existing = notices.find(n => n.text === text); if (existing) { existing.until = performance.now() + duration * 1000; return; }
    const el = document.createElement('div'); el.className = `message ${tone}`; el.textContent = text; $('messages').append(el);
    notices.push({ text, el, until: performance.now() + duration * 1000 });
    while (notices.length > 3) notices.shift().el.remove();
  }
  function save() {
    if (!started) return;
    try { localStorage.setItem(SAVE, C.serialize(state)); } catch { if (!saveWarning) { saveWarning = true; notify('Browser storage is unavailable. Your captain’s profile will last for this session.', 'warning', 8); } }
  }
  let existingSave = null;
  try { existingSave = C.restore(localStorage.getItem(SAVE) || localStorage.getItem('corsair-voyage-v1')); } catch {}
  $('continue').hidden = !existingSave;
  function startGame(resume = false) {
    state = resume && existingSave ? existingSave : C.create(crypto.getRandomValues(new Uint32Array(1))[0]); started = true; $('welcome').hidden = true; $('game-ui').hidden = false;
    renderer.follow = { x: state.player.x, z: state.player.z }; renderer.distance = innerWidth < 600 ? 290 : 245; renderer.yaw = .2; renderer.wakes = []; renderer.particles = [];
    soundEnabled = true; audioStart(); $('sound').title = 'Mute sound'; $('sound').setAttribute('aria-label', 'Mute sound');
    autoRoute=[]; autoSail=false; closeModal(); save(); updateUI(); $('sea').focus({ preventScroll: true });
    if (resume) { C.dock(state); portView('contracts'); state.events = []; }
    notify(resume ? 'Captain restored. Fresh waters and new commissions await.' : 'Welcome aboard. Three golden caches lie east of Haven. Your chart shows the way.', 'good', 9);
  }
  function clearInput() { keys.clear(); touch.left = false; touch.right = false; for (const k of Object.keys(presses)) delete presses[k]; }
  function openModal(kind, html, tab = null) {
    clearInput(); currentModal = kind;
    if (tab) currentTab = tab;
    $('modal-content').innerHTML = `<div class="modal-inner ${kind === 'victory' ? 'victory' : ''}">${html}</div>`;
    if (!$('modal').open) $('modal').showModal();
    bindModal();
  }
  function closeModal() {
    if ($('modal').open) $('modal').close();
    currentModal = null; clearInput();
    if (state.phase === 'port') C.leavePort(state);
    if (started) { save(); $('sea').focus({ preventScroll: true }); }
  }
  function top(eyebrow, title, lead = '') { return `<div class="modal-top"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${lead ? `<p>${lead}</p>` : ''}</div><button class="square" data-close aria-label="Close dialog">×</button></div>`; }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function tabs(active) { return `<nav class="modal-tabs" aria-label="Port services">${[['services','HARBOR'],['contracts','VOYAGES'],['upgrades','SHIPWRIGHT'],['ships','VESSELS'],['cabinet','CABINET']].map(([id,label])=>`<button data-tab="${id}" class="${active===id?'active':''}">${label}${id==='contracts'&&state.complete?' <span class="new-dot">●</span>':''}</button>`).join('')}</nav>`; }
  function upgradeNumbers(id) {
    const p = state.player, n = p.upgrades[id], spec = C.CLASSES[p.class];
    const values = {
      sails: [Math.round(100+n*12), Math.round(100+(n+1)*12), '%', 'SAILING SPEED'],
      copper: [100+n*14, 100+(n+1)*14, '%', 'TURN RESPONSE'],
      hull: [Math.round(C.maxHull(p)), Math.round(C.maxHull(p)+spec.hull*.25), '', 'HULL STRENGTH'],
      powder: [Math.round(C.AMMO.round.range*(1+n*.12)), Math.round(C.AMMO.round.range*(1+(n+1)*.12)), ' yd', 'CANNON REACH'],
      bronze: [100+n*12, 100+(n+1)*12, '%', 'SHOT DAMAGE'],
      crew: [(6.5/(1+n*.18)).toFixed(1), (6.5/(1+(n+1)*.18)).toFixed(1), ' s', 'RELOAD TIME'],
      weather: [n?30:100, 30, '%', 'STORM EXPOSURE']
    };
    return values[id];
  }
  function contractCards() {
    if (!state.complete) return `<div class="active-contract"><div class="contract-picture">${Art.task(C.mission(state).kind)}</div><div><div class="eyebrow">YOUR ACTIVE VOYAGE · ${state.legIndex+1} / ${state.voyage.legs.length}</div><h3>${esc(state.voyage.name)}</h3><p>${esc(C.mission(state).text)}</p><div class="route-tokens">${state.voyage.legs.map((m,i)=>`<span class="${i===state.legIndex?'current':''}">${i<state.legIndex?'✓':i+1} ${m.kind==='convoy'?'Capture':m.kind==='relic'?'Artifact':m.kind==='flagship'?'Warship':m.kind[0].toUpperCase()+m.kind.slice(1)}</span>`).join('<b>→</b>')}</div><button class="secondary" data-journal>Open voyage journal ↗</button></div></div>`;
    return `<div class="offers-intro"><p>Three opportunities. One horizon. Choose a voyage; the others will wait for another captain.</p><span>${state.voyagesCompleted} VOYAGES COMPLETED</span></div><div class="contract-grid">${state.contracts.map(v=>`<article class="contract-card"><div class="contract-picture">${Art.task(C.THEMES[v.theme].icon)}</div><div class="eyebrow">${C.THEMES[v.theme].name.toUpperCase()} · ${v.legs.length} LEGS</div><h3>${esc(v.name)}</h3><div class="route-tokens">${v.legs.map(m=>`<span>${m.kind==='convoy'?'Capture':m.kind==='relic'?'Artifact':m.kind==='flagship'?'Warship':m.kind[0].toUpperCase()+m.kind.slice(1)}</span>`).join('<b>→</b>')}</div><p class="contract-route">${v.route.join(' → ')}</p><div class="contract-pay"><strong>${v.reward.toLocaleString()} ◈</strong><span>+ LOOT${v.legs.some(m=>m.kind==='relic')?' + ARTIFACT':''}</span></div><button class="primary" data-accept="${v.id}">Take the commission <span>→</span></button></article>`).join('')}</div><p class="save-note">Voyages are generated from objective rules, routes, ship traits, and your captain’s level. Completing one opens a fresh choice of three.</p>`;
  }
  function cabinetCards() {
    return `<div class="relic-bonuses">${[['speed','SPEED'],['range','RANGE'],['boarding','BOARDING'],['storm','STORM RESIST']].map(([id,label])=>`<div><strong>+${Math.round((state.player.relics?.[id]||0)*100)}%</strong><small>${label}</small></div>`).join('')}</div>${state.artifacts.length?`<div class="shop-grid artifact-grid">${state.artifacts.map(a=>`<article class="artifact-card ${a.rarity}">${Art.relic(a.type)}<small>${a.rarity.toUpperCase()} CURIOSITY</small><h3>${esc(a.name)}</h3><span>${esc(a.label)}</span></article>`).join('')}</div>`:`<div class="cabinet-empty">${Art.relic('sextant')}<h3>A cabinet waiting for a story.</h3><p>Choose an artifact voyage to discover rare navigation instruments, pennants, and storm lanterns. Their bonuses stay with your ship.</p><button class="secondary" data-tab="contracts">Browse voyages ↗</button></div>`}`;
  }
  function portView(tab = currentTab) {
    const island = C.ISLANDS.find(i => i.id === state.port) || C.ISLANDS[0], p = state.player;
    let body = '';
    const reward = state.lastReward ? `<p class="reward-ribbon">✓ Commission delivered <strong>+${state.lastReward.toLocaleString()} ◈</strong></p>` : '';
    if (tab === 'services') {
      const cost = C.repairCost(state), m = C.mission(state);
      body = `<div class="harbor-hero"><div>${Art.ship(p.class)}</div><section><div class="eyebrow">${C.CLASSES[p.class].guns}-GUN ${C.CLASSES[p.class].name.toUpperCase()}</div><h3>${p.name}</h3><div class="refit-meters">${[['HULL',p.hull/C.maxHull(p)],['SAILS',p.sails/100],['CREW',p.crew/C.maxCrew(p)]].map(([n,v])=>`<label>${n}<div><i style="width:${v*100}%"></i></div><span>${Math.ceil(v*100)}%</span></label>`).join('')}</div><div class="livery-options" role="group" aria-label="Ship colors">${[['teal','Teal & ivory'],['indigo','Indigo & gold'],['ochre','Ochre & brass']].map(([id,label])=>`<button data-livery="${id}" class="${p.livery===id?'chosen':''}" aria-label="${label}" title="${label}"><i class="swatch-${id}"></i></button>`).join('')}</div><button class="secondary" data-repair ${cost===0||state.gold<cost?'disabled':''}>${cost?`Refit & replenish · ${cost} ◈`:'✓ Ready for sea'}</button></section></div><div class="harbor-choices"><button data-tab="contracts"><span>⚑</span><div><strong>${state.complete?'Choose your next voyage':esc(state.voyage.name)}</strong><small>${state.complete?'Three generated commissions await':`Leg ${state.legIndex+1} of ${state.voyage.legs.length} · ${esc(m.name)}`}</small></div><b>↗</b></button><button data-tab="upgrades"><span>◭</span><div><strong>Visit the shipwright</strong><small>Better sails. Stronger hull. Longer reach.</small></div><b>↗</b></button><button data-tab="cabinet"><span>✦</span><div><strong>The curiosity cabinet</strong><small>${state.artifacts.length} discoveries · Ship bonuses</small></div><b>↗</b></button></div>`;
    } else if (tab === 'contracts') body = contractCards();
    else if (tab === 'cabinet') body = cabinetCards();
    else if (tab === 'upgrades') {
      body = `<div class="shop-grid visual-upgrades">${C.UPGRADES.map(u => {
        const level = p.upgrades[u.id], cost = C.upgradeCost(state,u.id), max=level>=u.max, [before,after,unit,label]=upgradeNumbers(u.id);
        return `<article class="shop-card illustrated ${max?'installed':''}" title="${u.desc}"><div class="upgrade-art">${Art.upgrade(u.id)}<div class="level-pips" aria-label="Level ${level} of ${u.max}">${Array.from({length:u.max},(_,i)=>`<i class="${i<level?'filled':''}"></i>`).join('')}</div></div><div class="fitting-body"><h3>${u.name}</h3><div class="upgrade-comparison"><small>${label}</small><span>${before}${unit} ${max?'':`<b>→</b> <strong>${after}${unit}</strong>`}</span></div><div class="upgrade-bars"><i style="width:${max?100:64}%"></i><b style="width:${max?100:85}%"></b></div><button data-upgrade="${u.id}" ${max||state.gold<cost?'disabled':''}>${max?'✓ Fully fitted':`Fit for ${cost} ◈`}</button></div></article>`;
      }).join('')}</div><p class="save-note">Hover a fitting for details. All equipment and discovered bonuses transfer to a new vessel.</p>`;
    } else {
      body = `<div class="shop-grid vessel-grid">${['sloop','brig','frigate'].map(id=>{
        const spec=C.CLASSES[id], owned=p.class===id, locked=state.chapter<(id==='brig'?2:id==='frigate'?4:0), unavailable=id==='sloop'||p.class==='frigate';
        return `<article class="shop-card illustrated vessel-card">${Art.ship(id)}<div class="fitting-body"><div class="eyebrow">${id==='sloop'?'AGILE & LIGHT':id==='brig'?'BALANCED RAIDER':'HEAVY BATTERY'}</div><h3>${spec.name}</h3><div class="vessel-stats">${[['●',spec.guns,'GUNS'],['⬡',spec.hull,'HULL'],['⚑',spec.crew,'CREW']].map(([icon,n,label])=>`<span><i>${icon}</i><strong>${n}</strong><small>${label}</small></span>`).join('')}</div><button data-buy="${id}" ${owned||locked||unavailable||state.gold<spec.cost?'disabled':''}>${owned?'✓ Your vessel':locked?`After ${id==='brig'?'2':'4'} commissions`:unavailable?'Already surpassed':`Commission · ${spec.cost.toLocaleString()} ◈`}</button></div></article>`;
      }).join('')}</div>`;
    }
    openModal('port', `${top('A SAFE HARBOR',island.name,island.subtitle)}${tabs(tab)}<div class="port-balance"><span>Treasury <strong>${Math.floor(state.gold).toLocaleString()} ◈</strong></span><span>Captain level ${1+Math.floor(state.renown/240)} · ${state.voyagesCompleted} voyages</span></div>${reward}${body}<div class="modal-actions"><span class="save-note">Captain profile saved · Fresh world on reload.</span><button class="primary" data-close>Cast off <span>→</span></button></div>`,tab);
  }
  function journal() {
    const v=state.voyage;
    openModal('journal',`${top('THE CAPTAIN’S JOURNAL',state.complete?'The next horizon awaits':v.name,state.complete?'Your last voyage is complete. Dock at any harbor to choose a new generated commission.':`${C.THEMES[v.theme].name} · ${v.legs.length} linked objectives · ${v.reward} doubloons + loot`)}<ol class="journal-list">${v.legs.map((m,i)=>`<li class="${state.complete||i<state.legIndex?'done':i===state.legIndex?'current':''}"><div class="journal-art">${Art.task(m.kind)}</div><div><span class="eyebrow">LEG ${i+1} ${state.complete||i<state.legIndex?'· COMPLETE':''}</span><h3>${esc(m.name)}</h3><p>${esc(m.text)}</p><small>${m.reward} ◈ ${m.kind==='relic'?'· ARTIFACT REWARD':''}</small></div></li>`).join('')}</ol><div class="modal-actions"><button class="secondary" data-map>Open sea chart ↗</button><button class="primary" data-close>Back aboard <span>→</span></button></div>`);
  }
  function help() {
    openModal('help', `${top('THE CAPTAIN’S HANDBOOK', 'Read the sea. Write your legend.', 'Your ship keeps sailing when you release the helm. Make small corrections, mind the wind, and plan your next broadside.')}<div class="handbook"><section><h3>At the helm</h3><dl><dt>← / → or A / D</dt><dd>Turn to port / starboard</dd><dt>↑ / W / Numpad 8</dt><dd>Full sails, maximum speed</dd><dt>↓ / S / Numpad 2</dt><dd>Reef sails, tighter turns</dd><dt>Space / Numpad 5</dt><dd>Fire at an enemy in either broadside</dd><dt>Q / R</dt><dd>Fire port / starboard manually</dd><dt>1 / 2 / 3</dt><dd>Round / chain / grape ammunition</dd><dt>B</dt><dd>Board a weakened ship within 53 yards</dd><dt>E</dt><dd>Dock at a nearby harbor</dd><dt>M / J / H</dt><dd>Sea chart / journal / handbook</dd><dt>N</dt><dd>Toggle navigation to your chart waypoint</dd><dt>C / drag / wheel</dt><dd>Chase camera / orbit / zoom</dd><dt>Escape / P</dt><dd>Pause and save</dd></dl></section><section><h3>A fighting chance</h3><p>Guns fire from the sides. Turn across a target’s path, release a volley, then maneuver while the crew reloads. The full battery reloads in about six seconds.</p><p><b>Round</b> shot damages hulls at long range. <b>Chain</b> shreds sails at medium range. <b>Grape</b> reduces crew at close range. All can cause some collateral damage.</p><p>When an enemy has less than 43% sails, roughly half its crew, or 43% hull, close in and press <b>B</b>. Your crew must be strong enough to board. Capturing pays better than sinking.</p><p>Sail through floating cargo to recover it; docking sells it. Visit the shipwright for upgrades. Dark squalls bring stronger wind and damage; reef your sails or buy a weather glass.</p><p>Visit the voyage board for generated, linked commissions. Discover artifacts for permanent ship bonuses. Your profile is saved; loading renews the open world and offers.</p><p>Click the full chart to set a waypoint. <b>N</b> assists navigation; steering cancels it. It will skirt islands, but keep watch for enemies and storms.</p></section></div><div class="modal-actions"><span class="save-note">Touch: use the helm buttons and on-screen sails, guns, and context actions.</span><button class="primary" data-close>Understood <span>→</span></button></div>`);
  }
  function pauseView() {
    save();
    openModal('pause', `${top('AT ANCHOR', 'A moment’s respite.', 'Your captain, gold, ship condition, and equipment are saved here. Returning creates fresh encounters and voyage offers; active objectives are not saved.')}<div class="port-balance"><span>Captain level ${1+Math.floor(state.renown/240)} · ${state.complete ? 'Ready for a new voyage' : esc(state.voyage.name)}</span><strong>${Math.floor(state.gold).toLocaleString()} ◈</strong></div><div class="modal-actions"><button class="secondary" data-help>Captain’s handbook</button><button class="secondary" data-journal>Journal</button><button class="primary" data-close>Resume voyage <span>→</span></button></div><div class="modal-actions"><span class="save-note">${state.stats.captured} prizes · ${state.stats.sunk} enemy ships defeated · ${Math.floor(state.renown)} renown</span><button class="secondary danger-button" data-new>Start a new voyage</button></div>`);
  }
  function shipView() {
    const p = state.player, spec = C.CLASSES[p.class];
    openModal('ship', `${top('THE SHIP’S REGISTER', p.name, `A ${spec.guns}-gun ${spec.name.toLowerCase()}, sailing under a free captain’s colors.`)}<div class="port-balance"><span>Hull ${Math.ceil(p.hull)} / ${C.maxHull(p)} · Sails ${Math.ceil(p.sails)}% · Crew ${Math.ceil(p.crew)} / ${C.maxCrew(p)}</span><strong>${Math.floor(state.renown)} renown</strong></div><div class="shop-grid">${C.UPGRADES.filter(u => p.upgrades[u.id]).map(u => `<article class="shop-card"><span class="shop-icon">${u.icon}</span><h3>${u.name}</h3><small>LEVEL ${p.upgrades[u.id]} / ${u.max}</small><p>${u.desc}</p></article>`).join('') || '<p class="modal-lead">Your ship has her original fittings. Dock at a friendly port to visit the shipwright.</p>'}</div><div class="modal-actions"><button class="secondary" data-map>Find a harbor ↗</button><button class="primary" data-close>Back aboard <span>→</span></button></div>`);
  }
  function victoryView() {
    openModal('victory', `<div class="voyage-complete-art">${Art.task(C.THEMES[state.voyage.theme].icon)}</div>${top('VOYAGE COMPLETE',esc(state.voyage.name),`Another tale for the taverns. ${state.voyage.legs.length} commissions fulfilled; ${state.voyage.bonus} bonus doubloons paid.`)}<div class="port-balance"><span>Captain level ${1+Math.floor(state.renown/240)} · ${state.voyagesCompleted} voyages completed</span><strong>${Math.floor(state.gold).toLocaleString()} ◈</strong></div><p class="modal-lead">Fresh opportunities are already on the harbor board. Choose a new voyage and make your next fortune.</p><div class="modal-actions"><button class="secondary" data-tab="cabinet">View discoveries</button><button class="primary" data-tab="contracts">Choose the next voyage <span>→</span></button></div>`);
  }
  function mapView() {
    openModal('map', `${top('THE SAFFRON ARCHIPELAGO', 'Chart your own course.', 'Click the chart to place a waypoint. Return to sea and press N to follow it, or steer your own course.')}<div class="map-wrap"><canvas id="world-map" width="1000" height="650" aria-label="World chart. Click a location to set a waypoint." tabindex="0"></canvas></div><div class="map-key"><span>▲ Your ship &nbsp; ◆ Commission &nbsp; ● Harbor &nbsp; ▴ Red Tide &nbsp; ◌ Squall</span><span>Click to chart · <button class="text-button" data-clear-waypoint>Clear course</button></span></div><div class="modal-actions"><span class="save-note" id="waypoint-status">${state.waypoint ? 'Waypoint plotted. Press N at sea to follow it.' : 'No course plotted. Gold marks your current objective.'}</span><button class="primary" data-close>Back to sea <span>→</span></button></div>`);
    const c = $('world-map'); drawChart(c, true);
    c.addEventListener('pointerdown', e => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, z = (e.clientY - r.top) / r.height;
      autoRoute = []; state.waypoint = { x: (x - .5) * 2800, z: (z - .5) * 2100 };
      state.waypoint.x = C.clamp(state.waypoint.x, -1260, 1260); state.waypoint.z = C.clamp(state.waypoint.z, -925, 925);
      const route=C.navigationRoute(state,state.player,state.waypoint); state.waypoint={...route[route.length-1]};
      $('waypoint-status').textContent = 'Course plotted. Press N at sea to follow it.'; drawChart(c, true); save();
    });
  }
  function bindModal() {
    const root = $('modal-content');
    root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    root.querySelectorAll('[data-help]').forEach(b => b.onclick = help);
    root.querySelectorAll('[data-map]').forEach(b => b.onclick = mapView);
    root.querySelectorAll('[data-journal]').forEach(b => b.onclick = journal);
    root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => portView(b.dataset.tab));
    root.querySelectorAll('[data-upgrade]').forEach(b => b.onclick = () => { if (C.upgrade(state, b.dataset.upgrade)) { effect('collect'); save(); updateUI(); portView('upgrades'); } });
    root.querySelectorAll('[data-livery]').forEach(b=>b.onclick=()=>{state.player.livery=b.dataset.livery;save();portView('services');});
    root.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => { if(C.acceptContract(state,b.dataset.accept)) { effect('collect'); state.events=[]; save(); updateUI(); portView('services'); } });
    root.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { if (C.buyShip(state, b.dataset.buy)) { effect('collect'); save(); updateUI(); portView('ships'); } });
    root.querySelectorAll('[data-repair]').forEach(b => b.onclick = () => { if (C.repair(state)) { effect('collect'); save(); updateUI(); portView('services'); } });
    root.querySelectorAll('[data-clear-waypoint]').forEach(b => b.onclick = () => { state.waypoint = null; autoSail = false; mapView(); save(); });
    root.querySelectorAll('[data-new]').forEach(b => b.onclick = () => openModal('new', `${top('A FRESH PAGE', 'Begin another voyage?', 'This replaces your captain profile. Your ship, treasury, equipment, and level will be reset.')}<div class="modal-actions"><button class="secondary" data-close>Keep this voyage</button><button class="primary" id="confirm-new">Start anew <span>→</span></button></div>`));
    const confirm = $('confirm-new'); if (confirm) confirm.onclick = () => { existingSave = null; startGame(false); };
  }
  function drawChart(canvas, full = false) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, paper = full;
    const map = p => ({ x: (p.x / 2800 + .5) * w, y: (p.z / 2100 + .5) * h });
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = paper ? '#e6d7b3' : '#123c40'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = paper ? '#54776e20' : '#8eb5a31a'; ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8, h); ctx.stroke(); }
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 6); ctx.lineTo(w, i * h / 6); ctx.stroke(); }
    if (paper) {
      ctx.strokeStyle = '#506d6633'; const cx = w * .88, cy = h * .15;
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * w, cy + Math.cos(a) * w); ctx.stroke(); }
      ctx.font = '13px Georgia'; ctx.fillStyle = '#33524e'; ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - 44); ctx.fillText('S', cx, cy + 55); ctx.fillText('E', cx + 49, cy + 4); ctx.fillText('W', cx - 50, cy + 4);
      ctx.beginPath(); ctx.moveTo(cx, cy - 32); ctx.lineTo(cx - 8, cy + 18); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx + 8, cy + 18); ctx.closePath(); ctx.fill();
    }
    for (const storm of state.weather) {
      const p = map(storm); ctx.fillStyle = paper ? '#64787126' : '#b9cbc01a'; ctx.strokeStyle = paper ? '#5b70635c' : '#9db6ad33'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.ellipse(p.x, p.y, storm.r / 2800 * w, storm.r / 2100 * h, 0, 0, C.TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      if (paper) { ctx.font = 'italic 13px Georgia'; ctx.fillStyle = '#62776b'; ctx.fillText('Squalls', p.x, p.y); }
    }
    for (const i of C.ISLANDS) {
      const p = map(i); ctx.fillStyle = paper ? '#8a9e77' : '#789d7d'; ctx.strokeStyle = paper ? '#53765e' : '#b8c68e88'; ctx.lineWidth = paper ? 2 : 1;
      ctx.beginPath(); for (let j = 0; j < 24; j++) { const a = j / 24 * C.TAU, rr = .95 + Math.sin(j * 2.7 + i.h) * .1, x = p.x + Math.cos(a) * i.r / 2800 * w * rr, y = p.y + Math.sin(a) * i.r / 2100 * h * rr; if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke();
      if (i.port) { const pp = map(i.port); ctx.fillStyle = paper ? '#224e50' : '#f3db9e'; ctx.beginPath(); ctx.arc(pp.x, pp.y, paper ? 4 : 2.5, 0, C.TAU); ctx.fill(); }
      if (paper) { ctx.font = '15px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#254a48'; ctx.fillText(i.name, p.x, p.y + i.r / 2100 * h + 20); }
    }
    for (const l of state.loot) if (!l.mission && full) { const p = map(l); ctx.fillStyle = '#b494514f'; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
    for (const v of state.ships) {
      const p = map(v); ctx.fillStyle = v.friendly ? (paper ? '#347d79' : '#90c9b9') : (paper ? '#a15c47' : '#dc9276'); ctx.beginPath(); ctx.moveTo(p.x, p.y - (paper ? 5 : 2.5)); ctx.lineTo(p.x + (paper ? 4 : 2), p.y + 3); ctx.lineTo(p.x - (paper ? 4 : 2), p.y + 3); ctx.closePath(); ctx.fill();
      if (paper && v.mission) { ctx.font = 'italic 12px Georgia'; ctx.fillStyle = '#814d3c'; ctx.fillText(v.name, p.x, p.y - 13); }
    }
    const objective = C.objectivePosition(state);
    if (objective) { const p = map(objective); ctx.strokeStyle = paper ? '#b78135' : '#efd18a'; ctx.lineWidth = paper ? 2 : 1; ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x + 7, p.y); ctx.lineTo(p.x, p.y + 8); ctx.lineTo(p.x - 7, p.y); ctx.closePath(); ctx.stroke(); if (paper) { ctx.font = 'bold 12px Arial'; ctx.fillStyle = '#92662c'; ctx.fillText('COMMISSION', p.x, p.y + 24); } }
    const p = map(state.player);
    if (state.waypoint) { const t = map(state.waypoint); ctx.strokeStyle = paper ? '#2c6d70' : '#8cc6bd'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(t.x, t.y, full ? 7 : 4, 0, C.TAU); ctx.stroke(); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI - state.player.angle); ctx.fillStyle = paper ? '#17494f' : '#f6e8b8'; const size = full ? 10 : 5; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * .6, size * .7); ctx.lineTo(0, size * .4); ctx.lineTo(-size * .6, size * .7); ctx.closePath(); ctx.fill(); ctx.restore();
    if (!paper) { ctx.font = '8px Arial'; ctx.fillStyle = '#c4d1b6'; ctx.textAlign = 'center'; ctx.fillText('N', w / 2, 10); }
  }
  const portLabels = C.ISLANDS.filter(i => i.port).map(i => {
    const el = document.createElement('div'); el.className = 'world-label'; el.innerHTML = `${i.name.toUpperCase()}<small>${i.id === 'bastion' ? 'RED TIDE CITADEL' : 'SAFE HARBOR'}</small><span class="pin">⌖</span>`; $('world-labels').append(el); return { island: i, el };
  });
  function updateUI() {
    const p = state.player, spec = C.CLASSES[p.class], m = C.mission(state), wind = C.windAt(state, p);
    $('gold').textContent = Math.floor(state.gold).toLocaleString(); $('cargo').textContent = state.cargo.toLocaleString(); $('day').textContent = `Day ${String(Math.floor(state.time / 90) + 1).padStart(2, '0')}`;
    $('act').textContent = state.complete ? 'NEW VOYAGES' : `${state.legIndex+1} / ${state.voyage.legs.length}`;
    $('mission-title').textContent = state.complete ? 'Your next horizon' : m.name;
    $('mission-text').textContent = state.complete ? 'Dock at any harbor to choose a new voyage: prizes, artifacts, bounties, and merchant charters.' : state.progress >= m.requirement ? `Objective complete. Dock at ${C.ISLANDS.find(i => i.id === m.port).name} to collect ${m.reward} doubloons.` : m.text;
    $('mission-progress').style.width = `${state.complete ? 100 : Math.min(100, state.progress / m.requirement * 100)}%`;
    $('ship-class').textContent = `${spec.guns}-GUN ${spec.name.toUpperCase()}`; $('ship-name').textContent = p.name;
    for (const [id, value, max] of [['hull', p.hull, C.maxHull(p)], ['sails', p.sails, 100], ['crew', p.crew, C.maxCrew(p)]]) { $(id + '-text').textContent = id === 'crew' ? `${Math.ceil(value)}` : `${Math.ceil(value / max * 100)}%`; $(id + '-fill').style.width = `${C.clamp(value / max * 100, 0, 100)}%`; }
    $('speed').textContent = (p.speed * .32).toFixed(1); $('wind-speed').textContent = `${Math.round(wind.strength)} kn`; $('wind-arrow').style.transform = `rotate(${180 - state.wind.angle * 180 / Math.PI}deg)`;
    $('full-sails').classList.toggle('active', !!p.sail); $('reef-sails').classList.toggle('active', !p.sail);
    document.querySelectorAll('[data-ammo]').forEach(b => b.classList.toggle('active', b.dataset.ammo === p.ammo));
    $('reload-fill').style.width = `${p.reload * 100}%`; $('fire-text').textContent = p.reload >= .98 ? 'FIRE BROADSIDE' : 'RELOADING'; $('reload-text').textContent = p.reload >= .98 ? 'SPACE' : `${Math.ceil((1 - p.reload) * 6.5)} SEC`; $('fire').disabled = p.reload < .98;
    const enemies = state.ships.filter(v => !v.friendly && C.dist(p, v) < 430).sort((a, b) => C.dist(p, a) - C.dist(p, b));
    target = enemies.find(v => v.id === state.selected) || enemies[0] || null;
    $('target-card').hidden = !target;
    const board = C.boardingTarget(state);
    if (target) {
      $('target-role').textContent = target.role === 'boss' ? 'ADMIRAL VANE · FLAGSHIP' : target.role === 'convoy' ? 'RED TIDE · TREASURE CONVOY' : 'RED TIDE · HOSTILE';
      $('target-name').textContent = target.name; $('target-hull').style.width = `${Math.max(0, target.hull / C.maxHull(target) * 100)}%`;
      $('target-detail').textContent = `${Math.round(C.dist(p, target))} yards · ${Math.ceil(target.sails)}% sails · ${Math.ceil(target.crew)} crew${C.targetInBroadside(p, target) && C.dist(p, target) < C.range(p) ? ' · IN YOUR BROADSIDE' : ' · Bring guns alongside'}`;
      $('board-button').hidden = !board;
    }
    const port = C.nearestPort(state), loot = state.loot.filter(l => C.dist(l, p) < 100).sort((a, b) => C.dist(a, p) - C.dist(b, p))[0];
    $('context').hidden = !port && !board && !autoSail && !loot;
    if (port) { $('context-text').textContent = port.name; $('context-button').textContent = 'E · ENTER PORT'; $('context-button').onclick = () => presses.dock = true; }
    else if (board) { $('context-text').textContent = `${board.name} is vulnerable`; $('context-button').textContent = 'B · BOARD PRIZE'; $('context-button').onclick = () => presses.board = true; }
    else if (autoSail) { $('context-text').textContent = 'Following your charted course'; $('context-button').textContent = 'N · TAKE THE HELM'; $('context-button').onclick = toggleAutoSail; }
    else if (loot) { $('context-text').textContent = loot.mission ? 'Commission cargo ahead' : 'Floating cargo ahead'; $('context-button').textContent = 'SAIL THROUGH TO COLLECT'; $('context-button').onclick = () => { state.waypoint = { x: loot.x, z: loot.z }; autoRoute = []; autoSail = true; }; }
    const nearest = [...C.ISLANDS].sort((a, b) => C.dist(p, a) - C.dist(p, b))[0];
    $('location').textContent = nearest.name.toUpperCase(); $('weather').textContent = wind.hazard > .1 ? 'SQUALL · REEF SAILS' : wind.strength > 15 ? 'STRONG WINDS' : 'FAIR WINDS';
    drawChart($('minimap'));
  }
  function toggleAutoSail() {
    if (!state.waypoint) { const o = C.objectivePosition(state); if (o) state.waypoint = { x: o.x, z: o.z }; }
    if (!state.waypoint) return;
    autoSail = !autoSail; autoRoute = autoSail?C.navigationRoute(state,state.player,state.waypoint):[]; if(autoRoute.length) state.waypoint={...autoRoute[autoRoute.length-1]}; notify(autoSail ? 'Course set. Navigation assistance engaged; steering returns the helm to you.' : 'The helm is yours.', '', 5); updateUI();
  }
  function navigationHelm() {
    if (!autoSail || !state.waypoint) return 0;
    const p = state.player, goal = state.waypoint;
    if (C.dist(p, goal) < 18) { autoSail = false; state.waypoint = null; notify('You have reached your charted destination.', 'good'); return 0; }
    if(!autoRoute.length) autoRoute=C.navigationRoute(state,p,goal);
    while(autoRoute.length>1&&C.dist(p,autoRoute[0])<42) autoRoute.shift();
    const desired=C.bearing(p,autoRoute[0]||goal);
    p.sail=Math.abs(C.angleDiff(desired,p.angle))>.85?0:1;
    return -C.clamp(C.angleDiff(desired, p.angle) * 2.2, -1, 1);
  }
  function processEvents() {
    let openPort = false, victory = false;
    for (const e of state.events) {
      renderer.emit(e);
      if (e.type === 'message') notify(e.text, e.tone);
      if (e.type === 'objective') { notify(e.text, 'good', 8); effect('collect'); save(); }
      if (e.type === 'artifact') { effect('collect'); notify(`Discovered: ${e.relic.name} · ${e.relic.label}`, 'good', 9); }
      if (e.type === 'collect') { effect('collect'); notify(`Cargo recovered · +${e.value} cargo value`, 'good', 3); }
      if (['fire', 'hit', 'sink', 'splash'].includes(e.type) && C.dist(e, state.player) < 600) effect(e.type);
      if (e.type === 'port') openPort = true;
      if (e.type === 'victory') victory = true;
      if (e.type === 'rescued') { autoSail = false; state.waypoint = null; renderer.follow = { x: state.player.x, z: state.player.z }; notify(e.text, 'warning', 10); save(); }
    }
    if (openPort) { autoSail = false; save(); if (victory) victoryView(); else portView(state.complete?'contracts':'services'); }
    state.events = [];
  }
  $('start').onclick = () => {
    if (existingSave) openModal('new', `${top('A NEW HORIZON', 'Begin a fresh voyage?', 'A saved voyage already exists. Starting anew replaces it.')}<div class="modal-actions"><button class="secondary" data-close>Keep saved voyage</button><button class="primary" id="confirm-new">Start anew <span>→</span></button></div>`);
    else startGame();
  };
  $('continue').onclick = () => startGame(true); $('welcome-help').onclick = help;
  $('journal-button').onclick = journal; $('brand-button').onclick = e => { e.preventDefault(); journal(); }; $('ship-details').onclick = shipView;
  $('pause').onclick = pauseView; $('map-button').onclick = mapView;
  $('sound').onclick = () => { soundEnabled = !soundEnabled; audioStart(); $('sound').textContent = soundEnabled ? '♫' : '♪'; $('sound').title = soundEnabled ? 'Mute sound' : 'Enable sound'; $('sound').setAttribute('aria-label', $('sound').title); };
  $('fire').onclick = () => presses.fire = true; $('board-button').onclick = () => presses.board = true;
  $('full-sails').onclick = () => state.player.sail = 1; $('reef-sails').onclick = () => state.player.sail = 0;
  document.querySelectorAll('[data-ammo]').forEach(b => b.onclick = () => { state.player.ammo = b.dataset.ammo; updateUI(); });
  document.querySelectorAll('[data-hold]').forEach(b => {
    b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); touch[b.dataset.hold] = true; autoSail = false; });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(type, () => touch[b.dataset.hold] = false);
  });
  $('modal').addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && started && !currentModal) e.preventDefault();
    if (currentModal) { if (e.code === 'KeyM' && currentModal === 'map') closeModal(); return; }
    if (!started) return;
    if (['Escape', 'KeyP'].includes(e.code)) { e.preventDefault(); pauseView(); return; }
    if (e.code === 'KeyM') { mapView(); return; } if (e.code === 'KeyJ') { journal(); return; } if (e.code === 'KeyH') { help(); return; }
    if (e.code === 'KeyN' && !e.repeat) toggleAutoSail();
    if (e.code === 'KeyC' && !e.repeat) { chaseCamera = !chaseCamera; if (!chaseCamera) renderer.yaw = .2; }
    keys.add(e.code);
    if (['ArrowUp', 'KeyW', 'Numpad8'].includes(e.code)) state.player.sail = 1;
    if (['ArrowDown', 'KeyS', 'Numpad2'].includes(e.code)) state.player.sail = 0;
    const ammos = { Digit1: 'round', Digit2: 'chain', Digit3: 'grape', Numpad3: 'round', Numpad7: 'chain', Numpad1: 'grape' }; if (ammos[e.code]) state.player.ammo = ammos[e.code];
    if (e.code === 'KeyE' && !e.repeat) presses.dock = true;
    if (e.code === 'KeyB' && !e.repeat) presses.board = true;
    if (['KeyQ', 'KeyR'].includes(e.code) && !e.repeat) { presses.fire = true; presses.side = e.code === 'KeyQ' ? -1 : 1; }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { clearInput(); if (started && !currentModal) pauseView(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); save(); if (started && !currentModal) pauseView(); } });
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', () => renderer.resize());
  let drag = null;
  $('sea').addEventListener('pointerdown', e => { if (!started || currentModal) return; drag = { x: e.clientX, y: e.clientY }; $('sea').setPointerCapture(e.pointerId); });
  $('sea').addEventListener('pointermove', e => { if (!drag) return; renderer.yaw -= (e.clientX - drag.x) * .006; renderer.height = C.clamp(renderer.height + (e.clientY - drag.y) * .004, .4, 1.7); drag = { x: e.clientX, y: e.clientY }; chaseCamera = false; });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('sea').addEventListener(type, () => drag = null);
  $('sea').addEventListener('wheel', e => { if (!started || currentModal) return; e.preventDefault(); renderer.distance = C.clamp(renderer.distance + e.deltaY * .2, 115, 620); }, { passive: false });
  let previous = performance.now(), accumulator = 0;
  function frame(now) {
    const dt = Math.min((now - previous) / 1000, .08); previous = now;
    if (started && !currentModal) {
      accumulator += dt;
      const left = keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('Numpad4') || touch.left;
      const right = keys.has('ArrowRight') || keys.has('KeyD') || keys.has('Numpad6') || touch.right;
      if (left || right) autoSail = false;
      while (accumulator >= 1 / 60 && !currentModal) {
        const input = { helm: left || right ? Number(right) - Number(left) : navigationHelm(), fire: presses.fire || keys.has('Space') || keys.has('Numpad5'), side: presses.side || 0, dock: presses.dock, board: presses.board };
        C.step(state, input, 1 / 60); for (const k of Object.keys(presses)) delete presses[k]; processEvents(); accumulator -= 1 / 60;
      }
      if (chaseCamera) renderer.yaw += C.angleDiff(state.player.angle + Math.PI, renderer.yaw) * Math.min(1, dt * 2);
      if (now - lastSave > 10000) { save(); lastSave = now; }
    } else accumulator = 0;
    renderer.frame(state, currentModal && started ? 0 : dt, !started);
    if (started && now - lastUI > 100) { updateUI(); lastUI = now; }
    if (started) for (const label of portLabels) {
      const i = label.island, point = renderer.project(i.port.x, 24, i.port.z), d = C.dist(state.player, i.port);
      label.el.hidden = !point || d > 950 || (d < 75);
      if (point) { label.el.style.left = `${point.x}px`; label.el.style.top = `${point.y}px`; label.el.style.opacity = C.clamp(1.4 - d / 1000, .3, 1); }
    }
    for (let i = notices.length - 1; i >= 0; i--) if (now > notices[i].until) { notices[i].el.remove(); notices.splice(i, 1); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // A read-only diagnostic snapshot is useful for reporting and QA, not for gameplay.
  window.corsairSnapshot = () => ({ commissions: state.chapter, voyage: state.voyage.name, leg: state.legIndex, voyagesCompleted: state.voyagesCompleted, phase: state.phase, position: { x: state.player.x, z: state.player.z }, hull: state.player.hull, sails: state.player.sails, crew: state.player.crew, gold: state.gold, cargo: state.cargo, objective: C.objectivePosition(state), projectiles: state.shots.length, ships: state.ships.length, started, modal: currentModal });
})();
