(function(root){
'use strict';
// Narrow receiver: half the original width, three quarters of its original height.
// Physics, retained ml and scoring stay unchanged; bottle-focus is unchanged.
const RECEIVER_SCALE=.5,RECEIVER_HEIGHT_SCALE=.75;
const receiverPoint=p=>({x:600+(p.x-600)*RECEIVER_SCALE,y:190+(p.y-190)*RECEIVER_HEIGHT_SCALE});
const receiverBounds=b=>{const a=receiverPoint({x:b.left,y:b.top}),z=receiverPoint({x:b.right,y:b.bottom});return {left:a.x,top:a.y,right:z.x,bottom:z.y};};
function receiverTransform(c){c.translate(600,190);c.scale(RECEIVER_SCALE,RECEIVER_HEIGHT_SCALE);c.translate(-600,-190);}
// Width tracks each parcel's emission rate, so a thin tail travels downstream
// instead of resizing the whole stream at once. Settled liquid keeps its pool radius.
function streamWidth(p){
 const speed=Math.hypot(p.vx,p.vy),falling=Math.max(0,Math.min(1,(speed-45)/85));
 const width=Math.sqrt(Math.max(.025,Math.min(1,p.emissionFlow??1)));
 return (1+(width-1)*falling)*(1+((p.emissionWidth||1)-1)*falling);
}
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
 'attribute vec4 point;attribute vec2 velocity;uniform vec3 camera;varying float inside;varying float stretch;varying vec2 direction;void main(){vec2 pos=point.xy*camera.x+camera.yz;gl_Position=vec4(pos.x/500.-1.,1.-pos.y/270.,0.,1.);float speed=length(velocity);stretch=1.+min(3.,speed/180.);direction=speed>1.?velocity/speed:vec2(0.,1.);float pooled=1.-smoothstep(45.,130.,speed);gl_PointSize=mix(16.,28.,pooled)*stretch*camera.x*point.z;inside=point.w;}',
 'precision mediump float;uniform vec4 glassBounds;varying float inside;varying float stretch;varying vec2 direction;void main(){vec2 d=gl_PointCoord*2.-1.;vec2 local=vec2(dot(d,direction),dot(d,vec2(-direction.y,direction.x))*stretch);float r=dot(local,local);if(r>1.)discard;float y=540.-gl_FragCoord.y;if(inside>.5&&y>=glassBounds.y&&(gl_FragCoord.x<glassBounds.x||gl_FragCoord.x>glassBounds.z||y>glassBounds.w))discard;float f=pow(1.-r,3.);gl_FragColor=vec4(f);}'
 );
 const composite=program(
 'attribute vec2 vertex;varying vec2 uv;void main(){uv=(vertex+1.)*.5;gl_Position=vec4(vertex,0.,1.);}',
 'precision mediump float;uniform sampler2D field;uniform vec3 tint;uniform float opacity;varying vec2 uv;void main(){float d=texture2D(field,uv).r;float a=smoothstep(.36,.51,d);if(a<.01)discard;vec2 px=vec2(.001,1./540.);float dx=texture2D(field,uv+vec2(px.x,0.)).r-texture2D(field,uv-vec2(px.x,0.)).r;float dy=texture2D(field,uv+vec2(0.,px.y)).r-texture2D(field,uv-vec2(0.,px.y)).r;float edge=1.-smoothstep(.4,.9,d);vec3 highlight=mix(tint,vec3(1.),.18);float light=clamp(edge*.5+max(0.,dy-dx)*.18,0.,.55);vec3 c=mix(tint*.94,highlight,light);gl_FragColor=vec4(c,a*opacity);}'
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
 const cameraUniform=gl.getUniformLocation(splat,'camera'),glassUniform=gl.getUniformLocation(splat,'glassBounds');
 const array=new Float32Array(1800*6);
 return {
  draw(f,rgb,opacity,points,camera){
   gl.viewport(0,0,1000,540);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
   gl.useProgram(splat);const bounds=receiverBounds(f.glass);gl.uniform4f(glassUniform,bounds.left,bounds.top,bounds.right,bounds.bottom);gl.uniform3f(cameraUniform,camera.scale,camera.x,camera.y);gl.bindBuffer(gl.ARRAY_BUFFER,dots);
   let n=0;for(const p of points){array[n++]=p.x;array[n++]=p.y;array[n++]=streamWidth(p)*(p.receiverScale||1);array[n++]=p.inside?1:0;array[n++]=p.vx;array[n++]=p.vy;}
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
   for(const v of voices){try{v.source.stop();}catch{}v.source.disconnect();v.tone.disconnect();v.gain.disconnect();}
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
    const v={source:audio.createBufferSource(),gain:audio.createGain(),tone:audio.createBiquadFilter()};
    v.source.buffer=buffers.get(selected);v.source.loop=true;
    v.tone.type='highshelf';v.tone.frequency.value=1800;v.source.connect(v.tone);v.tone.connect(v.gain);v.gain.connect(window.LunaSfx.output(audio));
    v.gain.gain.setValueAtTime(0,audio.currentTime);
    v.source.onended=()=>{v.source.disconnect();v.tone.disconnect();v.gain.disconnect();voices.delete(v);if(voice===v)voice=null;};
    voice=v;voices.add(v);v.source.start();
   }
   voice.tone.gain.setTargetAtTime(-1.5+Math.min(1,f.caughtMl/f.targetMl)*2.5,audio.currentTime,.12);
   voice.gain.gain.setTargetAtTime(window.LunaSfx.level("pour"+selected)*Math.sqrt(f.flow),audio.currentTime,.035);
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

 function mode(){return ['classic','clean','bottle'].includes(ui.pourPresentation)?ui.pourPresentation:'classic';}
 // Camera is presentation-only: physical emission, collisions and ml scoring stay unchanged.
 function cameraFor(s){
  if(mode()!=='bottle')return {scale:1,x:0,y:0};
  const t=clamp(s.angle/95,0,1),k=t*t*(3-2*t),scale=1.55+.35*k,at=root.LunaPour.nozzle(s.angle,s.fluid.tool);
  // Follow the actual pourer outlet every frame, including return-to-upright.
  // Use the same centered camera for the bottle and both liquid renderers.
  return {scale,x:500-at.x*scale,y:270-at.y*scale};
 }
 function controlsHTML(s){
  const f=s.fluid,locked=f.finishRequested||s.held||s.angle>.05;
  const arrow='<svg viewBox="0 0 24 36" aria-hidden="true"><path d="m7 7 11 11L7 29"/></svg>';
  const pourer='<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M44 100h32l-4-30H48z" fill="#111e2b" stroke="#6996a6" stroke-width="2"/><path d="M42 73h36v9H42z" fill="#5b7889"/><path d="M58 72 65 43 59 20" fill="none" stroke="#354c5d" stroke-width="15" stroke-linecap="round"/><path d="M58 72 65 43 59 20" fill="none" stroke="#c1e6ed" stroke-width="8" stroke-linecap="round"/><path d="m58 68 5-26-5-20" fill="none" stroke="#f0ffff" stroke-width="2"/><path d="M72 73V56" stroke="#abcdd6" stroke-width="4"/><ellipse cx="59" cy="20" rx="6" ry="3" fill="#091724" stroke="#82cbd5"/></svg>';
  return '<aside class="pour-tool-drawer '+(s.pourToolsOpen?'is-open':'')+'" data-pour-ui><div id="pour-tools-panel" class="pour-tools-panel" '+(s.pourToolsOpen?'':'inert')+' aria-hidden="'+!s.pourToolsOpen+'"><header><small>POURING TOOL</small><h2>'+L('도구 선택','Pouring tool')+'</h2></header><div class="pour-tool-options">'+[['none',L('없음','None'),L('넓은 입구 · 빠르게','Wide mouth · faster'),'<span class="pour-empty-preview" aria-hidden="true"></span>'],['pourer',L('푸어러','Pourer'),L('가는 물줄기 · 정밀하게','Fine stream · precise'),pourer]].map(([id,name,hint,art])=>button('<span class="pour-tool-preview">'+art+'</span><strong>'+name+'</strong><small>'+hint+'</small>','pourTool','data-id="'+id+'" aria-pressed="'+(f.tool===id)+'" '+(locked?'disabled':''),'pour-tool-card')).join('')+'</div><p class="pour-tool-status" aria-live="polite">'+(f.finishRequested?L('따르기를 마무리하고 있어요.','Finishing the pour.'):locked?L('병이 바로 서면 교체할 수 있어요.','Wait until the bottle is upright.'):L('담긴 양은 유지됩니다.','The poured amount is kept.'))+'</p></div>'+button(arrow,'pourToolsToggle','aria-label="'+(s.pourToolsOpen?L('도구 선택 닫기','Close tools'):L('도구 선택 열기','Open tools'))+'" aria-expanded="'+!!s.pourToolsOpen+'" aria-controls="pour-tools-panel"','pour-tools-toggle')+'</aside>'+
   '<div class="pour-test-controls" data-pour-ui><section class="pour-test-panel" id="pour-test-panel" '+(s.pourTestsOpen?'':'hidden')+' aria-label="'+L('따르기 테스트 설정','Pour test settings')+'"><h2>'+L('테스트 설정','Test settings')+'</h2><h3>'+L('효과음','Sound')+'</h3><div class="shake-sound-picker pour-sound-picker" role="group" aria-label="'+L('따르기 효과음 선택','Pour sound selection')+'">'+[1,2].map(id=>button(L('사운드 '+id,'Sound '+id),'pourSound','data-id="'+id+'" aria-pressed="'+(ui.pourSound===id)+'"','shake-sound-option')).join('')+'<small data-pour-audio-status aria-live="polite"></small></div><h3>'+L('화면 시점','Camera view')+'</h3><div class="pour-presentation-picker" role="group" aria-label="'+L('따르기 화면 버전','Pour presentation')+'">'+[['classic','기존','Original'],['clean','가이드 없음','No guides'],['bottle','병 집중','Bottle focus']].map(([id,ko,en])=>button(L(ko,en),'pourPresentation','data-id="'+id+'" aria-pressed="'+(mode()===id)+'"','pour-presentation-option')).join('')+'</div></section>'+button(L('테스트 변경','Test settings'),'pourTestsToggle','aria-expanded="'+!!s.pourTestsOpen+'" aria-controls="pour-test-panel"','pour-tests-toggle')+'</div>';
 }
 function act(name,id){const s=g.gimmick;if(g.screen!=='gimmick'||!s?.fluid)return false;
  if(name==='pourToolsToggle'||name==='pourTestsToggle'){g.holdPour(false);const key=name==='pourToolsToggle'?'pourToolsOpen':'pourTestsOpen',other=name==='pourToolsToggle'?'pourTestsOpen':'pourToolsOpen';s[key]=!s[key];s[other]=false;return true;}
  if(name==='pourTool'){if(g.setPourTool(id)){s.pourToolsOpen=false;document.querySelector('.pour-tools-toggle')?.focus({preventScroll:true});}return true;}return false;
 }
 function key(e){const s=g.gimmick;if(g.screen!=='gimmick'||!s?.fluid||g.isPaused())return false;
  // Space always pours, even when a tool/settings button retains keyboard focus.
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)g.holdPour(true);return true;}
  if(e.code==='Escape'&&(s.pourToolsOpen||s.pourTestsOpen)){e.preventDefault();const tool=s.pourToolsOpen;s.pourToolsOpen=false;s.pourTestsOpen=false;document.querySelector(tool?'.pour-tools-toggle':'.pour-tests-toggle')?.focus({preventScroll:true});return true;}
  return false;
 }
 function html(s){
  const f=s.fluid;
  return '<div class="craft-screen fluid-screen" data-pour-presentation="'+mode()+'">'+(g.minigame?button(L('다른 기믹 선택','Other minigames'),'miniExit','','gimmick-exit'):'')+
   '<img class="gimmick-room-background" src="'+esc(D.assets.gimmick.src)+'" alt="" aria-hidden="true" draggable="false">'+
   controlsHTML(s)+
   '<div class="pour-perfect" data-pour-perfect role="status" hidden>PERFECT</div><div class="pour-workspace"><div class="pour-stage" data-fluid-stage><canvas class="pour-back" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-gpu" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-fallback" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-front" width="1000" height="540" role="img" aria-label="'+(mode()==='bottle'?L('확대한 병과 화면 아래로 흐르는 액체','Enlarged bottle pouring liquid out of view'):L('병에서 떨어져 잔에 쌓이는 실시간 2D 액체','Live 2D liquid flowing from the bottle into the glass'))+'"></canvas></div>'+
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
 function drawBack(s){
  const c=mounted.back,f=s.fluid,b=f.glass;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,1000,540);
  if(mode()==='bottle')return;
  receiverTransform(c);
  // Keep the stage transparent so zooming the bottle never scales or hides the room.
  c.fillStyle='#00000066';c.beginPath();c.ellipse((b.left+b.right)/2,480,130,12,0,0,Math.PI*2);c.fill();
  c.fillStyle='#b9e8f00d';c.fillRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
 }
 function drawFront(s,camera){
  const c=mounted.front,f=s.fluid,b=f.glass,at=root.LunaPour.nozzle(s.angle);c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,1000,540);c.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);
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
  if(f.tool==='pourer'){
  c.fillStyle='#101a20';c.fillRect(-neck/2,29,neck,15);
  c.fillStyle='#384952';c.fillRect(-neck/2-2,29,neck+4,5);
  c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(0,31);c.lineTo(2,15);c.lineTo(0,0);c.strokeStyle='#334752';c.lineWidth=10;c.stroke();
  c.strokeStyle='#b8d0d6';c.lineWidth=6;c.stroke();c.strokeStyle='#f3ffff';c.lineWidth=1.5;c.stroke();
  c.beginPath();c.moveTo(8,30);c.lineTo(9,22);c.strokeStyle='#98aeb7';c.lineWidth=2;c.stroke();
  c.fillStyle='#172c35';c.beginPath();c.ellipse(0,0,3.5,1.5,0,0,Math.PI*2);c.fill();
  }else{c.fillStyle='#0b1723';c.strokeStyle='#afcfd4';c.lineWidth=2;c.beginPath();c.ellipse(0,34,neck/2,3.5,0,0,Math.PI*2);c.fill();c.stroke();}
  c.restore();c.imageSmoothingEnabled=true;
  if(mode()==='bottle')return;
  receiverTransform(c);
  // GPT-only cosmetic carbonation: follows retained liquid; adds no ml and never changes scoring.
  if(g.variant==='gpt'&&['soda_water','tonic_water','beer','champagne','cola'].includes(s.ingredient)&&f.caughtMl>.5){
   const surface=clamp(b.bottom-3-(f.caughtMl/f.quantum)*68/(b.right-b.left-6),b.top+8,b.bottom-3),depth=b.bottom-3-surface;
   if(depth>3){c.save();c.beginPath();c.rect(b.left+4,surface,b.right-b.left-8,depth);c.clip();
    const still=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches,time=still?0:g.realTime;
    for(let i=0;i<22;i++){const x=b.left+9+((i*47)%(b.right-b.left-18)),p=(time*(.22+(i%4)*.055)+i*.137)%1,y=b.bottom-3-p*depth;c.strokeStyle='rgba(235,252,245,'+(.15+(1-p)*.32)+')';c.lineWidth=1.3;c.beginPath();c.arc(x+Math.sin(time*1.4+i)*1.2,y,1.1+(i%3)*.5,0,Math.PI*2);c.stroke();}
    c.restore();c.save();c.globalAlpha=s.ingredient==='beer'?.4:.16;c.strokeStyle='#f5edd5';c.lineWidth=s.ingredient==='beer'?5:2;c.beginPath();c.moveTo(b.left+5,surface+1);c.lineTo(b.right-5,surface+1);c.stroke();c.restore();
   }
  }
  // Glass walls are drawn after the liquid, but its interior remains transparent.
  c.lineWidth=3;c.strokeStyle='#acd6dfaa';c.beginPath();c.moveTo(b.left-3,b.top-3);c.lineTo(b.left-3,b.bottom-2);c.quadraticCurveTo(b.left-3,b.bottom+7,b.left+6,b.bottom+7);c.lineTo(b.right-6,b.bottom+7);c.quadraticCurveTo(b.right+3,b.bottom+7,b.right+3,b.bottom-2);c.lineTo(b.right+3,b.top-3);c.stroke();
  c.lineWidth=2;c.strokeStyle='#e8ffff99';c.beginPath();c.moveTo(b.left+5,b.top+12);c.lineTo(b.left+5,b.bottom-12);c.stroke();
  c.strokeStyle='#cce6edaa';c.beginPath();c.ellipse((b.left+b.right)/2,b.top,(b.right-b.left)/2+3,5,0,0,Math.PI*2);c.stroke();
  if(mode()!=='classic')return;
  const guide=clamp(b.bottom-3-(f.targetMl/f.quantum)*68/(b.right-b.left-6),b.top+10,b.bottom-8);
  c.setLineDash([5,5]);c.strokeStyle='#e4c885';c.lineWidth=1;c.beginPath();c.moveTo(b.left-12,guide);c.lineTo(b.right+18,guide);c.stroke();c.setLineDash([]);
  if(s.started&&!f.finishRequested&&f.airMl>0){
   const predicted=clamp(b.bottom-3-(s.predicted*f.unitMl/f.quantum)*68/(b.right-b.left-6),b.top+10,b.bottom-8),marker=receiverPoint({x:b.right+10,y:predicted});
   // Draw at display scale so the indicator stays legible on the smaller glass.
   c.save();c.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);
   c.beginPath();c.moveTo(marker.x,marker.y);c.lineTo(marker.x+10,marker.y-6);c.lineTo(marker.x+10,marker.y+6);c.closePath();
   c.fillStyle='#ffe8a6';c.strokeStyle='#17232e';c.lineWidth=1.5;c.lineJoin='round';c.shadowColor='#ffe3a080';c.shadowBlur=5;c.fill();c.shadowBlur=0;c.stroke();c.restore();
  }
  if(s.pourFinishFx?.perfect){const t=s.pourFinishFx.age,fade=Math.max(0,1-t/.8);c.save();c.globalAlpha=fade;c.strokeStyle='#b6fff0';c.lineWidth=3;c.shadowColor='#8affe0';c.shadowBlur=12;c.strokeRect(b.left-5,b.top-5,b.right-b.left+10,b.bottom-b.top+14);c.setLineDash([]);c.beginPath();c.moveTo(b.left-12,guide);c.lineTo(b.right+18,guide);c.stroke();c.restore();}
 }
 // Falling drops keep a narrow width across the rim; widen only as they slow into the pool.
 function liquidRadius(p){const t=clamp((Math.hypot(p.vx,p.vy)-45)/85,0,1);return (3.4+3.1*(1-t*t*(3-2*t)))*streamWidth(p)*(p.receiverScale||1);}
 function drawFallback(f,rgb,alpha,points,camera){
  const b=receiverBounds(f.glass),c=mounted.fallback;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,1000,540);if(!fallback)return;c.setTransform(camera.scale,0,0,camera.scale,camera.x,camera.y);
  // Draw one opaque mask first: overlapping particles must not turn clear spirits opaque.
  c.fillStyle='#fff';c.shadowColor='#fff';c.shadowBlur=5*(mode()==='bottle'?1:RECEIVER_SCALE);
  for(const p of points){c.save();if(p.inside){c.beginPath();c.rect(b.left,b.top,b.right-b.left,b.bottom-b.top);c.clip();}c.beginPath();c.arc(p.x,p.y,liquidRadius(p),0,Math.PI*2);c.fill();c.restore();}
  c.shadowBlur=0;c.setTransform(1,0,0,1,0,0);
  c.globalCompositeOperation='source-in';
  c.fillStyle='rgba('+rgb.join(',')+','+alpha+')';c.fillRect(0,0,1000,540);
  c.globalCompositeOperation='source-over';
 }
 function liquidAppearance(id){
  const item=g.t.shelf_items.find(i=>i.id===id);
  const values=String(item?.color??'').split(',').map(v=>v.trim());
  const valid=values.length===3&&values.every(v=>v!==''&&Number.isFinite(Number(v)));
  const rgb=valid?values.map(v=>Math.round(clamp(Number(v),0,255))):[200,230,240];
  const raw=item?.liquid_alpha;
  const alpha=raw==null||String(raw).trim()===''||!Number.isFinite(Number(raw))?.6:clamp(Number(raw),0,1);
  return {rgb,alpha};
 }
 function sync(rootElement){
  const s=g.gimmick,stage=g.screen==='gimmick'&&s?.fluid&&rootElement.querySelector('[data-fluid-stage]');
  if(!stage){stopAudio(true);audioState=null;cleanup();return;}mount(stage);const f=s.fluid;
  syncAudio(s,stage.closest('.fluid-screen'));
  const perfect=rootElement.querySelector('[data-pour-perfect]');if(perfect){perfect.hidden=!s.pourFinishFx?.perfect;perfect.style.opacity=s.pourFinishFx?Math.min(1,Math.max(0,(.8-s.pourFinishFx.age)/.2)):0;}
  const {rgb,alpha}=liquidAppearance(s.ingredient);
  stage.dataset.carbonation=String(g.variant==='gpt'&&mode()!=='bottle'&&['soda_water','tonic_water','beer','champagne','cola'].includes(s.ingredient)&&f.caughtMl>.5);stage.dataset.ingredient=s.ingredient;stage.dataset.liquidColor=rgb.join(',');stage.dataset.liquidAlpha=alpha;
  const camera=cameraFor(s),rawPoints=f.renderParticles(s,{freeFall:mode()==='bottle'}),tip=root.LunaPour.nozzle(s.angle,f.tool),mappedTip=receiverPoint(tip);
  // Keep the stream attached to the visible mouth, then blend toward the smaller receiver at its rim.
  const points=mode()==='bottle'?rawPoints:rawPoints.map(p=>{const q=receiverPoint(p),blend=p.wet?0:1-clamp((p.y-tip.y)/Math.max(1,f.glass.top-tip.y),0,1);return {...p,x:q.x+(tip.x-mappedTip.x)*blend,y:q.y+(tip.y-mappedTip.y)*blend,receiverScale:RECEIVER_SCALE};});
  stage.dataset.pourTool=f.tool;stage.dataset.flowRate=String(f.rate);stage.dataset.nozzle=JSON.stringify(root.LunaPour.nozzle(s.angle,f.tool));stage.dataset.receiverBounds=JSON.stringify(receiverBounds(f.glass));
  stage.dataset.streamSamples=points.filter(p=>p.visualOnly).length;
  stage.dataset.presentation=mode();stage.dataset.guides=String(mode()==='classic');stage.dataset.receiver=String(mode()!=='bottle');stage.dataset.visibleParticles=points.length;stage.dataset.camera=JSON.stringify(camera);
  drawBack(s);if(!fallback&&gpu)gpu.draw(f,rgb,alpha,points,camera);drawFallback(f,rgb,alpha,points,camera);drawFront(s,camera);
  mounted.gpu.style.visibility=fallback?'hidden':'visible';stage.querySelector('.pour-fallback').style.visibility=fallback?'visible':'hidden';
  const set=(selector,text)=>{const el=rootElement.querySelector(selector);if(el&&el.textContent!==text)el.textContent=text;};
  set('[data-pour-value]',s.value.toFixed(2)+' '+s.unit);
  stage.dataset.renderer=fallback?'canvas2d':'webgl';stage.dataset.particles=f.particles.length;
 }
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 return{html,sync,unlockAudio,act,key};
};
})(window);
