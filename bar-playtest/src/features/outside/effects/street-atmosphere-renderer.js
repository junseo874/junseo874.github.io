/* Unity SH_OutsidePuddle / SH_OutsideFog ports. World coordinates and native
 * pixels are invariant under camera movement. One reusable WebGL context. */
(function(W){'use strict';
const vertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){uv=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(uv*2.-1.,0,1);}`;
const common=`#version 300 es
precision highp float;
in vec2 uv;
out vec4 result;
uniform sampler2D scene;
uniform vec3 camera;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 displayColor(vec3 c){return mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec2 worldAt(vec2 p){return camera.xy+(p-.5)*vec2(camera.z,camera.z*720./1280.);}
vec2 screenAt(vec2 p){return .5+(p-camera.xy)/vec2(camera.z,camera.z*720./1280.);}
vec3 sampleScene(vec2 p){return linearColor(texture(scene,clamp(p,0.,1.)).rgb);}
`;
const fog=common+`
uniform vec4 area,density,noise,style;
uniform vec3 fogColor;
uniform float time;
float Hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float ValueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(Hash(i),Hash(i+vec2(1,0)),f.x),mix(Hash(i+vec2(0,1)),Hash(i+1.),f.x),f.y);}
void main(){
 vec3 original=sampleScene(uv);vec2 world=(floor(worldAt(uv)*noise.w)+.5)/noise.w;
 vec2 local=(world-area.xy)/area.zw+.5;
 float h=clamp((world.y-density.y)/density.z,0.,1.),d=pow(1.-h,density.w);
 vec2 p=world/noise.x;float drift=time*noise.z;
 float clouds=ValueNoise(p+vec2(drift,0))*.6+ValueNoise(p*2.3+vec2(-drift*1.7,drift*.3))*.4;
 d*=mix(1.,clamp(clouds*1.6-.2,0.,1.),noise.y);
 d*=smoothstep(0.,style.z,local.x)*smoothstep(0.,style.z,1.-local.x)*smoothstep(0.,style.z,1.-local.y)*step(0.,local.y);
 float alpha=clamp(d*density.x,0.,1.);if(style.y>.5)alpha=floor(alpha*style.y+.5)/style.y;
 // LDR web city light is already baked into the scene. Subtle local light
 // pickup substitutes URP's unavailable ShapeLight texture without white haze.
 vec3 lit=fogColor*mix(vec3(1),clamp(original*2.,.35,1.5),style.x);
 result=vec4(displayColor(mix(original,lit,alpha)),1);
}`;
const puddle=common+`
uniform sampler2D reflection;
uniform vec4 area,surface,shape;
uniform vec4 ripples[16];
uniform vec3 waterColor,tint;
uniform float distortion,rippleSpeed;
float Pool(vec2 p,vec2 c,vec2 r){return length((p-c)/r)-1.;}
float Outline(vec2 p){
 float phase=shape.y*.73;p.y+=sin(p.x*5.5+phase)*.1;float d;
 if(shape.x<.5){d=Pool(p,vec2(-.14,.06),vec2(.77,.67));d=min(d,Pool(p,vec2(.46,-.16),vec2(.43,.49)));}
 else if(shape.x<1.5){d=min(Pool(p,vec2(-.44,.15),vec2(.48,.68)),Pool(p,vec2(.39,-.18),vec2(.5,.64)));d=min(d,Pool(p,vec2(0),vec2(.55,.25)));}
 else if(shape.x<2.5){d=Pool(p,vec2(0,.02),vec2(.91,.78));d=max(d,-Pool(p,vec2(.2,.6),vec2(.62,.7)));}
 else{float path=.2*sin(p.x*3.5+phase);d=Pool(p,vec2(0,path),vec2(.95,.29));d=min(d,Pool(p,vec2(-.45,-.2),vec2(.31,.56)));d=min(d,Pool(p,vec2(.6,.16),vec2(.3,.42)));}
 return d+shape.z*(.16*sin(p.x*29.+phase+sin(p.y*12.))+.08*sin(p.y*31.+phase));
}
void main(){
 float ppu=surface.z;vec2 local=(worldAt(uv)-area.xy)/area.zw+.5;
 if(any(lessThan(local,vec2(0)))||any(greaterThan(local,vec2(1))))discard;
 local=(floor(local*area.zw*ppu)+.5)/(area.zw*ppu);
 float mask=1.-smoothstep(-.08,.025,Outline((local-.5)*2.));if(mask<.005)discard;
 vec2 offset=vec2(0);float glint=0.,trough=0.,impact=0.;
 for(int i=0;i<16;i++){
  float age=ripples[i].z;vec2 delta=(local-ripples[i].xy)*area.zw;delta.y*=2.7;
  float distance=length(delta),radius=age*rippleSpeed*ripples[i].w;
  float life=pow(clamp(1.-age/1.25,0.,1.),1.4)*step(0.,age);
  float ring=(1.-smoothstep(.45,1.25,abs(distance-radius)*ppu))*life;
  float inner=(1.-smoothstep(.4,1.1,abs(distance-radius*.62)*ppu))*life*smoothstep(.12,.3,age);
  offset+=delta/max(distance,.001)*(ring-inner*.4);glint+=ring+inner*.55;
  trough+=(1.-smoothstep(.3,1.2,abs(distance-radius-1.4/ppu)*ppu))*life;
  impact+=(1.-smoothstep(.6,1.8,distance*ppu))*clamp(1.-age/.16,0.,1.)*step(0.,age);
 }
 vec2 reflected=area.xy+(local-.5)*area.zw;
 reflected.y=surface.x+(surface.x-reflected.y)/surface.y;
 reflected+=offset*(distortion/ppu);reflected.y=max(reflected.y,surface.x+.5/ppu);
 float span=max(0.,1./surface.y-1.)/ppu,valid=0.;vec3 color=vec3(0);
 for(int t=0;t<4;t++){
  vec2 sampleUV=screenAt(reflected+vec2(0,span*(float(t)/3.-.5)));
  float edge=min(min(sampleUV.x,sampleUV.y),min(1.-sampleUV.x,1.-sampleUV.y));
  valid+=smoothstep(0.,.025,edge)*.25;color+=linearColor(texture(reflection,clamp(sampleUV,0.,1.)).rgb)*.25;
 }
 color=mix(waterColor,color*tint,valid*.9);color*=1.-clamp(trough,0.,1.)*.3;
 float highlight=clamp(glint+impact*1.4,0.,1.);color+=highlight*shape.w*vec3(.64,.78,.86);
 float alpha=mask*clamp(surface.w+highlight*.3,0.,1.);
 // Composite against the untouched road in linear space, with opaque output.
 result=vec4(displayColor(mix(sampleScene(uv),color,alpha)),1);
}`;
const shaftVertex=`#version 300 es
precision highp float;
uniform vec3 camera;
uniform vec2 corners[4];
out vec2 uv,shaftUV;
const int indices[6]=int[6](0,2,1,1,2,3);
void main(){int n=indices[gl_VertexID];shaftUV=vec2(n%2,n/2);uv=.5+(corners[n]-camera.xy)/vec2(camera.z,camera.z*720./1280.);gl_Position=vec4(uv*2.-1.,0,1);}`;
const shaft=common+`
in vec2 shaftUV;
uniform vec4 shape,motion,fade;
uniform vec3 color;
uniform float time;
float Hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
 float across=abs(shaftUV.x-.5)*2.,along=shaftUV.y;
 float edge=(1.-smoothstep(1.-shape.y,1.,across))*mix(1.,1.-across*across,.5);
 float body=pow(clamp(1.-along,0.,1.),shape.x)*smoothstep(0.,max(.001,fade.x),along);
 float t=time*motion.x,rays=.5+.5*sin(shaftUV.x*shape.w*6.2832+t+sin(shaftUV.x*13.1-t*.7)*1.3);
 float glow=edge*body*mix(1.,rays,shape.z);glow*=1.-fade.y*(.5+.5*sin(time*23.)*sin(time*7.3));
 if(fade.z>.5)glow=floor(glow*fade.z+.5)/fade.z;
 vec2 cell=floor(worldAt(uv)*motion.w+vec2(0,time*motion.z*motion.w));
 float dust=step(1.-motion.y*.03,Hash(cell))*edge*sqrt(body);
 result=vec4(displayColor(sampleScene(uv)+color*(glow+dust*1.5)),1);
}`;
const extract=common+`
uniform float threshold;
uniform vec2 outputSize;
vec3 bright(vec3 c){float b=max(c.r,max(c.g,c.b)),k=threshold*.5;
 float soft=clamp(b-threshold+k,0.,2.*k);soft=soft*soft/(4.*k+.00001);
 return c*max(b-threshold,soft)/max(b,.00001);}
