/* Native 643×270 supplied house sheets; placements measured from the full shot. */
(function(W){'use strict';
const root='assets/outside/chris-home/';
const layers=[
 {name:'home-city',file:'Chrishouse_BG_City.png',x:0,y:0,w:643,h:270},
 {name:'main_bg',file:'Chrishouse2.png',x:0,y:0,w:643,h:270},
 {name:'Room_Entrance',file:'Room_Entrance.png',x:32,y:147,w:26,h:87},
 {name:'Terrace_Entrance',file:'Terrace_Entrance.png',x:527,y:137,w:31,h:101},
 {name:'Hanger',file:'Hanger.png',x:512,y:152,w:21,h:84},
 {name:'IntractObjects',file:'IntractObjects_TV.png',x:301,y:158,w:53,h:34},
 {name:'home-bedding',file:'IntractObjects_Bedding.png',x:427,y:179,w:83,h:53},
 {name:'home-herb',file:'IntractObjects_Herbpot.png',x:445,y:164,w:11,h:19},
 {name:'ForeFore_Object',file:'ForeFore_Object.png',x:378,y:198,w:199,h:55},
 {name:'home-fence',file:'123.png',x:585,y:198,w:56,h:55}
];
function apply(data){
 if(data.homeArtVersion==='supplied-house')return data;
 const nodes=data.scenes.home.nodes,bg=nodes.find(n=>n.name==='main_bg');
 const left=bg.x-bg.sprite.w*bg.sprite.pivot.x/100,top=bg.y+bg.sprite.h*(1-bg.sprite.pivot.y)/100;
 for(const [index,layer] of layers.entries()){
  let node=nodes.find(n=>n.name===layer.name);
  const asset=node?node.sprite.asset:layer.name;
  if(!node){node={...bg,id:layer.name,go:layer.name,name:layer.name,ancestry:[layer.name]};nodes.push(node);}
  data.assets[asset]={src:root+layer.file,w:layer.name==='home-city'?643:layer.w,h:layer.h,source:'User supplied 크리스집/'+layer.file};
  Object.assign(node,{x:left+(layer.x+layer.w/2)/100,y:top-(layer.y+layer.h/2)/100,layer:0,order:index,sx:1,sy:1,flip:false});
  node.sprite={asset,x:0,y:0,w:layer.w,h:layer.h,pivot:{x:.5,y:.5},ppu:100};
 }
 // Alternate authored room states are retained without introducing a new cycle.
 for(const n of [1,3])data.assets['home-room-'+n]={src:root+'Chrishouse'+n+'.png',w:643,h:270,source:'User supplied 크리스집/Chrishouse'+n+'.png'};
 data.homeArtVersion='supplied-house';return data;
}
function cameraX(x,width=4.8){
 const bg=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg');
 const left=bg.x-bg.sprite.w*bg.sprite.pivot.x/bg.sprite.ppu;
 const right=left+bg.sprite.w/bg.sprite.ppu;
 return Math.max(left+width/2,Math.min(right-width/2,x));
}
// Keep the city inside its authored rectangle. Source overscan avoids exposed
// edges while the distant skyline follows only a small fraction of camera travel.
function cityCrop(cameraOffset,reduced=false){
 const offset=reduced?0:Math.max(-1.5,Math.min(1.5,cameraOffset));
 return {x:20-offset*12,y:0,w:603,h:270};
}
function paintCity(ctx,image,x,y,w,h,cameraOffset){
 const crop=cityCrop(cameraOffset,W.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 ctx.drawImage(image,crop.x,crop.y,crop.w,crop.h,x,y,w,h);
}
// The supplied room has a one-pixel cyan export fringe along the floor.
// Extend the adjacent floor pixel instead, in source space, so zooming cannot
// magnify it into a bright scanline. Share this with the waking cutscene.
function paintRoom(ctx,image,x,y,w,h){
 ctx.drawImage(image,x,y,w,h);
 ctx.drawImage(image,26,237,534,1,x+w*26/643,y+h*238/270,w*534/643,h/270);
}
// Fence-local coordinates: keep the separate rail at its authored position, but
// join its footing to the room floor and occlude the city below that floor.
function paintFence(ctx,image,x,y,w,h){
 ctx.drawImage(image,x,y,w,h);
 ctx.save();ctx.translate(x,y);ctx.scale(w/56,h/55);
 ctx.fillStyle='#010107';ctx.fillRect(-27,41,85,31);
 ctx.fillStyle='#6c6a82';ctx.fillRect(-27,38,85,2);
 ctx.fillStyle='#6c6a82';ctx.fillRect(-27,40,85,1);
 ctx.restore();
}
W.LunaHomeArt={root,layers,apply,cameraX,cityCrop,paintCity,paintRoom,paintFence};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
