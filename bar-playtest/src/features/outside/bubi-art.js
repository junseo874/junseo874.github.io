/* Original supplied cells: preserve transparent margins and authored jump motion. */
(function(W){'use strict';
const root='assets/01.ArtResources/01.Characters/02.Outside/04.Bubi/';
const clips={idle:['Box/bubi_box_idle.png',129,138,8,8,113],eyes:['Box/bubi_box_eyes.png',129,138,22,12,114],jump:['Box/bubi_box_jump.png',129,138,15,15/1.8,114],meow:['Box/bubi_box_meow.png',129,138,8,8,113],shaking:['Box/bubi_box_shaking.png',129,138,8,12,114],sleep:['Sleep/bubi_sleep.png',128,138,12,6,114],walk:['Walk/bubi_walk.png',128,138,6,10,113]};
for(const [id,[file,w,h,count,fps,foot]]of Object.entries(clips))clips[id]={asset:'bubi-'+id,src:root+file,w:w*count,h,fw:w,fh:h,frames:count,fps,foot};
// In the last jump cell the cat is 24 pixels right of the idle/meow artwork.
const landingPixelsX=24;
const duration=id=>clips[id].frames/clips[id].fps;
function apply(data){for(const a of Object.values(clips))data.assets[a.asset]={src:a.src,w:a.w,h:a.h};}
function frame(id,time,once=false,atBox=false){
 const a=clips[id],step=Math.floor(Math.max(0,time)*a.fps),n=once?Math.min(a.frames-1,step):step%a.frames;
 const landed=atBox&&(id==='idle'||id==='meow');
 const pivot={x:.5-(landed?landingPixelsX/a.fw:0),y:1-(landed?clips.jump.foot:a.foot)/a.fh};
 return{asset:a.asset,x:n*a.fw,y:0,w:a.fw,h:a.fh,ppu:100,pivot,lightingId:'boobi'};
}
function draw(ctx,position,images,m,id,x,y,time,glow,once=false,flip=false){
 const sp=frame(id,time,once,m.scene==='street'),img=images.get(sp.asset);if(!img)return;
 const p=position(x,y),scale=Math.abs(position(x+1,y).x-p.x)/sp.ppu,w=sp.w*scale,h=sp.h*scale;
 const left=-w*sp.pivot.x,top=-h*(1-sp.pivot.y);
 let px=Math.round(p.x),py=Math.round(p.y);
 if(m.scene==='street'){
  // Snap the common box-cell corner, including at fractional display scales.
  const factor=ctx.getTransform().a,half=w/2,above=clips.jump.foot*scale;
  px=Math.round((p.x-half)*factor)/factor+half;
  py=Math.round((p.y-above)*factor)/factor+above;
 }
 ctx.save();ctx.translate(px,py);ctx.scale(flip?-1:1,1);
 const lit=m.scene==='street'&&W.LunaCharacterLighting?.shade(m,img,sp,x,y,sp.w/100,sp.h/100,flip,null);
 if(lit)ctx.drawImage(lit.image,lit.x,lit.y,lit.w,lit.h,left,top,w,h);
 else ctx.drawImage(img,sp.x,sp.y,sp.w,sp.h,left,top,w,h);
 glow?.paint(ctx,img,sp,{name:id==='shaking'?'neighborhood-shaking-box':'bubi-'+id},x,y,w,h);ctx.restore();
}
function local(n,x,y){const s=n.sprite;return{x:n.x+(x-s.w*s.pivot.x)/s.ppu*n.sx,y:n.y+(s.h*(1-s.pivot.y)-y)/s.ppu*n.sy};}
function box(){const n=W.LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-building');const p=local(n,660.5,452);return W.LunaNpcScene?.adjust('box',p)??p;}
function landing(){
 const b=box();return{x:b.x+landingPixelsX/100,y:b.y+(clips.jump.foot-clips.idle.foot)/100};
}
function sofa(){const n=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='home-bedding');const p=local(n,67,36);return W.LunaNpcScene?.adjust('home-cat',p)??p;}
// The refreshed facade already has a clean wall behind the separate carton.
// Paint at the building's own depth so characters and railings still cover it.
function cover(m,n,sprite){if(m.qa)return;const b=box();sprite({...frame('jump',0),noInteractionGlow:true},b.x,b.y,n.sx,n.sy);}
W.LunaBubiArt={clips,duration,apply,frame,draw,box,landing,sofa,cover};apply(W.LUNA_OUTSIDE_DATA);
})(window);