void main(){
 // Integrate the complete source footprint BEFORE downsampling. A single
 // bilinear tap at quarter resolution missed 1–3px neon lines every other
 // camera pixel. Threshold each linear-light source sample, not its average.
 ivec2 size=textureSize(scene,0);vec3 sum=vec3(0);
 for(int y=0;y<4;y++)for(int x=0;x<4;x++){
  vec2 at=uv+(vec2(x,y)-1.5)/(outputSize*4.);
  ivec2 pixel=clamp(ivec2(floor(at*vec2(size))),ivec2(0),size-1);
  sum+=bright(linearColor(texelFetch(scene,pixel,0).rgb));
 }
 result=vec4(sum/16.,1);}`;
const blur=common+`
uniform vec2 axis;
void main(){vec3 c=texture(scene,uv).rgb*.227027;
 c+=(texture(scene,uv+axis*1.384615).rgb+texture(scene,uv-axis*1.384615).rgb)*.316216;
 c+=(texture(scene,uv+axis*3.230769).rgb+texture(scene,uv-axis*3.230769).rgb)*.070270;
 result=vec4(c,1);}`;
const composite=common+`
uniform sampler2D bloom;
uniform float intensity;
void main(){result=vec4(displayColor(sampleScene(uv)+texture(bloom,uv).rgb*intensity),1);}`;
class Renderer{
 constructor(){
  this.canvas=document.createElement('canvas');this.canvas.width=1280;this.canvas.height=720;
  const gl=this.gl=this.canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,preserveDrawingBuffer:true});
  if(!gl)throw Error('WebGL2 unavailable');
  this.floatBloom=!!gl.getExtension('EXT_color_buffer_float');
  this.programs={};for(const [key,source]of Object.entries({fog,puddle,shaft,extract,blur,composite})){
   const program=gl.createProgram();for(const [type,code]of [[gl.VERTEX_SHADER,key==='shaft'?shaftVertex:vertex],[gl.FRAGMENT_SHADER,source]]){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);gl.deleteShader(s);}
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));this.programs[key]=program;
  }
  this.scene=this.texture();this.reflection=this.texture();this.buffers=[this.target(320,180),this.target(320,180),this.target(320,180)];
  this.capture=document.createElement('canvas');this.capture.width=1280;this.capture.height=720;this.captureCtx=this.capture.getContext('2d');
 }
 texture(){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return t;}
 target(w,h){const g=this.gl,t=this.texture(),f=g.createFramebuffer();g.texImage2D(g.TEXTURE_2D,0,this.floatBloom?g.RGBA16F:g.RGBA,w,h,0,g.RGBA,this.floatBloom?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);g.bindFramebuffer(g.FRAMEBUFFER,f);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);return {t,f,w,h};}
 upload(t,canvas){if(t===this.scene&&(this.canvas.width!==canvas.width||this.canvas.height!==canvas.height)){this.canvas.width=canvas.width;this.canvas.height=canvas.height;}const g=this.gl;g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);}
 bind(name,unit,t){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,t);g.uniform1i(g.getUniformLocation(this.program,name),unit);}
 use(name,target){const g=this.gl;this.program=this.programs[name];g.useProgram(this.program);g.bindFramebuffer(g.FRAMEBUFFER,target?.f||null);g.viewport(0,0,target?.w||this.canvas.width,target?.h||this.canvas.height);this.bind('scene',0,this.scene);}
 uniform(name,values){const g=this.gl,l=g.getUniformLocation(this.program,name);if(typeof values==='number')g.uniform1f(l,values);else g['uniform'+values.length+'fv'](l,values);}
 camera(cam){this.uniform('camera',[cam.x,cam.y,cam.w]);}
 draw(){this.gl.drawArrays(this.gl.TRIANGLES,0,3);}
 paint(ctx){ctx.drawImage(this.canvas,0,0,1280,720);}
 fog(ctx,cam,f,area,time){this.upload(this.scene,ctx.canvas);this.use('fog');this.camera(cam);this.uniform('area',area);this.uniform('density',[f.density,f.groundY,f.height,f.heightFalloff]);this.uniform('noise',[f.noiseScale,f.noiseStrength,f.driftSpeed,f.pixelsPerUnit]);this.uniform('style',[f.lightInfluence,f.alphaSteps,f.edgeFade,0]);this.uniform('fogColor',f.color.map(linear));this.uniform('time',time);this.draw();this.paint(ctx);}
 puddles(ctx,cam,pools,rippleData,reflectors){
  this.upload(this.scene,ctx.canvas);const c=this.captureCtx;let capturePlane=null;
  this.use('puddle');const g=this.gl;g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);this.camera(cam);this.bind('reflection',1,this.reflection);
  this.uniform('tint',W.LUNA_STREET_ATMOSPHERE.tint.map(linear));this.uniform('waterColor',W.LUNA_STREET_ATMOSPHERE.waterColor.map(linear));
  for(const p of pools){if(Math.abs(p.x-cam.x)>cam.w/2+p.width/2)continue;
   const key=p.line+':'+p.reflectionCompression;
   if(capturePlane!==key){
    capturePlane=key;c.clearRect(0,0,1280,720);c.drawImage(ctx.canvas,0,0,1280,720);reflectors(c,p);
    this.upload(this.reflection,this.capture);this.bind('scene',0,this.scene);this.bind('reflection',1,this.reflection);
   }
   this.uniform('area',[p.x,p.y,p.width,p.height]);this.uniform('surface',[p.line,p.reflectionCompression,p.pixelsPerUnit,p.opacity]);this.uniform('shape',[p.outline,p.seed%997,p.edgeBreakup,p.rippleBrightness]);this.uniform('distortion',p.distortionPixels);this.uniform('rippleSpeed',p.rippleRadius/1.25);
   g.uniform4fv(g.getUniformLocation(this.program,'ripples[0]'),rippleData(p));this.draw();
  }this.paint(ctx);
 }
 shafts(ctx,cam,shafts,time){
  for(const p of shafts){
   this.upload(this.scene,ctx.canvas);this.use('shaft');const g=this.gl;g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);this.camera(cam);
   g.uniform2fv(g.getUniformLocation(this.program,'corners[0]'),p.corners.flat());
   this.uniform('shape',[p.falloff,p.edgeSoftness,p.rayStrength,p.rayCount]);this.uniform('motion',[p.raySpeed,p.dust,p.dustSpeed,p.pixelsPerUnit]);this.uniform('fade',[p.startFade,p.flicker,p.brightnessSteps,0]);this.uniform('time',time);
   this.uniform('color',p.tint.map((v,i)=>linear((v+(p.lightColor[i]-v)*p.useLightColor)*p.intensity)));
   g.drawArrays(g.TRIANGLES,0,6);this.paint(ctx);
  }
 }
 post(ctx,settings){
  this.upload(this.scene,ctx.canvas);
  const width=Math.ceil(this.canvas.width/4),height=Math.ceil(this.canvas.height/4),g=this.gl;
  if(this.buffers[0].w!==width||this.buffers[0].h!==height){
   for(const b of this.buffers){g.deleteTexture(b.t);g.deleteFramebuffer(b.f);}
   this.buffers=[this.target(width,height),this.target(width,height),this.target(width,height)];
  }
  const [a,b,c]=this.buffers;
  this.use('extract',a);this.uniform('threshold',linear(settings.threshold));this.uniform('outputSize',[a.w,a.h]);this.draw();
  // A small, bounded two-scale blur keeps the original art sharp. URP's HDR
  // light buffers are unavailable on Canvas; do not fabricate extra exposure.
  for(const spread of [1,1+settings.scatter*4/3]){
   const radius=spread*this.canvas.width/1280;
   this.use('blur',b);this.bind('scene',0,a.t);this.uniform('axis',[radius/a.w,0]);this.draw();
   this.use('blur',c);this.bind('scene',0,b.t);this.uniform('axis',[0,radius/a.h]);this.draw();
   this.use('blur',a);this.bind('scene',0,c.t);this.uniform('axis',[0,0]);this.draw();
  }
  this.use('composite');this.bind('bloom',1,a.t);this.uniform('intensity',settings.intensity);this.draw();this.paint(ctx);
 }
}
function linear(c){return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}
W.LunaStreetAtmosphereRenderer=Renderer;
})(typeof window==='undefined'?globalThis:window);
