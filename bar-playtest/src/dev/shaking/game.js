
let PAUSED=0,pauseAt=null;
function clock(){return (pauseAt??performance.now())-PAUSED}
function setPause(on){if(on&&pauseAt==null)pauseAt=performance.now();else if(!on&&pauseAt!=null){PAUSED+=performance.now()-pauseAt;pauseAt=null}}
let GT=0,lastReal=0;
// ═════════ LAST CALL 쉐이크 v9 — 스터 기믹과 같은 문법 ═════════
// 키박스(A·D) · 강조된 다음 키 · 도구를 감싼 시간 게이지 · 분할 진행 바 · TUTORIAL 모달
// STEP 1 틴 닫기: 작은 틴 기울기가 금색 구간일 때 A(왼쪽으로 밀어 넣기) → '쩍' (닫기 품질 = 버틸 수 있는 MISS 수)
// STEP 2 쉐이크: 강조된 키를 순서대로(A→D) 시간 안에 눌러 1회. 10회 = 완성. 쉐이커 안엔 도트 액체 + 얼음
const OPT={music:0,sfx:70,street:50,voice:'low',bgm:true,sfxOn:true,ring:true,shake:true,diff:'normal',snd:1};
const DIFF={easy:1.25,normal:1,hard:.8};   // 한 회 제한 시간 배율
const RECIPES=[
  {id:'daiquiri',name:'다이키리',lv:'EASY',spec:'화이트 럼 45 · 라임 20 · 시럽 15',
   layers:[['시럽','#e9b04e',.2],['라임','#86c83e',.28],['럼','#e6e9de',.52]],ice:4,rounds:10,win:1400,pattern:['AD'],rev:.15},
  {id:'fizz',name:'진 피즈',lv:'NORMAL',spec:'진 45 · 레몬 20 · 시럽 15 · 달걀흰자',
   layers:[['시럽','#e9b04e',.18],['레몬','#efd650',.24],['흰자','#f7f2e0',.18],['진','#cfe3ea',.4]],ice:5,rounds:10,win:1150,pattern:['AD'],rev:.3},
  {id:'sour',name:'위스키 사워',lv:'HARD',spec:'버번 50 · 레몬 25 · 시럽 15 · 흰자',
   layers:[['시럽','#e9b04e',.16],['레몬','#efd650',.26],['흰자','#f7f2e0',.14],['버번','#a45a1c',.44]],ice:5,rounds:10,win:1150,pattern:['AD','ADAD'],rev:.4},
];
const B={
  CLOSE:{center:6.5,amp:16,speed:2.4,perfect:[3,8],good:[-1,12],wild:[-5,18]},
  DUR:{P:2,G:1,B:0},
  SPEEDUP:.45,                       // 마지막 회 제한 시간 = 첫 회 × 이 값
  SPILL:.09,                         // MISS마다 새는 액체 비율                 // 닫기 품질별 허용 MISS
  PEN:{P:0,G:3,B:8},                 // 닫기 품질별 감점
  TRAVEL:62, VTRAVEL:30, spring:{k:1400,c:36}, K:1.3,
  // 액체 · 얼음
  CH:{x0:-218,x1:218,y0:-44,y1:44}, FILL:.52, WDAMP:.993, ICE_DRAG:3, PX:3, G:900, INERTIA:.9, AMAX:12000,
  ICE_COVERAGE:.25, chillMinV:300,
};
const NC=Math.round((B.CH.x1-B.CH.x0)/B.PX);       // 액체 칸 수
const DEPTH=B.CH.y1-B.CH.y0;
const TMPU=new Float32Array(NC+1),TMPH=new Float32Array(NC);
function layerCol(t){ // t: 0=바닥 ~ 1=수면 → 층 색 (섞일수록 평균색으로)
  const L=R.layers,tot=L.reduce((a,l)=>a+l[2],0);let acc=0,c=L[L.length-1][1];
  for(const l of L){acc+=l[2]/tot;if(t<=acc){c=l[1];break}}
  return c;
}
function avgHex(){const L=R.layers,tot=L.reduce((a,l)=>a+l[2],0);let r=0,g=0,b=0;for(const l of L){const [x,y,z]=hex(l[1]);r+=x*l[2]/tot;g+=y*l[2]/tot;b+=z*l[2]/tot}return [r,g,b]}
function avgCol(){const [r,g,b]=avgHex();return `rgb(${r|0},${g|0},${b|0})`}
function stepWater(dt,gx,gy){
  const h=S.h,u=S.u,dx=B.PX,n=NC;gy=Math.max(120,gy);
  for(let i=1;i<n;i++){
    const eta=(h[i]-h[i-1]);
    u[i]+=(-gy*eta/dx+gx)*dt;
    u[i]*=B.WDAMP;
    const lim=900;if(u[i]>lim)u[i]=lim;else if(u[i]<-lim)u[i]=-lim;
  }
  u[0]=0;u[n]=0;
  for(let i=1;i<n;i++)TMPU[i]=u[i]+.12*(u[i-1]+u[i+1]-2*u[i]);for(let i=1;i<n;i++)u[i]=TMPU[i];u[0]=0;u[n]=0;
  // 플럭스 (업윈드)
  let turb=0;
  for(let i=1;i<n;i++){const hu=u[i]>0?h[i-1]:h[i];const f=u[i]*hu*dt/dx;
    const ff=Math.max(-h[i]*.45,Math.min(h[i-1]*.45,f));h[i-1]-=ff;h[i]+=ff;turb+=Math.abs(u[i])}
  // 천장 넘치면 이웃으로 밀고 물보라
  for(let i=0;i<n;i++){if(h[i]>DEPTH-2){const ex=h[i]-(DEPTH-2);h[i]=DEPTH-2;const j=i>0&&(i===n-1||h[i-1]<h[i+1])?i-1:i+1;h[j]+=ex;}if(h[i]<0)h[i]=0}
  // 수치 확산 (뾰족한 기둥 방지)
  for(let i=0;i<n;i++)TMPH[i]=h[i]+.08*((h[i-1]??h[i])+(h[i+1]??h[i])-2*h[i]);for(let i=0;i<n;i++)h[i]=TMPH[i];
  // 부피 보정
  let sum=0;for(let i=0;i<n;i++)sum+=h[i];const k=(S.vol-(S.lost||0))/Math.max(1,sum);for(let i=0;i<n;i++)h[i]*=k;
  return turb/n;
}
function stepIces(dt,gx,gy){
  const C=B.CH,n=NC;
  for(const o of S.ices){
    const r=o.size,extent=r*(Math.abs(Math.cos(o.rot))+Math.abs(Math.sin(o.rot)));
    const ci=Math.max(0,Math.min(n-1,((o.x-C.x0)/B.PX)|0)),surf=C.y1-S.h[ci],fu=S.u[ci]||0;
    // 수평: 물 흐름에 끌림 + 축 방향 중력
    const impulse=GT-S.kickT<300;
    o.vx+=((fu-o.vx)*(impulse?.7:B.ICE_DRAG)+gx*(impulse?.25:.8))*dt;
    // 수직: 중력 + 부력 (잠긴 만큼 위로)
    const sub=Math.max(0,Math.min(2*r,(o.y+r)-surf));
    o.vy+=gy*(1-sub/(2*r)/.92)*dt;o.vy*=Math.exp(-(sub>0?3.5:.3)*dt);
    o.vx=Math.max(-2200,Math.min(2200,o.vx));o.vy=Math.max(-650,Math.min(650,o.vy));
    o.vr+=(fu-o.vx)*.008*dt;o.vr=Math.max(-5,Math.min(5,o.vr));
    o.x+=o.vx*dt;o.y+=o.vy*dt;o.rot+=o.vr*dt;o.vr*=Math.exp(-1.8*dt);
    const hit=v=>{if(Math.abs(v)>B.chillMinV*.6){const [wx,wy]=toWorld(o.x,o.y);iceImpact(o,Math.abs(v),wx,wy);o.vr+=(Math.random()-.5)*Math.abs(v)*.012}};
    if(o.x<C.x0+extent){hit(o.vx);o.wall='left';o.wallSpeed=Math.max(o.wallSpeed||0,Math.abs(o.vx));o.x=C.x0+extent;o.vx=Math.abs(o.vx)*.18}else if(o.x>C.x1-extent){hit(o.vx);o.wall='right';o.wallSpeed=Math.max(o.wallSpeed||0,Math.abs(o.vx));o.x=C.x1-extent;o.vx=-Math.abs(o.vx)*.18}
    if(o.y<C.y0+extent){hit(o.vy);o.y=C.y0+extent;o.vy=Math.abs(o.vy)*.2}else if(o.y>C.y1-extent){hit(o.vy);o.y=C.y1-extent;o.vy=-Math.abs(o.vy)*.2}
  }
  const ice=S.ices;
  for(let pass=0;pass<3;pass++){
  for(let i=0;i<ice.length;i++)for(let j=i+1;j<ice.length;j++){const a=ice[i],b=ice[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,spacing=(a.size+b.size)*Math.SQRT2;
    if(d<spacing){const nx=dx/d,ny=dy/d,pen=spacing-d;a.x-=nx*pen/2;a.y-=ny*pen/2;b.x+=nx*pen/2;b.y+=ny*pen/2;
      const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn<0){a.vx+=vn*nx*.65;a.vy+=vn*ny*.65;b.vx-=vn*nx*.65;b.vy-=vn*ny*.65;
        if(-vn>B.chillMinV){const [wx,wy]=toWorld((a.x+b.x)/2,(a.y+b.y)/2);iceImpact(a,-vn,wx,wy);a.vr+=(Math.random()-.5)*2;b.vr+=(Math.random()-.5)*2}}}}
  for(const o of ice){const e=o.size*(Math.abs(Math.cos(o.rot))+Math.abs(Math.sin(o.rot)));o.x=Math.max(C.x0+e,Math.min(C.x1-e,o.x));o.y=Math.max(C.y0+e,Math.min(C.y1-e,o.y));}
  }
}
function makeShakingIce(){
  const C=B.CH,n=10,weights=Array.from({length:n},()=>rand(.68,1.25)).sort((a,b)=>b-a);
  const scale=Math.sqrt((C.x1-C.x0)*DEPTH*B.ICE_COVERAGE/weights.reduce((sum,w)=>sum+4*w*w,0));
  const cubes=[];
  for(const w of weights){
    const size=w*scale,rot=rand(-.5,.5),extent=size*(Math.abs(Math.cos(rot))+Math.abs(Math.sin(rot)));
    let best=null,score=Infinity;
    for(let attempt=0;attempt<240;attempt++){
      const x=rand(C.x0+extent,22-extent),y=rand(C.y0+extent,C.y1-extent);
      const overlap=cubes.reduce((sum,o)=>sum+Math.max(0,(size+o.size)*Math.SQRT2-Math.hypot(x-o.x,y-o.y))**2,0);
      if(overlap<score){best={x,y};score=overlap;if(!score)break;}
    }
    cubes.push({size,...best,vx:0,vy:0,rot,vr:rand(-.3,.3),hitT:-1e9});
  }
  return cubes;
}
// 물보라 도트: 벽 근처에서 빠르게 밀려오거나, 수면이 가파를 때
function spray(dt,gx,gy){
  const C=B.CH,n=NC,h=S.h,u=S.u;
  for(const [i,dir] of [[1,-1],[n-1,1]]){const v=u[i]*dir;if(v>260&&Math.random()<dt*v/40){const ci=dir<0?0:n-1;
    for(let k=0;k<2;k++)S.drops2.push({x:dir<0?C.x0+3:C.x1-3,y:C.y1-h[ci],vx:-dir*rand(40,160),vy:-rand(120,320)*(v/500),life:.9});
    if(Math.random()<.3)slosh(Math.min(.8,v/900))}}
  for(let i=2;i<n-2;i+=3){const s=Math.abs(h[i+1]-h[i-1]);if(s>7&&Math.random()<dt*s*1.5)S.drops2.push({x:C.x0+i*B.PX,y:C.y1-h[i],vx:u[i]*.6+rand(-40,40),vy:-rand(60,200),life:.7})}
  for(const d of S.drops2){d.vx+=gx*dt;d.vy+=gy*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.life-=dt;
    if(d.x<C.x0+2||d.x>C.x1-2)d.vx*=-.4;if(d.y<C.y0+2){d.y=C.y0+2;d.vy=Math.abs(d.vy)*.3}
    const ci=Math.max(0,Math.min(n-1,((d.x-C.x0)/B.PX)|0));if(d.vy>0&&d.y>=C.y1-h[ci])d.life=0}
  S.drops2=S.drops2.filter(d=>d.life>0);if(S.drops2.length>220)S.drops2.splice(0,S.drops2.length-220);
}
function popText(txt,x,y,c,s,rot){S.texts.push({txt,x,y,c,s:s||1,rot:rot??(Math.random()-.5)*.25,t:GT})}
function mixColor(a,b,t){const pa=hex(a),pb=hex(b);return `rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*t)).join(',')})`}
function hex(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16))}
const snapP=v=>Math.round(v/B.PX)*B.PX;
function drawWater(now){
  const C=B.CH,P=B.PX,n=NC,h=S.h,m=Math.min(1,S.mix/100),[ar,ag,ab]=avgHex(),cold=S.chill/100;
  // 층 경계가 수면 모양을 살짝 따라가도록, 칸마다 바닥→수면 비율로 층 색 결정
  const bands=[];{const L=R.layers,tot=L.reduce((a,l)=>a+l[2],0);let acc=0;for(const l of L){bands.push([acc,acc+l[2]/tot,hex(l[1])]);acc+=l[2]/tot}}
  for(let i=0;i<n;i++){
    const x=C.x0+i*P,hh=Math.max(0,h[i]),top=snapP(C.y1-hh);
    if(hh<1)continue;
    // 몸통 (층별, 섞일수록 평균색)
    for(const [a,b,[r,g,bb]] of bands){
      const y0=snapP(C.y1-hh*b),y1=snapP(C.y1-hh*a);if(y1<=y0)continue;
      const R2=r+(ar-r)*m,G2=g+(ag-g)*m,B2=Math.min(255,bb+(ab-bb)*m+cold*12);
      ctx.fillStyle=`rgba(${R2|0},${G2|0},${B2|0},.5)`;ctx.fillRect(x,Math.max(top+P,y0),P,y1-Math.max(top+P,y0));
    }
    // 수면 도트 (밝게)
    const [sr,sg,sb]=m>.5?[ar,ag,ab]:bands[bands.length-1][2];
    ctx.fillStyle=`rgba(${(sr+(255-sr)*.55)|0},${(sg+(255-sg)*.55)|0},${Math.min(255,(sb+(255-sb)*.55)+cold*10)|0},.85)`;
    ctx.fillRect(x,top,P,P);
  }
  // 거품 (흔들림이 셀수록 수면 아래 반짝이는 도트)
  const fz=Math.min(14,S.turb/25|0);
  ctx.fillStyle='rgba(235,240,244,.55)';
  for(let k=0;k<fz;k++){const i=((k*37+((now/60)|0)*13)%n),hh=h[i];if(hh<P*3)continue;ctx.fillRect(C.x0+i*P,snapP(C.y1-hh)+P*(1+(k%3)),P,P)}
  // 물보라
  ctx.fillStyle='rgba(220,228,234,.85)';
  for(const d of S.drops2)ctx.fillRect(snapP(d.x),snapP(d.y),P,P);
}
function drawIcePx(o){
  const s=o.size,hot=Math.max(0,1-(GT-o.hitT)/180);
  ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot);
  const g=ctx.createLinearGradient(-s,-s,s,s);g.addColorStop(0,'rgba(240,253,255,.78)');g.addColorStop(.35,'rgba(180,222,238,.38)');g.addColorStop(1,'rgba(115,175,202,.5)');
  ctx.fillStyle=g;ctx.strokeStyle=`rgba(226,247,255,${.65+hot*.3})`;ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(-s,-s,s*2,s*2,4);ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.65)';ctx.beginPath();ctx.moveTo(-s+5,s*.3);ctx.lineTo(-s+5,-s+5);ctx.lineTo(s*.4,-s+5);ctx.stroke();
  ctx.strokeStyle='rgba(235,251,255,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-s*.3,-s*.5);ctx.lineTo(s*.2,s*.1);ctx.lineTo(0,s*.55);ctx.stroke();
  ctx.restore();
}
function tinBody(x0,x1,h0,h1,big){
  const hm=Math.max(h0,h1),g=ctx.createLinearGradient(0,-hm,0,hm);
  g.addColorStop(0,'#55666e');g.addColorStop(.1,'#f2f8fa');g.addColorStop(.2,'#a7b8bf');g.addColorStop(.42,'#56686f');
  g.addColorStop(.55,'#1d282d');g.addColorStop(.72,'#71868e');g.addColorStop(.9,'#d6e2e6');g.addColorStop(1,'#7b8e95');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x0,-h0);ctx.lineTo(x1,-h1);ctx.lineTo(x1,h1);ctx.lineTo(x0,h0);ctx.closePath();ctx.fill();
  const bx=big?x0:x1,bh=big?h0:h1,dir=big?1:-1;
  ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(Math.min(bx,bx+dir*10),-bh,10,bh*2);
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(Math.min(bx+dir*12,bx+dir*16),-bh,4,bh*2);
}
// 세로 작은 틴: y0(위)=바닥, y1(아래)=입구
function tinBody2(y0,y1,w0,w1){
  const g=ctx.createLinearGradient(-w1,0,w1,0);
  g.addColorStop(0,'#55666e');g.addColorStop(.12,'#f2f8fa');g.addColorStop(.25,'#a7b8bf');g.addColorStop(.48,'#56686f');g.addColorStop(.6,'#1d282d');g.addColorStop(.8,'#71868e');g.addColorStop(1,'#d6e2e6');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-w0,y0);ctx.lineTo(w0,y0);ctx.lineTo(w1,y1);ctx.lineTo(-w1,y1);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(-w0,y0,w0*2,9);ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-w0,y0+11,w0*2,4);
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}

