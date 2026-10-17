(function(W){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function controls(row,variant){
 if(!row)return '';
 const R=W.ResourceLatest,v=variant||row.variants?.[0]?.id,stem=R.stem(row,v),link=(src,label,name)=>'<a class="png-download" href="'+esc(src)+'" download="'+esc(name)+'">'+label+'</a>';
 if(row.audio)return '<div class="png-downloads">'+link(row.audio.src,'원본 '+row.audio.src.split('.').at(-1).toUpperCase()+' 다운로드',row.audio.src.split('/').at(-1))+'<small>변환·볼륨 보정 없이 원본 파일을 저장합니다.</small></div>';if(R.isScreen(row))return '<div class="png-downloads">'+(row.popupKind?link(R.popup(row,v),'팝업만 PNG',stem+'--popup.png'):'')+link(R.screen(row,v),'전체 화면 PNG',stem+'.png')+'<small>2026-10-18 갱신 · 선택 상태의 기본 인물/문구 · 정적 PNG</small></div>';
 if(row.layers?.length===1&&row.layers[0].frames===1&&!row.layers[0].rects&&!row.layers[0].placement&&/\.png$/i.test(row.layers[0].src))return '<div class="png-downloads">'+link(row.layers[0].src,'원본 PNG 다운로드',row.layers[0].src.split('/').at(-1))+'</div>';
 return row.layers?.length?'<div class="png-downloads"><button data-download-canvas>현재 프레임 PNG</button></div>':'';
}
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-download-canvas]');if(!button)return;
 button.disabled=true;const previous=button.textContent;
 try{await W.resourceReview.downloadFrame();}
 catch(error){button.textContent='다운로드 실패 · 다시 시도';console.error(error);}
 finally{button.disabled=false;if(button.textContent===previous)button.textContent='현재 프레임 PNG';}
});
W.ResourceDownload={controls};
})(window);
