// Web-only guest artwork. No story, unlock, order or external NPC changes.
(function(W){
'use strict';
const D=W.LUNA_DATA,key='char_shiba_static';
D.assets[key]={src:'assets/char-shiba-static.png',w:83,h:111,frames:1,frameWidth:83,frameHeight:111,fps:0,static:true,displayScale:2,alphaBBox:[0,0,83,111],source:'User supplied bar guest Shiba portrait, 2026-10-02, codex-clipboard-cfe0bc9f-c130-40da-8df8-51d9c88e7d12.png'};
D.characterLayers.shiba={idle_default:[key],idle_talk:[key]};
D.webPoseOffsets.shiba={idle_default:[0,-90],idle_talk:[0,-90]};
// 2× source pixels in the shared 551×530 actor canvas, feet/paws at table anchor 440.
D.webActorBounds.shiba=[192.5,218,358.5,440];
// Preserve Tom's full human canvas. His torso ends at y=420; the coat and
// resting forearms extend to y=441 and should overlap the countertop.
const tom='char_tom_static';
D.assets[tom]={src:'assets/char-tom-idle-20261018.png',w:551,h:530,frames:1,frameWidth:551,frameHeight:530,fps:0,static:true,alphaBBox:[96,109,454,441],source:'User supplied Tom_Idle.png, 2026-10-18'};
D.characterLayers.tom={idle_default:[tom],idle_talk:[tom]};
D.webPoseOffsets.tom={idle_default:[0,0],idle_talk:[0,0]};
D.webActorBounds.tom=[96,109,454,441];
D.webTableAnchors={...D.webTableAnchors,tom:420};
})(window);