// Audio is supplied by session-audio.js, never the prototype synthesizer.
function audio(){ShakeLabAudio.unlock()}
function slide(){}
function clank(){ShakeLabAudio.hit()}
function smack(){ShakeLabAudio.hit()}
function slosh(){}
function rattle(){}
function iceClack(){}
function note(){ShakeLabAudio.hit()}
function buzz(){}
function clink(){ShakeLabAudio.hit()}
function $(id){return document.getElementById(id)}

// ───────── 캔버스 / 좌표
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const W=880,H=640;
function fit(){const d=Math.min(window.devicePixelRatio||1,2);cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0)}
fit();addEventListener('resize',fit);
const SC={x:440,y:322};
const KEYPOS={A:[62,322],D:[818,322]};
function shakerXf(){return {x:SC.x+S.px,y:SC.y+S.py,a:S.px/B.TRAVEL*.14}}
function shakerView(now=GT){
  if(S.unseal){
    const age=now-S.unseal.t,settle=Math.min(1,Math.max(0,age/200)),q=Math.min(1,Math.max(0,(age-200)/800)),e=q*q*(3-2*q);
    return{x:SC.x+S.unseal.x*(1-settle),y:SC.y+S.unseal.y*(1-settle),a:S.unseal.a*(1-settle)-Math.PI/2*e,zoom:1-.32*e};
  }
  const f=shakerXf(),closing=S.phase==='close'||S.phase==='tut';
  const progress=closing&&S.closeQ?Math.max(0,Math.min(1,(now-S.slapT-160)/840)):0;
  const ease=progress*progress*(3-2*progress);
  return {...f,a:f.a+(closing?-Math.PI/2*(1-ease):0),zoom:closing?.68+.32*ease:1};
}
function closingTinOffset(now=GT){
  const lateral=(S.angDeg-(B.CLOSE.perfect[0]+B.CLOSE.perfect[1])/2)*4;
  // Local +X points upward: shallow circular arc, highest at the center.
  const radius=140,height=88-(radius-Math.sqrt(Math.max(0,radius*radius-lateral*lateral)));
  const angle=Math.asin(Math.max(-1,Math.min(1,lateral/radius)))*.55;
  if(S.closeQ){const t=Math.min(1,Math.max(0,(now-S.slapT)/160)),e=t*t*(3-2*t);return{x:18+(height-18)*(1-e),y:lateral*(1-e),angle:angle*(1-e)};}
  const t=(now-S.bounceT)/400,bounce=t>=0&&t<1?Math.sin(t*Math.PI)*22:0;
  return{x:height+bounce,y:lateral,angle};
}
function unsealPresentation(now=GT){
  const age=now-S.unseal.t,t=Math.max(0,Math.min(1,(age-1000)/600)),e=t*t*(3-2*t);
  const fade=Math.max(0,Math.min(1,(age-1600)/400));
  return{offset:18+70*e,alpha:1-fade*fade*(3-2*fade)};
}
function toWorld(lx,ly){const f=shakerView(),c=Math.cos(f.a),s=Math.sin(f.a),x=lx*B.K*f.zoom,y=ly*B.K*f.zoom;return [f.x+x*c-y*s,f.y+x*s+y*c]}

