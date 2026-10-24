
/* ============================================================
   LAST CALL — 와인 따기 [TEST]
   1) 포장 까기   : 호일 탭을 잡고 점선을 따라 끌어 윗부분 호일을 벗긴다
   2) 포커싱+투시 : 병목 클로즈업, 병목 안은 점선 투시창. 코르크는 반투명 → 아래 와인 수면까지 보임
   3) 돌려 넣기   : 마우스를 누른 채 오프너 주위를 시계 방향으로 돌리면 스크류가 박힘 (4바퀴). 반시계 = 살짝 풀림
   4) 빠르게/실수 : 속도 게이지 빨간 구간 → 삐걱 + 코르크 상태 감소
                    70% / 40% / 15% 지날 때마다 금 + 부스러기가 와인으로 떨어짐
   5) 빠개짐      : 상태 0% → 코르크가 부서지며 부스러기가 와인에 우르르 (실패)
   (마무리) 뽑기  : 끝까지 박히면 위로 천천히 끌어 뽑기
   판정: 와인에 떨어진 부스러기 개수
   ============================================================ */
const TUNE={
  TURNS:4,            // 끝까지 박는 회전 수
  SAFE_SPEED:1.1,     // 안전 회전 속도(회전/초)
  DMG_RATE:55,        // 과속 1회전/초 당 초당 상태 감소
  CRACKS:[70,40,15],  // 금이 가는 상태(%)
  PULL_LEN:150, SAFE_PULL:260, PULL_DMG:0.22,
  TEAR_TOL:22,        // 포장 까기: 점선에서 벗어나도 되는 범위(px)
};
const BOTTLE_SRC='../../../assets/items/item-red-wine.png';
const OPENER_SRC='../../../assets/items/wine-practice-opener.png';
const W=2184,H=1164,PX=6;
const BOTTLE_POS={x:920,y:518};
const CX=1087,RIM=526;
const NECK={x0:1036,x1:1138,y0:522,y1:820};
const CORK={h:118,w:84};
const WINE_Y=712;
const WORM_LEN=128,DEPTH_MAX=104;
const TEAR={y:566,x0:1014,x1:1162};

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
  creak:()=>{beep(110,.18,'sawtooth',.06,1.6);noise(.06,.08,3000)},crack:()=>{noise(.12,.25,2000);beep(180,.1,'square',.05,.5)},
  crumble:()=>{noise(.6,.3,1200);for(let i=0;i<6;i++)WineLab.delay(()=>beep(900+Math.random()*900,.04,'triangle',.03),i*70)},
  pop:()=>{noise(.1,.35,1000);beep(520,.22,'sine',.15,.35)}};

/* ---------- 상태 ---------- */
let phase,tear,tearMess,foilFly,turnAcc,depth,dur,speed,pull,pullSpeed,crumbs,inAir,cracks,held,lastAng,lastY,spin,shake,fx,corkOut,popT,lastTickQ,focus;
let rotBuf=0,pullBuf=0;
function rnd(a,b){return a+Math.random()*(b-a)}
function reset(){
  WineLab.reset();cv.classList.remove('grab');
  rotBuf=0;pullBuf=0;parts=[];
  phase='foil';tear=0;tearMess=0;foilFly=null;turnAcc=0;depth=0;dur=100;speed=0;pull=0;pullSpeed=0;crumbs=[];inAir=[];cracks=[];held=false;
  lastAng=null;lastY=null;spin=0;shake=0;fx=[];corkOut=null;popT=0;lastTickQ=0;focus=0;
  $('panel').style.display='none';setHint();
}
function setHint(){
  $('hint').innerHTML={foil:'<kbd>🖱 드래그</kbd>호일 탭을 잡고 점선을 따라 왼쪽으로 벗기기',
    screw:'<kbd>🖱 드래그</kbd>오프너 주위를 시계 방향으로 천천히 돌리기',
    pull:'<kbd>🖱 드래그</kbd>위로 천천히 끌어 코르크 뽑기',
    done:corkOut==='broken'?'코르크가 부서졌다…':'POP! 코르크를 뽑았다'}[phase];
}

