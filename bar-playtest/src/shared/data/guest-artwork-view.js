(function(root){'use strict';
function applyGuestArtwork(tables,presentation){
 // Guest CSV IDs and Guest/... addresses are Unity's. Translate only the web
 // rendering view using the filenames bound in Unity's Addressables group.
 const guestKeys=new Map();
 for(const part of tables.guest_parts){
  const address=part.sprite?.replace(/^Guest\//,''),match=/^(.+)_([mf])(?:_(\d+))?$/.exec(address||'');
  if(!match||match[2]!==part.gender)throw Error('Invalid guest address: '+part.sprite);
  const [,slot,sex,n]=match;
  const art=slot==='necklace'?'Acc_1':slot==='outerwear'?'Acc_2':slot==='arm_accessory'?(sex==='m'?'Acc_2':'Acc_3'):({outfit:'top',eyebrows:'eyebrow'}[slot]||slot)+(n?'_'+n:'');
  const key='guest_'+sex+'_'+art;if(!presentation.assets[key])throw Error('Missing guest graphic: '+part.sprite);
  guestKeys.set(part.id,key);part.id=key;part.sprite=presentation.assets[key].src;
 }
 for(const pair of tables.guest_exclusions)for(const field of ['a','b']){const key=guestKeys.get(pair[field]);if(!key)throw Error('Unknown excluded guest part: '+pair[field]);pair[field]=key;}
 for(const row of tables.guest_settings)for(const field of Object.keys(row))if(field.startsWith('defaults.')&&row[field])row[field]=guestKeys.get(row[field])||row[field];
}
if(typeof module!=='undefined'&&module.exports)module.exports=applyGuestArtwork;else root.LunaGuestArtworkView=applyGuestArtwork;
})(typeof window==='undefined'?globalThis:window);
