/* Crescent Seas: deliberately compressed historical-fantasy sea theaters.
   Ports/affiliations follow the supplied concept; coastlines and missions are fiction. */
(function (root) {
  'use strict';
  const FACTIONS = {
    marakkar: { name: 'Marakkar captains', court: 'In service to the Zamorin of Calicut', color: '#bfcf9a', mark: '◈', perk: 'Coastal pilots · +6% speed', speed: .06, detail: 'Muslim maritime commanders serving Calicut’s Hindu Zamorin. They are an affiliation, not a separate sultanate.' },
    gujarat: { name: 'Gujarat Sultanate', court: 'Merchant courts of Gujarat', color: '#dfb16c', mark: '✧', perk: 'Merchant credit · +10% commission pay', pay: .1, detail: 'Port defense and merchant networks under pressure from Portuguese expansion.' },
    mamluk: { name: 'Mamluk Sultanate', court: 'Egyptian Red Sea commission', color: '#d0b87c', mark: '◇', perk: 'Dockyard support · −15% refit cost', refit: .15, detail: 'This theater is set before the Mamluk Sultanate’s fall in 1517. Later Ottoman seas occupy a different era.' },
    arab: { name: 'Arab merchant houses', court: 'Pilots and merchants of Arabia', color: '#9dbeb3', mark: '⌁', perk: 'Reef pilots · +6% handling', turn: .06, detail: 'Independent port communities and merchant houses; neither one empire nor one political interest.' },
    ottoman: { name: 'Ottoman Empire', court: 'Imperial naval commission', color: '#d19b83', mark: '☾', perk: 'Naval gunners · +6% range', range: .06, detail: 'Imperial squadrons compete with Venetian, Spanish, and Hospitaller forces. Missions here are fictional composites.' },
    algiers: { name: 'Algiers corsair captains', court: 'Western Mediterranean commission', color: '#a6c5ae', mark: '✦', perk: 'Boarding parties · +10% strength', board: .1, detail: 'Corsair networks have local patrons and ambitions, even where they overlap Ottoman interests.' },
    tunis: { name: 'Tunis maritime court', court: 'Harbor and convoy commission', color: '#d1c68c', mark: '◈', perk: 'Harbor support · −10% refit cost', refit: .1, detail: 'Tunis is represented as a distinct patron rather than a generic interchangeable corsair flag.' },
    morocco: { name: 'Moroccan sultanate', court: 'Atlantic coastal commission', color: '#cfa27c', mark: '◇', perk: 'Atlantic pilots · −20% storm damage', storm: .2, detail: 'Royal authority and independent corsair interests meet along Atlantic routes.' },
    sale: { name: 'Salé corsair captains', court: 'Independent corsair commission', color: '#97b8c1', mark: '✧', perk: 'Fast interceptions · +6% speed', speed: .06, detail: 'A separate affiliation from the Moroccan royal court, with its own commissions and standing.' },
    oman: { name: 'Omani maritime power', court: 'Western Indian Ocean commission', color: '#d8b18a', mark: '☾', perk: 'Monsoon pilots · +6% speed', speed: .06, detail: 'This later era represents Omani maritime power alongside distinct Swahili port communities.' },
    swahili: { name: 'Swahili merchant councils', court: 'Coastal city and merchant networks', color: '#a6c6a2', mark: '⌁', perk: 'Merchant networks · +10% commission pay', pay: .1, detail: 'Swahili ports have their own politics, autonomy, trade relationships, and local histories.' },
    aceh: { name: 'Aceh Sultanate', court: 'Strait defense commission', color: '#d4b67d', mark: '✦', perk: 'Coastal batteries · +6% range', range: .06, detail: 'Acehnese maritime ambitions intersect with Portuguese Malacca, Dutch fleets, and other regional powers.' },
    johor: { name: 'Johor maritime court', court: 'Malay strait commission', color: '#b6bd91', mark: '◈', perk: 'Strait pilots · +6% handling', turn: .06, detail: 'A distinct Malay patron with its own port interests, rather than an extension of Aceh.' }
  };
  const palettes = {
    india: { deep: [ .035,.35,.40 ], shallow: [ .18,.65,.57 ], sky: [ .68,.79,.76 ], land: [0x526c42,0x617d45,0x71894d,0x849759,0xa8b872,0xd8c38a,0xe1cea0] },
    desert: { deep: [.045,.34,.46], shallow: [.25,.72,.69], sky: [.78,.80,.74], land: [0xa5926c,0xb19b6f,0xbda775,0xc6b17c,0xd0be8b,0xe3cf9d,0xe9d9b2] },
    med: { deep: [.045,.27,.43], shallow: [.16,.57,.61], sky: [.70,.79,.83], land: [0x6c7855,0x7d865e,0x929775,0xa8ad87,0xb9c09b,0xd5cda9,0xe6deba] },
    atlantic: { deep: [.055,.26,.33], shallow: [.22,.50,.48], sky: [.64,.73,.75], land: [0x857d59,0x93875e,0xa59769,0xb1a574,0xbeb386,0xd1c091,0xe1d0a4] },
    tropical: { deep: [.025,.33,.36], shallow: [.13,.61,.53], sky: [.65,.77,.73], land: [0x395a3f,0x486c42,0x567e49,0x6c9154,0x90ab6a,0xd0c48c,0xded2a6] }
  };
  const island = (id,name,x,z,r,h,patron=null,style=null) => ({id,name,x,z,r,h,style,port:patron?{x:x+r+55,z}:null,patron,subtitle:patron?FACTIONS[patron].name.toUpperCase():'OFFSHORE WATERS'});
  const WORLDS = {
    india: { id:'india',name:'Malabar & Gujarat',sea:'WESTERN INDIAN OCEAN',year:1530,era:'Age of Carracks',size:[4600,3400],home:'calicut',climate:'india',style:'malabar',rig:'lateen',wind:2.35,patrons:['marakkar','gujarat'],enemies:['Portuguese armed fleet'],gate:{x:-300,z:650},intro:'Protect coastal trade from Portuguese patrols. Marakkar captains serve the Zamorin; Gujarati courts offer their own commissions.',ships:['Coastal fighting craft','Armed dhow','Heavy coastal warship'],names:['São Gabriel','Santa Esperança','Falcão','São Vicente','Vento Norte','Santa Clara'],
      islands:[island('calicut','Calicut',-1650,650,210,80,'marakkar'),island('surat','Surat',-1050,-1000,230,58,'gujarat','gujarat'),island('diu','Diu',600,-980,190,61,'gujarat','gujarat'),island('cannanore','Cannanore anchorage',1000,650,235,105,'marakkar'),island('lakshadweep','Laccadive atolls',-500,-60,130,22),island('banks','Monsoon banks',380,160,165,37),island('pepper','Pepper islands',1560,-350,180,116),island('reef','Pilot’s reef',-1530,-240,110,25),island('shoals','Southern shoals',-450,1150,125,30),island('cays','Outer cays',1450,1200,115,40)] },
    redsea: { id:'redsea',name:'Red Sea & Arabia',sea:'THE RED SEA GATE',year:1510,era:'Age of Carracks',size:[4400,3800],home:'jeddah',climate:'desert',style:'redsea',rig:'lateen',wind:2.9,patrons:['mamluk','arab'],enemies:['Portuguese raiding squadron'],gate:{x:50,z:400},intro:'Sail in an earlier century of Mamluk convoy defense, Arabian pilotage, reefs, and Portuguese pressure.',ships:['Light dhow','Armed trading dhow','Heavy convoy escort'],names:['São Rafael','Santa Cruz','Estrela','São Jorge','Leão do Mar'],
      islands:[island('jeddah','Jeddah',-1600,550,220,48,'mamluk'),island('suez','Suez',-1250,-1200,230,55,'mamluk'),island('mocha','Mocha',950,1150,230,72,'arab'),island('aden','Aden',1200,-850,250,155,'arab'),island('dahlak','Dahlak islands',-650,-320,145,32),island('farasan','Farasan banks',450,120,185,27),island('reefs','Coral passages',-500,1100,140,24),island('gates','Bab al-Mandab approaches',1250,250,120,74),island('salt','Salt islands',500,-1300,110,48),island('mirage','Mirage rocks',-1550,-250,110,89)] },
    easternmed: { id:'easternmed',name:'Ottoman Eastern Mediterranean',sea:'ISLANDS OF THE SUBLIME PORTE',year:1580,era:'Age of Corsairs',size:[5000,3600],home:'alexandria',climate:'med',style:'ottoman',rig:'galley',wind:2.0,patrons:['ottoman','arab'],enemies:['Venetian armed fleet','Hospitaller squadron'],gate:{x:100,z:500},intro:'Imperial orders, merchant interests, and island warfare meet in Ottoman waters. Venetian and Hospitaller warships contest the routes.',ships:['Light galliot','Armed galley','Heavy sailing escort'],names:['San Marco','San Giorgio','Vigilante','San Michele','Falcone'],
      islands:[island('alexandria','Alexandria',-1700,950,240,72,'ottoman'),island('istanbul','Istanbul approaches',-1450,-1150,255,100,'ottoman'),island('rhodes','Rhodes anchorage',350,-950,240,118,'ottoman'),island('cyprus','Cyprus',1650,450,285,145,'ottoman'),island('crete','Crete approaches',-650,-150,300,150),island('aegean','Aegean islands',500,150,165,100),island('levant','Levant pilot station',1550,-900,160,85,'arab'),island('cyclades','Cyclades banks',-100,1100,135,75),island('sporades','Northern isles',-500,-1200,120,86),island('rocks','Limestone rocks',1750,1150,110,100)] },
    westernmed: { id:'westernmed',name:'Maghrebi Corsair Seas',sea:'THE WESTERN MEDITERRANEAN',year:1600,era:'Age of Corsairs',size:[4800,3400],home:'algiers',climate:'med',style:'maghreb',rig:'galley',wind:2.5,patrons:['algiers','tunis','ottoman'],enemies:['Spanish imperial squadron','Italian armed squadron'],gate:{x:300,z:500},intro:'Work with distinct Algiers and Tunis patrons. Intercept armed imperial shipping and guard the coastal trade.',ships:['Corsair galliot','Armed galley','Heavy corsair ship'],names:['San Felipe','Santa Catalina','San Pedro','La Victoria','San Lorenzo'],
      islands:[island('algiers','Algiers',-1650,700,230,110,'algiers'),island('tunis','Tunis',700,850,235,85,'tunis'),island('tripoli','Tripoli',1550,150,220,64,'ottoman'),island('bejaia','Béjaïa anchorage',-1050,-750,210,135,'algiers'),island('balearic','Balearic approaches',-150,-850,240,120),island('sardinia','Sardinian approaches',900,-900,250,140),island('channels','Corsair channels',-400,250,140,70),island('saltisle','Salt island',1750,-900,110,35),island('tide','Tide rocks',-1100,1250,100,57),island('outer','Outer watch',1500,1250,110,65)] },
    morocco: { id:'morocco',name:'Atlantic Morocco',sea:'SALÉ & THE STRAIT OF GIBRALTAR',year:1630,era:'Age of Corsairs',size:[4600,3600],home:'sale',climate:'atlantic',style:'morocco',rig:'lateen',wind:1.7,patrons:['sale','morocco'],enemies:['Iberian armed fleet','Atlantic privateer squadron'],gate:{x:200,z:250},intro:'Royal Moroccan interests and Salé’s corsair captains offer different paths through Atlantic storms and imperial patrols.',ships:['Light corsair vessel','Ocean-going corsair','Heavy Atlantic escort'],names:['San Miguel','Nuestra Señora','Infanta','San Andrés','La Corona'],
      islands:[island('sale','Salé',-1650,650,220,75,'sale'),island('safi','Safi',-1150,1250,195,82,'morocco'),island('tangier','Tangier approaches',500,-1100,230,100,'morocco'),island('tetouan','Tétouan anchorage',1450,-450,210,92,'morocco'),island('strait','Strait headlands',-650,-550,245,185),island('banks','Atlantic banks',400,1000,160,40),island('isles','Offshore isles',1200,850,170,80),island('cape','Cape rocks',-1600,-900,145,110),island('narrows','Narrows reef',1450,-1200,120,40),island('windward','Windward rocks',-300,500,100,65)] },
    swahili: { id:'swahili',name:'Swahili & Omani Sea Routes',sea:'THE EAST AFRICAN COAST',year:1700,era:'Age of Companies',size:[4800,3800],home:'zanzibar',climate:'tropical',style:'swahili',rig:'lateen',wind:2.2,patrons:['swahili','oman'],enemies:['Portuguese armed fleet','European company squadron'],gate:{x:150,z:450},intro:'Coral-stone cities, Omani squadrons, and Swahili councils share monsoon routes without sharing every ambition.',ships:['Coastal dhow','Armed ocean dhow','Heavy convoy escort'],names:['São João','Santa Teresa','Boa Ventura','Fortune','Resolute'],
      islands:[island('zanzibar','Zanzibar',-1600,650,240,65,'swahili'),island('mombasa','Mombasa',-1050,-1050,235,80,'oman'),island('kilwa','Kilwa',950,1150,250,60,'swahili'),island('pemba','Pemba',1300,-700,230,120,'swahili'),island('oman','Omani roadstead',250,-1250,180,55,'oman'),island('coral','Coral islands',-500,50,145,30),island('monsoon','Monsoon isles',650,100,190,90),island('channel','Pilot’s channel',-1250,-150,115,26),island('mangrove','Mangrove cays',1650,550,135,40),island('outer','Outer reef',-700,1300,120,30)] },
    aceh: { id:'aceh',name:'Aceh & the Malacca Strait',sea:'THE STRAIT OF SPICES',year:1635,era:'Age of Corsairs',size:[5000,3600],home:'aceh',climate:'tropical',style:'aceh',rig:'lateen',wind:2.7,patrons:['aceh','johor'],enemies:['Portuguese Malacca squadron','Dutch company squadron'],gate:{x:-50,z:500},intro:'Accept commissions from Aceh or Johor. Protect spice convoys and confront armed Portuguese and Dutch company fleets.',ships:['Light strait craft','Armed merchant vessel','Heavy Acehnese escort'],names:['São Paulo','Santa Isabel','Batavia','Vrede','Zeelandia','Nassau'],
      islands:[island('aceh','Aceh',-1800,650,250,120,'aceh'),island('johor','Johor',1200,850,250,75,'johor'),island('sumatra','Sumatran anchorage',-850,-1050,275,170,'aceh'),island('riau','Riau roadstead',1700,-700,230,85,'johor'),island('strait','Malacca approaches',400,-950,240,80),island('spice','Spice islands',-500,50,185,100),island('mangrove','Mangrove passages',650,100,170,54),island('outer','Andaman approaches',-1800,-400,150,125),island('reef','Strait reef',-500,1200,120,30),island('rain','Rain islands',1600,1250,140,130)] }
  };
  // Regional silhouettes. These echo large coastal forms without claiming survey accuracy.
  const feature=(worldId,id,changes)=>Object.assign(WORLDS[worldId].islands.find(i=>i.id===id),changes);
  const shore=[[-.85,-5.5],[-.8,-2.4],[-.95,-1.4],[-1,0],[-.9,1],[-.6,1.9],[0,2.8],[.8,3.3],[1.6,3.4],[4.5,3.2],[4.5,-5.5]];
  feature('india','calicut',{x:1500,z:500,r:245,h:85,outline:shore,portSide:'west'});
  feature('india','surat',{x:1400,z:-1130,r:240,outline:[[-1,-3.5],[-1.15,-.8],[-1,0],[-.65,1.1],[-.3,2.2],[4.5,2.2],[4.5,-3.5]],portSide:'west'});
  feature('india','diu',{x:540,z:-980,outline:[[-1.8,-.4],[-1.4,-1],[-.3,-1.2],[.7,-.55],[1.1,.2],[.15,.8],[-.8,1.1],[-1.7,.5]]});
  feature('india','cannanore',{x:900,z:-80,r:120});
  feature('india','lakshadweep',{x:-500,z:20,r:110,atoll:true,outline:[[-1.8,-.3],[-1,-.8],[.8,-.7],[1.7,0],[.7,.65],[-1.1,.7]]});
  feature('india','pepper',{x:-1450,z:650});feature('india','shoals',{atoll:true});feature('india','cays',{x:750,atoll:true});
  feature('redsea','suez',{x:-1150,z:-1000,r:260,h:65,outline:[[-6,-5],[-6,13],[.2,13],[.35,8],[.65,6],[.9,3],[1,0],[.9,-1.1],[.3,-2.1],[-.1,-5]]});
  feature('redsea','jeddah',{x:1100,z:-350,r:250,h:60,outline:[[-1,-8],[-1.1,-2.4],[-1,0],[-1,2.5],[-1.1,5],[-.6,7],[.2,10],[6,10],[6,-8]],portSide:'west'});
  feature('redsea','mocha',{x:1050,z:1000,r:230,portSide:'west'});
  feature('redsea','aden',{x:1000,z:1480,r:240,portSide:'west'});
  feature('redsea','gates',{x:-150,z:1400,r:150,outline:[[-1.5,-.8],[-.4,-1.2],[1.4,-.1],[1,.8],[-.8,1.1]]});
  feature('redsea','salt',{x:300,z:-1300,r:90});
  feature('easternmed','crete',{outline:[[-2.8,.15],[-2.2,-.45],[-.8,-.5],[.4,-.35],[2.4,-.1],[2,.4],[.6,.65],[-1.8,.6]],h:120});
  feature('easternmed','cyprus',{outline:[[-1.2,-.2],[-.4,-.65],[.55,-.45],[1.65,-.9],[1,.1],[.35,.8],[-.8,.6]]});
  feature('easternmed','rhodes',{outline:[[-.45,-1.5],[.25,-1.1],[.6,.2],[.1,1.4],[-.6,.7]]});
  feature('easternmed','istanbul',{outline:[[-5,-5],[-5,1],[.2,.8],[1.1,.1],[1.7,-.5],[3,-.9],[3,-5]],h:65});
  feature('easternmed','levant',{outline:[[0,-6],[-1,-1.1],[-.9,.2],[-.6,2.1],[7,2.1],[7,-6]],portSide:'west'});
  feature('westernmed','sardinia',{outline:[[-.6,-1.6],[.35,-1.3],[.6,-.4],[.4,.4],[.7,1.1],[-.1,1.5],[-.7,.7],[-.9,-.5]]});
  feature('westernmed','balearic',{outline:[[-1.9,-.3],[-.7,-.9],[.2,-.45],[1.4,-.1],[1.1,.5],[-.2,.8],[-1.5,.4]]});
  feature('westernmed','algiers',{outline:[[-4,0],[-4,6],[2.9,6],[2.9,.1],[1.4,-.1],[.3,0],[-.8,-.15]],portSide:'north'});
  feature('westernmed','tunis',{outline:[[-1.3,-1.2],[-.2,-1.4],[.8,-.6],[1,.2],[.4,1.5],[-.4,1.2],[-1.1,.3]]});
  feature('morocco','sale',{x:1450,z:350,r:240,outline:[[-.7,-3.8],[-1,-2.5],[-1,0],[-.6,1.8],[.2,3.4],[6,7],[6,-3.8]],portSide:'west'});
  feature('morocco','safi',{x:1250,z:1190,r:170,portSide:'west'});
  feature('morocco','tangier',{x:1200,z:-1060,r:180,outline:[[-1,-.1],[-.45,-.9],[.5,-.9],[1.2,-.1],[.6,1.1],[-.6,1.1]],portSide:'west'});
  feature('morocco','tetouan',{x:1750,z:-850,r:170,portSide:'west'});
  feature('morocco','strait',{x:300,z:-1360,r:200,outline:[[-3,-2],[-3,-.7],[-1.6,-.4],[-.5,.15],[.7,.45],[1.8,-.1],[3,-.4],[3,-2]],h:120});
  feature('swahili','zanzibar',{outline:[[-.4,-1.5],[.2,-1.6],[.6,-.7],[.5,.5],[.1,1.5],[-.5,1],[-.7,0]]});
  feature('swahili','pemba',{outline:[[-.2,-1.7],[.3,-1.3],[.4,-.2],[.1,1.5],[-.4,1.2],[-.5,-.2]]});
  feature('swahili','kilwa',{outline:[[-.7,-1.1],[.2,-1.3],[1.1,-.3],[.7,.9],[-.6,1.1],[-1,.1]]});
  feature('swahili','mombasa',{x:-2100,outline:[[-7,-5],[-7,13],[.2,13],[.4,3],[.7,1.5],[1,.3],[.9,-.7],[.2,-5]],h:65});
  feature('swahili','outer',{atoll:true});
  feature('aceh','sumatra',{x:-850,z:-650,r:270,h:165,outline:[[-1.5,-2.8],[-.7,-2.2],[.2,-.7],[1.2,.9],[2,2.7],[1.25,2.6],[.2,1.5],[-.8,-.1],[-1.6,-1.8]],portSide:'west'});
  feature('aceh','aceh',{x:-1550,z:-1280,r:175,h:115,outline:[[-1.2,-.7],[-.5,-1.1],[.8,-.3],[1.2,1.2],[.2,1.1],[-.9,.2]],portSide:'west'});
  feature('aceh','strait',{x:450,z:-750,r:250,h:85,outline:[[-.6,-5],[-.3,-1.5],[.1,-.3],[.6,1.1],[1.4,2.5],[1.7,3],[2.2,2.8],[1.6,.8],[1.3,-1],[1.5,-5]]});
  feature('aceh','johor',{x:950,z:150,r:165,portSide:'west'});
  feature('aceh','spice',{x:-1450,z:450,r:140,atoll:true});
  feature('aceh','mangrove',{x:1550,z:750,r:150});
  feature('aceh','outer',{x:-1850,z:-100,r:110});
  for(const w of Object.values(WORLDS))for(const i of w.islands)if(i.port){
    // Place the harbor outside the actual silhouette, including west-facing coasts.
    const axis=i.portSide==='north'?1:0,side=['west','north'].includes(i.portSide)?-1:1;
    let edge=side;
    if(i.outline){const hits=[];for(let k=0;k<i.outline.length;k++){const a=i.outline[k],b=i.outline[(k+1)%i.outline.length],other=1-axis;if((a[other]<=0&&b[other]>=0)||(a[other]>=0&&b[other]<=0)){const t=a[other]===b[other]?0:-a[other]/(b[other]-a[other]);hits.push(a[axis]+(b[axis]-a[axis])*t);}}edge=hits.length?(side<0?Math.min(...hits):Math.max(...hits)):side;}
    i.shoreOffset=edge*i.r;i.port=axis?{x:i.x,z:i.z+i.shoreOffset-55}:{x:i.x+i.shoreOffset+side*55,z:i.z};
  }
  for (const w of Object.values(WORLDS)) { w.palette=palettes[w.climate]; w.currency='gold'; }
  root.CrescentWorlds={WORLDS,FACTIONS};
})(globalThis);
