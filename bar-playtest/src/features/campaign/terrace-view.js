(function(W){
'use strict';
const asset='assets/backgrounds/campaign/terrace-20261018.png';
// The old composite is reference art only. Preserve the supplied sheets byte-for-byte.
const assets={city:'assets/backgrounds/terrace/city.png?v=city-replacement-20261019',building:'assets/backgrounds/terrace/building.png',characters:'assets/backgrounds/terrace/characters.png',balustrade:'assets/backgrounds/terrace/balustrade.png'};
const animation={frames:8,width:129,height:138,fps:6};
// Translation only: the city travels at one fifth of the foreground speed.
// Fixed city overscan provides edge coverage throughout the pan, never an animated zoom.
const cityCamera={parallax:.2,scale:1.15};
const entrance={hold:.7,move:5.6,settle:.5,duration:6.8};
function beginEntrance(dialog){
 dialog.terraceEntryTime=0;
 dialog.terraceEntryDuration=W.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:entrance.duration;
}
function camera(dialog){
 const t=dialog.terraceEntryDuration?(dialog.terraceEntryTime??entrance.duration):entrance.duration;
 const p=Math.max(0,Math.min(1,(t-entrance.hold)/entrance.move)),ease=p*p*p*(p*(p*6-15)+10);
 return {x:160*(1-ease),y:0,zoom:1};
}
function paintCamera(dialog,host){
 const view=camera(dialog);
 for(const layer of host.querySelectorAll('.terrace-city,.terrace-sign-scanlines'))
  layer.style.transform='translateX('+(-view.x*cityCamera.parallax)+'px) scale('+cityCamera.scale+')';
 for(const layer of host.querySelectorAll('.terrace-building,.terrace-characters,.terrace-balustrade'))
  layer.style.transform='translateX('+(-view.x)+'px)';
 return view;
}
let prepared=null;
const preparedImages=new Map(),glassSources=new WeakMap(),rasterLayers=new WeakMap();
// Bake pixel sizes once, then translate those stable textures. Rescaling the
// 1.15x skyline into a 480px buffer every frame made columns breathe as it moved.
const rasterScale=4;
function raster(image,scale,stamp=0){
 let entry=rasterLayers.get(image);
 if(!entry||entry.scale!==scale){
  const canvas=document.createElement('canvas');canvas.width=Math.round((image.naturalWidth||image.width)*scale);canvas.height=Math.round((image.naturalHeight||image.height)*scale);
  entry={canvas,scale,stamp:null};rasterLayers.set(image,entry);
 }
 if(entry.stamp!==stamp){
  const ctx=entry.canvas.getContext('2d');ctx.clearRect(0,0,entry.canvas.width,entry.canvas.height);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,0,0,entry.canvas.width,entry.canvas.height);entry.stamp=stamp;
 }
 return entry.canvas;
}
function prepare(){
 if(!prepared)prepared=Promise.all(Object.values(assets).map(src=>{const image=new Image();image.src=src;return image.decode().then(()=>preparedImages.set(src,image));})).catch(error=>{prepared=null;throw error;});
 return prepared;
}
function paintCharacters(dialog,host){
 const actors=host.querySelector('.terrace-characters');if(!actors)return;
 const frame=Math.floor((dialog.terraceTime||0)*animation.fps)%animation.frames;
 actors.dataset.frame=String(frame);actors.style.backgroundPosition=(-frame*animation.width)+'px 0px';
}
function tick(dialog,dt){dialog.terraceTime=(dialog.terraceTime||0)+Math.max(0,Math.min(.05,Number(dt)||0));}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Actor anchors are measured from the supplied 480 × 270 terrace composition.
const seats={chris:{x:163/480*1280,y:151/270*720},luna:{x:134/480*1280,y:151/270*720}};
function rows(key,data){return data.scenes[key];}
// Escape each text segment; reveal orange ingredient names with the same typing cursor.
function textHTML(row,count=Infinity){
 const text=String(row.text??''),limit=Math.max(0,Math.min(text.length,Math.floor(count))),ranges=[];
 for(const term of row.emphasis||[]){let at=text.indexOf(term);while(term&&at>=0){ranges.push({start:at,end:at+term.length});at=text.indexOf(term,at+term.length);}}
 ranges.sort((a,b)=>a.start-b.start);let at=0,out='';
 for(const range of ranges){if(range.start<at||range.start>=limit)continue;out+=escape(text.slice(at,range.start))+'<span class="terrace-ingredient">'+escape(text.slice(range.start,Math.min(range.end,limit)))+'</span>';at=Math.min(range.end,limit);}
 return out+escape(text.slice(at,limit));
}
function html(dialog){
 const row=dialog.rows[dialog.index],seat=seats[row.actor],speaker=seat?row.actor:'narration';
 const style=seat?'--speaker-x:'+seat.x+'px;--speaker-y:'+seat.y+'px;':'';
 return '<div class="terrace-scene" data-terrace-speaker="'+speaker+'" style="'+style+'"><div class="terrace-art" role="img" aria-label="도시 야경이 보이는 테라스에 왼쪽 루나와 오른쪽 크리스가 나란히 앉아 있다"><img class="terrace-city" src="'+assets.city+'" alt="" draggable="false"><canvas class="terrace-sign-scanlines" width="480" height="270" aria-hidden="true"></canvas><img class="terrace-building" src="'+assets.building+'" alt="" draggable="false"><span class="terrace-characters" style="background-image:url('+assets.characters+')" aria-hidden="true"></span><img class="terrace-balustrade" src="'+assets.balustrade+'" alt="" draggable="false"></div>'+
 '<canvas class="terrace-glass" width="1280" height="720" aria-hidden="true"></canvas><span class="terrace-seat chris" data-terrace-actor="chris" aria-hidden="true"></span><span class="terrace-seat luna" data-terrace-actor="luna" aria-hidden="true"></span>'+
 '<button class="campaign-speech terrace-speech '+(seat?'terrace-bubble':'terrace-narration')+'" data-campaign="next" aria-label="다음 대사">'+W.LunaExteriorTextbox.html()+'<p></p></button><canvas class="terrace-rain" width="1280" height="720" aria-hidden="true"></canvas></div>';
}
function weather(dialog){return dialog.terraceWeather||{scene:'street',config:{day:W.lunaCampaign?.session?.day??0,flow:'in'}};}
function paintGlass(dialog,host,state,view){
 const canvas=host.querySelector('.terrace-glass');if(!canvas)return;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 const city=host.querySelector('.terrace-city'),building=host.querySelector('.terrace-building'),rail=host.querySelector('.terrace-balustrade'),actors=preparedImages.get(assets.characters);
 if(!actors||![city,building,rail].every(image=>image?.complete&&image.naturalWidth))return;
 let source=glassSources.get(canvas);if(!source){source=document.createElement('canvas');source.width=480*rasterScale;source.height=270*rasterScale;glassSources.set(canvas,source);}
 // Match the actual art layers and animation frame. Do not sample a static
 // preview: every lit sign, actor and foreground rail participates in refraction.
 const c=source.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='low';c.fillStyle='#080f1b';c.fillRect(0,0,source.width,source.height);
 const cityX=(240*(1-cityCamera.scale)-view.x*cityCamera.parallax)*rasterScale,cityY=135*(1-cityCamera.scale)*rasterScale;
 c.drawImage(raster(city,rasterScale*cityCamera.scale),cityX,cityY);
 const signs=host.querySelector('.terrace-sign-scanlines');if(signs)c.drawImage(raster(signs,rasterScale*cityCamera.scale,signs.dataset.stamp),cityX,cityY);
 c.save();c.translate(-view.x*rasterScale,0);
 c.drawImage(raster(building,rasterScale),0,0);
 const frame=Math.floor((dialog.terraceTime||0)*animation.fps)%animation.frames;
 c.drawImage(raster(actors,rasterScale),frame*129*rasterScale,0,129*rasterScale,99*rasterScale,85*rasterScale,98*rasterScale,129*rasterScale,99*rasterScale);
 c.drawImage(raster(rail,rasterScale),86*rasterScale,179*rasterScale);c.restore();
 // Dry and rainy scenes share the same presentation grid, including after
 // remounts. Filtering only the enlarged texels keeps pixel art crisp but lets
 // subpixel camera travel blend instead of jumping whole source pixels.
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';ctx.drawImage(source,0,0,canvas.width,canvas.height);
 W.LunaRainGlass?.draw(ctx,state,{source,owner:dialog,smoothPresentation:true});
}
function paintRain(dialog,host){
 const canvas=host.querySelector('.terrace-rain');if(!canvas)return;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 const state={...weather(dialog),time:(dialog.terraceWeatherTime||0)+(dialog.terraceTime||0)};
 ctx.save();
 const view=camera(dialog),cam={x:(view.x+240/view.zoom-240)/100,y:0,w:4.8/view.zoom},scale=1280/cam.w;
 W.LunaOutsideRain?.draw(ctx,state,cam,(x,y)=>({x:640+(x-cam.x)*scale,y:360-(y-cam.y)*scale}),'drops');
 ctx.restore();
 paintGlass(dialog,host,state,view);
}
function paint(dialog,host){
 paintCamera(dialog,host);
 W.LunaSignScanlines?.paintTerrace(host,dialog.terraceTime||0);
 paintCharacters(dialog,host);
 paintRain(dialog,host);
 const bubble=host.querySelector('.terrace-speech'),paragraph=bubble?.querySelector('p');if(!paragraph)return;
 const row=dialog.rows[dialog.index];
 if(paragraph.dataset.line!==String(dialog.index)){
  const scene=host.querySelector('.terrace-scene'),seat=seats[row.actor];
  scene.dataset.terraceSpeaker=seat?row.actor:'narration';
  bubble.classList.toggle('terrace-bubble',!!seat);bubble.classList.toggle('terrace-narration',!seat);
  for(const [axis,value]of[['x',seat?.x],['y',seat?.y]]){
   if(seat)scene.style.setProperty('--speaker-'+axis,value+'px');else scene.style.removeProperty('--speaker-'+axis);
  }
  W.LunaExteriorTextbox.mountText(paragraph,row.text,row.emphasis||[]);paragraph.dataset.line=String(dialog.index);
 }
 W.LunaExteriorTextbox.revealText(paragraph,Array.from(row.text.slice(0,Math.floor(dialog.chars))).length);
 W.LunaDialogueCue.sync(bubble,!!row.text&&dialog.chars>=row.text.length);
}
W.LunaTerrace={weather,paintRain,asset,assets,animation,entrance,beginEntrance,camera,prepare,tick,seats,rows,html,paint,textHTML,nightKey:day=>day===0?'night0':day===1?'night1':day===2?'night2':day===3?'ending':null};
})(window);
