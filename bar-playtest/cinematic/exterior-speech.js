/* All game cutscenes use the live exterior textbox, including TV captions.
 * Full styled text occupies its final layout before the first glyph appears. */
(function(W){'use strict';
function create(canvas){
 const root=document.createElement('div'),stage=document.createElement('div'),entries=new Map();
 root.className='studio-speech-layer';stage.className='studio-speech-stage';root.append(stage);canvas.parentElement.append(root);
 function fit(){const w=canvas.clientWidth,h=canvas.clientHeight,s=Math.min(w/1280,h/720);Object.assign(root.style,{left:canvas.offsetLeft+'px',top:canvas.offsetTop+'px',width:w+'px',height:h+'px'});stage.style.transform=`translate(${(w-1280*s)/2}px,${(h-720*s)/2}px) scale(${s})`;}
 const observer=new ResizeObserver(fit);observer.observe(canvas);fit();let used=new Set(),order=0;
 function paint(c,p,k,count,ready,clock){
  const parsed=W.StudioTags.parse(c.text),caption=c.layout==='documentary';
  let entry=entries.get(c.id);
  if(!entry){const el=document.createElement('div'),paragraph=document.createElement('p');el.className='outside-speech studio-speech-bubble';el.dataset.clipId=c.id;el.setAttribute('role','status');W.LunaExteriorTextbox.attach(el,{tail:!caption});el.append(paragraph);stage.append(el);entry={el,paragraph,signature:null,chars:[]};entries.set(c.id,entry);}
  const {el,paragraph}=entry;used.add(c.id);el.style.zIndex=String(++order);
  const changed=entry.signature!==c.text;
  if(changed){
   entry.signature=c.text;paragraph.replaceChildren();entry.chars=[];el.setAttribute('aria-label',parsed.text);paragraph.setAttribute('aria-hidden','true');
   for(const [i,ch]of parsed.chars.entries()){
    const span=document.createElement('span');span.textContent=ch.ch;
    if(ch.color)span.style.color=ch.color;if(ch.bold)span.style.fontWeight='700';if(ch.size!==1)span.style.fontSize=ch.size+'em';
    if(ch.shake||c.textEffect==='shake')span.classList.add('cinema-glyph-shake');else if(ch.wave)span.classList.add('cinema-glyph-wave');
    if((ch.noise||ch.censor)&&!/^\s$/.test(ch.ch)){span.style.display='inline-block';span.style.width=/[\uac00-\ud7a3]/i.test(ch.ch)?'1em':'.7em';span.style.overflow='hidden';span.style.verticalAlign='top';}
    paragraph.append(span);entry.chars.push({span,ch,i});
   }
  }
  W.LunaExteriorTextbox.fit(el,paragraph,changed);
  // Scale the finished bubble as a world object; never scale its padding alone.
  const scale=caption?1:(c.bubbleReferenceWidth||15)*k/1280;
  W.LunaWorldSpeech.place(el,{x:p.x,y:p.y,scale,gap:0});
  el.classList.toggle('studio-speech-remote',!!c.remote);
  for(const {span,ch,i}of entry.chars){
   span.style.visibility=i<count?'visible':'hidden';
   const shake=ch.shake||(c.textEffect==='shake'?.8:0);
   if(shake||ch.wave)span.style.transform=`translate(${shake?Math.sin(clock*49+i*17)*shake:0}px,${shake?Math.cos(clock*61+i*11)*shake:Math.sin(clock*7+i*.5)*1.5}px)`;
   if((ch.noise||ch.censor)&&!/^\s$/.test(ch.ch)){const glyphs=ch.censor?'▓▒█':'░▐#?▒%01';span.textContent=glyphs[(Math.floor(clock*(ch.censor?8:15)+i*5))%glyphs.length];}
  }
  W.LunaDialogueCue.sync(el,ready);return true;
 }
 function end(effects=[]){for(const [id,e]of entries)if(!used.has(id)){e.el.remove();entries.delete(id);}let opacity=1;for(const f of effects){if(['fadeIn','fadeOut'].includes(f.effect))opacity*=1-(f.effect==='fadeIn'?1-f.u:f.u)*f.strength;if(f.effect==='black')opacity*=1-f.strength;}stage.style.opacity=String(Math.max(0,Math.min(1,opacity)));}
 return {begin(){used=new Set();order=0;},paint,end,dispose(){observer.disconnect();root.remove();entries.clear();}};
}
W.LunaCinemaSpeech={create};
})(window);
