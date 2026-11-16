
let PAUSED=0,pauseAt=null;
function clock(){return (pauseAt??performance.now())-PAUSED}
function setPause(on){if(on&&pauseAt==null)pauseAt=performance.now();else if(!on&&pauseAt!=null){PAUSED+=performance.now()-pauseAt;pauseAt=null}}
let GT=0,lastReal=0;
// ═════════ LAST CALL 쉐이크 v9 — 스터 기믹과 같은 문법 ═════════
// 키박스(A·D) · 강조된 다음 키 · 도구를 감싼 시간 게이지 · 분할 진행 바 · TUTORIAL 모달
// STEP 1 틴 닫기: 작은 틴 기울기가 금색 구간일 때 Space로 결합 (닫기 품질 = 버틸 수 있는 MISS 수)
// STEP 2 쉐이크: 강조된 키를 순서대로(A→D) 시간 안에 눌러 1회. 10회 = 완성. 쉐이커 안엔 도트 액체 + 얼음
const OPT={music:0,sfx:70,street:50,voice:'low',bgm:true,sfxOn:true,ring:true,shake:true,diff:'normal'};
const DIFF={easy:1.25,normal:1,hard:.8};   // 한 회 제한 시간 배율
const RECIPES=[
  {id:'daiquiri',name:'다이키리',lv:'EASY',spec:'화이트 럼 45 · 라임 20 · 시럽 15',
   layers:[['시럽','#e9b04e',.2],['라임','#86c83e',.28],['럼','#e6e9de',.52]],ice:4,rounds:10,pattern:['AD']},
  {id:'fizz',name:'진 피즈',lv:'NORMAL',spec:'진 45 · 레몬 20 · 시럽 15 · 달걀흰자',
   layers:[['시럽','#e9b04e',.18],['레몬','#efd650',.24],['흰자','#f7f2e0',.18],['진','#cfe3ea',.4]],ice:5,rounds:10,pattern:['AD']},
  {id:'sour',name:'위스키 사워',lv:'HARD',spec:'버번 50 · 레몬 25 · 시럽 15 · 흰자',
   layers:[['시럽','#e9b04e',.16],['레몬','#efd650',.26],['흰자','#f7f2e0',.14],['버번','#a45a1c',.44]],ice:5,rounds:10,pattern:['AD','ADAD']},
];
const B={
  CLOSE:{center:6.5,amp:16,speed:2.4,perfect:[3,8],good:[-1,12],wild:[-5,18]},
  DUR:{P:2,G:1,B:0},
  FIRST_ROUND_MS:3000, LAST_ROUND_MS:1500,
  SPILL:.09,                         // MISS마다 새는 액체 비율                 // 닫기 품질별 허용 MISS
  PEN:{P:0,G:3,B:8},                 // 닫기 품질별 감점
  TRAVEL:62, VTRAVEL:30, spring:{k:1400,c:36}, K:1.3,
  // 액체 · 얼음
  CH:{x0:-227,x1:226,seam:-12,left:35,middle:47,right:32}, FILL:.52, WDAMP:.993, ICE_DRAG:3, PX:3, G:900, INERTIA:.9, AMAX:12000,
  ICE_COVERAGE:.25, chillMinV:300,
};
const NC=Math.round((B.CH.x1-B.CH.x0)/B.PX);       // 액체 칸 수
// Half-heights measured inside the two end rims and at the join of the tins.
const chamber=B.CH;
function halfHeight(x){
  const {x0,x1,seam,left,middle,right}=chamber;
  return x<seam ? left+(middle-left)*(x-x0)/(seam-x0)
    : middle+(right-middle)*(x-seam)/(x1-seam);
}
const chamberOutline=`M${chamber.x0} ${-chamber.left} L${chamber.seam} ${-chamber.middle} L${chamber.x1} ${-chamber.right} V${chamber.right} L${chamber.seam} ${chamber.middle} L${chamber.x0} ${chamber.left} Z`;
const chamberPath=new Path2D(chamberOutline);
document.getElementById('guide-chamber').setAttribute('d',chamberOutline);
const floorY=Float32Array.from({length:NC},(_,i)=>halfHeight(chamber.x0+(i+.5)*B.PX));
// Ease the stroke into both solid ends. The surface rises as the current slows.
const strokeProfile=Float32Array.from({length:NC+1},(_,i)=>Math.sin(Math.PI*i/NC));
const meanDepth=2*floorY.reduce((sum,y)=>sum+y,0)/NC;
function iceLimit(x,extent){
  return Math.min(halfHeight(x-extent),halfHeight(x+extent))-extent;
}
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
  const damping=Math.pow(B.WDAMP,dt*360);
  for(let i=1;i<n;i++){
    const eta=(h[i]-floorY[i])-(h[i-1]-floorY[i-1]);
    u[i]+=(-gy*eta/dx+gx*strokeProfile[i])*dt;
    u[i]*=damping;
    const lim=900;if(u[i]>lim)u[i]=lim;else if(u[i]<-lim)u[i]=-lim;
  }
  u[0]=0;u[n]=0;
  for(let i=1;i<n;i++)TMPU[i]=u[i]+.12*(u[i-1]+u[i+1]-2*u[i]);for(let i=1;i<n;i++)u[i]=TMPU[i];u[0]=0;u[n]=0;
  // Exchange water across each face without forcing a full column through the lid.
  let turb=0;
  for(let i=1;i<n;i++){
    const from=u[i]>0?i-1:i,to=u[i]>0?i:i-1;
    const free=Math.max(0,2*floorY[to]-h[to]);
    const flow=Math.min(h[from]*.45,Math.abs(u[i])*h[from]*dt/dx,free);
    h[from]-=flow;h[to]+=flow;turb+=Math.abs(u[i]);
  }
  // 수치 확산 (뾰족한 기둥 방지)
  for(let i=0;i<n;i++)TMPH[i]=h[i]+.08*((h[i-1]??h[i])+(h[i+1]??h[i])-2*h[i]);for(let i=0;i<n;i++)h[i]=TMPH[i];
  // 부피 보정
  let sum=0;for(let i=0;i<n;i++)sum+=h[i];const k=(S.vol-(S.lost||0))/Math.max(1,sum);for(let i=0;i<n;i++)h[i]*=k;
  return turb/n;
}
function stepIces(dt,gx,gy){
  const C=B.CH,n=NC;
  for(const o of S.ices){
    const r=o.size;
    const ci=Math.max(0,Math.min(n-1,((o.x-C.x0)/B.PX)|0)),surf=floorY[ci]-S.h[ci],fu=S.u[ci]||0;
    // 수평: 물 흐름에 끌림 + 축 방향 중력
    const impulse=GT-S.kickT<300;
    o.vx+=((fu-o.vx)*(impulse?.7:B.ICE_DRAG)+gx*(impulse?.25:.8))*dt;
    // 수직: 중력 + 부력 (잠긴 만큼 위로)
    const sub=Math.max(0,Math.min(2*r,(o.y+r)-surf));
    o.vy+=gy*(1-sub/(2*r)/.92)*dt;o.vy*=Math.exp(-(sub>0?3.5:.3)*dt);
    o.vx=Math.max(-2200,Math.min(2200,o.vx));o.vy=Math.max(-650,Math.min(650,o.vy));
    o.vr+=(fu-o.vx)*.008*dt;o.vr=Math.max(-5,Math.min(5,o.vr));
    o.x+=o.vx*dt;o.y+=o.vy*dt;o.rot+=o.vr*dt;o.vr*=Math.exp(-1.8*dt);
    const hit=v=>{if(Math.abs(v)>B.chillMinV*.6){iceImpact(o,Math.abs(v));o.vr+=(Math.random()-.5)*Math.abs(v)*.012}};
    const extent=r*(Math.abs(Math.cos(o.rot))+Math.abs(Math.sin(o.rot)));
    if(o.x<C.x0+extent){hit(o.vx);o.wall='left';o.wallSpeed=Math.max(o.wallSpeed||0,Math.abs(o.vx));o.x=C.x0+extent;o.vx=Math.abs(o.vx)*.18}else if(o.x>C.x1-extent){hit(o.vx);o.wall='right';o.wallSpeed=Math.max(o.wallSpeed||0,Math.abs(o.vx));o.x=C.x1-extent;o.vx=-Math.abs(o.vx)*.18}
    const limit=iceLimit(o.x,extent);
    if(o.y < -limit){hit(o.vy);o.y=-limit;o.vy=Math.abs(o.vy)*.2}else if(o.y>limit){hit(o.vy);o.y=limit;o.vy=-Math.abs(o.vy)*.2}
  }
  const ice=S.ices;
  for(let pass=0;pass<3;pass++){
  for(let i=0;i<ice.length;i++)for(let j=i+1;j<ice.length;j++){const a=ice[i],b=ice[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,spacing=(a.size+b.size)*Math.SQRT2;
    if(d<spacing){const nx=dx/d,ny=dy/d,pen=spacing-d;a.x-=nx*pen/2;a.y-=ny*pen/2;b.x+=nx*pen/2;b.y+=ny*pen/2;
      const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn<0){a.vx+=vn*nx*.65;a.vy+=vn*ny*.65;b.vx-=vn*nx*.65;b.vy-=vn*ny*.65;
        if(-vn>B.chillMinV){iceImpact(a,-vn);a.vr+=(Math.random()-.5)*2;b.vr+=(Math.random()-.5)*2}}}}
  for(const o of ice){const e=o.size*(Math.abs(Math.cos(o.rot))+Math.abs(Math.sin(o.rot)));o.x=Math.max(C.x0+e,Math.min(C.x1-e,o.x));const limit=iceLimit(o.x,e);o.y=Math.max(-limit,Math.min(limit,o.y));}
  }
}
function makeShakingIce(){
  const C=B.CH,n=10,weights=Array.from({length:n},()=>rand(.68,1.25)).sort((a,b)=>b-a);
  const scale=Math.sqrt((C.x1-C.x0)*meanDepth*B.ICE_COVERAGE/weights.reduce((sum,w)=>sum+4*w*w,0));
  const cubes=[];
  for(const w of weights){
    const size=w*scale,rot=rand(-.5,.5),extent=size*(Math.abs(Math.cos(rot))+Math.abs(Math.sin(rot)));
    let best=null,score=Infinity;
    for(let attempt=0;attempt<240;attempt++){
      const x=rand(C.x0+extent,22-extent),limit=iceLimit(x,extent),y=rand(-limit,limit);
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
  for(const [i,dir] of [[6,-1],[n-6,1]]){const v=u[i]*dir;if(v>260&&Math.random()<dt*v/40){const ci=dir<0?0:n-1;
    for(let k=0;k<2;k++)S.drops2.push({x:dir<0?C.x0+3:C.x1-3,y:floorY[ci]-h[ci],vx:-dir*rand(40,160),vy:-rand(120,320)*(v/500),life:.9});
    if(Math.random()<.3)slosh(Math.min(.8,v/900))}}
  for(let i=2;i<n-2;i+=3){const s=Math.abs(h[i+1]-h[i-1]);if(s>7&&Math.random()<dt*s*1.5)S.drops2.push({x:C.x0+i*B.PX,y:floorY[i]-h[i],vx:u[i]*.6+rand(-40,40),vy:-rand(60,200),life:.7})}
  for(const d of S.drops2){d.vx+=gx*dt;d.vy+=gy*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.life-=dt;
    if(d.x<C.x0+2||d.x>C.x1-2)d.vx*=-.4;const ceiling=2-halfHeight(Math.max(C.x0,Math.min(C.x1,d.x)));if(d.y<ceiling){d.y=ceiling;d.vy=Math.abs(d.vy)*.3}
    const ci=Math.max(0,Math.min(n-1,((d.x-C.x0)/B.PX)|0));if(d.vy>0&&d.y>=floorY[ci]-h[ci])d.life=0}
  S.drops2=S.drops2.filter(d=>d.life>0);if(S.drops2.length>220)S.drops2.splice(0,S.drops2.length-220);
}
function popText(txt,x,y,c,s,rot){S.texts.push({txt,x,y,c,s:s||1,rot:rot??(Math.random()-.5)*.25,t:GT})}
function mixColor(a,b,t){const pa=hex(a),pb=hex(b);return `rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*t)).join(',')})`}
function hex(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16))}
const snapP=v=>Math.round(v/B.PX)*B.PX;
// Draw adjacent layers from the same unrounded edge samples. Only foam and spray snap to pixels.
const edgeFloor=Float32Array.from({length:NC+1},(_,i)=>halfHeight(chamber.x0+i*B.PX));
const edgeDepth=new Float32Array(NC+1);
function traceWaterEdge(fraction,reverse){
  for(let step=0;step<=NC;step++){
    const i=reverse?NC-step:step;
    const x=chamber.x0+i*B.PX,y=edgeFloor[i]-edgeDepth[i]*fraction;
    if(step===0&&!reverse)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
}
function drawWater(now){
  const C=B.CH,P=B.PX,n=NC,h=S.h,m=S.liquidBlend,[ar,ag,ab]=avgHex(),cold=S.chill/100;
  for(let i=0;i<=n;i++){
    // Average around the boundary between cells, extending the end cells up to the wall.
    const left=Math.max(0,i-1),right=Math.min(n-1,i);
    const depth=(h[Math.max(0,left-1)]+3*h[left]+3*h[right]+h[Math.min(n-1,right+1)])/8;
    edgeDepth[i]=Math.min(depth,2*edgeFloor[i]);
  }

  const total=R.layers.reduce((sum,layer)=>sum+layer[2],0);
  let base=0;
  for(const [,color,amount] of R.layers){
    const top=base+amount/total;
    const [r,g,b]=hex(color);
    ctx.fillStyle=`rgba(${(r+(ar-r)*m)|0},${(g+(ag-g)*m)|0},${Math.min(255,b+(ab-b)*m+cold*12)|0},.5)`;
    ctx.beginPath();traceWaterEdge(top,false);traceWaterEdge(base,true);ctx.closePath();ctx.fill();
    base=top;
  }

  const [topRed,topGreen,topBlue]=hex(R.layers[R.layers.length-1][1]);
  const sr=topRed+(ar-topRed)*m,sg=topGreen+(ag-topGreen)*m,sb=topBlue+(ab-topBlue)*m;
  ctx.strokeStyle=`rgba(${(sr+(255-sr)*.55)|0},${(sg+(255-sg)*.55)|0},${Math.min(255,sb+(255-sb)*.55+cold*10)|0},.85)`;
  ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.beginPath();
  let wet=false;
  for(let i=0;i<=n;i++){
    if(edgeDepth[i]<1){wet=false;continue;}
    const x=C.x0+i*P,y=edgeFloor[i]-edgeDepth[i];
    if(wet)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    wet=true;
  }
  ctx.stroke();
  // 거품 (흔들림이 셀수록 수면 아래 반짝이는 도트)
  const fz=Math.min(14,S.turb/25|0);
  ctx.fillStyle='rgba(235,240,244,.55)';
  for(let k=0;k<fz;k++){const i=((k*37+((now/60)|0)*13)%n),hh=h[i];if(hh<P*3)continue;ctx.fillRect(C.x0+i*P,snapP(floorY[i]-hh)+P*(1+(k%3)),P,P)}
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
function $(id){return document.getElementById(id)}

// ───────── 캔버스 / 좌표
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const W=880,H=640;
function fit(){const d=Math.min(window.devicePixelRatio||1,2);cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0)}
fit();addEventListener('resize',fit);
const SC={x:440,y:322};
const largeTinBase=-250,smallTinBase=230,seatedTinOffset=18;
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
     h:null,u:null,turb:0,drops2:[],ices:[],mix:0,liquidBlend:0,chill:0,
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
  {t:'시간 안에 한 번 흔들기',chip:'A → D',body:['① 쉐이커를 감싼 게이지가 한 번의 남은 시간을 나타냅니다.','② 강조된 다음 키를 순서대로 눌러 제한 시간 안에 한 번을 완성하세요.','회차가 갈수록 입력 시간이 짧아집니다.','MISS가 나면 결합 내구도가 줄어듭니다. 마지막 칸이 소진되면 틴이 빠집니다.'],demo:'shake'},
];
function showTut(p){
  S.tutPage=p;$('tut').hidden=false;setPause(true);
  const T=TUT[p];
  const guide=$('shake-guide');
  guide.dataset.demo=T.demo;
  $('guide-liquid').setAttribute('fill',avgCol());
  guide.setCurrentTime(0);
  guide.unpauseAnimations();
  $('tutPage').textContent=String(p+1);$('tutHead').textContent=T.t;
  const chip=R.id==='sour'&&p===1?'A → D · A → D → A → D':T.chip;$('tutChip').textContent=chip;
  $('tutBody').innerHTML=T.body.map(x=>`<p>${x}</p>`).join('');
  $('tutPrev').hidden=p===0;$('tutNext').textContent=p<TUT.length-1?'다음 · E':'확인 · E';
}
function tutNext(){if(S.tutPage<TUT.length-1)showTut(S.tutPage+1);else{$('shake-guide').pauseAnimations();$('tut').hidden=true;setPause(false);S.phase='close';S.closeT=GT;S.startT=GT}}
$('tutNext').onclick=()=>{audio();tutNext()};$('tutPrev').onclick=()=>showTut(Math.max(0,S.tutPage-1));
// ───────── 입력
addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Escape'){e.preventDefault();toggleSettings();return}
  if(!$('settings').hidden)return;
  if(!$('tut').hidden){if(e.code==='Enter'&&e.target.closest?.('#tut button'))return;if(e.code==='KeyE'||e.code==='Enter'){e.preventDefault();audio();tutNext()}return}
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
  if(k!==want){miss(now);return}
  strokeImpact(k,now);
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
  if(S.u)for(let i=1;i<NC;i++)S.u[i]=S.u[i]*.2+direction*620*strokeProfile[i];
}

