window.StudioKeyframeEditor=function(api){'use strict';
const M=StudioModel,K=StudioKeyframes,root=document.querySelector('#inspector-body'),timeline=document.querySelector('#timeline-content'),esc=api.esc;
let owner='',channel='',keyId='',drag=null,view='clips';
const collapsed=new Set(),scrollPositions={clips:0,keys:0},FPS=30;
const getClip=id=>api.project().clips.find(c=>c.id===id);
const locked=c=>window.StudioAuthoringModel?.locked(api.project(),c);
const frame=t=>Math.round(t*FPS),stamp=t=>frame(t)+'f · '+t.toFixed(3)+'s';
const keyClip=el=>getClip(el.closest('[data-key-clip],[data-clip]')?.dataset.keyClip||el.closest('[data-clip]')?.dataset.clip);
const selectedKey=()=>getClip(owner)?.keyframes?.[channel]?.find(k=>k.id===keyId);
function moveKey(c,k,ch,t){
 if(locked(c)||!Number.isFinite(t))return;const previous=k.t;k.t=M.clamp(t,0,c.duration);
 K.markEdited(c,ch);const others=c.keyframes[ch].filter(a=>a!==k);
 // Preserve both keys on collision; choose the nearest free frame instead of overwriting.
 if(others.some(a=>Math.abs(a.t-k.t)<.0005)){
  const wanted=k.t;let found=false;
  for(let n=1;n<=c.keyframes[ch].length+1&&!found;n++)for(const sign of [1,-1]){
   const candidate=wanted+sign*n/FPS;
   if(candidate>=0&&candidate<=c.duration&&!others.some(a=>Math.abs(a.t-candidate)<.0005)){k.t=candidate;found=true;break;}
  }
  if(!found)k.t=previous;
 }
 c.keyframes[ch].sort((a,b)=>a.t-b.t);
}
function removeKey(){const c=getClip(owner);if(!selectedKey()||locked(c))return;const tr=api.begin();K.remove(c,channel,keyId);keyId='';tr.commit();}
function setView(next,reveal=false){const scroll=document.querySelector('#timeline-scroll');scrollPositions[view]=scroll.scrollTop;view=next;if(reveal){collapsed.delete(owner);api.reveal?.(owner);}api.preview();scroll.scrollTop=scrollPositions[view];if(reveal){const row=timeline.querySelector('[data-key-group="'+owner+'"]');if(row)scroll.scrollTop+=row.getBoundingClientRect().top-scroll.getBoundingClientRect().top-31;}}
function header(){
 document.querySelector('#snap-unit').textContent=view==='keys'?'자석 1프레임':'자석 0.25s';
 for(const b of document.querySelectorAll('[data-timeline-view]'))b.setAttribute('aria-selected',String(b.dataset.timelineView===view));
 const bar=document.querySelector('#keyframe-actions');bar.hidden=view!=='keys';
 const k=selectedKey();document.querySelector('#key-selection').textContent=k?K.fields[channel].name+' · '+stamp(getClip(owner).start+k.t)+' · '+k.value.toFixed(2):'◆ 선택 · 드래그 이동 · Delete 삭제';
 document.querySelector('#delete-timeline-key').disabled=!k||locked(getClip(owner));
 document.querySelector('#timeline-frame').textContent=frame(api.time())+'f / 30 fps';
}
function lanes(width,subset,all=false){
 const p=api.project(),clips=(subset||p.clips).filter(c=>K.channels(c).length&&(all||Object.values(c.keyframes||{}).some(keys=>keys.length))).sort((a,b)=>a.start-b.start);
 if(!clips.length)return '';
 let h='';
 for(const c of clips){
  const tr=p.tracks.find(t=>t.id===c.track),closed=collapsed.has(c.id),name=(p.actors[c.actor]?.name||M.kinds[c.type].name)+' · '+c.title;
  h+='<div class="key-group '+(tr.muted?'key-muted':'')+'" data-key-group="'+c.id+'" data-key-clip="'+c.id+'"><div class="lane key-group-heading"><div class="track-label"><button data-key-fold="'+c.id+'" aria-expanded="'+!closed+'" title="'+esc(name)+'">'+(closed?'▸':'▾')+' '+esc(name)+'</button></div><div class="lane-area" style="width:'+width+'px;--second-width:'+api.scale()+'px"><button class="key-clip-range" data-key-owner="'+c.id+'" style="left:'+c.start*api.scale()+'px;width:'+c.duration*api.scale()+'px" title="'+esc(c.title)+' · '+stamp(c.start)+' → '+stamp(c.start+c.duration)+'">'+esc(c.title)+(tr.muted?' · 꺼짐':'')+'</button></div></div>';
  if(!closed)for(const ch of K.channels(c).filter(ch=>all||c.keyframes?.[ch]?.length)){
   const color=({x:'#ef9896',y:'#9ed58e',red:'#ef9896',green:'#9ed58e',blue:'#8eb9f4'})[ch]||'#8eb9f4';
   h+='<div class="lane key-property '+(owner===c.id&&channel===ch?'selected':'')+'" data-key-channel-row="'+ch+'" style="--key-color:'+color+'"><div class="track-label"><button data-key-property="'+ch+'" title="'+K.fields[ch].name+' 키프레임 편집">'+K.fields[ch].name+'</button><output data-key-value="'+ch+'">'+K.value(c,ch,M.clamp(api.time()-c.start,0,c.duration)).toFixed(2)+'</output></div><div class="lane-area key-lane-area" data-key-channel="'+ch+'" style="width:'+width+'px;--second-width:'+api.scale()+'px"><span class="key-span" style="left:'+c.start*api.scale()+'px;width:'+c.duration*api.scale()+'px"></span>';
   for(const k of c.keyframes?.[ch]||[])h+='<button class="timeline-key property-key '+(c.id===owner&&k.id===keyId?'active':'')+'" data-kf-channel="'+ch+'" data-kf-id="'+k.id+'" aria-label="'+K.fields[ch].name+' '+stamp(c.start+k.t)+' 값 '+k.value.toFixed(2)+'" title="'+K.fields[ch].name+' · '+stamp(c.start+k.t)+' · 값 '+k.value.toFixed(2)+'" style="left:'+((c.start+k.t)*api.scale())+'px">◆</button>';
   h+='</div></div>';
  }
  h+='</div>';
 }
 return h;
}
document.querySelectorAll('[data-timeline-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.timelineView)));
document.querySelector('#delete-timeline-key').onclick=removeKey;
timeline.addEventListener('click',e=>{const fold=e.target.closest('[data-key-fold]');if(fold){const id=fold.dataset.keyFold;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);api.preview();return;}const b=e.target.closest('[data-key-property],[data-key-owner]');if(b){const c=keyClip(b);owner=c.id;channel=b.dataset.keyProperty||Object.keys(c.keyframes||{})[0]||K.channels(c)[0];keyId='';api.select(c.id,false);refresh();}});
timeline.addEventListener('dblclick',e=>{const lane=e.target.closest('.key-lane-area');if(!lane||e.target.closest('button'))return;const c=keyClip(lane),ch=lane.dataset.keyChannel,t=(e.clientX-lane.getBoundingClientRect().left)/api.scale();if(locked(c)||t<c.start||t>c.start+c.duration)return;owner=c.id;channel=ch;api.select(c.id,false);const tr=api.begin(),k=K.add(c,ch,M.clamp(Math.round(t*FPS)/FPS-c.start,0,c.duration));keyId=k.id;api.seek(c.start+k.t);tr.commit();});
const modes=[['inherit','클립 보간 사용'],['linear','일정한 속도'],['smooth','부드러운 시작과 도착'],['in','점점 빠르게'],['out','점점 느리게'],['hold','유지 후 전환'],['custom','사용자 지정']];
function ensure(c){if(!c)return;if(owner!==c.id){owner=c.id;channel=Object.keys(c.keyframes||{})[0]||K.channels(c)[0];keyId='';}if(!K.channels(c).includes(channel))channel=K.channels(c)[0];if(!c.keyframes?.[channel]?.some(k=>k.id===keyId))keyId='';}
function key(c){ensure(c);return c?.keyframes?.[channel]?.find(k=>k.id===keyId);}
function curveTarget(c){const k=key(c);if(!k)return c;return k.ease==='inherit'?{ease:c.ease||'linear',easeCurve:c.easeCurve,uiEase:'inherit'}:k;}
function setEase(c,ease){if(locked(c))return true;const k=key(c);if(!k)return false;K.markEdited(c,channel);if(ease==='custom'&&!k.easeCurve)k.easeCurve=M.curvePoints(curveTarget(c));k.ease=ease;return true;}
function setCurve(c,points){if(locked(c))return true;const k=key(c);if(!k)return false;K.markEdited(c,channel);k.ease='custom';k.easeCurve=points;return true;}
function limits(c){return{min:0,max:c.duration};}
function edit(c,path,v){if(locked(c))return;const k=key(c);if(!k)return;K.markEdited(c,channel);if(path==='key.value')k.value=['visible','flipX'].includes(channel)?(Number(v)>=.5?1:0):M.clamp(Number(v),K.fields[channel].min,K.fields[channel].max);else if(path==='key.time')moveKey(c,k,channel,Number(v));}
function fieldValue(c,path){const k=key(c);return path==='key.time'?k?.t:k?.value;}
function inspector(c){ensure(c);if(!K.channels(c).length)return '';const keys=c.keyframes?.[channel]||[],k=key(c),f=K.fields[channel];let h='<section class="keyframe-panel"><h3>클립 키프레임 <button data-show-keyframes>타임라인에서 보기</button></h3><div class="keyframe-toolbar"><select id="keyframe-channel" aria-label="키프레임 속성">'+K.channels(c).map(ch=>'<option value="'+ch+'" '+(ch===channel?'selected':'')+'>'+K.fields[ch].name+(c.keyframes?.[ch]?' ◆':'')+'</option>').join('')+'</select><button id="add-keyframe" title="재생 헤드 위치에 키프레임 추가">＋ ◆</button><output data-kf-clock></output></div><div class="keyframe-list">'+keys.map(a=>'<button data-key-select="'+a.id+'" class="'+(a.id===keyId?'active':'')+'" title="시퀀스 '+stamp(c.start+a.t)+' · 클립 안 '+a.t.toFixed(3)+'초"><span>◆ '+frame(c.start+a.t)+'f</span><b>'+a.value.toFixed(2)+'</b></button>').join('')+'</div>';
 if(k){const b=limits(c);h+='<div class="field-row">'+api.field('클립 안 시간 (초)','key.time',k.t,'number','min="'+b.min+'" max="'+b.max+'"')+(['visible','flipX'].includes(channel)?'<label class="field binary-field"><span>'+f.name+'</span><input type="checkbox" data-field="key.value" data-on="1" data-off="0" '+(k.value>=.5?'checked':'')+'></label>':api.field(f.name,'key.value',k.value,'number','min="'+f.min+'" max="'+f.max+'"'))+'</div>';if(keys.at(-1)!==k&&!['visible','flipX'].includes(channel))h+=api.selectField('이 키 → 다음 키 보간','ease',k.ease,modes)+(k.ease==='hold'?'':StudioCurveEditor.markup(curveTarget(c)));h+='<button id="remove-keyframe" class="danger">선택 키 삭제</button>';}
 return h+'</section>';
}
function timelineMarkup(c){let h='';if(c.type==='audio'){const fi=Math.min(100,c.fadeIn/c.duration*100),fo=Math.max(0,100-c.fadeOut/c.duration*100);let points='';for(let i=0;i<=32;i++)points+=(i?' ':'')+(i/32*100)+','+(92-K.audioGain(c,i/32*c.duration)*72);h+='<svg class="audio-envelope" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 '+fi+',0 0,100"/><polygon points="'+fo+',0 100,0 100,100"/><polyline points="'+points+'"/></svg><button class="audio-fade-handle in" data-audio-fade="fadeIn" title="페이드 인 '+c.fadeIn.toFixed(2)+'초 · 좌우 드래그" aria-label="페이드 인" style="left:clamp(8px,'+fi+'%,calc(100% - 8px))"></button><button class="audio-fade-handle out" data-audio-fade="fadeOut" title="페이드 아웃 '+c.fadeOut.toFixed(2)+'초 · 좌우 드래그" aria-label="페이드 아웃" style="left:clamp(8px,'+fo+'%,calc(100% - 8px))"></button>';}
 const ch=c.id===owner?channel:Object.keys(c.keyframes||{})[0];if(ch&&c.keyframes?.[ch])for(const k of c.keyframes[ch])h+='<button class="timeline-key '+(c.id===owner&&k.id===keyId?'active':'')+'" data-kf-channel="'+ch+'" data-kf-id="'+k.id+'" style="left:clamp(7px,'+(k.t/c.duration*100)+'%,calc(100% - 7px))" aria-label="'+K.fields[ch].name+' '+k.t.toFixed(2)+'초 키프레임" title="'+K.fields[ch].name+' · '+k.t.toFixed(2)+'초 · '+k.value.toFixed(2)+'">◆</button>';return h;
}
function refresh(){api.refresh();}
function selectKey(c,id,ch=channel){owner=c.id;channel=ch;keyId=id;api.select(c.id,false);const k=key(c);if(k)api.seek(c.start+k.t);refresh();}
root.addEventListener('change',e=>{if(e.target.id==='keyframe-channel'){channel=e.target.value;keyId='';refresh();}});
root.addEventListener('click',e=>{const c=api.clip();if(!c)return;if(e.target.closest('[data-show-keyframes]')){setView('keys',true);return;}const b=e.target.closest('[data-key-select]');if(b){selectKey(c,b.dataset.keySelect);return;}if(locked(c))return;if(e.target.closest('#add-keyframe')){const tr=api.begin();const k=K.add(c,channel,M.clamp(api.time()-c.start,0,c.duration));keyId=k.id;tr.commit();}if(e.target.closest('#remove-keyframe')){const tr=api.begin();K.remove(c,channel,keyId);keyId='';tr.commit();}});
function update(){header();for(const el of timeline.querySelectorAll('[data-key-value]')){const cl=keyClip(el);if(!cl)continue;el.textContent=K.value(cl,el.dataset.keyValue,M.clamp(api.time()-cl.start,0,cl.duration)).toFixed(2);}const c=api.clip();if(!c)return;const clock=root.querySelector('[data-kf-clock]');if(clock)clock.textContent=M.clamp(api.time()-c.start,0,c.duration).toFixed(2)+'s';for(const input of root.querySelectorAll('input[data-field]')){const path=input.dataset.field;if(K.channels(c).includes(path)&&c.keyframes?.[path]?.length){input.disabled=!document.body.classList.contains('scene-recording');input.title='키프레임 패널에서 값을 조절하세요.';}}}
function finish(cancel){if(!drag)return;const d=drag;drag=null;document.body.classList.remove('keyframe-dragging');if(d.tr){if(cancel)d.tr.cancel();else d.tr.commit();}if(timeline.hasPointerCapture(d.pointer))timeline.releasePointerCapture(d.pointer);if(d.id)timeline.querySelector('[data-kf-id="'+d.id+'"]')?.focus({preventScroll:true});}
timeline.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-kf-id],[data-audio-fade]');if(!b||e.button!==0||!e.isPrimary)return;e.preventDefault();e.stopImmediatePropagation();const c=keyClip(b);if(b.dataset.kfId)selectKey(c,b.dataset.kfId,b.dataset.kfChannel);else api.select(c.id,false);if(locked(c))return;drag={pointer:e.pointerId,c,id:b.dataset.kfId,ch:b.dataset.kfChannel,fade:b.dataset.audioFade,x:e.clientX,start:b.dataset.kfId?key(c).t:c[b.dataset.audioFade],tr:null};timeline.setPointerCapture(e.pointerId);},true);
document.addEventListener('pointermove',e=>{const d=drag;if(!d||d.pointer!==e.pointerId||Math.abs(e.clientX-d.x)<2&&!d.tr)return;e.preventDefault();d.tr??=api.begin();document.body.classList.add('keyframe-dragging');const delta=(e.clientX-d.x)/api.scale(),snap=v=>e.shiftKey||!document.querySelector('#snap').checked?v:Math.round(v*FPS)/FPS;
 if(d.id){const k=key(d.c);moveKey(d.c,k,d.ch,snap(d.c.start+d.start+delta)-d.c.start);api.seek(d.c.start+k.t);}else{const other=d.fade==='fadeIn'?'fadeOut':'fadeIn';d.c[d.fade]=M.clamp(snap(d.start+delta*(d.fade==='fadeIn'?1:-1)),0,Math.max(0,d.c.duration-d.c[other]));}api.preview();}, {passive:false});
