// Web-only guest artwork. No story, unlock, order or external NPC changes.
(function(W){
'use strict';
const D=W.LUNA_DATA,key='char_shiba_static';
D.assets[key]={src:'assets/char-shiba-idle-20261019.png',w:551,h:530,frames:1,frameWidth:551,frameHeight:530,fps:0,static:true,alphaBBox:[219,271,347,422],source:'User supplied Shiba_Idle.png, 2026-10-19'};
D.characterLayers.shiba={idle_default:[key],idle_talk:[key]};
D.webPoseOffsets.shiba={idle_default:[0,0],idle_talk:[0,0]};
// Preserve the supplied full actor canvas and align its torso cut to the bar.
D.webActorBounds.shiba=[219,271,347,422];
D.webTableAnchors={...D.webTableAnchors,shiba:422};
// Preserve Tom's full human canvas. His torso ends at y=420; the coat and
// resting forearms extend to y=441 and should overlap the countertop.
const tomParts={body:[96,204,454,441],face_top:[218,109,361,267],eyes:[257,201,313,220],eyebrow:[258,193,308,209],face_bottom_default:[250,218,315,265]};
const tomLayers=Object.entries(tomParts).map(([part,alphaBBox])=>{
 const id='char_tom_idle_'+part;
 D.assets[id]={src:'assets/tom-idle-20261019/'+part+'.png',w:2204,h:530,frames:4,frameWidth:551,frameHeight:530,fps:2.5,syncToBody:true,alphaBBox,source:'User supplied '+part+'.png, 2026-10-19'};
 return id;
});
// These are coordinated idle frames, not independent blink/articulation frames.
// Use the same authored cycle while speaking until talk-specific art is supplied.
D.characterLayers.tom={idle_default:tomLayers,idle_talk:[...tomLayers]};
D.webPoseOffsets.tom={idle_default:[0,0],idle_talk:[0,0]};
D.webActorBounds.tom=[96,109,454,441];
D.webTableAnchors={...D.webTableAnchors,tom:420};
})(window);