// ═════ STEP 1 틴 닫기 (Space 한 번) ═════
function slap(now){
  if(now-S.bounceT<400||S.closeQ)return;
  const a=S.angDeg,C=B.CLOSE;
  const q=a>=C.perfect[0]&&a<=C.perfect[1]?'P':a>=C.good[0]&&a<=C.good[1]?'G':a>=C.wild[0]&&a<=C.wild[1]?'B':null;
  if(!q){S.bounceT=now;S.cam=8;clank(.9);return}
  S.closeQ=q;S.dur=B.DUR[q];S.slapT=now;S.cam=q==='P'?14:9;if(q==='P')S.hitstopUntil=performance.now()+80;
  const [sx,sy]=toWorld(40,0);S.fx.push({k:'ring',x:sx,y:sy,t:now,big:q==='P'});
  smack(q==='B'?'W':q);
  labDelay(()=>{if(S.phase==='close')startShake()},1000);
}
// ═════ STEP 2 쉐이크 ═════
function startShake(){
  S.phase='shake';
  // A level surface at rest, with deeper liquid beneath the wider join.
  S.h=floorY.map(y=>y+meanDepth*(B.FILL-.5));
  S.u=new Float32Array(NC+1);S.vol=S.h.reduce((sum,h)=>sum+h,0);
  S.ices=makeShakingIce();
  nextRound();
}
function win(){
  const progress=Math.min(1,S.round/Math.max(1,R.rounds-1));
  const roundMs=B.FIRST_ROUND_MS+(B.LAST_ROUND_MS-B.FIRST_ROUND_MS)*progress;
  return roundMs*DIFF[OPT.diff];
}
function nextRound(){
  if(S.round>=R.rounds){const pose=shakerXf();S.phase='unseal';S.endT=GT;S.unseal={t:GT,x:S.px,y:S.py,a:pose.a};S.drops2=[];S.cam=0;S.flash=0;S.label=null;popText('쉐이크 완료!',W/2,90,'#f0c987',1.3);return}
  S.seq=R.pattern[S.round%R.pattern.length];
  // Every round keeps A → D; only the time window and repeat count vary.
  S.k=0;S.roundT=GT;
}
function popShakeText(now){
  // Pick once in shaker space, then let the word rise independently in screen space.
  let x,y;
  for(let attempt=0;attempt<8;attempt++){
    const offset=rand(-185,185),rim=halfHeight(offset);
    const height=Math.random()<.5 ? -rim-rand(22,34) : rim+rand(40,52);
    [x,y]=toWorld(offset,height);
    if(!S.texts.some(t=>t.shakeWord&&Math.abs(x-t.x)<100&&Math.abs(y-t.y)<55))break;
  }
  S.texts.push({txt:'SHAKE!',shakeWord:true,x,y,c:'#f0c987',s:.9,rot:0,t:now});
}
function strokeImpact(key,now){
  const t=(now-S.roundT)/win(),fast=t<.55;
  S.flash=1;S.cam=Math.max(S.cam,fast?9:6);if(fast)S.hitstopUntil=performance.now()+45;
  const left=key==='A',base=left?largeTinBase:seatedTinOffset+smallTinBase;
  S.fx.push({k:'ring',onTin:true,x:base,y:0,t:now,big:fast});
  popShakeText(now);
  S.label={t:now,g:'ok',fast};
  iceClack(fast?1:.7);
}
function success(now){
  S.res.push('O');S.round++;S.combo++;S.best=Math.max(S.best,S.combo);
  S.mix=Math.min(100,S.mix+100/R.rounds);S.chill=Math.min(100,S.chill+100/R.rounds);
  paintBar();nextRound();
}
function miss(now){
  S.res.push('M');S.round++;S.misses++;S.combo=0;
  if(S.h){S.lost=(S.lost||0)+S.vol*B.SPILL;slosh(.8)}
  S.label={t:now,g:'miss'};S.cam=6;S.waitT=now+350;
  popText('MISS',W/2,96,'#ff6a6a',1);buzz();
  paintBar();
  if(S.misses>S.dur){popOff(now);return}
  S.pending=true;labDelay(()=>{S.pending=false;if(S.phase==='shake')nextRound()},350);
}
function popOff(now){
  S.phase='pop';S.endT=now;S.pop={t:now,vx:560,vy:-340,spin:9};S.cam=20;
  S.texts=S.texts.filter(t=>!t.shakeWord);
  popText('틴이 빠졌다!',W/2,48,'#ff6a6a',1.6);
  // Opaque shells stay intact; spilled contents are simulated outside the opening.
  // Cubes nearest the lip emerge first, retaining their size and orientation.
  const cubes=S.ices.slice().sort((a,b)=>Math.abs(a.x-40)-Math.abs(b.x-40));
  cubes.forEach((cube,index)=>labDelay(()=>spillIce(cube,index/cubes.length),50+index*46));
  S.h=null;S.u=null;S.ices=[];S.drops2=[];S.fx=[];
  S.pop.spillColor=avgCol();S.pop.spillCarry=0;
  for(let i=0;i<64;i++)emitFailureLiquid(true);
  clank(1);smack('P');slosh(1);
  labDelay(()=>finish('pop'),1500);
}
function spillIce(cube,progress){
  const size=cube.size*B.K;
  const [x,y]=toWorld(40-cube.size,Math.max(0,Math.min(48-cube.size,cube.y+20)));
  S.fx.push({k:'ice',x,y,size,rot:cube.rot+shakerXf().a,vr:cube.vr*.35+rand(-1.6,1.6),
    vx:230-110*progress+rand(-25,25),vy:rand(-55,40)+90*progress,
    hitT:-Infinity,life:1.35,g:760});
}
function emitFailureLiquid(burst=false){
  const [x,y]=toWorld(40,burst?rand(-12,38):rand(26,47));
  const life=rand(.75,1.25);
  S.fx.push({k:'liquid',x,y,vx:burst?rand(140,370):rand(65,155),vy:burst?rand(-130,85):rand(30,125),life,c:S.pop.spillColor,r:burst?rand(2,5):rand(3,6),g:720});
}
function iceImpact(o,v){
  const now=GT;if(now-o.hitT<110)return;o.hitT=now;
  const k=Math.min(1.4,(v-B.chillMinV)/700);if(k<=0){if(v>100)iceClack(.15);return}
  iceClack(Math.min(.8,.25+k*.4));
}
function finish(reason){
  if(S.done)return;S.done=true;S.phase='done';
  const ok=S.res.filter(x=>x==='O').length,N=R.rounds;
  let score=Math.round(ok/N*100)-(B.PEN[S.closeQ]||0);if(reason==='pop')score=0;score=Math.max(0,Math.min(100,score));
  const grade=score>=85?'완벽':score>=60?'보통':'망함';
  $('rsTitle').textContent=reason==='pop'?'틴이 빠졌다':'쉐이크 완료';$('rsScore').textContent=score;$('rsScore').dataset.g=grade;
  $('rsSub').textContent=`성공 ${ok} / ${N}`;
  $('rsLine').textContent=reason==='pop'?'결합 내구도가 다했다. 틴을 더 단단히 닫아야 한다.':ok===N?'서두르지 않고 표시된 순서를 끝까지 지켰다.':'서두르지 말고 표시된 타이밍과 순서를 따라가 보세요.';
  $('rsChips').innerHTML=[`조작 시간 ${((S.endT-S.startT)/1000).toFixed(1)}s`,`최대 연속 ${S.best}`].map(x=>`<span>${x}</span>`).join('');
  $('rsRows').innerHTML='';$('rsNote').textContent=`${R.name} · ${R.lv} · 허용 MISS ${S.dur}`;
  $('res').hidden=false;
}

