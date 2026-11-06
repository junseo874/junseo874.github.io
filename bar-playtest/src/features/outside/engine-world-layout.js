/* Unity owns placement; the web asset registry still owns the current artwork.
 * Do not load engine snapshot assets as textures: they may be older PNGs.
 */
(function(W){
'use strict';
const source=W.LUNA_ENGINE_WORLD;
if(!source)return;
const scene=name=>source.scenes[name];
const node=(name,id)=>scene(name).nodes.find(n=>n.id===String(id));
const point=(name,path)=>scene(name).named[path];
const actor=(name,event,role)=>scene(name).actors[event]?.[role];
const target=(name,id)=>scene(name).targets[id];
function actorPoint(name,event,role,fallback){const a=actor(name,event,role);return a?{x:a.root.x,y:a.root.y}:fallback;}
function actorPose(name,event,role,sp,x,y,flip=false,alpha=1){
 const a=actor(name,event,role);if(!a)return{sp,x,y,sx:1,sy:1,flip,alpha,layer:12,order:5};
 let sprite={...sp},sx=Math.hypot(a.visual.a,a.visual.b),sy=Math.hypot(a.visual.c,a.visual.d);
 // Latest full-cell web sheets and Unity's tight slices are the same pixels.
 // Cropping the cell (not stretching its transparent padding) preserves feet.
 if(sp.asset.startsWith('ambient-')){
  const sheet=source.spriteSheets.find(s=>s.asset===a.sprite.asset);
  const frames=Object.entries(sheet.frames).filter(([id])=>id!=='21300000').map(([,f])=>f).sort((a,b)=>a.x-b.x);
  const frame=frames[Math.floor(sp.x/129)%frames.length];
  if(frame)sprite={...sprite,...frame,ppu:a.sprite.ppu,engineFrames:frames};
 }else{
  sx*=a.sprite.w/a.sprite.ppu/(sp.w/sp.ppu);sy*=a.sprite.h/a.sprite.ppu/(sp.h/sp.ppu);
  sprite.pivot={...a.sprite.pivot};
 }
 return{sp:sprite,x:x+a.visual.x-a.root.x,y:y+a.visual.y-a.root.y,sx,sy,flip,alpha,layer:a.layer,order:a.order,engineActor:{scene:name,event,role},root:{x,y}};
}
function drawActor(draw,name,event,role,sp,x,y,flip=false,alpha=1){
 const p=actorPose(name,event,role,sp,x,y,flip,alpha);
 draw({...p.sp,engineActor:p.engineActor,engineLayer:p.layer,engineOrder:p.order},p.x,p.y,p.sx,p.sy,p.flip,p.alpha);
}
// Generate render commands before drawing any background. A late overlay pass
// would silently undo Unity sorting (notably actors on Default/order 100).
function actorNodes(m,draw,ctx,position,images,glow){
 if(m.qa)return[];
 const result=[];m.engineActorViews=[];
 const capture=(sp,x,y,sx=1,sy=1,flip=false,alpha=1)=>{
  const view={sp,x,y,sx,sy,flip,alpha,engineActor:sp.engineActor};m.engineActorViews.push(view);
  result.push({id:'engine-actor-'+result.length,name:sp.lightingId||sp.engineActor?.role||'web-actor',layer:sp.engineLayer??14,order:sp.engineOrder??0,z:0,engineDraw:()=>draw(sp,x,y,sx,sy,flip,alpha)});
 };
 for(const p of W.LunaOutsideNeighborhood.poses(m))capture({...p.sp,lightingId:p.id,engineActor:p.engineActor,engineLayer:p.layer,engineOrder:p.order},p.x,p.y,p.sx??p.scale,p.sy??p.scale,p.flip,p.alpha);
 const cat=actor(m.scene,m.scene==='home'?'neighborhood-homeCat':'neighborhood-reveal','boobi');
 if(cat)result.push({id:'engine-cat',name:'boobi',layer:cat.layer,order:cat.order,z:0,engineDraw:()=>W.LunaOutsideNeighborhood.draw(m,draw,ctx,position,images,glow,true)});
 if(m.scene==='street'){
  W.LunaOutsideThug.draw(m,capture,ctx,position);
  W.LunaOutsideNotion.draw(m,capture,ctx,position);
  W.LunaOutsideSamhoCommute.draw(m,capture);
  for(const n of W.LUNA_OUTSIDE_DATA.scenes.street.nodes.filter(n=>n.tradeActor))W.LunaOutsideEncounters.drawNode(m,n,capture);
  if(W.LunaOutsideShop.visible(m)){
   const a=W.LUNA_OUTSIDE_DATA.animations.shiba,p=actorPoint('street','shiba-shop','shiba');
   drawActor(capture,'street','shiba-shop','shiba',a.frames[W.LunaOutsideAmbient.frameIndex(m.time,a.frames.length)],p.x,p.y);
  }
 }
 return result;
}
function speechAnchor(m,id){
 const role=({'trade-samho':'samho','trade-smuggler':'dealer','contract-samho':'samho','contract-smuggler':'dealer','day1-corridor-thug':'thug','day2-corridor-thug':'thug','day2-thug-information':'thug'})[id]||id;
 const p=m.engineActorViews?.find(p=>p.engineActor?.role===role);
 return p?W.LunaOutsideAmbient.head(p.sp,p.x,p.y,p.sx,p.sy,p.flip):null;
}
function bounds(name){
 const s=scene(name),c=s.colliders.find(c=>c.id===s.cameras.confiner);
 const x=c.x+c.a*c.offset.x+c.c*c.offset.y,y=c.y+c.b*c.offset.x+c.d*c.offset.y;
 const w=Math.abs(c.a)*c.size.x+Math.abs(c.c)*c.size.y,h=Math.abs(c.b)*c.size.x+Math.abs(c.d)*c.size.y;
 return{left:x-w/2,right:x+w/2,bottom:y-h/2,top:y+h/2};
}
function confine(name,camera){
 const b=bounds(name),w=camera.w,h=w*9/16;
 const fit=(v,min,max,size)=>size>=max-min?(min+max)/2:Math.max(min+size/2,Math.min(max-size/2,v));
 return{...camera,x:fit(camera.x,b.left,b.right,w),y:fit(camera.y,b.bottom,b.top,h)};
}
function camera(name){
 const c=scene(name).cameras,ppu=c.pixel.m_AssetsPPU;
 return{width:c.controller.outSideResolution.x/ppu,offset:c.options.find(o=>o.cameraMode===0).cameraOffset,
  liftWidth:c.controller.baseResolution.x/ppu,lift:c.options.find(o=>o.cameraMode===1),return:c.options.find(o=>o.cameraMode===2),bounds:bounds(name)};
}
function curve(curve,t){
 const keys=curve.m_Curve;t=Math.max(0,Math.min(1,t));
 const b=keys.find(k=>k.time>=t)||keys[keys.length-1],i=keys.indexOf(b),a=keys[Math.max(0,i-1)];
 if(a===b)return b.value;
 const span=b.time-a.time,u=(t-a.time)/span,u2=u*u,u3=u2*u;
 return(2*u3-3*u2+1)*a.value+(u3-2*u2+u)*span*a.outSlope+(-2*u3+3*u2)*b.value+(u3-u2)*span*b.inSlope;
}
const liftRuns=new WeakMap();
function liftCamera(m){
 if(m.scene!=='street'||m.qa){liftRuns.delete(m);return null;}
 let run=liftRuns.get(m);
 if(run&&run.story!==m.story){liftRuns.delete(m);run=null;}
 if(m.ride&&!m.ride.call){
  if(!run||run.ride!==m.ride){run={ride:m.ride,story:m.story,start:m.time-m.ride.time};liftRuns.set(m,run);}
 }else if(m.ride?.call)return null;
 if(!run)return null;
 const c=camera('street'),e=scene('street').cameras.elevator,t=Math.max(0,m.time-run.start),backAt=e.duration*e.cameraReturnTiming;
 if(t>=backAt+c.return.resolutionDuration){liftRuns.delete(m);return confine('street',{x:m.x+c.offset.x,y:m.y+c.offset.y,w:c.width});}
 const returning=t>=backAt,o=returning?1-curve(c.return.offsetCurve,(t-backAt)/c.return.offsetDuration):curve(c.lift.offsetCurve,t/c.lift.offsetDuration);
 const z=returning?1-curve(c.return.resolutionCurve,(t-backAt)/c.return.resolutionDuration):curve(c.lift.resolutionCurve,t/c.lift.resolutionDuration);
 return confine('street',{x:m.x+c.lift.cameraOffset.x*o,y:m.elevatorY+c.lift.cameraOffset.y*o,w:c.width+(c.liftWidth-c.width)*z});
}
function transform(n,e,{size=false}={}){
 const sx=Math.hypot(e.a,e.b)*(e.a<0?-1:1),sy=(e.a*e.d-e.b*e.c)/sx;
 Object.assign(n,{x:e.x,y:e.y,z:e.z,sx,sy,layer:e.layer,order:e.order,flip:e.flip,
  engineNode:e.id,placementSource:'engine',engineRotation:Math.atan2(e.b/sx,e.a/sx)});
 if(size){n.sx*=e.sprite.w/e.sprite.ppu/(n.sprite.w/n.sprite.ppu);n.sy*=e.sprite.h/e.sprite.ppu/(n.sprite.h/n.sprite.ppu);n.sprite={...n.sprite,pivot:{...e.sprite.pivot}};}
}
// Keep split room artwork registered to the door, not the centre of two
// differently cropped full-room canvases. New props inherit that local frame.
function homePlacement(layer,layers){
 const door=node('home','1183900665'),local=layers.find(l=>l.name==='Room_Entrance');
 const left=door.x-(local.x+local.w/2)/100,top=door.y+(local.y+local.h/2)/100;
 const direct={Room_Entrance:'1183900665',Terrace_Entrance:'220094232',Hanger:'1144763783',IntractObjects:'289449519','home-bedding':'2030127651','home-herb':'463204427',ForeFore_Object:'953149914'};
 const e=node('home',direct[layer.name]);
 if(e)return{x:e.x,y:e.y,layer:e.layer,order:e.order,engineNode:e.id,placementSource:'engine'};
 if(layer.name==='home-tv-screen'){
  const tv=node('home','289449519'),base=layers.find(l=>l.name==='IntractObjects');
  return{x:tv.x+(layer.x+layer.w/2-base.x-base.w/2)/100,y:tv.y-(layer.y+layer.h/2-base.y-base.h/2)/100,layer:tv.layer,order:tv.order+.01,engineNode:tv.id,placementSource:'web-child'};
 }
 if(layer.name==='home-book'){
  const table=node('home','953149914'),base=layers.find(l=>l.name==='ForeFore_Object');
  return{x:table.x+(layer.x+layer.w/2-base.x-base.w/2)/100,y:table.y-(layer.y+layer.h/2-base.y-base.h/2)/100,layer:table.layer,order:table.order+.01,engineNode:table.id,placementSource:'web-child'};
 }
 return{x:left+(layer.x+layer.w/2)/100,y:top-(layer.y+layer.h/2)/100,layer:0,order:layer.name==='home-city'?-1:layer.name==='main_bg'?0:['ForeFore_Object','home-book'].includes(layer.name)?10:1,engineNode:door.id,placementSource:'web-room-frame'};
}
function residence(){
 const home=point('street','04.Gameplay/HomeSpawn'),top=point('street','04.Gameplay/InteractionObjects/Elevator/TopPoint'),bottom=point('street','04.Gameplay/InteractionObjects/Elevator/BottomPoint');
 // Passenger movement in Unity adds the platform delta, never rescales Luna.
 const bar=point('street','04.Gameplay/BarSpawn'),offset=bar.y-bottom.y;
 return{homeX:home.x,upperY:home.y,elevatorX:bottom.x,elevatorBottom:bottom.y,elevatorTop:top.y,passengerOffset:offset};
}
function applyStreet(data){
 if(data.engineWorldVersion===source.version)return data;
 for(const n of data.scenes.street.nodes){
  const e=node('street',n.id);if(!e)continue;
  // Story conditions, current animation sheets and web effect implementations
  // remain owned by their modules. Only authored placement is replaced here.
  if(n.name==='Elevator')n.sprite={...n.sprite,x:0,y:0,w:69,h:154};
  transform(n,e,{size:n.ancestry.includes('Elevator')});
 }
 data.scenes.street.nodes=data.scenes.street.nodes.filter(n=>n.name!=='Elevator Connector');
 const nodes=data.scenes.street.nodes,building=nodes.find(n=>n.name==='residence-building'),rail=nodes.find(n=>n.name==='residence-railing');
 // The latest web barrel is split into back/flame/front, unlike the current
 // engine atlas. Keep the split children attached to its engine-aligned root.
 const back=nodes.find(n=>n.name==='B_Obects'),fire=W.LUNA_BARREL_FIRE;
 if(back&&fire)for(const [name,part,order]of[['barrel-fire',fire.fire,.01],['barrel-front',fire.front,.02]]){
  const n=nodes.find(n=>n.name===name);if(!n||n.placementSource==='engine')continue;
  const rx=back.sx/fire.back.sx,ry=back.sy/fire.back.sy;
  Object.assign(n,{x:back.x+(part.x-fire.back.x)*rx,y:back.y+(part.y-fire.back.y)*ry,sx:part.sx*rx,sy:part.sy*ry,
   layer:back.layer,order:back.order+order,engineNode:back.engineNode,placementSource:'web-child'});
 }
 if(building){
  const e=node('street','1151976387');
  const oldLeft=building.x,oldTop=building.y;
  transform(building,e,{size:true});
  if(rail)transform(rail,node('street','647539757'),{size:true});
  const left=building.x-building.sprite.w*building.sprite.pivot.x/100*building.sx;
  const top=building.y+building.sprite.h*(1-building.sprite.pivot.y)/100*building.sy;
  for(const n of nodes.filter(n=>['residence-warm-light','residence-home-light'].includes(n.name))){n.x+=left-oldLeft;n.y+=top-oldTop;n.placementSource='web-building-child';n.engineNode=e.id;}
 }
 data.engineWorldVersion=source.version;return data;
}
function exportLayout(data){
 const kinds={neighbor:'Neighbor',repair:'Repairman',guard:'Gang1',boss:'Gang5',gangmate:'Gang3',chris:'Chris',thug:'Neighbor',dealer:'M1'};
 const actors=Object.fromEntries(Object.entries(source.scenes).map(([name,s])=>[name,Object.fromEntries(Object.entries(s.actors).map(([event,group])=>[event,Object.fromEntries(Object.entries(group).map(([role,a])=>{
  if(role==='boobi')return[role,{root:a.root,visual:a.visual,layer:a.layer,order:a.order,art:'web-procedural-cat',height:a.sprite.h/a.sprite.ppu*Math.hypot(a.visual.c,a.visual.d)}];
  const sp=role==='samho'?W.LunaSamhoAnimation.frame(0):role==='shiba'?data.animations.shiba.frames[0]:W.LunaOutsideAmbient.sprite(kinds[role],0);
  const p=actorPose(name,event,role,sp,a.root.x,a.root.y,a.flip);
  return[role,{...p,src:data.assets[sp.asset].src}];
 }))]))]));
 return{version:source.version,artPolicy:'latest-web-images',sourceFiles:source.sources,
  notes:['Engine actor position, size and sorting are intentional, including Default-layer actors occluded by the street background.','New split house artwork is registered to the engine door; web-only objects retain their local authored offsets.','Scene examples and engine-only dialogue content are not imported into the web story.'],
  scenes:Object.fromEntries(Object.entries(data.scenes).map(([name,s])=>[name,{camera:camera(name),
   nodes:s.nodes.map(n=>({id:n.id,name:n.name,x:n.x,y:n.y,z:n.z,sx:n.sx,sy:n.sy,rotation:n.engineRotation??0,layer:n.layer,order:n.order,flip:n.flip,sprite:n.sprite,src:data.assets[n.sprite?.asset]?.src,engineNode:n.engineNode??null,placementSource:n.placementSource??'web-only'}))}])),
  actorAlignmentStatus:'engine-position-scale-and-sorting',actors,
  engineActorReference:Object.fromEntries(Object.entries(source.scenes).map(([name,s])=>[name,s.actors])),
  terrace:{camera:source.scenes.home.cameras.views.find(c=>c.name==='CM_Terrace'),nodes:source.scenes.home.nodes.filter(n=>['Terrace','Terrace_BG_City','Terrace_0','balustrade'].includes(n.name))}};
}
W.LunaEngineWorld={source,node,point,actor,target,actorPoint,actorPose,drawActor,actorNodes,speechAnchor,bounds,confine,camera,curve,liftCamera,transform,homePlacement,residence,applyStreet,exportLayout};
})(typeof window==='undefined'?globalThis:window);
