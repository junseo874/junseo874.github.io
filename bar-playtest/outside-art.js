/* Supplied 2026-10-18 street layers. Keep gameplay anchors and original PNGs intact. */
(function(W){
'use strict';
const root='assets/outside/street-20261018/';
// Lower the cabin artwork, not Luna or the flat walking/boarding plane.
const elevatorArtOffsetY=-.25;
const replacements=[
 ['Sky','sky.png',2880,1620],
 ['C_Back_Building_1','Layers/C_background_1.png',2880,605],
 ['C_Back_Building_2','Layers/C_background_2.png',2880,673],
 ['C_Middle_Building_1','Layers/area_C_midground_1.png',2880,677],
 ['C_Middle_Building_2','Layers/area_C_midground_2.png',2880,536],
 ['C_Middle_Building_3','Layers/area_C_midground_3.png',729,1620],
 ['C_Middle_Object_1','Layers/C_midground_2_object1.png',1296,613],
 ['C_Middle_Object_2','Layers/area_C_midground_2_object2.png',1090,1014],
 ['1F Floor','Layers/floor_1_ground.png',2880,67],
 ['Fence','Layers/fence.png',2880,84],
 ['B_Fore_Building_1','Layers/area_B_foreground_building.png',1293,310,-20,2],
 ['B_Fore_StandLight_1','Layers/area_B_foreground_streetlight.png',96,183,-2,0],
 ['B_Obects','Objects/object_1.png',2212,207,-178,0],
 ['B_ForeFore_Object_1','Layers/near_foreground_1.png',2880,324,-368,0],
 ['CityLight','Lights/CityLight_v16.png',2400,1153],
 ["'CityLight '",'Lights/CityLight_v20.png',2354,1153],
 ['CityUpLight','Lights/CityUpLight_v9.png',2400,1200],
 ['residence-building','Layers/area_A_foreground_building.png',952,1587],
 ['residence-railing','Layers/near_foreground_2.png',952,709],
 ['Elevator','Elevator/elevator_body.png',69,154],
 ['Elevator Fore','Elevator/elevator_front_layer.png',57,100],
 ['Elevator Line','Elevator/elevator_support.png',105,1467]
];
function apply(data){
 if(data.streetArtVersion==='20261018')return data;
 const nodes=data.scenes.street.nodes,R=W.LunaResidence.layout;
 for(const [name,file,w,h,dx,dy] of replacements){
  for(const n of nodes.filter(n=>n.name===name)){
   const old=n.sprite;
   // Measured matching pixels, not centering a differently trimmed atlas.
   if(dx!==undefined){n.x+=(dx+(w-old.w)*old.pivot.x)*n.sx/old.ppu;n.y+=((old.h-h)*(1-old.pivot.y)-dy)*n.sy/old.ppu;}
   data.assets[old.asset]={src:root+file,w,h,source:'User supplied new/'+file+' · 2026-10-18'};
   n.sprite={...old,x:0,y:0,w,h};
  }
 }
 // The new first accessible corridor floor is row 477. Match the existing
 // 9.55 world-space railing edge and keep the doorway centered at homeX.
 const building=nodes.find(n=>n.name==='residence-building');
 building.x=R.homeX-5.83;building.y=14.32;
 building.interactionRegions={home:[562,397,43,80]};
 const railing=nodes.find(n=>n.name==='residence-railing');
 // The complete foreground begins at building row 229. Its transparent corridor
 // reveals actors; the rail's top edge, diagonal braces and pillars cover them.
 // Cropping at the walking floor incorrectly removes all of those occluders.
 railing.x=building.x;railing.y=building.y-2.29;
 railing.sprite={...railing.sprite,y:0,h:709,pivot:{x:0,y:1}};
 railing.layer=10;railing.order=20;
 // New elevator art is already drawn at gameplay pixel scale (old art was .6).
 const body=nodes.find(n=>n.name==='Elevator'),front=nodes.find(n=>n.name==='Elevator Fore'),rail=nodes.find(n=>n.name==='Elevator Line');
 Object.assign(body,{x:R.elevatorX,y:R.elevatorBottom+elevatorArtOffsetY,sx:1,sy:1});
 // Exact opaque-pixel match: front sheet starts at body pixel (12,45).
 Object.assign(front,{x:R.elevatorX+.06,y:R.elevatorBottom+.09+elevatorArtOffsetY,sx:1,sy:1});
 Object.assign(rail,{x:R.elevatorX-.275,y:-1.5,sx:1,sy:1});
 // Control panel is baked into the new body; don't paint the retired panel over it.
 data.scenes.street.nodes=nodes.filter(n=>n.name!=='Elevator Door');
 function light(name,file,w,h,x,y){
  data.assets[name]={src:root+file,w,h,source:'User supplied new/'+file+' · 2026-10-18'};
  data.scenes.street.nodes.push({id:name,go:name,name,x,y,z:0,sx:1,sy:1,active:true,ancestry:['Residence'],sprite:{asset:name,x:0,y:0,w,h,pivot:{x:0,y:1},ppu:100},layer:8,order:21,flip:false,light:true,alpha:.65});
 }
 light('residence-warm-light','Lights/A_light.png',743,352,building.x+.34,building.y-3.90);
 light('residence-home-light','Lights/A_light_2.png',52,50,R.homeX-.26,building.y-3.91);
 data.streetArtVersion='20261018';return data;
}
W.LunaOutsideArt={apply,replacements,elevatorArtOffsetY};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
