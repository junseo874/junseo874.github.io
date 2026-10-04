/* Day-two memory: isolated bar model, never mutates the active shift or its camera. */
(function(W){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function state(dialog,D){
 if(dialog.johnnyView)return dialog.johnnyView;
 const g=new W.LunaCore.Game(D);g.reset(2,'regular',1,false);g.phase='regular';g.screen='bar';g.focus='R';
 const asset=id=>D.assets[id]?.src||'',tom={id:'memory-tom',actor:'tom',state:'STORY',coaster:true,glass:null,expression:'idle',seated:false};
 const views=W.LunaBarViews({D,g,ui:{drag:null},L:(ko)=>ko,esc,a:asset,button:()=>'',itemArt:()=>'',drinkArt:id=>'<img class="drink-art" src="'+esc(asset('table_cocktail_'+id)||asset('table_cocktail_godfather'))+'" alt="" draggable="false">',recipeLines:()=>''});
 return dialog.johnnyView={g,views,tom,entryAt:null};
}
function update(dialog,D,dt=0){
 const s=state(dialog,D),r=dialog.rows[dialog.index];s.g.realTime+=dt;
 if(r.tomPresent&&s.entryAt===null)s.entryAt=s.g.realTime;
 s.g.seats={L:null,M:null,R:r.tomPresent?s.tom:null};s.tom.glass=r.served?'godfather':null;
 s.g.dialogue={actor:r.actor==='johnny'?'luna':r.actor,text:r.text,chars:dialog.chars,expression:'idle'};
 return s;
}
function html(dialog,D){
 const s=update(dialog,D),r=dialog.rows[dialog.index];
 return '<div class="johnny-memory bar-view" data-memory-pov="johnny"><div class="johnny-memory-world">'+s.views.worldHTML()+'</div><div class="johnny-memory-texture" aria-hidden="true"></div><button class="campaign-speech johnny-memory-speech" data-campaign="next" data-world-speech="true" aria-label="다음 대사"><p><span class="campaign-measure" aria-hidden="true">'+esc(r.text)+'</span><span class="campaign-ink"></span></p></button></div>';
}
function sync(host,dialog,D,dt=0){
 const s=update(dialog,D,dt),root=host.querySelector('.johnny-memory');if(!root)return;
 // Only sprite layers are refreshed, leaving the speech DOM, focus and world geometry intact.
 const actor=root.querySelector('.regular-plane');if(actor)actor.innerHTML=dialog.rows[dialog.index].tomPresent?s.views.actorHTML(s.tom,1290/2041*100):'';
 const plane=root.querySelector('.counter-plane'),bubble=root.querySelector('.johnny-memory-speech');if(!plane||!bubble)return;
 const m=new DOMMatrixReadOnly(getComputedStyle(plane).transform),y=dialog.rows[dialog.index].actor==='johnny'?601:555.5;
 W.LunaWorldSpeech.place(bubble,{x:m.a*1290+m.e,y:m.d*y+m.f,scale:m.a*.75});
}
async function prepare(D){const keys=['bar_far','bar_mid','bar_front','char_tom_static','coaster','table_cocktail_godfather'];await Promise.all(keys.filter(k=>D.assets[k]).map(k=>{const img=new Image();img.src=D.assets[k].src;return img.decode();}));}
let audio;
function cue(kind,enabled=true){
 if(!enabled)return;try{audio??=new(W.AudioContext||W.webkitAudioContext)();audio.resume().catch(()=>{});const at=audio.currentTime,bus=W.LunaSfx.output(audio);
 const tone=(hz,start,len,level)=>{const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.value=hz;v.gain.setValueAtTime(level,start);v.gain.exponentialRampToValueAtTime(.0001,start+len);o.connect(v);v.connect(bus);o.start(start);o.stop(start+len);o.onended=()=>{o.disconnect();v.disconnect();};};
 if(kind==='message'){tone(880,at,.25,.08);tone(1175,at+.12,.35,.06);return;}
 // Placeholder sliding-door texture followed by a quiet latch, using the common SFX bus.
 const len=.7,buf=audio.createBuffer(1,audio.sampleRate*len,audio.sampleRate),arr=buf.getChannelData(0);for(let i=0;i<arr.length;i++)arr[i]=(Math.random()*2-1)*Math.sin(i/arr.length*Math.PI);
 const n=audio.createBufferSource(),f=audio.createBiquadFilter(),v=audio.createGain();n.buffer=buf;f.type='lowpass';f.frequency.value=1100;v.gain.value=.12;n.connect(f);f.connect(v);v.connect(bus);n.start(at);n.onended=()=>{n.disconnect();f.disconnect();v.disconnect();};tone(125,at+.64,.16,.13);tone(650,at+.68,.4,.025);
 }catch{}
}
W.LunaJohnnyMemory={html,sync,prepare,cue};
})(window);
