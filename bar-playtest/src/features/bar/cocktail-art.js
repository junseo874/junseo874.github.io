/* Latest supplied cocktail art; keep imported table data and serving animations intact. */
(function(W){
'use strict';
function apply(data){
 // Paths and native dimensions belong to presentation/runtime-assets.json.
 // Keep the public hook for older entry points without reinstalling stale art.
 return data;
}
function presentation({D,g,L,esc,a,paintSource}){
  const itemName=id=>id==="opener"?L("병따개","Bottle opener"):g.text(g.t.shelf_items.find(i=>i.id===id),"name")||id;
  const labelType = t => ({
    pour: L('따르기', 'Pour'),
    fill_up: L('필업', 'Fill-up'),
    open: L('병따기', 'Open'),
    shake: L('쉐이킹', 'Shake'),
    stir: L('스터', 'Stir'),
    add: L('넣기', 'Add'),
    squeeze: L('스퀴즈', 'Squeeze'),
    powder: L('파우더', 'Powder')
  })[t] || t;
  function itemArt(id, cls = '', usage = 'shelf') {
    const label = itemName(id);
    const shelfIngredient = usage === 'recipe' && g.t.shelf_items.some(i=>i.id===id&&i.kind==='ingredient') && a('item_' + id);
    const key = (usage === 'recipe' && !shelfIngredient && a('recipe_item_' + id) ? 'recipe_item_' : usage === 'inventory' && a('inventory_item_' + id) ? 'inventory_item_' : 'item_') + id;
    return '<img class="' + cls + '" src="' + (a(key) || a('item_dummy')) + '" alt="' + esc(label) + '" draggable="false">';
  }
  function drinkArt(id, usage = 'hero', glassKind = null) {
    if (usage === 'empty') {
      const glass = glassKind || g.cocktail(id).glass;
      const resource = id === 'whiskey_sour' ? 'sour' : ({weizen:'beer',martini:'cocktail',flute:'flute',wine:'wine',old_fashioned:'old_fashioned',long_drink:'long_drink'})[glass] || 'long_drink';
      return '<img class="drink-art empty-glass" src="' + a('table_empty_glass_' + resource) + '" data-art-usage="empty" data-glass-kind="' + esc(glass) + '" alt="' + L('빈 잔', 'Empty glass') + '" draggable="false">';
    }
    const c = g.cocktail(id),
      key = usage === 'table' ? 'table_cocktail_' + id : usage === 'recipe' ? 'recipe_cocktail_' + id : 'cocktail_' + id;
    const art = D.assets[key] || D.assets['cocktail_' + id] || D.assets['recipe_cocktail_' + id] || D.assets['item_' + c.glass];
    const src = paintSource(art?.src);
    // Native 220×411 recipe sprites whose painted bounds are off the glass axis.
    const glassAxis = {gin_tonic: 91, tequila_sunrise: 93, johnny_old_fashioned: 99, red_wine: 111}[id];
    const bounds = usage === 'recipe' && art?.alphaBBox;
    const useGlassAxis = bounds && glassAxis && art === D.assets[key] && art.w === 220 && art.h === 411;
    const pivotX = bounds && (useGlassAxis ? glassAxis : (bounds[0] + bounds[2]) / 2);
    const sharedHighball = useGlassAxis && (id === 'gin_tonic' || id === 'tequila_sunrise');
    const pivotY = bounds && (sharedHighball ? art.h / 2 : (bounds[1] + bounds[3]) / 2);
    const center = bounds && art.w && art.h
      ? ` style="--recipe-pivot-x:${100 * pivotX / art.w}%;--recipe-pivot-y:${100 * pivotY / art.h}%"`
      : '';
    return '<img class="drink-art"' + center + ' src="' + src + '" data-art-usage="' + usage + '" alt="' + esc(g.name(id)) + '" draggable="false">';
  }
  function recipeLines(c) {
    return `<ul class="recipe-lines">${g.t.recipes.filter(r => r.context === c.id).map(r => `<li><span>${esc(itemName(r.ingredient))}</span><small>${r.qty ?? '—'} ${r.unit ?? ''} · ${labelType(r.action)}</small></li>`).join('')}</ul><div class="recipe-note">${L('잔', 'Glass')}: ${esc(g.name(c.glass))}<br>${L('제조 방법', 'Method')}: ${c.mix} ${c.mix === 'build' ? L('· 별도 믹스 도구 없음', '· no mixing tool') : ''}<br>${L('제한 시간', 'Time limit')}: ${c.time_limit_sec}s</div>`;
  }
  return {itemArt,drinkArt,recipeLines,labelType,itemName};
}
W.LunaCocktailArt={apply,presentation};
if(W.LUNA_DATA)apply(W.LUNA_DATA);
if(typeof module!=='undefined')module.exports=W.LunaCocktailArt;
})(typeof window==='undefined'?globalThis:window);
