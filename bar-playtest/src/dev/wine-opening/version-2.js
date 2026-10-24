
/* ============================================================
   LAST CALL — 소믈리에 와인 서빙 [TEST]  (전문가가 알려주는 와인 따르는 법 참고)
   ① 호일 벗기기    : 입구를 막은 포장 호일을 점선 따라 걷어낸다
   ② 중앙에 꽂기    : 스크류 끝을 코르크 정중앙에 맞춰 클릭
   ③ 일직선으로 돌리기 : 시계 방향으로 천천히 돌린다. 스크류가 자꾸 기울어지니 A/D로 바로 세운다
                       (대각선으로 들어가거나 너무 빠르면 코르크에 금 → 부스러기)
   ④ 지렛대 1단·2단 : 오프너 걸쇠를 병 입구에 걸고(클릭) 손잡이를 들어 올린다 × 2
                       코르크 상태(마름/보통/촉촉)에 따라 힘 조절 — 너무 빨리 들면 코르크가 찢어짐
   ⑤ 린넨 감기      : 린넨을 길게 두 번 접고, 병목에 한 바퀴 감아 서빙 준비
   ============================================================ */
const TUNE={
  CENTER_OK:8, CENTER_BAD:22,   // 중앙 오차(px): 이하 완벽 / 초과 시 금
  TURNS:4, SAFE_SPEED:1.1, DMG_RATE:50,
  TILT_DRIFT:9,                 // 초당 기울어지는 정도(°) — 빨리 돌릴수록 커짐
  TILT_FIX:40,                  // A/D 보정 속도(°/s)
  TILT_SAFE:8,                  // 이 이상 기울면 '대각선' 판정
  TILT_DMG:18,                  // 대각선일 때 초당 상태 감소
  CRACKS:[70,40,15],
  LEVER_LIFT:[60,70],           // 1단/2단 뽑히는 거리(px)
  TEAR_TOL:22,
};
const CORK_TYPES=[
  {name:'마른 코르크',safe:120,color:'#d6b483',desc:'잘 부서진다 — 아주 천천히'},
  {name:'보통 코르크',safe:220,color:'#c99b6a',desc:'적당한 힘으로'},
  {name:'촉촉한 코르크',safe:340,color:'#b07c50',desc:'조금 힘을 줘도 버틴다'},
];
const BOTTLE_SRC='../../../assets/items/item-red-wine.png';
const OPENER_SRC='../../../assets/items/wine-practice-opener.png';
const W=2184,H=1164,PX=6;
const BOTTLE_POS={x:920,y:518};
const CX=1087,RIM=526;
const NECK={x0:1036,x1:1138,y0:522,y1:820};
const CORK={h:118,w:84};
const WINE_Y=712, WORM_LEN=128, DEPTH_MAX=104;
const TEAR={y:566,x0:1014,x1:1162};
const HOOK={x:CX-58,y:RIM+6};                 // 병 입구 왼쪽 걸쇠 위치

const cv=document.getElementById('cv'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
const imgB=new Image();imgB.src=BOTTLE_SRC;const imgO=new Image();imgO.src=OPENER_SRC;
const $=id=>document.getElementById(id);

/* ---------- 사운드 ---------- */
let AC=null;
function ac(){if(WineLab.muted||WineLab.paused)return null;if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}return AC}
function beep(f,d,type='square',v=.05,slide=0){const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),a.currentTime+d);
  g.gain.setValueAtTime(v,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d)}
function noise(d,v=.15,hp=800){const a=ac();if(!a)return;const n=a.sampleRate*d,b=a.createBuffer(1,n,a.sampleRate),c=b.getChannelData(0);
  for(let i=0;i<n;i++)c[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);const s=a.createBufferSource();s.buffer=b;const f=a.createBiquadFilter();f.type='highpass';f.frequency.value=hp;
  const g=a.createGain();g.gain.value=v;s.connect(f);f.connect(g);g.connect(a.destination);s.start()}
const SFX={rip:()=>noise(.05,.08,2500),tear:()=>noise(.18,.18,1800),tick:()=>beep(260+Math.random()*40,.03,'triangle',.05),
  click:()=>beep(900,.05,'square',.06,.7),clack:()=>{beep(300,.06,'square',.08,.5);noise(.03,.1,2000)},
  creak:()=>{beep(110,.18,'sawtooth',.06,1.6);noise(.06,.08,3000)},crack:()=>{noise(.12,.25,2000);beep(180,.1,'square',.05,.5)},
  crumble:()=>{noise(.6,.3,1200);for(let i=0;i<6;i++)WineLab.delay(()=>beep(900+Math.random()*900,.04,'triangle',.03),i*70)},
  pop:()=>{noise(.08,.25,1000);beep(420,.18,'sine',.12,.4)},cloth:()=>noise(.15,.06,600),ding:()=>{beep(1320,.25,'sine',.06);WineLab.delay(()=>beep(1760,.3,'sine',.05),90)}};

