(function(W){'use strict';
const K=StudioKeyframes,M=StudioModel;
const groups={position:['x','y'],color:['red','green','blue']};
const channels=id=>groups[id]||[id];
const clock='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 2h6M10 2v3m4 1 2-2"/><circle cx="10" cy="12" r="6"/><path d="M10 8v4l2 1"/></svg>';
function clip(p,target,time){return target?StudioRecording.resolve(p,target,time):undefined;}
function armed(c,ch){return c?.recordChannels?.[ch]??!!c?.keyframes?.[ch]?.length;}
function enabled(c,id,global=false){return channels(id).every(ch=>c?.recordChannels?.[ch]!==false&&(global||armed(c,ch)));}
function times(c,id){return [...new Set(channels(id).flatMap(ch=>(c?.keyframes?.[ch]||[]).map(k=>k.t+c.start)))].sort((a,b)=>a-b);}
function controls(id,label){return '<button class="ae-stopwatch" data-property-watch="'+id+'" aria-pressed="false" aria-label="'+label+' 자동 키 기록" title="이 항목의 자동 키 기록 켜기/끄기 · 기존 키는 유지됩니다">'+clock+'</button>';}
function navigation(id){return '<div class="ae-key-nav"><button data-property-prev="'+id+'" aria-label="이전 키" title="이전 키">‹</button><button data-property-key="'+id+'" aria-label="현재 시간에 키 추가" title="현재 시간에 키 추가/갱신">◇</button><button data-property-next="'+id+'" aria-label="다음 키" title="다음 키">›</button></div>';}
W.StudioProperties={channels,clip,armed,enabled,times,controls,navigation};
})(window);