/* ---------- 입력 ---------- */
const pivot=()=>({x:CX,y:RIM-60});
function toCanvas(e){const r=cv.getBoundingClientRect();return{x:CX+((e.clientX-r.left)/r.width*W-CX)/.72,y:RIM+((e.clientY-r.top)/r.height*H-340)/.72}}
cv.addEventListener('pointerdown',e=>{ac();if(phase==='done')return;const m=toCanvas(e);
  if(phase==='foil'&&!(Math.abs(m.x-(TEAR.x1-tear*(TEAR.x1-TEAR.x0)))<70&&Math.abs(m.y-TEAR.y)<70))return;
  held=true;cv.classList.add('grab');cv.setPointerCapture(e.pointerId);
  const p=pivot();lastAng=Math.atan2(m.y-p.y,m.x-p.x);lastY=m.y});
cv.addEventListener('pointermove',e=>{
  if(!held)return;const m=toCanvas(e),p=pivot();
  if(phase==='foil'){
    const k=Math.max(0,Math.min(1,(TEAR.x1-m.x)/(TEAR.x1-TEAR.x0)));
    if(k>tear){
      if(Math.abs(m.y-TEAR.y)>TUNE.TEAR_TOL){tearMess+=k-tear;shake=.06;parts.push({x:m.x,y:TEAR.y+rnd(-10,10),vx:rnd(-80,80),vy:rnd(-200,-60),life:.8})}
      if(Math.random()<.5)SFX.rip();
      tear=k;if(tear>=.98)finishFoil();
    }
  }else if(phase==='screw'){
    const a=Math.atan2(m.y-p.y,m.x-p.x);let d=a-lastAng;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;lastAng=a;
    if(Math.hypot(m.x-p.x,m.y-p.y)<25)return;
    rotate(d/(2*Math.PI));
  }else if(phase==='pull'){const dy=lastY-m.y;lastY=m.y;if(dy>0){pullBuf+=dy;pull=Math.min(TUNE.PULL_LEN,pull+dy);if(pull>=TUNE.PULL_LEN)popCork()}}
});
const rel=()=>{held=false;cv.classList.remove('grab')};
cv.addEventListener('pointerup',rel);cv.addEventListener('pointercancel',rel);
cv.addEventListener('lostpointercapture',rel);
let parts=[];

function finishFoil(){
  phase='screw';held=false;cv.classList.remove('grab');SFX.tear();
  foilFly={x:0,y:0,vx:260,vy:-520};
  fx.push({txt:tearMess>.25?'호일이 지저분하게 찢어졌다':'깔끔하게 벗겼다!',c:tearMess>.25?'#f2d58a':'#9dff9d',t:0});
  setHint();
}
function rotate(turns){
  rotBuf+=turns;spin+=turns*2*Math.PI;
  if(turns>0)turnAcc=Math.min(TUNE.TURNS,turnAcc+turns);else turnAcc=Math.max(0,turnAcc+turns*.5);
  depth=turnAcc/TUNE.TURNS*DEPTH_MAX;
  const q=Math.floor(turnAcc*4);if(q!==lastTickQ){lastTickQ=q;SFX.tick()}
  if(turnAcc>=TUNE.TURNS&&phase==='screw'){phase='pull';held=false;cv.classList.remove('grab');setHint();fx.push({txt:'끝까지 박혔다!',c:'#9dff9d',t:0})}
}