let R=RECIPES[0],S;
function reset(){
  ShakeLabAudio.stop();labTasks=[];
  S={phase:'tut',tutPage:0,closeT:GT,angDeg:0,closeQ:null,dur:0,slapT:-1e9,bounceT:-1e9,
     px:0,py:0,vx:0,vy:0,tx:0,ty:0,ax:0,ay:0,
     h:null,u:null,turb:0,drops2:[],ices:[],mix:0,chill:0,
     round:0,k:0,seq:'AD',roundT:0,res:[],misses:0,waitT:0,combo:0,best:0,
     startT:0,endT:0,cam:0,hitstopUntil:0,fx:[],texts:[],label:null,flash:0,
     unseal:null,pop:null,done:false,tinX:0,tinY:0,tinA:0};
  $('res').hidden=true;renderRecipe();renderBar();showTut(0);
}
function rand(a,b){return a+Math.random()*(b-a)}

// ───────── 레시피 탭
const recBox=$('tabs');
RECIPES.forEach((r,i)=>{const b=document.createElement('button');b.type='button';b.innerHTML=`<i>0${i+1}</i>${r.name}`;b.onclick=()=>{R=r;reset()};b.dataset.id=r.id;recBox.appendChild(b)});
function renderRecipe(){[...recBox.children].forEach(b=>b.setAttribute('aria-pressed',b.dataset.id===R.id))}
function renderBar(){const bar=$('bar');bar.innerHTML='';for(let i=0;i<R.rounds;i++){const s=document.createElement('span');bar.appendChild(s)}}
function paintBar(){[...$('bar').children].forEach((s,i)=>{s.className=S.res[i]==='O'?'ok':S.res[i]==='M'?'miss':''})}

