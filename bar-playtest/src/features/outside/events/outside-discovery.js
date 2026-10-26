/* First-interaction badges. Legacy flow fingerprints remain readable for saves,
 * but new dialogue, choices and day changes never reset a target's badge. */
(function(W){
'use strict';
const prefix='outside_seen_v1_';
const range=t=>t.id==='elevator'?.62:.4;
const inRange=(m,t)=>Math.abs(t.x-m.x)<range(t);
function key(id,rows){
 const value=JSON.stringify([id,rows.map(r=>[r.type,r.actor||'',r.text||'',r.action||'',r.stage||'',r.item||''])]);
 let a=2166136261,b=5381;
 for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b,33)^value.charCodeAt(i);}
 return prefix+(a>>>0).toString(36)+'_'+(b>>>0).toString(36)+'_'+value.length;
}
function flags(m){return m.qa?(m.discoveryFlags??={}):(W.barGame?.progress.flags??{});}
function remember(m,token){
 if(!token||m.qa||flags(m)[token])return;
 flags(m)[token]=true;
 const carry=W.lunaCampaign?.session?.carry;
 if(carry)(carry.flags??={})[token]=true;
}
function witnessed(m,id,rows){if(rows?.length)remember(m,key(id,rows));}
function objectKey(m,id){
 const f=flags(m);
 if(id==='tv')return f.day0_tv_seen?'tv/replay-menu':'tv/documentary';
 if(id==='elevator')return 'elevator/'+m.level+'/'+(f.elevator_repaired?'fast':'normal');
 if(id==='sofa')return 'rest/'+m.config.day+'/'+(f.boobi_adopted&&!f.boobi_rest_seen?'boobi':'normal');
 if(id==='bar')return 'bar/'+m.config.flow+'/'+(m.config.flow==='in'?m.config.day:'closed');
 if(id==='exit')return 'exit/'+(m.config.day===0&&m.config.flow==='in'?'first-commute':'corridor');
 return 'object/'+id;
}
function objectToken(m,id){return key(objectKey(m,id),[]);}
function preview(m,t){
 for(const owner of [W.LunaOutsideNeighborhood,W.LunaOutsideBeggar,W.LunaOutsideShop,W.LunaOutsideNotion]){
  const flow=owner?.preview?.(m,t);if(flow)return flow;
 }
 if(t.source&&W.LUNA_OUTSIDE_DIALOGUES[t.source])return {id:t.source,rows:W.LUNA_OUTSIDE_DIALOGUES[t.source]};
 return null;
}
const excluded=new Set(['tv','elevator','sofa','home','exit','bar']);
const identity=id=>id==='neighborhood-home-cat'?'neighborhood-cat':id;
const interactionToken=id=>'outside_interacted_v1_'+identity(id);
const legacyFlags={
 'tv':['day0_tv_seen'],
 'shiba-shop':['shiba_shop_met'],
 'street-beggar':['street_beggar_met','street_beggar_paid'],
 'street-beggar-witness':['street_beggar_witness_met'],
 'neighborhood-box':['boobi_revealed'],
 'neighborhood-cat':['boobi_feeding_pending','boobi_adopted'],
 'neighborhood-repair':['repairman_met','elevator_repair_paid','elevator_repaired'],
 'neighborhood-guard':['gang_pass_granted'],
 'neighborhood-boss':['gang_boss_met','gang_wild_dog_received']
};
function interacted(m,t){if(!excluded.has(t.id))remember(m,interactionToken(t.id));}
function previouslyInteracted(m,t){
 const f=flags(m),id=identity(t.id);
 if((legacyFlags[id]||[]).some(k=>f[k])||f[objectToken(m,t.id)])return true;
 const flow=preview(m,t);
 if(flow&&[flow,...(flow.alternatives||[])].some(r=>f[key(r.id,r.rows)]))return true;
 // The guard's old blocked greeting is no longer the current flow on later days.
 const old=id==='neighborhood-guard'?'guardBlocked':id==='neighborhood-cat'?'pet':null;
 const rows=old==='pet'?[{type:'neighborhood-action',action:'pet'}]:W.LUNA_DATA?.sharedStory?.['neighborhood/'+old];
 return !!(rows&&f[key('neighborhood/'+old,rows)]);
}
function unseen(){
 // D11: discovery badges are retired; keep legacy records readable.
 return false;
}
function project(head,pose,camera,surface){
 const C=W.LunaPixelCamera,p=C.position(head.x,head.y,camera);
 const sp=pose?.sp||pose?.sprite;
 if(sp){
  const origin=C.position(pose.x,pose.y,camera);
  const raster=C.sprite(sp,pose.x,pose.y,pose.sx??pose.scale??1,pose.sy??pose.scale??1,pose.flip,camera,surface);
  // Inherit the actor's exact raster translation (odd-width pivots included),
  // so even half-pixel rounding cannot move the badge independently of it.
  p.x+=raster.x-origin.x;p.y+=raster.y-origin.y;
 }
 return p;
}
function draw(ctx,m,targets,position,anchor,pixelFactor=1){
 const visible=[];
 // Use the same physical-pixel grid as the scene, including resized/HiDPI
 // canvases. Rounding in 1280px UI units adds a second, drifting snap grid.
 const snap=value=>Math.round(value*pixelFactor+1e-7)/pixelFactor;
 for(const t of targets){
  if(!inRange(m,t)||!unseen(m,t))continue;
  const head=anchor(t);
  const p=position(head.x,head.y,t),x=snap(Math.max(14,Math.min(1266,p.x))),y=snap(Math.max(18,Math.min(696,p.y-22)));
  ctx.save();ctx.globalAlpha=.96;ctx.font='bold 24px LunaPixel, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor=W.LunaInteractionGlow.style.shadow;ctx.shadowBlur=W.LunaInteractionGlow.style.blur;
  ctx.fillStyle=W.LunaInteractionGlow.style.color;ctx.fillText('?',x,y);ctx.restore();
  visible.push({id:t.id,x,y});
 }
 return visible;
}
W.LunaOutsideDiscovery={key,range,inRange,remember,witnessed,objectToken,preview,interacted,interactionToken,unseen,project,draw};
})(window);
