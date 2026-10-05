/* Prefer registered artwork for the same item over placeholder usage variants. */
(function(W){
'use strict';
const prefixes=['item_','recipe_item_','inventory_item_'];
function temporary(a){return !a?.src||/더미|dummy|임시|user supplied/i.test(a.source||'')||/campaign\/(johnny-|tom-|shiba-)/i.test(a.src||'');}
function apply(data){
 const assets=data.assets,changes=[];
 for(const id of new Set([...(data.tables.shelf_items||[]).map(i=>i.id),'opener'])){
  const keys=prefixes.map(p=>p+id),sourceKey=keys.find(k=>assets[k]&&!assets[k].sharedFrom&&!temporary(assets[k]));
  if(!sourceKey)continue;
  for(const key of keys){if(key===sourceKey||assets[key]&&!temporary(assets[key]))continue;
   assets[key]={...assets[sourceKey],sharedFrom:sourceKey};changes.push({key,sourceKey});
  }
 }
 return changes;
}
W.LunaItemArtReuse={apply,temporary};if(W.LUNA_DATA)apply(W.LUNA_DATA);
if(typeof module!=='undefined')module.exports=W.LunaItemArtReuse;
})(typeof window==='undefined'?globalThis:window);