// ───────── 튜토리얼 (스터와 같은 모달)
const TUT=[
  {t:'틴 닫기',chip:'SPACE',body:['① 위쪽 작은 틴이 얕은 반원 궤적으로 좌우를 오갑니다.','② 중앙의 <b>금색 구간</b>에 맞춰 Space를 누르면 아래로 끼워집니다.','결합하면 쉐이커가 가로로 회전하며 확대됩니다. 잘 닫을수록 MISS를 더 버틸 수 있습니다.'],demo:'close'},
  {t:'시간 안에 한 번 흔들기',chip:'A → D',body:['① 쉐이커를 감싼 게이지가 한 번의 남은 시간을 나타냅니다.','② 강조된 다음 키를 순서대로 눌러 제한 시간 안에 한 번을 완성하세요.','회차가 갈수록 빨라지고, 가끔 <b>반대 순서(D → A)</b>가 나옵니다.','MISS마다 이음새로 술이 새고, 허용된 MISS를 넘기면 틴이 빠집니다.'],demo:'shake'},
];
function showTut(p){
  S.tutPage=p;$('tut').hidden=false;setPause(true);
  const T=TUT[p];$('tutPage').textContent=`${p+1} / ${TUT.length}`;$('tutHead').textContent=T.t;
  const chip=R.id==='sour'&&p===1?'A → D · A → D → A → D':T.chip;$('tutChip').textContent=chip;
  $('tutBody').innerHTML=T.body.map(x=>`<p>${x}</p>`).join('');
  $('tutPrev').hidden=p===0;$('tutNext').innerHTML=p<TUT.length-1?'다음 · <kbd>E</kbd>':'확인 · <kbd>E</kbd>';
}
function tutNext(){if(S.tutPage<TUT.length-1)showTut(S.tutPage+1);else{$('tut').hidden=true;setPause(false);S.phase='close';S.closeT=GT;S.startT=GT}}
$('tutNext').onclick=()=>{audio();tutNext()};$('tutPrev').onclick=()=>showTut(Math.max(0,S.tutPage-1));
// 튜토리얼 그림 (작은 캔버스, 실제 화면 축소판)
const tv=$('tutCv'),tc=tv.getContext('2d');
function drawTutDemo(now){
  if($('tut').hidden)return;
  const w=tv.width,h=tv.height,demo=TUT[S.tutPage].demo;tc.clearRect(0,0,w,h);
  tc.fillStyle='#0a141b';tc.fillRect(0,0,w,h);
  tc.strokeStyle='rgba(85,215,238,.05)';for(let x=0;x<w;x+=14){tc.beginPath();tc.moveTo(x,0);tc.lineTo(x,h);tc.stroke()}for(let y=0;y<h;y+=14){tc.beginPath();tc.moveTo(0,y);tc.lineTo(w,y);tc.stroke()}
  const cx=w/2,cy=h/2;
  if(demo==='close'){
    const lateral=40*Math.sin(now/400),height=25-(100-Math.sqrt(10000-lateral*lateral));
    tc.save();tc.translate(cx,cy-15);tc.rotate(-Math.PI/2);tc.scale(.5,.5);tc.fillStyle='#b7cbd4';tc.fillRect(-110,-24,115,48);tc.translate(height,lateral);tc.rotate(Math.asin(lateral/100)*.55);tc.fillRect(0,-22,90,44);tc.restore();
    tc.strokeStyle='#55d7ee';tc.strokeRect(cx-45,h-34,90,26);tc.fillStyle='#e4f8fc';tc.font='700 12px "Galmuri11",monospace';tc.textAlign='center';tc.fillText('SPACE',cx,h-16);return;
  }
  // 쉐이커 실루엣
  const sw=demo==='shake'?Math.sin(now/220)*10:0;
  tc.save();tc.translate(cx+sw,cy);
  const g=tc.createLinearGradient(0,-22,0,22);g.addColorStop(0,'#5d727b');g.addColorStop(.2,'#eef5f7');g.addColorStop(.55,'#2b383e');g.addColorStop(1,'#cdd9dd');
  tc.fillStyle=g;tc.beginPath();tc.moveTo(-110,-17);tc.lineTo(10,-24);tc.lineTo(10,24);tc.lineTo(-110,17);tc.fill();
  tc.save();if(demo==='close'){tc.translate(40,-10);tc.rotate((6.5-16*Math.cos(now/400))*Math.PI/180)}tc.beginPath();tc.moveTo(-5,-22);tc.lineTo(100,-17);tc.lineTo(100,17);tc.lineTo(-5,22);tc.fill();tc.restore();
  tc.restore();
  // 키 박스
  const key=(k,x,y,on)=>{tc.strokeStyle=on?'#55d7ee':'rgba(138,162,173,.4)';tc.lineWidth=on?2:1;tc.fillStyle=on?'rgba(85,215,238,.15)':'rgba(0,0,0,.2)';tc.fillRect(x-11,y-11,22,22);tc.strokeRect(x-11,y-11,22,22);
    tc.fillStyle=on?'#e4f8fc':'#5d7480';tc.font='700 12px "Galmuri11",monospace';tc.textAlign='center';tc.textBaseline='middle';tc.fillText(k,x,y+1)};
  const t=(now/600)%2;
  key('A',22,cy,demo==='close'||(demo==='shake'&&t<1));key('D',w-22,cy,demo==='shake'&&t>=1);
  // 빨간 강조 박스 (스터 튜토리얼과 같은 표시)
  tc.strokeStyle='#ff5a5a';tc.lineWidth=1.5;
  if(demo==='close')tc.strokeRect(cx-10,cy-40,140,80);else{tc.beginPath();tc.roundRect(30,cy-46,w-60,92,46);tc.stroke()}
  tc.fillStyle='#ff5a5a';tc.beginPath();tc.arc(demo==='close'?cx-10:30,cy-46,3,0,7);tc.fill();
}

