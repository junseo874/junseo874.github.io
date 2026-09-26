(function(root){
'use strict';
function makeGPU(canvas){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,depth:false,stencil:false,preserveDrawingBuffer:false});
 if(!gl)throw Error('WebGL unavailable');
 const shaders=[];
 function program(vs,fs){
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));shaders.push(s);return s;}
  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
 }
 const splat=program(
 'attribute vec4 point;attribute vec2 velocity;varying float inside;varying float stretch;varying vec2 direction;void main(){gl_Position=vec4(point.x/500.-1.,1.-point.y/270.,0.,1.);float speed=length(velocity);stretch=1.+min(3.,speed/180.);direction=speed>1.?velocity/speed:vec2(0.,1.);float pooled=1.-smoothstep(45.,130.,speed);gl_PointSize=mix(16.,28.,pooled)*stretch;inside=point.w;}',
 'precision mediump float;varying float inside;varying float stretch;varying vec2 direction;void main(){vec2 d=gl_PointCoord*2.-1.;vec2 local=vec2(dot(d,direction),dot(d,vec2(-direction.y,direction.x))*stretch);float r=dot(local,local);if(r>1.)discard;float y=540.-gl_FragCoord.y;if(inside>.5&&y>=252.&&(gl_FragCoord.x<596.||gl_FragCoord.x>790.||y>470.))discard;float f=pow(1.-r,3.);gl_FragColor=vec4(f);}'
 );
 const composite=program(
 'attribute vec2 vertex;varying vec2 uv;void main(){uv=(vertex+1.)*.5;gl_Position=vec4(vertex,0.,1.);}',
 'precision mediump float;uniform sampler2D field;uniform vec3 tint;uniform float opacity;varying vec2 uv;void main(){float d=texture2D(field,uv).r;float a=smoothstep(.36,.51,d);if(a<.01)discard;vec2 px=vec2(.001,1./540.);float dx=texture2D(field,uv+vec2(px.x,0.)).r-texture2D(field,uv-vec2(px.x,0.)).r;float dy=texture2D(field,uv+vec2(0.,px.y)).r-texture2D(field,uv-vec2(0.,px.y)).r;float edge=1.-smoothstep(.4,.9,d);vec3 c=tint*(.7+.18*uv.y)+vec3(.18,.23,.25)*edge+vec3(.24)*max(0.,dy-dx);gl_FragColor=vec4(c,a*(.24+opacity*.57+edge*.22));}'
 );
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1000,540,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Liquid render target unavailable');
 const dots=gl.createBuffer(),quad=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(splat,'point'),velocity=gl.getAttribLocation(splat,'velocity'),vertex=gl.getAttribLocation(composite,'vertex');
 const color=gl.getUniformLocation(composite,'tint'),alpha=gl.getUniformLocation(composite,'opacity');
 const array=new Float32Array(1100*6);
 return {
  draw(f,rgb,opacity){
   gl.viewport(0,0,1000,540);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
   gl.useProgram(splat);gl.bindBuffer(gl.ARRAY_BUFFER,dots);
   let n=0;for(const p of f.particles){array[n++]=p.x;array[n++]=p.y;array[n++]=0;array[n++]=p.inside?1:0;array[n++]=p.vx;array[n++]=p.vy;}
   gl.bufferData(gl.ARRAY_BUFFER,array.subarray(0,n),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,4,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(velocity);gl.vertexAttribPointer(velocity,2,gl.FLOAT,false,24,16);
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.drawArrays(gl.POINTS,0,n/6);gl.disableVertexAttribArray(position);gl.disableVertexAttribArray(velocity);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.BLEND);gl.useProgram(composite);
   gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(vertex);gl.vertexAttribPointer(vertex,2,gl.FLOAT,false,0,0);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(composite,'field'),0);
   gl.uniform3f(color,...rgb.map(v=>v/255));gl.uniform1f(alpha,opacity);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(vertex);
  },
  dispose(){gl.deleteBuffer(dots);gl.deleteBuffer(quad);gl.deleteFramebuffer(fb);gl.deleteTexture(texture);gl.deleteProgram(splat);gl.deleteProgram(composite);shaders.forEach(s=>gl.deleteShader(s));},
  lose(){gl.getExtension('WEBGL_lose_context')?.loseContext();}
 };
}
root.LunaPourView=function({g,D,L,esc,button,ui}){
 let mounted=null,gpu=null,fallback=false;
 const images=new Map();
 let audio=null,voice=null,audioState=null,audioSelection=1;
 const buffers=new Map(),jobs=new Map(),voices=new Set();
 const raw=new Map([1,2].map(id=>[id,fetch(new URL('audio/pour_0'+id+'_loop.wav',document.baseURI)).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).catch(()=>null)]));
 function unlockAudio(){
  if(ui.gimmickAudio===false||g.screen!=='gimmick'||!g.gimmick?.fluid)return;
  try{
   audio??=new(window.AudioContext||window.webkitAudioContext)();
   if(audio.state==='suspended')audio.resume().catch(()=>{});
   for(const id of [1,2])if(!jobs.has(id))jobs.set(id,raw.get(id).then(b=>{if(!b)throw Error('Missing pour audio');return audio.decodeAudioData(b.slice(0));}).then(b=>buffers.set(id,b)).catch(()=>console.warn('Pour sound '+id+' unavailable')));
  }catch{}
 }
 function stopAudio(immediate=false){
  if(immediate){
   for(const v of voices){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}
   voices.clear();voice=null;return;
  }
  const v=voice;if(!v)return;voice=null;
  const now=audio.currentTime;
  v.gain.gain.cancelScheduledValues(now);v.gain.gain.setValueAtTime(v.gain.gain.value,now);
  v.gain.gain.linearRampToValueAtTime(0,now+.08);v.source.stop(now+.085);
 }
 function syncAudio(s,screen){
  if(audioState!==s){stopAudio(true);audioState=s;}
  const selected=Number(ui.pourSound)||1;
  if(selected!==audioSelection){stopAudio();audioSelection=selected;}
  const f=s.fluid,paused=g.isPaused()||document.hidden||ui.gimmickAudio===false;
  // Match the physical emitter, including the short remaining flow while the bottle rises.
  const flowing=s.started&&f.flow>.001&&f.emittedMl<f.supplyMl-1e-8;
  if(paused)stopAudio(true);
  else if(!flowing)stopAudio();
  else if(audio?.state==='running'&&buffers.has(selected)){
   if(!voice){
    const v={source:audio.createBufferSource(),gain:audio.createGain()};
    v.source.buffer=buffers.get(selected);v.source.loop=true;
    v.source.connect(v.gain);v.gain.connect(audio.destination);
    v.gain.gain.setValueAtTime(0,audio.currentTime);
    v.source.onended=()=>{v.source.disconnect();v.gain.disconnect();voices.delete(v);if(voice===v)voice=null;};
    voice=v;voices.add(v);v.source.start();
   }
   voice.gain.gain.setTargetAtTime(.8*Math.sqrt(f.flow),audio.currentTime,.035);
  }
  screen.dataset.pourSound=selected;
  screen.dataset.pourAudioReady=String(buffers.has(selected));
  screen.dataset.pourAudioPlaying=String(!!voice);
  const status=screen.querySelector('[data-pour-audio-status]');
  if(status)status.textContent=ui.gimmickAudio===false?L('음소거','Muted'):audio&&!buffers.has(selected)?L('음원 준비 중 / 로드 실패 시 새로고침','Loading / reload if unavailable'):'';
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio(true);});
 window.addEventListener('blur',()=>stopAudio(true));
 window.addEventListener('pagehide',()=>stopAudio(true));

 function html(s){
  const f=s.fluid;
  return '<div class="craft-screen fluid-screen">'+(g.minigame?button(L('다른 기믹 선택','Other minigames'),'miniExit','','gimmick-exit'):'')+
   '<img class="gimmick-room-background" src="'+esc(D.assets.gimmick.src)+'" alt="" aria-hidden="true" draggable="false">'+
   '<div class="shake-sound-picker pour-sound-picker" role="group" aria-label="'+L('따르기 효과음 선택','Pour sound selection')+'">'+[1,2].map(id=>button(L('사운드 '+id,'Sound '+id),'pourSound','data-id="'+id+'" aria-pressed="'+(ui.pourSound===id)+'"','shake-sound-option')).join('')+'<small data-pour-audio-status aria-live="polite"></small></div>'+
   '<div class="pour-workspace"><div class="pour-stage" data-fluid-stage><canvas class="pour-back" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-gpu" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-fallback" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-front" width="1000" height="540" role="img" aria-label="'+L('병에서 떨어져 잔에 쌓이는 실시간 2D 액체','Live 2D liquid flowing from the bottle into the glass')+'"></canvas></div>'+
   '<div class="pour-top-readout"><div><span>'+L('목표량','Target')+'</span><strong class="pour-target-value">'+s.target+' '+s.unit+'</strong></div><div><span>'+L('현재량','Current')+'</span><strong data-pour-value>0.00 '+s.unit+'</strong></div></div></div>'+
   '<button class="primary hold-button pour-hold" data-hold="pour" '+(f.finishRequested?'disabled':'')+'><kbd>Space</kbd> '+L('누르고 있기','Hold to pour')+'</button>'+
   button(f.finishRequested?L('마지막 방울 정리 중…','Waiting for the final drops…'):g.minigame?L('따르기 마치기 →','Finish pouring →'):L('마치고 다음 재료 →','Finish & continue →'),'endGimmick',(!s.started||f.finishRequested?'disabled':''),'pour-finish gimmick-finish')+'</div>';
 }
 function cleanup(){
  if(!mounted)return;mounted.gpu.removeEventListener('webglcontextlost',mounted.lost);mounted.gpu.removeEventListener('webglcontextrestored',mounted.restored);
  gpu?.dispose();gpu?.lose();gpu=null;mounted=null;
 }
 function mount(stage){
  if(mounted?.stage===stage)return;cleanup();
  const back=stage.querySelector('.pour-back'),front=stage.querySelector('.pour-front'),gl=stage.querySelector('.pour-gpu'),fb=stage.querySelector('.pour-fallback');
  mounted={stage,gpu:gl,back:back.getContext('2d'),front:front.getContext('2d'),fallback:fb.getContext('2d')};
  const start=()=>{try{gpu=makeGPU(gl);fallback=false;}catch{gpu=null;fallback=true;}};
  mounted.lost=e=>{e.preventDefault();fallback=true;gpu=null;};
  mounted.restored=()=>{start();};gl.addEventListener('webglcontextlost',mounted.lost);gl.addEventListener('webglcontextrestored',mounted.restored);
  start();
 }
 function drawBack(s,rgb){
  const c=mounted.back,f=s.fluid,b=f.glass;c.clearRect(0,0,1000,540);
  // Keep the stage transparent so zooming the bottle never scales or hides the room.
  c.fillStyle='#00000066';c.beginPath();c.ellipse((b.left+b.right)/2,480,130,12,0,0,Math.PI*2);c.fill();
  c.fillStyle='#b9e8f00d';c.fillRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
 }
 function drawFront(s){
  const c=mounted.front,f=s.fluid,b=f.glass,at=root.LunaPour.nozzle(s.angle);c.clearRect(0,0,1000,540);
  const art=D.assets['item_'+s.ingredient]||D.assets.item_dummy;
  let img=images.get(art.src);if(!img){img=new Image();img.src=art.src;images.set(art.src,img);}
  c.save();c.translate(at.x,at.y);c.rotate(s.angle*Math.PI/180);
  const box=art.alphaBBox||[0,0,art.w,art.h],bw=box[2]-box[0],bh=box[3]-box[1],height=Math.min(235,110*bh/bw),width=bw/bh*height;
  const capCrop=Math.round(bh*.065);
  c.imageSmoothingEnabled=false;
  if(img.complete&&img.naturalWidth)c.drawImage(img,box[0],box[1]+capCrop,bw,bh-capCrop,-width/2,34,width,height);
  else{c.fillStyle='#709fa9';c.fillRect(-20,34,40,height);}
  // Pourer tip is local (0,0): the physical emitter and visible outlet share the same pivot.
  const neck=Math.max(16,Math.min(30,width*.4));
  c.fillStyle='#101a20';c.fillRect(-neck/2,29,neck,15);
  c.fillStyle='#384952';c.fillRect(-neck/2-2,29,neck+4,5);
  c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(0,31);c.lineTo(2,15);c.lineTo(0,0);c.strokeStyle='#334752';c.lineWidth=10;c.stroke();
  c.strokeStyle='#b8d0d6';c.lineWidth=6;c.stroke();c.strokeStyle='#f3ffff';c.lineWidth=1.5;c.stroke();
  c.beginPath();c.moveTo(8,30);c.lineTo(9,22);c.strokeStyle='#98aeb7';c.lineWidth=2;c.stroke();
  c.fillStyle='#172c35';c.beginPath();c.ellipse(0,0,3.5,1.5,0,0,Math.PI*2);c.fill();
  c.restore();c.imageSmoothingEnabled=true;
  // Glass walls are drawn after the liquid, but its interior remains transparent.
  c.lineWidth=3;c.strokeStyle='#acd6dfaa';c.beginPath();c.moveTo(b.left-3,b.top-3);c.lineTo(b.left-3,b.bottom-2);c.quadraticCurveTo(b.left-3,b.bottom+7,b.left+6,b.bottom+7);c.lineTo(b.right-6,b.bottom+7);c.quadraticCurveTo(b.right+3,b.bottom+7,b.right+3,b.bottom-2);c.lineTo(b.right+3,b.top-3);c.stroke();
  c.lineWidth=2;c.strokeStyle='#e8ffff99';c.beginPath();c.moveTo(b.left+5,b.top+12);c.lineTo(b.left+5,b.bottom-12);c.stroke();
  c.strokeStyle='#cce6edaa';c.beginPath();c.ellipse((b.left+b.right)/2,b.top,(b.right-b.left)/2+3,5,0,0,Math.PI*2);c.stroke();
  const guide=clamp(b.bottom-3-(f.targetMl/f.quantum)*68/(b.right-b.left-6),b.top+10,b.bottom-8);
  c.setLineDash([5,5]);c.strokeStyle='#e4c885';c.lineWidth=1;c.beginPath();c.moveTo(b.left-12,guide);c.lineTo(b.right+18,guide);c.stroke();c.setLineDash([]);

 }
 // Falling drops keep a narrow width across the rim; widen only as they slow into the pool.
 function liquidRadius(p){const t=clamp((Math.hypot(p.vx,p.vy)-45)/85,0,1);return 3.4+3.1*(1-t*t*(3-2*t));}
 function drawFallback(f,rgb,alpha){
  const c=mounted.fallback;c.clearRect(0,0,1000,540);if(!fallback)return;
  c.fillStyle='rgba('+rgb.join(',')+','+Math.max(.65,alpha)+')';c.shadowColor=c.fillStyle;c.shadowBlur=5;
  for(const p of f.particles){c.save();if(p.inside){c.beginPath();c.rect(f.glass.left,f.glass.top,f.glass.right-f.glass.left,f.glass.bottom-f.glass.top);c.clip();}c.beginPath();c.arc(p.x,p.y,liquidRadius(p),0,Math.PI*2);c.fill();c.restore();}
  c.shadowBlur=0;
 }
 function sync(rootElement){
  const s=g.gimmick,stage=g.screen==='gimmick'&&s?.fluid&&rootElement.querySelector('[data-fluid-stage]');
  if(!stage){stopAudio(true);audioState=null;cleanup();return;}mount(stage);const f=s.fluid;
  syncAudio(s,stage.closest('.fluid-screen'));
  const item=g.t.shelf_items.find(i=>i.id===s.ingredient),rgb=(item?.color||'200,230,240').split(',').map(Number),alpha=Number(item?.liquid_alpha||.6);
  drawBack(s,rgb);if(!fallback&&gpu)gpu.draw(f,rgb,alpha);drawFallback(f,rgb,alpha);drawFront(s);
  mounted.gpu.style.visibility=fallback?'hidden':'visible';stage.querySelector('.pour-fallback').style.visibility=fallback?'visible':'hidden';
  const set=(selector,text)=>{const el=rootElement.querySelector(selector);if(el&&el.textContent!==text)el.textContent=text;};
  set('[data-pour-value]',s.value.toFixed(2)+' '+s.unit);
  stage.dataset.renderer=fallback?'canvas2d':'webgl';stage.dataset.particles=f.particles.length;
 }
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 return{html,sync,unlockAudio};
};
})(window);