// ───────── 업데이트
function update(now,dt){
  const sec=dt/1000;
  if(S.phase==='close'&&!S.closeQ){const C=B.CLOSE,t=(now-S.closeT)/1000;S.angDeg=C.center-C.amp*Math.cos(t*C.speed)}
  if(S.phase==='shake'&&!S.pending&&now>=S.waitT&&now-S.roundT>win())miss(now);
  // 쉐이커 스프링
  if(sec>0&&(S.phase==='shake'||S.phase==='close')){
    if(S.phase!=='shake'){S.tx=0;S.ty=0}
    const vx0=S.vx,vy0=S.vy;
    S.vx+=(B.spring.k*(S.tx-S.px)-B.spring.c*S.vx)*sec;S.vy+=(B.spring.k*(S.ty-S.py)-B.spring.c*S.vy)*sec;
    S.px+=S.vx*sec;S.py+=S.vy*sec;
    S.ax=S.ax*.4+((S.vx-vx0)/sec)*.6;S.ay=S.ay*.4+((S.vy-vy0)/sec)*.6;
  }
  if(S.h&&sec>0&&S.phase==='shake'){
    // At five successful rounds, the layers retain a quarter of their original contrast.
    const targetBlend=1-(1-S.mix/100)**2;
    S.liquidBlend+=(targetBlend-S.liquidBlend)*(1-Math.exp(-sec/.09));
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
  S.fx=S.fx.filter(p=>{if(p.k==='ring')return now-p.t<420;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=p.g*sec;if(p.k==='ice')p.rot+=p.vr*sec;p.life-=sec;return p.life>0});
  S.texts=S.texts.filter(t=>now-t.t<800);
}

// ───────── 그리기
function drawSpill(){
  ctx.save();
  for(const p of S.fx){
    ctx.globalAlpha=Math.min(1,Math.max(0,p.life/.25));
    if(p.k==='ice'){
      drawIcePx(p);
    }else if(p.k==='liquid'){
      ctx.globalAlpha*=.85;ctx.strokeStyle=p.c;ctx.lineWidth=p.r*2;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x,p.y);ctx.stroke();
      ctx.fillStyle='rgba(235,250,255,.45)';ctx.fillRect(p.x-1,p.y-2,2,2);
    }
  }
  ctx.restore();
}
function draw(now){
  ctx.clearRect(0,0,W,H);
  const cam=OPT.shake?S.cam:0;
  const shakeX=(Math.random()-.5)*cam,shakeY=(Math.random()-.5)*cam;
  ctx.save();ctx.translate(shakeX,shakeY);
  if(S.phase==='shake'||S.phase==='pop')drawGauge(now);
  if(S.phase==='pop')drawSpill();
  drawShaker(now);
  drawKeys(now);
  for(const f of S.fx){
    if(f.k!=='ring')continue;
    const k=(now-f.t)/420,[x,y]=f.onTin?toWorld(f.x,f.y):[f.x,f.y];
    const radius=f.onTin?10+k*(f.big?38:28):16+k*(f.big?100:60);
    ctx.strokeStyle=`rgba(255,244,214,${(1-k)*(f.big?1:.6)})`;ctx.lineWidth=(f.big?6:3)*(1-k)+1;
    ctx.beginPath();ctx.arc(x,y,radius,0,7);ctx.stroke();
  }
  ctx.restore();
  for(const t of S.texts){
    const k=(now-t.t)/800,pop=k<.14?k/.14*1.2:1.2-(k-.14)*.25;
    ctx.save();ctx.translate(t.x,t.y-k*20);
    ctx.rotate(t.rot);ctx.scale(t.s*pop,t.s*pop);
    const fadeStart=t.shakeWord?.25:.7;
    ctx.globalAlpha=Math.min(1,Math.max(0,(1-k)/(1-fadeStart)));ctx.font='700 26px "Galmuri11",sans-serif';ctx.textAlign='center';ctx.lineWidth=6;ctx.strokeStyle='rgba(5,12,17,.85)';ctx.strokeText(t.txt,0,0);ctx.fillStyle=t.c;ctx.fillText(t.txt,0,0);ctx.restore()}
}
// 스터의 원형 링 = 쉐이커를 감싼 캡슐 게이지 (남은 시간, 12시 방향부터 시계방향으로 줄어듦)
const CAP={x:118,y:212,w:644,h:220,r:110};
function capPath(c){c.beginPath();c.roundRect(CAP.x,CAP.y,CAP.w,CAP.h,CAP.r)}
const CAP_LEN=2*(CAP.w-2*CAP.r)+2*Math.PI*CAP.r;
// Elapsed fraction of the current round (not the cumulative crafting clock).
function gaugeColor(elapsed){
  return elapsed<.25?'rgba(240,250,255,.95)':elapsed<.5?'#b7ee55':elapsed<.75?'#ff993d':'#ff4b4b';
}
function drawGauge(now){
  ctx.save();
  capPath(ctx);ctx.strokeStyle='rgba(120,150,165,.18)';ctx.lineWidth=5;ctx.stroke();
  let rem=0,col=gaugeColor(0);
  if(S.phase==='shake'&&now>=S.waitT){const elapsed=Math.max(0,Math.min(1,(now-S.roundT)/win()));rem=1-elapsed;col=gaugeColor(elapsed)}
  if(S.phase==='close'&&!S.closeQ)rem=0;
  if(rem>0){
    // 12시(상단 중앙)부터 시작하도록 대시 오프셋
    ctx.setLineDash([CAP_LEN*rem,CAP_LEN]);ctx.lineDashOffset=-(CAP.w/2-CAP.r);
    ctx.beginPath();ctx.moveTo(CAP.x+CAP.w/2,CAP.y);ctx.lineTo(CAP.x+CAP.w-CAP.r,CAP.y);ctx.arc(CAP.x+CAP.w-CAP.r,CAP.y+CAP.r,CAP.r,-Math.PI/2,Math.PI/2);
    ctx.lineTo(CAP.x+CAP.r,CAP.y+CAP.h);ctx.arc(CAP.x+CAP.r,CAP.y+CAP.r,CAP.r,Math.PI/2,Math.PI*1.5);ctx.lineTo(CAP.x+CAP.w/2,CAP.y);
    ctx.setLineDash([CAP_LEN*rem,CAP_LEN]);ctx.lineDashOffset=0;
    ctx.shadowColor=col;ctx.shadowBlur=12;ctx.strokeStyle=col;ctx.lineWidth=5;ctx.stroke();
  }
  if(S.flash>.02){capPath(ctx);ctx.setLineDash([]);ctx.shadowBlur=0;ctx.globalAlpha=S.flash;ctx.strokeStyle=col;ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1}
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
  // 결합 내구도
  if(S.closeQ&&(S.phase==='shake'||S.phase==='pop')){
    const left=S.dur-S.misses,last=left<=0,blink=Math.floor(now/180)%2;
    // Center the label and durability pips together above the gauge.
    const center=CAP.x+CAP.w/2,rowY=CAP.y-72;
    ctx.textAlign='left';ctx.font='700 18px "Galmuri11",monospace';
    const labelWidth=ctx.measureText('결합 내구도').width,pipWidth=(S.dur+1)*26-6,rowX=center-(labelWidth+14+pipWidth)/2,pipX=rowX+labelWidth+14;
    ctx.fillStyle=last?(blink?'#ff6a6a':'#ffb0b0'):'#8aa2ad';ctx.fillText('결합 내구도',rowX,rowY+16);
    for(let i=0;i<S.dur+1;i++){const alive=i<left+1;ctx.fillStyle=i===S.dur?(last?(blink?'#ff6a6a':'#5a1e24'):'#ff6a6a33'):alive?'#7be3a4':'#2a1a1e';
      ctx.fillRect(pipX+i*26,rowY,20,20);if(i===S.dur){ctx.strokeStyle='#ff6a6a';ctx.lineWidth=1.5;ctx.strokeRect(pipX+i*26,rowY,20,20)}}
    ctx.textAlign='center';
  }
}
function drawShaker(now){
  const f=shakerView(now);
  const closing=S.phase==='close'||S.phase==='tut';
  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a);ctx.scale(B.K*f.zoom,B.K*f.zoom);
  // 큰 틴 + 작은 틴 (닫기 전엔 작은 틴이 기울기를 바꾸며 떠 있음)
  tinBody(largeTinBase,40,46,64,true);
  ctx.save();
  if(S.unseal){const pose=unsealPresentation(now);ctx.translate(pose.offset,0);ctx.globalAlpha*=pose.alpha;}
  else if(closing){const offset=closingTinOffset(now);ctx.translate(offset.x,offset.y);ctx.rotate(offset.angle)}
  else if(S.pop){ctx.translate(18+S.tinX/B.K,S.tinY/B.K);ctx.rotate(S.tinA)}
  else ctx.translate(seatedTinOffset,0);
  tinBody(-30,smallTinBase,58,44,false);ctx.restore();
  if(closing||S.phase==='pop'||S.unseal||S.done){ctx.restore();return;}
  // 단면 창: 도트 액체 + 얼음
  const C=B.CH;
  ctx.save();ctx.fillStyle='rgba(16,23,32,.93)';ctx.fill(chamberPath);ctx.clip(chamberPath);
  drawWater(now);
  for(const o of S.ices)drawIcePx(o);
  if(S.chill>10){ctx.fillStyle=`rgba(235,250,255,${S.chill/100*.5})`;for(let i=0;i<S.chill*1.2;i++){const x=C.x0+((i*37)%(C.x1-C.x0));ctx.fillRect(snapP(x),i%2?-halfHeight(x):halfHeight(x)-B.PX,B.PX,B.PX)}}
  ctx.strokeStyle='rgba(190,215,225,.32)';ctx.lineWidth=2;ctx.stroke(chamberPath);
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
  update(GT,dt);draw(GT);updateUI();if(window.drawLuna)drawLuna(GT);
  requestAnimationFrame(loop);
}