// ───────── 입력
addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Escape'){e.preventDefault();toggleSettings();return}
  if(!$('settings').hidden)return;
  if(!$('tut').hidden){if(e.code==='KeyE'||e.code==='Enter'){e.preventDefault();audio();tutNext()}return}
  if(!$('res').hidden){if(e.code==='KeyE'||e.code==='Space'){e.preventDefault();reset()}return}
  if(S.phase==='close'){if(e.code==='Space'){e.preventDefault();audio();press('Space')}return}
  const k={KeyA:'A',KeyD:'D',ArrowLeft:'A',ArrowRight:'D'}[e.code];
  if(!k)return;e.preventDefault();if(e.repeat)return;audio();press(k);
});
// 화면 키박스 클릭/터치도 같은 입력
cv.addEventListener('pointerdown',e=>{audio();const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
  if(S.phase==='close'){press('Space');return}
  for(const k in KEYPOS){const [kx,ky]=KEYPOS[k];if(Math.abs(x-kx)<46&&Math.abs(y-ky)<46){press(k);return}}
  // 박스 밖: 왼쪽 절반 A, 오른쪽 절반 D (모바일 편의)
  if(S.phase==='shake')press(x<W/2?'A':'D');else if(S.phase==='close')press('Space')});
$('again').onclick=reset;$('other').onclick=()=>{R=RECIPES[(RECIPES.indexOf(R)+1)%RECIPES.length];reset()};$('home').onclick=()=>{R=RECIPES[0];reset()};

function press(k){
  if(pauseAt!=null||!$('settings').hidden||!$('tut').hidden)return;
  const now=GT;if(S.done)return;
  if(S.phase==='close'){if(k==='Space')slap(now);return}
  if(S.phase!=='shake'||now<S.waitT||S.pending)return;
  const want=S.seq[S.k];
  ShakeLabAudio.hit();
  throwTo(k);
  if(k!==want){miss(now,'wrong');return}
  S.k++;
  if(S.k>=S.seq.length)success(now);
}
function throwTo(k){
  if(typeof beginLunaStroke==='function')beginLunaStroke(k);
  S.tx=k==='A'?-B.TRAVEL:B.TRAVEL;S.ty=0;
  S.kickKey=k;S.kickT=GT;
  // Input, tilt and contents all move toward the same selected side.
  const direction=k==='A'?-1:1;
  S.vx=direction*480;S.cam=Math.max(S.cam,4);
  for(const o of S.ices){o.vx=direction*rand(1800,2100);o.vy+=rand(-85,45);o.vr+=direction*rand(.7,2);o.wall=null;o.wallSpeed=0;}
  if(S.u)for(let i=1;i<S.u.length-1;i++)S.u[i]=direction*850;
}

// ═════ STEP 1 틴 닫기 (W 한 번) ═════
function slap(now){
  if(now-S.bounceT<400||S.closeQ)return;
  const a=S.angDeg,C=B.CLOSE;
  const q=a>=C.perfect[0]&&a<=C.perfect[1]?'P':a>=C.good[0]&&a<=C.good[1]?'G':a>=C.wild[0]&&a<=C.wild[1]?'B':null;
  if(!q){S.bounceT=now;S.cam=8;popText('덜컹!',SC.x+200,SC.y-110,'#ff6a6a',1.2);clank(.9);return}
  S.closeQ=q;S.dur=B.DUR[q];S.slapT=now;S.cam=q==='P'?14:9;if(q==='P')S.hitstopUntil=performance.now()+80;
  const [sx,sy]=toWorld(40,0);S.fx.push({k:'ring',x:sx,y:sy,t:now,big:q==='P'});
  for(let i=0;i<(q==='P'?24:10);i++){const an=Math.random()*Math.PI*2;S.fx.push({k:'p',x:sx,y:sy+rand(-60,60),vx:Math.cos(an)*rand(100,260),vy:-rand(60,260),life:.6,max:.6,c:'rgba(200,240,250,.9)',r:3,g:700})}
  popText({P:'쩍!!',G:'탁!',B:'턱… 헐겁다'}[q],SC.x+150,SC.y-120,{P:'#f0c987',G:'#55d7ee',B:'#ff9a6a'}[q],q==='P'?1.8:1.2);
  smack(q==='B'?'W':q);
  labDelay(()=>{if(S.phase==='close')startShake()},1000);
}
// ═════ STEP 2 쉐이크 ═════
function startShake(){
  S.phase='shake';
  const C=B.CH;S.h=new Float32Array(NC).fill(DEPTH*B.FILL);S.u=new Float32Array(NC+1);S.vol=DEPTH*B.FILL*NC;
  S.ices=makeShakingIce();
  nextRound();
}
function win(){const k=1-(1-B.SPEEDUP)*Math.min(1,S.round/Math.max(1,R.rounds-1));return R.win*DIFF[OPT.diff]*(S.seq.length/2)*k}
function nextRound(){
  if(S.round>=R.rounds){const pose=shakerXf();S.phase='unseal';S.endT=GT;S.unseal={t:GT,x:S.px,y:S.py,a:pose.a};S.fx=[];S.drops2=[];S.cam=0;S.flash=0;S.label=null;popText('쉐이크 완료!',W/2,90,'#f0c987',1.3);return}
  S.seq=R.pattern[S.round%R.pattern.length];
  // 3회차부터 가끔 반대 순서 (D→A) — 습관적으로 A부터 누르면 MISS
  if(R.rev&&S.round>=2&&Math.random()<R.rev){S.seq=S.seq.split('').map(c=>c==='A'?'D':'A').join('');popText('반대로!',W/2,560,'#ff9a6a',.9)}
  S.k=0;S.roundT=GT;
  // 다음 회 시작 키가 이미 그쪽에 있으면 반대부터 (A→D 다음엔 A로 돌아오며 시작)
}
function success(now){
  const t=(now-S.roundT)/win(),fast=t<.55;
  S.res.push('O');S.round++;S.combo++;S.best=Math.max(S.best,S.combo);
  S.mix=Math.min(100,S.mix+100/R.rounds);S.chill=Math.min(100,S.chill+100/R.rounds);
  S.flash=1;S.cam=Math.max(S.cam,fast?9:6);if(fast)S.hitstopUntil=performance.now()+45;
  const side=S.kickKey==='A'?-1:1,[ex,ey]=toWorld(side<0?B.CH.x0:B.CH.x1,0);
  S.fx.push({k:'ring',x:ex,y:ey,t:now,big:fast});
  for(let i=0;i<(fast?22:12);i++){const a=Math.random()*Math.PI*2,sp=rand(80,fast?320:200);S.fx.push({k:'p',x:ex,y:ey,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:rand(.25,.5),max:.5,c:'#e6fbff',r:3,g:500})}
  popText(fast?'CRACK!':'좋아',ex-side*60,ey-60,fast?'#f0c987':'#55d7ee',fast?1.2:.9);
  S.label={t:now,g:'ok',fast};
  iceClack(fast?1:.7);
  paintBar();nextRound();
}
function miss(now,why){
  S.res.push('M');S.round++;S.misses++;S.combo=0;
  if(S.h){S.lost=(S.lost||0)+S.vol*B.SPILL;const [sx,sy]=toWorld(40,0);
    for(let i=0;i<34;i++){const a=-Math.PI/2+(Math.random()-.5)*2.2,sp=rand(120,380);S.fx.push({k:'p',x:sx+rand(-8,8),y:sy+rand(-70,70),vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.5,1),max:1,c:avgCol(),r:3,g:900})}
    popText('술이 샌다!',sx,sy-110,'#f0c987',.9);slosh(.8)}
  S.label={t:now,g:'miss'};S.cam=6;S.waitT=now+350;
  popText(why==='time'?'MISS · 시간 초과':'MISS · 순서',W/2,96,'#ff6a6a',1);buzz();
  paintBar();
  if(S.misses>S.dur){popOff(now);return}
  if(S.misses===S.dur)popText('이음새 한계!',W/2,124,'#ff6a6a',1.1);
  S.pending=true;labDelay(()=>{S.pending=false;if(S.phase==='shake')nextRound()},350);
}
function popOff(now){
  S.phase='pop';S.endT=now;S.pop={t:now,vx:560,vy:-340,spin:9};S.cam=20;
  popText('틴이 빠졌다!',W/2,90,'#ff6a6a',1.6);
  // Opaque shells stay intact; spilled contents are simulated outside the opening.
  S.h=null;S.u=null;S.ices=[];S.drops2=[];S.fx=[];
  S.pop.spillColor=avgCol();S.pop.spillCarry=0;
  for(let i=0;i<64;i++)emitFailureLiquid(true);
  clank(1);smack('P');slosh(1);
  labDelay(()=>finish('pop'),1500);
}
function emitFailureLiquid(burst=false){
  const [x,y]=toWorld(40,burst?rand(-45,45):rand(22,48));
  const life=rand(.75,1.25);
  S.fx.push({k:'liquid',x,y,vx:burst?rand(100,490):rand(45,140),vy:burst?rand(-260,100):rand(30,150),life,max:life,c:S.pop.spillColor,r:burst?rand(2,5):rand(3,6),g:720});
}
function iceImpact(o,v,wx,wy){ // 쉐이크 중 얼음 충돌: 소리·도트만 (진행은 회차 판정으로)
  const now=GT;if(now-o.hitT<110)return;o.hitT=now;
  const k=Math.min(1.4,(v-B.chillMinV)/700);if(k<=0){if(v>100)iceClack(.15);return}
  for(let i=0;i<3+k*8;i++){const a=Math.random()*Math.PI*2,sp=rand(60,200)*k;S.fx.push({k:'p',x:wx,y:wy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,life:rand(.2,.4),max:.4,r:3,g:400,c:'#e6fbff'})}
  iceClack(Math.min(.8,.25+k*.4));
}
function finish(reason){
  if(S.done)return;S.done=true;S.phase='done';
  const ok=S.res.filter(x=>x==='O').length,N=R.rounds;
  let score=Math.round(ok/N*100)-(B.PEN[S.closeQ]||0);if(reason==='pop')score=0;score=Math.max(0,Math.min(100,score));
  const grade=score>=85?'완벽':score>=60?'보통':'망함';
  $('rsTitle').textContent=reason==='pop'?'틴이 빠졌다':'쉐이크 완료';$('rsScore').textContent=score;$('rsScore').dataset.g=grade;
  $('rsSub').textContent=`성공 ${ok} / ${N}`;
  $('rsLine').textContent=reason==='pop'?'MISS가 이음새 한계를 넘었다. 틴을 더 단단히 닫아야 한다.':ok===N?'서두르지 않고 표시된 순서를 끝까지 지켰다.':'서두르지 말고 표시된 타이밍과 순서를 따라가 보세요.';
  $('rsChips').innerHTML=[`조작 시간 ${((S.endT-S.startT)/1000).toFixed(1)}s`,`틴 닫기 ${{P:'쩍 (완벽)',G:'탁',B:'헐거움'}[S.closeQ]}`,`최대 연속 ${S.best}`].map(x=>`<span>${x}</span>`).join('');
  $('rsRows').innerHTML='';$('rsNote').textContent=`${R.name} · ${R.lv} · 허용 MISS ${S.dur}`;
  $('res').hidden=false;
}

