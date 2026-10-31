/* Read-only reference: Human-Bartender 654756621b39611bbca64d3ad70cff8e5b6613e8,
 * OutSide.unity / CharacterSpriteLighting.cs / SH_CharacterSpriteLit.shader.
 * Native-frame body shading + directional rim; not an interaction outline. */
(function(W){'use strict';
const config=Object.freeze({shadeColor:[.32,.3,.45],groundOcclusion:.35,occlusionHeight:.45,sideShadow:.4,sideShadowWidth:2,ambientDirection:[.35,1],ambientSideShadow:.4,rimIntensity:1.2,rimWidth:1,rimUsesLightColor:.75,rimColor:[1,.85,.7],rimFocus:2,rimDistanceFalloff:1.5,rimGlow:.6,rimGlowWidth:3,rimFullInfluence:.6,transitionSeconds:.3});
const states=new WeakMap(),clamp=n=>Math.max(0,Math.min(1,n));
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
 if(all.lightTime!==now){all.lights=W.LunaCharacterShadows.lights(model);all.lightTime=now;}
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
 if(sp.lightingId||sp.asset.startsWith('ambient-')||sp.asset.startsWith('neighborhood-cat-'))return 'npc';
 const data=W.LUNA_OUTSIDE_DATA;
 if(['idle','walk','run'].some(k=>data.animations[k]?.frames[0]?.asset===sp.asset))return 'player';
 if(data.animations.shiba?.frames[0]?.asset===sp.asset)return 'npc';
 if(data.scenes.street.nodes.some(n=>['Samho','Bubi','CitizenA','CitizenB'].includes(n.name)&&n.sprite?.asset===sp.asset))return 'npc';
 return null;
}
function shade(model,image,sp,x,y,width,height,flip,node){
 if(model.scene!=='street'||model.qa)return null;
 const type=kind(sp,node);if(!type)return null;
 const renderer=W.LunaStreetAtmosphere?.inspect(model)?.renderer;if(!renderer||renderer.gl.isContextLost())return null;
 // Scene nodes / neighborhood poses have identities; standalone encounter
 // actors have one sprite family per role. Position must never be an ID:
 // an exiting NPC must keep its light fade while walking.
 const id=type==='player'?'player':sp.lightingId||node?.id||'encounter:'+sp.asset;
 // Neighborhood sheets retain transparent padding below their feet. The
 // low barrel light must measure distance from the actual soles, not that cell edge.
 const bounds=sp.lightingId?W.LunaOutsideAmbient?.bounds(sp):null;
 const foot=type==='player'?W.LunaCharacterShadows.foot(model):{x,y:y-height*sp.pivot.y+(bounds?height*(sp.h-bounds.bottom)/sp.h:0)};
 const state=advance(model,id,foot);
 return renderer.characterLighting(image,sp,{x,y,width,height,flip,foot,state,config});
}
W.LunaCharacterLighting={config,select,advance,kind,shade,inspect:m=>states.get(m)||null};
})(typeof window==='undefined'?globalThis:window);
