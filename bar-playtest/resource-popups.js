/* Resource-review only: reuse the real popup renderers in an isolated iframe. */
(function(W){
'use strict';
const group='common-popups';
const moved=new Set(['ui:income','ui:unlock','ui:dossier','ui:warnings','ui:exterior:purchase',...['service','settings','help','history','sales','johnnyUnlock'].map(id=>'ui:overlay:'+id)]);
const duplicates=new Set(['fx:income','fx:expense','fx:unlock','fx:purchase']);
function collect(rows,C){
 if(!C.groups.some(g=>g[0]===group))C.groups.unshift([group,'공통','팝업 / 알림 테스트']);
 const result=rows.filter(r=>!duplicates.has(r.id)).map(r=>moved.has(r.id)?{...r,sourceGroup:r.group,group,popupKind:['ui:income','ui:exterior:purchase'].includes(r.id)?'toast':'dialog'}:r);
 const make=(id,title,variants,note)=>({id:'popup:'+id,group,title,usage:'실제 알림 · 클릭하여 재생',status:'code',layers:[],popupKind:'toast',variants,launch:variants[0].launch,note,preview:'assets/resource-previews/popup_'+id+'.jpg',previewNote:'실제 팝업 테스트 화면 · 2026-10-12'});
 const places=(kind)=>['bar','outside'].map(place=>({id:place,label:place==='bar'?'바 내부':'외부 거리',launch:{type:'popup-story',kind,place}}));
 result.push(make('meet','신규 인물 정보 등록',places('meet'),'화면 오른쪽 중앙에 등장한 뒤 자동으로 사라집니다. 인물·장소를 바꿔 반복 확인할 수 있습니다.'));
 result.push(make('affinity','호감도 상승 / 하락',['bar','outside'].flatMap(place=>['up','down'].map(kind=>({id:place+'-'+kind,label:(place==='bar'?'바 내부':'외부 거리')+' · '+(kind==='up'?'상승':'하락'),launch:{type:'popup-story',place,kind}}))),'같은 관계 알림의 상승·하락 문구와 색상을 비교합니다. 테스트 인물은 위에서 선택하세요.'));
 result.push(make('event','새로운 이벤트 발생',[{id:'outside',label:'외부 거리 · 강제 이벤트',launch:{type:'popup-story',place:'outside',kind:'event'}}],'외부 강제 이벤트 진입 시의 우측 하단 알림만 재생합니다. 컷씬은 시작하지 않습니다.'));
 const currency=result.find(r=>r.id==='ui:income');
 currency.variants.push(...['income','expense'].map(id=>({id:'outside-'+id,label:'외부 거리 · '+(id==='income'?'증가':'차감'),launch:{type:'popup-money',id}})));
 const warning=result.find(r=>r.id==='ui:warnings');
 warning.variants.push({id:'homeward',label:'외부 · 귀가 전 할 일 안내',launch:{type:'popup-homeward'}});
 warning.note='병따개 누락·재료 초과·귀가 전 할 일 안내를 선택해 확인합니다. 동일한 경고의 내용별 상태는 한 항목에서 관리합니다.';
 const unlock=result.find(r=>r.id==='ui:unlock');
 unlock.variants=[1,2,3].map(day=>({id:'day-'+day,label:day+'일차 해금',launch:{type:'popup-unlock',day}}));
 return result;
}
async function startOutside(F){
 const o=F.outsidePlaytest;F.lunaCampaign.ui.outside=true;
 Object.assign(o.config,{day:1,flow:'out',place:'bar'});
 await o.start({showDevHint:false});if(o.loadError)throw Error(o.loadError);
 o.model.paused=false;o.model.story.cancel();o.model.backgroundStory.cancel();
 o.snapCamera();o.refreshHUD?.();o.tick(0);
 return o;
}
async function play(F,d,isCurrent){
 const g=F.barGame,c=F.lunaCampaign,q=F.lunaQA;
 if(d.type==='popup-unlock'){q.state.sourceDay=String(d.day);q.runSituation('unlock');return;}
 if(d.type==='popup-money'){
  q.runSituation('income');g.progress.money=1000;
  const o=await startOutside(F);if(!isCurrent())return;
  // Initialize the real currency tracker at the baseline before changing it.
  o.tick(0);g.progress.money+=d.id==='income'?500:-300;o.tick(0);return;
 }
 if(d.type==='popup-homeward'){
  await startOutside(F);if(!isCurrent())return;
  c.showHomewardRequirements(['wild_dog','bitters']);c.resumeView='developer';return;
 }
 // Empty bar: no guest timers, dialogue or first-encounter side effects.
 g.screen='bar';g.phase='practice';g.seats={L:null,M:null,R:null};g.story=null;g.dialogue=null;g.craft=null;g.overlay=null;
 if(d.place==='outside')await startOutside(F);if(!isCurrent())return;
 const n=F.LunaStoryNotices,id=d.actor||'chris';n.clear();
 if(d.kind==='meet'){delete g.progress.flags[id+'_met'];n.meet(g.progress,id);}
 else if(d.kind==='event')n.forced({encounter:{},qa:null});
 else n.affinity(g.progress,id,d.kind==='up'?1:-1);
}
W.ResourcePopups={group,collect,play};
})(window);
