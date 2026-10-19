/* GLSL ES translation of WindowRainDrops.shader and WindowRainComposite.shader.
   Three water passes: max-composited spherical height, drying film, travelled film.
   Composite reads the current scene, with the engine's linear-light optics. */
(function(W){
'use strict';
const fullVertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){uv=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(uv*2.-1.,0,1);}`;
const dropVertex=`#version 300 es
precision highp float;
layout(location=0) in vec4 shape;
layout(location=1) in vec4 motion;
layout(location=2) in vec4 merge;
layout(location=3) in vec4 surface;
uniform vec2 grid;
out vec2 local;
flat out vec2 dimensions;
flat out vec4 absorbed;
flat out vec2 skin;
const vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(1,1),vec2(-1,-1),vec2(1,1),vec2(-1,1));
void main(){
 float radius=max(shape.z,.3);
 vec2 forward=normalize(motion.xy+vec2(0,-.0001)),side=vec2(-forward.y,forward.x);
 vec2 other=vec2(dot(merge.xy,side),dot(merge.xy,forward));
 float margin=radius*.3+merge.w+.75;
 vec2 lo=vec2(-radius,-radius*shape.w)-margin,hi=vec2(radius)+margin;
 if(merge.z>.01){lo=min(lo,other-merge.z-margin);hi=max(hi,other+merge.z+margin);}
 local=mix(lo,hi,corners[gl_VertexID]*.5+.5);
 vec2 pixel=shape.xy+forward*local.y+side*local.x;
 gl_Position=vec4(pixel/grid*2.-1.,0,1);
 dimensions=vec2(radius,shape.w);absorbed=vec4(other,merge.zw);skin=surface.xy;
}`;
const dropFragment=`#version 300 es
precision highp float;
in vec2 local;
flat in vec2 dimensions;
flat in vec4 absorbed;
flat in vec2 skin;
uniform float rainTime;
out vec4 result;
void main(){
 float along=local.y/dimensions.x;
 float tail=clamp(-along/max(1.,dimensions.y),0.,1.);
 float phase=skin.x,pulse=sin(rainTime*3.1+phase);
 float bend=(sin(tail*4.6+phase+rainTime*2.3)-sin(phase+rainTime*2.3))*tail*skin.y;
 float width=mix(1.,.58,tail)*(1.+skin.y*(.4*pulse+.6*sin(along*3.2+phase+rainTime*1.8)));
 if(along<0.)along/=dimensions.y;
 float across=(local.x/dimensions.x-bend)/max(.25,width);
 float distance=(length(vec2(across,along))-1.)*dimensions.x;
 if(absorbed.z>.01){float other=length(local-absorbed.xy)-absorbed.z,neck=max(absorbed.w,.001);float blend=clamp(.5+.5*(other-distance)/neck,0.,1.);distance=mix(other,distance,blend)-neck*blend*(1.-blend);}
 if(distance>=0.)discard;
 float radius=max(dimensions.x,absorbed.z),cap=clamp(1.+distance/radius,0.,1.);
 result=vec4(sqrt(1.-cap*cap)*radius,1,0,0);
}`;
const trailVertex=`#version 300 es
precision highp float;
layout(location=0) in vec4 shape;
layout(location=1) in vec4 motion;
layout(location=3) in vec4 surface;
uniform vec2 grid;
uniform float rainTime;
out vec2 local;
const vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(1,1),vec2(-1,-1),vec2(1,1),vec2(-1,1));
void main(){
 vec2 delta=shape.xy-motion.zw;float len=length(delta);
 local=corners[gl_VertexID];
 if(len<.001){gl_Position=vec4(2,2,0,1);return;}
 vec2 forward=delta/len,side=vec2(-forward.y,forward.x);
 float width=max(.65,shape.z*.32)*(.92+.08*sin(surface.x+rainTime*2.3));
 vec2 pixel=mix(motion.zw,shape.xy,local.y*.5+.5)+side*local.x*width;
 gl_Position=vec4(pixel/grid*2.-1.,0,1);
}`;
const trailFragment=`#version 300 es
precision highp float;
in vec2 local;
out vec4 result;
void main(){result=vec4(sqrt(clamp(1.-local.x*local.x,0.,1.)),0,0,0);}`;
const fadeFragment=`#version 300 es
precision highp float;
uniform float fade;
out vec4 result;
void main(){result=vec4(fade);}`;
const compositeFragment=`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D sceneTexture;
uniform sampler2D waterTexture;
uniform sampler2D trailTexture;
uniform vec2 grid;
uniform vec4 optics;
uniform vec2 style;
uniform float trailStrength;
out vec4 result;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 displayColor(vec3 c){c=max(c,vec3(0));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float Height(vec2 p){return texture(waterTexture,p).r;}
vec3 Scene(vec2 p){return linearColor(texture(sceneTexture,clamp(p,0.,1.)).rgb);}
void main(){
 vec4 raw=texture(sceneTexture,uv);result=raw;
 if(style.x<=0.)return;
 vec2 texel=1./grid,shadingGrid=max(round(grid/max(1.,style.y)),vec2(1));
 vec2 cell=(floor(uv*shadingGrid)+.5)/shadingGrid;
 float h=Height(cell),trail=texture(trailTexture,cell).r;
 if(h<=.02&&trail<.02)return;
 vec3 scene=linearColor(raw.rgb),color=scene;
 if(h>.02){
  vec2 slope=vec2(Height(cell+vec2(texel.x,0))-Height(cell-vec2(texel.x,0)),Height(cell+vec2(0,texel.y))-Height(cell-vec2(0,texel.y)))*.5;
  vec3 normal=normalize(vec3(-slope*1.2,1));
  float edge=1.-normal.z,size=clamp(h/3.,0.,1.);
  vec2 offset=-normal.xy*optics.x*vec2(grid.y/grid.x,1)*(.35+.65*size),base=cell+offset;
  float spread=optics.y*smoothstep(.2,.7,edge);
  vec2 direction=normalize(normal.xy+vec2(.00001,0))*texel*spread;
  vec3 refracted=vec3(Scene(base+direction).r,Scene(base).g,Scene(base-direction).b);
  vec2 light=normalize(vec2(-.55,.85));
  float facing=dot(normalize(normal.xy+vec2(.00001,0)),light),rim=smoothstep(.08,.55,edge);
  refracted*=1.-optics.w*rim*clamp(-facing,0.,1.)*.65;
  float spec=smoothstep(.94,.995,dot(normal,normalize(vec3(-.35,.55,.75))))*smoothstep(.8,1.8,h);
  float reflection=rim*(.12+.5*clamp(facing,0.,1.))+spec*.55;
  refracted+=reflection*optics.z*(1.-clamp(refracted,0.,1.));color=refracted;
 }else{
  float t=clamp(trail,0.,1.)*trailStrength;
  vec2 slope=vec2(texture(trailTexture,cell+vec2(texel.x,0)).r-texture(trailTexture,cell-vec2(texel.x,0)).r,texture(trailTexture,cell+vec2(0,texel.y)).r-texture(trailTexture,cell-vec2(0,texel.y)).r);
  vec3 film=Scene(cell-slope*texel*2.2)*.96;
  film+=clamp(dot(slope,vec2(-.55,.85)),0.,1.)*.1;
  color=mix(color,film,t*.85);
 }
 result=vec4(displayColor(mix(scene,color,clamp(style.x,0.,1.))),raw.a);
}`;
const defaults=Object.freeze({strength:.45,shadingPixelSize:1,refraction:.045,dispersion:.65,highlight:.45,rimShadow:.3,trailStrength:.5,trailLifetime:2.5});
class Renderer{
 constructor(){
  this.canvas=document.createElement('canvas');const gl=this.gl=this.canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,depth:false,stencil:false});
  if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('Window rain requires WebGL2 float render targets');
  this.lost=false;this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
  this.drop=this.program(dropVertex,dropFragment);this.trail=this.program(trailVertex,trailFragment);this.fade=this.program(fullVertex,fadeFragment);this.composite=this.program(fullVertex,compositeFragment);
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(let i=0;i<4;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,4,gl.FLOAT,false,64,i*16);gl.vertexAttribDivisor(i,1);}
  this.empty=gl.createVertexArray();this.source=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.source);this.parameters(gl.NEAREST);
  this.resize(480,270);
 }
 program(vs,fs){const gl=this.gl,p=gl.createProgram();for(const [type,source]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return {p,u:new Map()};}
 uniform(p,name){if(!p.u.has(name))p.u.set(name,this.gl.getUniformLocation(p.p,name));return p.u.get(name);}
 parameters(filter){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);}
 target(filter){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);this.parameters(filter);g.texImage2D(g.TEXTURE_2D,0,g.R16F,this.width,this.height,0,g.RED,g.HALF_FLOAT,null);const f=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,f);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Incomplete window rain target');return {t,f};}
 resize(w,h){w=Math.round(w);h=Math.round(h);if(w===this.width&&h===this.height)return;const g=this.gl;for(const target of[this.water,this.film])if(target){g.deleteTexture(target.t);g.deleteFramebuffer(target.f);}this.width=w;this.height=h;this.water=this.target(g.LINEAR);this.film=this.target(g.NEAREST);this.clear();}
 clear(){const g=this.gl;g.clearColor(0,0,0,0);for(const target of[this.water,this.film]){g.bindFramebuffer(g.FRAMEBUFFER,target.f);g.clear(g.COLOR_BUFFER_BIT);}}
 maps(sim,dt,options={}){
  const g=this.gl;this.resize(sim.width,sim.height);const data=sim.upload(),count=data.length/16;
  g.bindVertexArray(this.vao);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.bufferData(g.ARRAY_BUFFER,data,g.DYNAMIC_DRAW);g.viewport(0,0,this.width,this.height);g.enable(g.BLEND);g.blendEquation(g.MAX);g.blendFunc(g.ONE,g.ONE);
  g.bindFramebuffer(g.FRAMEBUFFER,this.water.f);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.useProgram(this.drop.p);g.uniform2f(this.uniform(this.drop,'grid'),this.width,this.height);g.uniform1f(this.uniform(this.drop,'rainTime'),sim.time);g.drawArraysInstanced(g.TRIANGLES,0,6,count);
  g.bindFramebuffer(g.FRAMEBUFFER,this.film.f);g.blendEquation(g.FUNC_ADD);g.blendFunc(g.DST_COLOR,g.ZERO);g.bindVertexArray(this.empty);g.useProgram(this.fade.p);g.uniform1f(this.uniform(this.fade,'fade'),dt>0?Math.exp(-dt/(options.trailLifetime??defaults.trailLifetime)):1);g.drawArrays(g.TRIANGLES,0,3);
  g.blendEquation(g.MAX);g.blendFunc(g.ONE,g.ONE);g.bindVertexArray(this.vao);g.useProgram(this.trail.p);g.uniform2f(this.uniform(this.trail,'grid'),this.width,this.height);g.uniform1f(this.uniform(this.trail,'rainTime'),sim.time);g.drawArraysInstanced(g.TRIANGLES,0,6,count);g.disable(g.BLEND);
 }
 render(source,options={}){
  const g=this.gl,o={...defaults,...options};if(this.lost)return null;
  if(this.canvas.width!==source.width||this.canvas.height!==source.height){this.canvas.width=source.width;this.canvas.height=source.height;}
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);g.disable(g.BLEND);g.bindVertexArray(this.empty);g.useProgram(this.composite.p);
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.source);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);
  for(const [unit,name,texture]of[[0,'sceneTexture',this.source],[1,'waterTexture',this.water.t],[2,'trailTexture',this.film.t]]){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);g.uniform1i(this.uniform(this.composite,name),unit);}
  g.uniform2f(this.uniform(this.composite,'grid'),this.width,this.height);g.uniform4f(this.uniform(this.composite,'optics'),o.refraction,o.dispersion,o.highlight,o.rimShadow);g.uniform2f(this.uniform(this.composite,'style'),o.strength,o.shadingPixelSize);g.uniform1f(this.uniform(this.composite,'trailStrength'),o.trailStrength);g.drawArrays(g.TRIANGLES,0,3);return this.canvas;
 }
 dispose(){const g=this.gl;for(const p of[this.drop,this.trail,this.fade,this.composite])g.deleteProgram(p.p);for(const t of[this.water,this.film]){g.deleteFramebuffer(t.f);g.deleteTexture(t.t);}g.deleteTexture(this.source);g.deleteBuffer(this.buffer);g.deleteVertexArray(this.vao);g.deleteVertexArray(this.empty);}
}
W.LunaRainRenderer={Renderer,defaults};
})(window);
