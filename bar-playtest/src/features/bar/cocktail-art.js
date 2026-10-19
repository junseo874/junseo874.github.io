/* Latest supplied cocktail art; keep imported table data and serving animations intact. */
(function(W){
'use strict';
const root='assets/cocktails/completed/';
const representatives={bottle_beer:['beer_final',200,345],screwdriver:['screwdriver_final',200,345],tequila_sunrise:['tequila_sunrise_final',216,411]};
const table={bottle_beer:'beer',dry_martini:'dry_martini',cosmopolitan:'cosmopolitan',screwdriver:'screwdriver',tequila_sunrise:'tequila_sunrise'};
function art(folder,name,w,h){return {src:root+folder+'/'+name+'.png',w,h,frames:1,frameWidth:w,frameHeight:h,fps:0,source:'Latest supplied cocktail artwork, 2026-10-18 / '+folder+'/'+name+'.png'};}
function apply(data){
 for(const [id,[name,w,h]] of Object.entries(representatives)){
  for(const prefix of ['cocktail_','recipe_cocktail_'])data.assets[prefix+id]=art('representative',name,w,h);
 }
 for(const [id,name] of Object.entries(table))data.assets['table_cocktail_'+id]=art('table',name,69,112);
 return data;
}
W.LunaCocktailArt={apply};
if(W.LUNA_DATA)apply(W.LUNA_DATA);
if(typeof module!=='undefined')module.exports=W.LunaCocktailArt;
})(typeof window==='undefined'?globalThis:window);
