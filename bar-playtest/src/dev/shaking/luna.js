// The supplied sheet has eight 1280×720 cells at 12 fps. Keep one registration
// rectangle for all eight poses, including the fully extended hands.
const lunaSheet = document.getElementById('luna-shake-sheet');
const lunaFrameWidth = 1280, lunaHeight = 720, lunaCropX = 374, lunaWidth = 570;
const lunaFrameMs = 1000/12;
const lunaCels = new Array(8);
const tinCenters = [[716,275],[793,230],[808,208],[800,236],[716,275],[803,360],[827,353],[809,361]];
const lv = document.getElementById('lv'), lc = lv.getContext('2d');

// Upload only actor-sized textures to the GPU. The original PNG can also be
// painted directly on the first frame while a browser prepares its bitmaps.
if (typeof createImageBitmap === 'function') {
  lunaSheet.decode().then(() => Promise.all(tinCenters.map(async (_,i) => {
    lunaCels[i] = await createImageBitmap(lunaSheet,i*lunaFrameWidth+lunaCropX,0,lunaWidth,lunaHeight);
  }))).catch(() => { /* drawLuna uses the same PNG cell when bitmap cropping is unavailable. */ });
}

function lunaStrokeFrame(now) {
  const motion = S.lunaMotion;
  if (!motion) return 0;
  const index = Math.max(0, Math.floor((now-motion.t)/lunaFrameMs));
  return motion.frames[Math.min(index,motion.frames.length-1)];
}

// Source order is chest → high extension → chest → low extension → chest.
// On a reversal, begin at the cel already on screen.
const lunaReturns = [[0],[1,0],[2,3,4],[3,4],[4],[5,4],[6,7,0],[7,0]];
function beginLunaStroke(key) {
  const current = lunaStrokeFrame(GT);
  let frames = lunaReturns[current];
  if (key !== 'A') {
    const end = key === 'E' ? 2 : 6;
    if (current === end) frames = [end];
    else if (Math.abs(current-end) === 1) frames = [current,end];
    else frames = [...frames,end-1,end];
  } else if (frames.length === 1) {
    // A pull from rest still has a short anticipation and settles at the chest.
    frames = [current,current === 0 ? 7 : 3,current];
  }
  S.lunaMotion = {t:GT,input:key,frames};
}
function lunaStrokePulse(now) {
  const motion = S.lunaMotion;
  if (!motion || !['shake','unseal'].includes(S.phase)) return 0;
  if (S.label?.g === 'miss' && S.label.t >= motion.t) return 0;
  const elapsed = now-motion.t-(motion.frames.length-1)*lunaFrameMs;
  return elapsed >= 0 && elapsed < 160 ? Math.sin(elapsed/160*Math.PI)*(motion.input==='A' ? .4 : .75) : 0;
}
function lunaPose(now) {
  if (S.pop) return lunaStrokeFrame(S.pop.t);
  if (S.phase==='shake' || S.unseal) return lunaStrokeFrame(now);
  if (S.phase==='close' && S.closeQ && now-S.slapT < lunaFrameMs) return 1;
  return 0;
}
function fitLunaCanvas(display) {
  const rect = lv.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const w = Math.max(1,Math.round(rect.width*display.sx)), h = Math.max(1,Math.round(rect.height*display.sy));
  if (lv.width!==w || lv.height!==h) { lv.width=w; lv.height=h; }
}
function drawLuna(now) {
  const w=lv.width, h=lv.height;
  lc.clearRect(0,0,w,h);
  if (!S.closeQ) return;
  const frame=lunaPose(now);
  // V1's portrait uses source rect [350, 0, 650, 600], centered on x=675.
  const scale=h/600;
  const dw=Math.round(lunaWidth*scale), dh=Math.round(lunaHeight*scale);
  const x=Math.round(w/2-(675-lunaCropX)*scale), y=0;
  lc.imageSmoothingEnabled = !Number.isInteger(scale);
  lc.imageSmoothingQuality = 'high';
  if (lunaCels[frame]) lc.drawImage(lunaCels[frame],x,y,dw,dh);
  else if (lunaSheet.naturalWidth) lc.drawImage(lunaSheet,frame*lunaFrameWidth+lunaCropX,0,lunaWidth,lunaHeight,x,y,dw,dh);

  const [cx,cy]=tinCenters[frame], px=x+(cx-lunaCropX)*scale, py=y+cy*scale;
  function glow(radius,color) {
    const r=radius*scale, glow=lc.createRadialGradient(px,py,0,px,py,r);
    glow.addColorStop(0,color);glow.addColorStop(1,'rgba(0,0,0,0)');
    lc.fillStyle=glow;lc.fillRect(px-r,py-r,2*r,2*r);
  }
  if (S.chill>5) glow(150,'rgba(160,228,246,'+S.chill/100*.28+')');
  const pulse=lunaStrokePulse(now);
  if (pulse>0) glow(100,'rgba(255,244,214,'+pulse+')');
  const miss=S.label?.g==='miss' && now-S.label.t<300;
  if (miss || S.phase==='pop') {
    const opacity=S.phase==='pop' ? Math.max(0,.35-(now-S.pop.t)/4000) : .18*(1-(now-S.label.t)/300);
    lc.fillStyle='rgba(255,70,70,'+opacity+')';lc.fillRect(0,0,w,h);
  }
}