// ───────── 업데이트
function update(now,dt){
  const sec=dt/1000;
  if(S.phase==='close'&&!S.closeQ){const C=B.CLOSE,t=(now-S.closeT)/1000;S.angDeg=C.center-C.amp*Math.cos(t*C.speed)}
  if(S.phase==='shake'&&!S.pending&&now>=S.waitT&&now-S.roundT>win())miss(now,'time');
  // 쉐이커 스프링
  if(sec>0&&(S.phase==='shake'||S.phase==='close')){
    if(S.phase!=='shake'){S.tx=0;S.ty=0}
    const vx0=S.vx,vy0=S.vy;
    S.vx+=(B.spring.k*(S.tx-S.px)-B.spring.c*S.vx)*sec;S.vy+=(B.spring.k*(S.ty-S.py)-B.spring.c*S.vy)*sec;
    S.px+=S.vx*sec;S.py+=S.vy*sec;
    S.ax=S.ax*.4+((S.vx-vx0)/sec)*.6;S.ay=S.ay*.4+((S.vy-vy0)/sec)*.6;
  }
  if(S.h&&sec>0&&S.phase==='shake'){
    const f=shakerXf(),th=f.a,cs=Math.cos(th),sn=Math.sin(th);
    const ax=Math.max(-B.AMAX,Math.min(B.AMAX,S.ax))/B.K,ay=Math.max(-B.AMAX,Math.min(B.AMAX,S.ay))/B.K;
    const lax=ax*cs+ay*sn,lay=-ax*sn+ay*cs;
    const strokeAge=now-S.kickT,stroke=strokeAge>=0&&strokeAge<300;
    const glx=B.G*sn+(stroke?(S.kickKey==='A'?-1:1)*3200*(1-strokeAge/300):-lax*B.INERTIA),gly=B.G*cs-lay*B.INERTIA;
    const subs=6,hh=Math.min(sec,1/30)/subs;let tb=0;
    for(let i=0;i<subs;i++){tb+=stepWater(hh,glx,gly);stepIces(hh,glx,gly)}
    S.turb=S.turb*.85+tb/subs*.15;spray(Math.min(sec,1/30),glx,gly);
  }
  if(S.phase==='unseal'&&now-S.unseal.t>=3000)finish('unseal');
  if(S.phase==='pop'){const P=S.pop;S.tinX+=P.vx*sec;P.vy+=900*sec;S.tinY+=P.vy*sec;S.tinA+=P.spin*sec}
  S.cam*=Math.pow(.0012,sec);S.flash*=Math.pow(.01,sec);
  if(S.phase==='pop'&&sec>0){
    const age=(now-S.pop.t)/1000;
    if(age<1){S.pop.spillCarry+=sec*100*(1-age);while(S.pop.spillCarry>=1){emitFailureLiquid();S.pop.spillCarry--;}}
  }
  S.fx=S.fx.filter(p=>{if(p.k==='ring')return now-p.t<420;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=(p.g??500)*sec;p.life-=sec;return p.life>0});
  S.texts=S.texts.filter(t=>now-t.t<800);
}