/* ---------- 상태 ---------- */
let S;
const rnd=(a,b)=>a+Math.random()*(b-a);
function reset(){
  WineLab.reset();cv.classList.remove('grab');
  fastFlag=false;diagFlag=false;for(const key in keys)delete keys[key];
  S={phase:'foil',tear:0,tearMess:0,foilFly:null,aimX:CX,aimOff:0,turnAcc:0,depth:0,tilt:0,lat:0,diagT:0,dur:100,speed:0,
     lift:0,liftSpeed:0,lever:0,stage:0,hooked:false,crumbs:[],inAir:[],cracks:[],held:false,lastAng:null,lastY:null,spin:0,shake:0,fx:[],
     corkOut:null,corkFly:null,parts:[],cork:CORK_TYPES[Math.floor(Math.random()*3)],fold:0,wrap:0,linenY:0,stats:{diag:0,fast:0}};
  rotBuf=0;liftBuf=0;$('panel').style.display='none';setHint();
}
let rotBuf=0,liftBuf=0;
function setHint(){
  $('hint').innerHTML={
    foil:'<kbd>🖱 드래그</kbd>입구를 막은 호일을 점선 따라 걷어내기',
    aim:'<kbd>🖱 클릭</kbd>스크류 끝을 코르크 <b>정중앙</b>에 맞춰 꽂기',
    screw:'<kbd>🖱 드래그</kbd>시계 방향으로 천천히 · <kbd>A</kbd><kbd>D</kbd> 스크류를 일직선으로 세우기',
    hook:`<kbd>🖱 클릭</kbd>걸쇠를 병 입구에 걸기 (${S.stage+1}단)`,
    lever:'<kbd>🖱 드래그</kbd>손잡이를 지렛대처럼 천천히 들어 올리기',
    fold:'<kbd>🖱 드래그</kbd>린넨을 아래로 끌어 길게 접기',
    wrap:'<kbd>🖱 드래그</kbd>병목 주위로 한 바퀴 돌려 린넨 감기',
    done:'끝'}[S.phase];
}
function fxPush(txt,c){S.fx.push({txt,c,t:0})}

/* ---------- 입력 ---------- */
const keys={};
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
const pivot=()=>({x:CX,y:RIM-60});
const NECKC={x:CX,y:RIM+130};
function toCanvas(e){const r=cv.getBoundingClientRect();return{x:CX+((e.clientX-r.left)/r.width*W-CX)/.72,y:RIM+((e.clientY-r.top)/r.height*H-340)/.72}}
let mouse={x:CX,y:RIM};
cv.addEventListener('pointermove',e=>{mouse=toCanvas(e);move(mouse)});
cv.addEventListener('pointerdown',e=>{ac();const m=toCanvas(e);mouse=m;
  if(S.phase==='done')return;
  if(S.phase==='aim'){plant(m.x);return}
  if(S.phase==='hook'){if(Math.hypot(m.x-HOOK.x,m.y-HOOK.y)<80){S.hooked=true;S.phase='lever';SFX.clack();fxPush(S.stage===0?'1단 걸쇠 걸림':'2단 걸쇠 걸림','#cfe3f0');setHint()}else fxPush('걸쇠를 병 입구에!','#f2d58a');return}
  if(S.phase==='foil'&&!(Math.abs(m.x-(TEAR.x1-S.tear*(TEAR.x1-TEAR.x0)))<70&&Math.abs(m.y-TEAR.y)<70))return;
  S.held=true;cv.classList.add('grab');cv.setPointerCapture(e.pointerId);
  const c=S.phase==='wrap'?NECKC:pivot();S.lastAng=Math.atan2(m.y-c.y,m.x-c.x);S.lastY=m.y});
const rel=()=>{S.held=false;cv.classList.remove('grab')};
cv.addEventListener('pointerup',rel);cv.addEventListener('pointercancel',rel);
cv.addEventListener('lostpointercapture',rel);

