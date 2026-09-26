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
 'attribute vec4 point;attribute vec2 velocity;varying float inside;varying float stretch;varying vec2 direction;void main(){gl_Position=vec4(point.x/500.-1.,1.-point.y/270.,0.,1.);float speed=length(velocity);stretch=1.+min(1.7,speed/280.);direction=speed>1.?velocity/speed:vec2(0.,1.);gl_PointSize=28.*stretch;inside=point.w;}',
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
root.LunaPourView=function({g,D,L,esc,button}){
 let mounted=null,gpu=null,fallback=false;
 const images=new Map();
 const unit=(s,ml)=> (ml/s.fluid.unitMl).toFixed(2)+' '+s.unit;
 function html(s){
  const f=s.fluid;
  return '<div class="craft-screen fluid-screen"><div class="craft-top"><h2>'+L('따르기','POUR')+' <small>'+esc(g.name(s.ingredient))+(s.type==='fill_up'?' · '+L('필업','FILL-UP'):'')+'</small></h2><span class="badge">'+(g.minigame?L('단독 연습','Single skill'):(g.craft.index+1)+' / '+g.craft.queue.length)+'</span>'+
   (g.minigame?button(L('기믹 선택','Choose a minigame'),'miniExit','','subtle'):button(L('레시피','Recipe'),'craftRecipe','','subtle'))+'</div>'+
   '<div class="pour-workspace"><div class="pour-stage" data-fluid-stage><canvas class="pour-back" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-gpu" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-fallback" width="1000" height="540" aria-hidden="true"></canvas><canvas class="pour-front" width="1000" height="540" role="img" aria-label="'+L('병에서 떨어져 잔에 쌓이는 실시간 2D 액체','Live 2D liquid flowing from the bottle into the glass')+'"></canvas></div>'+
   '<aside class="pour-dashboard"><div class="pour-kicker">'+L('이번 재료의 목표량','INGREDIENT TARGET')+'</div><div class="pour-goal">'+s.target+' <small>'+s.unit+'</small></div><div class="pour-dashboard-rule"></div><span>'+L('잔에 담긴 양','IN THE GLASS')+'</span><strong class="pour-live-value" data-pour-value>0.00 <small>'+s.unit+'</small></strong><div class="pour-dose"><i data-pour-dose></i><b></b></div><div class="pour-stats"><div><span>'+L('떨어지는 중','In flight')+'</span><b data-pour-air>0.00 '+s.unit+'</b></div><div><span>'+L('흘린 양','Spilled')+'</span><b data-pour-spill>0.00 '+s.unit+'</b></div></div><div class="pour-forecast"><span>'+L('지금 놓으면 예상','ESTIMATE IF RELEASED NOW')+'</span><strong data-pour-predicted>0.00 '+s.unit+'</strong><small>'+L('공중 액체 포함 · 넘침에 따라 달라져요','Includes airborne liquid; overflow may reduce it')+'</small></div><p class="pour-status" data-pour-status>'+L('길게 눌러 천천히 기울여 보세요.','Hold to tilt the bottle.')+'</p><small class="pour-render-note" data-pour-render></small></aside></div>'+
   '<footer class="pour-footer"><div><b>'+L('기울여 따르고, 놓아서 멈추기','Tilt to pour. Release to stop.')+'</b><small>'+L('잔에 도착한 액체만 측정해요. 마지막 방울까지 확인하세요.','Only liquid that reaches the glass counts. Watch the final drops.')+'</small></div><button class="primary hold-button pour-hold" data-hold="pour" '+(f.finishRequested?'disabled':'')+'><kbd>Space</kbd> '+L('누르고 있기','Hold to pour')+'</button>'+
   button(f.finishRequested?L('마지막 방울 정리 중…','Waiting for the final drops…'):g.minigame?L('따르기 마치기 →','Finish pouring →'):L('마치고 다음 재료 →','Finish & continue →'),'endGimmick',(!s.started||f.finishRequested?'disabled':''),'pour-finish')+'</footer></div>';
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
  const glow=c.createRadialGradient(670,325,10,650,325,400);glow.addColorStop(0,'#234047');glow.addColorStop(1,'#0a111b');c.fillStyle=glow;c.fillRect(0,0,1000,540);
  c.strokeStyle='#698c9812';c.lineWidth=1;
  for(let x=280;x<1000;x+=28){c.beginPath();c.moveTo(x,0);c.lineTo(x,515);c.stroke();}
  for(let y=12;y<510;y+=28){c.beginPath();c.moveTo(270,y);c.lineTo(1000,y);c.stroke();}
  const floor=c.createLinearGradient(0,480,0,540);floor.addColorStop(0,'#243133');floor.addColorStop(1,'#0a1018');c.fillStyle=floor;c.fillRect(270,480,730,60);
  c.strokeStyle='#74949655';c.beginPath();c.moveTo(270,480);c.lineTo(1000,480);c.stroke();
  c.fillStyle='#00000066';c.beginPath();c.ellipse((b.left+b.right)/2,480,130,12,0,0,Math.PI*2);c.fill();
  c.fillStyle='#b9e8f00d';c.fillRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
 }
 function drawFront(s){
  const c=mounted.front,f=s.fluid,b=f.glass,at=root.LunaPour.nozzle(s.angle);c.clearRect(0,0,1000,540);
  const art=D.assets['item_'+s.ingredient]||D.assets.item_dummy;
  let img=images.get(art.src);if(!img){img=new Image();img.src=art.src;images.set(art.src,img);}
  c.save();c.translate(at.x,at.y);c.rotate(s.angle*Math.PI/180);
  const box=art.alphaBBox||[0,0,art.w,art.h],bw=box[2]-box[0],bh=box[3]-box[1],height=175,width=bw/bh*height;
  c.imageSmoothingEnabled=false;
  if(img.complete&&img.naturalWidth)c.drawImage(img,box[0],box[1],bw,bh,-width/2,0,width,height);
  else{c.fillStyle='#709fa9';c.fillRect(-20,0,40,height);}
  c.restore();c.imageSmoothingEnabled=true;
  // Glass walls are drawn after the liquid, but its interior remains transparent.
  c.lineWidth=3;c.strokeStyle='#acd6dfaa';c.beginPath();c.moveTo(b.left-3,b.top-3);c.lineTo(b.left-3,b.bottom-2);c.quadraticCurveTo(b.left-3,b.bottom+7,b.left+6,b.bottom+7);c.lineTo(b.right-6,b.bottom+7);c.quadraticCurveTo(b.right+3,b.bottom+7,b.right+3,b.bottom-2);c.lineTo(b.right+3,b.top-3);c.stroke();
  c.lineWidth=2;c.strokeStyle='#e8ffff99';c.beginPath();c.moveTo(b.left+5,b.top+12);c.lineTo(b.left+5,b.bottom-12);c.stroke();
  c.strokeStyle='#cce6edaa';c.beginPath();c.ellipse((b.left+b.right)/2,b.top,(b.right-b.left)/2+3,5,0,0,Math.PI*2);c.stroke();
  const guide=clamp(b.bottom-3-(f.targetMl/f.quantum)*68/(b.right-b.left-6),b.top+10,b.bottom-8);
  c.setLineDash([5,5]);c.strokeStyle='#e4c885';c.lineWidth=1;c.beginPath();c.moveTo(b.left-12,guide);c.lineTo(b.right+18,guide);c.stroke();c.setLineDash([]);
  c.fillStyle='#f4d99a';c.font='15px sans-serif';c.fillText(L('목표','Target')+' '+s.target+' '+s.unit,b.right+26,guide+5);
  c.fillStyle='#b7c8ca';c.font='12px sans-serif';c.fillText(L('이번 재료 계량 · 수면선은 참고용','This ingredient only · approximate level guide'),b.left-14,510);
  // Angle gauge remains anchored in the working area, not to a moving bottle.
  c.strokeStyle='#718a9655';c.lineWidth=4;c.beginPath();c.arc(407,388,30,-Math.PI/2,Math.PI/3);c.stroke();
  c.strokeStyle='#61dde4';c.beginPath();c.arc(407,388,30,-Math.PI/2,-Math.PI/2+s.angle*Math.PI/180);c.stroke();
  c.fillStyle='#deebef';c.textAlign='center';c.font='14px monospace';c.fillText(Math.round(s.angle)+'°',407,393);c.textAlign='left';
 }
 function drawFallback(f,rgb,alpha){
  const c=mounted.fallback;c.clearRect(0,0,1000,540);if(!fallback)return;
  c.fillStyle='rgba('+rgb.join(',')+','+Math.max(.65,alpha)+')';c.shadowColor=c.fillStyle;c.shadowBlur=5;
  for(const p of f.particles){c.save();if(p.inside){c.beginPath();c.rect(f.glass.left,f.glass.top,f.glass.right-f.glass.left,f.glass.bottom-f.glass.top);c.clip();}c.beginPath();c.arc(p.x,p.y,6.5,0,Math.PI*2);c.fill();c.restore();}
  c.shadowBlur=0;
 }
 function sync(rootElement){
  const s=g.gimmick,stage=g.screen==='gimmick'&&s?.fluid&&rootElement.querySelector('[data-fluid-stage]');
  if(!stage){cleanup();return;}mount(stage);const f=s.fluid;
  const item=g.t.shelf_items.find(i=>i.id===s.ingredient),rgb=(item?.color||'200,230,240').split(',').map(Number),alpha=Number(item?.liquid_alpha||.6);
  drawBack(s,rgb);if(!fallback&&gpu)gpu.draw(f,rgb,alpha);drawFallback(f,rgb,alpha);drawFront(s);
  mounted.gpu.style.visibility=fallback?'hidden':'visible';stage.querySelector('.pour-fallback').style.visibility=fallback?'visible':'hidden';
  const set=(selector,text)=>{const el=rootElement.querySelector(selector);if(el&&el.textContent!==text)el.textContent=text;};
  set('[data-pour-value]',s.value.toFixed(2)+' '+s.unit);set('[data-pour-air]',unit(s,f.airMl));set('[data-pour-spill]',unit(s,f.spilledMl));
  set('[data-pour-predicted]',f.predicted(s).toFixed(2)+' '+s.unit);
  const dose=rootElement.querySelector('[data-pour-dose]');if(dose)dose.style.width=Math.min(100,s.value/s.target*66.67)+'%';
  set('[data-pour-render]',fallback?L('호환 그래픽 모드 · 물리·용량은 동일','Compatibility rendering · identical physics & volume'):'');
  let status=f.finishRequested?L('병을 세우고 마지막 방울을 기다리고 있어요.','Raising the bottle and waiting for the final drops.'):
   f.emittedMl>=f.supplyMl-1e-6?L('병이 비었어요. 담긴 양을 확인해 주세요.','The bottle is empty. Check the retained amount.'):
   s.value>s.target*1.05?L('목표량을 넘었어요. 병을 세워 주세요.','Over the target. Release to raise the bottle.'):
   f.predicted(s)>=s.target*.96&&f.flow>0?L('지금 놓아 보세요. 남은 액체가 마저 떨어져요.','Release now. The remaining liquid will follow.'):
   f.airMl>.01&&!s.held?L('남은 방울이 떨어지고 있어요.','The last drops are still falling.'):
   s.held?L('기울기에 따라 물줄기가 굵어져요.','The flow grows as the bottle tilts.'):
   L('Space 또는 버튼을 길게 눌러 따르세요.','Hold Space or the button to pour.');
  set('[data-pour-status]',status);
  stage.dataset.renderer=fallback?'canvas2d':'webgl';stage.dataset.particles=f.particles.length;
 }
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 return{html,sync};
};
})(window);
