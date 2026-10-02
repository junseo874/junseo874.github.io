(function(global){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,cls='')=>'<button class="'+cls+'" data-campaign="'+action+'">'+label+'</button>';
const path=n=>'assets/campaign/'+n;
class Campaign{
 constructor(adapter){Object.assign(this,adapter);this.session=new global.LunaCampaignEngine.Session(this.g,this.D,global.LUNA_CAMPAIGN_DATA);this.session.onStep=s=>this.storyStep(s);this.data=global.LUNA_CAMPAIGN_DATA;this.view='picker';this.dialog=null;this.token=0;this.loaded=new Set();this.scriptPromises=new Map();this.control=false;this.skipAge=0;this.firstLift=false;this.morningSeen=new Set();this.nightStarted=false;
  this.host=document.createElement('section');this.host.id='campaign-root';this.host.setAttribute('aria-label','LUNA 본편');document.body.append(this.host);this.returnButton=document.createElement('button');this.returnButton.id='campaign-developer-back';this.returnButton.textContent='← 플레이 모드 선택';this.returnButton.dataset.campaign='picker';this.returnButton.hidden=true;document.body.append(this.returnButton);
  this.host.addEventListener('click',e=>{const b=e.target.closest('[data-campaign]');if(b&&!b.disabled)this.action(b.dataset.campaign);});this.returnButton.onclick=()=>this.toPicker();
  this.host.addEventListener('input',e=>{const k=e.target.dataset.campaignInput;if(k==='bgm')this.bgm.setVolume(Number(e.target.value)/100);if(k==='sfx')global.LunaSfx.setVolume(Number(e.target.value)/100);if(k==='speed')this.g.dialogSpeed=Number(e.target.value);const out=e.target.parentElement.querySelector('output');if(out)out.textContent=k==='speed'?e.target.value+'×':e.target.value+'%';});
  this.fit=()=>this.host.style.setProperty('--campaign-scale',Math.min(innerWidth/1280,innerHeight/720));window.addEventListener('resize',this.fit);this.fit();
  // Explicit simulator deep links remain useful; the normal entry always shows the two choices.
  const q=new URLSearchParams(location.search);if(q.has('mode')||q.has('version')||q.get('dev')==='1')this.developer();else this.draw();
 }
 get active(){return this.session.active&&!this.session.developer;}
 get playView(){return this.session.developer?'developer':'game';}
 get blocking(){return !!this.dayTransition||this.view!=='game'&&this.view!=='developer';}
 resetInput(){this.releaseCinemaSkip();this.clearInput();this.outside.clearInput?.();this.control=false;this.g.gimmick&&(this.g.gimmick.held=false);}
 screen(view){this.resetInput();if(view!=='prologue'){global.Sfx?.silence();global.Sfx?.setEnabled(false);global.Sfx?.setLowpass(0);}this.view=view;this.host.classList.toggle('over-outside',view==='scene'&&this.outside.active&&!['terrace','black'].includes(this.dialog?.background));this.host.hidden=!this.blocking;document.body.classList.toggle('campaign-main',this.active);document.body.classList.toggle('campaign-awakening',view==='awakening');this.host.classList.toggle('is-awakening',view==='awakening');this.app.inert=this.blocking;const outsideRoot=document.querySelector('#outside-root');if(outsideRoot)outsideRoot.inert=this.blocking;this.returnButton.hidden=view!=='developer'||this.outside.active||this.g.phase!=='ready';this.draw();}
 draw(){if(this.view==='game'||this.view==='developer'){this.host.hidden=true;return;}this.host.hidden=false;let body='';
  if(this.view==='picker')body='<div class="campaign-picker"><img class="picker-logo" src="'+path('title-logo.png')+'" alt="Project LUNA"><h1>어떤 방식으로 플레이할까요?</h1><div class="campaign-paths">'+button('<span>01 / STORY</span><strong>본편 플레이</strong><p>루나의 첫 출근부터, 네 번의 밤까지.</p>','title','story-path')+button('<span>02 / PLAYTEST</span><strong>개발자 시뮬레이터</strong><p>바 영업 · 기믹 · 외부 공간을 자유롭게 테스트합니다.</p>','developer','dev-path')+'</div></div>';
  if(this.view==='bar-door')body=global.LunaBarDoor.html(this.doorTransition?.direction||'in');
  if(this.view==='awakening')body='<div class="campaign-wake-dark" aria-hidden="true"></div><div class="campaign-wake-white" aria-hidden="true"></div>';
  if(this.view==='title')body='<div class="campaign-title"><img class="title-logo" src="'+path('title-logo.png')+'" alt="Project LUNA"><nav aria-label="타이틀 메뉴">'+button('새 게임','new','title-choice')+button('설정','options','title-choice')+button('종료','picker','title-choice')+'</nav></div>';
  if(this.view==='day-select')body=this.card('어느 날부터 시작할까요?','<p class="campaign-day-intro">0일차는 이야기의 처음부터, 1~3일차는 그날 아침 출근길부터 시작합니다.</p><div class="campaign-days" aria-label="시작 일차">'+[0,1,2,3].map(day=>button('<span>DAY '+day+'</span><strong>'+day+'일차</strong><small>'+(day===0?'꿈 회상 · 바에서 눈뜨기':'집에서 시작 · 출근길')+'</small>','start-day:'+day,'campaign-day')).join('')+'</div>'+button('← 타이틀로','title','campaign-day-back'));
  if(this.view==='loading')body='<div class="campaign-loading" role="status"><img src="'+path('title-logo.png')+'" alt="LUNA"><p>'+esc(this.loadLabel||'밤을 준비하고 있습니다')+'</p><progress max="100" value="'+(this.loadPercent||0)+'"></progress><small>'+Math.round(this.loadPercent||0)+'%</small></div>';
  if(this.view==='load-error')body=this.card('리소스를 불러오지 못했어요','<p>'+esc(this.loadError)+'</p>'+button('다시 시도','retry-load')+button('타이틀로','title'));
  if(this.view==='options')body=this.card('설정',this.optionsHTML());
  if(this.view==='confirm-exit')body=this.card('타이틀로 돌아갈까요?','<p>진행 상황은 저장되지 않습니다.</p>'+button('계속 플레이','resume')+button('타이틀로 돌아가기','exit-run'));
  if(this.view==='sleep')body=this.card('하루를 마칠까요?','<p>오늘의 이야기를 마치고 휴식을 취합니다.</p>'+button('조금 더 둘러보기','resume')+button('하루 마치기','sleep-confirm','primary'));
  if(this.view==='notice')body=this.card(this.noticeTitle||'안내','<p>'+esc(this.noticeText)+'</p>'+button('확인','resume','primary'));
  if(this.view==='retry-drink')body=this.card('주문을 다시 확인해 주세요','<ul>'+this.drinkIssues.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>'+button('판정 화면으로','resume')+button('다시 만들기','remake','primary'));
  if(this.view==='menu')body=this.card('어떤 한 잔을 추천할까요?','<p>'+esc(this.g.name(this.session.pendingStep?.actor||'samho'))+'에게 제공할 칵테일을 골라 주세요.</p><div class="campaign-menu">'+this.g.cocktailsAvailable().map(c=>button('<img src="'+esc(this.drinkSrc(c.id))+'" alt=""><span>'+esc(this.g.name(c.id))+'</span>','drink:'+c.id)).join('')+'</div>');
  if(this.view==='response')body=this.card('어떻게 이야기를 이어갈까요?',button('삼호가 확인한 조건부터 들어볼까요?','response:A')+button('그쪽에서는 애니멀이 맡는 일이라고 생각하고 있나요?','response:B'));
  if(this.view==='observation')body=this.card('조니의 관찰 메모','<p>기억에서 직접 본 내용만 정리해 주세요.</p><div class="observation-fields"><label>고른 베이스<select id="observation-base"><option value="">선택</option><option value="gin">진</option><option value="rye">라이 위스키</option><option value="vodka">보드카</option></select></label><label>재료를 넣은 순서<select id="observation-order"><option value="">선택</option><option value="wrong">시럽 → 비터스 → 위스키</option><option value="right">위스키 → 시럽 → 비터스 → 스터</option></select></label></div><p class="campaign-error" role="alert">'+esc(this.observationError||'')+'</p>'+button('제조 기록 다시 보기','replay-memory')+button('준비 목록 완성','confirm-observation','primary'));
  if(this.view==='scene')body=this.sceneHTML();
  if(this.view==='prologue')body='<canvas class="campaign-prologue" width="480" height="270" aria-label="'+esc(this.cinema?.title||'루나의 꿈 회상 컷씬')+'"></canvas><div class="campaign-cinema-ui"><div class="bubble"><div class="txt"><span class="ghost"></span><span class="vis"></span></div><i class="tail"></i></div></div><aside class="campaign-skip" aria-label="스페이스바를 3초간 누르면 컷씬을 건너뜁니다"><span>스페이스바를 꾹 누르면 스킵</span><div class="campaign-skip-track" role="progressbar" aria-label="컷씬 스킵" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></aside>';
  if(this.view==='ending')body='<div class="campaign-ending"><img src="'+path('title-logo.png')+'" alt="Project LUNA"><p>…조금 더 해보고 싶어요.</p><span>0—3일차 플레이 완료</span>'+button('타이틀로','exit-run')+'</div>';
  this.host.innerHTML='<div class="campaign-stage view-'+this.view+'">'+body+'</div>';
  if(this.view==='prologue'&&this.cinema){const c=this.cinema;c.player?.dispose();c.player=global.LunaCinemaPlayer(this.host.querySelector('canvas'),this.host.querySelector('.campaign-cinema-ui'),c.scene);c.renderer=c.player.renderer;c.player.render(c.time,null,this.ui.gimmickAudio,global.LunaSfx.volume*.55);this.paintCinemaSkip();}
  if(this.view==='scene')this.paintLine();if(this.view==='awakening')this.paintAwakening();
  this.host.querySelector('button,select,input')?.focus({preventScroll:true});
 }
 card(title,content){return'<div class="campaign-modal-shade"><section class="campaign-card" role="dialog" aria-modal="true"><h1>'+esc(title)+'</h1>'+content+'</section></div>';}
 optionsHTML(){return '<label class="campaign-option"><span>배경 음악</span><input type="range" min="0" max="100" value="'+Math.round(this.bgm.volume*100)+'" data-campaign-input="bgm"><output>'+Math.round(this.bgm.volume*100)+'%</output></label><label class="campaign-option"><span>효과음</span><input type="range" min="0" max="100" value="'+Math.round(global.LunaSfx.volume*100)+'" data-campaign-input="sfx"><output>'+Math.round(global.LunaSfx.volume*100)+'%</output></label><label class="campaign-option"><span>대사 속도</span><input type="range" min=".5" max="3" step=".5" value="'+this.g.dialogSpeed+'" data-campaign-input="speed"><output>'+this.g.dialogSpeed+'×</output></label>'+button('배경 음악 '+(this.bgm.enabled?'켜짐':'꺼짐'),'music-toggle')+'<details><summary>조작 안내</summary><p>대사 진행: 클릭 / E / Space / Enter<br>대사 빠르게 넘기기: Control 누르기 (Mac은 ⌃ Control)<br>이동·좌석·선반 전환: A / D 또는 ← / →<br>외부 달리기: Shift · 상호작용: E<br>거리 전경: Y · 서비스 패널: Tab<br>코스터·칵테일 제공: 손님 앞으로 드래그<br>기믹: 각 화면의 조작 안내<br>설정·일시정지: ESC</p></details>'+button('돌아가기','resume','primary')+(this.active?button('타이틀로','ask-exit'):'');}
 drinkSrc(id){return(this.D.assets['recipe_cocktail_'+id]||this.D.assets['cocktail_'+id]||this.D.assets.item_old_fashioned).src;}
 portrait(actor){const states=this.D.characterLayers[actor];if(!states)return '';const keys=states[Object.keys(states).find(k=>k.endsWith('idle_default'))||Object.keys(states)[0]];return '<div class="campaign-portrait" aria-hidden="true">'+keys.map(k=>{const a=this.D.assets[k];return'<span style="background-image:url('+esc(a.src)+');background-size:'+((a.frames||1)*100)+'% 100%"></span>';}).join('')+'</div>';}
 sceneHTML(){const c=this.dialog,r=c.rows[c.index],textOnly=['street','city','home'].includes(c.background);if(c.background==='black')return '<div class="campaign-black-scene"><button class="campaign-speech" data-campaign="next" aria-label="다음 대사"><strong>'+esc(r.who||this.g.name(r.actor))+'</strong><p><span class="campaign-measure" aria-hidden="true">'+esc(r.text)+'</span><span class="campaign-ink"></span></p></button></div>';if(c.background==='terrace')return global.LunaTerrace.html(c);let image=c.background==='home'&&this.homeBackdrop?this.homeBackdrop:c.background==='city'&&this.cityBackdrop?this.cityBackdrop:c.background==='street'&&this.streetBackdrop?this.streetBackdrop:c.background==='lab'?path('lab.png'):c.background==='bar'?(this.D.assets.bar?.src||path('title-bg.png')):path('title-bg.png');return '<div class="campaign-story-bg '+esc(c.background)+'" style="background-image:url('+esc(image)+')"></div><div class="campaign-scene-label">'+esc(c.title)+'</div>'+this.portrait(r.actor)+(c.memory?'<aside class="campaign-memory-note"><small>조니의 제조 기록 · 배합 가안</small><strong>라이 위스키 45ml → 심플 시럽 5ml<br>→ 아로마틱 비터스 2ml → 스터</strong><span>올드패션드 잔 · 각 계량 허용 오차 ±5ml</span></aside>':'')+'<button class="campaign-speech '+(textOnly?'text-only ':'')+(r.actor==='luna'?'luna':'')+'" data-campaign="next" aria-label="다음 대사">'+(textOnly?'':'<strong>'+esc(r.who||Object.entries(this.data.actors).find(([n,id])=>id===r.actor)?.[0]||'')+'</strong>')+'<p><span class="campaign-measure" aria-hidden="true">'+esc(r.text)+'</span><span class="campaign-ink"></span></p><i aria-hidden="true">▾</i></button>';}
 paintLine(){if(!this.dialog)return;const r=this.dialog.rows[this.dialog.index],ink=this.host.querySelector('.campaign-ink');if(ink)ink.textContent=r.text.slice(0,Math.floor(this.dialog.chars));}
 scene(key,title,background,done,extra={}){const terrace=key==='night0'||key==='ending'||background==='terrace';if(terrace)background='terrace';const rows=Array.isArray(key)?key:terrace?global.LunaTerrace.rows(key,this.data):this.data.scenes[key];if(!rows?.length)throw Error('없는 본편 장면: '+key);this.dialog={rows,title,background,done,index:0,chars:0,...extra,homeToTerrace:false};this.screen('scene');}
 next(){if(this.dayTransition)return;if(this.view==='prologue')return;if(this.view!=='scene')return;const c=this.dialog,r=c.rows[c.index];if(c.chars<r.text.length){c.chars=r.text.length;this.paintLine();return;}if(++c.index>=c.rows.length){this.dialog=null;c.done();return;}c.chars=0;this.draw();}
 async preload(label,urls,done){const token=++this.token;this.loadLabel=label;this.loadPercent=0;this.screen('loading');const unique=[...new Set(urls.filter(Boolean))];const retry=()=>this.preload(label,urls,done);this.retryLoad=retry;try{let n=0;await Promise.all(unique.map(src=>this.image(src).then(()=>{if(token===this.token){this.loadPercent=++n/unique.length*100;this.draw();}})));if(token!==this.token)return;done();}catch(e){if(token!==this.token)return;this.loadError='네트워크 연결을 확인해 주세요. 실패한 리소스: '+e.message;this.screen('load-error');}}
 image(src){if(this.loaded.has(src))return Promise.resolve();return new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>reject(Error(src)),20000);im.onload=()=>{clearTimeout(timer);this.loaded.add(src);resolve();};im.onerror=()=>{clearTimeout(timer);reject(Error(src));};im.src=src;});}
 script(name){if(this.scriptPromises.has(name))return this.scriptPromises.get(name);const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='cinematic/'+name+'.js?v=dream-opening-1';s.onload=resolve;s.onerror=()=>{this.scriptPromises.delete(name);s.remove();reject(Error(s.src));};document.head.append(s);});this.scriptPromises.set(name,p);return p;}
 async newGame(day=0){if(!Number.isInteger(day)||day<0||day>3)return;this.cancelDayTransition();this.cancelDoorTransition();this.disposeCinema();this.token++;this.outside.exit(true);this.dialog=null;this.awakening=null;this.liftLogoPending=false;if(this.session.active)this.session.uninstall();this.session=new global.LunaCampaignEngine.Session(this.g,this.D,this.data);this.session.onStep=s=>this.storyStep(s);this.session.install();this.firstLift=false;this.morningSeen.clear();this.nightStarted=false;this.clearInput();this.g.lang='ko';this.ui.variant='original';this.ui.minigames=false;this.ui.outside=false;this.ui.inspector=false;this.ui.auto=false;this.g.speed=1;this.loadLabel=day===0?'루나의 꿈 회상을 불러오는 중':day+'일차 · 출근길을 준비하고 있습니다';this.loadPercent=0;this.screen('loading');const token=this.token;this.retryLoad=()=>this.newGame(day);try{if(day>0){this.session.beginCommute(day);await this.street('in','home',true);return;}for(const[i,name]of ['assets','sprites','stage','stage3','stage4','engine','sfx','scene5','player'].entries()){await this.script(name);if(token!==this.token)return;this.loadPercent=(i+1)/9*95;this.draw();}await new Promise(resolve=>global.Sprites.load(resolve));if(token!==this.token)return;global.Engine.initAnchors?.();global.Engine.setLineOverrides({});global.Engine.setTypingScale(1);
  // Prepare the bar before the dream so no loading card interrupts waking up.
  await Promise.all(Object.values(this.D.assets).map(a=>a.src).filter(src=>/\.(png|webp|gif|jpe?g)(?:\?|$)/i.test(src)).map(src=>this.image(src)));if(token!==this.token)return;
  // Only Luna’s dream opens the game; the other cutscenes remain for later.
  const scenes=[global.buildScene5()];
  this.cinema={scenes,index:0,scene:scenes[0],time:0,player:null,renderer:null};
  this.cinemaHintUntil=performance.now()+5000;this.cinemaBgmMuted=this.bgm.audio.muted;this.bgm.audio.muted=true;
  this.screen('prologue');global.Sfx?.resume();
 }catch(e){if(token!==this.token)return;this.loadError=e.message;this.screen('load-error');}}
 async playBDCinema(model){
  if(model!==this.outside.model||!this.outside.active)return;this.disposeCinema();const token=++this.token,day=model.config.day,flow=model.config.flow;this.loadLabel='BD 칩 · 연구소 로비 기록을 불러오는 중';this.loadPercent=0;this.screen('loading');this.retryLoad=()=>this.playBDCinema(model);
  try{const scripts=['assets','sprites','stage','stage3','stage4','engine','sfx','scene1','player'];for(const [i,name] of scripts.entries()){await this.script(name);if(token!==this.token)return;this.loadPercent=(i+1)/scripts.length*95;this.draw();}await new Promise(resolve=>global.Sprites.load(resolve));if(token!==this.token)return;global.Engine.initAnchors?.();global.Engine.setLineOverrides({});global.Engine.setTypingScale(1);
   const scene=global.buildScene1();this.cinema={scenes:[scene],index:0,scene,time:0,player:null,renderer:null,title:'BD 칩 · 연구소 로비 전투',returnTo:()=>{if(this.outside.model!==model||!this.outside.active||model.config.day!==day||model.config.flow!==flow)return;model.paused=false;this.outside.clearInput();model.updateNear();this.outside.tick(0);this.screen(this.playView);}};
   this.cinemaHintUntil=performance.now()+5000;this.cinemaBgmMuted=this.bgm.audio.muted;this.bgm.audio.muted=true;this.screen('prologue');global.Sfx?.resume();
  }catch(e){if(token!==this.token)return;this.loadError='BD 기록을 불러오지 못했어요. 재시도에는 추가 비용이 들지 않습니다. '+e.message;this.screen('load-error');}
 }
 releaseCinemaSkip(){if(this.cinemaHoldStart!=null)this.cinemaHintUntil=performance.now()+5000;this.cinemaHoldStart=null;}
 paintCinemaSkip(){const now=performance.now(),held=this.cinemaHoldStart!=null,progress=held?Math.min(1,(now-this.cinemaHoldStart)/3000):0,el=this.host.querySelector('.campaign-skip');if(el){el.classList.toggle('is-visible',held||now<(this.cinemaHintUntil||0));el.querySelector('i').style.transform='scaleX('+progress+')';el.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',Math.round(progress*100));}return progress>=1;}
 disposeCinema(keepMusicGain=false){if(!keepMusicGain)this.bgm.setTransitionGain(1);this.releaseCinemaSkip();this.cinema?.player?.dispose();this.cinema=null;global.Sfx?.silence();global.Sfx?.setEnabled(false);global.Sfx?.setLowpass(0);if(this.cinemaBgmMuted!=null){this.bgm.audio.muted=this.cinemaBgmMuted;this.cinemaBgmMuted=null;}}
 finishCinema(skipped=false){if(this.view!=='prologue'||!this.cinema)return;const returnTo=this.cinema.returnTo;if(returnTo){this.disposeCinema();returnTo();return;}this.bgm.setTransitionGain(0);this.disposeCinema(true);this.session.beginDay(0);this.g.startStoryPhase('bar');this.awakening={time:0,duration:3.3,fromWhite:!skipped};this.screen('awakening');this.render(true);}
 paintAwakening(){const w=this.awakening;if(!w)return;const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};this.bgm.setTransitionGain(smooth(w.time/w.duration));const dark=this.host.querySelector('.campaign-wake-dark'),white=this.host.querySelector('.campaign-wake-white');if(dark)dark.style.opacity=1-smooth((w.time-1)/2.3);if(white)white.style.opacity=w.fromWhite?1-smooth(w.time/.7):0;}

 startBar(day,carry){this.runDoorTransition('in',()=>Promise.all(Object.values(this.D.assets).map(a=>a.src).filter(src=>/\.(png|webp|gif|jpe?g)(?:\?|$)/i.test(src)).map(src=>this.image(src))),()=>{this.session.beginDay(day,carry);this.render(true);});}
 runDoorTransition(direction,prepare,commit){
  if(this.doorTransition)return;this.resetInput();const d={direction,prepare,commit,startedAt:performance.now(),time:0,ready:false,motionAt:null,revealAt:null};this.doorTransition=d;this.screen('bar-door');global.LunaBarDoor.paint(this.host,d);
  this.retryLoad=()=>this.runDoorTransition(direction,prepare,commit);
  Promise.all([Promise.all(global.LunaBarDoor.assets.map(src=>this.image(src))),Promise.resolve().then(()=>{if(this.doorTransition===d)return prepare();})]).then(()=>{if(this.doorTransition!==d)return;d.ready=true;document.querySelector('#outside-root')?.setAttribute('inert','');}).catch(e=>{if(this.doorTransition!==d)return;this.cancelDoorTransition();this.loadError='문 너머의 공간을 불러오지 못했어요. '+e.message;this.screen('load-error');});
 }
 cancelDoorTransition(){this.doorTransition=null;this.host.style.opacity='';}
 tickDoorTransition(dt){const d=this.doorTransition;if(!d)return false;if(document.hidden)return true;d.time+=dt;
  // The door cannot move until both the visible three-second hold and real loading complete.
  if(d.ready&&d.time>=3&&performance.now()-d.startedAt>=3000&&d.motionAt==null)d.motionAt=d.time;
  if(d.motionAt!=null&&d.time>=d.motionAt+1.7&&d.revealAt==null){try{d.commit();d.revealAt=d.time;}catch(e){this.cancelDoorTransition();this.loadError=e.message;this.screen('load-error');return true;}}
  global.LunaBarDoor.paint(this.host,d);
  if(d.revealAt!=null&&d.time>=d.revealAt+.8){this.cancelDoorTransition();if(this.outside.active)this.outside.model.paused=false;this.screen(this.playView);this.render(true);}return true;
 }
 async street(flow,place='bar',wakeAtSofa=false){if(flow==='out'&&place==='bar'){this.session.route=flow;this.runDoorTransition('out',async()=>{if(this.outside.active)this.outside.exit(true);Object.assign(this.outside.config,{flow,place,day:this.session.day,variant:'original'});await this.outside.start();if(this.outside.loadError)throw Error(this.outside.loadError);},()=>{this.outside.tick(0);});return;}const dayTransition=this.dayTransition,token=this.token;this.session.route=flow;this.screen('loading');this.loadLabel=flow==='out'?'문을 닫고, 집으로':'새로운 하루';this.draw();Object.assign(this.outside.config,{flow,place,day:this.session.day,variant:'original'});await this.outside.start({wakeAtSofa});if(token!==this.token||dayTransition&&this.dayTransition!==dayTransition)return;this.outside.tick(0);this.screen(this.playView);}
 leaveBar(){if(!this.session.settle()){this.render(true);return;}this.street('out');}
 storyStep(step){if(step.type==='campaign_menu'){this.screen('menu');return;}if(step.type==='campaign_response'){this.screen('response');return;}if(step.type==='campaign_memory'){this.scene('johnny','조니의 기억','bar',()=>this.memoryQuiz(),{memory:true});}}
 memoryQuiz(){this.observationError='';this.screen('observation');}
 completeMemory(){this.g.progress.flags.campaign_observation=true;this.scene('prepare','바 · 내일의 준비','bar',()=>{this.screen(this.playView);this.session.finishStep();this.render(true);});}
 previewCommute(model){model.notionCommuteSeen=true;model.story.cancel();model.backgroundStory.cancel();this.streetBackdrop=this.outside.snapshot();this.scene('commute'+model.config.day,'출근길 · 삼호','street',()=>this.screen('developer'));}
 interactOutside(model,target){if(model!==this.outside.model||model.qa)return false;
  if(target.id==='terrace'&&(this.active||this.session.developer)){model.story.cancel();model.backgroundStory.cancel();const rows=global.LunaTerrace.rows('night0',this.data).slice(2,6);this.scene(rows,'테라스','terrace',()=>this.screen(this.playView));return true;}
  if(!this.active){if(!this.session.developer)return false;
   if(target.id==='sofa'){this.sleepOutsideTest(model);return true;}
   if(model.config.day<2)return false;
   if(target.id==='story-samho'){this.previewCommute(model);return true;}
   return false;
  }
  if(target.id==='bar'){if(this.session.route==='in'){this.outside.exit(true);this.startBar(this.session.day,this.session.carry);}else this.notice('오늘 영업은 끝났어요. 왼쪽 엘리베이터를 타고 집으로 돌아가세요.');return true;}
  if(target.id==='sofa'){if(this.session.route==='out'){this.resumeView='game';this.screen('sleep');}else this.notice('새로운 하루가 시작됐어요. 문을 나서 바에 출근해 주세요.');return true;}
  return false;
 }
 quietLift(model){if(!this.active||this.session.day!==0||model.level!==0||this.firstLift)return false;this.firstLift=true;this.liftLogoPending=true;model.backgroundStory.cancel();model.story.cancel();return true;}
 notice(text,title='루나'){this.resumeView=this.view==='game'?'game':this.view;this.noticeText=text;this.noticeTitle=title;this.screen('notice');}
 beginDayTransition(from,to,prepare){
  if(this.dayTransition)return;
  const host=document.createElement('section');host.className='campaign-day-transition';host.setAttribute('role','status');host.setAttribute('aria-label','Day '+from+' → Day '+to);
  host.innerHTML='<div class="day-transition-shade"></div><div class="day-transition-title" aria-hidden="true"><span>Day</span><span class="day-transition-digits"><span class="day-digit-old">'+from+'</span><span class="day-digit-new">'+to+'</span></span></div>';
  this.dayTransition={from,to,time:0,host,prepare,started:false,ready:false,revealAt:null};document.body.append(host);this.resetInput();this.app.inert=true;document.querySelector('#outside-root')?.setAttribute('inert','');this.paintDayTransition();
 }
 cancelDayTransition(){this.dayTransition?.host.remove();this.dayTransition=null;}
 paintDayTransition(){
  const d=this.dayTransition;if(!d)return;const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const roll=smooth((d.time-1.55)/.65),reveal=d.revealAt==null?0:smooth((d.time-d.revealAt)/.9);
  d.host.querySelector('.day-transition-shade').style.opacity=smooth(d.time/.65)*(1-reveal);
  d.host.querySelector('.day-transition-title').style.opacity=smooth((d.time-.7)/.3)*(1-smooth((d.time-3)/.3));
  const old=d.host.querySelector('.day-digit-old'),next=d.host.querySelector('.day-digit-new');old.style.transform='translateY('+(-roll*110)+'%)';old.style.opacity=1-roll;next.style.transform='translateY('+((1-roll)*110)+'%)';next.style.opacity=roll;
 }
 tickDayTransition(dt){
  const d=this.dayTransition;if(!d)return false;if(document.hidden)return true;d.time+=dt;
  if(d.time>=2.25&&!d.started){d.started=true;Promise.resolve().then(()=>{if(this.dayTransition===d)return d.prepare();}).then(()=>{if(this.dayTransition===d)d.ready=true;}).catch(e=>{if(this.dayTransition!==d)return;this.cancelDayTransition();this.nightStarted=false;this.loadError=e.message;this.retryLoad=()=>this.beginDayTransition(d.from,d.to,d.prepare);this.screen('load-error');});}
  if(d.ready&&d.time>=3.4&&d.revealAt==null)d.revealAt=d.time;
  this.paintDayTransition();
  if(d.revealAt!=null&&d.time>=d.revealAt+.9){this.cancelDayTransition();this.screen(this.playView);this.render(true);}
  return true;
 }
 sleepOutsideTest(model){
  if(model!==this.outside.model||model.qa||!this.outside.active)return;
  if(model.config.flow!=='out'){this.notice('지금은 출근길입니다. 바에 다녀온 뒤 퇴근길 상태에서 하루를 마칠 수 있어요.','소파');return;}
  if(this.outsideSleep===model)return;
  const day=model.config.day;if(day<0||day>3)return;
  this.outsideSleep=model;model.story.cancel();model.backgroundStory.cancel();this.outside.clearInput();
  const finish=()=>{
   if(this.outsideSleep!==model)return;this.outsideSleep=null;
   // A cancelled preview or a restarted test must not advance a different run.
   if(!this.session.developer||!this.outside.active||this.outside.model!==model||model.config.day!==day)return;
   if(day===3){this.screen('developer');this.outside.exit();this.notice('3일차 테라스 대화까지 마쳤습니다. 외부 테스트 시작 화면에서 일차를 다시 고를 수 있어요.','외부 일차 테스트 완료');return;}
   this.beginDayTransition(day,day+1,()=>{if(!this.session.developer||this.outside.model!==model)throw Error('외부 테스트가 변경되었습니다.');if(!this.outside.advanceDay())throw Error('다음 일차로 이동하지 못했습니다.');this.screen('developer');});
  };
  this.playSleepScenes(day,finish);
 }
 playSleepScenes(day,finish){
  const terrace=()=>{const key=global.LunaTerrace.nightKey(day);if(key&&this.data.scenes[key]?.length)this.scene(key,'테라스','terrace',finish);else finish();};
  // Player-only interlude: no Luna knowledge/relationship flags are changed here.
  if(day===1&&this.data.scenes.workshop?.length)this.scene('workshop','포트의 작업장','black',terrace);else terrace();
 }
 sleep(){
  if(this.nightStarted)return;this.nightStarted=true;this.outside.model?.story.cancel();this.outside.model?.backgroundStory.cancel();this.outside.exit(true);
  const d=this.session.day;
  const finish=()=>{if(d===3){this.session.endDay();this.nightStarted=false;this.screen('ending');return;}this.beginDayTransition(d,d+1,async()=>{if(this.session.day===d&&!this.session.endDay())throw Error('일차 종료 상태를 확인해 주세요.');if(this.session.day!==d+1)throw Error('다음 일차 상태를 확인해 주세요.');this.nightStarted=false;await this.street('in','home',true);});};
  this.playSleepScenes(d,finish);
 }

 tick(dt){dt=Math.min(.05,Math.max(0,dt));if(this.outside.active&&this.outside.devConsoleOpen&&!this.blocking)return false;if(this.doorTransition)return this.tickDoorTransition(dt);if(this.dayTransition)return this.tickDayTransition(dt);this.returnButton.hidden=this.view!=='developer'||this.outside.active||this.g.phase!=='ready';if(this.view==='scene'&&!document.hidden){this.dialog.chars+=dt*60*this.g.dialogSpeed;this.paintLine();if(this.control){this.skipAge+=dt;if(this.skipAge>.12){this.skipAge=0;this.next();}}}
  if(this.view==='prologue'&&!document.hidden){
   const c=this.cinema,previous=c.time;c.time=Math.min(c.scene.end,c.time+dt);
   c.player.render(c.time,previous,this.ui.gimmickAudio,global.LunaSfx.volume*.55);
   if(this.paintCinemaSkip()){this.finishCinema(true);return this.blocking;}
   if(c.time>=c.scene.end){if(++c.index<c.scenes.length){c.scene=c.scenes[c.index];c.time=0;global.Sfx?.silence();this.draw();}else this.finishCinema();}
  }
  if(this.view==='awakening'&&!document.hidden){this.awakening.time+=dt;this.paintAwakening();if(this.awakening.time>=this.awakening.duration){this.awakening=null;this.screen(this.playView);this.render(true);}}
  if(this.session.developer&&this.view==='developer'&&this.outside.active&&!this.outside.loading){const m=this.outside.model;if(!m.qa&&!m.remixX&&!m.paused&&!m.ride&&!m.transition&&!m.dialog&&!m.story.blocking&&m.config.flow==='in'&&m.config.day>=2&&m.scene==='street'&&m.level===0&&Math.abs(m.x+5.99)<.7&&!m.notionCommuteSeen)this.previewCommute(m);}
  if(this.active&&this.view==='game'&&this.outside.active&&!this.outside.loading){const m=this.outside.model;if(!m.paused&&this.session.route==='in'&&m.scene==='street'&&m.level===0&&m.x>-6.6&&this.session.day>=2&&!this.morningSeen.has(this.session.day)){this.morningSeen.add(this.session.day);this.streetBackdrop=this.outside.snapshot();this.scene('commute'+this.session.day,'출근길 · 삼호','street',()=>{this.g.progress.flags.samho_met=true;this.session.carry.flags.samho_met=true;this.screen(this.playView);});}
   let logo=document.querySelector('#campaign-lift-logo');const show=this.liftLogoPending&&m.ride&&!m.ride.call&&m.ride.time>3&&m.ride.time<10;if(show&&!logo){logo=document.createElement('img');logo.id='campaign-lift-logo';logo.src=path('title-logo.png');logo.alt='Project LUNA';document.querySelector('.outside-stage').append(logo);}if(!show)logo?.remove();if(this.liftLogoPending&&!m.ride)this.liftLogoPending=false;
  }
  return this.blocking;
 }
 intercept(name){if(!this.active){if(this.session.developer&&name==='offer'){const issues=this.session.problems(this.g.result);if(issues.length){this.drinkIssues=issues;this.resumeView='developer';this.screen('retry-drink');return true;}}return false;}if(['inspector','debugEndDay','debugFill','debugCraft','version','start','applyUpkeep','export'].includes(name))return true;
  if(name==='settings'||name==='help'){this.resumeView='game';this.screen('options');return true;}
  if(name==='setup'){this.resumeView='game';this.screen('confirm-exit');return true;}
  if(name==='confirmSettlement'){this.leaveBar();return true;}if(name==='retryDay'){this.session.retry();this.screen(this.playView);this.render(true);return true;}
  if(name==='offer'){const issues=this.session.problems(this.g.result);if(issues.length){this.drinkIssues=issues;this.resumeView='game';this.screen('retry-drink');return true;}}
  return false;
 }
 toPicker(){this.cancelDayTransition();this.cancelDoorTransition();this.disposeCinema();this.token++;this.outside.exit(true);this.session.uninstall();this.dialog=null;this.cinema=null;this.awakening=null;this.g.reset(0,'full',1,false,{variant:'original'});this.app.hidden=false;this.screen('picker');}
 developer(){this.cancelDayTransition();this.cancelDoorTransition();this.disposeCinema();this.token++;if(this.outside.active)this.outside.exit(true);this.session.uninstall();this.session.install({developer:true});this.g.reset(this.ui.day,this.ui.mode,this.ui.seed,false,{variant:this.ui.variant});this.app.hidden=false;this.screen('developer');this.render(true);global.LunaUpdates.mount();}
 action(a){if(a==='title'){this.screen('title');return;}if(a==='picker'){this.toPicker();return;}if(a==='developer'){this.developer();return;}if(a==='new'){this.screen('day-select');return;}if(/^start-day:[0-3]$/.test(a)){this.newGame(Number(a.slice(-1)));return;}if(a==='retry-load'){this.retryLoad();return;}if(a==='options'){this.resumeView=this.view;this.screen('options');return;}if(a==='music-toggle'){this.bgm.setEnabled(!this.bgm.enabled);this.draw();return;}if(a==='resume'){if(this.outside.active)this.outside.model.paused=false;this.screen(this.resumeView||'title');return;}if(a==='ask-exit'){this.screen('confirm-exit');return;}if(a==='exit-run'){this.toPicker();this.screen('title');return;}if(a==='next'){this.next();return;}if(a==='sleep-confirm'){this.sleep();return;}
  if(a==='remake'){this.g.cancelCraft();this.g.selectCocktail(this.g.currentOrder.cocktail);this.ui.tab='glass';this.ui.recipeOpen=false;this.ui.hoverItem=null;this.screen(this.playView);this.render(true);return;}
  if(a.startsWith('drink:')){const id=a.slice(6);if(!this.g.cocktailsAvailable().some(c=>c.id===id))return;this.g.progress.flags.campaign_selected_drink=id;this.screen(this.playView);this.session.finishStep();this.render(true);return;}
  if(a.startsWith('response:')){this.g.progress.flags.campaign_response=a.slice(9);this.scene('response'+a.slice(9),'바 · 삼호의 선택','bar',()=>{this.screen(this.playView);this.session.finishStep();this.render(true);});return;}
  if(a==='replay-memory'){this.scene('johnny','조니의 기억','bar',()=>this.memoryQuiz(),{memory:true});return;}
  if(a==='confirm-observation'){if(this.host.querySelector('#observation-base').value!=='rye'||this.host.querySelector('#observation-order').value!=='right'){this.observationError='기록과 다른 항목이 있어요. 제조 기록을 다시 확인해 주세요.';this.draw();return;}this.completeMemory();}
 }
 key(e){if(this.dayTransition||this.doorTransition)return true;if(this.outside.active&&this.outside.devConsoleOpen&&!this.blocking)return false;if(this.view==='game'&&e.code==='Escape'&&(this.g.gimmick?.pourToolsOpen||this.g.gimmick?.pourTestsOpen))return false;if(this.view==='prologue')global.Sfx?.resume();if(!this.active&&!this.blocking)return false;if(e.code==='F2')return true;if(e.code==='Escape'){if(!e.repeat){if(['options','notice','sleep','retry-drink'].includes(this.view))this.action('resume');else if(this.view==='confirm-exit')this.action('resume');else if(this.view==='day-select')this.screen('title');else if(this.view==='title')this.toPicker();else if(!['picker','loading','load-error','ending'].includes(this.view)){this.resumeView=this.view;this.screen('options');}}return true;}
  if(this.view==='day-select'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){const list=[...this.host.querySelectorAll('.campaign-day')],i=list.indexOf(document.activeElement),delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-2,ArrowDown:2}[e.code];list[i<0?0:(i+delta+4)%4]?.focus();return true;}
  if(!this.blocking)return false;if(this.view==='prologue'){if(e.code==='Space'&&!e.repeat){this.cinemaHoldStart=performance.now();this.cinemaHintUntil=this.cinemaHoldStart+5000;this.paintCinemaSkip();}return true;}if(e.code.startsWith('Control')){this.control=true;return true;}if(e.code==='Tab'){const list=[...this.host.querySelectorAll('button:not(:disabled),input,select,summary')].filter(x=>x.getClientRects().length);const i=list.indexOf(document.activeElement);if(list.length)list[(i+(e.shiftKey?-1:1)+list.length)%list.length].focus();return true;}
  if(['KeyE','Space','Enter'].includes(e.code)&&['scene','prologue'].includes(this.view)){if(!e.repeat)this.next();return true;}if(['ArrowUp','ArrowDown'].includes(e.code)&&['title','picker'].includes(this.view)){const list=[...this.host.querySelectorAll('button')],i=list.indexOf(document.activeElement);list[(i+(e.code==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();return true;}
  return !['Enter','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)||!e.target.closest('#campaign-root');
 }
}
// Registered before the simulator's capture handlers, so hidden scenes never consume input.
document.addEventListener('click',e=>{const c=global.lunaCampaign,b=e.target.closest('[data-outside-action]');if(!c?.active||!b)return;if(b.dataset.outsideAction==='exit'){e.preventDefault();e.stopImmediatePropagation();c.resumeView='game';c.screen('confirm-exit');}else if(b.dataset.outsideAction==='retry'){e.preventDefault();e.stopImmediatePropagation();c.outside.exit(true);c.outside.start();}},true);
window.addEventListener('keydown',e=>{if(global.lunaCampaign?.key(e)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('keyup',e=>{if(e.code==='Space'&&global.lunaCampaign){global.lunaCampaign.releaseCinemaSkip();if(global.lunaCampaign.view==='prologue')global.lunaCampaign.paintCinemaSkip();}if(e.code.startsWith('Control')&&global.lunaCampaign)global.lunaCampaign.control=false;},true);
window.addEventListener('blur',()=>{const c=global.lunaCampaign;if(!c)return;c.control=false;if(c.active&&['game','scene','prologue','awakening'].includes(c.view)){c.resumeView=c.view;c.screen('options');}});
document.addEventListener('visibilitychange',()=>{const c=global.lunaCampaign;if(document.hidden&&c){c.releaseCinemaSkip();if(c.view==='prologue'){c.resumeView='prologue';c.screen('options');}}});
global.LunaCampaign={create:a=>new Campaign(a)};
})(window);