function move(m){
  if(S.phase==='aim'){S.aimX=Math.max(CX-CORK.w/2+6,Math.min(CX+CORK.w/2-6,m.x));return}
  if(!S.held)return;
  if(S.phase==='foil'){
    const k=Math.max(0,Math.min(1,(TEAR.x1-m.x)/(TEAR.x1-TEAR.x0)));
    if(k>S.tear){if(Math.abs(m.y-TEAR.y)>TUNE.TEAR_TOL){S.tearMess+=k-S.tear;S.shake=.06}
      if(Math.random()<.5)SFX.rip();S.tear=k;if(S.tear>=.98){S.phase='aim';rel();SFX.tear();S.foilFly={x:0,y:0,vx:260,vy:-520};
        fxPush(S.tearMess>.25?'호일이 지저분하게 찢어졌다':'호일을 깔끔하게 걷었다','#9dff9d');setHint()}}
  }else if(S.phase==='screw'){
    const p=pivot(),a=Math.atan2(m.y-p.y,m.x-p.x);let d=a-S.lastAng;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;S.lastAng=a;
    if(Math.hypot(m.x-p.x,m.y-p.y)<25)return;rotate(d/(2*Math.PI));
  }else if(S.phase==='lever'){
    const dy=S.lastY-m.y;S.lastY=m.y;if(dy>0)liftBuf+=dy;
  }else if(S.phase==='fold'){
    const dy=m.y-S.lastY;S.lastY=m.y;if(dy>0){S.linenY+=dy;if(Math.random()<.1)SFX.cloth();
      if(S.linenY>=110){S.linenY=0;S.fold++;SFX.cloth();fxPush(S.fold===1?'한 번 접었다':'길게 접었다','#cfe3f0');
        if(S.fold>=2){S.phase='wrap';rel();setHint()}}}
  }else if(S.phase==='wrap'){
    const c=NECKC,a=Math.atan2(m.y-c.y,m.x-c.x);let d=a-S.lastAng;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;S.lastAng=a;
    S.wrap=Math.min(1,S.wrap+Math.abs(d)/(2*Math.PI));if(Math.random()<.08)SFX.cloth();
    if(S.wrap>=1){S.phase='done';rel();SFX.ding();fxPush('서빙 준비 완료','#8ff0ff');setHint();WineLab.delay(()=>result(true),1300)}
  }
}
function plant(x){
  S.aimOff=Math.abs(x-CX);S.lat=x-CX;S.phase='screw';SFX.click();
  if(S.aimOff<=TUNE.CENTER_OK)fxPush('정중앙!','#8ff0ff');
  else if(S.aimOff<=TUNE.CENTER_BAD)fxPush('살짝 빗나갔다','#f2d58a');
  else{fxPush('중앙에서 너무 벗어났다!','#ff9a7a');crack()}
  setHint();
}
function rotate(turns){
  rotBuf+=Math.abs(turns);S.spin+=turns*2*Math.PI;
  const before=S.depth;
  if(turns>0)S.turnAcc=Math.min(TUNE.TURNS,S.turnAcc+turns);else S.turnAcc=Math.max(0,S.turnAcc+turns*.5);
  S.depth=S.turnAcc/TUNE.TURNS*DEPTH_MAX;
  const dd=S.depth-before;if(dd>0)S.lat+=dd*Math.tan(S.tilt*Math.PI/180);
  if(Math.floor(before/DEPTH_MAX*TUNE.TURNS*4)!==Math.floor(S.depth/DEPTH_MAX*TUNE.TURNS*4))SFX.tick();
  if(S.turnAcc>=TUNE.TURNS&&S.phase==='screw'){S.phase='hook';rel();fxPush('스크류가 다 들어갔다','#9dff9d');setHint()}
}

/* ---------- 데미지 / 부스러기 ---------- */
function damage(v){
  if(!['screw','lever','hook','aim'].includes(S.phase))return;
  const b=S.dur;S.dur=Math.max(0,S.dur-v);
  for(const th of TUNE.CRACKS)if(b>th&&S.dur<=th)crack();
  if(S.dur<=0)crumble();
}
function crack(){
  SFX.crack();S.shake=.18;
  S.cracks.push({y:rnd(10,CORK.h*.8),x:rnd(10,CORK.w*.6),l:rnd(20,50),a:rnd(-1,1)});
  dropCrumbs(3+Math.floor(Math.random()*3));fxPush('코르크에 금이 갔다!','#f2d58a');
}
function dropCrumbs(n,burst){
  for(let i=0;i<n;i++)S.inAir.push({x:CX+rnd(-1,1)*(burst?CORK.w/2:CORK.w*.3),y:burst?RIM-S.lift+rnd(0,CORK.h):RIM-S.lift+CORK.h,
    vx:rnd(-1,1)*(burst?60:15),vy:burst?rnd(-80,0):20,s:Math.random()<.4?PX*2:PX,c:['#c79a5e','#a8794a','#8a5e36','#e0b57a'][i%4]});
}
function crumble(){S.phase='done';S.corkOut='broken';SFX.crumble();S.shake=.45;dropCrumbs(46,true);fxPush('코르크가 부서졌다!','#ff7a8a');$('hint').textContent='코르크가 부서졌다…';WineLab.delay(()=>result(false),1700)}
function corkFree(){S.corkOut='out';SFX.pop();S.corkFly={y:0,vy:-200};fxPush('코르크를 뽑았다','#8ff0d0');
  WineLab.delay(()=>{S.phase='fold';setHint()},900);S.phase='wait'}
