(function(W){
'use strict';
// Shared presentation metadata, independent of terrace/corridor scene ownership.
// Original 1548 × 138 sheets: 12 cells. Alpha feet end at row 114 in every frame.
const assets={crow:'assets/9_ArtResources/01.Characters/02.Outside/09.StreetNPC/Idle/Crow_idle.png',pigeon:'assets/9_ArtResources/01.Characters/02.Outside/09.StreetNPC/Idle/Pigeon_idle.png'};
const sheet={width:129,height:138,frames:12,fps:6};
const crops={crow:{x:52,y:98,w:24,h:17,footX:64},pigeon:{x:55,y:101,w:17,h:14,footX:66}};
function frameAt(time,still=false){return still?0:Math.floor(time*sheet.fps)%sheet.frames;}
W.LunaBirdSprites={assets,sheet,crops,frameAt};
})(window);
