/* Unity GradeReveal/GradeRevealGlow/GradeWave HLSL is translated at import.
 * Particle positions, sizes, rotations, colors and material defaults are sampled
 * by Unity itself. Blend in a linear HDR target, then convert once to sRGB. */
(function(W){'use strict';
const VS=`#version 300 es
in vec2 corner;out vec2 vUV;out vec2 vWS;uniform vec4 rect,uvRect;uniform float angle,snap,pixelSize;uniform vec2 origin,viewport;uniform float pixelsPerUnit;
void main(){float c=cos(angle),s=sin(angle);vec2 d=corner*rect.zw;vec2 w=rect.xy+mat2(c,s,-s,c)*d;if(snap>.5)w=round(w/max(pixelSize,.0001))*max(pixelSize,.0001);vWS=w;vUV=(corner+.5)*uvRect.zw+uvRect.xy;vec2 p=origin+vec2(w.x,-w.y)*pixelsPerUnit;gl_Position=vec4(p/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);}`;
const TEX=`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D tex;uniform float alpha;out vec4 outColor;void main(){vec4 c=texture(tex,vUV);outColor=vec4(c.rgb*c.a*alpha,c.a*alpha);}`;
const FINAL=`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D tex;out vec4 outColor;void main(){vec3 c=max(texture(tex,vUV).rgb,vec3(0));c=mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));outColor=vec4(c,1);}`;
const linear=c=>c.map((v,i)=>i===3?v:(v<=.04045?v/12.92:((v+.055)/1.055)**2.4));
function create(){
 const canvas=document.createElement('canvas'),g=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!g)throw Error('Grade renderer requires WebGL2');if(!g.getExtension('EXT_color_buffer_float')){g.getExtension('WEBGL_lose_context')?.loseContext();throw Error('Grade renderer requires HDR');}
 const programs=new Map(),textures=new Map(),backgrounds=new WeakMap(),buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,.5]),g.STATIC_DRAW);
 let target=null,rt=null,width=0,height=0;
 function program(key,fs){if(programs.has(key))return programs.get(key);const p=g.createProgram();for(const [type,src]of[[g.VERTEX_SHADER,VS],[g.FRAGMENT_SHADER,fs]]){const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(key+': '+g.getShaderInfoLog(s));g.attachShader(p,s);g.deleteShader(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));const u={};for(let i=0;i<g.getProgramParameter(p,g.ACTIVE_UNIFORMS);i++){const v=g.getActiveUniform(p,i);u[v.name]=g.getUniformLocation(p,v.name);}const a=g.getAttribLocation(p,'corner');const obj={p,u,a};programs.set(key,obj);return obj;}
 function uniforms(p,values){for(const [k,v]of Object.entries(values)){const u=p.u[k];if(u==null)continue;if(Array.isArray(v)){g['uniform'+v.length+'fv'](u,v);}else g.uniform1f(u,v);}}
 function use(p,rect,angle,px,snap,origin,ppu){g.useProgram(p.p);g.bindBuffer(g.ARRAY_BUFFER,buffer);g.enableVertexAttribArray(p.a);g.vertexAttribPointer(p.a,2,g.FLOAT,false,0,0);uniforms(p,{uvRect:[0,0,1,1],rect,angle,pixelSize:px,snap,origin,viewport:[width,height],pixelsPerUnit:ppu});if(p.u.tex!=null)g.uniform1i(p.u.tex,0);}
 function texture(image,update=false,point=false){let t=textures.get(image);if(!t){t=g.createTexture();textures.set(image,t);update=true;}g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,t);if(update){g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.SRGB8_ALPHA8,g.RGBA,g.UNSIGNED_BYTE,image);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,point===true?g.NEAREST:g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,point===true?g.NEAREST:g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);if(point==='mip'){g.generateMipmap(g.TEXTURE_2D);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);}}return t;}
 function draw(out,grade,frame,motion,image,time,bg,fx,images){
  if(g.isContextLost())throw Error('Grade graphics context lost');
  const stageHeight=out.height,r=grade.imageRect,ppu=out.width/1280*440/r[2],origin=[out.width/2,(40+(r[1]+r[3])*440/r[2])*stageHeight/720];
  const cropHeight=Math.min(stageHeight,Math.ceil(origin[1]-grade.minWorldY*ppu+4));
  if(width!==out.width||height!==cropHeight){width=canvas.width=out.width;height=canvas.height=cropHeight;if(target)g.deleteFramebuffer(target);if(rt)g.deleteTexture(rt);target=g.createFramebuffer();rt=g.createTexture();g.bindTexture(g.TEXTURE_2D,rt);g.texImage2D(g.TEXTURE_2D,0,g.RGBA16F,width,height,0,g.RGBA,g.HALF_FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.bindFramebuffer(g.FRAMEBUFFER,target);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,rt,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Grade HDR target incomplete');}
  g.bindFramebuffer(g.FRAMEBUFFER,target);g.viewport(0,0,width,height);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);g.disable(g.BLEND);
  const tp=program('image',TEX),full=[0,0,width,stageHeight],screenOrigin=[width/2,stageHeight/2];
  if(bg){use(tp,full,0,0,0,screenOrigin,1);uniforms(tp,{alpha:1});const stamp=bg.dataset?.source+'|'+bg.dataset?.frame+'|'+bg.width+'x'+bg.height;texture(bg,!bg.dataset?.source||backgrounds.get(bg)!==stamp);backgrounds.set(bg,stamp);g.drawArrays(g.TRIANGLES,0,6);if(fx){g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);texture(fx,true);g.drawArrays(g.TRIANGLES,0,6);}}
  g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);
  const particles=[];for(let i=0;i<frame.particles.length;i+=12)particles.push(frame.particles.slice(i,i+12));particles.sort((a,b)=>grade.layers[a[0]].order-grade.layers[b[0]].order);
  let letter=false;function text(){if(!image)return;use(tp,[(r[0]+r[2]/2)*motion.sx,(r[1]+r[3]/2)*motion.sy,r[2]*motion.sx,r[3]*motion.sy],0,0,0,origin,ppu);uniforms(tp,{alpha:motion.opacity});texture(image,false,'mip');g.drawArrays(g.TRIANGLES,0,6);}
  for(const a of particles){const l=grade.layers[a[0]];if(!letter&&l.order>=20){text();letter=true;}if(!l.shader)continue;const key=l.shader.split('/').pop(),p=program(key,W.LUNA_SERVE_GRADE_REVEAL.shaders[key]),props=l.properties;const size=Math.min(1,l.maxSize*width/ppu/Math.max(a[4],a[5]));use(p,[a[1],a[2],a[4]*size,a[5]*size],-a[6]*Math.PI/180,props._PixelSize,props._PixelSnap,origin,ppu);const sheet=l.sheet,cell=a[11],uv=sheet?.enabled&&cell>=0?[cell%sheet.columns/sheet.columns,1-(Math.floor(cell/sheet.columns)+1)/sheet.rows,1/sheet.columns,1/sheet.rows]:[0,0,1,1];uniforms(p,{uvRect:uv,...props,_Color:l.color,_CoreColor:l.core,_Tint:l.tint,_Extent:l.extent,_PrismReach:l.reach,_SequenceTime:time,_MainTex_ST:[1,1,0,0],particleColor:linear(a.slice(7,11)).map(v=>Math.round(v*255)/255)});texture(images.get(l.texture)||images.get('white'),false,true);g.drawArrays(g.TRIANGLES,0,6);}
  if(!letter)text();g.disable(g.BLEND);g.bindFramebuffer(g.FRAMEBUFFER,null);const final=program('final',FINAL);use(final,[0,0,width,height],0,0,0,[width/2,height/2],1);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,rt);g.drawArrays(g.TRIANGLES,0,6);
  const c=out.getContext('2d');c.clearRect(0,0,width,stageHeight);c.drawImage(canvas,0,0);
 }
 try{for(const [key,source]of Object.entries(W.LUNA_SERVE_GRADE_REVEAL.shaders))program(key,source);}catch(error){g.getExtension('WEBGL_lose_context')?.loseContext();throw error;}
 return {draw,dispose(){for(const p of programs.values())g.deleteProgram(p.p);for(const t of textures.values())g.deleteTexture(t);g.deleteTexture(rt);g.deleteFramebuffer(target);g.deleteBuffer(buffer);g.getExtension('WEBGL_lose_context')?.loseContext();}};
}
W.LunaGradeEngine={create};
})(window);