function result(ok){
  const n=S.crumbs.length+S.inAir.length;let big,col,row;
  const neat=S.aimOff<=TUNE.CENTER_OK&&S.stats.diag===0&&S.tearMess<=.25;
  if(!ok){big='실패';col='#ff7a8a';row=`코르크가 부서져 와인에 부스러기가 가득하다. (<b>${n}</b>개)`}
  else if(n===0&&neat){big='PERFECT';col='#8ff0ff';row='전문가처럼 깔끔한 서빙이다.'}
  else if(n<=6){big='GOOD';col='#9dff9d';row=`무난하게 열었다. 부스러기 <b>${n}</b>개`}
  else{big='BAD';col='#f2d58a';row=`와인에 부스러기가 꽤 떠 있다. (<b>${n}</b>개)`}
  row+=`<br><span style="font-size:.85em">${S.cork.name} · 중앙 오차 ${Math.round(S.aimOff)}px · 대각선 ${S.stats.diag}회 · 과속 ${S.stats.fast}회 · 호일 ${S.tearMess>.25?'지저분':'깔끔'}${ok?' · 린넨 ✔':''}</span>`;
  $('pBig').textContent=big;$('pBig').style.color=col;$('pRow').innerHTML=row;
  $('pBtns').innerHTML='<button id="again" type="button">새 병으로 다시</button>';$('again').onclick=reset;$('panel').style.display='flex';
}


/* ---------- 업데이트 ---------- */
let lastF=performance.now(),fastFlag=false,diagFlag=false;
function update(){
  const t=performance.now(),dt=Math.max(.001,Math.min(.05,(t-lastF)/1000));lastF=t;
  S.speed+=(rotBuf/dt-S.speed)*Math.min(1,dt*8);rotBuf=0;
  if(S.phase==='screw'){
    // 기울어짐: 돌리는 동안 랜덤하게 기울고, 빨리 돌릴수록 더 크게
    if(S.speed>.05){S.tilt+=(Math.sin(t/700)+rnd(-.6,.6))*TUNE.TILT_DRIFT*(1+S.speed)*dt}
    const k=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);S.tilt=Math.max(-25,Math.min(25,S.tilt+k*TUNE.TILT_FIX*dt));
    if(Math.abs(S.tilt)>TUNE.TILT_SAFE&&S.speed>.05){damage(TUNE.TILT_DMG*dt);if(!diagFlag){diagFlag=true;S.stats.diag++;fxPush('대각선으로 들어간다!','#ff9a7a')}}else diagFlag=false;
    const over=S.speed-TUNE.SAFE_SPEED;if(over>0){damage(over*TUNE.DMG_RATE*dt);if(Math.random()<dt*over*3)SFX.creak();if(!fastFlag){fastFlag=true;S.stats.fast++}}else fastFlag=false;
  }
  if(S.phase==='lever'){
    const v=liftBuf/dt;liftBuf=0;S.liftSpeed+=(v-S.liftSpeed)*Math.min(1,dt*8);
    const target=TUNE.LEVER_LIFT[S.stage], base=S.stage===0?0:TUNE.LEVER_LIFT[0];
    S.lift=Math.min(base+target,S.lift+v*dt*.45);
    S.lever=(S.lift-base)/target;
    if(Math.random()<dt*(1+S.liftSpeed/100))SFX.creak();
    const over=S.liftSpeed*.45-S.cork.safe*.45;
    if(over>0){damage(over*.25*dt);if(!fastFlag){fastFlag=true;S.stats.fast++;fxPush('힘이 너무 세다!','#ff9a7a')}}else fastFlag=false;
    if(S.lift>=base+target-.5&&S.phase==='lever'){
      S.stage++;S.hooked=false;S.lever=0;SFX.clack();
      if(S.stage>=2)corkFree();else{S.phase='hook';rel();fxPush('1단 완료 — 2단으로 바꿔 걸기','#9dff9d');setHint()}
    }
  }
  for(const c of S.inAir){c.vy+=900*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.x=Math.max(NECK.x0+8,Math.min(NECK.x1-8,c.x));
    if(c.y>=WINE_Y){c.dead=true;S.crumbs.push({x:c.x,y:WINE_Y+4,ty:WINE_Y+12+Math.random()*90,s:c.s,c:c.c,ph:Math.random()*6})}}
  S.inAir=S.inAir.filter(c=>!c.dead);for(const c of S.crumbs)if(c.y<c.ty)c.y+=18*dt;
  if(S.foilFly){S.foilFly.vy+=1800*dt;S.foilFly.x+=S.foilFly.vx*dt;S.foilFly.y+=S.foilFly.vy*dt;if(S.foilFly.y>900)S.foilFly=null}
  if(S.corkFly){S.corkFly.vy+=300*dt;S.corkFly.y+=S.corkFly.vy*dt;if(S.corkFly.y<-60){S.corkFly.y=-60;S.corkFly.vy=0}}
  S.shake=Math.max(0,S.shake-dt);S.fx.forEach(f=>f.t+=dt);S.fx=S.fx.filter(f=>f.t<1.3);
}

