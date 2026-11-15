/* Opt-in, same-origin editor iframe only. Install disposable browser storage
   before game settings/history initialize. A rehearsal never writes a save. */
(function(W){
'use strict';
const query=new URLSearchParams(location.search);
if(parent===W||['dev','dialogue-preview','bar-rehearsal'].some(k=>query.get(k)!=='1'))return;
const send=(type,more)=>parent.postMessage({channel:'luna-bar-rehearsal',type,...more},location.origin);
try{
 for(const name of ['localStorage','sessionStorage']){
  const data=new Map();Object.defineProperty(W,name,{value:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear()}});
 }
}catch{send('error',{message:'임시 저장 공간을 분리할 수 없어 테스트를 시작하지 않았습니다.'});W.stop();return;}
W.addEventListener('blur',e=>e.stopImmediatePropagation(),true);
let g,originalNext,finished=false,live=false,stamp='';
function report(){
 if(!live)return;const row=g.story?.steps[g.story.index],label=g.error?'실행 오류: '+(g.error.message||g.error):finished?'바 대본 테스트 완료':g.story?.scene?.title||'장면 준비 중';
 const data={label,kind:row?.type||'',actor:row?.actor||'',seq:row?.seq,done:finished,craft:!finished&&!g.transition&&!g.cameraMoving&&!g.drink&&row?.type==='craft',coaster:!!(g.storyCoaster||g.tutorial?.kind==='coaster'),order:g.currentOrder?.cocktail,flags:Object.keys(g.progress.flags).filter(k=>!k.startsWith('bp_')&&g.progress.flags[k])};
 const s=JSON.stringify(data);if(s!==stamp){stamp=s;send('state',data);}
}
function run(p){
 g=W.barGame;if(!g||!W.lunaCampaign)throw Error('게임 화면이 아직 준비되지 않았습니다.');
 if(!originalNext)originalNext=g.nextScene.bind(g);
 W.lunaCampaign.developer();g.refreshDialogueData=null;for(const k of ['scenes','days','steps','bar_choices','bar_choice_groups'])g.t[k]=p.tables[k];
 g.reset(p.day,'regular',1,false);Object.assign(g.progress.flags,p.flags||{});g.progress.money=p.money??1000;g.read.clear();finished=false;live=true;stamp='';
 g.nextScene=function(){if(this.story?.cursor>=this.story?.autos.length&&this.phase==='opening'){this.startStoryPhase('bar');return;}originalNext();};
 g.finishDay=function(){finished=true;this.finished=true;this.dialogue=null;this.choice=null;report();};
 g.startStoryPhase(p.phase);g.changed();report();
}
W.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.channel!=='luna-editor-rehearsal')return;
 try{
  if(e.data.type==='start')run(e.data.payload);
  if(e.data.type==='advance'&&live){const at=g.storyCoaster||g.tutorial?.kind==='coaster'&&g.tutorial;
   if(at){if(!g.coaster(at.seat,'keyboard'))throw Error('손님 등장 및 카메라 이동이 끝난 뒤 코스터를 놓으세요.');}
   else if(g.dialogue){g.dialogue.chars=g.dialogue.text.length;g.advance();}}
  if(e.data.type==='serve'&&live){const order=g.currentOrder;if(!order||g.story?.steps[g.story.index]?.type!=='craft'||g.transition)throw Error('제조 대기 상태에서 사용할 수 있습니다.');
   if(!g.seats[order.seat]?.coaster)throw Error('이 손님에게 코스터가 없습니다. 편집기에서 주문 앞에 코스터 제공을 추가하세요.');
   if(g.tutorial?.kind==='recipe'){g.tutorial=null;g.progress.flags.day0_recipe_taught=true;g.progress.flags.day0_pour_taught=true;}
   if(!g.openRecipes()||!g.selectCocktail(e.data.drink||order.cocktail))throw Error('서비스 패널에서 선택할 수 있는 술인지 확인하세요.');g.debugCraft(e.data.grade);if(g.error)throw Error(g.error);if(g.remix)g.remix.resultLock=0;g.offer();if(!g.serve(order.seat,'drag'))throw Error('아직 제공할 수 없습니다.');}
  report();
 }catch(err){send('error',{message:err.message});}
});
W.addEventListener('load',()=>send('ready'));W.setInterval(report,180);
W.addEventListener('keydown',e=>{if(e.key==='Escape'&&live&&!g.overlay){e.preventDefault();e.stopImmediatePropagation();send('close');}},true);
})(window);
