/* Latest supplied cocktail art; keep imported table data and serving animations intact. */
(function(W){
'use strict';
function apply(data){
 // Paths and native dimensions belong to presentation/runtime-assets.json.
 // Keep the public hook for older entry points without reinstalling stale art.
 return data;
}
W.LunaCocktailArt={apply};
if(W.LUNA_DATA)apply(W.LUNA_DATA);
if(typeof module!=='undefined')module.exports=W.LunaCocktailArt;
})(typeof window==='undefined'?globalThis:window);
