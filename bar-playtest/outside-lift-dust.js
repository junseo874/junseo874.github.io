/* One-shot landing dust, in the lift's own native pixel grid. */
(function(W){'use strict';
const duration=1.45,fps=24,width=192,height=56,floor=44,center=96;
const impacts=new WeakMap(),landed=new WeakSet(),frames=new Map();
function reset(model){impacts.delete(model);}
function land(model,ride){
 if(model.scene!=='street'||model.qa||landed.has(ride)||ride.from<=ride.to||Math.abs(ride.to-W.LunaResidence.layout.elevatorBottom)>.001)return false;
 landed.add(ride);
 // Contact is .65s before the ride releases the controls. Preserve subframe
 // overshoot so different frame rates agree on the exact impact time.
 impacts.set(model,{at:model.time-Math.max(0,ride.time-ride.duration-.45)});return true;
}
function age(model){
 const impact=impacts.get(model);if(!impact||model.scene!=='street'||model.qa)return null;
 const t=model.time-impact.at;return t>=0&&t<duration?t:null;
}
function render(time){
 if(time<0||time>=duration)return null;
 const frame=Math.floor(time*fps);if(frames.has(frame))return frames.get(frame);
 const t=frame/fps,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height),field=new Float32Array(width*height);
 for(const side of [-1,1])for(let i=0;i<5;i++){
  const a=t-i*.035;if(a<=0)continue;
  const u=Math.min(1,a/duration),push=1-Math.exp(-a*3.1),fade=Math.min(1,a/.1)*Math.pow(1-u,1.65);
  const x=center+side*(28+push*(17+i*6)*(side<0?1:.94));
  const y=floor-2-push*(i%3?5+i*1.8:1.5)-Math.sin(i*2+side)*push;
  const rx=2+push*(5+i*.8),ry=1.5+push*(2.5+i*.8);
  for(let py=Math.max(0,Math.floor(y-ry*1.7));py<=floor;py++)for(let px=Math.max(0,Math.floor(x-rx*1.7));px<Math.min(width,Math.ceil(x+rx*1.7));px++){
   const d=((px+.5-x)/rx)**2+((py+.5-y)/ry)**2;
   if(d<2.8)field[py*width+px]+=fade*Math.exp(-d*1.7)*(.58+i*.035);
  }
 }
 for(let y=0;y<=floor;y++)for(let x=0;x<width;x++){
  const d=field[y*width+x]*(.86+.14*Math.sin(x*.67+y*.48-t*3));if(d<.06)continue;
  const i=(y*width+x)*4;image.data[i]=137;image.data[i+1]=150;image.data[i+2]=156;
  image.data[i+3]=d<.22?16:d<.55?34:57;
 }
 ctx.putImageData(image,0,0);frames.set(frame,canvas);return canvas;
}
function paintSprite(ctx,model,key,sp,w,h,reduced=false){
 if(key!=='Elevator Fore'||reduced)return;
 const t=age(model);if(t===null)return;const canvas=render(t);if(!canvas)return;
 const sx=w/sp.w,sy=h/sp.h;
 // Front art is 6px right / 9px above the body bottom. Match the body,
 // not the passenger foot or the camera, and keep all dust above ground.
 const liftOffset=(model.elevatorY-W.LunaResidence.layout.elevatorBottom)*sp.ppu;
 const x=-w*sp.pivot.x+w*.5-(center+6)*sx,y=h*sp.pivot.y+(9-floor+liftOffset)*sy;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
 ctx.drawImage(canvas,x,y,width*sx,height*sy);ctx.restore();
}
W.LunaLiftDust={land,reset,age,render,paintSprite,duration,fps};
})(window);
