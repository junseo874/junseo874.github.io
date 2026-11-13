/* A scene-local sprite surface. Canvas2D remains the presentation/UI surface.
 * Static art stays in GPU textures; small dynamic canvases update in place.
 * Rare Canvas path/gradient draws are rasterized only in their affected region.
 */
(function(W){'use strict';
const VS=`#version 300 es
in vec4 vertex;in vec4 color;in vec4 limits;out vec2 uv;out vec4 tint;out vec4 crop;
void main(){gl_Position=vec4(vertex.xy,0,1);uv=vertex.zw;tint=color;crop=limits;}`;
const FS=`#version 300 es
precision highp float;uniform sampler2D art;in vec2 uv;in vec4 tint;in vec4 crop;out vec4 result;
void main(){result=texture(art,clamp(uv,crop.xy,crop.zw))*tint;}`;
const ORDER=[0,1,2,0,2,3],fixed=new WeakSet(),versions=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function program(g){const p=g.createProgram();for(const [type,code]of[[g.VERTEX_SHADER,VS],[g.FRAGMENT_SHADER,FS]]){const s=g.createShader(type);g.shaderSource(s,code);g.compileShader(s);g.attachShader(p,s);g.deleteShader(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}
class Surface{
 constructor(renderer,canvas){
  this.renderer=renderer;this.gl=renderer.gl;this.canvas=canvas;
  this.raster=document.createElement('canvas');this.raw=this.raster.getContext('2d');
  this.patch=document.createElement('canvas');this.patchCtx=this.patch.getContext('2d');
  this.program=program(this.gl);this.artUniform=this.gl.getUniformLocation(this.program,'art');this.buffer=this.gl.createBuffer();this.vao=this.gl.createVertexArray();
  const g=this.gl;g.bindVertexArray(this.vao);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
  for(const [name,n,offset]of[['vertex',4,0],['color',4,16],['limits',4,32]]){const a=g.getAttribLocation(this.program,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,n,g.FLOAT,false,48,offset);}
  this.vertices=new Float32Array(72*2048);this.count=0;this.textures=new Map();this.bytes=0;this.serial=0;this.colors=new Map();
  this.white=renderer.texture();g.bindTexture(g.TEXTURE_2D,this.white);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  this.stats={draws:0,uploads:0,uploadPixels:0,fallbacks:0};this.stack=[];this.matrix=[1,0,0,1,0,0];this.clipBox=null;this.complexClip=false;this.pathBox=null;this.pathRect=false;
  this.styles={globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:true,filter:'none',shadowBlur:0,fillStyle:'#000000'};this.methods=new Map();this.rectPoints=[[0,0],[0,0],[0,0],[0,0]];
  this.context=new Proxy(this.raw,{get:(o,k)=>this.get(k),set:(o,k,v)=>{if(typeof this[k]==='function'&&typeof v==='function'){this.methods.set(k,v);return true;}o[k]=v;if(k in this.styles)this.styles[k]=o[k];return true;}});
 }
 get(k){if(k==='gpu')return this;if(k==='canvas')return this.canvas;if(this.methods.has(k))return this.methods.get(k);if(typeof this[k]==='function'){const f=this[k].bind(this);this.methods.set(k,f);return f;}if(k in this.styles)return this.styles[k];const value=this.raw[k];if(typeof value==='function'){const f=value.bind(this.raw);this.methods.set(k,f);return f;}return value;}
 resize(){const w=this.canvas.width,h=this.canvas.height;if(this.target?.w===w&&this.target?.h===h)return;
  if(this.target){this.gl.deleteTexture(this.target.t);this.gl.deleteFramebuffer(this.target.f);}
  this.target=this.renderer.target(w,h,true);this.raster.width=w;this.raster.height=h;this.matrix=[1,0,0,1,0,0];this.stack=[];this.clipBox=null;this.complexClip=false;
  for(const key in this.styles)this.styles[key]=this.raw[key];
 }
 begin(){this.resize();this.serial++;this.count=0;this.stats={draws:0,uploads:0,uploadPixels:0,fallbacks:0};const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,this.target.f);g.disable(g.SCISSOR_TEST);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);}
 matrixChanged(){const m=this.raw.getTransform();this.matrix=[m.a,m.b,m.c,m.d,m.e,m.f];}
 setTransform(...a){this.raw.setTransform(...a);this.matrixChanged();}
 resetTransform(){this.raw.resetTransform();this.matrixChanged();}
 translate(...a){this.raw.translate(...a);this.matrixChanged();}
 scale(...a){this.raw.scale(...a);this.matrixChanged();}
 rotate(...a){this.raw.rotate(...a);this.matrixChanged();}
 transform(...a){this.raw.transform(...a);this.matrixChanged();}
 save(){this.raw.save();this.stack.push([this.matrix.slice(),this.clipBox?.slice(),this.complexClip,{...this.styles}]);}
 restore(){this.raw.restore();const s=this.stack.pop();if(s)[this.matrix,this.clipBox,this.complexClip,this.styles]=s;}
 point(x,y){const [a,b,c,d,e,f]=this.matrix;return[a*x+c*y+e,b*x+d*y+f];}
 box(x,y,w,h){const p=[this.point(x,y),this.point(x+w,y),this.point(x+w,y+h),this.point(x,y+h)];return[Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))];}
 visible(box){const c=this.clipBox||[0,0,this.canvas.width,this.canvas.height];return box[2]>c[0]&&box[0]<c[2]&&box[3]>c[1]&&box[1]<c[3];}
 color(value){if(typeof value!=='string')return null;if(this.colors.has(value))return this.colors.get(value);let c;
  if(value[0]==='#'){const hex=value.slice(1);c=hex.length===6?[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255):hex.length===3?[...hex].map(v=>parseInt(v+v,16)/255):null;if(c)c.push(1);}
  else {const m=value.match(/^rgba?\(([^)]+)\)$/);if(m){const a=m[1].split(',').map(Number);c=[a[0]/255,a[1]/255,a[2]/255,a[3]??1];}}
  if(this.colors.size>128)this.colors.clear();this.colors.set(value,c);return c;
 }
 texture(image){const g=this.gl,w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;if(!w||!h)return null;
  const immutable=fixed.has(image)||!!image.naturalWidth||typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap,source=image.currentSrc||image.src||'';let entry=this.textures.get(image);
  if(!entry){entry={t:this.renderer.texture(),w:0,h:0};this.textures.set(image,entry);}
  if((!immutable&&(versions.get(image)===undefined||entry.version!==versions.get(image)))||entry.source!==source||entry.w!==w||entry.h!==h){this.flush();g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,entry.t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
   // Reuse storage for mutable native-cell canvases.
   if(entry.w===w&&entry.h===h)g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,image);else g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);
   g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);this.bytes+=(w*h-entry.w*entry.h)*4;entry.w=w;entry.h=h;entry.source=source;entry.version=versions.get(image);this.stats.uploads++;this.stats.uploadPixels+=w*h;
  }entry.used=this.serial;return entry;
 }
 canDirect(){return !this.complexClip&&(!this.styles.filter||this.styles.filter==='none')&&!this.styles.shadowBlur&&['source-over','screen','lighter','multiply'].includes(this.styles.globalCompositeOperation);}
 drawImage(image,...a){let sx=0,sy=0,sw=image.naturalWidth||image.width,sh=image.naturalHeight||image.height,dx,dy,dw,dh;
  if(a.length===2)[dx,dy,dw,dh]=[...a,sw,sh];else if(a.length===4)[dx,dy,dw,dh]=a;else [sx,sy,sw,sh,dx,dy,dw,dh]=a;
  if(!dw||!dh||!sw||!sh||!this.visible(this.box(dx,dy,dw,dh)))return;
  if(!this.canDirect())return this.fallback('drawImage',[image,...a],this.box(dx,dy,dw,dh));
  if(image.gpuTexture){if(image.owner!==this.renderer)throw Error('Foreign GPU sprite');const alpha=this.styles.globalAlpha;this.quad(image.gpuTexture,[sx/image.width,1-sy/image.height,(sx+sw)/image.width,1-(sy+sh)/image.height],this.boxPoints(dx,dy,dw,dh),[alpha,alpha,alpha,alpha],[0,0,1,1]);return;}
  const t=this.texture(image);if(!t)return;const alpha=this.styles.globalAlpha;
  this.quad(t.t,[sx/t.w,sy/t.h,(sx+sw)/t.w,(sy+sh)/t.h],this.boxPoints(dx,dy,dw,dh),[alpha,alpha,alpha,alpha],[(sx+.5)/t.w,(sy+.5)/t.h,(sx+sw-.5)/t.w,(sy+sh-.5)/t.h]);
 }
 boxPoints(x,y,w,h){const [a,b,c,d,e,f]=this.matrix,p=this.rectPoints;const px=a*x+c*y+e,py=b*x+d*y+f;
  p[0][0]=px;p[0][1]=py;p[1][0]=px+a*w;p[1][1]=py+b*w;p[2][0]=px+a*w+c*h;p[2][1]=py+b*w+d*h;p[3][0]=px+c*h;p[3][1]=py+d*h;return p;}
 fillRect(x,y,w,h){const c=this.color(this.styles.fillStyle);if(!c||!this.canDirect())return this.fallback('fillRect',[x,y,w,h],this.box(x,y,w,h));const a=c[3]*this.styles.globalAlpha;this.quad(this.white,[0,0,1,1],this.boxPoints(x,y,w,h),[c[0]*a,c[1]*a,c[2]*a,a],[0,0,1,1]);}
 quad(texture,uv,p,color,crop,options={}){
  const mode=options.mode||this.styles.globalCompositeOperation,smooth=options.smooth??this.styles.imageSmoothingEnabled,clip=options.clip===false?null:this.clipBox,key=mode+':'+smooth+':'+clip;
  if(this.count&&(this.batchTexture!==texture||this.batchKey!==key||this.count+72>this.vertices.length))this.flush();
  this.batchTexture=texture;this.batchKey=key;this.batchMode=mode;this.batchSmooth=smooth;this.batchClip=clip?.slice();
  const v=this.vertices,sx=2/this.canvas.width,sy=2/this.canvas.height;let n=this.count;
  for(let j=0;j<6;j++){const i=ORDER[j];v[n++]=p[i][0]*sx-1;v[n++]=1-p[i][1]*sy;v[n++]=uv[i===0||i===3?0:2];v[n++]=uv[i<2?1:3];v[n++]=color[0];v[n++]=color[1];v[n++]=color[2];v[n++]=color[3];v[n++]=crop[0];v[n++]=crop[1];v[n++]=crop[2];v[n++]=crop[3];}this.count=n;
 }
 flush(){if(!this.count)return;const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,this.target.f);g.viewport(0,0,this.target.w,this.target.h);g.useProgram(this.program);g.bindVertexArray(this.vao);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.bufferData(g.ARRAY_BUFFER,this.vertices.subarray(0,this.count),g.STREAM_DRAW);g.enable(g.BLEND);g.blendEquation(g.FUNC_ADD);
  const dst=this.batchMode==='screen'?g.ONE_MINUS_SRC_COLOR:this.batchMode==='lighter'?g.ONE:g.ONE_MINUS_SRC_ALPHA;
  g.blendFuncSeparate(this.batchMode==='multiply'?g.DST_COLOR:g.ONE,dst,g.ONE,this.batchMode==='lighter'?g.ONE:g.ONE_MINUS_SRC_ALPHA);
  if(this.batchClip){const b=this.batchClip;g.enable(g.SCISSOR_TEST);g.scissor(Math.ceil(b[0]),this.canvas.height-Math.floor(b[3]),Math.max(0,Math.floor(b[2])-Math.ceil(b[0])),Math.max(0,Math.floor(b[3])-Math.ceil(b[1])));}else g.disable(g.SCISSOR_TEST);
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.batchTexture);const filter=this.batchSmooth?g.LINEAR:g.NEAREST;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);g.uniform1i(this.artUniform,0);g.drawArrays(g.TRIANGLES,0,this.count/12);this.stats.draws++;this.count=0;
 }
 clearRect(x,y,w,h){
  if(this.matrix[1]||this.matrix[2]||this.complexClip)throw Error('Unsupported transformed scene clear');
  this.flush();const b=this.box(x,y,w,h),c=this.clipBox||[0,0,this.canvas.width,this.canvas.height],g=this.gl;
  const left=Math.max(0,c[0],Math.floor(b[0])),top=Math.max(0,c[1],Math.floor(b[1])),right=Math.min(this.canvas.width,c[2],Math.ceil(b[2])),bottom=Math.min(this.canvas.height,c[3],Math.ceil(b[3]));
  g.bindFramebuffer(g.FRAMEBUFFER,this.target.f);g.enable(g.SCISSOR_TEST);g.scissor(left,this.canvas.height-bottom,Math.max(0,right-left),Math.max(0,bottom-top));g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.disable(g.SCISSOR_TEST);
 }
 beginPath(){this.raw.beginPath();this.pathBox=null;this.pathRect=false;}
 expand(b){if(!this.pathBox)this.pathBox=b;else this.pathBox=[Math.min(b[0],this.pathBox[0]),Math.min(b[1],this.pathBox[1]),Math.max(b[2],this.pathBox[2]),Math.max(b[3],this.pathBox[3])];}
 rect(x,y,w,h){this.raw.rect(x,y,w,h);this.pathRect=!this.pathBox&&!this.matrix[1]&&!this.matrix[2];this.expand(this.box(x,y,w,h));}
 moveTo(x,y){this.raw.moveTo(x,y);this.pathRect=false;const p=this.point(x,y);this.expand([...p,...p]);}
 lineTo(x,y){this.raw.lineTo(x,y);this.pathRect=false;const p=this.point(x,y);this.expand([...p,...p]);}
 arc(x,y,r,...a){this.raw.arc(x,y,r,...a);this.pathRect=false;this.expand(this.box(x-r,y-r,2*r,2*r));}
 ellipse(x,y,rx,ry,...a){this.raw.ellipse(x,y,rx,ry,...a);this.pathRect=false;const r=Math.max(rx,ry);this.expand(this.box(x-r,y-r,r*2,r*2));}
 bezierCurveTo(...a){this.raw.bezierCurveTo(...a);this.pathRect=false;for(let i=0;i<a.length;i+=2){const p=this.point(a[i],a[i+1]);this.expand([...p,...p]);}}
 clip(...a){this.raw.clip(...a);if(a.length||!this.pathRect||!this.pathBox){this.complexClip=true;return;}const b=this.pathBox,c=this.clipBox||[0,0,this.canvas.width,this.canvas.height];this.clipBox=[Math.max(b[0],c[0]),Math.max(b[1],c[1]),Math.min(b[2],c[2]),Math.min(b[3],c[3])];}
 fill(...a){this.fallback('fill',a,this.pathBox);}
 stroke(...a){this.fallback('stroke',a,this.pathBox);}
 strokeRect(x,y,w,h){this.fallback('strokeRect',[x,y,w,h],this.box(x,y,w,h));}
 fillText(...a){this.fallback('fillText',a,null);}
 fallback(method,args,box){this.flush();const c=this.raw,g=this.gl,scale=Math.max(Math.hypot(this.matrix[0],this.matrix[1]),Math.hypot(this.matrix[2],this.matrix[3])),pad=Math.ceil(scale*c.lineWidth*2+c.shadowBlur*3+8);
  const b=box||[0,0,this.canvas.width,this.canvas.height],x=clamp(Math.floor(b[0]-pad),0,this.canvas.width),y=clamp(Math.floor(b[1]-pad),0,this.canvas.height),w=clamp(Math.ceil(b[2]+pad),0,this.canvas.width)-x,h=clamp(Math.ceil(b[3]+pad),0,this.canvas.height)-y;if(w<=0||h<=0)return;
  const mode=c.globalCompositeOperation;if(!['source-over','screen','lighter','multiply'].includes(mode))throw Error('Unsupported scene blend: '+mode);c[method](...args);
  const pw=2**Math.ceil(Math.log2(w)),ph=2**Math.ceil(Math.log2(h));if(this.patch.width<pw)this.patch.width=pw;if(this.patch.height<ph)this.patch.height=ph;
  const pc=this.patchCtx;pc.clearRect(0,0,this.patch.width,this.patch.height);pc.drawImage(this.raster,x,y,w,h,0,0,w,h);
  c.save();c.resetTransform();c.clearRect(x,y,w,h);c.restore();
  const t=this.texture(this.patch);this.quad(t.t,[0,0,w/t.w,h/t.h],[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],[1,1,1,1],[.5/t.w,.5/t.h,(w-.5)/t.w,(h-.5)/t.h],{mode,smooth:false,clip:false});this.flush();this.stats.fallbacks++;
 }
 evict(){if(this.bytes<128*1024*1024)return;for(const [image,t]of this.textures){if(t.used>=this.serial-1)continue;this.gl.deleteTexture(t.t);this.textures.delete(image);this.bytes-=t.w*t.h*4;if(this.bytes<96*1024*1024)break;}}
 dispose(){this.flush();const g=this.gl;for(const t of this.textures.values())g.deleteTexture(t.t);if(this.target){g.deleteTexture(this.target.t);g.deleteFramebuffer(this.target.f);}g.deleteTexture(this.white);g.deleteProgram(this.program);g.deleteBuffer(this.buffer);g.deleteVertexArray(this.vao);this.textures.clear();}
}
Surface.markStatic=image=>fixed.add(image);Surface.version=(image,revision)=>versions.set(image,revision);
W.LunaStreetGpuSurface=Surface;
})(window);
