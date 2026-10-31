// Web-only guest artwork. No story, unlock, order or external NPC changes.
(function(W){
'use strict';
const D=W.LUNA_DATA,key='char_shiba_static';
D.assets[key]={src:'assets/characters/static/char-shiba-idle.png',w:551,h:530,frames:1,frameWidth:551,frameHeight:530,fps:0,static:true,alphaBBox:[219,271,347,422],source:'User supplied Shiba_Idle.png, 2026-10-19'};
const talkKey='char_shiba_talk';
D.assets[talkKey]={...D.assets[key],src:'assets/characters/static/char-shiba-talk.png',source:'User supplied Shiba_Idle2.png, 2026-10-19'};
D.characterLayers.shiba={idle_default:[key],idle_talk:[talkKey]};
D.webPoseOffsets.shiba={idle_default:[0,0],idle_talk:[0,0]};
// Preserve the supplied full actor canvas and align its torso cut to the bar.
D.webActorBounds.shiba=[219,271,347,422];
D.webTableAnchors={...D.webTableAnchors,shiba:422};
// Preserve Tom's full human canvas. His torso ends at y=420; the coat and
// resting forearms extend to y=441 and should overlap the countertop.
const tomParts={body:[96,204,454,441],face_top:[218,109,361,267],eyes:[257,201,313,220],eyebrow:[258,193,308,209],face_bottom_default:[250,218,315,265]};
const tomLayers=Object.entries(tomParts).map(([part,alphaBBox])=>{
 const id='char_tom_idle_'+part;
 D.assets[id]={src:'assets/characters/tom/idle/'+part+'.png',w:2204,h:530,frames:4,frameWidth:551,frameHeight:530,fps:2.5,syncToBody:true,alphaBBox,source:'User supplied '+part+'.png, 2026-10-19'};
 return id;
});
// Supplied talk sheets share the full canvas and the same breathing offsets.
// Eyes/brows/upper face are byte-identical to idle: reuse those originals.
// Only articulation runs independently, using the common .9s speech clock.
const tomTalkLayers=['body','face_top','eyes','eyebrow','face_bottom_talk'].map(part=>{
 if(['face_top','eyes','eyebrow'].includes(part))return 'char_tom_idle_'+part;
 const id='char_tom_talk_'+part,mouth=part==='face_bottom_talk';
 D.assets[id]={src:'assets/characters/tom/talk/'+part.replaceAll('_','-')+'.png',w:2204,h:530,frames:4,frameWidth:551,frameHeight:530,fps:mouth?4/.9:2.5,syncToBody:!mouth,alphaBBox:mouth?[250,212,315,265]:tomParts.body,source:'User supplied '+part+'.png, 2026-10-31'};
 return id;
});
D.characterLayers.tom={idle_default:tomLayers,idle_talk:tomTalkLayers};
D.webPoseOffsets.tom={idle_default:[0,0],idle_talk:[0,0]};
D.webActorBounds.tom=[96,109,454,441];
D.webTableAnchors={...D.webTableAnchors,tom:420};
})(window);
