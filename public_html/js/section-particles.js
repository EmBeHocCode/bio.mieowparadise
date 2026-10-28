/* React Bits Particles — Copyright (c) 2026 David Haz, MIT.
 * Source commit: 482ab1cd3f567467a8dc9f49683bcefe54223e2c
 * Original WebGL2 shaders adapted to one shared field inside card surfaces.
 * See assets/vendor/react-bits/LICENSE.md and README.md.
 */
(() => {
'use strict';
const MAX_BURSTS = 4;
const DEPTH = 10;
const FOCAL = 1 / Math.tan((7.5 * Math.PI) / 180);
const NEAR = 0.1;
const FAR = 100;
const INTRO_SECONDS = 1.8;
const BURST_SECONDS = 1.5;
const BURST_SPEED = 520;
const BURST_WIDTH = 46;

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aPosition;
layout(location = 2) in vec4 aRandom;
layout(location = 3) in vec3 aColor;
uniform mat3 uRotation;
uniform vec3 uOffset;
uniform float uSpread;
uniform float uTime;
uniform float uCamera;
uniform float uAspect;
uniform vec2 uView;
uniform float uRatio;
uniform float uSize;
uniform float uRandomness;
uniform float uBlur;
uniform float uFocus;
uniform float uGlow;
uniform float uTwinkle;
uniform int uShape;
uniform int uDrift;
uniform float uTravel;
uniform vec4 uPointer;
uniform int uEffect;
uniform float uStrength;
uniform vec4 uBursts[${MAX_BURSTS}];
uniform int uBurstCount;
uniform float uReveal;
out vec2 vLocal;
out float vRadius;
out float vBlur;
out float vAlpha;
out float vHalo;
out float vSeed;
out vec3 vColor;

vec3 bob(vec4 r, float t) {
  return vec3(
    sin(t * r.z + 6.28 * r.w) * mix(0.1, 1.5, r.x),
    sin(t * r.y + 6.28 * r.x) * mix(0.1, 1.5, r.w),
    sin(t * r.w + 6.28 * r.y) * mix(0.1, 1.5, r.z)
  );
}

void main() {
  vec3 pos = aPosition * uSpread;
  pos.z *= ${DEPTH.toFixed(1)};
  vec3 wobble = bob(aRandom, uTime);
  vec3 world = uRotation * pos + uOffset + wobble;
  float edge = 1.0;
  if (uDrift == 1 || uDrift == 2) {
    float span = uSpread * 2.0 + 3.0;
    float k = mod(aRandom.w * span + uOffset.y + wobble.y + (uDrift == 1 ? uTravel : -uTravel), span);
    world.y = k - span * 0.5;
    edge = smoothstep(0.0, span * 0.12, k) * smoothstep(span, span * 0.88, k);
  } else if (uDrift == 3) {
    float span = uSpread * ${DEPTH.toFixed(1)} * 2.0 + 3.0;
    float k = mod(aRandom.y * span + uOffset.z + wobble.z + uTravel, span);
    world.z = k - span * 0.5;
    edge = smoothstep(0.0, span * 0.1, k);
  }
  vec3 view = world - vec3(0.0, 0.0, uCamera);
  float dist = length(view);
  float ahead = -view.z;
  if (ahead < ${NEAR.toFixed(2)} || ahead > ${FAR.toFixed(1)}) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  edge *= smoothstep(1.0, 4.0, ahead);
  vec2 ndc = vec2(view.x * ${FOCAL.toFixed(6)} / uAspect, view.y * ${FOCAL.toFixed(6)}) / ahead;
  vec2 screen = (ndc * 0.5 + 0.5) * uView;

  vec2 shift = vec2(0.0);
  float flash = 0.0;
  if (uEffect != 0 && uPointer.z > 0.001) {
    vec2 delta = screen - uPointer.xy;
    float reach = length(delta);
    float falloff = exp(-dot(delta, delta) / (uPointer.w * uPointer.w));
    vec2 away = reach > 0.001 ? delta / reach : vec2(0.0);
    shift += (uEffect == 1 ? away * uPointer.w * 0.5 : -delta * 0.6) * falloff * uStrength * uPointer.z;
  }
  for (int i = 0; i < ${MAX_BURSTS}; i++) {
    if (i >= uBurstCount) break;
    vec4 burst = uBursts[i];
    vec2 delta = screen - burst.xy;
    float reach = length(delta);
    float wave = exp(-pow((reach - burst.z * ${BURST_SPEED.toFixed(1)}) / ${BURST_WIDTH.toFixed(1)}, 2.0));
    vec2 away = reach > 0.001 ? delta / reach : vec2(0.0);
    float fade = (1.0 - burst.z) * (1.0 - burst.z) * burst.w;
    shift += away * wave * fade * 56.0 * smoothstep(0.0, 30.0, reach);
    flash += wave * fade;
  }
  screen += shift;

  float diameter = (uRandomness <= 0.0 ? uSize : uSize * (1.0 + uRandomness * (aRandom.x - 0.5)) / dist) * (1.0 + min(flash, 1.0) * 0.6);
  float device = diameter * uRatio;
  float radius = max(diameter, 1.0 / uRatio) * 0.5;
  float coverage = min(1.0, device * device);
  float blur = uBlur * max(uFocus - dist, 0.0) / max(dist, 1.0);
  float halo = uGlow > 0.0 ? radius * 2.5 + 2.0 : 0.0;
  float extent = radius * (uShape == 3 ? 1.6 : 1.0) + blur + halo + 1.5;

  float twinkle = 1.0 - uTwinkle * 0.6 * (0.5 + 0.5 * sin(uTime * (6.0 + aRandom.y * 14.0) + aRandom.w * 40.0));
  float far = smoothstep(${FAR.toFixed(1)}, ${(FAR * 0.9).toFixed(1)}, ahead);
  float focus = radius / (radius + blur);
  float reveal = clamp(uReveal * 1.6 - aRandom.z * 0.6, 0.0, 1.0);

  vLocal = aCorner * extent;
  vRadius = radius;
  vBlur = blur;
  vHalo = halo;
  vSeed = aRandom.y;
  vAlpha = min(1.0, coverage * twinkle * (1.0 + flash * 1.4)) * far * edge * max(focus, 0.35) * reveal * reveal;
  vColor = aColor;
  gl_Position = vec4((screen + aCorner * extent) / uView * 2.0 - 1.0, 0.0, 1.0);
}`;

const MAX_CARDS = 32;
const CARD_MASK = `
uniform vec2 uView;
uniform vec2 uBufferSize;
uniform vec4 uCardRects[${MAX_CARDS}];
uniform vec4 uCardClips[${MAX_CARDS}];
uniform vec4 uCardStyles[${MAX_CARDS}];
uniform int uCardCount;
vec2 viewportPoint() {
  vec2 pixel = gl_FragCoord.xy / uBufferSize * uView;
  return vec2(pixel.x, uView.y - pixel.y);
}
float cardCoverage(vec2 p, int i) {
  vec4 r = uCardRects[i];
  vec4 clip = uCardClips[i];
  if (p.x < clip.x || p.y < clip.y || p.x > clip.z || p.y > clip.w) return 0.0;
  vec2 halfSize = (r.zw - r.xy) * 0.5;
  float radius = min(uCardStyles[i].x, min(halfSize.x, halfSize.y));
  vec2 q = abs(p - (r.xy + r.zw) * 0.5) - halfSize + radius;
  float distance = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  return (1.0 - smoothstep(-0.8, 0.0, distance)) * uCardStyles[i].y;
}
float cardMask(vec2 p) {
  float coverage = 0.0;
  for (int i = 0; i < ${MAX_CARDS}; i++) {
    if (i >= uCardCount) break;
    coverage = max(coverage, cardCoverage(p, i));
  }
  return coverage;
}`;

// Opaque dark card surfaces separate the particle field from the ASCII plane.
// These are drawn by the same context; there is still only one particles canvas.
const SURFACE_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
${CARD_MASK}
out vec4 outColor;
void main() {
  vec2 p = viewportPoint();
  vec3 color = vec3(0.0);
  float coverage = 0.0;
  for (int i = 0; i < ${MAX_CARDS}; i++) {
    if (i >= uCardCount) break;
    float alpha = cardCoverage(p, i);
    if (alpha > coverage) {
      coverage = alpha;
      float t = clamp((p.y - uCardRects[i].y) / (uCardRects[i].w - uCardRects[i].y), 0.0, 1.0);
      color = mix(vec3(8.0), vec3(4.0), t) / 255.0;
    }
  }
  if (coverage < 0.002) discard;
  outColor = vec4(color * coverage, coverage);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform int uShape;
uniform float uGlow;
uniform float uRatio;
uniform float uTime;
uniform float uSoft;
uniform float uShimmer;
uniform float uOpacity;
${CARD_MASK}
in vec2 vLocal;
in float vRadius;
in float vBlur;
in float vAlpha;
in float vHalo;
in float vSeed;
in vec3 vColor;
out vec4 outColor;

float ray(vec2 q, float aa) {
  float width = 0.14 * max(0.0, 1.0 - q.x);
  return (1.0 - smoothstep(width - aa, width + aa, q.y)) * step(q.x, 1.0);
}

void main() {
  float mask = cardMask(viewportPoint());
  if (mask <= 0.0) discard;
  float soft = vBlur + 0.7 / uRatio + vRadius * uSoft;
  float d = length(vLocal);
  float shape;
  if (uShape == 1) {
    float box = max(abs(vLocal.x), abs(vLocal.y));
    shape = 1.0 - smoothstep(vRadius * 0.86 - soft, vRadius * 0.86 + soft, box);
  } else if (uShape == 2) {
    float edge = max(vRadius * 0.22, 0.6 / uRatio);
    shape = 1.0 - smoothstep(edge - soft, edge + soft, abs(d - vRadius * 0.8));
  } else if (uShape == 3) {
    float reach = vRadius * 1.6;
    vec2 q = abs(vLocal) / max(reach, 0.0001);
    float aa = soft / max(reach, 0.0001);
    shape = max(max(ray(q, aa), ray(q.yx, aa)), 1.0 - smoothstep(vRadius * 0.32 - soft, vRadius * 0.32 + soft, d));
  } else {
    shape = 1.0 - smoothstep(vRadius - soft, vRadius + soft, d);
  }
  float halo = vHalo > 0.0 ? exp(-d / (vHalo * 0.35)) * uGlow * 0.4 : 0.0;
  float alpha = clamp(shape + halo * (1.0 - shape), 0.0, 1.0) * vAlpha * uOpacity * (1.0 - uSoft) * mask;
  if (alpha < 0.002) discard;
  vec2 uv = vLocal / max(vRadius * 2.0, 0.0001) + 0.5;
  vec3 color = clamp(vColor + uShimmer * 0.2 * sin(uv.yxx + uTime + vSeed * 6.28), 0.0, 1.0);
  outColor = vec4(color * alpha, alpha);
}`;


const seeded = seed => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
function mount(container, canvas) {
  const gl = canvas.getContext('webgl2', {alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false});
  if (!gl) { container.dataset.renderer = 'unavailable'; return; }
  const shaders = [];
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader,source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader); throw new Error(message);
    }
    shaders.push(shader); return shader;
  }
  function link(vertex, fragment) {
    const program = gl.createProgram();
    try {
      gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
      gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch (error) { gl.deleteProgram(program); throw error; }
    finally { shaders.splice(0).forEach(shader => gl.deleteShader(shader)); }
    const uniforms = {};
    for (let i=0; i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS); i++) {
      const info=gl.getActiveUniform(program,i);
      uniforms[info.name.replace('[0]','')]=gl.getUniformLocation(program,info.name);
    }
    return { program, uniforms };
  }
  const dots = link(PARTICLE_VERTEX,PARTICLE_FRAGMENT);
  let surface;
  try { surface = link(SURFACE_VERTEX,SURFACE_FRAGMENT); }
  catch (error) { gl.deleteProgram(dots.program); throw error; }
  const program = dots.program, u = dots.uniforms;
  const surfaceVao = gl.createVertexArray();
  const vao=gl.createVertexArray(), buffers=[];
  gl.bindVertexArray(vao);
  function attribute(data,location,width,divisor) {
    const buffer=gl.createBuffer(); buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,width,gl.FLOAT,false,0,0);
    gl.vertexAttribDivisor(location,divisor);
  }
  attribute(new Float32Array([-1,-1,1,-1,-1,1,1,1]),0,2,0);
  const compact=matchMedia('(max-width: 767px)').matches;
  const weak=navigator.connection?.saveData || (navigator.hardwareConcurrency || 8)<=4;
  const count=weak ? 240 : compact ? 320 : 640;
  const positions=new Float32Array(count*3), randoms=new Float32Array(count*4), tints=new Float32Array(count*3);
  const colors=[[21/255,217/255,197/255],[1,1,1],[235/255,11/255,107/255]], next=seeded(1);
  for (let i=0;i<count;i++) {
    let x,y,z,len;
    do { x=next()*2-1; y=next()*2-1; z=next()*2-1; len=x*x+y*y+z*z; } while (len>1 || len===0);
    const r=Math.cbrt(next());
    positions.set([x*r,y*r,z*r],i*3);
    randoms.set([next(),next(),next(),next()],i*4);
    tints.set(colors[Math.floor(next()*colors.length)],i*3);
  }
  attribute(positions,1,3,1); attribute(randoms,2,4,1); attribute(tints,3,3,1);
  gl.bindVertexArray(null);
  const sections=[...document.querySelectorAll('[data-particles-section]')];
  const groups=sections.map(section => ({section,cards:[...section.querySelectorAll('.glass-card')]}));
  document.querySelectorAll('[data-particles-card]').forEach(card => {
    groups.push({section:card,cards:[card],standalone:true});
  });
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const rects=new Float32Array(MAX_CARDS*4), clips=new Float32Array(MAX_CARDS*4), styles=new Float32Array(MAX_CARDS*4);
  const rotation=new Float32Array(9), emptyBursts=new Float32Array(16);
  let width=1,height=1,ratio=1,raf=0,last=0,clock=0,spin=0,alive=true,lost=false;
  let nx=0,ny=0,offsetX=0,offsetY=0,frames=0,dirty=true,pendingReveal=false;
  const interval=1000/(compact || weak ? 24 : 30);
  function scope() {
    let n=0; const ids=[]; pendingReveal=false;
    if (!document.body.classList.contains('ui-hidden') && !document.body.classList.contains('bio-intro-active')) {
      for (const {section,cards,standalone} of groups) {
        if (section.classList.contains('is-collapsed')) continue;
        // Keep lazy section interiors skipped until the section enters the viewport.
        const sectionRect=section.getBoundingClientRect();
        if (sectionRect.bottom<=0 || sectionRect.top>=height) continue;
        const body=standalone ? section : section.querySelector(':scope > .section-collapse-body');
        if (!body) continue;
        const clip=body.getBoundingClientRect();
        const sectionOpacity=standalone ? 1 : Number(getComputedStyle(section).opacity)*Number(getComputedStyle(body).opacity);
        let visible=false;
        for (const card of cards) {
          if (n>=MAX_CARDS) break;
          const r=card.getBoundingClientRect();
          if (r.width<=0 || r.height<=1 || r.bottom<=0 || r.top>=height || r.right<=0 || r.left>=width) continue;
          const cardStyle=getComputedStyle(card);
          const opacity=sectionOpacity*Number(cardStyle.opacity);
          if (cardStyle.visibility==='hidden') continue;
          if (opacity<0.002) {
            // A visible card may still be at the first transparent frame of its
            // entrance transition. Keep sampling only until that reveal settles.
            pendingReveal ||= [card,section,body].some(element =>
              element.getAnimations().some(animation => animation.playState==='running'));
            continue;
          }
          const scale=r.width/Math.max(1,card.offsetWidth);
          const radius=(parseFloat(cardStyle.borderTopLeftRadius)||0)*scale;
          rects.set([r.left,r.top,r.right,r.bottom],n*4);
          clips.set([clip.left,clip.top,clip.right,clip.bottom],n*4);
          styles.set([radius,opacity,0,0],n*4);
          n++; visible=true;
        }
        if (visible) ids.push(section.id || section.dataset.particlesCard);
      }
    }
    container.dataset.activeSections=ids.join(','); container.dataset.active=String(n>0);
    container.dataset.activeCards=String(n);
    return n;
  }
  function maskUniforms(uniforms,n) {
    gl.uniform2f(uniforms.uView,width,height);
    gl.uniform2f(uniforms.uBufferSize,canvas.width,canvas.height);
    gl.uniform4fv(uniforms.uCardRects,rects);
    gl.uniform4fv(uniforms.uCardClips,clips);
    gl.uniform4fv(uniforms.uCardStyles,styles);
    gl.uniform1i(uniforms.uCardCount,n);
  }
  function draw(n) {
    gl.viewport(0,0,canvas.width,canvas.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!n) return;
    const x=Math.sin(clock*.2)*.1, y=Math.cos(clock*.5)*.15;
    const [sx,cx,sy,cy,sz,cz]=[Math.sin(x),Math.cos(x),Math.sin(y),Math.cos(y),Math.sin(spin),Math.cos(spin)];
    rotation.set([cy*cz+sy*sx*sz,cx*sz,-sy*cz+cy*sx*sz,-cy*sz+sy*sx*cz,cx*cz,sy*sz+cy*sx*cz,sy*cx,-sx,cy*cx]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(surface.program); gl.bindVertexArray(surfaceVao);
    maskUniforms(surface.uniforms,n);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.useProgram(program); gl.bindVertexArray(vao);
    gl.uniformMatrix3fv(u.uRotation,false,rotation); gl.uniform3f(u.uOffset,offsetX,offsetY,0);
    gl.uniform1f(u.uSpread,13.5); gl.uniform1f(u.uTime,clock); gl.uniform1f(u.uCamera,38);
    gl.uniform1f(u.uAspect,width/height); gl.uniform2f(u.uView,width,height); gl.uniform1f(u.uRatio,ratio);
    gl.uniform1f(u.uSize,115); gl.uniform1f(u.uRandomness,.8); gl.uniform1f(u.uBlur,0); gl.uniform1f(u.uFocus,52);
    gl.uniform1f(u.uGlow,.3); gl.uniform1f(u.uTwinkle,.2); gl.uniform1i(u.uShape,0); gl.uniform1i(u.uDrift,0);
    gl.uniform1f(u.uTravel,0); gl.uniform4f(u.uPointer,0,0,0,140); gl.uniform1i(u.uEffect,0); gl.uniform1f(u.uStrength,.22);
    gl.uniform4fv(u.uBursts,emptyBursts); gl.uniform1i(u.uBurstCount,0); gl.uniform1f(u.uReveal,1);
    gl.uniform1f(u.uSoft,.12); gl.uniform1f(u.uShimmer,.4); gl.uniform1f(u.uOpacity,.58);
    maskUniforms(u,n);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,count); gl.bindVertexArray(null);
    container.dataset.frames=String(++frames);
  }
  function frame(now) {
    raf=0;
    if (!alive || lost || document.hidden) return;
    if (last && !dirty && now-last<interval) { raf=requestAnimationFrame(frame); return; }
    dirty=false;
    const dt=last ? Math.min((now-last)/1000,.08) : 1/30; last=now;
    const n=scope();
    if (!motion.matches) {
      clock+=dt*.17; spin+=dt*.17*.6;
      const follow=1-Math.exp(-dt/.35);
      offsetX+=(-nx*.22-offsetX)*follow; offsetY+=(-ny*.22-offsetY)*follow;
    } else { offsetX=offsetY=0; }
    draw(n);
    if (pendingReveal || (n && !motion.matches)) raf=requestAnimationFrame(frame); else last=0;
  }
  function wake() { if (alive && !lost && !document.hidden && !raf) raf=requestAnimationFrame(frame); }
  // Track scrolling card surfaces at the next paint, even between particle frames.
  function invalidate() { dirty=true; wake(); }
  function resize() {
    width=Math.max(1,container.clientWidth); height=Math.max(1,container.clientHeight);
    ratio=Math.min(devicePixelRatio || 1,compact || weak ? 1.25 : 1.5);
    canvas.width=Math.max(1,Math.round(width*ratio)); canvas.height=Math.max(1,Math.round(height*ratio));
    ratio=canvas.width/width; last=0; invalidate();
  }
  function pointer(event) {
    if (motion.matches || event.pointerType==='touch') return;
    nx=Math.max(-1,Math.min(1,event.clientX/width*2-1)); ny=Math.max(-1,Math.min(1,1-event.clientY/height*2));
    // Pointer input must not wake particles outside their sections.
  }
  function leave() { nx=ny=0; }
  function visibility() { cancelAnimationFrame(raf); raf=0; last=0; wake(); }
  function onMotion() { last=0; wake(); }
  function onLost(event) {
    event.preventDefault(); lost=true; cancelAnimationFrame(raf); raf=0; container.dataset.renderer='context-lost';
    document.body.classList.remove('particles-cards-ready');
  }
  const sizes=new ResizeObserver(invalidate);
  groups.forEach(({section,cards})=>{ sizes.observe(section); cards.forEach(card=>sizes.observe(card)); });
  const viewport=new ResizeObserver(resize); viewport.observe(container);
  const changes=new MutationObserver(invalidate);
  groups.forEach(({section})=>changes.observe(section,{attributes:true,attributeFilter:['class']}));
  changes.observe(document.body,{attributes:true,attributeFilter:['class']});
  const intersect=new IntersectionObserver(invalidate); groups.forEach(({section})=>intersect.observe(section));
  window.addEventListener('scroll',invalidate,{passive:true}); window.addEventListener('resize',resize,{passive:true});
  window.visualViewport?.addEventListener('resize',resize,{passive:true});
  window.addEventListener('pointermove',pointer,{passive:true,capture:true}); window.addEventListener('blur',leave);
  document.documentElement.addEventListener('pointerleave',leave); document.addEventListener('visibilitychange',visibility);
  motion.addEventListener('change',onMotion); canvas.addEventListener('webglcontextlost',onLost);
  container.dataset.renderer='webgl2'; container.dataset.particleCount=String(count);
  document.body.classList.add('particles-cards-ready'); resize();
  return () => {
    alive=false; cancelAnimationFrame(raf); sizes.disconnect(); viewport.disconnect(); changes.disconnect(); intersect.disconnect();
    window.removeEventListener('scroll',invalidate); window.removeEventListener('resize',resize);
    window.visualViewport?.removeEventListener('resize',resize); window.removeEventListener('pointermove',pointer,true);
    window.removeEventListener('blur',leave); document.documentElement.removeEventListener('pointerleave',leave);
    document.removeEventListener('visibilitychange',visibility); motion.removeEventListener('change',onMotion);
    canvas.removeEventListener('webglcontextlost',onLost);
    buffers.forEach(buffer=>gl.deleteBuffer(buffer)); gl.deleteVertexArray(vao); gl.deleteVertexArray(surfaceVao); gl.deleteProgram(program); gl.deleteProgram(surface.program);
    container.dataset.active='false';
    document.body.classList.remove('particles-cards-ready');
  };
}
const container=document.getElementById('section-particles');
if (!container) return;
let dispose=null;
function start() {
  if (dispose) return;
  try { dispose=mount(container,container.querySelector('canvas')) || (()=>{}); }
  catch(error) { container.dataset.renderer='unavailable'; console.warn('Section Particles could not start.',error); }
}
window.addEventListener('pagehide',()=>{ dispose?.(); dispose=null; });
window.addEventListener('pageshow',start);
container.querySelector('canvas').addEventListener('webglcontextrestored',()=>{ dispose?.(); dispose=null; start(); });
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
