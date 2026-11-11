/* Unity owns placement; the web asset registry still owns the current artwork.
 * Do not load engine snapshot assets as textures: they may be older PNGs.
 */
(function(W){
'use strict';
const source=W.LUNA_ENGINE_WORLD;
// User-approved cabin framing: lower the whole moving shell by 18 native pixels.
// Passenger/spawn/camera anchors and the stationary support rail stay unchanged.
const cabinOffsetY=-.18;
if(!source)return;
const scene=name=>source.scenes[name];
const node=(name,id)=>scene(name).nodes.find(n=>n.id===String(id));
const point=(name,path)=>scene(name).named[path];
const actor=(name,event,role)=>scene(name).actors[event]?.[role];
const target=(name,id)=>scene(name).targets[id];
function actorPoint(name,event,role,fallback){
 const a=actor(name,event,role);if(!a)return fallback;
 // Event roots on the upper corridor used an older player spawn height.
 // Keep the authored door X, but put human soles on Luna's current walk plane.
 const y=name==='street'&&role!=='boobi'&&a.root.y>5?residence().upperY-.274:a.root.y;
 const nextDoor=name==='street'&&['day2-corridor-thug','day2-thug-information'].includes(event);
 const x=nextDoor?actor('street','neighborhood-reveal','neighbor').root.x:a.root.x;
 return{x,y};
}
function actorSorting(name,role,layer,order){
 // Default-layer event actors otherwise render behind the opaque world art.
 // Preserve genuine authored foreground layers; correct only that bad default.
 if(layer!==0)return{layer,order};
 const camp=name==='street'&&['guard','boss','gangmate'].includes(role);
 return{layer:camp?14:12,order:camp?0:4};
}
function actorPose(name,event,role,sp,x,y,flip=false,alpha=1){
 const a=actor(name,event,role);if(!a)return{sp,x,y,sx:1,sy:1,flip,alpha,layer:12,order:5};
 // Engine roots place the actors, not their old 1.7-unit auto-sized visuals.
 // Latest art shares Luna's 100 PPU: retain each full cell, its foot pivot and
 // the caller's frame exactly. Tight, variable-width engine slices re-centred
 // the breathing frames and magnified a 59px neighbor to ~170px (Luna: 53px).
 const visualY=role==='samho'?W.LunaSamhoAnimation.groundOrigin(sp,1,y-.274):role==='dealer'?y-.274:y;
 // Shiba's source pivot is at the left edge; the event root marks the counter
 // centre. Use a fixed rest-frame offset, never the current frame's width.
 const shiba=role==='shiba'&&W.LUNA_OUTSIDE_DATA.animations.shiba.frames[0];
 return{sp:{...sp},x:x-(shiba?shiba.w/shiba.ppu/2:0),y:visualY,sx:1,sy:1,flip,alpha,...actorSorting(name,role,a.layer,a.order),engineActor:{scene:name,event,role},root:{x,y}};
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
  const view={sp,x,y,sx,sy,flip,alpha,layer:sp.engineLayer??14,order:sp.engineOrder??0,engineActor:sp.engineActor};m.engineActorViews.push(view);
  result.push({id:'engine-actor-'+result.length,name:sp.lightingId||sp.engineActor?.role||'web-actor',layer:sp.engineLayer??14,order:sp.engineOrder??0,z:0,engineDraw:()=>draw(sp,x,y,sx,sy,flip,alpha)});
 };
 for(const p of W.LunaOutsideNeighborhood.poses(m))capture({...p.sp,lightingId:p.id,engineActor:p.engineActor,engineLayer:p.layer,engineOrder:p.order},p.x,p.y,p.sx??p.scale,p.sy??p.scale,p.flip,p.alpha);
 const cat=actor(m.scene,m.scene==='home'?'neighborhood-homeCat':'neighborhood-reveal','boobi');
 if(cat)result.push({id:'engine-cat',name:'boobi',...(m.scene==='home'?{layer:1,order:2}:actorSorting(m.scene,'boobi',cat.layer,cat.order)),z:0,engineDraw:()=>W.LunaOutsideNeighborhood.draw(m,draw,ctx,position,images,glow,true)});
 if(m.scene==='street'){
  W.LunaOutsideThug.draw(m,capture,ctx,position);
  W.LunaOutsideNotion.draw(m,capture,ctx,position);
  W.LunaOutsideSamhoCommute.draw(m,capture);
  for(const n of W.LUNA_OUTSIDE_DATA.scenes.street.nodes.filter(n=>n.tradeActor))W.LunaOutsideEncounters.drawNode(m,n,capture);
  if(W.LunaOutsideShop.visible(m)){
   const a=W.LUNA_OUTSIDE_DATA.animations.shiba,p=actorPoint('street','shiba-shop','shiba');
   drawActor(capture,'street','shiba-shop','shiba',a.frames[Math.floor(m.time*a.fps)%a.frames.length],p.x,p.y);
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
// Zero velocity/acceleration at the phase joins. Keep the authored endpoints,
// but interpolate perceived magnification rather than jumping camera modes.
function liftEase(t){t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);}
function liftBlend(a,b,t){
 if(t<=0)return{...a};if(t>=1)return{...b};
 const w=Math.exp(Math.log(a.w)+(Math.log(b.w)-Math.log(a.w))*t);
 const p=Math.abs(b.w-a.w)<1e-8?t:(w-a.w)/(b.w-a.w);
 return{x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,w};
}
function liftCamera(m,current){
 if(m.scene!=='street'||m.qa){liftRuns.delete(m);return null;}
 const c=camera('street'),r=residence(),normal=confine('street',{x:m.x+c.offset.x,y:m.y+c.offset.y,w:c.width});
 let run=liftRuns.get(m);
 if(run&&run.story!==m.story){liftRuns.delete(m);run=null;}
 if(m.ride&&!m.ride.call){
  if(!run||run.ride!==m.ride){run={ride:m.ride,story:m.story,start:m.time-m.ride.time,from:{...(current||normal)},normal:confine('street',{x:m.x+c.offset.x,y:m.elevatorY+r.passengerOffset+c.offset.y,w:c.width})};liftRuns.set(m,run);}
 }else if(m.ride?.call){liftRuns.delete(m);return null;}
 if(!run)return null;
 const e=scene('street').cameras.elevator,t=Math.max(0,m.time-run.start),backAt=e.duration*e.cameraReturnTiming;
 if(t>=backAt+c.return.resolutionDuration){liftRuns.delete(m);return normal;}
 const returnProgress=liftEase((t-backAt)/c.return.resolutionDuration);
 // HomeSpawn is slightly higher than the cabin passenger anchor. Reconcile
 // that offset over the return, not on the single frame boarding lock ends.
 const landingY=run.ride.to===r.elevatorTop?r.upperY:point('street','04.Gameplay/BarSpawn').y;
 const follow=confine('street',{x:m.x+c.offset.x,y:m.elevatorY+r.passengerOffset+c.offset.y+(landingY-run.ride.to-r.passengerOffset)*returnProgress,w:c.width});
 const wide=confine('street',{x:m.x+c.lift.cameraOffset.x,y:m.elevatorY+c.lift.cameraOffset.y,w:c.liftWidth});
 // Blend already-confined views: a hard clamp on the in-between camera used
 // to catch/release the floor abruptly during zoom. Match the blend to width.
 if(t>=backAt)return liftBlend(wide,follow,returnProgress);
 const from={x:run.from.x+follow.x-run.normal.x,y:run.from.y+follow.y-run.normal.y,w:run.from.w};
 return liftBlend(from,wide,liftEase(t/c.lift.resolutionDuration));
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
 const parent=layer.name==='home-tv-screen'?'IntractObjects':layer.name==='home-book'?'ForeFore_Object':null;
 const e=node('home',direct[parent||layer.name]);
 // The new table is 188×27, not the old 265×55 crop; TV is 54×40,
 // not 53×34. Their old image centres are not placement anchors. Register
 // every split prop to the same latest full-shot pixels as the room/door.
 return{x:left+(layer.x+layer.w/2)/100,y:top-(layer.y+layer.h/2)/100,
  layer:e?.layer??0,order:e?e.order+(parent ? .01 : 0):layer.name==='home-city'?-1:layer.name==='main_bg'?0:1,
  engineNode:e?.id??door.id,placementSource:layer.name==='Room_Entrance'?'engine':'web-room-frame'};
}
function residence(){
 const home=point('street','04.Gameplay/HomeSpawn'),top=point('street','04.Gameplay/InteractionObjects/Elevator/TopPoint'),bottom=point('street','04.Gameplay/InteractionObjects/Elevator/BottomPoint');
 // Passenger movement in Unity adds the platform delta, never rescales Luna.
 const bar=point('street','04.Gameplay/BarSpawn'),offset=bar.y-bottom.y;
 return{homeX:home.x,upperY:home.y,elevatorX:bottom.x,elevatorBottom:bottom.y,elevatorTop:top.y,passengerOffset:offset,cabinOffsetY};
}
function applyStreet(data){
 if(data.engineWorldVersion===source.version)return data;
 const storefront=data.scenes.street.nodes.find(n=>n.name==='B_Fore_Building_1');
 const previousStorefront=storefront&&{...storefront};
 for(const n of data.scenes.street.nodes){
  const e=node('street',n.id);if(!e)continue;
  // Story conditions, current animation sheets and web effect implementations
  // remain owned by their modules. Only authored placement is replaced here.
  if(n.name==='Elevator')n.sprite={...n.sprite,x:0,y:0,w:69,h:154};
  transform(n,e,{size:n.ancestry.includes('Elevator')});
  if(n.ancestry.includes('Elevator')&&['Elevator','Elevator Fore','Elevator Door'].includes(n.name)){n.y+=cabinOffsetY;n.placementSource='web-lift-framing';}
 }
 data.scenes.street.nodes=data.scenes.street.nodes.filter(n=>n.name!=='Elevator Connector');
 const nodes=data.scenes.street.nodes,building=nodes.find(n=>n.name==='residence-building'),rail=nodes.find(n=>n.name==='residence-railing');
 // These cookies are web renderers attached to the storefront, so they have
 // no numeric Unity renderer ID. Rebase them along with their receiver instead
 // of leaving their old position and sorting layer behind the opaque building.
 if(previousStorefront)for(const n of nodes.filter(n=>n.ancestry?.includes('StreetSigns'))){
  const rx=storefront.sx/previousStorefront.sx,ry=storefront.sy/previousStorefront.sy;
  Object.assign(n,{x:storefront.x+(n.x-previousStorefront.x)*rx,y:storefront.y+(n.y-previousStorefront.y)*ry,
   sx:n.sx*rx,sy:n.sy*ry,layer:storefront.layer,order:storefront.order+.01,
   engineNode:storefront.engineNode,placementSource:'web-child'});
 }
 if(storefront)nodes.push({...storefront,id:'street-storefront-scanlines',name:'street-storefront-scanlines',
  ancestry:['StreetEffects'],order:storefront.order+.02,scanlinesOnly:true,scanReceiver:storefront.name,
  placementSource:'web-child'});
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
  const oldLeft=building.x,oldTop=building.y,oldScaleX=building.sx,oldScaleY=building.sy;
  transform(building,e,{size:true});
  if(rail)transform(rail,node('street','647539757'),{size:true});
  const left=building.x-building.sprite.w*building.sprite.pivot.x/100*building.sx;
  const top=building.y+building.sprite.h*(1-building.sprite.pivot.y)/100*building.sy;
  for(const n of nodes.filter(n=>['residence-warm-light','residence-home-light'].includes(n.name))){
   const rx=building.sx/oldScaleX,ry=building.sy/oldScaleY;
   Object.assign(n,{x:left+(n.x-oldLeft)*rx,y:top+(n.y-oldTop)*ry,sx:n.sx*rx,sy:n.sy*ry,
    layer:building.layer,order:building.order+.01,placementSource:'web-building-child',engineNode:e.id});
  }
 }
 W.LunaWallLighting?.align(data);
 data.engineWorldVersion=source.version;return data;
}
function exportLayout(data){
 const kinds={neighbor:'Neighbor',repair:'Repairman',guard:'Gang1',boss:'Gang5',gangmate:'Gang3',chris:'Chris',thug:'Neighbor',dealer:'M1'};
 const actors=Object.fromEntries(Object.entries(source.scenes).map(([name,s])=>[name,Object.fromEntries(Object.entries(s.actors).map(([event,group])=>[event,Object.fromEntries(Object.entries(group).map(([role,a])=>{
  if(role==='boobi'){const b=W.LunaBubiArt?.box(),visual=name==='home'?W.LunaBubiArt?.sofa():b&&{x:b.x+.25,y:b.y};return[role,{root:a.root,visual:visual||a.root,...(name==='home'?{layer:1,order:2}:actorSorting(name,role,a.layer,a.order)),art:'native-bubi-sheet',height:.24}];}
  const sp=role==='samho'?W.LunaSamhoAnimation.frame(0):role==='shiba'?data.animations.shiba.frames[0]:W.LunaOutsideAmbient.sprite(kinds[role],0);
  const root=actorPoint(name,event,role),p=actorPose(name,event,role,sp,root.x,root.y,a.flip);
  return[role,{...p,src:data.assets[sp.asset].src}];
 }))]))]));
 return{version:source.version,artPolicy:'latest-web-images',sourceFiles:source.sources,
  notes:['NPCs use latest web frames and native 100 PPU proportions relative to Luna, not engine auto-sized visual children. Engine root positions and corrected walking layers remain; day2 information NPC shares the next-door neighbor anchor, not the cat perch.','All latest split house artwork shares its full-shot pixel offsets anchored to the engine door, including TV/screen and table/book.','Lift camera metadata retains engine endpoints/timing; liftCamera() uses quintic/log-scale interpolation and continuous passenger anchors instead of the original intermediate curves.','Scene examples and engine-only dialogue content are not imported into the web story.'],
  scenes:Object.fromEntries(Object.entries(data.scenes).map(([name,s])=>[name,{camera:camera(name),
   nodes:s.nodes.map(n=>({id:n.id,name:n.name,x:n.x,y:n.y,z:n.z,sx:n.sx,sy:n.sy,rotation:n.engineRotation??0,layer:n.layer,order:n.order,flip:n.flip,sprite:n.sprite,src:data.assets[n.sprite?.asset]?.src,engineNode:n.engineNode??null,placementSource:n.placementSource??'web-only'}))}])),
  actorAlignmentStatus:'engine-roots-with-native-web-sprite-proportions',actors,
  engineActorReference:Object.fromEntries(Object.entries(source.scenes).map(([name,s])=>[name,s.actors])),
  terrace:{camera:source.scenes.home.cameras.views.find(c=>c.name==='CM_Terrace'),nodes:source.scenes.home.nodes.filter(n=>['Terrace','Terrace_BG_City','Terrace_0','balustrade'].includes(n.name))}};
}
W.LunaEngineWorld={source,node,point,actor,target,actorPoint,actorSorting,actorPose,drawActor,actorNodes,speechAnchor,bounds,confine,camera,curve,liftCamera,transform,homePlacement,residence,applyStreet,exportLayout};
})(typeof window==='undefined'?globalThis:window);
