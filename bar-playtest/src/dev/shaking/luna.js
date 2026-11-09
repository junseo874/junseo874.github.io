
// Input-driven half strokes: A returns to center; D alternates high/low extension.
const FR={"pull": "assets/asset-03.webp", "mid": "assets/asset-04.webp", "high": "assets/asset-05.webp", "push": "assets/asset-06.webp", "alt": "assets/asset-07.webp", "low3": "assets/asset-08.webp", "low2": "assets/asset-09.webp", "high2": "assets/asset-10.webp"};
const IMG={};for(const k in FR){IMG[k]=new Image();IMG[k].src=FR[k]}
const POS={pull:[.70,.60],mid:[.60,.46],high:[.70,.40],push:[.74,.36],alt:[.62,.46],low3:[.76,.62],low2:[.72,.62],high2:[.72,.38]};
function lunaStrokeFrame(now){
  const motion=S.lunaMotion;if(!motion)return 'mid';
  return motion.frames[Math.min(motion.frames.length-1,Math.max(0,Math.floor((now-motion.t)/65)))];
}
function beginLunaStroke(key){
  const current=lunaStrokeFrame(GT);let frames;
  if(key==='A'){
    const path=['low3','low2','pull'].includes(current)?['low3','low2','pull','mid']:['push','high2','high','mid'];
    const index=path.indexOf(current);frames=index>=0?path.slice(index):[current,'mid'];
  }else{
    S.lunaPushCount=(S.lunaPushCount||0)+1;
    frames=S.lunaPushCount%2?[current,'high','high2','push']:[current,'pull','low2','low3'];
  }
  S.lunaMotion={t:GT,input:key,frames:frames.filter((f,i)=>i===0||f!==frames[i-1])};
}
function lunaStrokePulse(now){
  const m=S.lunaMotion;if(!m||!['shake','unseal'].includes(S.phase))return 0;
  if(S.label?.g==='miss'&&S.label.t>=m.t)return 0;
  const elapsed=now-m.t-(m.frames.length-1)*65;
  return elapsed>=0&&elapsed<160?Math.sin(elapsed/160*Math.PI)*(m.input==='A'?.4:.75):0;
}
const lv=document.getElementById('lv'),lc=lv.getContext('2d'),LW=760,LH=712;
function lfit(){const d=Math.min(window.devicePixelRatio||1,2);lv.width=LW*d;lv.height=LH*d;lc.setTransform(d,0,0,d,0,0)}
lfit();addEventListener('resize',lfit);
function drawLuna(now){
  let key='mid',dx=0,dy=0,rot=0,sc=1;
  const lab=S.label,ok=lab&&lab.g==='ok'&&now-lab.t<120,miss=lab&&lab.g==='miss'&&now-lab.t<300;
  if(S.phase==='tut')key='mid';
  else if(S.phase==='close'){const hit=S.closeQ&&now-S.slapT<200;key=hit?'high':S.closeQ?'mid':'alt';if(hit)dy=8}
  else if(S.phase==='shake'||S.phase==='unseal'){
    key=lunaStrokeFrame(now);
    if(miss)rot=Math.sin(now/22)*.01;
  }else if(S.phase==='pop'){key=now-S.pop.t<300?'push':'alt'}
  const cam=OPT.shake?S.cam*.8:0;dx+=(Math.random()-.5)*cam;dy+=(Math.random()-.5)*cam;
  lc.save();lc.clearRect(0,0,LW,LH);lc.translate(LW/2+dx,LH/2+dy);lc.rotate(rot);lc.scale(sc,sc);
  const im=IMG[key];if(im&&im.complete)lc.drawImage(im,-LW/2,-LH/2,LW,LH);lc.restore();
  const [ax,ay]=(POS[key]||POS.mid).map((v,i)=>v*(i?LH:LW)),px=ax+dx,py=ay+dy;
  if(S.chill>5){const e=S.chill/100,g=lc.createRadialGradient(px,py,0,px,py,150);g.addColorStop(0,`rgba(160,228,246,${e*.28})`);g.addColorStop(1,'rgba(160,228,246,0)');lc.fillStyle=g;lc.fillRect(px-150,py-150,300,300)}
  const pulse=lunaStrokePulse(now);
  if(pulse>0){const r=100,g=lc.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(255,244,214,${pulse})`);g.addColorStop(1,'rgba(255,244,214,0)');lc.fillStyle=g;lc.fillRect(px-r,py-r,r*2,r*2)}
  if(miss){lc.fillStyle=`rgba(255,70,70,${.18*(1-(now-lab.t)/300)})`;lc.fillRect(0,0,LW,LH)}
  if(S.phase==='pop'){const t=(now-S.pop.t)/1000;lc.fillStyle=`rgba(255,80,80,${Math.max(0,.35-t*.25)})`;lc.fillRect(0,0,LW,LH)}
  const v=lc.createRadialGradient(LW/2,LH/2,LH*.35,LW/2,LH/2,LH*.75);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.35)');lc.fillStyle=v;lc.fillRect(0,0,LW,LH);
}

