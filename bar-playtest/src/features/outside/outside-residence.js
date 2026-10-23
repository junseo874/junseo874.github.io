// Hand-authored art override: kept separate from the Unity importer output.
(function(global){
'use strict';
// Reference framing: show the hips above the corridor rail, but only the head
// above the lift's front panel. Both stops share one flat passenger offset.
const upperY=9.74,passengerOffset=.39;
// Ground access continues past the lift and drums to the black scrap wall.
// near_foreground_1 row 270 ends at x=552: -22.25 + 5.52, plus the
// foreground's ~.30 parallax offset and .13 actor clearance => -16.30.
// Upper corridor: the KORATECH crates end at native x=305 in the current
// building (world left = homeX - 5.83). Stop Luna's center 16 px to their right:
// -16.36 - 5.83 + 3.05 + .16 = -18.98. Ground-floor access is independent.
// Cabin connector center is body pixel 30; support spine center is pixel 80.
// At 100 PPU, align both at world x=-12.69 (13.5 native pixels left).
// The scaled cabin's right wall is -12.30. Reserve .205 for the widest
// idle/walk/run silhouette (both facings) plus .035 clearance, not just the pivot.
const layout=Object.freeze({homeX:-16.36,upperY,elevatorX:-12.645,elevatorBottom:-1.09,elevatorTop:upperY-passengerOffset,passengerOffset,lowerMin:-16.30,upperMin:-18.98,upperMax:-12.54});
function apply(data){
 if(data.residenceVersion===1)return data;
 const replaced=new Set(['1F Left Building','A_Fore_Building','A_Obect','A_Middle_Building_1','A_Middle_Building_2','A_ForeFore_Object_1','2F Floor','House Spawn Point']);
 data.scenes.street.nodes=data.scenes.street.nodes.filter(n=>!replaced.has(n.name));
 function add(name,file,w,h,x,y,layer){const id='residence-'+name;data.assets[id]={src:'assets/outside/'+file,w,h,source:'User supplied residential building layers, 2026-09-29'};data.scenes.street.nodes.push({id,go:id,name:id,x,y,z:0,sx:1,sy:1,active:true,ancestry:['Residence'],sprite:{asset:id,x:0,y:0,w,h,pivot:{x:0,y:1},ppu:100},layer,order:20,flip:false});}
 // Full reference uses 100 px/world unit. Building starts at the sky's top left.
 add('building','residence-building-v2.png',1136,1553,-22.25,14.7,8);
 // Exact pixel match: the supplied 955×66 strip is building rows 515–580.
 // Draw AFTER Luna so the top-floor railing occludes the lower body.
 add('railing','residence-railing-v1.png',955,66,-22.25,9.55,10);
 for(const n of data.scenes.street.nodes){
  if(!n.ancestry.includes('Elevator'))continue;
  n.x=layout.elevatorX+(n.x-(-12.18))*.6;
  if(n.name==='Elevator Line'){n.sx*=.6;continue;}
  if(['Elevator','Elevator Fore','Elevator Door'].includes(n.name)){n.y=layout.elevatorBottom+(n.y-(-1.09))*.6;n.sx*=.6;n.sy*=.6;}
 }
 data.residenceVersion=1;return data;
}
global.LunaResidence={layout,apply};
if(global.LUNA_OUTSIDE_DATA)apply(global.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
