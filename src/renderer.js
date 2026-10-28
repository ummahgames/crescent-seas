/* Small native WebGL renderer. All meshes are built locally; no remote assets. */
(function (root) {
  'use strict';
  const C = root.Corsair;
  const clampSea=v=>Math.max(0,Math.min(1,v));
  const rgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
  const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), d = near - far;
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / d, -1, 0, 0, 2 * far * near / d, 0]);
  }
  function lookAt(eye, center) {
    const norm = v => { const d = Math.hypot(...v); return v.map(x => x / d); };
    const z = norm(eye.map((x, i) => x - center[i]));
    const x = norm([z[2], 0, -z[0]]), y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -x.reduce((a, v, i) => a + v * eye[i], 0), -y.reduce((a, v, i) => a + v * eye[i], 0), -z.reduce((a, v, i) => a + v * eye[i], 0), 1]);
  }
  function model(x = 0, y = 0, z = 0, a = 0, scale = 1, roll = 0) {
    const c = Math.cos(a), s = Math.sin(a), cr = Math.cos(roll), sr = Math.sin(roll);
    return new Float32Array([c * cr * scale, sr * scale, -s * cr * scale, 0, -c * sr * scale, cr * scale, s * sr * scale, 0, s * scale, 0, c * scale, 0, x, y, z, 1]);
  }
  class Geometry {
    constructor() { this.data = []; }
    tri(a, b, c, color) {
      const u = b.map((v, i) => v - a[i]), v = c.map((v, i) => v - a[i]);
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...n) || 1; n = n.map(v => v / len);
      if (n[1] < 0) n = n.map(v => -v); // two-sided stylized materials
      const col = Array.isArray(color) ? color : rgb(color);
      for (const p of [a, b, c]) this.data.push(...p, ...n, ...col);
    }
    quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
    box(x, y, z, w, h, d, col) {
      const a = [x - w / 2, y, z - d / 2], b = [x + w / 2, y, z - d / 2], c = [x + w / 2, y, z + d / 2], e = [x - w / 2, y, z + d / 2];
      const top = p => [p[0], p[1] + h, p[2]];
      this.quad(a, b, top(b), top(a), col); this.quad(b, c, top(c), top(b), col); this.quad(c, e, top(e), top(c), col); this.quad(e, a, top(a), top(e), col); this.quad(top(a), top(b), top(c), top(e), col);
    }
    cone(x, y, z, r, h, col, sides = 7, rTop = 0) {
      for (let i = 0; i < sides; i++) {
        const a = i / sides * C.TAU, b = (i + 1) / sides * C.TAU;
        this.quad([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(b) * r, y, z + Math.sin(b) * r], [x + Math.cos(b) * rTop, y + h, z + Math.sin(b) * rTop], [x + Math.cos(a) * rTop, y + h, z + Math.sin(a) * rTop], col);
      }
    }
    beam(a, b, width, col) {
      const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
      const x = -dz / len * width / 2, z = dx / len * width / 2;
      this.quad([a[0] + x, a[1], a[2] + z], [a[0] - x, a[1], a[2] - z], [b[0] - x, b[1], b[2] - z], [b[0] + x, b[1], b[2] + z], col);
      this.quad([a[0], a[1] - width / 2, a[2]], [a[0], a[1] + width / 2, a[2]], [b[0], b[1] + width / 2, b[2]], [b[0], b[1] - width / 2, b[2]], col);
    }
    sphere(x, y, z, radius, col, stretch = [1, 1, 1], slices = 9, rings = 5) {
      const point = (a, b) => [x + Math.sin(a) * Math.cos(b) * radius * stretch[0], y + Math.cos(a) * radius * stretch[1], z + Math.sin(a) * Math.sin(b) * radius * stretch[2]];
      for (let j = 0; j < rings; j++) for (let i = 0; i < slices; i++) this.quad(point(j / rings * Math.PI, i / slices * C.TAU), point((j + 1) / rings * Math.PI, i / slices * C.TAU), point((j + 1) / rings * Math.PI, (i + 1) / slices * C.TAU), point(j / rings * Math.PI, (i + 1) / slices * C.TAU), col);
    }
  }
  function shipGeometry(cls, faction, reef = false, torn = false, fittings = {}) {
    const g = new Geometry(), s = C.CLASSES[cls], l = s.length, b = s.beam;
    const paint = { teal: 0x396d65, indigo: 0x485b78, ochre: 0xa47a43 };
    const dark = faction === 'enemy' ? 0x302e30 : fittings.copper ? 0xac784b : 0x49392b, upper = faction === 'enemy' ? 0x63433b : paint[fittings.livery] || 0x976342, trim = faction === 'enemy' ? 0xb88a56 : 0xe3bd72;
    const sail = faction === 'enemy' ? 0x923a32 : faction === 'friendly' ? 0xb8d2c4 : 0xf0dfb3;
    const stations = [[-l * .5, b * .33], [-l * .38, b * .5], [0, b * .54], [l * .32, b * .4], [l * .59, .12]];
    for (let i = 0; i < stations.length - 1; i++) {
      const [z1, w1] = stations[i], [z2, w2] = stations[i + 1];
      for (const sign of [-1, 1]) {
        g.quad([w1 * sign * .55, -.4, z1], [w2 * sign * .55, -.4, z2], [w2 * sign, 3.4, z2], [w1 * sign, 3.4, z1], dark);
        g.quad([w1 * sign, 3.4, z1], [w2 * sign, 3.4, z2], [w2 * sign, 6.7, z2], [w1 * sign, 6.7, z1], upper);
        g.beam([w1 * sign, 6.9, z1], [w2 * sign, 6.9, z2], .48, trim);
      }
      g.quad([-w1, 6.3, z1], [-w2, 6.3, z2], [w2, 6.3, z2], [w1, 6.3, z1], 0xb68a56);
    }
    g.box(0, 5, -l * .4, b * .65, 4, l * .2, dark);
    g.box(0, 9, -l * .4, b * .75, .6, l * .23, trim);
    for (const sign of [-1, 1]) {
      for (let i = 0; i < s.guns / 2; i++) {
        const z = -l * .3 + i / (s.guns / 2 - 1) * l * .65;
        g.box(sign * b * .48, 4.5, z, 1.5, 1.4, 1.5, 0x172d2e);
        g.box(sign * b * .58, 5, z, 2.1, .65, .6, 0x383c39);
      }
      for (let i = 0; i < 6; i++) g.box(sign * b * .44, 6.6, -l * .29 + i * l * .11, .25, 1.4, .25, trim);
      if (fittings.hull) for (let i=0;i<3;i++) g.box(sign*b*.54,2.8,-l*.18+i*l*.15,.18,3,.6,0x97a69b);
    }
    const masts = cls === 'sloop' ? [[-.1 * l, 31], [.27 * l, 23]] : [[-.28 * l, 32], [.05 * l, 42], [.34 * l, 31]];
    for (const [z, h] of masts) {
      g.cone(0, 6, z, .6, h, 0x59452f, 6, .28);
      const widths = cls === 'sloop' ? [b * 1.5, b * 1.15] : [b * 1.65, b * 1.3];
      if(fittings.rig==='lateen'||fittings.rig==='galley'){
        const y=6+h*.91;g.beam([-b*.7,y,z-2],[b*.9,10,z+l*.21],.4,dark);if(!reef){g.tri([-b*.7,y-.7,z-1.5],[b*.9,11,z+l*.21],[-b*.6,10,z+l*.21],sail);if(!torn)g.tri([-b*.7,y-.7,z-1.5],[-b*.6,10,z+l*.21],[-b*.72,y*.6,z+2],sail);}
      }else for (let j = 0; j < 2; j++) {
        const top = 6 + h * (.91 - j * .38), height = h * .34 * (reef ? .27 : 1), width = widths[j];
        g.beam([-width / 2 - .6, top, z], [width / 2 + .6, top, z], .4, dark);
        const columns = 6, rows = 3;
        const p = (u, v) => [(u - .5) * width * (1 - v * .18), top - v * height, z + Math.sin(u * Math.PI) * Math.sin(v * Math.PI * .8) * 2.5 + .4];
        for (let a = 0; a < columns; a++) for (let r = 0; r < rows; r++) if (!torn || (a + r * 3) % 4 !== 1) g.quad(p(a / columns, r / rows), p((a + 1) / columns, r / rows), p((a + 1) / columns, (r + 1) / rows), p(a / columns, (r + 1) / rows), sail);
        if (faction === 'enemy') g.box(0, top - height * .65, z + 2.9, .6, height * .35, .04, 0xd7ad78);
      }
      for (const sign of [-1, 1]) { g.beam([0, h * .8, z], [b * sign * .5, 6, z - l * .13], .12, 0x554c3e); g.beam([0, h + 5, z], [b * sign * .42, 6, z + l * .2], .1, 0x554c3e); }
      g.quad([0, h + 5, z], [0, h + 8.5, z], [7, h + 7, z], [5, h + 4.5, z], faction==='enemy'?0x612e2b:fittings.flag?parseInt(fittings.flag.slice(1),16):0x1f6967);
    }
    if(fittings.rig==='galley')for(const sign of [-1,1])for(let i=0;i<10;i++)g.beam([sign*b*.4,3,-l*.3+i*l*.065],[sign*(b*.6+9),.2,-l*.3+i*l*.065-4],.25,0xb59b65);
    g.beam([0, 6, l * .5], [0, 12, l * .85], .45, trim);
    if (!reef) g.tri([0, 12, l * .8], [0, 29, l * .27], [0, 10, l * .26], sail);
    g.box(0, 7, -l * .23, 1.3, 1.5, 1.3, 0x855e37);
    return g;
  }
  function terrainGeometry(w) {
    const g = new Geometry();
    let seed = 412;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const island of w.islands) {
      const edge=C.landOutline(island),n=edge.length,radii=[0,.22,.48,.7,.89,1,1.08],heights=island.atoll?[-.1,-.08,-.03,.14,.15,.007,-.025]:[1,.8,.48,.19,.055,.007,-.025];
      const colors=w.palette.land;
      const point = (r,a) => {const p=edge[a%n];return [island.x+(p.x-island.x)*radii[r],island.h*heights[r]+(r>0&&r<4&&!island.atoll?Math.sin(a*2.4)*3:0),island.z+(p.z-island.z)*radii[r]];};
      const plantPoint=()=>{const k=Math.floor(rand()*n),a=edge[k],b=edge[(k+1)%n],t=rand(),r=island.atoll?.76+rand()*.1:.43+rand()*.39;return{x:island.x+((a.x+(b.x-a.x)*t)-island.x)*r,z:island.z+((a.z+(b.z-a.z)*t)-island.z)*r,y:island.atoll?island.h*.14+2:island.h*Math.max(.04,(1-r)**1.55)+3};};
      for (let j = 0; j < radii.length - 1; j++) for (let a = 0; a < n; a++) g.quad(point(j, a), point(j + 1, a), point(j + 1, a + 1), point(j, a + 1), colors[j]);
      // Palm silhouettes: bent trunk and five broad, angular fronds.
      for (let j = 0; j < (w.climate==='desert'?4:20); j++) {
        const a=rand()*C.TAU,{x,y,z}=plantPoint();
        const h = 12 + rand() * 10;
        g.beam([x, y, z], [x + 2, y + h, z - 1], 1.3, 0x786145);
        if(w.climate==='med'){g.cone(x,y+h*.5,z,5,h*.8,0x4d654d,7);continue;}
        for (let k = 0; k < 5; k++) { const b = k / 5 * C.TAU + a, dx = Math.cos(b), dz = Math.sin(b); g.tri([x + 2, y + h, z - 1], [x + 2 + dx * 6 - dz * 2.5, y + h + 1, z - 1 + dz * 6 + dx * 2.5], [x + 2 + dx * 14, y + h - 3, z - 1 + dz * 14], k % 2 ? 0x476747 : 0x557b49); }
      }
      for (let j = 0; j < 9; j++) {
        const {x,y,z}=plantPoint();g.sphere(x,y,z,8+rand()*12,0x899180,[1,1.25,.9],6,3);
      }
      if (island.port) {
        const portStart=g.data.length,side=island.portSide,rotation=side==='west'?Math.PI:side==='north'?Math.PI/2:0;
        const p={x:island.x+Math.abs(island.shoreOffset)+55,z:island.z},shore=island.x+Math.abs(island.shoreOffset)-12;
        g.box((p.x + shore) / 2, 1.5, p.z, p.x - shore + 10, 2, 13, 0x9c7950);
        for (let j = 0; j < 5; j++) { g.box(p.x - j * 13, -2, p.z - 6, 1, 5, 1, 0x665844); g.box(p.x - j * 13, -2, p.z + 6, 1, 5, 1, 0x665844); }
        for (let j = 0; j < 11; j++) {
          const x=shore-island.r*(.06+rand()*.18),z=island.z+(rand()-.5)*island.r*.6;
          const y = island.h * .075 + 3, h = 7 + rand() * 8;
          g.box(x, y, z, 10 + rand() * 7, h, 12, j % 3 ? 0xe1cd9f : 0xbdc2ac);
          const style=island.style||w.style;
          if(['malabar','gujarat','aceh'].includes(style))g.cone(x,y+h,z,11,style==='aceh'?9:5,style==='aceh'?0x66543c:0x9a5b43,4);
          else if(j%4===0)g.sphere(x,y+h,z,6,w.climate==='desert'?0xc4b58c:0x8aa397,[1,1.2,1],10,5);
          else g.box(x,y+h,z,13,.8,14,0xd5d2b0);
          g.box(x + 4, y + 3, z + 6.1, 2, 3, .1, 0x496467);
        }
        const tx=shore-15,tz=island.z-35;
        g.cone(tx, 2, tz, 8, 30, 0xd7d0af, 10, 6);
        g.cone(tx, 32, tz, 8, 6, 0x5b6d62, 8);
        g.box(tx, 26, tz + 6, 4, 4, .5, 0xedcd81);
        if(['ottoman','algiers','tunis','morocco','mamluk'].includes(island.patron)) {
          g.box(island.x + 20, island.h * .7, island.z, 48, 20, 40, 0x989a83);
          for (const x of [-20, 20]) for (const z of [-16, 16]) { g.cone(island.x + 20 + x, island.h * .7 + 12, island.z + z, 8, 19, 0xafad93, 8, 8); g.cone(island.x + 20 + x, island.h * .7 + 31, island.z + z, 10, 10, 0x6e6956, 8); }
        }
        if(rotation)for(let j=portStart;j<g.data.length;j+=9){const c=Math.cos(rotation),sn=Math.sin(rotation),x=g.data[j]-island.x,z=g.data[j+2]-island.z,nx=g.data[j+3],nz=g.data[j+5];g.data[j]=island.x+c*x+sn*z;g.data[j+2]=island.z-sn*x+c*z;g.data[j+3]=c*nx+sn*nz;g.data[j+5]=-sn*nx+c*nz;}
      }
    }
    return g;
  }
  const vertex = `precision mediump float;attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uVP;uniform mat4 uModel;uniform float uTime;uniform float uWater;uniform vec4 uSea;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vColor;void main(){vec4 world=uModel*vec4(aPosition,1.);if(uWater>.5)world.y+=sin(dot(world.xz,uSea.xy)*.043-uTime*1.7)*(.35+uSea.z*.025+uSea.w*1.1)+cos(world.x*.026-world.z*.031-uTime*.9)*(.35+uSea.z*.025+uSea.w*1.1)*.45;vWorld=world.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;gl_Position=uVP*world;}`;
  const fragment = `precision mediump float;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vColor;uniform float uTime;uniform float uWater;uniform float uAlpha;uniform vec3 uEye;uniform vec4 uIslands[12];uniform vec3 uTint;uniform vec3 uDeep;uniform vec3 uShallow;uniform vec3 uSky;uniform vec4 uSea;void main(){vec3 color;vec3 light=normalize(vec3(-.55,1.,.35));if(uWater>.5){float depth=1.;for(int i=0;i<12;i++){if(uIslands[i].z>.1){float d=length((vWorld.xz-uIslands[i].xy)/uIslands[i].zw);depth=min(depth,smoothstep(.85,1.95,d));}}float waves=sin(vWorld.x*.105+sin(vWorld.z*.09+uTime*.3)*1.4+uTime*.9)*sin(vWorld.z*.13-uTime*.65);float ripples=sin(vWorld.x*.28+vWorld.z*.17+uTime*1.2)*.5+.5;vec3 n=normalize(vec3(cos(vWorld.x*.075+uTime)*.13,1.,sin(vWorld.z*.08-uTime)*.17));vec3 view=normalize(uEye-vWorld);float spec=pow(max(dot(reflect(-light,n),view),0.),60.);color=mix(uShallow,uDeep,depth);float along=dot(vWorld.xz,uSea.xy),across=dot(vWorld.xz,vec2(uSea.y,-uSea.x));float crest=smoothstep(.94,1.,sin(along*.065-uTime*1.5+sin(across*.025)*1.2));float patches=smoothstep(.25,.8,sin(across*.07+uTime*.45))*smoothstep(.15,.65,sin(along*.009+uTime*.2));color=mix(color,vec3(.69,.82,.78),crest*patches*clamp((uSea.z-6.)*.012+uSea.w*.3,.02,.6));color+=waves*.016+smoothstep(.76,1.,ripples)*.019+spec*vec3(.34,.38,.29);float shore=(1.-smoothstep(0.,.13,abs(depth-.16)));color+=shore*(.07+.03*sin(uTime+vWorld.x*.2));}else{float diffuse=max(dot(normalize(vNormal),light),0.);diffuse=floor(diffuse*5.)/5.;color=vColor*(.57+diffuse*.46)*uTint;}float fog=1.-exp(-pow(length(vWorld-uEye)/1750.,2.));color=mix(color,uSky,min(fog,.9));gl_FragColor=vec4(color,uAlpha);}`;
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas; this.gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
      if (!this.gl) throw new Error('WebGL unavailable');
      const gl = this.gl;
      const shader = (type, source) => { const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
      this.program = gl.createProgram(); gl.attachShader(this.program, shader(gl.VERTEX_SHADER, vertex)); gl.attachShader(this.program, shader(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
      gl.useProgram(this.program); this.u = {};
      for (const name of ['VP', 'Model', 'Time', 'Water', 'Alpha', 'Eye','Islands','Tint','Deep','Shallow','Sky','Sea']) this.u[name] = gl.getUniformLocation(this.program, `u${name}${name === 'Islands' ? '[0]' : ''}`);
      this.attributes = ['Position', 'Normal', 'Color'].map(n => gl.getAttribLocation(this.program, `a${n}`));
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.worldId=null;this.land=null;
      const water = new Geometry(), size = 8000, n = 140;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = (i / n - .5) * size, z = (j / n - .5) * size, d = size / n; water.quad([x, -1, z], [x + d, -1, z], [x + d, -1, z + d], [x, -1, z + d], 0x167d86); }
      this.water = this.upload(water); this.shipMeshes = {};
      for (const cls of Object.keys(C.CLASSES)) for (const faction of ['player', 'enemy', 'friendly']) this.shipMeshes[`${cls}-${faction}`] = this.upload(shipGeometry(cls, faction));
      const ball = new Geometry(); ball.sphere(0, 0, 0, 1, 0x242d2b, [1, 1, 1], 6, 3); this.ball = this.upload(ball);
      const crate = new Geometry(); crate.box(0, 0, 0, 5, 4, 5, 0xad7c45); crate.box(0, 1.2, 0, 5.2, .55, 5.2, 0x4a5c50); crate.box(0, 3, 0, 5.2, .5, 5.2, 0xe0b868); this.crate = this.upload(crate);
      const chest = new Geometry(); chest.box(0, 0, 0, 6, 4, 4.4, 0x775134); chest.box(0, 3.7, 0, 6.2, 1, 4.6, 0xdbb65d); chest.box(0, 1.6, 2.3, 1.3, 1.7, .2, 0xf4d783); this.chest = this.upload(chest);
      const relic = new Geometry(); relic.cone(0,3,0,5,1.4,0xd9b666,16,5); for(let i=0;i<16;i++){const a=i/16*C.TAU,b=(i+1)/16*C.TAU;relic.tri([0,4.5,0],[Math.cos(a)*4.3,4.5,Math.sin(a)*4.3],[Math.cos(b)*4.3,4.5,Math.sin(b)*4.3],0x285b5d);} relic.tri([0,4.7,-3.7],[-1.4,4.7,0],[0,4.7,3.7],0xefdb9c);relic.tri([0,4.7,-3.7],[1.4,4.7,0],[0,4.7,3.7],0xc0a167); this.relic=this.upload(relic);
      const cloud = new Geometry(); for (let i = 0; i < 12; i++) cloud.sphere(Math.sin(i * 7) * 70, 105 + Math.sin(i * 3) * 12, Math.cos(i * 3) * 65, 39, 0x8d9e9b, [1.6, .45, 1.3], 8, 4); this.cloud = this.upload(cloud);
      const ring = new Geometry(); for (let i = 0; i < 40; i++) { const a = i / 40 * C.TAU, b = (i + .65) / 40 * C.TAU; ring.quad([Math.cos(a) * 19, .3, Math.sin(a) * 19], [Math.cos(b) * 19, .3, Math.sin(b) * 19], [Math.cos(b) * 20.5, .3, Math.sin(b) * 20.5], [Math.cos(a) * 20.5, .3, Math.sin(a) * 20.5], 0xe2cf87); } this.ring = this.upload(ring);
      this.dynamic = this.upload(new Geometry(), true); this.particles = []; this.wakes = []; this.yaw = .2; this.distance = 245; this.height = .86; this.follow = { x: -752, z: 477 }; this.eye = [0, 0, 0]; this.vp = identity(); this.lastWake = 0;
      this.resize();
    }
    upload(g, dynamic = false) { const gl = this.gl, buffer = gl.createBuffer(), array = new Float32Array(g.data); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, array, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return { buffer, count: array.length / 9 }; }
    resize() { const c = this.canvas, dpr = Math.min(root.devicePixelRatio || 1, 1.8); c.width = Math.floor(c.clientWidth * dpr); c.height = Math.floor(c.clientHeight * dpr); this.gl.viewport(0, 0, c.width, c.height); }
    draw(mesh, m = identity(), alpha = 1, water = 0, tint = [1, 1, 1]) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(this.attributes[i]); gl.vertexAttribPointer(this.attributes[i], 3, gl.FLOAT, false, 36, i * 12); }
      gl.uniformMatrix4fv(this.u.Model, false, m); gl.uniform1f(this.u.Alpha, alpha); gl.uniform1f(this.u.Water, water); gl.uniform3fv(this.u.Tint, tint); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
    emit(e) {
      if (!['hit','fire','splash','sink','collect','collision'].includes(e.type)) return;
      const count = e.type === 'sink' ? 26 : e.type === 'fire' ? 10 : 8;
      for (let i = 0; i < count; i++) this.particles.push({ x: e.x, y: e.type === 'fire' ? 6 : 2, z: e.z, vx: (Math.random() - .5) * (e.type === 'sink' ? 32 : 18), vz: (Math.random() - .5) * 20, vy: e.type === 'fire' ? 7 + Math.random() * 5 : 10 + Math.random() * 20, age: 0, life: .8 + Math.random() * .7, type: e.type });
    }
    project(x, y, z) {
      const m = this.vp, w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0) return null;
      const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      if (Math.abs(nx) > 1.15 || Math.abs(ny) > 1.15) return null;
      return { x: (nx * .5 + .5) * this.canvas.clientWidth, y: (-ny * .5 + .5) * this.canvas.clientHeight };
    }
    frame(s, dt, menu = false) {
      const w=C.world(s),localWind=C.windAt(s,s.player),storm=localWind.hazard;
      if(this.worldId!==s.worldId){if(this.land)this.gl.deleteBuffer(this.land.buffer);this.land=this.upload(terrainGeometry(w));this.worldId=s.worldId;this.follow={x:s.player.x,z:s.player.z};this.wakes=[];this.particles=[];}
      const gl = this.gl, t = s.time + (menu ? performance.now() / 1000 : 0), p = s.player;
      const k = 1 - Math.exp(-dt * 3);
      const ahead = menu ? 12 : 35;
      this.follow.x += (p.x + Math.sin(p.angle) * ahead - this.follow.x) * k;
      this.follow.z += (p.z + Math.cos(p.angle) * ahead - this.follow.z) * k;
      const yaw = menu ? .55 + Math.sin(t * .025) * .17 : this.yaw;
      const distance = menu ? 205 : this.distance;
      const target = [this.follow.x + (menu ? -45 : 0), 0, this.follow.z];
      this.eye = [target[0] + Math.sin(yaw) * distance, distance * (menu ? .65 : this.height), target[2] + Math.cos(yaw) * distance];
      this.vp = multiply(perspective(Math.PI / 4, this.canvas.width / this.canvas.height, 2, 6000), lookAt(this.eye, target));
      const sky=w.palette.sky.map(v=>v*(1-storm*.38));
      gl.clearColor(...sky,1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.u.VP, false, this.vp); gl.uniform1f(this.u.Time, t); gl.uniform3fv(this.u.Eye, this.eye); gl.uniform4fv(this.u.Islands,new Float32Array([...w.islands.flatMap(i=>{const p=C.landOutline(i),xs=p.map(p=>p.x),zs=p.map(p=>p.z),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);return[(x0+x1)/2,(z0+z1)/2,(x1-x0)/2,(z1-z0)/2];}),...Array((12-w.islands.length)*4).fill(0)]));gl.uniform3fv(this.u.Deep,w.palette.deep);gl.uniform3fv(this.u.Shallow,w.palette.shallow);gl.uniform3fv(this.u.Sky,sky);gl.uniform4fv(this.u.Sea,[Math.sin(s.wind.angle),Math.cos(s.wind.angle),localWind.strength,storm]);
      this.draw(this.water,identity(),1,1);this.draw(this.land,identity(),1,0,[1-storm*.25,1-storm*.21,1-storm*.17]);
      // Port mooring circles and the golden mission marker.
      for(const i of w.islands)if(i.port){const p=C.harborPoint(i,25);this.draw(this.ring,model(p.x,0,p.z,t*.035,1.6),.48);}
      const objective = C.objectivePosition(s);
      if (objective) { this.draw(this.ring, model(objective.x, .25, objective.z, -t * .2, .8 + Math.sin(t * 2) * .04), .85); }
      for (const l of s.loot) if (Math.hypot(l.x - p.x, l.z - p.z) < 1100) {
        this.draw(l.kind === 'relic' ? this.relic : l.kind === 'cargo' ? this.crate : this.chest, model(l.x, .3 + Math.sin(t * 1.7 + l.bob) * .7, l.z, l.bob + (l.kind === 'relic' ? t*.4 : Math.sin(t) * .05)));
        if (l.mission) this.draw(this.ring, model(l.x, 0, l.z, t * .15, .48), .75);
      }
      const allShips = [p, ...s.ships];
      for (const v of allShips) {
        if (Math.hypot(v.x - this.follow.x, v.z - this.follow.z) > 1600) continue;
        const faction = v.id === 'player' ? 'player' : v.friendly ? 'friendly' : 'enemy';
        const chop=C.windAt(s,v).hazard,roll=Math.sin(t*1.7+v.x*.04)*(.025+chop*.065);
        const tint = !menu && v.id === 'player' && v.invulnerable > 0 && Math.sin(t * 8) > .6 ? [1.3, 1.3, 1.15] : [1, 1, 1];
        const fittings=v.id==='player'?{...v.upgrades,livery:v.livery,rig:w.rig,flag:C.FACTIONS[v.patron]?.color}:{};
        const key = `${v.class}-${faction}${v.sail ? '' : '-reef'}${v.sails < 40 ? '-torn' : ''}${v.id==='player'?`-${v.livery}-${fittings.copper||0}-${fittings.hull||0}-${w.rig}-${v.patron}`:''}`;
        if (!this.shipMeshes[key]) this.shipMeshes[key] = this.upload(shipGeometry(v.class, faction, !v.sail, v.sails < 40, fittings));
        this.draw(this.shipMeshes[key], model(v.x,.65+C.seaHeight(s,v,t), v.z, v.angle, menu && v.id === 'player' ? 1.8 : 1, roll), 1, 0, tint);
        if (v.hull < C.maxHull(v) * .4 && Math.random() < dt * 5) this.particles.push({ x: v.x, y: 5, z: v.z, vx: 3, vz: -1, vy: 6, age: 0, life: 2, type: 'smoke' });
      }
      for (const shot of s.shots) if (shot.age >= 0) {
        const y = C.shotHeight(shot);
        this.draw(this.ball, model(shot.x, y, shot.z, 0, shot.ammo === 'chain' ? 1 : .75));
      }
      const fx = new Geometry();
      // Short, breaking wave ribbons appear in patches and travel with the wind.
      const dx=Math.sin(s.wind.angle),dz=Math.cos(s.wind.angle),rough=clampSea((localWind.strength-6)/24+storm*.5);
      const gx=Math.floor(p.x/95),gz=Math.floor(p.z/95);
      for(let ix=-5;ix<=5;ix++)for(let iz=-5;iz<=5;iz++){
        const x=(gx+ix)*95,z=(gz+iz)*95,seed=Math.sin((gx+ix)*127.1+(gz+iz)*311.7)*43758.5453,f=seed-Math.floor(seed);
        if(f>.22+rough*.38)continue;
        const age=((t+f*37)%11)/11,fade=Math.sin(Math.PI*clampSea((age-.2)/.55));if(age<.2||age>.75)continue;
        const cx=x+dx*age*65,cz=z+dz*age*65;if(C.islands(s).some(i=>C.landDistance({x:cx,z:cz},i)<12))continue;
        const span=20+f*34,color=w.palette.deep.map((v,j)=>v*(1-fade*.55)+[.75,.85,.79][j]*fade*.55);
        for(let j=0;j<9;j++){
          const a=(j/9-.5)*span,b=((j+1)/9-.5)*span;
          const point=(u,offset)=>{const bend=Math.cos(u/span*Math.PI)*3,xx=cx+dz*u+dx*(bend+offset),zz=cz-dx*u+dz*(bend+offset);return[xx,.65+C.seaHeight(s,{x:xx,z:zz},t)+fade*(.3+rough),zz];};
          fx.quad(point(a,0),point(b,0),point(b,1+rough*1.7),point(a,1+rough*1.7),color);
        }
      }
      for(const h of s.hazards||[])if(C.dist(h,p)<1100){
        if(h.kind==='reef'){

          for(let j=0;j<6;j++){const a=j*2.4+h.seed,r=h.r*(.15+j*.1),x=h.x+Math.sin(a)*r,z=h.z+Math.cos(a)*r;fx.sphere(x,-1,z,4+j%3,0x626f63,[1.6,.8,1],6,3);const phase=(t*.2+j*.17)%1,rr=7+phase*9;for(let k=0;k<10;k++){const a=k/10*C.TAU,b=(k+.7)/10*C.TAU;fx.quad([x+Math.sin(a)*rr,.6,z+Math.cos(a)*rr],[x+Math.sin(b)*rr,.6,z+Math.cos(b)*rr],[x+Math.sin(b)*(rr+1),.6,z+Math.cos(b)*(rr+1)],[x+Math.sin(a)*(rr+1),.6,z+Math.cos(a)*(rr+1)],0x96bfb0);}}
        }else for(let j=0;j<9;j++){
          const f=(t*.1+j/9)%1,a=j*2.4,x=h.x+Math.sin(a)*h.r*.65+Math.sin(h.angle)*(f-.5)*45,z=h.z+Math.cos(a)*h.r*.65+Math.cos(h.angle)*(f-.5)*45,d=Math.sin(h.angle),e=Math.cos(h.angle),y=.8+C.seaHeight(s,{x,z},t);
          fx.tri([x+d*8,y,z+e*8],[x-d*5+e*3,y,z-e*5-d*3],[x-d*5-e*3,y,z-e*5+d*3],0x6da49a);
        }
      }
      if(s.gate&&Math.hypot(s.gate.x-p.x,s.gate.z-p.z)<1500){
        const q=s.gate;
        for(let ring=0;ring<9;ring++)for(let j=0;j<56;j++){
          const r=ring*10,rr=r+10,a=j/56*C.TAU,b=(j+1)/56*C.TAU,f=ring/9;
          const point=(radius,angle)=>[q.x+Math.sin(angle)*radius,.7+radius*.01,q.z+Math.cos(angle)*radius];
          const color=w.palette.deep.map((v,i)=>v*(.35+f*.65)+(i===2?.025:0));
          fx.quad(point(r,a),point(rr,a),point(rr,b),point(r,b),color);
        }
        for(let arm=0;arm<5;arm++)for(let j=0;j<90;j++){
          const f=j/90,r=7+f*80,a=arm/5*C.TAU+f*8.5-t*.65,b=a+.075,rr=r+3.5+f*3;
          const col=j%13===0?0xe3d8ac:arm%2?0x61a9b2:0x8ac6c2;
          fx.quad([q.x+Math.sin(a)*r,1.8,q.z+Math.cos(a)*r],[q.x+Math.sin(b)*r,1.8,q.z+Math.cos(b)*r],[q.x+Math.sin(b)*rr,1.8,q.z+Math.cos(b)*rr],[q.x+Math.sin(a)*rr,1.8,q.z+Math.cos(a)*rr],col);
        }
        for(let j=0;j<18;j++){const a=j/18*C.TAU+t*.1,x=q.x+Math.sin(a)*87,z=q.z+Math.cos(a)*87,y=8+Math.sin(j+t*1.5)*3;fx.tri([x-1,y,z],[x+1,y,z],[x,y+5,z],0xe7d4a4);}
      }

      if (!menu && t - this.lastWake > .12) {
        for (const v of allShips) if (v.speed > 3 && Math.hypot(v.x - p.x, v.z - p.z) < 700) this.wakes.push({ x: v.x - Math.sin(v.angle) * C.CLASSES[v.class].length * .45, z: v.z - Math.cos(v.angle) * C.CLASSES[v.class].length * .45, a: v.angle, age: 0, width: C.CLASSES[v.class].beam * .75 });
        this.lastWake = t;
      }
      this.wakes = this.wakes.filter(w => w.age < 4.5).slice(-350);
      for (const w of this.wakes) {
        w.age += dt; const width = w.width + w.age * 3, alpha = (1 - w.age / 4.5), c = [.12 + .16 * alpha, .48 + .18 * alpha, .5 + .15 * alpha];
        for (const side of [-1, 1]) {
          const x = w.x + Math.cos(w.a) * width * side, z = w.z - Math.sin(w.a) * width * side;
          fx.tri([x, .1, z], [x - Math.cos(w.a) * side * 1.5, .1, z + Math.sin(w.a) * side * 1.5], [x - Math.sin(w.a) * 5, .1, z - Math.cos(w.a) * 5], c);
        }
      }
      for (const particle of this.particles) {
        particle.age += dt; particle.x += particle.vx * dt; particle.z += particle.vz * dt; particle.y += particle.vy * dt; particle.vy -= dt * 22;
        const f = 1 - particle.age / particle.life, sz = (particle.type === 'fire' ? 2.8 : 1.7) * Math.max(0, f);
        const col = particle.type === 'smoke' ? 0x667775 : particle.type === 'fire' ? (particle.age < .15 ? 0xf5cc7f : 0xabb8a8) : particle.type === 'hit' || particle.type === 'sink' ? 0xb08a59 : 0xc2dfcb;
        fx.tri([particle.x - sz, particle.y, particle.z], [particle.x + sz, particle.y, particle.z], [particle.x, particle.y + sz * 2, particle.z], col);
      }
      this.particles = this.particles.filter(p => p.age < p.life).slice(-350);
      // Rain streaks exist in world space, underneath the cloud canopy.
      for(const w of s.weather)if(Math.hypot(w.x-p.x,w.z-p.z)<1000){
        const power=C.stormPower(w);
        for(let i=0;i<Math.floor(125*power);i++){
          const a = i * 2.39996, r = Math.sqrt(i / 100) * w.r * .72, x = w.x + Math.sin(a) * r, z = w.z + Math.cos(a) * r, y = (i * 7.3 - t * 65) % 80 + 80;
          fx.beam([x, y % 80, z], [x - 1, y % 80 + 7, z], .18, 0xa7c5bd);
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamic.buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fx.data), gl.DYNAMIC_DRAW); this.dynamic.count = fx.data.length / 9; this.draw(this.dynamic);
      gl.depthMask(false);
      for(const w of s.weather){const power=C.stormPower(w),push=clampSea((w.r*1.4-C.dist(w,p))/w.r)*(w.r+140);/* Keep the nearby cloud bank beyond the ship so the camera can read the battle. */this.draw(this.cloud,model(w.x-Math.sin(yaw)*push,0,w.z-Math.cos(yaw)*push,w.angle||.2,w.r/240),.32*power,0,[1-power*.32,1-power*.28,1-power*.22]);}
      gl.depthMask(true);
    }
  }
  root.CorsairRenderer = Renderer;
})(globalThis);
