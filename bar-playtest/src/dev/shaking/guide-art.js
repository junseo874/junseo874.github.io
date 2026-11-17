// The guide runs on the SVG keys' clock, including when gameplay is paused.
const guideCanvas = document.getElementById('guide-art');
const guidePaint = guideCanvas.getContext('2d');
const guideGrid = new ShakerArt.Surface();

function fitShakerGuide(density) {
  fitDisplayCanvas(guideCanvas, guidePaint, 400, 300, density);
}
function guideValue(time, keys) {
  for (let i = 1; i < keys.length; i++) {
    const [end, to] = keys[i];
    if (time <= end) {
      const [start, from] = keys[i-1];
      return from + (to-from) * (time-start) / (end-start);
    }
  }
  return keys[keys.length-1][1];
}
const guideMotion = {
  turn: [[0,90],[.53,90],[.68,0],[.78,0],[.88,90],[1,90]],
  tilt: [[0,-12],[.26,12],[.39,0],[.90,0],[1,-12]],
  lift: [[0,96],[.39,98],[.49,18],[.85,18],[.90,96],[1,96]],
  slide: [[0,-61],[.26,61],[.39,0],[.90,0],[1,-61]],
  travel: [[0,20],[.16,20],[.31,-23],[.38,-20],[.55,-20],[.72,23],[.79,20],[1,20]],
  slosh: [[0,0],[.16,0],[.31,-1],[.5,.2],[.55,0],[.72,1],[.85,-.2],[1,0]]
};

function drawGuideContents(ctx, bank, scale, time) {
  const {inner,outer} = ShakerArt.sightGlass(scale);
  ctx.save();
  ctx.fillStyle = '#53636f'; ctx.fill(outer); ctx.clip(inner);
  ctx.fillStyle = '#101720'; ctx.fill(inner);
  const flow = -guideValue(time, guideMotion.slosh);
  ctx.save();
  ctx.scale(scale,scale);
  ctx.fillStyle = avgCol();
  ctx.beginPath();
  for (let x = -240; x <= 240; x += 10) {
    const y = 5 - flow*x*.08 + 3*Math.sin(x/56 + time*2*Math.PI);
    if (x === -240) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.lineTo(240,60); ctx.lineTo(-240,60); ctx.closePath(); ctx.fill();
  ctx.restore();
  for (const [start,y,side,tilt] of [[-78,0,28, .24],[72,2,32,-.38]]) {
    const x = start + flow*32;
    ShakerArt.drawIce(ctx,bank,x*scale,y*scale,
      tilt+flow*.32,side*scale);
  }
  ctx.restore();
}

function drawShakerGuide() {
  if ($('tut').hidden) return;
  const svg = $('shake-guide'), closing = svg.dataset.demo === 'close';
  const duration = closing ? 3.92 : 2, time = svg.getCurrentTime() % duration / duration;
  const density = guideCanvas.width / 400;
  guideGrid.fit(guideCanvas.width, guideCanvas.height, density*.33*shakerPixel);
  if (!guideGrid.bank) return;
  guidePaint.clearRect(0,0,400,300);
  const outward = Math.floor(svg.getCurrentTime()/2)%2===1 ? 'E' : 'D';
  const rightY = strokeTargets[outward].y;
  const travel = -guideValue(time,guideMotion.travel);
  const extension = (travel+20)/40;
  const y = closing ? 162 : 155+rightY*.5*extension;
  const angle = closing ? guideValue(time,guideMotion.turn)*Math.PI/180 :
    strokeTilt*rightY/B.VTRAVEL*extension;
  const centerX = 200 + (closing ? 0 : travel);
  const offset = closing ? {
    x: guideValue(time,guideMotion.lift), y: guideValue(time,guideMotion.slide),
    angle: guideValue(time,guideMotion.tilt)*Math.PI/180
  } : {x:seatedTinOffset,y:0,angle:0};
  ShakerArt.drawBody(guideGrid,guidePaint,centerX*density,y*density,
    angle,1,offset,1,closing ? null : (c,b,scale)=>drawGuideContents(c,b,scale,time));
  if(closing)return;

  guidePaint.save();guidePaint.translate(200,58);guidePaint.scale(.65,.65);
  drawDurabilityGauge(guidePaint,time,3,0);
  guidePaint.restore();
  let key,age;
  if(time<.16){key=outward;age=svg.getCurrentTime()<2 ? time : time+.21;}
  else if(time>=.38&&time<.55){key='A';age=time-.38;}
  else if(time>=.79){key=outward==='D'?'E':'D';age=time-.79;}
  if(key){
    const scale=guideGrid.bank.scale*guideGrid.zoom/(density*shakerPixel);
    const [kx,ky]=key==='A'?[39,155]:rightRimCorner(key,220,155+strokeTargets[key].y*.5,scale);
    guidePaint.save();guidePaint.translate(kx,ky);
    guidePaint.scale(.8,.8);drawReadyKey(guidePaint,key,0,0,age*2000);
    guidePaint.restore();
  }
}
