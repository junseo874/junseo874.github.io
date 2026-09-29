// Hand-authored art override: kept separate from the Unity importer output.
(function(global){
'use strict';
const layout=Object.freeze({homeX:-16.36,upperY:9.62,elevatorX:-12.51,elevatorBottom:-1.09,elevatorTop:9.238,lowerMin:-12.81,upperMin:-21.65,upperMax:-12.28});
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