/* ---------- 배경 ---------- */
const bg=document.createElement('canvas');bg.width=W;bg.height=H;
(function(){
  const b=bg.getContext('2d');const gr=b.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#0c1018');gr.addColorStop(1,'#080b12');b.fillStyle=gr;b.fillRect(0,0,W,H);
  [[290,30],[400,90],[490,14],[590,70],[690,22],[770,60],[1300,40],[1400,18],[1500,70]].forEach(([x,w],i)=>{b.fillStyle=i%2?'rgba(255,255,255,.018)':'rgba(0,0,0,.25)';b.fillRect(x,0,w,H)});
  const bay=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  for(let y=0;y<560;y+=8){const k=y/560,l=930+30*k,r=1250-30*k,dens=Math.max(0,1-k*1.1)*.85;
    for(let x=l;x<r;x+=8){const e=Math.min(x-l,r-x)/60,d=dens*Math.min(1,e);if(bay[((y/8)|0)%4][((x/8)|0)%4]/16<d){b.fillStyle='rgba(74,58,40,.95)';b.fillRect(x|0,y,6,6)}}}
  const v=b.createRadialGradient(W/2,H*.45,H*.2,W/2,H*.5,W*.6);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');b.fillStyle=v;b.fillRect(0,0,W,H);
})();

/* ---------- 그리기 ---------- */
const snap=v=>Math.round(v/PX)*PX;
const RED=['#4a0c18','#7a1428','#a8283c','#d8586a'];
function foilPattern(x,y,w,h,seed){ctx.fillStyle=RED[1];ctx.fillRect(x,y,w,h);
  for(let i=0;i<w;i+=PX)for(let j=0;j<h;j+=PX){const r=Math.abs(Math.sin((i+seed)*12.9+j*78.2)*43758)%1;if(r>.86){ctx.fillStyle=RED[3];ctx.fillRect(x+i,y+j,PX,PX)}else if(r<.14){ctx.fillStyle=RED[0];ctx.fillRect(x+i,y+j,PX,PX)}}
  ctx.fillStyle='rgba(255,200,210,.25)';ctx.fillRect(x+w*.18,y,PX*2,h)}
function drawLowerFoil(){foilPattern(1012,TEAR.y,152,100,3);ctx.fillStyle=RED[0];ctx.fillRect(1012,TEAR.y+94,152,6)}
function drawUpperFoil(ox,oy){ctx.save();ctx.translate(ox,oy);foilPattern(1018,494,140,TEAR.y-494,7);
  ctx.fillStyle=RED[1];ctx.beginPath();ctx.roundRect(1022,480,132,30,12);ctx.fill();ctx.fillStyle=RED[2];ctx.fillRect(1036,484,70,PX);
  if(!S.foilFly){const tx=TEAR.x1-S.tear*(TEAR.x1-TEAR.x0);ctx.fillStyle=RED[2];ctx.fillRect(tx,TEAR.y-12,24,24);ctx.fillStyle=RED[0];ctx.fillRect(tx+18,TEAR.y-12,6,24)}ctx.restore()}
function drawTearLine(){const tx=TEAR.x1-S.tear*(TEAR.x1-TEAR.x0);
  if(S.phase==='foil'){ctx.fillStyle='#e8c0c8';for(let x=TEAR.x0;x<tx;x+=16)ctx.fillRect(x,TEAR.y-2,9,4)}
  ctx.fillStyle='#3a0a14';ctx.fillRect(tx,TEAR.y-3,TEAR.x1-tx,6);
  if(S.phase==='foil'&&!S.held){ctx.fillStyle=`rgba(143,240,255,${.5+.4*Math.sin(performance.now()/200)})`;ctx.beginPath();ctx.moveTo(tx-30,TEAR.y);ctx.lineTo(tx-6,TEAR.y-14);ctx.lineTo(tx-6,TEAR.y+14);ctx.fill()}}
