(function(W){
'use strict';
// Fixed foot anchors in area_A_foreground_building.png. The upper corridor's
// sill is row 320; leave the diagonal brace to the left and the lift to the right.
// Three groups (2 / 3 / 2): a tight left pair, an asymmetric middle trio,
// and the existing right pair. Foot spacing is 15 / 18,24 / 24 pixels.
const perches=[517,532,600,618,642,699,723],footRow=321;
const source=W.LunaBirdSprites;
function apply(data){
 for(const kind of ['crow','pigeon'])data.assets['corridor-'+kind]={
  src:source.assets[kind],w:source.sheet.width*source.sheet.frames,h:source.sheet.height,
  source:kind==='crow'?'User supplied Crow_idle.png':'User supplied Pigeon_idle.png'
 };
}
function poses(model,building,art=building){
 if(model?.scene!=='street'||model.qa||!building?.active)return [];
 const kind=W.LunaOutsideRain.wet(model)?'crow':'pigeon',crop=source.crops[kind],sheet=source.sheet;
 const still=W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const sp=building.sprite,left=art.x-sp.w*sp.pivot.x*building.sx/sp.ppu;
 const top=art.y+sp.h*(1-sp.pivot.y)*building.sy/sp.ppu;
 return perches.map((pixelX,i)=>{
  const frame=source.frameAt((model.time||0)+i*.37,still);
  return {kind,frame,x:left+pixelX*building.sx/sp.ppu,y:top-footRow*building.sy/sp.ppu,
   sprite:{asset:'corridor-'+kind,x:frame*sheet.width+crop.x,y:crop.y,w:crop.w,h:crop.h,
    ppu:sp.ppu,pivot:{x:(crop.footX-crop.x)/crop.w,y:0}}};
 });
}
function draw(model,building,art,sprite){
 for(const bird of poses(model,building,art))
  sprite(bird.sprite,bird.x,bird.y,building.sx,building.sy,false);
}
W.LunaCorridorBirds={apply,poses,draw,perches,footRow};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