// ───────── 그리기
function draw(now){
  ctx.clearRect(0,0,W,H);
  const cam=OPT.shake?S.cam:0;
  ctx.save();ctx.translate((Math.random()-.5)*cam,(Math.random()-.5)*cam);
  if(S.phase==='shake'||S.phase==='pop')drawGauge(now);
  drawShaker(now);
  drawKeys(now);
  for(const f of S.fx){if(f.k!=='ring')continue;const k=(now-f.t)/420;ctx.strokeStyle=`rgba(255,244,214,${(1-k)*(f.big?1:.6)})`;ctx.lineWidth=(f.big?6:3)*(1-k)+1;ctx.beginPath();ctx.arc(f.x,f.y,16+k*(f.big?100:60),0,7);ctx.stroke()}
  for(const p of S.fx){if(p.k==='ring')continue;ctx.globalAlpha=Math.min(1,Math.max(0,p.life/.25))*.85;ctx.fillStyle=p.c;
    if(p.k==='liquid'){
      ctx.strokeStyle=p.c;ctx.lineWidth=p.r*2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x,p.y);ctx.stroke();
      ctx.fillStyle='rgba(235,250,255,.45)';ctx.fillRect(p.x-1,p.y-2,2,2);
    }else{ctx.globalAlpha=Math.max(0,p.life/p.max);const q=Math.max(2,Math.round(p.r));ctx.fillRect(Math.round(p.x/q)*q,Math.round(p.y/q)*q,q,q)}
  }
  ctx.globalAlpha=1;ctx.restore();
  for(const t of S.texts){const k=(now-t.t)/800,pop=k<.14?k/.14*1.2:1.2-(k-.14)*.25;ctx.save();ctx.translate(t.x,t.y-k*20);ctx.rotate(t.rot);ctx.scale(t.s*pop,t.s*pop);
    ctx.globalAlpha=k>.7?(1-k)/.3:1;ctx.font='700 26px "Galmuri11",sans-serif';ctx.textAlign='center';ctx.lineWidth=6;ctx.strokeStyle='rgba(5,12,17,.85)';ctx.strokeText(t.txt,0,0);ctx.fillStyle=t.c;ctx.fillText(t.txt,0,0);ctx.restore()}
}
// 스터의 원형 링 = 쉐이커를 감싼 캡슐 게이지 (남은 시간, 12시 방향부터 시계방향으로 줄어듦)
const CAP={x:118,y:212,w:644,h:220,r:110};
function capPath(c){c.beginPath();c.roundRect(CAP.x,CAP.y,CAP.w,CAP.h,CAP.r)}
const CAP_LEN=2*(CAP.w-2*CAP.r)+2*Math.PI*CAP.r;
function drawGauge(now){
  ctx.save();
  capPath(ctx);ctx.strokeStyle='rgba(120,150,165,.18)';ctx.lineWidth=5;ctx.stroke();
  let rem=0,col='rgba(240,250,255,.95)';
  if(S.phase==='shake'&&now>=S.waitT){rem=Math.max(0,1-(now-S.roundT)/win());if(rem<.25)col='rgba(255,154,106,.95)'}
  if(S.phase==='close'&&!S.closeQ)rem=0;
  if(rem>0){
    // 12시(상단 중앙)부터 시작하도록 대시 오프셋
    ctx.setLineDash([CAP_LEN*rem,CAP_LEN]);ctx.lineDashOffset=-(CAP.w/2-CAP.r);
    ctx.beginPath();ctx.moveTo(CAP.x+CAP.w/2,CAP.y);ctx.lineTo(CAP.x+CAP.w-CAP.r,CAP.y);ctx.arc(CAP.x+CAP.w-CAP.r,CAP.y+CAP.r,CAP.r,-Math.PI/2,Math.PI/2);
    ctx.lineTo(CAP.x+CAP.r,CAP.y+CAP.h);ctx.arc(CAP.x+CAP.r,CAP.y+CAP.r,CAP.r,Math.PI/2,Math.PI*1.5);ctx.lineTo(CAP.x+CAP.w/2,CAP.y);
    ctx.setLineDash([CAP_LEN*rem,CAP_LEN]);ctx.lineDashOffset=0;
    ctx.shadowColor='rgba(150,230,255,.8)';ctx.shadowBlur=12;ctx.strokeStyle=col;ctx.lineWidth=5;ctx.stroke();
  }
  if(S.flash>.02){capPath(ctx);ctx.setLineDash([]);ctx.shadowBlur=0;ctx.strokeStyle=`rgba(85,215,238,${S.flash})`;ctx.lineWidth=3;ctx.stroke()}
  if(S.label&&S.label.g==='miss'&&now-S.label.t<350){capPath(ctx);ctx.setLineDash([]);ctx.strokeStyle=`rgba(255,90,90,${1-(now-S.label.t)/350})`;ctx.lineWidth=4;ctx.stroke()}
  ctx.restore();
}
function drawKeys(now){
  if(S.phase==='close'||S.phase==='tut'){
    if(S.closeQ)return;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#122b36';ctx.strokeStyle='#55d7ee';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(W/2-85,555,170,44,6);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(W/2-54,574);ctx.lineTo(W/2-54,583);ctx.lineTo(W/2-28,583);ctx.lineTo(W/2-28,574);ctx.stroke();
    ctx.fillStyle='#e9fbff';ctx.font='700 18px "Galmuri11",monospace';ctx.fillText('SPACE',W/2+15,578);
    ctx.font='16px sans-serif';ctx.fillText('중앙에 맞춰 결합',W/2,622);
    const C=B.CLOSE,X=a=>W/2+(a-(C.perfect[0]+C.perfect[1])/2)*4*B.K*.68;
    ctx.fillStyle='#18313e';ctx.fillRect(X(C.center-C.amp-2),8,(C.amp*2+4)*4*B.K*.68,8);
    ctx.fillStyle='#55d7ee';ctx.fillRect(X(C.good[0]),8,X(C.good[1])-X(C.good[0]),8);
    ctx.fillStyle='#f0c987';ctx.fillRect(X(C.perfect[0]),6,X(C.perfect[1])-X(C.perfect[0]),12);
    ctx.fillStyle='#fff';ctx.fillRect(X(S.angDeg)-2,1,4,22);ctx.restore();return;
  }
  if(S.phase!=='shake'&&S.phase!=='pop')return;
  let want=null;
  if(S.phase==='close'&&!S.closeQ)want='A';
  if(S.phase==='shake'&&now>=S.waitT)want=S.seq[S.k];
  for(const k in KEYPOS){const [x,y]=KEYPOS[k],on=k===want,hit=S.kickKey===k&&now-S.kickT<120;
    ctx.save();ctx.translate(x,y);if(hit)ctx.scale(.9,.9);
    ctx.fillStyle=on?'rgba(85,215,238,.16)':'rgba(10,22,30,.7)';ctx.strokeStyle=on?'#55d7ee':'rgba(120,150,165,.35)';ctx.lineWidth=on?2.5:1.5;
    if(on){ctx.shadowColor='rgba(85,215,238,.7)';ctx.shadowBlur=14}
    ctx.beginPath();ctx.roundRect(-21,-21,42,42,5);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle=on?'#e9fbff':'rgba(140,165,175,.55)';ctx.font='700 20px "Galmuri11",monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(k,0,1);
    ctx.restore()}
  ctx.textBaseline='alphabetic';
  if(S.phase==='shake'&&S.seq.length>2&&now>=S.waitT){ctx.textAlign='center';ctx.font='700 16px "Galmuri11",monospace';
    for(let i=0;i<S.seq.length;i++){ctx.fillStyle=i<S.k?'#55d7ee':i===S.k?'#e9fbff':'rgba(140,165,175,.45)';ctx.fillText(S.seq[i],W/2-(S.seq.length-1)*22+i*44,560)}
    ctx.fillStyle='rgba(140,165,175,.6)';ctx.font='700 11px "Galmuri11",monospace';ctx.fillText('두 번 왕복',W/2,585)}
  // 닫기 각도 바 (상단)
  if(S.phase==='close'&&!S.closeQ){
    const C=B.CLOSE,lo=C.center-C.amp-2,hi=C.center+C.amp+2,x0=W/2-150,w=300,y=150,X=a=>x0+(a-lo)/(hi-lo)*w;
    ctx.fillStyle='#0d1d26';ctx.fillRect(x0,y,w,8);
    ctx.fillStyle='rgba(85,215,238,.35)';ctx.fillRect(X(C.good[0]),y,X(C.good[1])-X(C.good[0]),8);
    ctx.fillStyle='#f0c987';ctx.fillRect(X(C.perfect[0]),y,X(C.perfect[1])-X(C.perfect[0]),8);
    ctx.fillStyle='rgba(255,106,106,.35)';ctx.fillRect(x0,y,X(C.wild[0])-x0,8);ctx.fillRect(X(C.wild[1]),y,x0+w-X(C.wild[1]),8);
    ctx.fillStyle='#fff';ctx.fillRect(X(S.angDeg)-2,y-5,4,18);
  }
  // 이음새 내구도 (허용 MISS 핍)
  if(S.closeQ&&(S.phase==='shake'||S.phase==='pop')){
    const left=S.dur-S.misses,last=left<=0,blink=Math.floor(now/180)%2;
    ctx.textAlign='left';ctx.font='700 15px "Galmuri11",monospace';ctx.fillStyle=last?(blink?'#ff6a6a':'#ffb0b0'):'#8aa2ad';ctx.fillText('이음새',24,44);
    for(let i=0;i<S.dur+1;i++){const alive=i<left+1;ctx.fillStyle=i===S.dur?(last?(blink?'#ff6a6a':'#5a1e24'):'#ff6a6a33'):alive?'#7be3a4':'#2a1a1e';
      ctx.fillRect(96+i*26,28,20,20);if(i===S.dur){ctx.strokeStyle='#ff6a6a';ctx.lineWidth=1.5;ctx.strokeRect(96+i*26,28,20,20)}}
    ctx.font='700 11px "Galmuri11",monospace';ctx.fillStyle=last?'#ff6a6a':'#5d7480';
    ctx.fillText(last?'한 번 더 틀리면 틴이 빠진다':`MISS ${left}번 더 버틴다`,24,68);
    if(last&&S.phase==='shake'&&Math.random()<.5){const [sx,sy]=toWorld(40,rand(-60,60));S.fx.push({k:'p',x:sx,y:sy,vx:rand(-30,30),vy:20,life:.7,max:.7,c:avgCol(),r:3,g:900})}
  }
}
function drawShaker(now){
  const f=shakerView(now);
  const closing=S.phase==='close'||S.phase==='tut';
  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a);ctx.scale(B.K*f.zoom,B.K*f.zoom);
  // 큰 틴 + 작은 틴 (닫기 전엔 작은 틴이 기울기를 바꾸며 떠 있음)
  tinBody(-250,40,46,64,true);
  ctx.save();
  if(S.unseal){const pose=unsealPresentation(now);ctx.translate(pose.offset,0);ctx.globalAlpha*=pose.alpha;}
  else if(closing){const offset=closingTinOffset(now);ctx.translate(offset.x,offset.y);ctx.rotate(offset.angle)}
  else if(S.phase==='pop'){ctx.translate(18+S.tinX/B.K,S.tinY/B.K);ctx.rotate(S.tinA)}
  else ctx.translate(18,0);
  tinBody(-30,230,58,44,false);ctx.restore();
  if(closing||S.phase==='pop'||S.unseal||S.done){ctx.restore();return;}
  if(S.closeQ&&S.phase==='shake'){const r=Math.min(1,S.misses/Math.max(1,S.dur)),gap=r*4+(S.misses>=S.dur?Math.sin(now/30)*2:0);
    ctx.strokeStyle=`rgb(${235},${Math.round(245-180*r)},${Math.round(248-190*r)})`;ctx.lineWidth=2.5+r*2;ctx.beginPath();ctx.moveTo(40+gap,-64);ctx.lineTo(40+gap,64);ctx.stroke()}
  // 단면 창: 도트 액체 + 얼음
  const C=B.CH;
  ctx.save();rr(C.x0-6,C.y0-6,C.x1-C.x0+12,C.y1-C.y0+12,18);ctx.fillStyle='rgba(8,12,20,.9)';ctx.fill();ctx.clip();
  ctx.fillStyle='rgba(40,46,60,.55)';ctx.fillRect(C.x0,C.y0,C.x1-C.x0,C.y1-C.y0);
  if(S.h)drawWater(now);else if(S.phase==='close'){ // 닫기 전: 정지된 층
    const P=B.PX,hh=DEPTH*B.FILL;let acc=0;const L=R.layers,tot=L.reduce((a,l)=>a+l[2],0);
    for(const l of L){const y0=snapP(C.y1-hh*(acc+l[2]/tot)),y1=snapP(C.y1-hh*acc);ctx.fillStyle=l[1]+'80';ctx.fillRect(C.x0,y0,C.x1-C.x0,y1-y0);acc+=l[2]/tot}
    ctx.fillStyle='rgba(235,240,244,.8)';for(let x=C.x0;x<C.x1;x+=P)ctx.fillRect(x,snapP(C.y1-hh),P,P)}
  for(const o of S.ices)drawIcePx(o);
  if(S.chill>10){ctx.fillStyle=`rgba(235,250,255,${S.chill/100*.5})`;for(let i=0;i<S.chill*1.2;i++){const x=C.x0+((i*37)%(C.x1-C.x0));ctx.fillRect(snapP(x),i%2?C.y0:C.y1-B.PX,B.PX,B.PX)}}
  ctx.fillStyle='rgba(190,215,225,.14)';ctx.fillRect(C.x0+10,C.y0+4,C.x1-C.x0-20,B.PX);
  ctx.restore();
  ctx.restore();
}
function updateUI(){
  const el=S.phase!=='tut'?((S.endT||GT)-S.startT)/1000:0;
  $('timer').textContent=String(Math.floor(el/60)).padStart(2,'0')+':'+String(Math.floor(el%60)).padStart(2,'0');
}
function loop(){
  const real=clock(),dReal=Math.min(50,real-(lastReal||real));lastReal=real;
  const frozen=performance.now()<S.hitstopUntil||pauseAt!=null;
  const dt=frozen?0:dReal;GT+=dt;labTick(dt);
  update(GT,dt);draw(GT);updateUI();drawTutDemo(performance.now());if(window.drawLuna)drawLuna(GT);
  requestAnimationFrame(loop);
}


