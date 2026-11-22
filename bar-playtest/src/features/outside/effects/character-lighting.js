/* Read-only reference: Human-Bartender 654756621b39611bbca64d3ad70cff8e5b6613e8,
 * OutSide.unity / CharacterSpriteLighting.cs / SH_CharacterSpriteLit.shader.
 * Native-frame body shading + directional rim; not an interaction outline. */
(function(W){'use strict';
const config=Object.freeze({...W.LUNA_CHARACTER_SHADOWS.lighting});
const states=new WeakMap(),clamp=n=>Math.max(0,Math.min(1,n));
// Offsets register the packed color cells inside the artist's 129×138 lighting cells.
const mappedSheets=new Map();
function registerMaps(data){
 const clips=[
  [data.animations.idle.frames[0].asset,'01.Luna/luna_idle',9,3,21,35],
  [data.animations.walk.frames[0].asset,'01.Luna/luna_walk',8,3,18,35],
  [data.animations.run.frames[0].asset,'01.Luna/luna_run',8,3,21,[36,34,34,34,35,34,34,34]],
  ['ambient-Chris','02.Chris/Chris_idle',9,9,0,0],
  ['samho-idle','03.Samho/samho_idle',8,3,30,40],
  ['samho-run','03.Samho/samho_run',8,3,[20,21,22,22,20,20,20,20],[40,40,40,40,40,40,40,41]]
 ];
 for(const [asset,path,count,columns,x,y] of clips){
  const frames=Array.from({length:count},(_,i)=>[129*i+(Array.isArray(x)?x[i]:x),Array.isArray(y)?y[i]:y]);
  const normal=path+'-Normal',mask=path+'_Mask';
  for(const id of [normal,mask])data.assets[id]={
   src:'assets/01.ArtResources/01.Characters/02.Outside/'+id+'.png',w:129*count,h:138,
   frameWidth:129,frameHeight:138,frames:count,fps:12,lightingClip:path.split('/')[1],lightingMap:id===normal?'normal':'mask'
  };
  mappedSheets.set(asset,{normal,mask,columns,frames});
 }
}
if(W.LUNA_OUTSIDE_DATA)registerMaps(W.LUNA_OUTSIDE_DATA);
function frameMaps(sp,images){
 const sheet=mappedSheets.get(sp.asset);if(!sheet||!images)return null;
 const offset=sheet.frames[sp.y/sp.h*sheet.columns+sp.x/sp.w],normal=images.get(sheet.normal),mask=images.get(sheet.mask);
 return offset&&normal&&mask?{offset,normal,mask}:null;
}
// The home encounter uses the standing Chris sheet. Its light belongs to the
// room, even if this play session has never visited the street.
const roomRenderers=new WeakMap();
function roomRenderer(model){
 let renderer=roomRenderers.get(model);
 if(renderer?.needsRebuild){renderer.dispose();roomRenderers.delete(model);renderer=undefined;}
 if(renderer===undefined){
  try{renderer=new W.LunaStreetAtmosphereRenderer({spriteOnly:true});}catch{renderer=null;}
  roomRenderers.set(model,renderer);
 }
 return renderer;
}
function roomLights(){
 const name='Room ceiling light',anchor=W.LunaEngineWorld?.point('home','03.World/Home Ground Shadows/'+name);
 return anchor?[{...anchor,id:name,active:true,type:0,layers:[W.LUNA_CHARACTER_SHADOWS.player.sortingLayer],
  radius:6,intensity:2.5,priority:1,gain:1,color:[1,.86,.68]}]:[];
}
function dispose(model){roomRenderers.get(model)?.dispose();roomRenderers.delete(model);states.delete(model);}
function select(foot,lights,current){
 const influence=l=>W.LunaCharacterShadows.influence(foot,l);
 let best=lights.find(l=>l.id===current&&influence(l)>0)||null,score=best?influence(best)*1.15:0;
 for(const l of lights){const candidate=influence(l);if(candidate>score){best=l;score=candidate;}}
 return best;
}
function advance(model,id,foot){
 let all=states.get(model);const now=model.time||0;
 if(!all||now<all.time||all.scene!==model.scene){all={time:now,scene:model.scene,actors:new Map()};states.set(model,all);}
 all.time=now;
 // One bounded light inventory per frame, shared with the ground shadows.
 if(all.lightTime!==now){all.lights=model.scene==='home'?roomLights():W.LunaCharacterShadows.lights(model);all.lightTime=now;}
 let s=all.actors.get(id);
 if(!s){s={time:now,weight:0,position:[foot.x,foot.y+1],color:config.rimColor.slice(),selected:null,localLight:[1,0,1]};all.actors.set(id,s);}
 const dt=Math.max(0,Math.min(.1,now-s.time)),step=dt/config.transitionSeconds;
 const light=select(foot,all.lights,s.selected),target=light?clamp(W.LunaCharacterShadows.influence(foot,light)/config.rimFullInfluence):0;
 s.weight+=Math.sign(target-s.weight)*Math.min(Math.abs(target-s.weight),step);
 if(light){
  const follow=s.weight<=step?1:clamp(step*2);
  // Low nearby flames can lie INSIDE the sprite's transparent bounding box.
  // Use their physical radius, never distance to that box (which becomes zero).
  const local=[light.radius,light.localFalloff?1:0,light.gain??1];
  s.localLight=s.localLight.map((v,i)=>v+(local[i]-v)*follow);
  s.position=s.position.map((v,i)=>v+([light.x,light.y][i]-v)*follow);
  s.color=s.color.map((v,i)=>v+(config.rimColor[i]+(light.color[i]-config.rimColor[i])*config.rimUsesLightColor-v)*follow);
 }
 s.selected=light?.id||null;s.time=now;
 for(const [key,a] of all.actors)if(now-a.time>2)all.actors.delete(key);
 while(all.actors.size>64)all.actors.delete(all.actors.keys().next().value);
 return s;
}
function kind(sp,node){
 if(sp.lightingId||sp.asset==='samho-run'||sp.asset.startsWith('ambient-')||sp.asset.startsWith('neighborhood-cat-'))return 'npc';
 const data=W.LUNA_OUTSIDE_DATA;
 if(['idle','walk','run'].some(k=>data.animations[k]?.frames[0]?.asset===sp.asset))return 'player';
 if(data.animations.shiba?.frames[0]?.asset===sp.asset)return 'npc';
 if(data.scenes.street.nodes.some(n=>['Samho','Bubi','CitizenA','CitizenB'].includes(n.name)&&n.sprite?.asset===sp.asset))return 'npc';
 return null;
}
function shade(model,image,sp,x,y,width,height,flip,node,images){
 const room=model.scene==='home';
 if(model.qa||(!room&&model.scene!=='street'))return null;
 if(room&&!mappedSheets.has(sp.asset))return null;
 const type=kind(sp,node);if(!type)return null;
 const renderer=room?roomRenderer(model):W.LunaStreetAtmosphere?.inspect(model)?.renderer;if(!renderer||renderer.gl.isContextLost())return null;
 // Scene nodes / neighborhood poses have identities; standalone encounter
 // actors have one sprite family per role. Position must never be an ID:
 // an exiting NPC must keep its light fade while walking.
 const samho=sp.asset==='samho-idle'||sp.asset==='samho-run';
 const id=type==='player'?'player':sp.lightingId||(samho?'samho:'+ (sp.engineActor?.event||'street'):node?.id)||'encounter:'+sp.asset;
 // Neighborhood sheets retain transparent padding below their feet. The
 // low barrel light must measure distance from the actual soles, not that cell edge.
 const bounds=sp.lightingId?W.LunaOutsideAmbient?.bounds(sp):null;
 const foot=type==='player'?W.LunaCharacterShadows.foot(model):{x,y:y-height*sp.pivot.y+(bounds?height*(sp.h-bounds.bottom)/sp.h:0)};
 const state=advance(model,id,foot);
 return renderer.characterLighting(image,sp,{x,y,width,height,flip,foot,state,config,maps:frameMaps(sp,images)});
}
W.LunaCharacterLighting={config,select,advance,kind,shade,dispose,inspect:m=>states.get(m)||null};
})(typeof window==='undefined'?globalThis:window);