document.addEventListener('pointerup',e=>{if(drag?.pointer===e.pointerId)finish(false);});document.addEventListener('pointercancel',e=>{if(drag?.pointer===e.pointerId)finish(true);});timeline.addEventListener('lostpointercapture',e=>{if(drag?.pointer===e.pointerId)finish(true);});window.addEventListener('blur',()=>finish(true));
document.addEventListener('keydown',e=>{
 if(drag){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true);}else if(!['Shift','Alt','Control','Meta'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}return;}
 if(view==='keys'&&e.target.id==='timeline-scroll'&&['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();removeKey();return;}
 const b=e.target.closest('[data-kf-id],[data-key-select],[data-audio-fade]');
 if(!b||!['Enter','ArrowLeft','ArrowRight','Delete','Backspace'].includes(e.key))return;
 e.preventDefault();e.stopImmediatePropagation();
 const c=keyClip(b)||api.clip(),id=b.dataset.kfId||b.dataset.keySelect,side=b.dataset.audioFade;if(locked(c))return;
 if(id){selectKey(c,id,b.dataset.kfChannel||channel);if(e.key==='Enter'){timeline.querySelector('[data-kf-id="'+id+'"]')?.focus({preventScroll:true});return;}const tr=api.begin();if(['Delete','Backspace'].includes(e.key)){K.remove(c,channel,keyId);keyId='';}else{edit(c,'key.time',key(c).t+(e.key==='ArrowLeft'?-1:1)*(b.dataset.kfId?(e.shiftKey?10:1)/FPS:(e.shiftKey?.01:.1)));api.seek(c.start+key(c).t);}tr.commit();const attr=b.dataset.keySelect?'data-key-select':'data-kf-id';const next=document.querySelector('['+attr+'="'+id+'"]');if(next)next.focus({preventScroll:true});else document.querySelector('#timeline-scroll').focus({preventScroll:true});}
 else if(e.key.startsWith('Arrow')){api.select(c.id,false);const tr=api.begin(),other=side==='fadeIn'?'fadeOut':'fadeIn';c[side]=M.clamp(c[side]+(e.key==='ArrowRight'?1:-1)*(side==='fadeIn'?1:-1)*.1,0,Math.max(0,c.duration-c[other]));tr.commit();timeline.querySelector('[data-clip="'+c.id+'"] [data-audio-fade="'+side+'"]')?.focus();}
},true);
return{clearSelection(){owner='';channel='';keyId='';},get view(){return view;},header,lanes,inspector,timelineMarkup,key,curveTarget,setEase,setCurve,edit,fieldValue,update};
};