/* ---------- 데미지 / 부스러기 ---------- */
function damage(v){
  if(phase!=='screw'&&phase!=='pull')return;
  const before=dur;dur=Math.max(0,dur-v);
  for(const th of TUNE.CRACKS)if(before>th&&dur<=th)crack();
  if(dur<=0)crumble();
}
function crack(){
  SFX.crack();shake=.18;
  cracks.push({y:Math.random()*CORK.h*.8+10,x:Math.random()*CORK.w*.6+10,l:20+Math.random()*30,a:Math.random()*2-1});
  dropCrumbs(3+Math.floor(Math.random()*3));
  fx.push({txt:'코르크에 금이 갔다!',c:'#f2d58a',t:0});
}
function dropCrumbs(n,burst){
  for(let i=0;i<n;i++){const top=RIM-pull+CORK.h;
    inAir.push({x:CX+(Math.random()-.5)*(burst?CORK.w:CORK.w*.6),y:burst?RIM-pull+Math.random()*CORK.h:top,vx:(Math.random()-.5)*(burst?120:30),vy:burst?-80+Math.random()*80:20,
      s:Math.random()<.4?PX*2:PX,c:['#c79a5e','#a8794a','#8a5e36','#e0b57a'][i%4]})}
}
function crumble(){phase='done';corkOut='broken';setHint();SFX.crumble();shake=.45;dropCrumbs(46,true);fx.push({txt:'코르크가 부서졌다!',c:'#ff7a8a',t:0});WineLab.delay(()=>result(false),1700)}
function popCork(){phase='done';corkOut='out';setHint();SFX.pop();popT=1;fx.push({txt:'POP!',c:'#8ff0d0',t:0});WineLab.delay(()=>result(true),1500)}
function result(ok){
  const n=crumbs.length+inAir.length;let big,col,row;
  if(!ok){big='실패';col='#ff7a8a';row=`코르크가 부서져 와인에 부스러기가 가득하다.<br>부스러기 <b>${n}</b>개`}
  else if(n===0){big='PERFECT';col='#8ff0ff';row='부스러기 하나 없이 깔끔하게 땄다.'}
  else if(n<=6){big='GOOD';col='#9dff9d';row=`코르크 부스러기가 조금 떨어졌다. (<b>${n}</b>개)`}
  else{big='BAD';col='#f2d58a';row=`와인에 부스러기가 꽤 떠 있다. (<b>${n}</b>개)`}
  row+=`<br><span style="font-size:.85em">코르크 상태 ${Math.round(dur)}% · 호일 ${tearMess>.25?'지저분하게 찢음':'깔끔'}</span>`;
  $('pBig').textContent=big;$('pBig').style.color=col;$('pRow').innerHTML=row;
  $('pBtns').innerHTML='<button id="again" type="button">새 병으로 다시</button>';$('again').onclick=reset;$('panel').style.display='flex';
}


