/* Opt-in image inspections; other objects keep their existing dialogue. */
(function(W){'use strict';
const entries={
 'wanted-poster':{kind:'inspection',title:'개시바 현상 수배 포스터',image:'assets/outside/shiba-wanted-poster-20261019.png',text:'누군가 수배하는 포스터.'},
 'home-book':{kind:'inspection',title:'즐거운 학문 · 책 표지',image:W.LUNA_OUTSIDE_DATA.assets[W.LunaHomeArt.book.cover].src,text:'《즐거운 학문》 - 프리드리히 니체'}
};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function forTarget(target){return entries[target.id]?{...entries[target.id]}:null;}
function html(item){return '<section class="outside-inspection" role="dialog" aria-modal="true" aria-label="'+escape(item.title)+'" aria-describedby="outside-inspection-description">'+
 '<img class="outside-inspection-image" src="'+escape(item.image)+'" alt="'+escape(item.title)+'" draggable="false">'+
 '<div class="outside-inspection-caption">'+W.LunaExteriorTextbox.html()+'<p id="outside-inspection-description">'+escape(item.text)+'</p></div>'+
 '<button type="button" class="outside-inspection-exit" data-outside-action="interact" aria-label="E 키로 나가기"><kbd aria-hidden="true">E</kbd><span>나가기</span></button></section>';}
W.LunaOutsideInspection={forTarget,html};
})(window);
