/* Authored eleven-piece exterior textbox; retain the source art unchanged. */
(function(W){
'use strict';
const sizes=[[66,67],[1144,67],[67,67],[66,117],[1144,117],[67,117],[66,67],[478,67],[145,121],[525,67],[67,67]];
function html(){
 // Each export has a one-pixel transparent gutter. Crop only that gutter
 // using the SVG viewport, so stretched edges meet without transparent seams.
 return '<span class="exterior-textbox-skin" aria-hidden="true">'+sizes.map(([w,h],i)=>
  '<svg class="textbox-piece piece-'+(i+1)+'" viewBox="1 1 '+(w-2)+' '+(h-2)+'" preserveAspectRatio="none" focusable="false"><image href="assets/exterior-textbox/GRD_textbox_'+(i+1)+'.png" width="'+w+'" height="'+h+'"/></svg>'
 ).join('')+'</span>';
}
// Lay out the complete styled sentence once. Appending a growing prefix makes
// keep-all words jump between lines and recentres each line on every keystroke.
const textStates=new WeakMap();
function mountText(paragraph,full,emphasis=[],background=false){
 const ink=document.createElement('span'),chars=[];
 ink.className=background?'outside-background-text':'outside-speech-text';
 ink.setAttribute('aria-hidden','true');
 paragraph.setAttribute('aria-label',full);
 const marked=new Set();
 for(const word of emphasis){
  if(!word)continue;
  for(let at=full.indexOf(word);at>=0;at=full.indexOf(word,at+word.length))
   for(let i=at;i<at+word.length;i++)marked.add(i);
 }
 let offset=0;
 for(const char of Array.from(full)){
  const span=document.createElement('span');span.textContent=char;
  if(marked.has(offset))span.className='outside-story-emphasis';
  span.style.visibility='hidden';ink.append(span);chars.push(span);offset+=char.length;
 }
 paragraph.replaceChildren(ink);textStates.set(paragraph,{chars,count:0});
}
function revealText(paragraph,count){
 const state=textStates.get(paragraph);if(!state)return;
 count=Math.max(0,Math.min(state.chars.length,Math.floor(count)));
 for(let i=Math.min(state.count,count);i<Math.max(state.count,count);i++)
  state.chars[i].style.visibility=i<count?'visible':'hidden';
 state.count=count;
}
W.LunaExteriorTextbox={html,mountText,revealText};
})(window);
