(function(){
'use strict';
function element(target){return target instanceof Element?target:target?.parentElement;}
function editable(target){
 const el=element(target);
 if(!el)return false;
 if(el.isContentEditable||el.closest('textarea'))return true;
 const input=el.closest('input');
 return !!input&&!['button','submit','reset','checkbox','radio','range','file','color','image','hidden'].includes(input.type);
}
// Do not cancel pointer events: coaster/drink delivery and gimmicks use them.
document.addEventListener('selectstart',event=>{if(!editable(event.target))event.preventDefault();},true);
document.addEventListener('dragstart',event=>{
 const el=element(event.target);
 if(!editable(el)||el?.closest('img,svg,canvas'))event.preventDefault();
},true);
document.addEventListener('contextmenu',event=>{
 if(!editable(event.target))event.preventDefault();
},true);
// Native middle-button autoscroll is unrelated to game dragging. Keep links and fields usable.
document.addEventListener('mousedown',event=>{
 if(event.button===1&&!editable(event.target)&&!element(event.target)?.closest('a[href]'))event.preventDefault();
},true);
// Dropping a desktop image/link must not navigate away and lose the current game.
for(const type of ['dragover','drop'])document.addEventListener(type,event=>{
 const el=element(event.target);
 if(el?.closest('input[type="file"]'))return;
 const files=Array.from(event.dataTransfer?.types||[]).includes('Files');
 if(files||!editable(el))event.preventDefault();
},true);
window.addEventListener('keydown',event=>{
 // Leave native browser fullscreen intact, even during modal/cinematic input locks.
 if(event.code==='F11'||event.key==='F11'){event.stopImmediatePropagation();return;}
 if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='a'&&!editable(event.target)){
  event.preventDefault();
  // Do not also interpret Ctrl/Cmd+A as a game movement key.
  event.stopImmediatePropagation();
 }
},true);
// Browser shortcuts and pre-existing ranges can bypass selectstart. Never clear field editing.
document.addEventListener('selectionchange',()=>{
 const selection=document.getSelection();
 if(selection&&!selection.isCollapsed&&!editable(document.activeElement)&&
   !editable(selection.anchorNode)&&!editable(selection.focusNode))selection.removeAllRanges();
});
})();
