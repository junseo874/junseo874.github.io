/* Resolve art from the live game registry (including editor changes and web guest poses).
   Preparation is presentation-only: never roll a guest or advance the story here. */
(function(W){'use strict';
 function dayArt(day,D){
  const scenes=new Set(D.tables.scenes.filter(s=>Number(s.day)===Number(day)).map(s=>s.id));
  const actors=new Set(D.tables.steps.filter(s=>scenes.has(s.context)).map(s=>s.actor));
  const keys=new Set();
  for(const actor of actors)for(const pose of Object.values(D.characterLayers[actor]||{}))for(const key of pose)keys.add(key);
  for(const drink of D.tables.cocktails)if(Number(drink.unlock_day)<=Number(day)){
   for(const prefix of ['cocktail_','recipe_cocktail_','table_cocktail_'])keys.add(prefix+drink.id);
   keys.add('item_'+drink.glass);
  }
  // Daily unlocks can be the very first screen behind the door on days 1–3.
  for(const item of D.tables.shelf_items)if(item.kind==='ingredient'&&Number(item.unlock_day)===Number(day)){
   keys.add(D.assets['recipe_item_'+item.id]?'recipe_item_'+item.id:D.assets['item_'+item.id]?'item_'+item.id:'item_dummy');
  }
  const general=D.tables.random_waves.some(w=>Number(w.day)===Number(day));
  for(const key of Object.keys(D.assets))if(key.startsWith('table_empty_glass_')||(general&&key.startsWith('guest_')))keys.add(key);
  return [...new Set([...keys].map(k=>D.assets[k]?.src).filter(Boolean))];
 }
 async function prepare(day,D){
  await W.LunaResources.prepare('bar');
  await W.LunaResources.prepareImages(dayArt(day,D));
 }
 function anticipate(day,D){
  if(W.navigator.connection?.saveData)return;
  // Speculative failure must not interrupt the currently playable scene.
  // Successful images are kept on the ready list; the real doorway retries missing ones.
  prepare(day,D).catch(()=>{});
 }
 W.LunaBarRoomLoading={prepare,anticipate};
})(window);
