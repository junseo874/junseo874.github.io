/* OutSide.unity Fire / FX_Mat_Fire / fire.shadergraph.
 * Native world-grid sampling, stepped time and split barrel occlusion.
 * Only browser-incompatible TGA storage is converted; source samples are intact. */
(function(W){'use strict';
const D=()=>W.LUNA_BARREL_FIRE,clamp=v=>Math.max(0,Math.min(1,v));
// Warm HDR presentation from FX_Fire.gif; the high 10x core still clips white.
// Reuse this temperature for the retained web character-light bridge.
const temperature=[1,.48,.12];
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const display=v=>v<=.0031308?v*12.92:1.055*Math.max(0,v)**(1/2.4)-.055;
let prepared=null,cached=null,core=null,light=null;
function apply(data){
 const d=D();if(!d||data.barrelFireVersion===d.version)return data;
 Object.assign(data.assets,d.assets);
 const back=data.scenes.street.nodes.find(n=>n.name==='B_Obects');
 Object.assign(back,{x:d.back.x,y:d.back.y,sx:d.back.sx,sy:d.back.sy,sprite:{...d.back.sprite,wireOffsetX:6}});
 data.scenes.street.nodes.push({...back,...d.front,id:d.front.id,name:'barrel-front',layer:9,order:d.front.order,ancestry:['BG','Foreground'],sprite:{...d.front.sprite}});
 data.scenes.street.nodes.push({...back,id:'engine-barrel-fire',name:'barrel-fire',x:d.fire.x,y:d.fire.y,sx:d.fire.sx,sy:d.fire.sy,layer:9,order:d.fire.order,ancestry:['BG','Foreground'],sprite:{asset:'street-fire-aura',x:0,y:0,w:100,h:100,ppu:100,pivot:{x:.5,y:.5}}});
 data.barrelFireVersion=d.version;return data;
}
function clock(time,still=false){return still?1.25:Math.floor(Math.max(0,time)*D().props._Anim_Fps)/D().props._Anim_Fps;}
function energy(time){const t=clock(time);return .87+.065*Math.sin(t*5.3)+.045*Math.sin(t*8.7+1.4)+.02*Math.sin(t*13.1);}
function placement(data=W.LUNA_OUTSIDE_DATA){
 const d=D(),n=data?.scenes.street.nodes.find(n=>n.name==='B_Obects');if(!n)return null;
 const rx=n.sx/d.back.sx,ry=n.sy/d.back.sy,flip=n.flip?-1:1;
 return {x:n.x+(d.fire.x-d.back.x)*rx*flip,y:n.y+(d.fire.y-d.back.y)*ry,sx:d.fire.sx*rx*flip,sy:d.fire.sy*ry,active:n.active!==false};
}
function worldLight(model){
 const p=placement();if(!p||!W.LUNA_CHARACTER_SHADOWS)return null;
 const still=!!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 // The engine fire is unlit. Retain the web's local character/shadow bridge,
 // anchored to the new flame, without importing unrelated scene lighting.
 return {id:'barrel-fire',name:'Barrel fire',type:0,ancestry:['B_Obects'],x:p.x,y:p.y,active:p.active&&model.scene==='street'&&!model.qa,localFalloff:true,color:temperature,intensity:3,radius:2.6,priority:1,layers:[W.LUNA_CHARACTER_SHADOWS.player.sortingLayer],gain:energy(clock(model.time||0,still))};
}
function prepare(images){
 if(prepared)return true;const d=D(),out={};
 for(const [name,t] of Object.entries(d.textures)){
  const img=images.get(t.asset);if(!img)return false;
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
  const bytes=cx.getImageData(0,0,c.width,c.height).data,values=new Float32Array(c.width*c.height*2);
  for(let i=0;i<c.width*c.height;i++)for(let k=0;k<2;k++)values[i*2+k]=t.sRGB?linear(bytes[i*4+k]/255):bytes[i*4+k]/255;
  out[name]={w:c.width,h:c.height,values};
 }
 prepared=out;return true;
}
function sample(name,u,v,channel=0){
 const tex=prepared[name],x=(u-Math.floor(u))*tex.w-.5,y=(1-(v-Math.floor(v)))*tex.h-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const at=(a,b)=>tex.values[(((b%tex.h+tex.h)%tex.h)*tex.w+(a%tex.w+tex.w)%tex.w)*2+channel];
 return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
}
function shade(u,v,t){
 const p=D().props,c=D().constants;
 const cu=u*p._FlowX+t*p._speedX,cv=v*p._FlowY+t*p._speedY;
 const du=u*p._Flow_01_X+t*p._speed_02_X,dv=v*p._Flow_01_Y+t*p._speed_02_Y;
 const a=sample('aura',u*p._Tex_D_FlowX+t*p._Tex_D_speedX+c.distortion*sample('cloud',cu,cv),v*p._Tex_D_FlowY+t*p._Tex_D_speedY+c.distortion*sample('cloud',cu,cv,1));
 const b=sample('aura',u*p._Tex_D_02_FlowX+t*p._Tex_D_02_speedX+c.distortion2*sample('distortion',du,dv),v*p._Tex_D_02_FlowY+t*p._Tex_D_02_speedY+c.distortion2*sample('distortion',du,dv,1));
 const sum=a**c.auraPower+b,mask=sum+v,h=clamp(mask);
 // UV1.z is zero on Unity's Square sprite. _Pos_Mask is disconnected in
 // the authored graph. Use absolute bases for the negative masked UV range;
 // this matches its visible smoke on the reference GPU without JS NaNs.
 const intensity=c.hotGain*Math.round(h**c.hotPower)+c.warmGain*Math.round(h**c.warmPower)+Math.abs(v)**c.basePower+Math.abs(sum*v)**c.bodyPower;
 return {intensity:Number.isFinite(intensity)?Math.max(0,intensity):0,mask};
}
function render(time,still=false,images){
 if(images&&!prepare(images))return null;if(!prepared)return null;
 const d=D(),p=d.props,f=placement(),t=clock(time,still),pixel=p._Pixel_Size;
 if(!f)return null;const cx=p._Snap_Position?Math.round(f.x/pixel)*pixel:f.x,cy=p._Snap_Position?Math.round(f.y/pixel)*pixel:f.y;
 const left=Math.floor((cx-Math.abs(f.sx)/2)/pixel)*pixel,top=Math.ceil((cy+Math.abs(f.sy)/2)/pixel)*pixel,w=Math.ceil((cx+Math.abs(f.sx)/2-left)/pixel),h=Math.ceil((top-cy+Math.abs(f.sy)/2)/pixel);
 const key=[t,cx,cy,f.sx,f.sy].join(':');if(cached?.key===key)return cached;
 if(!core){core=document.createElement('canvas');light=document.createElement('canvas');}
 if(core.width!==w||core.height!==h){core.width=w;core.height=h;}
 const ctx=core.getContext('2d'),out=ctx.createImageData(w,h);let total=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const wx=left+(x+.5)*pixel,wy=top-(y+.5)*pixel,ux=(wx-cx)/f.sx+.5,uy=(wy-cy)/f.sy+.5;
  if(ux<0||ux>1||uy<0||uy>1)continue;
  const s=shade(ux-p._Offset_X,uy-p._Offset_Y,t),a=clamp(s.intensity),i=(y*w+x)*4;if(a<=0)continue;
  for(const [k,ch]of ['r','g','b'].entries()){
   const base=linear(d.colors.base[ch]),hot=linear(d.colors.hot[ch]);
   out.data[i+k]=Math.round(clamp(display(Math.max(0,base+(hot-base)*s.mask)*s.intensity*temperature[k]))*255);
  }
  out.data[i+3]=Math.round(a*255);total+=a;
 }
 ctx.putImageData(out,0,0);
 // Preserve HDR spill in a small local field: Canvas clips the graph's 10x
 // hot core. No full-scene readback or extra atmosphere pass is required.
 const size=96;if(light.width!==size){light.width=size;light.height=size;}
 const lc=light.getContext('2d');lc.clearRect(0,0,size,size);const e=energy(t),g=lc.createRadialGradient(48,48,1,48,48,45);
 g.addColorStop(0,`rgba(255,172,64,${.35*e})`);g.addColorStop(.23,`rgba(255,137,45,${.18*e})`);g.addColorStop(1,'rgba(255,108,24,0)');lc.fillStyle=g;lc.fillRect(0,0,size,size);
 cached={key,stamp:Math.floor(t*p._Anim_Fps),core,light,energy:e,left,top,pixel,w,h,total};return cached;
}
function draw(ctx,node,model,cam,images,surface){
 const at=placement(),s=1280/cam.w;
 if(!node.active||!at?.active||model.qa)return;
 const center=W.LunaPixelCamera.position(at.x,at.y,cam);
 if(center.x+Math.abs(at.sx)*s<0||center.x-Math.abs(at.sx)*s>1280||center.y+Math.abs(at.sy)*s<0||center.y-Math.abs(at.sy)*s>720)return;
 const f=render(model.time,!!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches,images);if(!f)return;
 const sp={w:f.w,h:f.h,ppu:1/f.pixel,pivot:{x:0,y:1}},p=W.LunaPixelCamera.sprite(sp,f.left,f.top,1,1,false,cam,surface);
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(f.core,p.x,p.y,p.w,p.h);ctx.restore();
}
function paintSprite(ctx,key,sp,w,h,time,still=false,images){
 if(key!=='B_Obects'&&key!=='barrel-front')return;
 const d=D(),n=key==='B_Obects'?d.back:d.front,s=w/sp.w*sp.ppu;
 const x=(d.fire.x-n.x)*s,y=-(d.fire.y-n.y)*s,m=ctx.getTransform(),cx=m.a*x+m.c*y+m.e,cy=m.b*x+m.d*y+m.f,r=.48*s*Math.max(Math.abs(m.a),Math.abs(m.d));
 if(cx+r<0||cx-r>ctx.canvas.width||cy+r<0||cy-r>ctx.canvas.height)return;
 const f=render(time,still,images);if(!f)return;
 ctx.save();if(key==='barrel-front'){ctx.beginPath();ctx.rect(-w*sp.pivot.x,-h*(1-sp.pivot.y),w,h);ctx.clip();}
 ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;ctx.drawImage(f.light,x-.48*s,y-.48*s,.96*s,.96*s);ctx.restore();
}
W.LunaBarrelFire={apply,prepare,render,shade,sample,clock,energy,worldLight,placement,paintSprite,draw,get fps(){return D().props._Anim_Fps;}};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
