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
const fogDensity=`uniform vec4 area,density,noise,style;
uniform vec3 fogColor;
uniform float time;
float Hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float ValueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(Hash(i),Hash(i+vec2(1,0)),f.x),mix(Hash(i+vec2(0,1)),Hash(i+1.),f.x),f.y);}

float fogAlpha(vec2 world){
 vec2 local=(world-area.xy)/area.zw+.5;
 float h=clamp((world.y-density.y)/density.z,0.,1.),d=pow(1.-h,density.w);
 vec2 p=world/noise.x;float drift=time*noise.z;
 float clouds=ValueNoise(p+vec2(drift,0))*.6+ValueNoise(p*2.3+vec2(-drift*1.7,drift*.3))*.4;
 d*=mix(1.,clamp(clouds*1.6-.2,0.,1.),noise.y);
 d*=smoothstep(0.,style.z,local.x)*smoothstep(0.,style.z,1.-local.x)*smoothstep(0.,style.z,1.-local.y)*step(0.,local.y);
 float alpha=clamp(d*density.x,0.,1.);if(style.y>.5)alpha=floor(alpha*style.y+.5)/style.y;
 return alpha;
}`;
const fog=common+fogDensity+`
void main(){
 vec3 original=sampleScene(uv);vec2 world=worldAt(uv);
 float alpha=fogAlpha(world);
 vec3 lit=fogColor*mix(vec3(1),clamp(original*2.,.35,1.5),style.x);
 result=vec4(displayColor(mix(original,lit,alpha)),1);
}`;
// Evaluate each native world cell once, then interpolate only fog density.
// Compositing stays full resolution: sprite edges never undergo a downsample.
const fogField=common+fogDensity+`
uniform vec2 fieldOrigin;
void main(){result=vec4(fogAlpha((fieldOrigin+floor(gl_FragCoord.xy)+.5)/noise.w),0,0,1);}`;
const fogComposite=common+`
uniform sampler2D fogGrid;
uniform vec2 fieldOrigin;
uniform vec4 noise,style;
uniform vec3 fogColor;
void main(){
 vec2 fieldUV=(worldAt(uv)*noise.w-fieldOrigin)/vec2(textureSize(fogGrid,0));
 float alpha=texture(fogGrid,fieldUV).r;
 vec3 original=sampleScene(uv);
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
uniform vec4 shape,fade;
uniform vec3 color;
uniform float time,raySpeed;
void main(){
 float across=abs(shaftUV.x-.5)*2.,along=shaftUV.y;
 float edge=(1.-smoothstep(1.-shape.y,1.,across))*mix(1.,1.-across*across,.5);
 float body=pow(clamp(1.-along,0.,1.),shape.x)*smoothstep(0.,max(.001,fade.x),along);
 float t=time*raySpeed,rays=.5+.5*sin(shaftUV.x*shape.w*6.2832+t+sin(shaftUV.x*13.1-t*.7)*1.3);
 float glow=edge*body*mix(1.,rays,shape.z);glow*=1.-fade.y*(.5+.5*sin(time*23.)*sin(time*7.3));
 if(fade.z>.5)glow=floor(glow*fade.z+.5)/fade.z;
 // Falling rain is owned by outside-rain.js. Do not duplicate it with
 // the engine shaft's bright square dust grid, which reads as falling debris.
 result=vec4(displayColor(sampleScene(uv)+color*glow),1);
}`;
const characterShadow=common+`
uniform sampler2D actor,fillLight;
uniform vec4 spriteRect,bodyRect,groundRect,fillArea,contact;
uniform vec4 projections[16],emitters[16];
uniform vec2 foot,texel;
uniform vec3 shadowColor;
uniform float facing,softness,ambient,lightCount,shadowLength;
float alphaAt(vec2 p){
 if(any(lessThan(p,vec2(0)))||any(greaterThan(p,vec2(1))))return 0.;
 return texture(actor,spriteRect.xy+p*spriteRect.zw).a;
}
float silhouette(vec2 world,vec4 projection,float blurRadius){
 float above=(world.y-foot.y)/projection.y;
 vec2 source=vec2(world.x-projection.x*above,foot.y+above);
 vec2 local=(source-bodyRect.xy)/bodyRect.zw;if(facing<0.)local.x=1.-local.x;
 vec2 blur=texel*blurRadius;
 float alpha=alphaAt(local)*.4;
 alpha+=(alphaAt(local+vec2(blur.x,0))+alphaAt(local-vec2(blur.x,0))+alphaAt(local+vec2(0,blur.y))+alphaAt(local-vec2(0,blur.y)))*.15;
 return alpha;
}
void main(){
 vec2 world=worldAt(uv);
 float edge=min(min(world.x-groundRect.x,world.y-groundRect.y),min(groundRect.z-world.x,groundRect.w-world.y));
 float ground=clamp(edge*100.,0.,1.),opacity=0.;
 if(ground>0.&&world.y<=foot.y){
  vec2 fieldUV=((world-fillArea.xy)/fillArea.zw+.5)/vec2(textureSize(fillLight,0));
  float fill=dot(texture(fillLight,clamp(fieldUV,0.,1.)).rg,vec2(256.,1.))*255./65535.*16.;
  float total=ambient+fill,blocked=0.,distance=length(world-foot);
  for(int i=0;i<16;i++){
   if(float(i)>=lightCount)break;
   vec4 light=emitters[i],projection=projections[i];
   float falloff=clamp(1.-length(world-light.xy)/max(.1,light.z),0.,1.);
   float energy=light.w*falloff*falloff;total+=energy;if(energy<.0001)continue;
   float alpha=silhouette(world,projection,projection.w*(1.+distance*1.5));
   alpha*=1.-.65*smoothstep(0.,shadowLength,distance);
   blocked+=energy*alpha*projection.z;
  }
  // Each silhouette removes only its own light's share. Unblocked lamps and
  // local neon fill still illuminate the same pixel; no stacked black copies.
  float projected=clamp(blocked/max(.001,total),0.,.8);
  float grounded=silhouette(world,contact,softness)*contact.z*(1.-.65*smoothstep(0.,max(.05,contact.w),distance));
  opacity=(1.-(1.-projected)*(1.-grounded))*ground;
 }
 vec3 original=sampleScene(uv);
 result=vec4(displayColor(mix(original,min(original,shadowColor),opacity)),1);
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
// Reduce the already thresholded light, never the original scene. Every
// half-resolution pass averages its full footprint before the next reduction.
const downsample=common+`
uniform vec2 outputSize;
void main(){
 vec2 d=.25/outputSize;
 result=vec4((texture(scene,uv+vec2(-d.x,-d.y)).rgb+texture(scene,uv+vec2(d.x,-d.y)).rgb+
              texture(scene,uv+vec2(-d.x,d.y)).rgb+texture(scene,uv+d).rgb)*.25,1);
}`;
const blur=common+`
uniform vec2 axis,taps[32];
uniform float centerWeight,tapCount;
void main(){
 vec3 c=texture(scene,uv).rgb*centerWeight;
 // Each tap integrates TWO ADJACENT texels with bilinear filtering. Never
 // enlarge gaps between taps: thin neon lines would become repeated echoes.
 for(int i=0;i<32;i++){
  if(float(i)>=tapCount)break;
  vec2 offset=axis*taps[i].x;
  c+=(texture(scene,uv+offset).rgb+texture(scene,uv-offset).rgb)*taps[i].y;
 }
 result=vec4(c,1);
}`;
// The native sprite cell is the render target. No screen-sized upload, blur
// or geometry expansion: transparent pixels stay transparent, even at seams.
const characterLighting=common+`
uniform sampler2D actor;
uniform vec4 cell,body,shadeParams,rimParams,shapeParams;
uniform vec3 shadeColor,rimColor,localLight;
uniform vec2 foot,lightPosition,ambientDirection;
uniform float facing,lightWeight;
vec4 sprite(vec2 p){
 if(any(lessThan(p,vec2(0)))||any(greaterThanEqual(p,cell.zw)))return vec4(0);
 return texelFetch(actor,ivec2(cell.xy+floor(p)),0);
}
float edge(vec2 p,vec2 dir,float width,float focus){
 vec4 w=pow(max(vec4(dir.x,-dir.x,dir.y,-dir.y),0.),vec4(focus));
 return clamp(dot(vec4(1.-sprite(p+vec2(width,0)).a,1.-sprite(p-vec2(width,0)).a,1.-sprite(p+vec2(0,width)).a,1.-sprite(p-vec2(0,width)).a),w),0.,1.);
}
float facingEdge(vec2 p,vec2 dir,float width,float focus){return max(edge(p,dir,1.,focus),edge(p,dir,max(1.,width),focus));}
void main(){
 vec2 p=gl_FragCoord.xy,q=p/cell.zw;
 vec4 original=sprite(p);if(original.a<=0.){result=vec4(0);return;}
 vec2 world=body.xy+vec2(facing<0.?1.-q.x:q.x,q.y)*body.zw;
 vec2 toLight=lightPosition-world;float distance=max(length(toLight),.0001);
 vec2 dir=normalize(mix(normalize(ambientDirection),toLight/distance,lightWeight)+vec2(.00001));
 dir.x*=facing;
 float height=clamp((world.y-foot.y)/max(.01,(body.y+body.w-foot.y)*shadeParams.y),0.,1.);
 float occlusion=shadeParams.x*(1.-height)*(1.-height);
 float away=facingEdge(p,-dir,shadeParams.w,1.);
 float shade=clamp(occlusion+away*shadeParams.z*mix(shapeParams.w,1.,lightWeight),0.,1.);
 vec3 color=mix(linearColor(original.rgb),linearColor(original.rgb)*shadeColor,shade);
 float rim=facingEdge(p,dir,rimParams.y,shapeParams.x),glow=0.;
 for(int k=1;k<=4;k++){float reach=1.+(max(1.,rimParams.w)-1.)*float(k)/4.;glow=max(glow,edge(p,dir,reach,shapeParams.x)*(1.-float(k-1)/4.));}
 float nearest=max(.05,length(lightPosition-clamp(lightPosition,body.xy,body.xy+body.zw)));
 float attenuation=mix(1.,pow(clamp(nearest/distance,0.,1.),shapeParams.y),lightWeight);
 // Physical point-light falloff stays continuous even inside an actor cell.
 float localAttenuation=pow(clamp(1.-distance/max(.01,localLight.x),0.,1.),shapeParams.y)*localLight.z;
 attenuation=mix(attenuation,localAttenuation,localLight.y);
 color+=rimColor*lightWeight*attenuation*(rimParams.x*rim*(1.+rimParams.z)+glow*rimParams.z*.6);
 result=vec4(displayColor(color),original.a);
}`;
const composite=common+`
uniform sampler2D bloom;
uniform float intensity;
void main(){result=vec4(displayColor(sampleScene(uv)+texture(bloom,uv).rgb*intensity),1);}`;
class Renderer{
 constructor({spriteOnly=false}={}){
  this.spriteOnly=spriteOnly;
  this.canvas=document.createElement('canvas');this.canvas.width=spriteOnly?1:1280;this.canvas.height=spriteOnly?1:720;
  const gl=this.gl=this.canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,preserveDrawingBuffer:false});
  if(!gl)throw Error('WebGL2 unavailable');
  this.floatBloom=!!gl.getExtension('EXT_color_buffer_float');
  const sources=spriteOnly?{characterLighting}:{fog:fogComposite,fogDirect:fog,fogField,puddle,shaft,characterShadow,extract,downsample,blur,composite};
  this.locations=new Map();this.programs={};for(const [key,source]of Object.entries(sources)){
   const program=gl.createProgram();for(const [type,code]of [[gl.VERTEX_SHADER,key==='shaft'?shaftVertex:vertex],[gl.FRAGMENT_SHADER,source]]){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);gl.deleteShader(s);}
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));this.programs[key]=program;
  }
  this.scene=this.texture();
  if(spriteOnly)return;
  this.reflection=this.texture();this.actor=this.texture();this.shadowFill=this.texture();this.buffers=[this.target(320,180),this.target(320,180),this.target(320,180)];
  this.capture=document.createElement('canvas');this.capture.width=1280;this.capture.height=720;this.captureCtx=this.capture.getContext('2d');
 }
 texture(){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return t;}
 target(w,h){const g=this.gl,t=this.texture(),f=g.createFramebuffer();g.texImage2D(g.TEXTURE_2D,0,this.floatBloom?g.RGBA16F:g.RGBA,w,h,0,g.RGBA,this.floatBloom?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);g.bindFramebuffer(g.FRAMEBUFFER,f);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);return {t,f,w,h};}
 upload(t,canvas){if(t===this.scene&&(this.canvas.width!==canvas.width||this.canvas.height!==canvas.height)){this.canvas.width=canvas.width;this.canvas.height=canvas.height;}const g=this.gl;g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);}
 location(name){let table=this.locations.get(this.program);if(!table){table=new Map();this.locations.set(this.program,table);}if(!table.has(name))table.set(name,this.gl.getUniformLocation(this.program,name));return table.get(name);}
 // Conservative device-pixel bounds. Scissor AND copy only the affected area;
 // off-screen effects never upload a scene or capture a reflection.
 bounds(cam,rect,source=this.canvas){const scale=source.width/cam.w,h=cam.w*720/1280;
  const x=Math.max(0,Math.floor((rect[0]-cam.x+cam.w/2)*scale)-2),y=Math.max(0,Math.floor((rect[1]-cam.y+h/2)*scale)-2);
  const right=Math.min(source.width,Math.ceil((rect[2]-cam.x+cam.w/2)*scale)+2),top=Math.min(source.height,Math.ceil((rect[3]-cam.y+h/2)*scale)+2);
  return right>x&&top>y?[x,y,right-x,top-y]:null;
 }
 clip(box){const g=this.gl;g.enable(g.SCISSOR_TEST);g.scissor(...box);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);}
 finishRegion(ctx,box){this.gl.disable(this.gl.SCISSOR_TEST);const [x,y,w,h]=box,top=this.canvas.height-y-h;ctx.drawImage(this.canvas,x,top,w,h,x*1280/this.canvas.width,top*720/this.canvas.height,w*1280/this.canvas.width,h*720/this.canvas.height);}
 bind(name,unit,t){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,t);g.uniform1i(this.location(name),unit);}
 use(name,target){const g=this.gl;this.program=this.programs[name];g.useProgram(this.program);g.bindFramebuffer(g.FRAMEBUFFER,target?.f||null);g.viewport(0,0,target?.w||this.canvas.width,target?.h||this.canvas.height);this.bind('scene',0,this.scene);}
 uniform(name,values){const g=this.gl,l=this.location(name);if(typeof values==='number')g.uniform1f(l,values);else g['uniform'+values.length+'fv'](l,values);}
 camera(cam){this.uniform('camera',[cam.x,cam.y,cam.w]);}
 draw(){this.gl.drawArrays(this.gl.TRIANGLES,0,3);}
 paint(ctx){ctx.drawImage(this.canvas,0,0,1280,720);}
 fog(ctx,cam,f,area,time){
  const box=this.bounds(cam,[area[0]-area[2]/2,area[1]-area[3]/2,area[0]+area[2]/2,Math.min(area[1]+area[3]/2,f.groundY+f.height)],ctx.canvas);if(!box)return;
  this.upload(this.scene,ctx.canvas);
  // One guard cell on each side keeps interpolation world-anchored even as
  // the camera crosses a cell boundary; viewport edges never clamp a sample.
  const ppu=f.pixelsPerUnit,origin=[Math.floor((cam.x-cam.w/2)*ppu)-1,Math.floor((cam.y-cam.w*720/1280/2)*ppu)-1],w=Math.ceil(cam.w*ppu)+3,h=Math.ceil(cam.w*720/1280*ppu)+3;
  // Very wide panorama can exceed native-grid budget. Direct evaluation is
  // cheaper there; the normal walking camera always uses the native grid.
  if(w*h>this.canvas.width*this.canvas.height/2){this.use('fogDirect');this.camera(cam);this.uniform('area',area);this.uniform('density',[f.density,f.groundY,f.height,f.heightFalloff]);this.uniform('noise',[f.noiseScale,f.noiseStrength,f.driftSpeed,ppu]);this.uniform('style',[f.lightInfluence,f.alphaSteps,f.edgeFade,0]);this.uniform('fogColor',f.color.map(linear));this.uniform('time',time);this.clip(box);this.draw();this.finishRegion(ctx,box);return;}
  if(!this.fogBuffer||this.fogBuffer.w!==w||this.fogBuffer.h!==h){if(this.fogBuffer){this.gl.deleteTexture(this.fogBuffer.t);this.gl.deleteFramebuffer(this.fogBuffer.f);}this.fogBuffer=this.target(w,h);}
  this.use('fogField',this.fogBuffer);this.uniform('fieldOrigin',origin);this.uniform('area',area);this.uniform('density',[f.density,f.groundY,f.height,f.heightFalloff]);this.uniform('noise',[f.noiseScale,f.noiseStrength,f.driftSpeed,ppu]);this.uniform('style',[f.lightInfluence,f.alphaSteps,f.edgeFade,0]);this.uniform('time',time);this.draw();
  this.use('fog');this.camera(cam);this.bind('fogGrid',1,this.fogBuffer.t);this.uniform('fieldOrigin',origin);this.uniform('noise',[f.noiseScale,f.noiseStrength,f.driftSpeed,ppu]);this.uniform('style',[f.lightInfluence,f.alphaSteps,f.edgeFade,0]);this.uniform('fogColor',f.color.map(linear));this.clip(box);this.draw();this.finishRegion(ctx,box);
 }
 puddles(ctx,cam,pools,rippleData,reflectors){
  const visible=pools.map(p=>({p,box:this.bounds(cam,[p.x-p.width/2,p.y-p.height/2,p.x+p.width/2,p.y+p.height/2],ctx.canvas)})).filter(v=>v.box);if(!visible.length)return;
  this.upload(this.scene,ctx.canvas);const c=this.captureCtx;let capturePlane=null;
  this.use('puddle');const g=this.gl;const x=Math.min(...visible.map(v=>v.box[0])),y=Math.min(...visible.map(v=>v.box[1]));const box=[x,y,Math.max(...visible.map(v=>v.box[0]+v.box[2]))-x,Math.max(...visible.map(v=>v.box[1]+v.box[3]))-y];this.clip(box);this.camera(cam);this.bind('reflection',1,this.reflection);
  this.uniform('tint',W.LUNA_STREET_ATMOSPHERE.tint.map(linear));this.uniform('waterColor',W.LUNA_STREET_ATMOSPHERE.waterColor.map(linear));
  for(const {p,box} of visible){
   const key=p.line+':'+p.reflectionCompression;
   if(capturePlane!==key){
    capturePlane=key;c.clearRect(0,0,1280,720);c.drawImage(ctx.canvas,0,0,1280,720);reflectors(c,p);
    this.upload(this.reflection,this.capture);this.use('puddle');g.enable(g.SCISSOR_TEST);this.bind('scene',0,this.scene);this.bind('reflection',1,this.reflection);
   }
   this.uniform('area',[p.x,p.y,p.width,p.height]);this.uniform('surface',[p.line,p.reflectionCompression,p.pixelsPerUnit,p.opacity]);this.uniform('shape',[p.outline,p.seed%997,p.edgeBreakup,p.rippleBrightness]);this.uniform('distortion',p.distortionPixels);this.uniform('rippleSpeed',p.rippleRadius/1.25);
   g.uniform4fv(this.location('ripples[0]'),rippleData(p));g.scissor(...box);this.draw();
  }this.finishRegion(ctx,box);
 }
 shafts(ctx,cam,shafts,time){
  for(const p of shafts){
   const box=this.bounds(cam,[Math.min(...p.corners.map(c=>c[0])),Math.min(...p.corners.map(c=>c[1])),Math.max(...p.corners.map(c=>c[0])),Math.max(...p.corners.map(c=>c[1]))],ctx.canvas);if(!box)continue;
   this.upload(this.scene,ctx.canvas);this.use('shaft');const g=this.gl;g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);this.camera(cam);
   g.uniform2fv(this.location('corners[0]'),p.corners.flat());
   this.uniform('shape',[p.falloff,p.edgeSoftness,p.rayStrength,p.rayCount]);this.uniform('raySpeed',p.raySpeed);this.uniform('fade',[p.startFade,p.flicker,p.brightnessSteps,0]);this.uniform('time',time);
   this.uniform('color',p.tint.map((v,i)=>linear((v+(p.lightColor[i]-v)*p.useLightColor)*p.intensity)));
   this.clip(box);g.drawArrays(g.TRIANGLES,0,6);this.finishRegion(ctx,box);
  }
 }
 characterShadow(ctx,cam,p){
  const spread=(p.maxLength??.85)+p.width+.15;
  const box=this.bounds(cam,[Math.max(p.rect[0],p.foot.x-spread),Math.max(p.rect[1],p.foot.y-spread),Math.min(p.rect[2],p.foot.x+spread),Math.min(p.rect[3],p.foot.y)],ctx.canvas);if(!box)return;
  this.upload(this.scene,ctx.canvas);
  if(this.actorImage!==p.image){this.upload(this.actor,p.image);this.actorImage=p.image;}
  this.use('characterShadow');this.camera(cam);this.bind('actor',1,this.actor);
  const sp=p.sp;this.uniform('spriteRect',[sp.x/p.image.width,1-(sp.y+sp.h)/p.image.height,sp.w/p.image.width,sp.h/p.image.height]);
  this.uniform('bodyRect',[p.pivot.x-p.width*(p.flip?1-sp.pivot.x:sp.pivot.x),p.pivot.y-p.height*sp.pivot.y,p.width,p.height]);
  this.uniform('groundRect',p.rect);this.uniform('foot',[p.foot.x,p.foot.y]);this.uniform('texel',[1/sp.w,1/sp.h]);this.uniform('facing',p.flip?-1:1);this.uniform('softness',p.softness);this.uniform('shadowColor',p.color.slice(0,3).map(linear));
  const g=this.gl,projections=new Float32Array(64),emitters=new Float32Array(64);
  projections.set(p.projections.flat());emitters.set(p.emitters.flat());
  g.uniform4fv(this.location('projections[0]'),projections);g.uniform4fv(this.location('emitters[0]'),emitters);
  this.uniform('lightCount',p.emitters.length);this.uniform('ambient',p.ambient);this.uniform('shadowLength',p.maxLength??.85);this.uniform('contact',p.contact);this.uniform('fillArea',p.field.area);
  g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,this.shadowFill);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,p.field.width,p.field.height,0,g.RGBA,g.UNSIGNED_BYTE,p.field.data);this.bind('fillLight',2,this.shadowFill);
  this.clip(box);this.draw();this.finishRegion(ctx,box);
 }
 characterLighting(image,sp,p){
  // Reflection capture can shade a character while the puddle framebuffer
  // contains a partially rendered scene. Never use that framebuffer as a
  // scratch sprite: discarded pool pixels would expose a miniature actor.
  // Reuse one native-cell canvas/context, with only this shader and no scene
  // buffers. The actor and its reflection share the result immediately.
  if(!this.spriteOnly){this.lightingRenderer??=new Renderer({spriteOnly:true});return this.lightingRenderer.characterLighting(image,sp,p);}
  if(this.gl.isContextLost())return null;
  if(this.canvas.width!==sp.w||this.canvas.height!==sp.h){this.canvas.width=sp.w;this.canvas.height=sp.h;}
  const g=this.gl;
  this.lightingTextures??=new Map();
  let texture=this.lightingTextures.get(image);
  if(!texture){texture=this.texture();this.upload(texture,image);this.lightingTextures.set(image,texture);
   if(this.lightingTextures.size>64){const [old,t]=this.lightingTextures.entries().next().value;g.deleteTexture(t);this.lightingTextures.delete(old);}
  }
  this.use('characterLighting');g.viewport(0,0,sp.w,sp.h);this.clip([0,0,sp.w,sp.h]);this.bind('actor',1,texture);
  const c=p.config,s=p.state;
  this.uniform('cell',[sp.x,image.height-sp.y-sp.h,sp.w,sp.h]);
  this.uniform('body',[p.x-p.width*(p.flip?1-sp.pivot.x:sp.pivot.x),p.y-p.height*sp.pivot.y,p.width,p.height]);
  this.uniform('foot',[p.foot.x,p.foot.y]);this.uniform('facing',p.flip?-1:1);
  this.uniform('localLight',s.localLight||[1,0,1]);
  this.uniform('lightPosition',s.position);this.uniform('lightWeight',s.weight);this.uniform('ambientDirection',c.ambientDirection);
  this.uniform('shadeParams',[c.groundOcclusion,c.occlusionHeight,c.sideShadow,c.sideShadowWidth]);
  this.uniform('shadeColor',c.shadeColor.map(linear));this.uniform('rimColor',s.color.map(linear));
  this.uniform('rimParams',[c.rimIntensity,c.rimWidth,c.rimGlow,c.rimGlowWidth]);
  this.uniform('shapeParams',[c.rimFocus,c.rimDistanceFalloff,0,c.ambientSideShadow]);
  this.draw();g.disable(g.SCISSOR_TEST);
  return {image:this.canvas,x:0,y:this.canvas.height-sp.h,w:sp.w,h:sp.h};
 }
 post(ctx,settings){
  this.upload(this.scene,ctx.canvas);
  const width=Math.ceil(this.canvas.width/4),height=Math.ceil(this.canvas.height/4),g=this.gl,key=width+':'+height;
  if(this.bloomSize!==key){
   for(const b of [...this.buffers,...(this.bloomLevels||[])]){g.deleteTexture(b.t);g.deleteFramebuffer(b.f);}
   const a=this.target(width,height);this.bloomLevels=[];let w=width,h=height;
   while(w>320){w=Math.ceil(w/2);h=Math.ceil(h/2);this.bloomLevels.push(this.target(w,h));}
   this.buffers=[this.target(w,h),this.target(w,h),a];this.bloomSize=key;
  }
  const [c,b,a]=this.buffers;
  this.use('extract',a);this.uniform('threshold',linear(settings.threshold));this.uniform('outputSize',[a.w,a.h]);this.draw();
  let input=a;
  for(const level of this.bloomLevels){this.use('downsample',level);this.bind('scene',0,input.t);this.uniform('outputSize',[level.w,level.h]);this.draw();input=level;}
  // Dense Gaussian on a bounded light-only grid. Scene/art stays at native
  // physical resolution; high DPR cannot turn sample spacing into stripes.
  const sigma=1.69*Math.hypot(1,1+settings.scatter*4/3)*c.w/320;
  if(this.blurKernel?.sigma!==sigma){
   const radius=Math.min(63,Math.ceil(3*sigma)),weights=Array.from({length:radius+1},(_,i)=>Math.exp(-.5*(i/sigma)**2));
   const total=weights[0]+2*weights.slice(1).reduce((sum,w)=>sum+w,0),taps=new Float32Array(64);let count=0;
   for(let i=1;i<=radius;i+=2){const first=weights[i],second=weights[i+1]||0,weight=first+second;taps[count*2]=i+second/weight;taps[count*2+1]=weight/total;count++;}
   this.blurKernel={sigma,center:weights[0]/total,taps,count};
  }
  const kernel=this.blurKernel;
  this.use('blur',b);this.bind('scene',0,input.t);this.uniform('axis',[1/c.w,0]);
  this.uniform('centerWeight',kernel.center);this.uniform('tapCount',kernel.count);g.uniform2fv(this.location('taps[0]'),kernel.taps);this.draw();
  this.use('blur',c);this.bind('scene',0,b.t);this.uniform('axis',[0,1/c.h]);this.draw();
  this.use('composite');this.bind('bloom',1,c.t);this.uniform('intensity',settings.intensity);this.draw();this.paint(ctx);
 }
}
function linear(c){return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}
W.LunaStreetAtmosphereRenderer=Renderer;
})(typeof window==='undefined'?globalThis:window);
