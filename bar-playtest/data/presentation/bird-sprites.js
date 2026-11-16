(function(W){
'use strict';
// Shared presentation metadata, independent of terrace/corridor scene ownership.
// Original 1548 × 138 sheets: 12 cells. Alpha feet end at row 114 in every frame.
const assets={crow:'assets/01.ArtResources/01.Characters/02.Outside/05.StreetNPC/01.Idle/Crow_idle.png',pigeon:'assets/01.ArtResources/01.Characters/02.Outside/05.StreetNPC/01.Idle/Pigeon_idle.png'};
const root='assets/01.ArtResources/01.Characters/02.Outside/05.StreetNPC/';
Object.assign(assets,{fly:root+'04.Pigeon/pigeon_fly.png',jump:root+'05.Crow/crow_jump.png',wonder:root+'05.Crow/crow_wonder.png'});
const sheet={width:129,height:138,frames:12,fps:6};
const crops={crow:{x:52,y:98,w:24,h:17,footX:64},pigeon:{x:55,y:101,w:17,h:14,footX:66}};
Object.assign(crops,{fly:{x:54,y:94,w:24,h:24,footX:66},jump:{x:51,y:94,w:45,h:21,footX:64},wonder:{x:52,y:99,w:24,h:16,footX:64}});
const counts={crow:12,pigeon:12,fly:7,jump:7,wonder:12};
// Stabilize the jump's horizontal travel on a crowded perch while keeping
// its authored vertical bounce, toe contact and individual silhouettes.
const jumpTravel=[0,0,3,8,14,20,20];
function perched(kind,time,index,still){
 const phase=(time+index*2.37)%17;
 if(!still&&kind==='crow'&&phase>=9&&phase<9+7/9){
  const frame=Math.floor((phase-9)*9);return {clip:'jump',frame,dx:-jumpTravel[frame]};
 }
 if(!still&&kind==='crow'&&phase>=13&&phase<15)return {clip:'wonder',frame:Math.floor((phase-13)*6),dx:0};
 return {clip:kind,frame:frameAt(time+index*.37,still),dx:0};
}
function frameAt(time,still=false){return still?0:Math.floor(time*sheet.fps)%sheet.frames;}
W.LunaBirdSprites={assets,sheet,crops,counts,perched,frameAt};
})(window);
