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
 const sp=anim.frames[Math.floor(model.animTime*anim.fps)%anim.frames.length];
 return actorReflection(ctx,model,cam,plane,{sp,x:model.x,y:model.y,sx:1,sy:1,flip:model.facing>0,reference},images,factor);
}
function actorReflection(ctx,model,cam,plane,view,images,factor){
 const {sp,x,y,sx=1,sy=1,flip=false,alpha=1,reference=sp}=view,image=images.get(sp.asset);
 const bounds=W.LunaOutsideAmbient.bounds(reference);if(!image||!bounds)return false;
 const p=W.LunaPixelCamera.sprite(sp,x,y,sx,sy,flip,cam,{factor});
 if(p.x+p.w<0||p.x-p.w>1280)return false;
 const scale=1280/cam.w,footScreen=p.y+(bounds.bottom-reference.h*(1-reference.pivot.y))/reference.ppu*scale*Math.abs(sy);
 const footWorld=cam.y+(360-footScreen)/scale;
 // Upper corridors and raised/elevator actors are not standing in this road.
 if(footWorld>plane.line+.35||footWorld<plane.line-.7)return false;
 const sourceFoot=plane.line+(plane.line-footWorld)/plane.reflectionCompression;
 const mirroredFoot=W.LunaPixelCamera.position(x,sourceFoot,cam).y;
 // Foreshortening on the shallow road, shared by every pool. Using the idle
 // contact plane keeps it steady while individual run frames lift their feet.
 const compression=.22/plane.reflectionCompression,top=p.y-p.h*(1-sp.pivot.y);
 ctx.save();ctx.beginPath();ctx.rect(0,0,1280,Math.max(0,mirroredFoot));ctx.clip();
 const facing=(sx<0)!==flip;
 ctx.globalAlpha=.82*alpha;ctx.translate(p.x,mirroredFoot);ctx.scale(facing?-1:1,compression);
 const lit=W.LunaCharacterLighting?.shade(model,image,sp,x,y,p.w/scale,p.h/scale,facing,view.node);
 if(lit)ctx.drawImage(lit.image,lit.x,lit.y,lit.w,lit.h,-p.w*sp.pivot.x,top-footScreen,p.w,p.h);
 else ctx.drawImage(image,sp.x,sp.y,sp.w,sp.h,-p.w*sp.pivot.x,top-footScreen,p.w,p.h);ctx.restore();
 return true;
}
function actorViews(model,nodes){
 const layer=D().sortingLayers?.GroundPuddle??10;
 const views=(model.engineActorViews||[]).filter(p=>p.layer>=layer);
 // Static scene citizens use the same frame selector and visibility rules as
 // the main pass. Story-owned command actors above already contain their pose.
 for(const n of nodes){
  if(n.layer<layer||n.layer>12||!n.active||n.engineDraw||!n.ambient||!W.LunaOutsideContent.visibleNode(model,n)||!W.LunaOutsideAmbient.visible(model,n))continue;
  views.push({sp:W.LunaOutsideAmbient.frame(n,model.time),x:n.x,y:n.y,sx:n.sx,sy:n.sy,
   flip:W.LunaOutsideAmbient.facing(n,model),alpha:n.alpha??1,layer:n.layer,order:n.order,node:n});
 }
 return views.sort((a,b)=>a.layer-b.layer||a.order-b.order);
}
function beforeNode(ctx,model,cam,node,nodes,images,position){
 const s=state(model);if(model.qa||model.scene!=='street')return;
 // Respect the engine's BackgroundFar / BackgroundMid / CityLight boundaries.
 while(s.fogIndex<D().fog.length&&node.layer>=(D().sortingLayers?.[D().fog[s.fogIndex].layer]??s.fogIndex+2)){
  const f=D().fog[s.fogIndex++],target=nodes.find(n=>n.name===f.target);if(!target)continue;
  const p=W.LunaStreetParallax?.position(target,model)||target,sp=target.sprite;
  const width=sp.w/sp.ppu*Math.abs(target.sx),center=p.x+width*(.5-sp.pivot.x);
  const bottom=f.groundY-1,top=f.groundY+f.height;
  render(s,r=>r.fog(ctx,cam,f,[center,(bottom+top)/2,width,top-bottom],s.time));
 }
 if(!s.paintedPools&&node.layer>=(D().sortingLayers?.GroundPuddle??10)){
  s.paintedPools=true;
  render(s,r=>r.shafts(ctx,cam,D().shafts,s.time));
  render(s,r=>r.puddles(ctx,cam,s.pools,p=>p.ripples,(c,plane)=>{
   c.imageSmoothingEnabled=false;
   for(const view of actorViews(model,nodes))actorReflection(c,model,cam,plane,view,images,ctx.canvas.width/1280);
   playerReflection(c,model,cam,plane,images,ctx.canvas.width/1280);
   const names=new Set(plane.reflectors.map(n=>n==='near_foreground_2'?'residence-railing':n));
   for(const n of nodes.filter(n=>names.has(n.name)&&n.active!==false).sort((a,b)=>a.layer-b.layer||a.order-b.order)){
    const sp=n.sprite,image=images.get(sp.asset);if(!image)continue;
    let y=n.y;if(n.ancestry?.includes('Elevator'))y+=model.elevatorY-W.LunaResidence.layout.elevatorBottom;
    const p=position(n.x,y),scale=1280/cam.w,w=sp.w/sp.ppu*Math.abs(n.sx)*scale,h=sp.h/sp.ppu*Math.abs(n.sy)*scale;
    c.save();c.translate(p.x,p.y);c.scale((n.sx<0)!==!!n.flip?-1:1,n.sy<0?-1:1);c.drawImage(image,sp.x,sp.y,sp.w,sp.h,-w*sp.pivot.x,-h*(1-sp.pivot.y),w,h);c.restore();
   }
  }));
 }
}
function post(ctx,model){if(model.scene!=='street'||model.qa)return false;return render(state(model),r=>r.post(ctx,D().bloom));}
W.LunaStreetAtmosphere={begin,beforeNode,post,advance,playerReflection,actorReflection,actorViews,inspect:model=>states.get(model)||null};
})(typeof window==='undefined'?globalThis:window);
