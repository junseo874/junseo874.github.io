(function(W){
'use strict';
const asset='assets/backgrounds/campaign/terrace-20261018.png';
// The old composite is reference art only. Preserve the supplied sheets byte-for-byte.
const assets={city:'assets/backgrounds/terrace/city.png?v=city-replacement-20261019',building:'assets/backgrounds/terrace/building.png',characters:'assets/backgrounds/terrace/characters.png',balustrade:'assets/backgrounds/terrace/balustrade.png'};
const animation={frames:8,width:129,height:138,fps:6};
let prepared=null;
function prepare(){
 if(!prepared)prepared=Promise.all(Object.values(assets).map(src=>{const image=new Image();image.src=src;return image.decode();})).catch(error=>{prepared=null;throw error;});
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
 return '<div class="terrace-scene" data-terrace-speaker="'+speaker+'" style="'+style+'"><div class="terrace-art" role="img" aria-label="도시 야경이 보이는 테라스에 왼쪽 루나와 오른쪽 크리스가 나란히 앉아 있다"><img class="terrace-city" src="'+assets.city+'" alt="" draggable="false"><canvas class="terrace-sign-scanlines" width="480" height="270" aria-hidden="true"></canvas><canvas class="terrace-rain" width="480" height="270" aria-hidden="true"></canvas><img class="terrace-building" src="'+assets.building+'" alt="" draggable="false"><span class="terrace-characters" style="background-image:url('+assets.characters+')" aria-hidden="true"></span><img class="terrace-balustrade" src="'+assets.balustrade+'" alt="" draggable="false"></div>'+
 '<span class="terrace-seat chris" data-terrace-actor="chris" aria-hidden="true"></span><span class="terrace-seat luna" data-terrace-actor="luna" aria-hidden="true"></span>'+
 '<button class="campaign-speech terrace-speech '+(seat?'terrace-bubble':'terrace-narration')+'" data-campaign="next" aria-label="다음 대사">'+W.LunaExteriorTextbox.html()+'<p></p></button></div>';
}
function weather(dialog){return dialog.terraceWeather||{scene:'street',config:{day:W.lunaCampaign?.session?.day??0,flow:'in'}};}
function paintRain(dialog,host){
 const canvas=host.querySelector('.terrace-rain');if(!canvas)return;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,480,270);
 const state={...weather(dialog),time:(dialog.terraceWeatherTime||0)+(dialog.terraceTime||0)};
 ctx.save();ctx.scale(480/1280,270/720);
 const cam={x:0,y:0,w:4.8},scale=1280/cam.w;
 W.LunaOutsideRain?.draw(ctx,state,cam,(x,y)=>({x:640+x*scale,y:360-y*scale}),'drops');
 ctx.restore();
}
function paint(dialog,host){
 paintRain(dialog,host);
 W.LunaSignScanlines?.paintTerrace(host,dialog.terraceTime||0);
 paintCharacters(dialog,host);
 const bubble=host.querySelector('.terrace-speech'),paragraph=bubble?.querySelector('p');if(!paragraph)return;
 const row=dialog.rows[dialog.index];
 if(!paragraph.dataset.mounted){W.LunaExteriorTextbox.mountText(paragraph,row.text,row.emphasis||[]);paragraph.dataset.mounted='true';}
 W.LunaExteriorTextbox.revealText(paragraph,Array.from(row.text.slice(0,Math.floor(dialog.chars))).length);
 W.LunaDialogueCue.sync(bubble,!!row.text&&dialog.chars>=row.text.length);
}
W.LunaTerrace={weather,paintRain,asset,assets,animation,prepare,tick,seats,rows,html,paint,textHTML,nightKey:day=>day===0?'night0':day===1?'night1':day===2?'night2':day===3?'ending':null};
})(window);
