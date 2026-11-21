/* Supplied street layers and their registration to gameplay anchors. */
(function(W){
'use strict';
const root='assets/01.ArtResources/02.Environments/02.Street/01.Sprites/';
// Match the reference head-only framing above the front panel without making
// Luna step up/down when entering the cabin from either flat walking plane.
const elevatorArtOffsetY=-.11;
const replacements=[
 ['Sky','sky.png',2880,1620],
 ['C_Back_Building_1','Layers/C_background_1 1.png',2880,618],
 ['C_Back_Building_2','Layers/C_background_2 1.png',2880,873],
 ['C_Middle_Building_1','Layers/area_C_midground_1.png',2880,605],
 ['C_Middle_Building_2','Layers/area_C_midground_2.png',2880,562],
 ['C_Middle_Building_3','Layers/area_C_midground_3.png',725,1620],
 ['C_Middle_Object_1','Layers/C_midground_2_object1.png',1415,714],
 ['C_Middle_Object_2','Layers/area_C_midground_2_object2.png',170,440],
 ['1F Floor','Layers/floor_1_ground.png',2880,67],
 ['Fence','Layers/fence.png',2880,84],
 ['B_Fore_Building_1','Layers/area_B_foreground_building.png',1293,306,-20,2],
 ['B_Fore_StandLight_1','Layers/area_B_foreground_streetlight.png',96,183,-2,0],
 ['B_Obects','Objects/object_1.png',2222,208,-178,0],
 ['B_ForeFore_Object_1','Layers/near_foreground_1.png',2880,324,-368,0],
 ['CityLight','Lights/CityLight_v16.png',2400,1153],
 ["'CityLight '",'Lights/CityLight_v20.png',2354,1153],
 ['CityUpLight','Lights/CityUpLight_v9.png',2400,1200],
 ['residence-building','Layers/area_A_foreground_building.png',952,1520],
 ['residence-railing','Layers/near_foreground_2.png',952,617],
 ['Elevator','Elevator/elevator_body.png',69,154],
 ['Elevator Fore','Elevator/elevator_front_layer.png',57,101],
 ['Elevator Line','Elevator/elevator_support.png',105,1306]
];
function apply(data){
 if(data.streetArtVersion==='20261018')return data;
 const nodes=data.scenes.street.nodes,R=W.LunaResidence.layout;
 for(const [name,file,w,h,dx,dy] of replacements){
  for(const n of nodes.filter(n=>n.name===name)){
   const old=n.sprite;
   // Measured matching pixels, not centering a differently trimmed atlas.
   if(dx!==undefined){n.x+=(dx+(w-old.w)*old.pivot.x)*n.sx/old.ppu;n.y+=((old.h-h)*(1-old.pivot.y)-dy)*n.sy/old.ppu;}
   data.assets[old.asset]={src:root+file,w,h,source:'9_ArtResources/02.Environments/02.Street/01.Sprites/'+file.replace(/ 1\.png$/,'.png')};
   n.sprite={...old,x:0,y:0,w,h};
  }
 }
 // This sheet is a fleet of individual moving vehicles on transparent space.
 const fleet=nodes.find(n=>n.name==='C_Middle_Object_1');
 data.streetVehicleSheet=fleet.sprite.asset;
 fleet.active=false;
 const portrait=nodes.find(n=>n.name==='C_Middle_Object_2');
 const tower=nodes.find(n=>n.name==='C_Middle_Building_3');
 portrait.billboardPlacement={parent:tower.name,x:-2.45,y:6.45};
 const billboard='C_Middle_Object_3';
 data.assets[billboard]={src:root+'Layers/area_C_midground_2_object3.png',w:480,h:254,source:'9_ArtResources/02.Environments/02.Street/01.Sprites/Layers/area_C_midground_2_object3.png'};
 nodes.push({...portrait,id:billboard,go:billboard,name:billboard,x:tower.x+5.415,y:tower.y+5.10,
  billboardPlacement:{parent:tower.name,x:5.415,y:5.10},
  sprite:{...portrait.sprite,asset:billboard,w:480,h:254,pivot:{x:.5,y:0}}});
 // The new first accessible corridor floor is row 477. Match the existing
 // 9.55 world-space railing edge and keep the doorway centered at homeX.
 const building=nodes.find(n=>n.name==='residence-building');
 building.x=R.homeX-5.83;building.y=14.32;
 // OutSide.unity: the apartment is behind the ground, fence and street
 // dressing, not in front of them. Keep the playable upper doorway anchor.
 building.layer=5;building.order=-1;
 // Restore the engine's ground-plane composition. The full-width foreground
 // hides the base of the apartment; city light washes its lower wall.
 const foreground=nodes.find(n=>n.name==='B_ForeFore_Object_1');
 Object.assign(foreground,{x:-7.85,y:-1.5,layer:10,order:0});
 const cityLight=nodes.find(n=>n.name==='CityLight');
 Object.assign(cityLight,{x:-6.72,y:-2.25,sx:1.193125,sy:1.3275325,alpha:1});
 const railing=nodes.find(n=>n.name==='residence-railing');
 // The complete foreground begins at building row 229. Its transparent corridor
 // reveals actors; the rail's top edge, diagonal braces and pillars cover them.
 // Cropping at the walking floor incorrectly removes all of those occluders.
 railing.x=building.x;railing.y=building.y-3.21;
 railing.sprite={...railing.sprite,y:0,h:617,pivot:{x:0,y:1}};
 railing.layer=10;railing.order=20;
 // New elevator art is already drawn at gameplay pixel scale (old art was .6).
 const body=nodes.find(n=>n.name==='Elevator'),front=nodes.find(n=>n.name==='Elevator Fore'),rail=nodes.find(n=>n.name==='Elevator Line');
 Object.assign(body,{x:R.elevatorX,y:R.elevatorBottom+elevatorArtOffsetY,sx:1,sy:1});
 // The motor/connector covers the guide frame and cable (layer 6), while
 // the apartment foreground railing (layer 10) still occludes it upstairs.
 // Keep the split so neither the cable nor the connector cuts through the cabin.
 const connectorHeight=35,fullBody={...body.sprite};
 nodes.push({...body,id:body.id+'-connector',go:body.go+'-connector',name:'Elevator Connector',
  y:body.y+(fullBody.h-connectorHeight)/fullBody.ppu,layer:7,order:0,
  sprite:{...fullBody,h:connectorHeight}});
 body.sprite={...fullBody,y:connectorHeight,h:fullBody.h-connectorHeight};
 // Exact opaque-pixel match: front sheet starts at body pixel (12,45).
 Object.assign(front,{x:R.elevatorX+.06,y:R.elevatorBottom+.09+elevatorArtOffsetY,sx:1,sy:1});
 // Engine alignment, relative to the apartment's top-left (-22.25,14.37):
 // rail center (-13.025,-.83). Its braces line up with the facade cutouts
 // at every floor. Carry the same small doorway-anchor offset to the rail.
 Object.assign(rail,{x:building.x+9.225,y:building.y-15.20,sx:1,sy:1,layer:6,order:0});
 // Control panel is baked into the new body; don't paint the retired panel over it.
 data.scenes.street.nodes=nodes.filter(n=>n.name!=='Elevator Door');
 function light(name,file,w,h,x,y){
  data.assets[name]={src:root+file,w,h,source:'User supplied new/'+file+' · 2026-10-18'};
  data.scenes.street.nodes.push({id:name,go:name,name,x,y,z:0,sx:1,sy:1,active:true,ancestry:['Residence'],sprite:{asset:name,x:0,y:0,w,h,pivot:{x:0,y:1},ppu:100},layer:8,order:21,flip:false,light:true,alpha:.65});
 }
 light('residence-warm-light','Lights/A_light_1.png',743,352,building.x+.34,building.y-3.90);
 light('residence-home-light','Lights/A_light_2.png',52,50,R.homeX-.26,building.y-3.91);
 // The rail lost 92 rows at its top. The detached sign and the home door
 // are registered to the building's top-left, in original artwork pixels.
 for(const [id,file,w,h,lx,ly,parent] of [
  ['residence-foreground-fade','near_foreground_Fade.png',861,119,81,362,railing],
  ['residence-home-door','area_A_foreground_building_door.png',48,75,560,398,building]
 ]){
  data.assets[id]={src:root+'Layers/'+file,w,h};
  data.scenes.street.nodes.push({...parent,id,go:id,name:id,x:building.x+lx/100,y:building.y-ly/100,
   facadePixel:[lx,ly],order:parent.order+.005,sprite:{asset:id,x:0,y:0,w,h,ppu:100,pivot:{x:0,y:1}}});
 }
 data.streetArtVersion='20261018';return data;
}
// Cache opaque scanlines of the original art, not its rectangular atlas cell.
const masks=new WeakMap(),corridorParts=[[0,401],[756,61],[845,16]];
function mask(image,sp,start=0,width=sp.w){
 let frames=masks.get(image);if(!frames)masks.set(image,frames=new Map());
 const key=[sp.x+start,sp.y,width,sp.h].join(':');if(frames.has(key))return frames.get(key);
 const c=document.createElement('canvas');c.width=width;c.height=sp.h;
 const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,sp.x+start,sp.y,width,sp.h,0,0,width,sp.h);
 const data=g.getImageData(0,0,width,sp.h).data,rows=[];let area=0;
 for(let y=0;y<sp.h;y++){
  const runs=[];let a=-1;
  for(let x=0;x<=width;x++){
   if(x<width&&data[(y*width+x)*4+3]>0){if(a<0)a=x;}
   else if(a>=0){runs.push(start+a,start+x);area+=x-a;a=-1;}
  }
  rows.push(runs);
 }
 const frame={rows,area};frames.set(key,frame);return frame;
}
// Intersect the current, possibly mirrored Luna frame with one foreground
// piece in its native pixel coordinates. Empty space between the sign legs
// or between the column and pipe must never count toward the overlap.
function coveredArea(body,frame,flipped,dx,dy,sx,sy,part){
 let area=0;
 for(let y=0;y<frame.h;y++){
  const row=body.rows[y];if(!row.length)continue;
  const y0=dy+y*sy,y1=y0+sy;
  for(let v=Math.max(0,Math.floor(y0));v<Math.min(part.rows.length,Math.ceil(y1));v++){
   const stripes=part.rows[v],height=Math.min(v+1,y1)-Math.max(v,y0);
   for(let i=0;i<row.length;i+=2){
    const a=dx+(flipped?frame.w-row[i+1]:row[i])*sx,b=dx+(flipped?frame.w-row[i]:row[i+1])*sx;
    for(let j=0;j<stripes.length;j+=2)area+=height*Math.max(0,Math.min(b,stripes[j+1])-Math.max(a,stripes[j]));
   }
  }
 }
 return area;
}
// Follow the existing contact target (no proximity radius or delayed trigger).
// 90% of a step in 80 ms; settle the last half-percent exactly. The visit's
// simulation clock keeps pause, extra draws, and different refresh rates consistent.
const corridorFades=new WeakMap(),responseSeconds=.08/Math.log(10);
function paintCorridorForeground(ctx,img,sp,rect,actor,model){
 const {w,h}=rect,left=-w*sp.pivot.x,top=-h*(1-sp.pivot.y),px=w/sp.w,py=h/sp.h;
 let state=corridorFades.get(model.story);
 if(!state){state={time:-Infinity,values:[0,0,0]};corridorFades.set(model.story,state);}
 const keep=Math.exp(-Math.max(0,model.time-state.time)/responseSeconds);state.time=model.time;
 let dx,dy,sx,sy,nearSheet=false;
 if(actor){
  const {frame,flip,box}=actor;sx=box.w/frame.w/px;sy=box.h/frame.h/py;
  dx=(box.x-box.w*(flip?1-frame.pivot.x:frame.pivot.x)-(rect.x+left))/px;
  dy=(box.y-box.h*(1-frame.pivot.y)-(rect.y+top))/py;
  nearSheet=dy<sp.h&&dy+frame.h*sy>0&&dx<sp.w&&dx+frame.w*sx>0;
 }
 if(!nearSheet&&state.values.every(v=>v===0)){
  ctx.drawImage(img,sp.x,sp.y,sp.w,sp.h,left,top,w,h);return;
 }
 const base=ctx.globalAlpha;
 for(const [i,[start,width]] of corridorParts.entries()){
  let fade=0;
  if(nearSheet&&dx+actor.frame.w*sx>start&&dx<start+width){
   const {frame,flip}=actor;
   const body=mask(actor.image,frame),part=mask(img,sp,start,width);
   const area=coveredArea(body,frame,flip,dx,dy,sx,sy,part);
   if(body.area)fade=Math.min(1,area/(body.area*sx*sy*.25));
  }
  const residual=(state.values[i]-fade)*keep;
  if(keep!==1)state.values[i]=fade+(Math.abs(residual)<.005?0:residual);
  ctx.globalAlpha=base*(1-.76*state.values[i]);
  ctx.drawImage(img,sp.x+start,sp.y,width,sp.h,left+start*px,top,width*px,h);
 }
 ctx.globalAlpha=base;
}
W.LunaOutsideArt={apply,replacements,elevatorArtOffsetY,paintCorridorForeground};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
