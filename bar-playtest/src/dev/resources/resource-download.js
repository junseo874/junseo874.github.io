(function(W){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function individual(row){
 return '<details class="image-downloads" open><summary>이미지별 원본 / 프레임 추출</summary>'+row.layers.map((l,i)=>{
  const sources=[...new Set([l.src,...(l.rects||[]).map(f=>f.src)].filter(Boolean))],count=l.rects?.length||l.frames||1;
  return '<div class="image-download" data-image-row="'+esc(row.id)+'" data-image-layer="'+i+'"><strong>'+esc(l.key)+'</strong>'+sources.map((src,n)=>'<a class="png-download" href="'+esc(src)+'" download="'+esc(src.startsWith('data:')?l.key+'.png':src.split('/').pop().split('?')[0])+'">원본 '+(sources.length>1?n+1+' ':'')+(count>1?'시트':'이미지')+'</a>').join('')+
   '<label>프레임 <input data-image-frame type="number" value="1" min="1" max="'+count+'" aria-label="'+esc(l.key)+' 추출 프레임"> / '+count+'</label><button data-download-image>이 이미지 프레임 PNG</button><small data-image-status role="status"></small></div>';
 }).join('')+'</details>';
}
function controls(row,variant){
 if(!row)return '';
 const R=W.ResourceLatest,v=variant||row.variants?.[0]?.id,stem=R.stem(row,v),link=(src,label,name)=>'<a class="png-download" href="'+esc(src)+'" download="'+esc(name)+'">'+label+'</a>';
 if(row.cursor)return '<div class="png-downloads">'+link(row.layers[0].src,'원본 SVG 다운로드',row.cursor.id+'.svg')+'<button data-download-canvas>투명 PNG 다운로드</button></div>';
 if(row.audio)return '<div class="png-downloads">'+link(row.audio.src,'원본 '+row.audio.src.split('.').at(-1).toUpperCase()+' 다운로드',row.audio.src.split('/').at(-1))+'</div>';
 if(R.isScreen(row))return '<div class="png-downloads">'+(row.popupKind?link(R.popup(row,v),'팝업 참고 PNG',stem+'--popup.png'):'')+link(R.screen(row,v),'전체 화면 참고 PNG',stem+'.png')+'<a class="extract-link" href="resource-review.html?tab=extract'+(row.id==='ui:exterior:street'?'&amp;q='+encodeURIComponent('상호작용'):'')+'">개별 그래픽 추출 ↗</a></div>'+(row.layers?.length?individual(row):'');
 if(row.layers?.length===1&&row.layers[0].frames===1&&!row.layers[0].rects&&!row.layers[0].placement&&/\.png$/i.test(row.layers[0].src))return '<div class="png-downloads">'+link(row.layers[0].src,'원본 PNG 다운로드',row.layers[0].src.split('/').at(-1))+'</div>';
 return row.layers?.length?'<div class="png-downloads"><button data-download-canvas>현재 합성 프레임 PNG</button><small>원본 레이어는 아래에서 각각 저장할 수 있습니다.</small></div>'+individual(row):'';
}
document.addEventListener('click',async e=>{
 const part=e.target.closest('[data-download-image]');
 if(part){
  const box=part.closest('[data-image-layer]'),row=W.resourceReview.rows.find(r=>r.id===box.dataset.imageRow),layer=row?.layers[Number(box.dataset.imageLayer)];if(!layer)return;
  const input=box.querySelector('[data-image-frame]'),count=layer.rects?.length||layer.frames||1,n=Math.max(0,Math.min(count-1,Math.floor(Number(input.value)||1)-1));input.value=n+1;
  const status=box.querySelector('[data-image-status]');part.disabled=true;status.textContent='PNG 준비 중...';
  try{await W.ResourceExtraction.download({src:layer.src,id:layer.key,layer},n,false,false);status.textContent='다운로드를 시작했습니다.';}
  catch(error){status.textContent='다운로드 실패 · '+error.message;}
  finally{part.disabled=false;}return;
 }
 const button=e.target.closest('[data-download-canvas]');if(!button)return;
 button.disabled=true;
 try{await W.resourceReview.downloadFrame();}
 catch(error){button.textContent='다운로드 실패 · 다시 시도';console.error(error);}
 finally{button.disabled=false;}
});
W.ResourceDownload={controls};
})(window);
