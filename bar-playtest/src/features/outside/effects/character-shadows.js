/* Engine OutsideCharacterShadow / OutsideShadowLight port. World-space,
 * frame-alpha silhouettes; every local emitter contributes independently.
 * Unblocked light and authored fill volumes reduce shadow contrast. Scene art overrides supply the moving receiver transform. */
(function(W){'use strict';
const states=new WeakMap(),D=()=>W.LUNA_CHARACTER_SHADOWS,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function liftPoint(x,y,m){const l=W.LunaResidence.layout;return {x:l.elevatorX+(x+12.18)*.6,y:m.elevatorY+(y+1.09)*.6};}
function storefrontOffset(){const node=W.LUNA_OUTSIDE_DATA?.scenes.street.nodes.find(n=>n.name==='B_Fore_Building_1'),source=W.LUNA_STREET_EFFECTS?.parent;return node&&source?{x:node.x-source.x,y:node.y-source.y}:{x:0,y:0};}
function lights(m){return D().lights.map(original=>{const current=W.LUNA_SHADOW_LIGHTING?.casters.find(l=>l.id===original.id),l={...original,...current},offset=l.storefront?storefrontOffset():{x:0,y:0};return {...l,x:l.x+offset.x,y:l.y+offset.y,...(l.ancestry.includes('Elevator')?liftPoint(l.x,l.y,m):{}),gain:W.LunaStreetEngineEffects?.lightLevel(l.id,m.time||0,!!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches)??1};});}
function receivers(m){return D().receivers.filter(r=>r.active).map(r=>{
 if(r.ancestry.includes('Elevator')){const a=liftPoint(r.rect[0],r.rect[1],m),b=liftPoint(r.rect[2],r.rect[3],m);return {...r,rect:[a.x,a.y,b.x,b.y],surface:liftPoint(r.x,r.surface,m).y,tolerance:r.tolerance*.6};}
 if(r.name==='2F'){const dy=W.LunaResidence.layout.upperY+D().player.foot.y-r.surface;return {...r,rect:[r.rect[0],r.rect[1]+dy,r.rect[2],r.rect[3]+dy],surface:r.surface+dy};}
 return r;
 });}
function foot(m){const p=D().player.foot;return {x:m.x+(m.facing>0?-p.x:p.x),y:m.y+p.y};}
function receiverAt(p,list){let best=null,distance=Infinity;for(const r of list){const d=Math.abs(p.y-r.surface);if(p.x>=r.rect[0]&&p.x<=r.rect[2]&&d<=r.tolerance&&d<distance){distance=d;best=r;}}return best;}
function influence(p,l){if(!l||!l.active||l.type===4||!l.layers.includes(D().player.sortingLayer))return 0;const gray=l.color[0]*.299+l.color[1]*.587+l.color[2]*.114;return l.priority*clamp(l.intensity*l.gain*gray,0,4)*clamp(1-Math.hypot(p.x-l.x,p.y-l.y)/Math.max(.1,l.radius),0,1)**2;}
function direction(p,l,height){let x=clamp((p.x-l.x)/Math.max(.25,l.y-p.y),-3,3),y=-D().player.flatten;const length=Math.hypot(x,y)*Math.max(.01,height);if(length>D().player.maxLength){x*=D().player.maxLength/length;y*=D().player.maxLength/length;}return [x,y];}
const luminance=l=>l.color[0]*.299+l.color[1]*.587+l.color[2]*.114;
const power=l=>l.active?clamp(l.intensity*(l.gain??1)*luminance(l),0,4):0;
function coverage(p,l){
 let inside=false,distance=Infinity;const points=l.points;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i];if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);distance=Math.min(distance,Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy));
 }
 if(inside)return 1;const t=clamp(1-distance/Math.max(.001,l.falloff),0,1);return t*t*(3-2*t);
}
function fillVolumes(m){return (W.LUNA_SHADOW_LIGHTING?.illumination||[]).map(l=>{
 const offset=l.storefront?storefrontOffset():{x:0,y:0};
 const points=l.ancestry.includes('Elevator')?l.points.map(([x,y])=>{const p=liftPoint(x,y,m);return [p.x,p.y];}):l.points.map(([x,y])=>[x+offset.x,y+offset.y]);
 const falloff=l.falloff*(l.ancestry.includes('Elevator')?.6:1);
 return {...l,points,falloff,bounds:[Math.min(...points.map(p=>p[0]))-falloff,Math.min(...points.map(p=>p[1]))-falloff,Math.max(...points.map(p=>p[0]))+falloff,Math.max(...points.map(p=>p[1]))+falloff],gain:W.LunaStreetEngineEffects?.lightLevel(l.id,m.time||0,!!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches)??1};
});}
function fillAt(p,volumes){let sum=0;for(const l of volumes){const b=l.bounds;if(p.x<b[0]||p.y<b[1]||p.x>b[2]||p.y>b[3])continue;sum+=power(l)*coverage(p,l);}return sum;}
function ambient(){return Math.max(.08,(W.LUNA_SHADOW_LIGHTING?.globals||[]).reduce((sum,l)=>sum+power(l),0)*.3);}
function fillField(p,volumes,cache){
 // Fixed world grid: walking/camera movement never scrolls a noise mask.
 const step=.05,width=53,height=11,x=Math.floor((p.x-1.3)/step)*step,y=Math.floor((p.y-.45)/step)*step;
 const local=volumes.filter(l=>l.bounds[0]<=x+(width-1)*step&&l.bounds[2]>=x&&l.bounds[1]<=y+(height-1)*step&&l.bounds[3]>=y),data=new Uint8Array(width*height*4);
 // Polygon distances are geometric; blinking changes power, not coverage.
 // Cache only this small world-grid window, never an unbounded walked trail.
 if(cache&&(cache.x!==x||cache.y!==y)){cache.x=x;cache.y=y;cache.samples=new Map();}
 const samples=cache?.samples||new Map(),live=new Set();
 const fields=local.map(l=>{
  const key=JSON.stringify([l.id,l.points,l.falloff,l.bounds]);live.add(key);let weights=samples.get(key);
  if(!weights){weights=new Float64Array(width*height);for(let row=0;row<height;row++)for(let col=0;col<width;col++){
   const p={x:x+col*step,y:y+row*step},b=l.bounds;
   if(p.x>=b[0]&&p.y>=b[1]&&p.x<=b[2]&&p.y<=b[3])weights[row*width+col]=coverage(p,l);
  }samples.set(key,weights);}return {weights,power:power(l)};
 });
 for(const key of samples.keys())if(!live.has(key))samples.delete(key);
 for(let n=0;n<width*height;n++){let sum=0;for(const f of fields)sum+=f.power*f.weights[n];const value=Math.round(clamp(sum/16,0,1)*65535),i=n*4;data[i]=value>>8;data[i+1]=value&255;data[i+3]=255;}

 return {data,width,height,area:[x,y,step,step]};
}
function advance(m){
 const now=m.time||0;let s=states.get(m);
 if(!s||now<s.time||s.scene!==m.scene){s={time:now,scene:m.scene,slots:D().lights.map(l=>({id:l.id,energy:0})),fillGains:new Map(),receiver:null};states.set(m,s);}
 const dt=clamp(now-s.time,0,.1),blend=1-Math.exp(-dt/.09);s.time=now;
 if(m.scene!=='street'||m.qa){s.receiver=null;return s;}
 const p=foot(m),list=lights(m);s.receiver=receiverAt(p,receivers(m));s.ambient=ambient();
 for(const d of s.slots){const l=list.find(l=>l.id===d.id);d.light=l;const target=l&&l.layers.includes(D().player.sortingLayer)?power(l)*l.priority:0;d.energy+=(target-d.energy)*blend;d.influence=influence(p,l);}
 s.fill=fillVolumes(m).map(l=>{const old=s.fillGains.get(l.id)??0,gain=old+(l.gain-old)*blend;s.fillGains.set(l.id,gain);return {...l,gain};});
 return s;
}
function draw(ctx,m,cam,images,surface,renderer){
 const s=advance(m);if(!s.receiver||!renderer||renderer.gl.isContextLost())return false;
 const animation=W.LUNA_OUTSIDE_DATA.animations[m.anim],sp=animation?.frames[Math.floor(m.animTime*animation.fps)%animation.frames.length],img=sp&&images.get(sp.asset);if(!img)return false;
 const cfg=D().player,flip=m.facing>0,p=W.LunaPixelCamera.sprite(sp,m.x,m.y,1,1,flip,cam,surface),scale=1280/cam.w;
 // Share the exact snapped sprite pivot with the visible actor. The fixed
 // engine foot anchor keeps run-frame foot lifts from moving the floor plane.
 const pivot={x:cam.x+(p.x-640)/scale,y:cam.y+(360-p.y)/scale};
 const anchor={x:pivot.x+(flip?-cfg.foot.x:cfg.foot.x),y:pivot.y+cfg.foot.y};
 const height=Math.max(.05,p.h/scale*(1-sp.pivot.y)-cfg.foot.y);
 const direct=s.slots.reduce((sum,d)=>sum+d.energy*clamp(1-Math.hypot(anchor.x-d.light.x,anchor.y-d.light.y)/d.light.radius,0,1)**2,0);
 const contact=[(flip?-1:1)*cfg.contactLean*cfg.contactFlatten,-cfg.contactFlatten,cfg.contactOpacity/(1+.35*(direct+fillAt(anchor,s.fill))),Math.max(.05,height*cfg.contactFlatten*1.5)];
 const projections=s.slots.map(d=>[...direction(anchor,d.light,height),cfg.opacity,/^Atmospheric/.test(d.light.name)?3:cfg.softness]);
 const emitters=s.slots.map(d=>[d.light.x,d.light.y,d.light.radius,d.energy]);
 renderer.characterShadow(ctx,cam,{image:img,sp,pivot,width:p.w/scale,height:p.h/scale,foot:anchor,flip,rect:s.receiver.rect,projections,emitters,contact,ambient:s.ambient,maxLength:cfg.maxLength,field:fillField(anchor,s.fill,s.fieldCache??={}),softness:cfg.softness,color:cfg.color});return true;
}
W.LunaCharacterShadows={lights,receivers,foot,receiverAt,influence,direction,coverage,fillVolumes,fillAt,fillField,advance,draw,inspect:m=>states.get(m)||null};
})(typeof window==='undefined'?globalThis:window);