/* ---------- 업데이트 ---------- */
let lastF=performance.now();
function update(){
  const t=performance.now(),dt=Math.max(.001,Math.min(.05,(t-lastF)/1000));lastF=t;
  const inst=rotBuf/dt;rotBuf=0;speed+=(inst-speed)*Math.min(1,dt*8);
  const pinst=pullBuf/dt;pullBuf=0;pullSpeed+=(pinst-pullSpeed)*Math.min(1,dt*8);
  if(phase==='screw'){const over=speed-TUNE.SAFE_SPEED;if(over>0){damage(over*TUNE.DMG_RATE*dt);if(Math.random()<dt*over*3)SFX.creak()}}
  if(phase==='pull'){const over=pullSpeed-TUNE.SAFE_PULL;if(over>0){damage(over*TUNE.PULL_DMG*dt);if(Math.random()<dt*2)SFX.creak()}}
  focus=Math.min(1,focus+(phase==='foil'?0:dt*2.5));   // 포장 까면 투시창이 켜짐
  for(const c of inAir){c.vy+=900*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.x=Math.max(NECK.x0+8,Math.min(NECK.x1-8,c.x));
    if(c.y>=WINE_Y){c.dead=true;crumbs.push({x:c.x,y:WINE_Y+4,ty:WINE_Y+12+Math.random()*90,s:c.s,c:c.c,ph:Math.random()*6})}}
  inAir=inAir.filter(c=>!c.dead);for(const c of crumbs){if(c.y<c.ty)c.y+=18*dt}
  if(foilFly){foilFly.vy+=1800*dt;foilFly.x+=foilFly.vx*dt;foilFly.y+=foilFly.vy*dt;if(foilFly.y>900)foilFly=null}
  for(const p of parts){p.vy+=1800*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}parts=parts.filter(p=>p.life>0);
  shake=Math.max(0,shake-dt);popT=Math.max(0,popT-dt*.8);fx.forEach(f=>f.t+=dt);fx=fx.filter(f=>f.t<1.2);
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
const RED=['#4a0c18','#7a1428','#a8283c','#d8586a'];   // 와인 포장 호일
function foilPattern(x,y,w,h,seed){
  ctx.fillStyle=RED[1];ctx.fillRect(x,y,w,h);
  for(let i=0;i<w;i+=PX)for(let j=0;j<h;j+=PX){const r=Math.abs(Math.sin((i+seed)*12.9+j*78.2)*43758)%1;
    if(r>.86){ctx.fillStyle=RED[3];ctx.fillRect(x+i,y+j,PX,PX)}else if(r<.14){ctx.fillStyle=RED[0];ctx.fillRect(x+i,y+j,PX,PX)}}
  ctx.fillStyle='rgba(255,200,210,.25)';ctx.fillRect(x+w*.18,y,PX*2,h);
}
function drawLowerFoil(){foilPattern(1012,TEAR.y,152,100,3);ctx.fillStyle=RED[0];ctx.fillRect(1012,TEAR.y+94,152,6)}
function drawUpperFoil(ox,oy){
  ctx.save();ctx.translate(ox,oy);
  foilPattern(1018,494,140,TEAR.y-494,7);
  ctx.fillStyle=RED[1];ctx.beginPath();ctx.roundRect(1022,480,132,30,12);ctx.fill();
  ctx.fillStyle=RED[2];ctx.fillRect(1036,484,70,PX);
  if(!foilFly){const tx=TEAR.x1-tear*(TEAR.x1-TEAR.x0);ctx.fillStyle=RED[2];ctx.fillRect(tx,TEAR.y-12,24,24);ctx.fillStyle=RED[0];ctx.fillRect(tx+18,TEAR.y-12,6,24)}
  ctx.restore();
}
function drawTearLine(){
  const tx=TEAR.x1-tear*(TEAR.x1-TEAR.x0);
  if(phase==='foil'){ctx.fillStyle='#e8c0c8';for(let x=TEAR.x0;x<tx;x+=16)ctx.fillRect(x,TEAR.y-2,9,4)}
  ctx.fillStyle=tearMess>.25?'#2a0610':'#3a0a14';ctx.fillRect(tx,TEAR.y-3,TEAR.x1-tx,6);
  if(tearMess>.25)for(let x=tx;x<TEAR.x1;x+=12)ctx.fillRect(x,TEAR.y-8+((x*7)%14),6,6);
  if(phase==='foil'&&!held){ctx.fillStyle=`rgba(143,240,255,${.5+.4*Math.sin(performance.now()/200)})`;
    ctx.beginPath();ctx.moveTo(tx-30,TEAR.y);ctx.lineTo(tx-6,TEAR.y-14);ctx.lineTo(tx-6,TEAR.y+14);ctx.fill();
    ctx.strokeStyle='rgba(143,240,255,.5)';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(tx,TEAR.y-TUNE.TEAR_TOL);ctx.lineTo(TEAR.x0,TEAR.y-TUNE.TEAR_TOL);ctx.moveTo(tx,TEAR.y+TUNE.TEAR_TOL);ctx.lineTo(TEAR.x0,TEAR.y+TUNE.TEAR_TOL);ctx.stroke();ctx.setLineDash([])}
}
function drawXray(){
  const {x0,x1,y0,y1}=NECK,tt=performance.now()/1000;
  ctx.globalAlpha=focus;
  ctx.fillStyle='rgba(6,10,18,.78)';ctx.fillRect(x0,y0,x1-x0,y1-y0);
  const g=ctx.createLinearGradient(0,WINE_Y,0,y1);g.addColorStop(0,'rgba(120,18,40,.95)');g.addColorStop(1,'rgba(60,6,20,.95)');ctx.fillStyle=g;ctx.fillRect(x0,WINE_Y,x1-x0,y1-WINE_Y);
  for(let x=x0;x<x1;x+=PX){ctx.fillStyle='rgba(220,90,110,.6)';ctx.fillRect(x,WINE_Y+Math.round(Math.sin(x*.1+tt*2)*1.2),PX,3)}
  crumbs.forEach(c=>{ctx.fillStyle=c.c;ctx.fillRect(snap(c.x+Math.sin(tt+c.ph)*2),snap(c.y),c.s,c.s)});
  ctx.strokeStyle='rgba(143,240,255,.55)';ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.strokeRect(x0,y0,x1-x0,y1-y0);ctx.setLineDash([]);
  ctx.globalAlpha=1;
}
function drawCork(){
  if(corkOut==='broken'){ctx.fillStyle='rgba(150,110,70,.75)';ctx.fillRect(CX-CORK.w/2,RIM,CORK.w,22);for(let i=0;i<CORK.w;i+=12)ctx.fillRect(CX-CORK.w/2+i,RIM+22,8,8+((i*7)%14));return}
  const cy=corkOut==='out'?RIM-TUNE.PULL_LEN-(1-popT)*160:RIM-pull,x=CX-CORK.w/2;
  if(focus<=0)return;ctx.globalAlpha=.82*focus;
  ctx.fillStyle='#b5875a';ctx.fillRect(x,cy,CORK.w,CORK.h);ctx.fillStyle='#c99b6a';ctx.fillRect(x+6,cy,CORK.w-24,CORK.h);
  ctx.fillStyle='#a5774a';for(let i=0;i<26;i++){const hx=Math.abs(Math.sin(i*12.98)*437)%1,hy=Math.abs(Math.sin(i*78.2)*123)%1;ctx.fillRect(x+hx*(CORK.w-6),cy+4+hy*(CORK.h-12),PX,PX)}
  ctx.fillStyle='#e2bd8a';ctx.fillRect(x,cy,CORK.w,6);ctx.fillStyle='#6a3a28';ctx.fillRect(x,cy+CORK.h-8,CORK.w,8);
  ctx.strokeStyle='#3a220f';ctx.lineWidth=4;
  cracks.forEach(c=>{ctx.beginPath();ctx.moveTo(x+c.x,cy+c.y);ctx.lineTo(x+c.x+c.l,cy+c.y+c.l*c.a*.5);ctx.lineTo(x+c.x+c.l*.6,cy+c.y+c.l*.8);ctx.stroke()});
  ctx.globalAlpha=1;
  if(focus>0){ctx.strokeStyle=`rgba(143,240,255,${.7*focus})`;ctx.lineWidth=2;ctx.strokeRect(x,cy,CORK.w,CORK.h)}
}
function drawWorm(){
  if(phase==='foil'||corkOut==='broken')return;
  const out=corkOut==='out';
  const base=out?RIM-TUNE.PULL_LEN-(1-popT)*160:RIM-pull;
  const tipY=base+depth,topY=tipY-WORM_LEN;
  for(let i=0;i<=WORM_LEN;i+=3){const y=topY+i,ph=spin+i*.13,s=Math.sin(ph),c=Math.cos(ph),r=i<10?i:13;
    const inCork=y>base&&y<base+CORK.h&&!out;ctx.globalAlpha=inCork?.75:1;
    ctx.fillStyle=c>0?'#e8eef2':'#8f9aa3';ctx.fillRect(snap(CX+s*r)-3,y,7,4)}
  ctx.globalAlpha=1;
  ctx.fillStyle='#b8c2ca';ctx.fillRect(CX-4,topY-40,8,40);
  if(imgO.complete){const sc=Math.max(.18,Math.abs(Math.cos(spin)));ctx.save();ctx.translate(CX,topY-52);ctx.rotate(Math.PI/2);ctx.scale(1,sc);ctx.drawImage(imgO,-imgO.width/2,-imgO.height/2);ctx.restore()}
}
function drawGuide(){
  if(phase==='screw'){const p=pivot();ctx.strokeStyle='rgba(143,240,255,.25)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,230,0,7);ctx.stroke();
    const a=performance.now()/600;for(let k=0;k<3;k++){const aa=a+k*2.094,x=p.x+Math.cos(aa)*230,y=p.y+Math.sin(aa)*230;
      ctx.save();ctx.translate(x,y);ctx.rotate(aa+Math.PI/2);ctx.fillStyle='rgba(143,240,255,.55)';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-10);ctx.lineTo(-10,10);ctx.fill();ctx.restore()}}
  if(phase==='pull'){ctx.fillStyle='rgba(143,240,255,.5)';const yy=RIM-200-((performance.now()/8)%60);
    ctx.beginPath();ctx.moveTo(CX+170,yy-20);ctx.lineTo(CX+150,yy+6);ctx.lineTo(CX+190,yy+6);ctx.fill();ctx.fillRect(CX+164,yy+6,12,40)}
}
function drawHUD(){
  ctx.textBaseline='top';ctx.font='600 30px "Galmuri11","Pretendard",sans-serif';ctx.fillStyle='#b9c2cc';
  ctx.fillText('단계',26,8);ctx.fillText('코르크 상태',360,8);ctx.fillText(phase==='pull'?'당기는 속도':'회전 속도',700,8);
  ctx.font='700 40px ui-monospace,Consolas,monospace';ctx.fillStyle='#f2d58a';
  ctx.fillText({foil:'① 포장 까기',screw:'② 돌려 넣기',pull:'③ 뽑기',done:'완료'}[phase],24,46);
  ctx.font='500 22px "Pretendard",sans-serif';ctx.fillStyle='#8a96a6';
  ctx.fillText(phase==='screw'?`깊이 ${Math.round(turnAcc/TUNE.TURNS*100)}% (${turnAcc.toFixed(1)}/${TUNE.TURNS}바퀴)`:phase==='pull'?`뽑힘 ${Math.round(pull/TUNE.PULL_LEN*100)}%`:phase==='foil'?`벗김 ${Math.round(tear*100)}%`:'',24,96);
  const bx=360,by=56,bw=280,bh=26;ctx.fillStyle='#161c28';ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle=dur>60?'#9dff9d':dur>30?'#f2d58a':'#ff7a8a';ctx.fillRect(bx,by,bw*dur/100,bh);
  ctx.fillStyle='#0a0e16';TUNE.CRACKS.forEach(th=>ctx.fillRect(bx+bw*th/100-1,by,3,bh));   // 금 가는 지점 표시
  ctx.fillStyle='#8a96a6';ctx.fillText('부스러기 '+(crumbs.length+inAir.length)+'개',bx,by+36);
  const gx=700,gw=300,v=phase==='pull'?pullSpeed/(TUNE.SAFE_PULL*2):speed/(TUNE.SAFE_SPEED*2);
  ctx.fillStyle='#161c28';ctx.fillRect(gx,by,gw,bh);ctx.fillStyle='#2f6a40';ctx.fillRect(gx,by,gw/2,bh);ctx.fillStyle='#6a2a30';ctx.fillRect(gx+gw/2,by,gw/2,bh);
  ctx.fillStyle=v>.5?'#ff7a8a':'#e8f4ff';ctx.fillRect(gx+Math.min(1,Math.max(0,v))*gw-4,by-8,8,bh+16);
  ctx.fillStyle='#8a96a6';ctx.fillText(v>.5?'너무 빨라요! 코르크가 버티지 못해요':'',gx,by+36);
  fx.forEach((f,i)=>{ctx.save();ctx.globalAlpha=1-f.t/1.2;ctx.font='700 52px "Galmuri11","Pretendard",sans-serif';ctx.fillStyle=f.c;ctx.textAlign='center';
    ctx.fillText(f.txt,CX+430,RIM-160-f.t*40+i*70);ctx.restore()});
}
function draw(){
  update();
  ctx.save();if(shake>0){const m=shake*40;ctx.translate((Math.random()-.5)*m,(Math.random()-.5)*m)}
  ctx.drawImage(bg,0,0);
  // Preserve the wine sprite's aspect ratio and align its real mouth with the cork.
  ctx.translate(CX,340);ctx.scale(.72,.72);ctx.translate(-CX,-RIM);
  if(imgB.naturalWidth)ctx.drawImage(imgB,23,35,47,187,CX-141,RIM-4,282,1122);
  drawLowerFoil();
  drawXray();drawCork();
  inAir.forEach(c=>{ctx.fillStyle=c.c;ctx.fillRect(snap(c.x),snap(c.y),c.s,c.s)});
  if(phase==='foil')drawUpperFoil(0,0);
  if(foilFly)drawUpperFoil(foilFly.x,foilFly.y);
  drawTearLine();
  for(const p of parts){ctx.globalAlpha=Math.min(1,p.life*1.5);ctx.fillStyle=RED[2];ctx.fillRect(snap(p.x),snap(p.y),PX,PX)}ctx.globalAlpha=1;
  drawWorm();drawGuide();
  ctx.restore();
  drawHUD();

}
WineLab.start({
  images:[imgB,imgO], draw, reset,
  release(){rel();rotBuf=0;pullBuf=0;speed=0;pullSpeed=0;lastF=performance.now();},
  audio(paused){if(AC){if(paused)AC.suspend().catch(()=>{});else AC.resume().catch(()=>{});}},
  mute(){if(AC){AC.close().catch(()=>{});AC=null;}}
});
