/* Street-only orchestration. Render order: skyline / fog layers / shops /
 * reflection capture / puddles / actors / foreground / rain / bloom / lens water. */
(function(W){'use strict';
const states=new WeakMap(),D=()=>W.LUNA_STREET_ATMOSPHERE;
const random=(seed,index)=>{let x=(seed^Math.imul(index+1,0x9e3779b9))>>>0;x^=x>>>16;x=Math.imul(x,0x21f0aaad);x^=x>>>15;x=Math.imul(x,0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296;};
function createPools(){return D().puddles.map(p=>({...p,phase:0,index:0,ripples:new Float32Array(64).fill(-1)}));}
function state(model){let s=states.get(model);if(!s){s={pools:createPools(),lastTime:null,time:0,renderer:null,error:null};states.set(model,s);}return s;}
function advance(model){
 const s=state(model),now=model.time||0;
 if(s.lastTime!==null&&now<s.lastTime){s.pools=createPools();s.time=0;}
 const dt=s.lastTime===null?0:Math.min(.1,Math.max(0,now-s.lastTime));s.lastTime=now;
 if(W.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return s;
 s.time+=dt;const raining=!!W.LunaOutsideRain?.enabled(model);
 for(const p of s.pools){
  for(let i=0;i<64;i+=4)if(p.ripples[i+2]>=0){p.ripples[i+2]+=dt;if(p.ripples[i+2]>=1.25)p.ripples[i+2]=-1;}
  if(!raining){p.phase=0;continue;}p.phase+=dt*p.dropsPerSecond;
  while(p.phase>=1){p.phase--;const n=p.index++,at=(n%16)*4,angle=random(p.seed,n*3)*Math.PI*2,radius=Math.sqrt(random(p.seed,n*3+1))*.78;
   p.ripples[at]=.5+Math.cos(angle)*radius*.5;p.ripples[at+1]=.5+Math.sin(angle)*radius*.5;p.ripples[at+2]=0;p.ripples[at+3]=.8+random(p.seed,n*3+2)*.4;
  }
 }return s;
}
function render(s,fn){if(s.error)return false;try{if(!s.renderer)s.renderer=new W.LunaStreetAtmosphereRenderer();if(s.renderer.gl.isContextLost())return false;fn(s.renderer);return true;}catch(e){s.error=e.message;console.warn('Street atmosphere unavailable:',e.message);return false;}}
function begin(model){if(model.scene!=='street'||model.qa)return null;const s=advance(model);s.fogIndex=0;s.paintedPools=false;return s;}
// Reproject the current animation into the background capture's mirror space.
// Its own mirror starts at the visible soles, not the building/fence baseline.
function playerReflection(ctx,model,cam,plane,images,factor){
 if(model.level!==0||model.ride&&!model.ride.call||model.scene!=='street'||model.qa)return false;
 const animations=W.LUNA_OUTSIDE_DATA.animations,anim=animations[model.anim],reference=animations.idle.frames[0];
 const sp=anim.frames[Math.floor(model.animTime*anim.fps)%anim.frames.length],image=images.get(sp.asset);
 const bounds=W.LunaOutsideAmbient.bounds(reference);if(!image||!bounds)return false;
 const flip=model.facing>0,p=W.LunaPixelCamera.sprite(sp,model.x,model.y,1,1,flip,cam,{factor});
 const scale=1280/cam.w,footScreen=p.y+(bounds.bottom-reference.h*(1-reference.pivot.y))/reference.ppu*scale;
 const footWorld=cam.y+(360-footScreen)/scale;
 const sourceFoot=plane.line+(plane.line-footWorld)/plane.reflectionCompression;
 const mirroredFoot=W.LunaPixelCamera.position(model.x,sourceFoot,cam).y;
 // Foreshortening on the shallow road, shared by every pool. Using the idle
 // contact plane keeps it steady while individual run frames lift their feet.
 const compression=.22/plane.reflectionCompression,top=p.y-p.h*(1-sp.pivot.y);
 ctx.save();ctx.beginPath();ctx.rect(0,0,1280,Math.max(0,mirroredFoot));ctx.clip();
 ctx.globalAlpha=.82;ctx.translate(p.x,mirroredFoot);ctx.scale(flip?-1:1,compression);
 ctx.drawImage(image,sp.x,sp.y,sp.w,sp.h,-p.w*sp.pivot.x,top-footScreen,p.w,p.h);ctx.restore();
 return true;
}
function beforeNode(ctx,model,cam,node,nodes,images,position){
 const s=state(model);if(model.qa||model.scene!=='street')return;
 // The web snapshot predates GroundPuddle/GroundShadow sorting-layer additions.
 // Existing sky=1, far=2, mid=3, near=4; preserve all gameplay layer numbers.
 while(s.fogIndex<3&&node.layer>=s.fogIndex+2){
  const f=D().fog[s.fogIndex++],target=nodes.find(n=>n.name===f.target);if(!target)continue;
  const p=W.LunaStreetParallax?.position(target,model)||target,sp=target.sprite;
  const width=sp.w/sp.ppu*Math.abs(target.sx),center=p.x+width*(.5-sp.pivot.x);
  const bottom=f.groundY-1,top=f.groundY+f.height;
  render(s,r=>r.fog(ctx,cam,f,[center,(bottom+top)/2,width,top-bottom],s.time));
 }
 if(!s.paintedPools&&node.layer>=9){
  s.paintedPools=true;
  render(s,r=>r.shafts(ctx,cam,D().shafts,s.time));
  render(s,r=>r.puddles(ctx,cam,s.pools,p=>p.ripples,(c,plane)=>{
   c.imageSmoothingEnabled=false;
   playerReflection(c,model,cam,plane,images,ctx.canvas.width/1280);
   const names=new Set(D().puddles[0].reflectors.map(n=>n==='near_foreground_2'?'residence-railing':n));
   for(const n of nodes.filter(n=>names.has(n.name)&&n.active!==false)){
    const sp=n.sprite,image=images.get(sp.asset);if(!image)continue;
    let y=n.y;if(n.ancestry?.includes('Elevator'))y+=model.elevatorY-W.LunaResidence.layout.elevatorBottom;
    const p=position(n.x,y),scale=1280/cam.w,w=sp.w/sp.ppu*Math.abs(n.sx)*scale,h=sp.h/sp.ppu*Math.abs(n.sy)*scale;
    c.save();c.translate(p.x,p.y);c.scale((n.sx<0)!==!!n.flip?-1:1,n.sy<0?-1:1);c.drawImage(image,sp.x,sp.y,sp.w,sp.h,-w*sp.pivot.x,-h*(1-sp.pivot.y),w,h);c.restore();
   }
  }));
 }
}
function post(ctx,model){if(model.scene!=='street'||model.qa)return false;return render(state(model),r=>r.post(ctx,D().bloom));}
W.LunaStreetAtmosphere={begin,beforeNode,post,advance,playerReflection,inspect:model=>states.get(model)||null};
})(typeof window==='undefined'?globalThis:window);
