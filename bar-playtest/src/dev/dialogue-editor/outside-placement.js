/* Scene picker, in world units. Window-local draft is committed only on Apply. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),P=W.LunaNpcPlacement;
function create(api){
 const dialog=$('placement-dialog'),canvas=$('placement-map'),ctx=canvas.getContext('2d'),images=new Map();
 let report=null,loading=null,loadError=false,active='',draft={},center=0,span=8,drag=null,raf=0;
 function invalidate(){if(dialog.open&&!raf)raf=requestAnimationFrame(()=>{raf=0;draw();});}
 async function load(){if(!loading){loadError=false;loading=fetch('data/presentation/web-world-layout.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(v=>{report=v;}).catch(()=>{loadError=true;loading=null;}).finally(invalidate);}return loading;}
 function art(src){if(!src)return null;let im=images.get(src);if(!im){im=new Image();images.set(src,im);im.onload=invalidate;im.src=src;}return im.complete&&im.naturalWidth?im:null;}
 const value=id=>P.position(draft,id);
 function setX(x){if(!Number.isFinite(x))return;P.write(draft,active,x);$('place-x').value=value(active);invalidate();}
 function refresh(){const s=P.specs[active];center=value(active);const limits=P.range(draft,active);$('place-x').min=limits[0];$('place-x').max=limits[1];$('place-x').value=center;$('place-y').textContent='Y '+P.editPoint(draft,active).y.toFixed(3);$('place-plane-label').textContent=active==='newspaper'?'좌판에 자동 정렬':'바닥에 자동 정렬';$('floor-name').textContent=P.floorNames[s.floor];$('placement-title').textContent=s.label+' · 위치 지정';invalidate();}
 function open(site,flow){if(!site.pins.length)return;draft=structuredClone(api.model().placement);const ids=[...new Set(site.pins.flatMap(id=>[id,P.specs[id].partner||P.specs[id].nearby].filter(Boolean)))];$('place-actor').replaceChildren(...ids.map(id=>new Option(P.specs[id].label+(P.specs[id].partner?' · 함께 이동':''),id)));active=site.pins.includes(flow)?flow:site.pins[0];$('place-actor').value=active;span=8;dialog.showModal();refresh();load();canvas.focus();}
 function dims(){const r=canvas.getBoundingClientRect(),w=r.width,h=r.height;return{r,w,h,k:w/span,fy:h*.77};}
 function sprite(kind){
  if(kind==='box'||kind==='cat'){const f=W.LunaBubiArt.frame(kind==='box'?'idle':'sleep',0);return{...f,src:W.LUNA_OUTSIDE_DATA.assets[f.asset].src};}
  if(['samho','shiba'].includes(kind)){const f=W.LUNA_OUTSIDE_DATA.animations[kind==='samho'?'samhoIdle':'shiba'].frames[0];return{...f,src:W.LUNA_OUTSIDE_DATA.assets[f.asset].src};}
  const f=W.LunaOutsideAmbient.sprite(kind);return{...f,src:W.LunaOutsideAmbient.sheets[kind]?.src};
 }
 function paintSprite(im,sx,sy,sw,sh,x,y,w,h){
  const t=ctx.getTransform();
  if(t.b||t.c){LunaPixelRaster.draw(ctx,im,sx,sy,sw,sh,x,y,w,h);return;}
  // Snap the visible corner, including mirrored pivots, while dragging the map.
  const left=(Math.round(t.a*x+t.e)-t.e)/t.a,top=(Math.round(t.d*y+t.f)-t.f)/t.d;
  ctx.drawImage(im,sx,sy,sw,sh,left,top,w,h);
 }
 function draw(){if(!dialog.open||!active)return;const {w,h,k,fy}=dims();if(!w||!h)return;
  LunaPixelRaster.fit(ctx,w,h);ctx.fillStyle='#10212f';ctx.fillRect(0,0,w,h);
  const s=P.specs[active],x=v=>w*.5+(v-center)*k,y=v=>fy-(v-s.y)*k;
  const hidden=new Set(W.LUNA_OUTSIDE_DATA.scenes[s.scene].nodes.filter(n=>n.active===false).map(n=>String(n.id)));const nodes=(report?.scenes[s.scene]?.nodes||[]).filter(n=>!hidden.has(String(n.id))&&n.name!=='home-tv-screen'&&n.src&&n.sprite&&!/^(ambient-|building-(silent-)?resident|optional-trade|street-(newspaper|believer|beggar))/.test(n.id)&&!['shiba','Samho'].includes(n.name)).sort((a,b)=>a.layer-b.layer||a.order-b.order||b.z-a.z);
  for(const n of nodes){const f=n.sprite,sw=f.w/(f.ppu||100)*Math.abs(n.sx||1)*k,sh=f.h/(f.ppu||100)*Math.abs(n.sy||1)*k,nx=x(n.x),ny=y(n.y),ax=-sw*(f.pivot?.x??.5),ay=-sh*(1-(f.pivot?.y??.5));if(nx+ax>w||nx+ax+sw<0||ny+ay>h||ny+ay+sh<0)continue;const im=art(n.src);if(!im)continue;ctx.save();ctx.translate(nx,ny);if(n.rotation)ctx.rotate(-n.rotation);ctx.scale(n.flip?-1:1,1);paintSprite(im,f.x||0,f.y||0,f.w,f.h,ax,ay,sw,sh);ctx.restore();}
  ctx.fillStyle='rgba(6,16,23,.3)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#9bd3d629';ctx.lineWidth=1;
  for(let i=Math.ceil(center-span/2);i<=center+span/2;i++){ctx.beginPath();ctx.moveTo(x(i),0);ctx.lineTo(x(i),h);ctx.stroke();ctx.fillStyle='#d7e3e6';ctx.font='11px monospace';ctx.fillText(i,x(i)+4,h-8);}
  ctx.strokeStyle='#65e0cd';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();const bounds=P.range(draft,active);ctx.moveTo(x(bounds[0]),fy);ctx.lineTo(x(bounds[1]),fy);ctx.stroke();ctx.setLineDash([]);
  const leader=s.parent?P.specs[s.parent]:s;
  const drawCast=(group,nearby=false)=>group.cast.forEach((_,i)=>{const p=P.pose(draft,group.id,i),f=sprite(p.kind),im=art(f.src),px=x(p.x),py=y(p.y),a=k/(f.ppu||100);
   if(im){ctx.save();ctx.translate(px,py);ctx.scale(p.flip?-1:1,1);ctx.shadowColor=nearby?'transparent':'#88f3dc';ctx.shadowBlur=nearby?0:4;const anchor=p.kind==='shiba'?.5:f.pivot?.x??.5;paintSprite(im,f.x,f.y,f.w,f.h,-f.w*anchor*a,-f.h*(1-f.pivot.y)*a,f.w*a,f.h*a);ctx.restore();}
   ctx.strokeStyle=nearby?'#8297a2':'#abffef';ctx.beginPath();ctx.ellipse(px,py,Math.max(7,k*.2),3,0,0,2*Math.PI);ctx.stroke();
   if(nearby){ctx.fillStyle='#c3d1d7';ctx.textAlign='center';ctx.fillText(group.label,px,py+17);ctx.textAlign='start';}
  });
  if(s.nearby)drawCast(P.specs[s.nearby],true);drawCast(leader);
  const mx=x(value(active));ctx.fillStyle='#cdfff2';ctx.beginPath();ctx.moveTo(mx,fy+1);ctx.lineTo(mx-5,fy+9);ctx.lineTo(mx+5,fy+9);ctx.fill();
  $('map-status').textContent=loadError?'배경을 읽지 못했습니다 · 좌표 눈금만 표시':!report?'씬 배경 불러오는 중…':P.floorNames[s.floor]+'  /  '+(active==='newspaper'?'좌판 높이 · 오른쪽 고정':s.nearby?'선택한 인물만 이동':s.cast.length>1?'동행 인물 간격 유지':'발 위치 보정');
 }
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const {r}=dims();drag={at:e.clientX,base:center,local:e.clientX-r.left,moved:false};canvas.setPointerCapture(e.pointerId);canvas.focus();});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const d=e.clientX-drag.at;if(Math.abs(d)>4)drag.moved=true;if(drag.moved){center=Math.max(P.specs[active].min-span*.3,Math.min(P.specs[active].max+span*.3,drag.base-d/dims().k));invalidate();}});
 canvas.addEventListener('pointerup',()=>{if(!drag)return;const {w,k}=dims();if(!drag.moved)setX(center+(drag.local-w*.5)/k);drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
 canvas.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft'].includes(e.key))return;e.preventDefault();setX(value(active)+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.10:.01));});
 function zoom(n){span=Math.max(3.3,Math.min(26,span*n));invalidate();}
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.002));},{passive:false});
 $('place-zoom-in').onclick=()=>zoom(.8);$('place-zoom-out').onclick=()=>zoom(1.25);$('place-focus').onclick=()=>{center=value(active);invalidate();};
 $('place-actor').onchange=e=>{active=e.target.value;refresh();};$('place-x').onchange=e=>{setX(e.target.valueAsNumber);refresh();};$('place-default').onclick=()=>{const s=P.specs[active];setX(s.parent?value(s.parent)+s.dx:s.x);refresh();};
 $('close-placement').onclick=$('cancel-placement').onclick=()=>dialog.close();$('apply-placement').onclick=()=>{const changed=JSON.stringify(draft.positions)!==JSON.stringify(api.model().placement.positions);if(changed)api.apply(draft);dialog.close();if(changed)api.status('NPC 위치 적용 · 변경 내역에서 저장하면 본편에 반영됩니다.');};
 new ResizeObserver(invalidate).observe(canvas);return{open};
}
W.LunaOutsidePlacement={create};
})(window);
