(function(W){
'use strict';
const asset='assets/campaign/terrace-reference.png';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Actor anchors are measured from the supplied 480 × 270 terrace composition.
const seats={chris:{x:143/480*1280,y:165/270*720},luna:{x:177/480*1280,y:165/270*720}};
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
 return '<div class="terrace-scene" data-terrace-speaker="'+speaker+'" style="'+style+'"><img class="terrace-art" src="'+asset+'" alt="도시 야경이 보이는 테라스에 왼쪽 크리스와 오른쪽 루나가 나란히 앉아 있다" draggable="false">'+
 '<span class="terrace-seat chris" data-terrace-actor="chris" aria-hidden="true"></span><span class="terrace-seat luna" data-terrace-actor="luna" aria-hidden="true"></span>'+
 '<button class="campaign-speech terrace-speech '+(seat?'terrace-bubble':'terrace-narration')+'" data-campaign="next" aria-label="다음 대사"><p><span class="campaign-measure" aria-hidden="true">'+textHTML(row)+'</span><span class="campaign-ink"></span></p></button></div>';
}
W.LunaTerrace={asset,seats,rows,html,textHTML,nightKey:day=>day===0?'night0':day===1?'night1':day===3?'ending':null};
})(window);
