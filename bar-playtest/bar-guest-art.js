// Web-only guest artwork. No story, unlock, order or external NPC changes.
(function(W){
'use strict';
const D=W.LUNA_DATA,key='char_shiba_static';
D.assets[key]={src:'assets/char-shiba-static.png',w:83,h:111,frames:1,frameWidth:83,frameHeight:111,fps:0,static:true,displayScale:2,alphaBBox:[0,0,83,111],source:'User supplied bar guest Shiba portrait, 2026-10-02, codex-clipboard-cfe0bc9f-c130-40da-8df8-51d9c88e7d12.png'};
D.characterLayers.shiba={idle_default:[key],idle_talk:[key]};
D.webPoseOffsets.shiba={idle_default:[0,-90],idle_talk:[0,-90]};
// 2× source pixels in the shared 551×530 actor canvas, feet/paws at table anchor 440.
D.webActorBounds.shiba=[192.5,218,358.5,440];
})(window);