const xrayOn=()=>!['foil','aim'].includes(S.phase);
function drawXray(){
  if(!xrayOn())return;const {x0,x1,y0,y1}=NECK,tt=performance.now()/1000;
  ctx.fillStyle='rgba(6,10,18,.78)';ctx.fillRect(x0,y0,x1-x0,y1-y0);
  const g=ctx.createLinearGradient(0,WINE_Y,0,y1);g.addColorStop(0,'rgba(120,18,40,.95)');g.addColorStop(1,'rgba(60,6,20,.95)');ctx.fillStyle=g;ctx.fillRect(x0,WINE_Y,x1-x0,y1-WINE_Y);
  for(let x=x0;x<x1;x+=PX){ctx.fillStyle='rgba(220,90,110,.6)';ctx.fillRect(x,WINE_Y+Math.round(Math.sin(x*.1+tt*2)*1.2),PX,3)}
  S.crumbs.forEach(c=>{ctx.fillStyle=c.c;ctx.fillRect(snap(c.x+Math.sin(tt+c.ph)*2),snap(c.y),c.s,c.s)});
  ctx.strokeStyle='rgba(143,240,255,.55)';ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.strokeRect(x0,y0,x1-x0,y1-y0);ctx.setLineDash([]);
}
function corkY(){return S.corkFly?RIM-S.lift+S.corkFly.y:RIM-S.lift}
function drawCork(){
  if(S.phase==='foil')return;
  if(S.corkOut==='broken'){ctx.fillStyle='rgba(150,110,70,.75)';ctx.fillRect(CX-CORK.w/2,RIM,CORK.w,22);for(let i=0;i<CORK.w;i+=12)ctx.fillRect(CX-CORK.w/2+i,RIM+22,8,8+((i*7)%14));return}
  const cy=corkY(),x=CX-CORK.w/2;
  ctx.globalAlpha=xrayOn()?.84:1;
  ctx.fillStyle=S.cork.color;ctx.fillRect(x,cy,CORK.w,CORK.h);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x+6,cy,CORK.w-24,CORK.h);
  ctx.fillStyle='rgba(90,60,30,.45)';for(let i=0;i<26;i++){const hx=Math.abs(Math.sin(i*12.98)*437)%1,hy=Math.abs(Math.sin(i*78.2)*123)%1;ctx.fillRect(x+hx*(CORK.w-6),cy+4+hy*(CORK.h-12),PX,PX)}
  ctx.fillStyle='#e2bd8a';ctx.fillRect(x,cy,CORK.w,6);ctx.fillStyle='#6a3a28';ctx.fillRect(x,cy+CORK.h-8,CORK.w,8);
  ctx.strokeStyle='#3a220f';ctx.lineWidth=4;S.cracks.forEach(c=>{ctx.beginPath();ctx.moveTo(x+c.x,cy+c.y);ctx.lineTo(x+c.x+c.l,cy+c.y+c.l*c.a*.5);ctx.lineTo(x+c.x+c.l*.6,cy+c.y+c.l*.8);ctx.stroke()});
  ctx.globalAlpha=1;
  // 중앙 표시 (aim)
  if(S.phase==='aim'){ctx.strokeStyle='rgba(143,240,255,.6)';ctx.lineWidth=2;ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(CX,cy-30);ctx.lineTo(CX,cy+CORK.h);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='rgba(143,240,255,.8)';ctx.beginPath();ctx.arc(CX,cy+3,TUNE.CENTER_OK,0,7);ctx.stroke()}
}
function drawWorm(){
  if(['foil'].includes(S.phase)||S.corkOut==='broken')return;
  const top=corkY();
  if(S.phase==='aim'){ // 스크류 끝이 마우스를 따라 코르크 위에서 대기
    const x=S.aimX;for(let i=0;i<WORM_LEN;i+=3){const ph=performance.now()/300+i*.13,r=i>WORM_LEN-10?(WORM_LEN-i):13;ctx.fillStyle=Math.cos(ph)>0?'#e8eef2':'#8f9aa3';ctx.fillRect(snap(x+Math.sin(ph)*r)-3,top-WORM_LEN-4+i,7,4)}
    drawOpener(x,top-WORM_LEN-4,0);return}
  const tr=S.tilt*Math.PI/180;
  // 경로: 코르크 안은 lat 따라, 위는 tilt 방향
  for(let i=0;i<=WORM_LEN;i+=3){
    const s=WORM_LEN-i, d=S.depth-s; let x,y;
    if(d>=0){x=CX+S.lat-(S.depth-d)*Math.tan(tr)*0;x=CX+(S.lat-Math.tan(tr)*(S.depth-d));y=top+d}
    else{const up=-d;x=CX+S.lat-Math.tan(tr)*S.depth-Math.sin(tr)*up;y=top-Math.cos(tr)*up}
    const ph=S.spin+i*.13,r=i<10?i:13;ctx.globalAlpha=(d>=0&&xrayOn())?.8:1;ctx.fillStyle=Math.cos(ph)>0?'#e8eef2':'#8f9aa3';ctx.fillRect(snap(x+Math.sin(ph)*r)-3,y,7,4)}
  ctx.globalAlpha=1;
  const hx=CX+S.lat-Math.tan(tr)*S.depth-Math.sin(tr)*(WORM_LEN-S.depth), hy=top-Math.cos(tr)*(WORM_LEN-S.depth);
  drawOpener(hx,hy,tr);
}
function drawOpener(x,y,tr){
  // 오프너 몸체: 기존 오프너 스프라이트. 지렛대 단계에선 걸쇠 쪽으로 눕고 들어 올려짐
  if(!imgO.complete)return;
  ctx.save();ctx.translate(x,y);
  if(S.phase==='hook'||S.phase==='lever'||S.phase==='wait'){
    // 왼쪽 걸쇠(입구)를 받침점으로, 오른쪽 손잡이를 들어 올림
    const ang=-1.45+S.lever*0.55*(S.hooked?1:0)-(S.stage===1?.12:0);
    ctx.rotate(ang);ctx.drawImage(imgO,-imgO.width/2,-imgO.height+30);
  }else{
    ctx.rotate(tr);ctx.fillStyle='#b8c2ca';ctx.fillRect(-4,-40,8,40);
    const sc=Math.max(.18,Math.abs(Math.cos(S.spin)));ctx.translate(0,-52);ctx.rotate(Math.PI/2);ctx.scale(1,sc);ctx.drawImage(imgO,-imgO.width/2,-imgO.height/2);
  }
  ctx.restore();
}
function drawHook(){
  if(!(S.phase==='hook'||S.phase==='lever'))return;
  // 걸쇠 (1단/2단 노치)
  const hx=HOOK.x,hy=HOOK.y;ctx.fillStyle='#2b2f3c';ctx.fillRect(hx-14,hy-60,22,60);
  ctx.fillStyle=S.stage===0?'#9dff9d':'#4a5566';ctx.fillRect(hx-20,hy-12,10,10);
  ctx.fillStyle=S.stage===1?'#9dff9d':'#4a5566';ctx.fillRect(hx-20,hy-42,10,10);
  if(S.phase==='hook'){const a=.5+.4*Math.sin(performance.now()/180);ctx.strokeStyle=`rgba(143,240,255,${a})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(hx,hy-(S.stage?36:6),34,0,7);ctx.stroke()}
}
const LINEN=['#f2efe8','#dcd8cf','#c4bfb4','#a8a397'];
function drawLinen(){
  if(!(['fold','wrap','done'].includes(S.phase)&&S.corkOut==='out'))return;
  if(S.phase==='fold'){ // 테이블 위 린넨: 접을수록 폭이 반으로
    const w=520,h=Math.round(260/(1+S.fold))-Math.min(1,S.linenY/110)*30,x=CX-w/2,y=960;
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(x+10,y+h,w,10);
    ctx.fillStyle=LINEN[0];ctx.fillRect(x,y,w,h);for(let i=0;i<w;i+=24){ctx.fillStyle=LINEN[1];ctx.fillRect(x+i,y,4,h)}
    ctx.fillStyle=LINEN[2];ctx.fillRect(x,y+h-8,w,8);
    if(S.fold>0){ctx.fillStyle=LINEN[3];ctx.fillRect(x,y,w,6)}
    // 접히는 플랩
    const k=Math.min(1,S.linenY/110);ctx.fillStyle=LINEN[1];ctx.fillRect(x,y-k*h*.5,w,Math.max(6,k*h*.5));
    ctx.fillStyle='rgba(143,240,255,.6)';const ay=y-80+((performance.now()/6)%50);ctx.beginPath();ctx.moveTo(CX,ay+30);ctx.lineTo(CX-18,ay);ctx.lineTo(CX+18,ay);ctx.fill();
  }else{ // 병목에 감김
    const k=S.wrap,y=RIM+150;
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(CX-82,y+8,164,70);
    const w=Math.round(170*k);
    ctx.fillStyle=LINEN[0];ctx.fillRect(CX-85,y,w,64);ctx.fillStyle=LINEN[1];ctx.fillRect(CX-85,y+50,w,14);
    for(let i=0;i<w;i+=26){ctx.fillStyle=LINEN[2];ctx.fillRect(CX-85+i,y,3,64)}
    if(k>.9){ctx.fillStyle=LINEN[0];ctx.fillRect(CX+70,y+30,30,90);ctx.fillStyle=LINEN[2];ctx.fillRect(CX+70,y+110,30,10)}
    if(S.phase==='wrap'){ctx.strokeStyle='rgba(143,240,255,.3)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(NECKC.x,NECKC.y,200,0,7);ctx.stroke()}
  }
}
function drawGuide(){
  if(S.phase==='screw'){const p=pivot();ctx.strokeStyle='rgba(143,240,255,.25)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,230,0,7);ctx.stroke();
    const a=performance.now()/600;for(let k=0;k<3;k++){const aa=a+k*2.094,x=p.x+Math.cos(aa)*230,y=p.y+Math.sin(aa)*230;
      ctx.save();ctx.translate(x,y);ctx.rotate(aa+Math.PI/2);ctx.fillStyle='rgba(143,240,255,.55)';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-10);ctx.lineTo(-10,10);ctx.fill();ctx.restore()}
    // 수직 가이드
    ctx.strokeStyle=Math.abs(S.tilt)>TUNE.TILT_SAFE?'rgba(255,120,120,.6)':'rgba(157,255,157,.4)';ctx.lineWidth=2;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(CX+S.lat,RIM-260);ctx.lineTo(CX+S.lat,RIM);ctx.stroke();ctx.setLineDash([])}
  if(S.phase==='lever'){ctx.fillStyle='rgba(143,240,255,.5)';const yy=RIM-260-((performance.now()/8)%60);ctx.beginPath();ctx.moveTo(CX+260,yy-20);ctx.lineTo(CX+240,yy+6);ctx.lineTo(CX+280,yy+6);ctx.fill();ctx.fillRect(CX+254,yy+6,12,40)}
}
function drawHUD(){
  ctx.textBaseline='top';ctx.font='600 30px "Galmuri11","Pretendard",sans-serif';ctx.fillStyle='#b9c2cc';
  ctx.fillText('단계',26,8);ctx.fillText('코르크 상태',500,8);
  const L={foil:'① 호일 벗기기',aim:'② 중앙에 꽂기',screw:'③ 일직선으로 돌리기',hook:'④ 지렛대 '+(S.stage+1)+'단',lever:'④ 지렛대 '+(S.stage+1)+'단',wait:'④ 지렛대',fold:'⑤ 린넨 접기',wrap:'⑤ 린넨 감기',done:'완료'}[S.phase];
  ctx.font='700 40px ui-monospace,Consolas,monospace';ctx.fillStyle='#f2d58a';ctx.fillText(L,24,46);
  ctx.font='500 22px "Pretendard",sans-serif';ctx.fillStyle='#8a96a6';
  ctx.fillText(S.phase==='screw'?`깊이 ${Math.round(S.depth/DEPTH_MAX*100)}% · 기울기 ${S.tilt.toFixed(0)}°`:S.phase==='fold'?`접기 ${S.fold}/2`:S.phase==='wrap'?`감기 ${Math.round(S.wrap*100)}%`:'',24,96);
  const bx=500,by=56,bw=260,bh=26;ctx.fillStyle='#161c28';ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle=S.dur>60?'#9dff9d':S.dur>30?'#f2d58a':'#ff7a8a';ctx.fillRect(bx,by,bw*S.dur/100,bh);
  ctx.fillStyle='#0a0e16';TUNE.CRACKS.forEach(th=>ctx.fillRect(bx+bw*th/100-1,by,3,bh));
  ctx.fillStyle='#8a96a6';ctx.fillText(`${S.cork.name} — ${S.cork.desc}`,bx,by+36);ctx.fillText('부스러기 '+(S.crumbs.length+S.inAir.length)+'개',bx,by+62);
  // 게이지: 회전 속도 / 들어올리는 힘
  if(S.phase==='screw'||S.phase==='lever'){
    const gx=1060,gw=300,v=S.phase==='screw'?S.speed/(TUNE.SAFE_SPEED*2):S.liftSpeed/(S.cork.safe*2);
    ctx.font='600 30px "Galmuri11","Pretendard",sans-serif';ctx.fillStyle='#b9c2cc';ctx.fillText(S.phase==='screw'?'회전 속도':'들어 올리는 힘',gx,8);
    ctx.fillStyle='#161c28';ctx.fillRect(gx,by,gw,bh);ctx.fillStyle='#2f6a40';ctx.fillRect(gx,by,gw/2,bh);ctx.fillStyle='#6a2a30';ctx.fillRect(gx+gw/2,by,gw/2,bh);
    ctx.fillStyle=v>.5?'#ff7a8a':'#e8f4ff';ctx.fillRect(gx+Math.min(1,Math.max(0,v))*gw-4,by-8,8,bh+16);
  }
  if(S.phase==='screw'){ // 기울기 수평계
    const gx=1420,gy=by+12;ctx.fillStyle='#161c28';ctx.fillRect(gx,gy-14,240,28);ctx.fillStyle='rgba(157,255,157,.35)';ctx.fillRect(gx+120-TUNE.TILT_SAFE/25*120,gy-14,TUNE.TILT_SAFE/25*240,28);
    ctx.fillStyle=Math.abs(S.tilt)>TUNE.TILT_SAFE?'#ff7a8a':'#e8f4ff';ctx.fillRect(gx+120+S.tilt/25*120-4,gy-20,8,40);
    ctx.font='600 30px "Galmuri11","Pretendard",sans-serif';ctx.fillStyle='#b9c2cc';ctx.fillText('일직선',gx,8);
  }
  S.fx.forEach((f,i)=>{ctx.save();ctx.globalAlpha=1-f.t/1.3;ctx.font='700 48px "Galmuri11","Pretendard",sans-serif';ctx.fillStyle=f.c;ctx.textAlign='center';ctx.fillText(f.txt,CX-460,RIM-160-f.t*40+i*64);ctx.restore()});
}
function draw(){
  update();
  ctx.save();if(S.shake>0){const m=S.shake*40;ctx.translate((Math.random()-.5)*m,(Math.random()-.5)*m)}
  ctx.drawImage(bg,0,0);
  // Preserve the wine sprite's aspect ratio and align its real mouth with the cork.
  ctx.translate(CX,340);ctx.scale(.72,.72);ctx.translate(-CX,-RIM);
  if(imgB.naturalWidth)ctx.drawImage(imgB,23,35,47,187,CX-141,RIM-4,282,1122);
  drawLowerFoil();drawXray();drawCork();
  S.inAir.forEach(c=>{ctx.fillStyle=c.c;ctx.fillRect(snap(c.x),snap(c.y),c.s,c.s)});
  if(S.phase==='foil')drawUpperFoil(0,0);if(S.foilFly)drawUpperFoil(S.foilFly.x,S.foilFly.y);
  drawTearLine();drawHook();
  if(!(S.corkOut==='out'&&['fold','wrap','done'].includes(S.phase)))drawWorm();
  drawLinen();drawGuide();
  ctx.restore();drawHUD();

}
WineLab.start({
  images:[imgB,imgO], draw, reset,
  release(){rel();rotBuf=0;liftBuf=0;S.speed=0;S.liftSpeed=0;for(const key in keys)delete keys[key];lastF=performance.now();},
  audio(paused){if(AC){if(paused)AC.suspend().catch(()=>{});else AC.resume().catch(()=>{});}},
  mute(){if(AC){AC.close().catch(()=>{});AC=null;}}
});
