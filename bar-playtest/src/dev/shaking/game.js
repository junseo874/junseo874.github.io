
let PAUSED=0,pauseAt=null;
function clock(){return (pauseAt??performance.now())-PAUSED}
function setPause(on){
  if(on&&pauseAt==null)pauseAt=performance.now();
  else if(!on&&pauseAt!=null){PAUSED+=performance.now()-pauseAt;pauseAt=null}
  document.body.classList.toggle('shake-paused',pauseAt!=null);
}
let GT=0,lastReal=0;
// ═════════ LAST CALL 쉐이크 v9 — 스터 기믹과 같은 문법 ═════════
// 현재 입력할 키 하나 · 내구도를 감싸는 쉐이커 윤곽 시간 게이지 · 분할 진행 바 · TUTORIAL 모달
// STEP 1 틴 닫기: Space로 결합. 중앙에서 양끝으로 갈수록 시작 내구도는 3 → 2 → 1칸.
// STEP 2 쉐이크: 강조된 키를 순서대로(D→A / E→A) 시간 안에 눌러 1회. 10회 = 완성. 쉐이커 안엔 도트 액체 + 얼음
const OPT={music:0,sfx:70,street:50,voice:'low',bgm:true,sfxOn:true,ring:true,shake:true,diff:'normal'};
const DIFF={easy:1.25,normal:1,hard:.8};   // 한 회 제한 시간 배율
// Practice uses the game's pour amounts and the pink from cosmopolitan_final.png.
const practiceRecipe={
  id:'cosmopolitan',name:'코스모폴리탄',lv:'NORMAL',spec:'보드카 120 · 트리플섹 45 · 크랜베리주스 90',
  layers:[['크랜베리주스','#c23a66',90],['트리플섹','#ffebd8',45],['보드카','#e7eff5',120]],
  mixedColor:'#ff8196',rounds:10,strokesPerRound:[2]
};
const RECIPES=[
  {id:'daiquiri',name:'다이키리',lv:'EASY',spec:'화이트 럼 45 · 라임 20 · 시럽 15',
   layers:[['시럽','#e9b04e',.2],['라임','#86c83e',.28],['럼','#e6e9de',.52]],ice:4,rounds:10,strokesPerRound:[2]},
  {id:'fizz',name:'진 피즈',lv:'NORMAL',spec:'진 45 · 레몬 20 · 시럽 15 · 달걀흰자',
   layers:[['시럽','#e9b04e',.18],['레몬','#efd650',.24],['흰자','#f7f2e0',.18],['진','#cfe3ea',.4]],ice:5,rounds:10,strokesPerRound:[2]},
  {id:'sour',name:'위스키 사워',lv:'HARD',spec:'버번 50 · 레몬 25 · 시럽 15 · 흰자',
   layers:[['시럽','#e9b04e',.16],['레몬','#efd650',.26],['흰자','#f7f2e0',.14],['버번','#a45a1c',.44]],ice:5,rounds:10,strokesPerRound:[2,4]},
  practiceRecipe,
];
const B={
  CLOSE:{center:6.5,amp:16,speed:2.55,inner:3,middle:8},
  DUR:{P:3,G:2,B:1},
  FIRST_ROUND_MS:3000, LAST_ROUND_MS:1500,
  SPILL:.09,                         // MISS마다 새는 액체 비율
  PEN:{P:0,G:3,B:8},                 // 닫기 품질별 감점
  TRAVEL:62, VTRAVEL:44, spring:{k:1400,c:36}, K:1.3,
  // 액체 · 얼음
  CH:{x0:-226,x1:227,seam:12,left:32,middle:47,right:35}, FILL:.52, WDAMP:.993, ICE_DRAG:3, PX:3, G:900, INERTIA:.9, AMAX:12000,
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
// World units per art pixel, before the shaker camera transform.
const shakerPixel = 4/3;
const snapArt = value => Math.round(value/shakerPixel)*shakerPixel;
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
function mixedRGB(){if(R.mixedColor)return hex(R.mixedColor);const L=R.layers,tot=L.reduce((a,l)=>a+l[2],0);let r=0,g=0,b=0;for(const l of L){const [x,y,z]=hex(l[1]);r+=x*l[2]/tot;g+=y*l[2]/tot;b+=z*l[2]/tot}return [r,g,b]}
function avgCol(){const [r,g,b]=mixedRGB();return `rgb(${r|0},${g|0},${b|0})`}
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
// Test the rotated faces, leaving the bevel at each corner outside the contact shape.
function iceContact(a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  if(Math.abs(dx)+Math.abs(dy)>2*(a.size+b.size))return null;
  const ca=Math.cos(a.rot),sa=Math.sin(a.rot),cb=Math.cos(b.rot),sb=Math.sin(b.rot);
  const spread=Math.abs(ca*cb+sa*sb)+Math.abs(sa*cb-ca*sb);
  let depth=Infinity,nx=0,ny=0;
  for(const [ax,ay,radius] of [[ca,sa,a.size+b.size*spread],[-sa,ca,a.size+b.size*spread],
    [cb,sb,b.size+a.size*spread],[-sb,cb,b.size+a.size*spread]]){
    const offset=dx*ax+dy*ay,overlap=.96*radius-Math.abs(offset);
    if(overlap<=0)return null;
    if(overlap<depth){depth=overlap;const sign=offset<0?-1:1;nx=sign*ax;ny=sign*ay;}
  }
  return {nx,ny,depth};
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
  for(let i=0;i<ice.length;i++)for(let j=i+1;j<ice.length;j++){const a=ice[i],b=ice[j],contact=iceContact(a,b);
    if(contact){const {nx,ny,depth:pen}=contact;a.x-=nx*pen/2;a.y-=ny*pen/2;b.x+=nx*pen/2;b.y+=ny*pen/2;
      const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn<0){a.vx+=vn*nx*.51;a.vy+=vn*ny*.51;b.vx-=vn*nx*.51;b.vy-=vn*ny*.51;
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
    for(let attempt=0;attempt<120;attempt++){
      const x=rand(C.x0+extent,22-extent),limit=iceLimit(x,extent),y=rand(-limit,limit);
      const candidate={x,y,size,rot};
      // Pack the starting ice against the lower left wall. Colliding faces cost
      // more than moving a candidate up or across to the next free spot.
      const overlap=cubes.reduce((sum,o)=>sum+(iceContact(candidate,o)?.depth||0),0);
      const cost=30*overlap+(x-C.x0)*.65+limit-y;
      if(cost<score){best={x,y};score=cost;}
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

// Draw adjacent layers from the same unrounded edge samples. Only foam and spray snap to pixels.
const edgeFloor=Float32Array.from({length:NC+1},(_,i)=>halfHeight(chamber.x0+i*B.PX));
const edgeDepth=new Float32Array(NC+1);
function traceWaterEdge(ctx,fraction,reverse){
  for(let step=0;step<=NC;step++){
    const i=reverse?NC-step:step;
    const x=chamber.x0+i*B.PX,y=edgeFloor[i]-edgeDepth[i]*fraction;
    if(step===0&&!reverse)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
}
function drawWater(ctx,now){
  const C=B.CH,P=B.PX,n=NC,h=S.h,m=S.liquidBlend,[ar,ag,ab]=mixedRGB(),cold=S.chill/100;
  for(let i=0;i<=n;i++){
    // Average around the boundary between cells, extending the end cells up to the wall.
    const left=Math.max(0,i-1),right=Math.min(n-1,i);
    const depth=(h[Math.max(0,left-1)]+3*h[left]+3*h[right]+h[Math.min(n-1,right+1)])/8;
    edgeDepth[i]=Math.min(depth,2*edgeFloor[i]);
  }

  const total=R.layers.reduce((sum,layer)=>sum+layer[2],0);
  const opacity=R.mixedColor ? .52+.44*m : .5;
  let base=0;
  for(const [,color,amount] of R.layers){
    const top=base+amount/total;
    const [r,g,b]=hex(color);
    ctx.fillStyle=`rgba(${(r+(ar-r)*m)|0},${(g+(ag-g)*m)|0},${Math.min(255,b+(ab-b)*m+cold*12)|0},${opacity})`;
    ctx.beginPath();traceWaterEdge(ctx,top,false);traceWaterEdge(ctx,base,true);ctx.closePath();ctx.fill();
    base=top;
  }

  const [topRed,topGreen,topBlue]=hex(R.layers[R.layers.length-1][1]);
  const sr=topRed+(ar-topRed)*m,sg=topGreen+(ag-topGreen)*m,sb=topBlue+(ab-topBlue)*m;
  ctx.fillStyle=`rgba(${(sr+(255-sr)*.55)|0},${(sg+(255-sg)*.55)|0},${Math.min(255,sb+(255-sb)*.55+cold*10)|0},.85)`;
  for(let x=C.x0;x<C.x1;x+=shakerPixel){
    const pos=(x-C.x0)/P,i=Math.floor(pos),t=pos-i;
    if(edgeDepth[i]<1)continue;
    const y=(edgeFloor[i]-edgeDepth[i])*(1-t)+(edgeFloor[i+1]-edgeDepth[i+1])*t;
    ctx.fillRect(x,snapArt(y),Math.min(shakerPixel,C.x1-x),shakerPixel);
  }
  // 거품 (흔들림이 셀수록 수면 아래 반짝이는 도트)
  const fz=Math.min(14,S.turb/25|0);
  ctx.fillStyle='rgba(235,240,244,.55)';
  for(let k=0;k<fz;k++){const i=((k*37+((now/60)|0)*13)%n),hh=h[i];if(hh<P*3)continue;ctx.fillRect(C.x0+i*P,snapArt(floorY[i]-hh)+shakerPixel*(1+(k%3)),shakerPixel,shakerPixel)}
  // 물보라
  ctx.fillStyle='rgba(220,228,234,.85)';
  for(const d of S.drops2)ctx.fillRect(snapArt(d.x),snapArt(d.y),shakerPixel,shakerPixel);
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
// The visible 16:9 stage can be scaled both here and by the embedding game.
function displayPixels(){
  let x=0,y=0,sx=1,sy=1;
  for(let host=window;host.frameElement;host=host.parent){
    const frame=host.frameElement,r=frame.getBoundingClientRect();
    if(!frame.offsetWidth||!frame.offsetHeight)continue;
    const fx=r.width/frame.offsetWidth,fy=r.height/frame.offsetHeight;
    x=r.left+(x+frame.clientLeft)*fx;y=r.top+(y+frame.clientTop)*fy;
    sx*=fx;sy*=fy;
  }
  const dpr=window.devicePixelRatio||1;
  return {x:x*dpr,y:y*dpr,sx:sx*dpr,sy:sy*dpr};
}
// Align the bitmap and its CSS box to the same physical pixels, including in a scaled iframe.
function fitGameCanvas(display){
  const r=cv.parentElement.getBoundingClientRect();
  const width=r.width*display.sx,height=r.height*display.sy;
  if(!width||!height)return;
  const x=r.left*display.sx+display.x,y=r.top*display.sy+display.y;
  // Snap both CSS edges as well as backing pixels on integer-DPR displays.
  const grid=Number.isInteger(devicePixelRatio) ? devicePixelRatio : 1;
  const snap=value=>Math.round(value/grid)*grid;
  const left=snap(x),top=snap(y);
  const w=Math.max(1,snap(x+width)-left),h=Math.max(1,snap(y+height)-top);
  cv.style.left=100*(left-x)/width+'%';cv.style.top=100*(top-y)/height+'%';
  cv.style.width=100*w/width+'%';cv.style.height=100*h/height+'%';
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  ctx.setTransform(w/W,0,0,w/W,0,(h-H*w/W)/2);
}
function fitDisplayCanvas(canvas,context,width,height,displayDensity){
  const rect=canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // Keep the 400×300 guide on its own grid even when the entire lesson is scaled down.
  const scale=Math.max(1,Math.ceil(Math.max(rect.width/width,rect.height/height)*displayDensity));
  const w=Math.max(1,Math.round(width*scale)), h=Math.max(1,Math.round(height*scale));
  if(canvas.width!==w || canvas.height!==h){
    canvas.width=w;canvas.height=h;
  }
  context.setTransform(w/width,0,0,h/height,0,0);
}
const SC={x:440,y:322};
const largeTinBase=188*shakerPixel,smallTinBase=-186*shakerPixel,seatedTinOffset=18;
const strokeCycle='DAEA';
const strokeTargets={
  A:{x:-B.TRAVEL,y:0},
  D:{x:B.TRAVEL,y:B.VTRAVEL},
  E:{x:B.TRAVEL,y:-B.VTRAVEL}
};
const strokeTilt=.18;
function keyPosition(key){
  if(key==='A')return [62,SC.y];
  const target=strokeTargets[key];
  return rightRimCorner(key,SC.x+target.x,SC.y+target.y,shakerScale());
}
function rightRimCorner(key,x,y,scale){
  const side=Math.sign(strokeTargets[key].y);
  // The large tin’s outer rim reaches 34 source pixels above and below its axis.
  return projectTinPoint(x,y,side*strokeTilt,scale,largeTinBase,side*34*shakerPixel);
}
function shakerXf(){
  return {x:SC.x+S.px,y:SC.y+S.py,a:S.py/B.VTRAVEL*strokeTilt};
}
const unsealReleaseMs=1420;
function smoothProgress(elapsed,duration){
  const t=Math.max(0,Math.min(1,elapsed/duration));
  return t*t*(3-2*t);
}
function shakerView(now=GT){
  if(S.unseal){
    const age=now-S.unseal.t,settle=1-smoothProgress(age,240);
    const angle=S.unseal.a*settle+.75*smoothProgress(age-220,400)
      +(Math.PI/2-.75)*smoothProgress(age-870,390);
    return{x:SC.x+S.unseal.x*settle,y:SC.y+S.unseal.y*settle,a:angle,zoom:1};
  }
  const f=shakerXf(),closing=S.phase==='close'||S.phase==='tut';
  const progress=closing&&S.closeQ?Math.max(0,Math.min(1,(now-S.slapT-160)/840)):0;
  const ease=progress*progress*(3-2*progress);
  return {x:f.x-B.TRAVEL*ease,y:f.y,a:f.a+(closing?Math.PI/2*(1-ease):0),zoom:1};
}
function closingTinOffset(now=GT){
  const lateral=(S.angDeg-B.CLOSE.center)*4;
  // Local +X points upward: shallow circular arc, highest at the center.
  const radius=140,height=88-(radius-Math.sqrt(Math.max(0,radius*radius-lateral*lateral)));
  const angle=Math.asin(Math.max(-1,Math.min(1,lateral/radius)))*.55;
  if(S.closeQ){const t=Math.min(1,Math.max(0,(now-S.slapT)/160)),e=t*t*(3-2*t);return{x:18+(height-18)*(1-e),y:lateral*(1-e),angle:angle*(1-e)};}
  return{x:height,y:lateral,angle};
}
function unsealPresentation(now=GT){
  const age=now-S.unseal.t;
  const lift=smoothProgress(age-unsealReleaseMs,330);
  const slip=smoothProgress(age-unsealReleaseMs-55,340);
  return{x:seatedTinOffset+68*lift,y:52*slip,angle:.23*slip,
    alpha:1-smoothProgress(age-1760,240)};
}
function shakerScale(){
  return gameGrid.bank ? gameGrid.bank.scale*gameGrid.zoom/(shakerPixel*(cv.width/W)) : B.K;
}
function projectTinPoint(x,y,angle,scale,lx,ly){
  const c=Math.cos(angle),s=Math.sin(angle);
  return [x+scale*(lx*c-ly*s),y+scale*(lx*s+ly*c)];
}
function toWorld(lx,ly){
  const f=shakerView();
  return projectTinPoint(f.x,f.y,f.a,shakerScale()*f.zoom,lx,ly);
}

let R=practiceRecipe,S;
function reset(){
  $('luna-panel').classList.remove('is-opening','is-closing');
  $('luna-feed').setAttribute('aria-hidden','true');
  $('seal-notice').hidden=true;
  ShakeLabAudio.stop();labTasks=[];
  S={phase:'tut',tutPage:0,closeT:GT,angDeg:0,closeQ:null,dur:0,slapT:-1e9,
     px:0,py:0,vx:0,vy:0,tx:0,ty:0,ax:0,ay:0,strokeMoving:false,
     h:null,u:null,turb:0,drops2:[],ices:[],mix:0,liquidBlend:0,chill:0,
     round:0,k:0,seq:'',strokeIndex:0,readySince:0,timeouts:0,roundT:0,res:[],misses:0,waitT:0,combo:0,best:0,
     startT:0,endT:0,cam:0,hitstopUntil:0,fx:[],texts:[],label:null,
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
  {t:'틴 닫기',chip:'SPACE',body:['① 위쪽 작은 틴이 얕은 반원 궤적으로 좌우를 오갑니다.','② 원하는 구간에서 <b>Space</b>를 눌러 두 틴을 결합하세요.','금색 중앙은 <b>3칸</b>, 그 양옆은 <b>2칸</b>, 양 끝은 <b>1칸</b>의 결합 내구도로 시작합니다.'],demo:'close'},
  {t:'시간 안에 한 번 흔들기',chip:'D → A → E → A',body:['① <b>D</b>로 오른쪽 아래, <b>E</b>로 오른쪽 위를 번갈아 치세요. 매번 <b>A</b>로 왼쪽 중앙에 돌아옵니다.','② 쉐이커가 멈추면 다음에 누를 키 하나만 나타납니다. 도착 전에 누르면 결합 내구도가 1칸 줄어듭니다.','시간이 다 되면 해당 회차는 MISS로 기록되고 내구도는 유지됩니다.','잘못된 키를 누르면 내구도가 1칸 줄어듭니다. 마지막 칸을 잃으면 틴이 빠집니다.'],demo:'shake'},
];
function showTut(p){
  S.tutPage=p;$('tut').hidden=false;setPause(true);
  const T=TUT[p];
  const guide=$('shake-guide');
  guide.dataset.demo=T.demo;
  fitShakerGuide(displayPixels().sx);
  guide.setCurrentTime(0);
  guide.unpauseAnimations();
  $('tutPage').textContent=String(p+1);$('tutHead').textContent=T.t;
  $('tutChip').textContent=T.chip;
  $('tutBody').innerHTML=T.body.map(x=>`<p>${x}</p>`).join('');
  $('tutPrev').hidden=p===0;$('tutNext').textContent=p<TUT.length-1?'다음 · E':'확인 · E';
}
function tutNext(){if(S.tutPage<TUT.length-1)showTut(S.tutPage+1);else{$('shake-guide').pauseAnimations();$('tut').hidden=true;setPause(false);S.phase='close';S.angDeg=B.CLOSE.center-B.CLOSE.amp;S.closeT=GT;S.startT=GT}}
$('tutNext').onclick=()=>{audio();tutNext()};$('tutPrev').onclick=()=>showTut(Math.max(0,S.tutPage-1));
// ───────── 입력
addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Escape'){e.preventDefault();toggleSettings();return}
  if(!$('settings').hidden)return;
  if(!$('tut').hidden){if(e.code==='Enter'&&e.target.closest?.('#tut button'))return;if(e.code==='KeyE'||e.code==='Enter'){e.preventDefault();audio();tutNext()}return}
  if(!$('res').hidden){if(e.code==='KeyE'||e.code==='Space'){e.preventDefault();reset()}return}
  if(S.phase==='close'){if(e.code==='Space'){e.preventDefault();audio();press('Space')}return}
  const k={KeyA:'A',KeyD:'D',KeyE:'E',ArrowLeft:'A',ArrowRight:'D',ArrowUp:'E'}[e.code];
  if(!k)return;e.preventDefault();if(e.repeat)return;audio();press(k);
});
// The two right-hand touch zones meet halfway between the D and E cues.
cv.addEventListener('pointerdown',e=>{
  audio();
  if(S.phase==='close'){press('Space');return}
  if(S.phase==='shake'){
    const r=cv.getBoundingClientRect();
    const middleY=r.top+r.height/2+(SC.y-H/2)*r.width/W;
    if(e.clientX<r.left+r.width/2)press('A');
    else press(e.clientY<middleY?'E':'D');
  }
});
$('again').onclick=reset;$('other').onclick=()=>{R=RECIPES[(RECIPES.indexOf(R)+1)%RECIPES.length];reset()};$('home').onclick=()=>{R=practiceRecipe;reset()};

function readyShakeKey(now){
  if(S.phase!=='shake'||S.strokeMoving||S.pending||S.round>=R.rounds||now<S.waitT)return null;
  return S.seq[S.k];
}
function press(k){
  if(pauseAt!=null||!$('settings').hidden||!$('tut').hidden)return;
  const now=GT;if(S.done)return;
  if(S.phase==='close'){if(k==='Space')slap(now);return}
  if(S.phase!=='shake'||now<S.waitT||S.pending||S.round>=R.rounds)return;
  if(S.strokeMoving){
    loseDurability(now,'너무 빨라..');
    return;
  }
  const want=readyShakeKey(now);
  if(k!==want){miss(now);return}
  ShakeLabAudio.hit();
  throwTo(k);
  strokeImpact(k,now);
  S.k++;
  if(S.k>=S.seq.length)success(now);
}
function throwTo(k){
  S.strokeIndex=(S.strokeIndex+1)%strokeCycle.length;
  beginLunaStroke(k);
  S.tx=strokeTargets[k].x;S.ty=strokeTargets[k].y;
  S.strokeMoving=true;S.kickKey=k;S.kickT=GT;
  // Input, tilt and contents all move toward the same selected side.
  const direction=k==='A'?-1:1;
  S.vx=direction*480;S.cam=Math.max(S.cam,4);
  for(const o of S.ices){o.vx=direction*rand(1800,2100);o.vy+=rand(-85,45);o.vr+=direction*rand(.7,2);o.wall=null;o.wallSpeed=0;}
  if(S.u)for(let i=1;i<NC;i++)S.u[i]=S.u[i]*.2+direction*620*strokeProfile[i];
}

// ═════ STEP 1 틴 닫기 (Space 한 번) ═════
function showSealNotice(failed){
  const notice=$('seal-notice');
  notice.toggleAttribute('data-failed',failed);
  notice.toggleAttribute('data-weak',!failed && S.dur===1);
  notice.querySelector('strong').textContent=failed?'SHAKE FAILED':'SHAKER ASSEMBLED';
  notice.querySelector('span').textContent=failed?'SEAL BROKEN':'START...';
  notice.hidden=false;
}
function slap(now){
  if(S.closeQ)return;
  const C=B.CLOSE,distance=Math.abs(S.angDeg-C.center);
  const q=distance<=C.inner?'P':distance<=C.middle?'G':'B';
  S.closeQ=q;S.dur=B.DUR[q];S.slapT=now;S.cam=q==='P'?14:9;if(q==='P')S.hitstopUntil=performance.now()+80;
  showSealNotice(false);
  const [sx,sy]=toWorld(-40,0);S.fx.push({k:'ring',x:sx,y:sy,t:now,big:q==='P'});
  smack(q==='B'?'W':q);
  labDelay(()=>{
    $('luna-feed').removeAttribute('aria-hidden');
    $('luna-panel').classList.add('is-opening');
  },600);
  // Leave a fully open frame before the first key can be accepted.
  labDelay(()=>{
    $('seal-notice').hidden=true;
    $('luna-panel').classList.remove('is-opening');
  },940);
  labDelay(()=>{if(S.phase==='close')startShake()},1000);
}
// ═════ STEP 2 쉐이크 ═════
function startShake(){
  S.phase='shake';
  S.tx=S.px=strokeTargets.A.x;S.ty=S.py=strokeTargets.A.y;
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
  if(S.round>=R.rounds){
    const pose=shakerXf();
    S.phase='unseal';S.endT=S.endT||GT;
    S.unseal={t:GT,x:S.px,y:S.py,a:pose.a};
    S.drops2=[];S.cam=0;S.label=null;
    ShakeLabAudio.complete();
    labDelay(()=>{S.cam=3},unsealReleaseMs);
    return;
  }
  // Advance the physical cycle only on accepted strokes, even across missed rounds.
  const count=R.strokesPerRound[S.round%R.strokesPerRound.length];
  S.seq=strokeCycle.repeat(2).slice(S.strokeIndex,S.strokeIndex+count);
  S.k=0;S.roundT=GT;S.readySince=GT;
}
function popShakeText(now){
  // Pick once in shaker space, then let the word rise independently in screen space.
  let x,y;
  for(let attempt=0;attempt<8;attempt++){
    const offset=rand(-185,185),rim=halfHeight(offset);
    const height=Math.random()<.5 ? -rim-rand(22,34) : rim+rand(40,52);
    [x,y]=toWorld(offset,height);
    x+=S.tx-S.px;y+=S.ty-S.py;
    y=Math.max(durabilityCenterY+shakerGaugeHeight/2+48,y);
    if(!S.texts.some(t=>t.shakeWord&&Math.abs(x-t.x)<100&&Math.abs(y-t.y)<55))break;
  }
  S.texts.push({txt:'SHAKE!',shakeWord:true,x,y,c:'#f0c987',s:.9,rot:0,t:now});
}
function strokeImpact(key,now){
  const t=(now-S.roundT)/win(),fast=t<.55;
  S.cam=Math.max(S.cam,fast?9:6);if(fast)S.hitstopUntil=performance.now()+45;
  const base=key==='A'?smallTinBase:largeTinBase;
  S.fx.push({k:'ring',onTin:true,x:base,y:0,t:now,big:fast});
  popShakeText(now);
  S.label={t:now,g:'ok',fast};
  iceClack(fast?1:.7);
}
function success(now){
  S.res.push('O');S.round++;S.combo++;S.best=Math.max(S.best,S.combo);
  S.mix=Math.min(100,S.mix+100/R.rounds);S.chill=Math.min(100,S.chill+100/R.rounds);
  paintBar();
  if(S.round===R.rounds){S.endT=now;return}
  nextRound();
}
function loseDurability(now,message){
  S.misses++;S.label={t:now,g:'miss'};S.cam=6;
  popText(message,W/2,durabilityCenterY+shakerGaugeHeight/2+34,'#ff6a6a',1);buzz();
  if(S.misses>=S.dur)popOff(now);
}
function miss(now,reason='input'){
  S.res.push('M');S.round++;S.combo=0;
  if(S.h){S.lost=(S.lost||0)+S.vol*B.SPILL;slosh(.8)}
  S.waitT=now+350;paintBar();
  if(reason==='timeout'){
    S.timeouts++;
    popText('MISS',W/2,durabilityCenterY+shakerGaugeHeight/2+34,'#ff6a6a',1);
  }else loseDurability(now,'MISS');
  if(S.phase==='pop')return;
  S.pending=true;labDelay(()=>{S.pending=false;if(S.phase==='shake')nextRound()},350);
}
function popOff(now){
  S.phase='pop';S.endT=now;S.pop={t:now,vx:560,vy:-560,spin:4};S.cam=20;
  S.texts=S.texts.filter(t=>!t.shakeWord);
  popText('틴이 빠졌다!',W/2,48,'#ff6a6a',1.6);
  // Opaque shells stay intact; spilled contents are simulated outside the opening.
  // Cubes nearest the lip emerge first, retaining their size and orientation.
  const cubes=S.ices.slice().sort((a,b)=>Math.abs(a.x+40)-Math.abs(b.x+40));
  cubes.forEach((cube,index)=>labDelay(()=>spillIce(cube,index/cubes.length),50+index*46));
  S.h=null;S.u=null;S.ices=[];S.drops2=[];S.fx=[];
  S.pop.spillColor=avgCol();S.pop.spillCarry=0;
  for(let i=0;i<64;i++)emitFailureLiquid(true);
  clank(1);smack('P');slosh(1);
  $('luna-panel').classList.add('is-closing');
  labDelay(()=>{
    $('luna-feed').setAttribute('aria-hidden','true');
    $('luna-panel').classList.remove('is-closing');
    showSealNotice(true);
  },320);
  labDelay(()=>{$('seal-notice').hidden=true;finish('pop')},1500);
}
function spillIce(cube,progress){
  const size=cube.size*B.K;
  const [x,y]=toWorld(-40+cube.size,Math.max(0,Math.min(48-cube.size,cube.y+20)));
  S.fx.push({k:'ice',x,y,size,rot:cube.rot+shakerXf().a,vr:cube.vr*.35+rand(-1.6,1.6),
    vx:-230+110*progress+rand(-25,25),vy:rand(-55,40)+90*progress,
    hitT:-Infinity,life:1.35,g:760});
}
function emitFailureLiquid(burst=false){
  const [x,y]=toWorld(-40,burst?rand(-12,38):rand(26,47));
  const life=rand(.75,1.25);
  S.fx.push({k:'liquid',x,y,vx:burst?-rand(140,370):-rand(65,155),vy:burst?rand(-130,85):rand(30,125),life,c:S.pop.spillColor,r:burst?rand(2,5):rand(3,6),g:720});
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
  $('rsRows').innerHTML='';$('rsNote').textContent=`${R.name} · ${R.lv} · 시작 내구도 ${S.dur}칸`;
  $('res').hidden=false;
}

// ───────── 업데이트
function update(now,dt){
  const sec=dt/1000;
  if(S.phase==='close'&&!S.closeQ){const C=B.CLOSE,t=(now-S.closeT)/1000;S.angDeg=C.center-C.amp*Math.cos(t*C.speed)}
  if(S.phase==='shake'&&S.round<R.rounds&&!S.pending&&now>=S.waitT&&now-S.roundT>win())miss(now,'timeout');
  // 쉐이커 스프링
  if(sec>0&&(S.phase==='shake'||S.phase==='close')){
    if(S.phase!=='shake'){S.tx=0;S.ty=0}
    const vx0=S.vx,vy0=S.vy;
    const steps=Math.max(1,Math.ceil(dt/17)),step=sec/steps;
    for(let i=0;i<steps;i++){
      S.vx+=(B.spring.k*(S.tx-S.px)-B.spring.c*S.vx)*step;S.vy+=(B.spring.k*(S.ty-S.py)-B.spring.c*S.vy)*step;
      S.px+=S.vx*step;S.py+=S.vy*step;
    }
    // Settle within one design pixel before showing or accepting the opposite key.
    if(S.strokeMoving && Math.hypot(S.tx-S.px,S.ty-S.py)<.75 && Math.hypot(S.vx,S.vy)<18){
      S.px=S.tx;S.py=S.ty;S.vx=S.vy=0;S.strokeMoving=false;S.readySince=now;
      if(S.round>=R.rounds && !S.pending)nextRound();
      else if(S.k===0 && !S.pending)S.roundT=now;
    }
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
  S.cam*=Math.pow(.0012,sec);
  if(S.phase==='pop'&&sec>0){
    const age=(now-S.pop.t)/1000;
    if(age<1){S.pop.spillCarry+=sec*100*(1-age);while(S.pop.spillCarry>=1){emitFailureLiquid();S.pop.spillCarry--;}}
  }
  S.fx=S.fx.filter(p=>{if(p.k==='ring')return now-p.t<420;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=p.g*sec;if(p.k==='ice')p.rot+=p.vr*sec;p.life-=sec;return p.life>0});
  S.texts=S.texts.filter(t=>now-t.t<800);
}

// The vapor originates at the stationary lower tin's lip, behind the lifting lid.
function drawReleaseVapor(age){
  const t=(age-unsealReleaseMs)/650;
  if(t<=0||t>=1)return;
  const [x,y]=toWorld(-40,0);
  ctx.save();
  for(let i=0;i<8;i++){
    const life=(t-i*.026)/.8;
    if(life<=0||life>=1)continue;
    const cx=x+(i-3.5)*5+Math.sin(i*2.4)*27*life,cy=y-life*(66+i%3*8);
    const radius=7+life*26;
    const fog=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
    fog.addColorStop(0,'rgba(216,240,245,'+.32*Math.sin(Math.PI*life)+')');
    fog.addColorStop(1,'rgba(216,240,245,0)');
    ctx.fillStyle=fog;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
  }
  ctx.restore();
}
function drawShakeCompletion(age){
  if(age>=2200)return;
  ctx.save();
  // Anchor the title to the panel, independent of the tin and the impact camera.
  const view=ctx.getTransform(),top=-view.f/view.d;
  if(age<230){
    ctx.fillStyle='rgba(150,232,250,'+.18*(1-age/230)**2+')';
    ctx.fillRect(0,top,W,cv.height/view.d);
  }
  const alpha=Math.min(1,age/65)*(1-smoothProgress(age-1740,460));
  ctx.globalAlpha=alpha;
  const halfLine=230*smoothProgress(age,280);
  ctx.fillStyle='#c6a76d';ctx.fillRect(W/2-halfLine,top+115,halfLine*2,2);
  const size=1+.27*(1-smoothProgress(age,130))-.055*(1-smoothProgress(age-130,120));
  ctx.translate(W/2,top+88);ctx.scale(size,size);
  ctx.font='700 40px "Galmuri11",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=5;ctx.strokeStyle='#08131a';ctx.strokeText('쉐이킹 완료!',0,0);
  ctx.shadowColor='#a47d45';ctx.shadowBlur=6;ctx.fillStyle='#f0c987';ctx.fillText('쉐이킹 완료!',0,0);
  ctx.restore();
}

// ───────── 그리기
function drawSpill(ctx,bank,display){
  ctx.save();
  for(const p of S.fx){
    ctx.globalAlpha=Math.min(1,Math.max(0,p.life/.25));
    if(p.k==='ice'){
      ctx.save();
      ctx.resetTransform();
      const x=(display.e+display.a*p.x)/gameGrid.zoom, y=(display.f+display.d*p.y)/gameGrid.zoom;
      ShakerArt.drawIce(ctx,bank,x,y,p.rot,2*p.size*bank.scale/(B.K*shakerPixel));
      ctx.restore();
    }else if(p.k==='liquid'){
      ctx.globalAlpha*=.85;ctx.strokeStyle=p.c;ctx.lineWidth=p.r*2;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(p.x-p.vx*.025,p.y-p.vy*.025);ctx.lineTo(p.x,p.y);ctx.stroke();
      ctx.fillStyle='rgba(235,250,255,.45)';ctx.fillRect(p.x-1,p.y-2,2,2);
    }
  }
  ctx.restore();
}
function draw(now){
  ctx.save();ctx.resetTransform();ctx.clearRect(0,0,cv.width,cv.height);ctx.restore();
  const cam=OPT.shake?S.cam:0;
  const shakeX=(Math.random()-.5)*cam,shakeY=(Math.random()-.5)*cam;
  ctx.save();ctx.translate(shakeX,shakeY);

  if(S.unseal)drawReleaseVapor(now-S.unseal.t);
  drawShaker(now);
  for(const f of S.fx){
    if(f.k!=='ring')continue;
    const k=(now-f.t)/420,[x,y]=f.onTin?toWorld(f.x,f.y):[f.x,f.y];
    const radius=f.onTin?10+k*(f.big?38:28):16+k*(f.big?100:60);
    ctx.strokeStyle=`rgba(255,244,214,${(1-k)*(f.big?1:.6)})`;ctx.lineWidth=(f.big?6:3)*(1-k)+1;
    ctx.beginPath();ctx.arc(x,y,radius,0,7);ctx.stroke();
  }
  ctx.restore();
  drawKeys(now);
  if(S.phase==='shake'||S.phase==='pop')drawGauge(now);
  for(const t of S.texts){
    const k=(now-t.t)/800,pop=k<.14?k/.14*1.2:1.2-(k-.14)*.25;
    ctx.save();ctx.translate(t.x,t.y-k*20);
    ctx.rotate(t.rot);ctx.scale(t.s*pop,t.s*pop);
    const fadeStart=t.shakeWord?.25:.7;
    ctx.globalAlpha=Math.min(1,Math.max(0,(1-k)/(1-fadeStart)));ctx.font='700 26px "Galmuri11",sans-serif';ctx.textAlign='center';ctx.lineWidth=6;ctx.strokeStyle='rgba(5,12,17,.85)';ctx.strokeText(t.txt,0,0);ctx.fillStyle=t.c;ctx.fillText(t.txt,0,0);ctx.restore()}
  if(S.phase==='unseal')drawShakeCompletion(now-S.unseal.t);
}
// The joined shell flares toward the lip of the larger tin, then steps inward.
const durabilityCenterY=128,shakerGaugeWidth=320,shakerGaugeHeight=82;
const shakerGaugeOutline=new Path2D(
  'M160 27 Q160 29 157 29 L-19 41 L-21 41 L-21 36 L-157 27 Q-160 27 -160 24 '+
  'L-160 -25 Q-160 -28 -157 -28 L-21 -36 L-21 -41 L-19 -41 L157 -29 Q160 -29 160 -27 Z'
);
function gaugeColor(elapsed){
  return elapsed<.25?'rgba(240,250,255,.95)':elapsed<.5?'#b7ee55':elapsed<.75?'#ff993d':'#ff4b4b';
}
function drawDurabilityGauge(c,elapsed,dur,misses){
  c.save();
  c.lineJoin='round';c.lineWidth=3;
  c.fillStyle='rgba(9,22,31,.76)';c.fill(shakerGaugeOutline);
  c.strokeStyle='#314651';c.stroke(shakerGaugeOutline);
  if(elapsed<1){
    c.save();
    if(elapsed>0){
      // A single vertical cut extinguishes the upper and lower edges together.
      const front=(.5-elapsed)*(shakerGaugeWidth+c.lineWidth);
      const left=-shakerGaugeWidth/2-14,top=-shakerGaugeHeight/2-14;
      c.beginPath();c.rect(left,top,front-left,-2*top);c.clip();
    }
    c.strokeStyle=c.shadowColor=gaugeColor(elapsed);c.shadowBlur=7;
    c.stroke(shakerGaugeOutline);
    c.restore();
  }

  const count=B.DUR.P,remaining=Math.max(0,dur-misses),rowY=-10;
  c.textAlign='left';c.textBaseline='alphabetic';c.font='700 18px "Galmuri11",monospace';
  const labelWidth=c.measureText('결합 내구도').width;
  const rowX=-(labelWidth+14+count*26-6)/2,pipX=rowX+labelWidth+14;
  c.fillStyle='#9fb7c1';c.fillText('결합 내구도',rowX,rowY+16);
  for(let i=0;i<count;i++){
    const x=pipX+i*26;
    if(i<remaining){c.fillStyle='#7be3a4';c.fillRect(x,rowY,20,20);}
    else{
      c.strokeStyle=i<dur?'#ff6a6a':'#41535c';c.lineWidth=2;c.strokeRect(x+1,rowY+1,18,18);
    }
  }
  c.restore();
}
function drawGauge(now){
  let elapsed=1;
  if(S.phase==='shake'&&!S.pending&&S.round<R.rounds){
    elapsed=S.strokeMoving&&S.k===0 ? 0 : Math.max(0,Math.min(1,(now-S.roundT)/win()));
  }
  ctx.save();ctx.translate(W/2,durabilityCenterY);
  drawDurabilityGauge(ctx,elapsed,S.dur,S.misses);
  ctx.restore();
}
function drawReadyKey(c,key,x,y,age){
  const pulse=1-smoothProgress(age,240);
  c.save();c.translate(x,y);
  c.scale(1+.09*pulse,1+.09*pulse);
  c.fillStyle='rgba(19,61,75,.94)';c.strokeStyle='#68def3';c.lineWidth=2.5;
  c.shadowColor='#55d7ee';c.shadowBlur=8+10*pulse;
  c.beginPath();c.roundRect(-24,-24,48,48,5);c.fill();c.stroke();c.shadowBlur=0;
  c.fillStyle='#e9fbff';c.font='700 23px "Galmuri11",monospace';
  c.textAlign='center';c.textBaseline='middle';c.fillText(key,0,1);
  if(pulse>0){
    const edge=26+9*(1-pulse);
    c.strokeStyle=`rgba(164,242,255,${pulse*.85})`;c.lineWidth=2;
    c.beginPath();
    for(const dx of [-1,1])for(const dy of [-1,1]){
      c.moveTo(dx*(edge-6),dy*edge);c.lineTo(dx*edge,dy*edge);c.lineTo(dx*edge,dy*(edge-6));
    }
    c.stroke();
  }
  c.restore();
}
function drawKeys(now){
  if(S.phase==='close'||S.phase==='tut'){
    if(S.closeQ)return;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    const margin=(cv.height/(cv.width/W)-H)/2;
    ctx.translate(0,margin-52);
    ctx.fillStyle='#122b36';ctx.strokeStyle='#55d7ee';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(W/2-85,555,170,44,6);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(W/2-54,574);ctx.lineTo(W/2-54,583);ctx.lineTo(W/2-28,583);ctx.lineTo(W/2-28,574);ctx.stroke();
    ctx.fillStyle='#e9fbff';ctx.font='700 18px "Galmuri11",monospace';ctx.fillText('SPACE',W/2+15,578);
    ctx.restore();
    const C=B.CLOSE,unit=132/C.amp;
    const y=46-margin;
    ctx.save();ctx.translate(W/2,y);
    ctx.fillStyle='#536e7b';ctx.fillRect(-C.amp*unit,0,2*C.amp*unit,10);
    ctx.fillStyle='#55d7ee';ctx.fillRect(-C.middle*unit,0,2*C.middle*unit,10);
    ctx.fillStyle='#f0c987';ctx.fillRect(-C.inner*unit,0,2*C.inner*unit,10);
    ctx.fillStyle='#fff';ctx.fillRect((S.angDeg-C.center)*unit-2,-5,4,20);
    ctx.restore();return;
  }
  if(S.phase!=='shake'&&S.phase!=='pop')return;
  const want=readyShakeKey(now);
  if(want){
    const [x,y]=keyPosition(want);
    drawReadyKey(ctx,want,x,y,now-S.readySince);
  }
  ctx.textBaseline='alphabetic';
  if(S.phase==='shake'&&S.seq.length>2&&!S.pending&&S.round<R.rounds){
    ctx.textAlign='center';ctx.font='700 16px "Galmuri11",monospace';ctx.fillStyle='#8aa2ad';
    ctx.fillText(`두 번 왕복 · ${S.k}/${S.seq.length}`,W/2,560);
  }

}
const gameGrid = new ShakerArt.Surface();

function drawIcePx(cube,ctx,bank,scale){
  ctx.save();
  const hot=Math.max(0,1-(GT-cube.hitT)/180);
  ctx.globalAlpha*=.94+.06*hot;
  ShakerArt.drawIce(ctx,bank,cube.x*scale,cube.y*scale,cube.rot,2*cube.size*scale);
  ctx.restore();
}

function drawContents(ctx,bank,scale,now){
  const glass=ShakerArt.sightGlass(scale);
  ctx.save();
  ctx.fillStyle='#53636f'; ctx.fill(glass.outer);
  ctx.clip(glass.inner);
  ctx.fillStyle='#101720'; ctx.fill(glass.inner);
  ctx.save();
  ctx.scale(scale,scale);
  drawWater(ctx,now);
  ctx.restore();
  for(const cube of S.ices)drawIcePx(cube,ctx,bank,scale);
  if(S.chill>10){
    ctx.fillStyle='rgba(235,250,255,'+S.chill/100*.5+')';
    for(let i=0;i<S.chill*1.2;i++){
      const x=chamber.x0+((i*37)%(chamber.x1-chamber.x0));
      const y=i%2 ? -halfHeight(x)+2*shakerPixel : halfHeight(x)-2*shakerPixel;
      ctx.fillRect(Math.round(x*scale),Math.round(y*scale),1,1);
    }
  }
  ctx.restore();
}

function drawShaker(now){
  const display=ctx.getTransform();
  gameGrid.fit(cv.width,cv.height,display.a*B.K*shakerPixel);
  const {bank,zoom}=gameGrid;
  if(!bank)return;
  const art=gameGrid.ctx;
  if(S.phase==='pop'){
    art.save();
    art.setTransform(display.a/zoom,0,0,display.d/zoom,display.e/zoom,display.f/zoom);
    drawSpill(art,bank,display);
    art.restore();
    gameGrid.present(ctx);
  }
  const f=shakerView(now);
  const closing=S.phase==='close'||S.phase==='tut';
  let offset={x:seatedTinOffset,y:0,angle:0},alpha=1;
  if(S.unseal){
    const pose=unsealPresentation(now);
    offset=pose;alpha=pose.alpha;
  }else if(closing){
    offset=closingTinOffset(now);
  }else if(S.pop){
    // The parts sprite is drawn a half turn around, so rightward travel subtracts local X.
    offset.x-=S.tinX/B.K;offset.y=-S.tinY/B.K;offset.angle=S.tinA;
  }
  ShakerArt.drawBody(gameGrid,ctx,display.e+display.a*f.x,display.f+display.d*f.y,
    f.a,f.zoom,offset,alpha,S.phase==='shake' ? (c,b,scale)=>drawContents(c,b,scale,now) : null);
}
function updateUI(){
  const el=S.phase!=='tut'?((S.endT||GT)-S.startT)/1000:0;
  $('timer').textContent=String(Math.floor(el/60)).padStart(2,'0')+':'+String(Math.floor(el%60)).padStart(2,'0');
}
function loop(){
  const real=clock(),dReal=Math.min(50,real-(lastReal||real));lastReal=real;
  const frozen=performance.now()<S.hitstopUntil||pauseAt!=null||!gameGrid.bank;
  const dt=frozen?0:dReal;GT+=dt;labTick(dt);
  update(GT,dt);draw(GT);drawShakerGuide();updateUI();if(window.drawLuna)drawLuna(GT);
  requestAnimationFrame(loop);
}


