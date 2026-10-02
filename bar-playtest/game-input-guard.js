(function(){
'use strict';
function element(target){return target instanceof Element?target:target?.parentElement;}
function editable(target){const el=element(target);return !!el&&(el.isContentEditable||!!el.closest('input,textarea'));}
// Do not cancel pointer events: coaster/drink delivery and gimmicks use them.
document.addEventListener('selectstart',event=>{if(!editable(event.target))event.preventDefault();},true);
document.addEventListener('dragstart',event=>{
 const el=element(event.target);
 if(!editable(el)||el?.closest('img,svg,canvas'))event.preventDefault();
},true);
})();
