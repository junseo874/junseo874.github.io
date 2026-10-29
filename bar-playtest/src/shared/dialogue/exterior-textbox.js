/* Authored eleven-piece exterior textbox; retain the source art unchanged. */
(function(W){
'use strict';
const sizes=[[66,67],[1144,67],[67,67],[66,117],[1144,117],[67,117],[66,67],[478,67],[145,121],[525,67],[67,67]];
const assetBase=new URL('assets/ui/exterior-textbox/',new URL('../../../',document.currentScript.src).href).href;
// Bar exports are complete frames, not stretchable bitmaps. Keep the 72px
// corner samples and 80px tail sample at one common 1/3 display scale; only
// narrow strips of the straight edges/body can expand with the sentence.
const barSkins=new Map();
function barHTML(player=false){
 if(barSkins.has(player))return barSkins.get(player);
 const w=1625,h=player?358:446,top=player?0:65,bottom=player?294:h,c=72,tailX=772,tailW=80;
 const src=new URL('../dialogue/'+(player?'GRD_textbox_luna.png':'GRD_textbox.png'),assetBase).href;
 const tiles=[
  [0,top,c,c],[300,top,4,c],[w-c,top,c,c],
  [0,top+c,c,4],[300,top+c,4,4],[w-c,top+c,c,4],
  [0,bottom-c,c,c],[300,bottom-c,4,c],[tailX,player?bottom-c:0,tailW,player?h-bottom+c:top+c],
  [1200,player?bottom-c:top,4,c],[w-c,bottom-c,c,c]
 ];
 const markup='<span class="dialogue-surface bar-textbox-skin '+(player?'tail-bottom':'tail-top')+'" aria-hidden="true">'+tiles.map((box,i)=>'<svg class="bar-textbox-piece piece-'+(i+1)+'" viewBox="'+box.join(' ')+'" preserveAspectRatio="none" focusable="false"><image href="'+src+'" width="'+w+'" height="'+h+'"/></svg>').join('')+'</span>';
 barSkins.set(player,markup);return markup;
}
function html(){
 // Keep corners and the tail intact. Sample a narrow central strip for
 // straight edges: compressing a 1144px image into a tiny cell makes the
 // browser's image minification blur even the perpendicular 4px border.
 return '<span class="exterior-textbox-skin" aria-hidden="true">'+sizes.map(([w,h],i)=>{
  // Separate authored tails share one fixed-size slot. Fill only the body
  // above their open top; never stretch the triangles or draw a line across it.
  if(i===8)return '<svg class="textbox-piece piece-9" viewBox="0 0 62 119" preserveAspectRatio="none" focusable="false"><rect width="62" height="62" fill="#0b0c14"/>'+[['center','A',60],['left','B',62],['right','C',62]].map(([direction,file,width])=>'<image class="textbox-tail tail-'+direction+'" href="'+assetBase+'GRD_textbox_tail_'+file+'.png" x="'+((62-width)/2)+'" y="61" width="'+width+'" height="58"/>').join('')+'</svg>';
  const horizontal=[1,4,7,9].includes(i),vertical=[3,4,5].includes(i);
  const x=horizontal?Math.floor(w/2)-2:1,y=vertical?Math.floor(h/2)-2:1;
  const width=horizontal?4:w-2,height=vertical?4:h-2;
  return '<svg class="textbox-piece piece-'+(i+1)+'" viewBox="'+[x,y,width,height].join(' ')+'" preserveAspectRatio="none" focusable="false"><image href="'+assetBase+'GRD_textbox_'+(i+1)+'.png" width="'+w+'" height="'+h+'"/></svg>';
 }).join('')+'</span>';
}
// Lay out the complete styled sentence once. Appending a growing prefix makes
// keep-all words jump between lines and recentres each line on every keystroke.
const textStates=new WeakMap();
const fitted=new WeakMap();
// max-content + max-width leaves unused space after keep-all wraps a word.
// Measure the complete laid-out lines, not the paragraph's 420px limit or the
// currently revealed prefix. Hidden glyphs still take part in this layout.
function fit(el,paragraph=el?.querySelector('p'),force=false){
 if(!el||!paragraph||!el.isConnected||!el.getClientRects().length)return;
 const cs=getComputedStyle(el),ps=getComputedStyle(paragraph);
 const signature=[ps.font,ps.letterSpacing,ps.whiteSpace,cs.maxWidth,cs.minWidth,cs.paddingLeft,cs.paddingRight,document.fonts.status].join('|');
 const previous=fitted.get(paragraph);
 if(!force&&previous?.signature===signature&&el.style.width===previous.width)return;
 el.style.width='max-content';
 const initial=parseFloat(getComputedStyle(el).width),scale=el.getBoundingClientRect().width/initial;
 if(!initial||!scale)return;
 const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT),range=document.createRange(),lines=[];
 let node;
 while((node=walker.nextNode()))for(let i=0;i<node.length;i++){
  if(/\s/.test(node.data[i]))continue;
  range.setStart(node,i);range.setEnd(node,i+1);
  for(const r of range.getClientRects()){
   if(!r.width||!r.height)continue;
   let line=lines.find(l=>r.top<l.bottom-.1*scale&&r.bottom>l.top+.1*scale);
   if(!line){line={left:r.left,right:r.right,top:r.top,bottom:r.bottom};lines.push(line);}
   else{line.left=Math.min(line.left,r.left);line.right=Math.max(line.right,r.right);line.top=Math.min(line.top,r.top);line.bottom=Math.max(line.bottom,r.bottom);}
  }
 }
 const padding=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight)+parseFloat(cs.borderLeftWidth)+parseFloat(cs.borderRightWidth);
 const longest=Math.max(0,...lines.map(l=>(l.right-l.left)/scale));
 // One layout pixel absorbs fractional font metrics without pushing the last
 // glyph onto another line. Keep the authored minimum for the corners/tail.
 const width=Math.min(initial,Math.max(parseFloat(cs.minWidth)||0,Math.ceil(longest+padding+1)))+'px';
 el.style.width=width;fitted.set(paragraph,{signature,width});
}
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
 paragraph.replaceChildren(ink);textStates.set(paragraph,{chars,count:0});fitted.delete(paragraph);
}
function revealText(paragraph,count){
 const state=textStates.get(paragraph);if(!state)return;
 fit(paragraph.parentElement,paragraph);
 count=Math.max(0,Math.min(state.chars.length,Math.floor(count)));
 for(let i=Math.min(state.count,count);i<Math.max(state.count,count);i++)
  state.chars[i].style.visibility=i<count?'visible':'hidden';
 state.count=count;
}
function attach(el,{tail=true}={}){
 el.classList.add('exterior-textbox');el.classList.toggle('exterior-tail-less',!tail);
 if(!el.querySelector('.exterior-textbox-skin'))el.insertAdjacentHTML('afterbegin',html());
}
W.LunaExteriorTextbox={html,barHTML,attach,mountText,revealText,fit};
})(window);
