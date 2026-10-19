/* Street-wall receivers measured from OutSide.unity Atmospheric Light
 * paths, converted to the current 1293 x 310 storefront atlas (100 PPU).
 * Lighting is baked once into a transparent native-pixel overlay, never a
 * screen-sized wash. The source art and all gameplay positions stay intact. */
(function(W){'use strict';
const regions=[{"id":"convenience-wall","source":"Atmospheric Light (8)","points":[[19,277],[42,279],[42,210],[60,207],[61,183],[-16,188],[-1,230],[-1,252],[6,253],[6,267],[11,267],[12,259],[16,259]]},{"id":"port-wall","source":"Atmospheric Light (1)","points":[[396,304],[470,302],[469,293],[474,278],[473,266],[488,266],[487,231],[493,231],[493,172],[489,167],[490,98],[397,84],[397,97],[394,101]]},{"id":"karaoke-wall","source":"Atmospheric Light (7)","points":[[201,243],[210,244],[210,218],[201,215],[201,196],[204,192],[205,172],[209,168],[209,103],[206,101],[212,75],[231,78],[229,48],[164,61],[170,166],[179,171],[187,167],[187,177],[188,192],[181,196],[181,209],[197,209],[200,219]]},{"id":"restaurant-wall","source":"Atmospheric Light (5)","points":[[995,248],[1019,248],[1018,229],[1015,221],[1014,165],[1018,160],[1017,35],[976,25],[973,51],[979,53],[979,70],[995,77]]}];
// The three low lights belong to the road, not to the building sheet. Floor
// coordinates include the web storefront's intentional +13 native-pixel offset.
regions.push(
 {id:'restaurant-left-wall',source:'Atmospheric Light',target:'B_Fore_Building_1',falloff:23,gain:1.08,points:[[752,109],[758,113],[758,201],[761,205],[761,235],[753,242],[749,303],[754,303],[761,270],[765,269],[765,222],[772,202],[770,181],[764,176],[764,169],[771,164],[770,151],[765,148],[765,122],[768,117],[768,70],[763,66],[762,53],[752,53],[755,90],[752,97]]},
 {id:'right-store-wall',source:'Atmospheric Light (6)',target:'B_Fore_Building_1',falloff:30,points:[[1177,250],[1182,250],[1182,227],[1187,224],[1187,172],[1184,169],[1184,161],[1188,158],[1187,45],[1180,43]]},
 {id:'port-lower-detail',source:'Atmospheric Light (9)',target:'B_Fore_Building_1',falloff:30,gain:.48,points:[[486,275],[488,275],[489,269],[487,269],[486,272]]},
 {id:'service-ground',source:'Atmospheric Light (2)',target:'1F Floor',falloff:51,gain:.14,points:[[2360.25,21.4],[2368.62,15.56],[2365.93,1.11],[2362.76,1.06]]},
 {id:'port-ground',source:'Atmospheric Light (3)',target:'1F Floor',falloff:51,gain:.22,points:[[2072.14,12.15],[2079.02,11.98],[2064.94,2.71],[2062.3,2.55]]},
 {id:'alley-ground',source:'Atmospheric Light (4)',target:'1F Floor',falloff:51,gain:.22,points:[[2008.9,17.34],[2017.3,18.4],[2021.55,1.8],[2017.08,.72]]}
);
const cache=new WeakMap();
// A Light2D shape describes the light volume, not which building receives it.
// The atlas contains several separate facades. Its opaque/blue pixels alone
// cannot identify the intended wall across an alley. Bound each receiver to
// its facade in native atlas coordinates before applying the light volume.
// Port starts in the atlas's second building slice (x=432); the restaurant
// side wall ends at x=1011, before the transparent gap and balcony building.
const receivers={
 'convenience-wall':{left:0,top:180,right:62,bottom:280},
 'karaoke-wall':{left:164,top:48,right:232,bottom:245},
 'port-wall':{left:432,top:84,right:494,bottom:305},
 'restaurant-wall':{left:973,top:25,right:1012,bottom:249},
 // Bound the NEW receivers to their own masonry. In particular the left
 // side of the balcony (x1012+) must not be relit by the restaurant light.
 'restaurant-left-wall':{left:759,top:54,right:792,bottom:306},
 'right-store-wall':{left:1178,top:43,right:1201,bottom:250},
 'port-lower-detail':{left:470,top:260,right:493,bottom:300},
 'service-ground':{left:2309,top:0,right:2420,bottom:67},
 'port-ground':{left:2011,top:0,right:2131,bottom:64},
 'alley-ground':{left:1957,top:0,right:2073,bottom:67}
};
function distance(x,y,points){if(inside(x,y,points))return 0;let best=Infinity;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return best;}
function coverage(region,x,y){const b=receivers[region.id];if(x<b.left||x>=b.right||y<b.top||y>=b.bottom)return 0;const d=distance(x+.5,y+.5,region.points),f=region.falloff||0;if(!f)return d===0?1:0;const t=Math.max(0,1-d/f);return t*t*(3-2*t);}
function inside(x,y,points){let result=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
function render(image,target='B_Fore_Building_1'){
 let entries=cache.get(image);if(!entries){entries=new Map();cache.set(image,entries);}if(entries.has(target))return entries.get(target);
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 const source=ctx.getImageData(0,0,canvas.width,canvas.height),out=ctx.createImageData(canvas.width,canvas.height),w=canvas.width,h=canvas.height;
 const opaque=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&source.data[(y*w+x)*4+3]>200;
 let pixels=0;
 for(const region of regions.filter(r=>(r.target||'B_Fore_Building_1')===target)){
  const bounds=receivers[region.id];
  for(let y=Math.max(0,bounds.top);y<Math.min(h,bounds.bottom);y++)for(let x=Math.max(0,bounds.left);x<Math.min(w,bounds.right);x++){
   const amount=coverage(region,x,y);if(!amount)continue;
   const i=(y*w+x)*4,r=source.data[i],g=source.data[i+1],b=source.data[i+2],a=source.data[i+3];
   // Blue masonry receives the sky light. Black cables, warm shop fronts,
   // printed plaques and neon tubes keep their original colour and darkness.
   const ground=target==='1F Floor';
   if(a<200||r>120||(ground?b<12||b<r||g<r*.9:b<25||b<r*1.22||g<r*1.06||b-g<3))continue;
   // Distance to the actual sprite silhouette, not to the light polygon:
   // a hand-authored light boundary must never become a glowing rectangle.
   let edge=25;
   for(let d=1;d<=24;d++){if(!opaque(x-d,y)||!opaque(x+d,y)||!opaque(x,y-d)){edge=d-1;break;}}
   const rim=Math.exp(-edge/1.8),wash=.43+.25*Math.exp(-edge/17);
   const alpha=Math.round(255*Math.min(.96,wash+rim*.29)*amount*(region.gain??1));
   if(alpha<=out.data[i+3])continue;
   out.data[i]=ground?35:Math.round(64+rim*131);out.data[i+1]=ground?77:Math.round(103+rim*147);out.data[i+2]=ground?172:Math.round(206+rim*49);
   if(!out.data[i+3])pixels++;out.data[i+3]=Math.min(255,alpha);
  }
 }
 ctx.putImageData(out,0,0);const value={canvas,pixels};entries.set(target,value);return value;
}
function paintSprite(ctx,key,image,sp,width,height){
 if(key!=='B_Fore_Building_1'&&key!=='1F Floor')return;
 const {canvas}=render(image,key);
 ctx.save();ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=false;
 ctx.drawImage(canvas,sp.x,sp.y,sp.w,sp.h,-width*sp.pivot.x,-height*(1-sp.pivot.y),width,height);
 ctx.restore();
}
// Legacy scene import kept scale/position but discarded the five authored
// CityUpLight rotations. These are backdrop rays, not surface/rim receivers.
const cityRays=[{id:'161762518',rotation:.120970604},{id:'1008935154',rotation:-.118153786},{id:'1337494587',rotation:-.354118561},{id:'1454036149',rotation:-.190566422},{id:'1640816513',rotation:.071593061}];
function apply(data){for(const ray of cityRays){const n=data.scenes.street.nodes.find(n=>n.id===ray.id&&n.name==='CityUpLight');if(n)n.lightRotation=ray.rotation;}return data;}
W.LunaWallLighting={regions,receivers,coverage,render,paintSprite,cityRays,apply};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
