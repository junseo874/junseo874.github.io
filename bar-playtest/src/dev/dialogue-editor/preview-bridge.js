/* Runs only inside the editor iframe. Reuses the actual bar renderer; the
   preview clock cannot pump campaign progression or write player progress. */
(function(W){
'use strict';
W.LunaDialoguePreview=function({g,D,ui,render}){
 if(!new URLSearchParams(location.search).has('dialogue-preview')||parent===W)return null;
 const C=W.LunaCore;let active=false,payload=null,elapsed=0,reported=false,skipped=false;
 const send=value=>parent.postMessage({channel:'luna-dialogue-preview',...value},location.origin);
 const ready=()=>send({type:'ready',expressions:Object.fromEntries(Object.entries(D.characterLayers).map(([actor,poses])=>[actor,[...new Set(Object.keys(poses).map(k=>k.replace(/_(?:default|talk)$/,'')))].map(k=>k==='idle'?'default':k)]))});
 function receive(p){
  payload=p;elapsed=0;reported=false;skipped=false;active=true;
  Object.assign(g,{day:p.day,phase:'regular',screen:'bar',story:null,storyCoaster:null,dialogue:null,choice:null,transition:0,pendingTransition:null,cameraLeft:0,cameraMoving:false,tutorial:null,overlay:null,error:null,finished:false,paused:false,hidden:false,currentOrder:null,drink:null,effectVisual:null});
  g.progress={day:p.day,money:p.money??1000,reputation:0,phase:'bar',flags:{tom_name_known:true,day0_skip_tutorial:true,...p.flags},affinity:{}};
  g.resultContext={grade:'good',final_grade:'good',craft_grade:'good',order_match:true};
  const seats={L:null,M:null,R:null},orders={};let warnings=[];
  const apply=(s,last)=>{
   const key=Object.keys(seats).find(k=>seats[k]?.actor===s.actor),guest=seats[key];
   if(s.type==='enter')seats[s.arg]={id:s.actor,actor:s.actor,state:'STORY',seated:!last||!p.animate,arrivalAt:g.realTime,arrivalDuration:.65,coaster:false,glass:null,expression:'default'};
   if(s.type==='exit'&&key){if(last&&p.animate)guest.state='EXITING';else seats[key]=null;}
   if(s.type==='expression'&&guest)guest.expression=s.arg||'default';
   if(s.type==='coaster'&&guest)guest.coaster=true;
   if(s.type==='order')orders[s.actor]=s.arg.replace(/^exact:/,'');
   if(s.type==='serve'&&guest){const id=orders[s.actor];if(D.tables.cocktails.some(c=>c.id===id)){guest.glass=id;guest.glassEmpty=false;}else warnings.push('주문 결과가 정해지지 않은 잔은 표시하지 않습니다.');}
   if(s.type==='empty_glass'&&guest)guest.glassEmpty=true;
   if(s.type==='choice'&&!last){const selected=p.picks?.[s.row_id];if(selected)C.applyEffects(selected.effects,g.progress);}
   if(!last)C.applyEffects(s.effects,g.progress);
  };
  for(let i=0;i<=p.index;i++){
   const s=p.rows[i];let enabled=true;try{enabled=C.condition(s.when,g.ctx());}catch(e){warnings.push(e.message);}
   if(!enabled&&i<p.index)continue;
   if(i===p.index&&!enabled){warnings.push('현재 조건으로 실행되지 않는 줄입니다. 직접 선택한 줄은 검토용으로 표시합니다.');skipped=!!p.playing;}
   apply(s,i===p.index);
  }
  // Keep decoded sprites and speech animation clocks when editing the same cast.
  for(const seat of ['L','M','R'])if(g.seats[seat]?.actor===seats[seat]?.actor&&seats[seat])seats[seat]=Object.assign(g.seats[seat],seats[seat]);
  g.seats=seats;const row=p.rows[p.index];g.focus=Object.keys(seats).find(k=>seats[k]?.actor===row.actor)||Object.keys(seats).find(k=>seats[k])||'R';
  if(['say','order'].includes(row.type)&&row['text.ko']){g.dialogue=g.makeLine(row.actor,row['text.ko'],row.dialogue_id,row.arg);if(!p.animate)g.dialogue.chars=g.dialogue.text.length;}
  if(row.type==='choice')g.choice={step:row,rows:p.choices};
  ui.sound=false;ui.gimmickAudio=false;ui.auto=false;ui.readSkip=false;ui.drag=null;
  render(true);send({type:'state',index:p.index,warnings,cast:Object.values(seats).filter(Boolean).map(x=>x.actor),choices:p.choices?.map(c=>({seq:c.seq,enabled:C.condition(c.when,g.ctx())}))});
 }
 W.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.channel!=='luna-dialogue-editor')return;try{if(e.data.type==='hello')ready();if(e.data.type==='show')receive(e.data.payload);if(e.data.type==='stop'&&payload)payload.playing=false;}catch(error){send({type:'error',message:error.message});}});
 const input=e=>{if(!active)return;const target=e.target.closest?.('[data-act]');if(e.type==='click'){if(target?.dataset.act==='choice')send({type:'choice',seq:target.dataset.id});else if(target?.dataset.act==='advance')send({type:'advance'});}e.preventDefault();e.stopImmediatePropagation();};
 for(const name of ['click','pointerdown','pointerup','keydown','keyup'])document.addEventListener(name,input,true);
 document.documentElement.classList.add('dialogue-editor-preview');
 ready();
 return {get active(){return active;},tick(dt){
  if(!payload)return;g.realTime+=dt;g.cameraLeft=0;g.overlay=null;g.paused=false;g.hidden=false;elapsed+=dt;
  if(g.dialogue&&payload.animate&&!g.cameraMoving)g.typeLine(g.dialogue,dt,false);
  const row=payload.rows[payload.index],done=skipped||(g.dialogue?g.dialogue.chars>=g.dialogue.text.length:elapsed>=(row.type==='enter'?1.65:.8));
  if(payload.playing&&!reported&&row.type!=='choice'&&done&&elapsed>(g.dialogue?g.dialogue.text.length*.018+1.2:.8)){reported=true;send({type:'complete',index:payload.index});}
 }};
};
})(window);
