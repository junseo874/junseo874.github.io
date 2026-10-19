/* DOM text stays sharp at any display size; scenery keeps its pixel canvas.
   Reuse the actual street bubble CSS and completion cue, not a painted copy. */
(function(W){'use strict';
function create(canvas){
 const root=document.createElement('div'),stage=document.createElement('div'),entries=new Map();
 root.className='studio-speech-layer';stage.className='studio-speech-stage';root.append(stage);
 canvas.parentElement.append(root);
 let used=new Set(),order=0;
 function fit(){
  const width=canvas.clientWidth,height=canvas.clientHeight,scale=Math.min(width/1280,height/720);
  Object.assign(root.style,{left:canvas.offsetLeft+'px',top:canvas.offsetTop+'px',width:width+'px',height:height+'px'});
  stage.style.transform='translate('+((width-1280*scale)/2)+'px,'+((height-720*scale)/2)+'px) scale('+scale+')';
 }
 const observer=new ResizeObserver(fit);observer.observe(canvas);fit();
 function begin(){used=new Set();order=0;}
 function paint(c,p,k,count,ready,clock){
  if(c.bubbleStyle!=='outside')return false;
  const parsed=StudioTags.parse(c.text);
  // Keep animated inline effects on the canvas until their DOM equivalent exists.
  if(parsed.chars.some(ch=>ch.shake||ch.wave||ch.noise||ch.censor)||['shake','emphasis'].includes(c.textEffect))return false;
  let entry=entries.get(c.id);
  if(!entry){
   const el=document.createElement('div'),paragraph=document.createElement('p'),measure=document.createElement('span'),ink=document.createElement('span');
   el.className='outside-speech studio-speech-bubble';el.dataset.clipId=c.id;el.setAttribute('role','status');
   measure.className='outside-speech-measure';measure.setAttribute('aria-hidden','true');
   ink.className='outside-speech-text';ink.setAttribute('aria-hidden','true');
   paragraph.append(measure,ink);el.append(paragraph);stage.append(el);
   entry={el,paragraph,measure,ink,signature:null,chars:[],count:-1};entries.set(c.id,entry);
  }
  used.add(c.id);const {el,paragraph,measure,ink}=entry;
  if(entry.signature!==c.text){
   entry.signature=c.text;entry.chars=[];measure.replaceChildren();ink.replaceChildren();
   for(const ch of parsed.chars){
    const span=document.createElement('span');span.textContent=ch.ch;
    if(ch.color)span.style.color=ch.color;
    if(ch.bold)span.style.fontWeight='700';
    if(ch.size!==1)span.style.fontSize=ch.size+'em';
    measure.append(span.cloneNode(true));ink.append(span);entry.chars.push(span);
   }
   entry.count=-1;el.setAttribute('aria-label',parsed.text);
  }
  const scale=(c.bubbleReferenceWidth||15)*k/1280,font=.116*k*(c.fontScale??100)/100;
  Object.assign(el.style,{left:p.x+'px',top:p.y+'px',zIndex:String(++order),
   maxWidth:((c.bubbleWidth||420*(c.bubbleReferenceWidth||15)/1280)*k)+'px',
   minWidth:((c.bubbleMinWidth||0)*k)+'px',padding:(13*scale)+'px '+(17*scale)+'px',
   borderWidth:scale+'px',borderRadius:(13*scale)+'px'});
  el.style.setProperty('--speech-unit',scale);
  el.classList.toggle('studio-speech-interruption',!!c.interruption);
  el.classList.toggle('studio-speech-remote',!!c.remote);
  paragraph.style.fontSize=font+'px';
  paragraph.style.fontFamily=c.fontFamily==='game'?'"LunaPixel", "StudioGame", sans-serif':StudioModel.fonts[c.fontFamily]?.css||'sans-serif';
  if(entry.count!==count){entry.chars.forEach((span,i)=>span.style.visibility=i<count?'visible':'hidden');entry.count=count;}
  W.LunaDialogueCue.sync(el,ready);
  return true;
 }
 function end(effects=[]){
  for(const [id,entry]of entries)if(!used.has(id)){entry.el.remove();entries.delete(id);}
  let opacity=1;
  for(const f of effects)if(['fadeIn','fadeOut'].includes(f.effect))opacity*=1-(f.effect==='fadeIn'?1-f.u:f.u)*f.strength;
  for(const f of effects)if(f.effect==='black')opacity*=1-f.strength;
  stage.style.opacity=String(Math.max(0,Math.min(1,opacity)));
 }
 return {begin,paint,end,dispose(){observer.disconnect();root.remove();entries.clear();}};
}
W.StudioSpeechLayer={create};
})(window);
