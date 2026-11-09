/* Original supplied cells: preserve transparent margins and authored jump motion. */
(function(W){'use strict';
const root='assets/01.ArtResources/01.Characters/02.Outside/04.Bubi/';
const clips={idle:['Box/bubi_box_idle.png',129,138,8,8,113],eyes:['Box/bubi_box_eyes.png',129,138,22,12,114],jump:['Box/bubi_box_jump.png',129,138,15,15/1.8,114],meow:['Box/bubi_box_meow.png',129,138,8,8,113],shaking:['Box/bubi_box_shaking.png',129,138,8,12,114],sleep:['Sleep/bubi_sleep.png',128,139,12,6,115],walk:['Walk/bubi_walk.png',128,139,6,10,114]};
for(const [id,[file,w,h,count,fps,foot]]of Object.entries(clips))clips[id]={asset:'bubi-'+id,src:root+file,w:w*count,h,fw:w,fh:h,frames:count,fps,foot};
const duration=id=>clips[id].frames/clips[id].fps;
function apply(data){for(const a of Object.values(clips))data.assets[a.asset]={src:a.src,w:a.w,h:a.h};}
function frame(id,time,once=false){const a=clips[id],n=once?Math.min(a.frames-1,Math.max(0,Math.floor(time*a.fps))):Math.floor(Math.max(0,time)*a.fps)%a.frames;return{asset:a.asset,x:n*a.fw,y:0,w:a.fw,h:a.fh,ppu:100,pivot:{x:.5,y:1-a.foot/a.fh},lightingId:'boobi'};}
function draw(ctx,position,images,m,id,x,y,time,glow,once=false,flip=false){const sp=frame(id,time,once),img=images.get(sp.asset);if(!img)return;const p=position(x,y),scale=Math.abs(position(x+1,y).x-p.x)/100,w=sp.w*scale,h=sp.h*scale;ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale(flip?-1:1,1);const lit=m.scene==='street'&&W.LunaCharacterLighting?.shade(m,img,sp,x,y,sp.w/100,sp.h/100,flip,null);if(lit)ctx.drawImage(lit.image,lit.x,lit.y,lit.w,lit.h,-w/2,-h*(1-sp.pivot.y),w,h);else ctx.drawImage(img,sp.x,sp.y,sp.w,sp.h,-w/2,-h*(1-sp.pivot.y),w,h);glow?.paint(ctx,img,sp,{name:id==='shaking'?'neighborhood-shaking-box':'bubi-'+id},x,y,w,h);ctx.restore();}
function local(n,x,y){const s=n.sprite;return{x:n.x+(x-s.w*s.pivot.x)/s.ppu*n.sx,y:n.y+(s.h*(1-s.pivot.y)-y)/s.ppu*n.sy};}
function box(){const n=W.LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-building');return local(n,660.5,452);}
function sofa(){const n=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='home-bedding');return local(n,67,36);}
// Clear only the old baked carton using the adjacent matching wall pixels.
// Paint at the building's own depth so characters and railings still cover it.
function cover(m,n,sprite){if(m.qa)return;const p=local(n,647,424);sprite({...n.sprite,x:619,y:424,w:27,h:28,pivot:{x:0,y:1}},p.x,p.y,n.sx,n.sy);const b=box();sprite({...frame('jump',0),noInteractionGlow:true},b.x,b.y,n.sx,n.sy);}
W.LunaBubiArt={clips,duration,apply,frame,draw,box,sofa,cover};apply(W.LUNA_OUTSIDE_DATA);
})(window);
