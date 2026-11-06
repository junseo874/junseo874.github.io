/* Native 631×270 current house. Split props align with the supplied full shot. */
(function(W){'use strict';
const root='assets/outside/chris-home/';
const sharedRoot='assets/01.ArtResources/02.Environments/03.Home/01.Sprites/';
const leftTrim=29,studioOriginX=-11.2+leftTrim*.04;
const webVariants=new Set(['nietzsche-the-gay-science.png']);
const assetPath=file=>(webVariants.has(file)?root:sharedRoot)+file;
// Regions are local to the current separate bed/wardrobe sprites.
const bed={rect:[0,0,91,26],edge:[[7,0],[24,0],[27,3],[76,4],[84,7],[90,10],[90,21],[85,25],[8,25],[2,22],[0,16],[0,8],[4,3]]};
const wardrobe={rect:[0,0,24,69],edge:[[2,0],[22,0],[24,2],[24,69],[0,69],[0,2]]};
// Foreground-local pixels: only the stacked books, never the glass table below.
const book={rect:[0,0,21,9],edge:[[1,0],[18,0],[19,1],[18,2],[20,3],[21,4],[21,9],[0,9],[0,3],[1,3],[1,2],[0,1]],cover:'home-book-cover'};
function bookTarget(){
 const n=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='home-book'),sp=n.sprite;
 const left=n.x-sp.w*sp.pivot.x/sp.ppu,top=n.y+sp.h*(1-sp.pivot.y)/sp.ppu;
 return {id:'home-book',label:'책 살펴보기',x:left+(book.rect[0]+book.rect[2]/2)/sp.ppu,y:-.7,top:top-book.rect[1]/sp.ppu,nodeName:n.name};
}
function bedTarget(){
 const n=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='home-bed'),sp=n.sprite;
 const left=n.x-sp.w*sp.pivot.x/sp.ppu,top=n.y+sp.h*(1-sp.pivot.y)/sp.ppu;
 return {id:'bed',label:'침대 살펴보기',x:left+sp.w/2/sp.ppu,y:-.7,top,nodeName:n.name,source:'home/bed'};
}
function wardrobeTarget(){
 const n=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='home-wardrobe'),sp=n.sprite;
 const left=n.x-sp.w*sp.pivot.x/sp.ppu,top=n.y+sp.h*(1-sp.pivot.y)/sp.ppu;
 return {id:'wardrobe',label:'옷장 살펴보기',x:left+sp.w/2/sp.ppu,y:-.7,top,nodeName:n.name,source:'home/wardrobe'};
}
const layers=[
 // Current/Chrishouse_BG_City is a full shot, not a separate moving skyline.
 // The city-only original remains necessary behind the new split room.
 {name:'home-city',file:'90.PreviousVersions/ver.4/Chrishouse_BG_City.png',x:0,y:0,w:631,h:270},
 {name:'main_bg',file:'Chrishouse.png',x:0,y:0,w:631,h:270},
 {name:'Room_Entrance',file:'Room_Entrance.png',x:2,y:146,w:26,h:87},
 {name:'Terrace_Entrance',file:'Terrace_Entrance.png',x:498,y:136,w:31,h:101},
 {name:'Hanger',file:'Hanger.png',x:483,y:151,w:23,h:86},
 {name:'IntractObjects',file:'IntractObjects_TV.png',x:272,y:161,w:54,h:40},
 {name:'home-tv-screen',file:'IntractObjects_TV_on.png',x:277,y:163,w:47,h:30},
 {name:'home-bed',file:'IntractObjects_Bed.png',x:51,y:186,w:91,h:26},
 {name:'home-wardrobe',file:'IntractObjects_Closet.png',x:145,y:151,w:24,h:69},
 {name:'home-bedding',file:'IntractObjects_Bedding.png',x:381,y:179,w:111,h:54},
 {name:'home-herb',file:'IntractObjects_Herbpot.png',x:414,y:162,w:11,h:19},
 {name:'ForeFore_Object',file:'ForeFore_Object.png',x:343,y:212,w:188,h:27},
 {name:'home-book',file:'ForeFore_Object_Book.png',x:355,y:207,w:21,h:9}
];
function apply(data){
 if(data.homeArtVersion==='current-house-631')return data;
 data.scenes.home.nodes=data.scenes.home.nodes.filter(n=>n.name!=='home-fence');
 const nodes=data.scenes.home.nodes,bg=nodes.find(n=>n.name==='main_bg');
 // The current source is cropped 29 pixels from the previous room's left.
 // Compensate in world space so doors, Luna and the waking cutscene stay put.
 const left=bg.x-bg.sprite.w*bg.sprite.pivot.x/100+leftTrim/100,top=bg.y+bg.sprite.h*(1-bg.sprite.pivot.y)/100;
 for(const [index,layer] of layers.entries()){
  let node=nodes.find(n=>n.name===layer.name);
  const asset=node?node.sprite.asset:layer.name;
  if(!node){node={...bg,id:layer.name,go:layer.name,name:layer.name,ancestry:[layer.name]};nodes.push(node);}
  data.assets[asset]={src:assetPath(layer.file),w:layer.name==='home-city'?643:layer.w,h:layer.h,source:'9_ArtResources/02.Environments/03.Home/01.Sprites/'+(layer.file.startsWith('90.')?'':'Current/')+layer.file};
  Object.assign(node,{x:left+(layer.x+layer.w/2)/100,y:top-(layer.y+layer.h/2)/100,layer:0,order:index,sx:1,sy:1,flip:false});
  if(W.LunaEngineWorld)Object.assign(node,W.LunaEngineWorld.homePlacement(layer,layers));
  node.sprite={asset,x:0,y:0,w:layer.w,h:layer.h,pivot:{x:.5,y:.5},ppu:100};
 }
 for(const n of [1,3])delete data.assets['home-room-'+n];
 data.assets['home-current-fullshot']={src:assetPath('Chrishouse_BG_City.png'),w:631,h:270,source:'Current house reference · full shot including city'};
 data.assets[book.cover]={src:root+'nietzsche-the-gay-science.png',w:1024,h:1536,source:'사용자 제공 책 표지 · 프리드리히 니체 — 《즐거운 학문》 · 원본 보존'};
 data.homeArtVersion='current-house-631';return data;
}
function cameraX(x,width=4.8){
 if(W.LunaEngineWorld)return W.LunaEngineWorld.confine('home',{x,y:0,w:width}).x;
 const bg=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg');
 const left=bg.x-bg.sprite.w*bg.sprite.pivot.x/bg.sprite.ppu;
 const right=left+bg.sprite.w/bg.sprite.ppu;
 return Math.max(left+width/2,Math.min(right-width/2,x));
}
function studioPose(layer){
 const n=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name===layer.name);
 const base=layers.find(l=>l.name==='Room_Entrance'),door=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name===base.name);
 const left=door.x-(base.x+base.w/2)/100,top=door.y+(base.y+base.h/2)/100;
 return{x:studioOriginX+(n.x-left)*4,y:5.4+(n.y-layer.h/200-top)*4};
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
 ctx.drawImage(image,0,237,531,1,x,y+h*238/270,w*531/631,h/270);
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
W.LunaHomeArt={root,assetPath,layers,studioOriginX,studioPose,bed,bedTarget,wardrobe,wardrobeTarget,book,bookTarget,apply,cameraX,cityCrop,paintCity,paintRoom,paintFence};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
