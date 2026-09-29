(function(global){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
const PLACES={bar:'바 문 앞',homeDoor:'집 앞',home:'집 안'},FLOWS={in:'출근길',out:'퇴근길'};
const BOTTOM=-1.09,TOP=9.238,EX=-12.18;
class OutsideModel{
 constructor(options={}){this.start(options);}
 start({place='bar',flow='out',day=0}={}){
  this.config={place:Object.hasOwn(PLACES,place)?place:'bar',flow:Object.hasOwn(FLOWS,flow)?flow:'out',day:clamp(Math.floor(Number(day)||0),0,3)};
  this.scene=this.config.place==='home'?'home':'street';this.level=this.config.place==='bar'?0:1;this.x=this.config.place==='bar'?1:this.config.place==='home'?-1.28:-16.75;this.y=this.scene==='home'||!this.level?-.7:9.62;
  this.elevatorY=this.level?TOP:BOTTOM;this.facing=this.config.place==='bar'?-1:1;this.anim='idle';this.animTime=0;this.time=0;this.paused=false;this.ride=null;this.transition=null;this.dialog=null;this.near=null;this.notice='';this.noticeLeft=0;this.arrivals=0;this.revision=0;this.updateNear();
 }
 targets(){
  if(this.scene==='home')return[{id:'exit',label:'밖으로 나가기',x:-1.581,y:-.7},{id:'sofa',label:'소파 살펴보기',x:2.557,y:-.7},{id:'terrace',label:'테라스 문 살펴보기',x:3.364,y:-.7}];
  if(this.level)return[{id:'home',label:'집에 들어가기',x:-16.715,y:9.62},{id:'elevator',label:this.elevatorY>4?'엘리베이터 · 내려가기':'엘리베이터 호출',x:EX,y:9.62}];
  return[{id:'bar',label:'바 입구',x:1.0086,y:-.7},{id:'elevator',label:this.elevatorY<4?'엘리베이터 · 올라가기':'엘리베이터 호출',x:EX,y:-.7},{id:'poster',label:'전단 살펴보기',x:-5.665,y:-.7},{id:'experiment',label:'안내문 살펴보기',x:-7.495,y:-.7},...(this.config.day>=1?[{id:'shiba',label:'시바',x:-2.87,y:-.7}]:[])];
 }
 updateNear(){this.near=this.ride||this.transition||this.dialog?null:this.targets().filter(t=>Math.abs(t.x-this.x)<(t.id==='elevator'?.62:.4)).sort((a,b)=>Math.abs(a.x-this.x)-Math.abs(b.x-this.x))[0]||null;}
 interact(){
  if(this.paused||this.ride||this.transition)return false;
  if(this.dialog){this.dialog=null;this.updateNear();this.revision++;return true;}
  this.updateNear();const t=this.near;if(!t)return false;
  if(t.id==='elevator'){
   const local=this.level?TOP:BOTTOM,remote=this.level?BOTTOM:TOP,call=Math.abs(this.elevatorY-local)>.01;
   this.ride={time:0,from:this.elevatorY,to:call?local:remote,call,duration:call?6:12};this.anim='idle';if(!call)this.x=EX;
  }else if(t.id==='home'||t.id==='exit')this.transition={time:0,to:t.id==='home'?'home':'street',swapped:false};
  else if(t.id==='bar')this.dialog={title:'바 입구',text:this.config.flow==='in'?'출근길의 도착 지점입니다. 이 탭에서는 바 영업으로 넘어가지 않고 외부 공간만 탐색합니다.':'퇴근길의 출발 지점입니다. 왼쪽 엘리베이터를 타면 집으로 갈 수 있습니다.'};
  else if(t.id==='sofa')this.dialog={title:'소파',text:'저장과 취침을 연결할 자리입니다. 지금은 공간 탐색 모드라 일차와 바 영업의 저장 데이터는 바뀌지 않습니다.'};
  else if(t.id==='terrace')this.dialog={title:'테라스',text:'이번 탐색 범위는 집 내부까지입니다. 테라스 장면은 아직 연결하지 않았습니다.'};
  else if(t.id==='shiba')this.dialog={title:'시바',text:'일차에 따라 등장하는 거리 인물입니다. 이번 버전에서는 위치와 상호작용만 확인할 수 있습니다.'};
  else this.dialog={title:t.id==='poster'?'구인 전단':'임상시험 안내문',text:'벽에 붙은 전단을 살펴봅니다. 거리 대사와 선택지는 다음 단계에서 연결합니다.'};
  this.updateNear();this.revision++;return true;
 }
 tick(dt,input={}){
  dt=clamp(Number(dt)||0,0,.05);if(this.paused)return;
  this.time+=dt;this.noticeLeft=Math.max(0,this.noticeLeft-dt);
  if(this.transition){const t=this.transition;t.time+=dt;if(t.time>=.38&&!t.swapped){t.swapped=true;this.scene=t.to;this.level=1;this.x=this.scene==='home'?-1.28:-16.75;this.y=this.scene==='home'?-.7:9.62;this.elevatorY=TOP;this.revision++;}if(t.time>=.85){this.transition=null;this.updateNear();this.revision++;}this.anim='idle';this.animTime+=dt;return;}
  if(this.ride){const r=this.ride;r.time+=dt;const p=smooth(clamp((r.time-.45)/r.duration,0,1));this.elevatorY=mix(r.from,r.to,p);if(!r.call){this.x=EX;this.y=this.elevatorY+.382;}if(r.time>=r.duration+1.1){if(!r.call){this.level=r.to===TOP?1:0;this.y=this.level?9.62:-.7;this.arrivals++;}this.elevatorY=r.to;this.ride=null;this.updateNear();this.revision++;}this.anim='idle';this.animTime+=dt;return;}
  let direction=this.dialog?0:clamp(input.move||0,-1,1),speed=input.run?1.2:.7;const bounds=this.scene==='home'?[-1.5,3.4]:this.level?[-21.65,-11.95]:[-12.48,6.1],old=this.x;this.x=clamp(this.x+direction*speed*dt,...bounds);if(direction)this.facing=direction>0?1:-1;const next=Math.abs(this.x-old)>.00001?(input.run?'run':'walk'):'idle';if(next!==this.anim)this.animTime=0;this.anim=next;this.animTime+=dt;this.updateNear();
 }
}
function create({onExit=()=>{}}={}){
 const data=global.LUNA_OUTSIDE_DATA,config={place:'bar',flow:'out',day:0},images=new Map(),keys=new Set(),pointerMoves=new Map();
 let active=false,loading=false,loadError='',model=null,host=null,canvas=null,ctx=null,cam={x:1,y:0,w:4.8},generation=0,hudSignature='',lastScene='',panorama=false;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(text,action,cls='')=>`<button class="${cls}" data-outside-action="${action}">${text}</button>`;
 function lobbyHTML(tabs){return `<div class="start-screen outside-start">${tabs}<section class="start-card outside-setup"><h2>외부 공간</h2><label for="outside-place">시작 위치</label><select id="outside-place" data-outside-setting="place">${Object.entries(PLACES).map(([v,l])=>`<option value="${v}" ${config.place===v?'selected':''}>${l}</option>`).join('')}</select><label for="outside-flow">이동 상태</label><select id="outside-flow" data-outside-setting="flow">${Object.entries(FLOWS).map(([v,l])=>`<option value="${v}" ${config.flow===v?'selected':''}>${l}</option>`).join('')}</select><label for="outside-day">일차</label><select id="outside-day" data-outside-setting="day">${[0,1,2,3].map(d=>`<option value="${d}" ${config.day===d?'selected':''}>${d}일차</option>`).join('')}</select>${button('탐색 시작 →','start','primary')}<p class="outside-setup-hint">A / D 이동 · Shift 달리기 · E 상호작용</p></section></div>`;}
 async function loadImages(){await Promise.all(Object.entries(data.assets).map(([id,a])=>{if(images.has(id))return;return new Promise((resolve,reject)=>{const im=new Image(),timeout=setTimeout(()=>reject(Error(a.src)),15000);im.onload=()=>{clearTimeout(timeout);images.set(id,im);resolve();};im.onerror=()=>{clearTimeout(timeout);reject(Error(a.src));};im.src=a.src;});}));}
 function fit(){if(host)host.style.setProperty('--outside-scale',Math.min(innerWidth/1280,innerHeight/720));}
 function clearInput(){keys.clear();pointerMoves.clear();}
 function snapCamera(){cam={x:model.scene==='home'?clamp(model.x,.34,1.14):model.x,y:model.scene==='home'?.023:model.y+.7,w:4.8};lastScene=model.scene;}
 async function start(){if(active)return;generation++;const token=generation;active=true;loading=true;loadError='';panorama=false;clearInput();model=new OutsideModel(config);snapCamera();host=document.createElement('section');host.id='outside-root';host.setAttribute('aria-label','외부 공간 탐색');host.innerHTML='<div class="outside-stage"><canvas width="1280" height="720" aria-label="루나가 이동하는 거리와 집 내부" role="img"></canvas><div class="outside-hud"><div class="outside-dynamic"></div><div class="outside-controls"><button data-outside-move="-1" aria-label="왼쪽으로 이동">‹ <kbd>A</kbd></button><button data-outside-move="1" aria-label="오른쪽으로 이동"><kbd>D</kbd> ›</button><button data-outside-action="run" aria-pressed="false">Shift · 달리기</button></div></div><div class="outside-overlay"></div></div>';document.body.append(host);document.querySelector('#app').hidden=true;canvas=host.querySelector('canvas');ctx=canvas.getContext('2d');fit();hudSignature='';draw();updateHUD();try{await loadImages();if(token!==generation)return;loading=false;host.querySelector('[data-outside-action="menu"]')?.focus({preventScroll:true});}catch(e){if(token!==generation)return;loading=false;loadError='거리 리소스를 불러오지 못했습니다. 다시 시도해 주세요.';console.error('Outside asset load:',e.message);}updateHUD();}
 function exit(){generation++;active=false;loading=false;clearInput();host?.remove();host=null;document.querySelector('#app').hidden=false;onExit();}
 function menu(){if(loading||loadError)return;clearInput();model.paused=!model.paused;hudSignature='';updateHUD();}
 function targetCamera(dt){
  if(lastScene!==model.scene)snapCamera();let w=4.8,x=model.x,y=model.scene==='home'?.023:model.y+.7;
  if(model.scene==='street'&&model.ride&&!model.ride.call){const r=model.ride,p=clamp((r.time-.45)/r.duration,0,1),zoom=smooth(clamp(r.time/3,0,1))*(1-smooth(clamp((p-.73)/.27,0,1)));w=mix(4.8,12.8,zoom);x=model.x+3.25*zoom;y=model.y+.7+1.0*zoom;}
  if(panorama&&model.scene==='street'){w=28.8;x=-7.85;y=6.6;}
  if(model.scene==='home')x=clamp(x,.34,1.14);else x=clamp(x,-22.25+w/2,6.55-w/2);
  const t=1-Math.exp(-dt*5);cam.x=mix(cam.x,x,t);cam.y=mix(cam.y,y,t);cam.w=mix(cam.w,w,t);
 }
 function position(x,y){const s=1280/cam.w;return{x:640+(x-cam.x)*s,y:360-(y-cam.y)*s};}
 function drawSprite(sp,x,y,sx=1,sy=1,flip=false,alpha=1,glow=false){const img=images.get(sp.asset);if(!img)return;const p=position(x,y),scale=1280/cam.w,w=sp.w/sp.ppu*Math.abs(sx)*scale,h=sp.h/sp.ppu*Math.abs(sy)*scale;if(p.x+w<0||p.x-w>1280||p.y+h<0||p.y-h>720)return;ctx.save();ctx.globalAlpha=alpha;if(glow)ctx.globalCompositeOperation='screen';ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale((sx<0?-1:1)*(flip?-1:1),sy<0?-1:1);ctx.drawImage(img,sp.x,sp.y,sp.w,sp.h,-w*sp.pivot.x,-h*(1-sp.pivot.y),w,h);ctx.restore();}
 function renderNode(n){if((!n.active&&n.name!=='shiba')||n.name==='Luna'||n.name==='Square'||/SAMHO|samho|Samho|Bubi/.test(n.name))return;if(n.name==='shiba'&&model.config.day<1)return;
  let y=n.y;if(model.scene==='street'&&n.ancestry.includes('Elevator')&&['Elevator','Elevator Fore','Elevator Door'].includes(n.name))y+=model.elevatorY-BOTTOM;
  // Keep the imported sprite cutouts and world coordinates; only the debug swatches at the right of the house atlas are masked by room bounds.
  const light=/City.*Light/.test(n.name);let sp=n.sprite;if(n.name==='shiba'&&data.animations.shiba){const a=data.animations.shiba;sp=a.frames[Math.floor(model.time*a.fps)%a.frames.length];}drawSprite(sp,n.x,y,n.sx,n.sy,n.flip,light?.26:1,light);
 }
 function draw(){if(!ctx||!model)return;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#090d19';ctx.fillRect(0,0,1280,720);if(loading||loadError)return;
  const nodes=data.scenes[model.scene].nodes.slice().sort((a,b)=>a.layer-b.layer||a.order-b.order||b.z-a.z);
  if(model.scene==='home'){const bg=nodes.find(n=>n.name==='main_bg');if(bg)renderNode(bg);nodes.filter(n=>n.name!=='main_bg'&&n.name!=='ForeFore_Object').forEach(renderNode);}
  else nodes.filter(n=>n.layer<9).forEach(renderNode);
  const anim=data.animations[model.anim],frame=anim.frames[Math.floor(model.animTime*anim.fps)%anim.frames.length];drawSprite(frame,model.x,model.y,1,1,model.facing>0);
  if(model.scene==='home')nodes.filter(n=>n.name==='ForeFore_Object').forEach(renderNode);else nodes.filter(n=>n.layer>=9).forEach(renderNode);
  if(model.scene==='home'){const edge=position(3.537,0).x;ctx.fillStyle='#090d19';ctx.fillRect(edge,0,Math.max(0,1280-edge),720);}
  const shade=ctx.createLinearGradient(0,0,0,720);shade.addColorStop(0,'rgba(4,8,16,.25)');shade.addColorStop(.25,'rgba(4,8,16,0)');shade.addColorStop(.85,'rgba(4,8,16,0)');shade.addColorStop(1,'rgba(4,8,16,.3)');ctx.fillStyle=shade;ctx.fillRect(0,0,1280,720);
  if(model.transition){const t=model.transition.time,alpha=t<.38?t/.38:1-(t-.38)/.47;ctx.fillStyle=`rgba(6,10,18,${clamp(alpha,0,1)})`;ctx.fillRect(0,0,1280,720);}
 }
 function updateHUD(){if(!host)return;const m=model,near=m.near,overlay=host.querySelector('.outside-overlay'),hud=host.querySelector('.outside-hud');
  const signature=JSON.stringify([loading,loadError,m.paused,m.dialog,m.scene,m.level,near?.id,near?.label,!!m.ride,m.ride?.call,panorama]);
  if(signature!==hudSignature){hudSignature=signature;
   host.querySelector('.outside-dynamic').innerHTML=`<div class="outside-status"><span>${m.config.day}일차</span><span>${FLOWS[m.config.flow]}</span><strong>${m.scene==='home'?'집 안':m.level?'주거층':'외부 거리'}</strong></div><div class="outside-top-actions">${button(panorama?'가까이 보기':'거리 전경','panorama',m.scene==='home'?'outside-hidden':'')}${button('설정 · Esc','menu')}</div><button class="outside-interact" data-outside-action="interact" ${near&&!m.paused?'':'hidden'}><kbd>E</kbd><span>${esc(near?.label||'')}</span></button>${m.ride?`<div class="outside-elevator-status">${m.ride.call?'엘리베이터를 부르는 중':m.ride.to===TOP?'올라가는 중':'내려가는 중'}<span class="outside-lift-progress"></span></div>`:''}`;
   let body='';if(loading)body='<section class="outside-dialog"><h2>외부 공간 준비 중</h2><p>거리와 집의 리소스를 불러오고 있어요.</p>'+button('로비로','exit')+'</section>';
   else if(loadError)body='<section class="outside-dialog"><h2>불러오기 실패</h2><p>'+loadError+'</p>'+button('다시 시도','retry')+button('로비로','exit')+'</section>';
   else if(m.paused)body='<section class="outside-dialog" role="dialog" aria-modal="true" aria-label="외부 공간 설정"><h2>외부 공간</h2><p>A / D · ← / → 이동<br>Shift 달리기 · E 상호작용<br>Esc 일시정지</p><div class="outside-menu-actions">'+button('계속하기','menu','primary')+button('같은 위치에서 다시 시작','restart')+button('시작 위치 다시 고르기','exit')+'</div></section>';
   else if(m.dialog)body='<section class="outside-dialog outside-object-dialog" role="dialog" aria-modal="true" aria-label="'+esc(m.dialog.title)+'"><h2>'+esc(m.dialog.title)+'</h2><p>'+esc(m.dialog.text)+'</p>'+button('닫기 · E','interact','primary')+'</section>';
   overlay.innerHTML=body;overlay.hidden=!body;hud.inert=!!body;
   if(body)overlay.querySelector('button')?.focus({preventScroll:true});
  }
  // Keep movement controls mounted: a nearby-target change must not drop pointer capture.
  const controls=host.querySelector('.outside-controls');controls.hidden=model.paused||!!model.dialog||loading||!!loadError;controls.querySelectorAll('button').forEach(b=>b.disabled=!!model.ride||!!model.transition);controls.querySelector('[data-outside-action="run"]').setAttribute('aria-pressed',keys.has('touchRun'));
  const prompt=host.querySelector('.outside-interact');if(prompt&&near){const p=position(near.x,near.y+.95);prompt.style.left=clamp(p.x,130,1150)+'px';prompt.style.top=clamp(p.y,105,580)+'px';}
  const progress=host.querySelector('.outside-lift-progress');if(progress&&m.ride)progress.style.setProperty('--progress',clamp(m.ride.time/(m.ride.duration+1.1),0,1)*100+'%');
 }
 function tick(dt){if(!active)return;if(!loading&&!loadError&&!document.hidden){const left=keys.has('KeyA')||keys.has('ArrowLeft')||[...pointerMoves.values()].includes(-1),right=keys.has('KeyD')||keys.has('ArrowRight')||[...pointerMoves.values()].includes(1);model.tick(dt,{move:Number(right)-Number(left),run:keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('touchRun')});if(!model.paused)targetCamera(Math.min(dt,.05));}draw();updateHUD();}
 document.addEventListener('change',e=>{const key=e.target.dataset?.outsideSetting;if(!key)return;const value=e.target.value;if(key==='place'&&Object.hasOwn(PLACES,value))config.place=value;if(key==='flow'&&Object.hasOwn(FLOWS,value))config.flow=value;if(key==='day')config.day=clamp(Number(value)||0,0,3);},true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-outside-action]');if(!b)return;const a=b.dataset.outsideAction;e.preventDefault();if(a==='start'){start();return;}if(!active)return;if(a==='exit')exit();else if(a==='retry'){exit();start();}else if(a==='menu')menu();else if(a==='restart'){clearInput();model.start(config);panorama=false;snapCamera();hudSignature='';}else if(a==='interact'){clearInput();model.interact();}else if(a==='panorama'){panorama=!panorama;}else if(a==='run'){keys.has('touchRun')?keys.delete('touchRun'):keys.add('touchRun');b.setAttribute('aria-pressed',keys.has('touchRun'));}updateHUD();});
 document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-outside-move]');if(!active||!b||model.paused)return;e.preventDefault();pointerMoves.set(e.pointerId,Number(b.dataset.outsideMove));b.setPointerCapture(e.pointerId);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>pointerMoves.delete(e.pointerId));
 window.addEventListener('keydown',e=>{if(!active)return;
  if(e.code==='Tab'){const scope=host.querySelector('.outside-overlay:not([hidden])')||host,buttons=[...scope.querySelectorAll('button:not([hidden]):not(:disabled)')].filter(b=>!b.closest('[inert]')&&b.getClientRects().length),i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return;}
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(['KeyA','KeyD','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','Escape','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}
  if(e.code==='Escape'&&!e.repeat){if(model.dialog){model.dialog=null;model.updateNear();updateHUD();}else menu();return;}
  if(loading||loadError||model.paused)return;if(e.code==='KeyE'&&!e.repeat){clearInput();model.interact();updateHUD();return;}
  if(['KeyA','KeyD','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))keys.add(e.code);
 },true);
 window.addEventListener('keyup',e=>{keys.delete(e.code);});
 function loseFocus(){if(!active)return;clearInput();if(!loading&&!loadError){model.paused=true;updateHUD();}}
 window.addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();});window.addEventListener('resize',fit);
 return{get active(){return active;},get model(){return model;},get loading(){return loading;},get camera(){return{...cam};},config,lobbyHTML,start,exit,tick};
}
global.LunaOutside={Model:OutsideModel,create};
})(typeof window==='undefined'?globalThis:window);
