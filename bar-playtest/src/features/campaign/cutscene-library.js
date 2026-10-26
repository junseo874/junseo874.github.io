/* Developer-only gallery. Reuse live story data and players, never start a campaign. */
(function(W){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=[
 {id:'opening-a',day:'0일차',title:'마지막 부탁 → 루나의 기상',kind:'studio',key:'opening',description:'검은 화면의 네 문장 · 키 입력 후 크리스의 연락까지'},
 {id:'wake-a',day:'0일차',title:'루나의 기상 · 크리스의 연락',kind:'studio',key:'opening',wake:true,description:'집에서 깨어나는 구간부터 재생'},
 {id:'sleep',day:'외부 이벤트',title:'소파 · 잠든 루나',kind:'studio',key:'sleep',description:'테라스 대화가 없는 밤의 수면 장면'},
 {id:'morning',day:'외부 이벤트',title:'다음 날 · 눈뜨기와 환복',kind:'studio',key:'morning',description:'수면 → 눈뜨기 → 암전 → 환복 후 기립'},

 {id:'tv',day:'0일차',title:'TV 다큐 · 인공생명체의 역사',kind:'studio',key:'documentary',description:'흑백 이미지 5장 · 키 입력으로 대사 진행'},
 {id:'boobi-reveal',day:'외부 이벤트',sceneDay:2,title:'부비 · 박스에서 등장',kind:'neighborhood',key:'reveal',description:'박스의 눈동자 → 뛰어올라 옆 박스에 착지'},
 {id:'boobi-adoption',day:'외부 이벤트',sceneDay:2,title:'부비 · 참치캔과 입양',kind:'neighborhood',key:'feed',description:'참치캔 → 옆집 아저씨 → 암전 후 집으로 이동'},
 {id:'boobi-rest',day:'외부 이벤트',sceneDay:2,title:'부비 · 첫 휴식과 크리스',kind:'neighborhood',key:'rest',description:'암전·가로 카메라 이동 → 크리스의 첫 반응'},
 {id:'elevator-repair',day:'외부 이벤트',sceneDay:1,title:'엘리베이터 · 수리 완료',kind:'neighborhood',key:'repair',description:'부품·비용 전달 이후 대사 → 수리 → 목표 달성'}
];
for(const [key,day,title,kind,background] of [
 ['night0','0일차','테라스 · 첫날 밤','dialog','terrace'],
 ['terraceMemory','0일차','유나의 기억 · 폐기물 처리소','memory'],
 ['workshop','1일차','포트의 작업장','dialog','black'],
 ['night1','1일차','테라스 · 두 번째 밤','dialog','terrace'],
 ['night2','2일차','테라스 · 조니의 기억','dialog','terrace'],
 ['johnny','2일차','조니의 기억 · 칵테일 제조','johnny'],
 ['ending','3일차','테라스 · 마지막 밤','dialog','terrace'],
 ['terraceMemory3','3일차','유나의 기억 · 마지막 회상','memory']
]){const data=W.LUNA_CAMPAIGN_DATA;if(data?.scenes[key]?.length)catalog.push({id:'A-'+key,day,title,kind,key,background,description:key==='workshop'?'본편 미사용 · 크리스와 포트의 대화 · 이 탭에서만 재생':kind==='dialog'?'본편 대사 · 연결된 회상도 함께 재생':kind==='memory'?'테라스에서 이어지는 회상':'본편의 제조 연출과 대사'});}
let filter='all',active=null,generation=0;
function html(tabs){const rows=catalog.filter(x=>filter==='all'||x.day===filter);return '<div class="start-screen cutscene-library">'+tabs+'<section class="cutscene-panel"><header><div><small>CUTSCENE ARCHIVE</small><h2>컷씬 모아보기</h2><p>현재 본편의 컷씬을 바로 재생합니다. 일차·해금·선택 기록은 변경되지 않습니다.</p></div><span class="cutscene-count">'+rows.length+'개 장면</span></header><div class="cutscene-filters" aria-label="일차별 컷씬">'+[['all','전체'],...['0일차','1일차','2일차','3일차','외부 이벤트'].map(day=>[day,day])].map(([id,label])=>'<button data-act="cutsceneFilter" data-id="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>').join('')+'<small>재생 중 Esc · 목록으로 돌아가기</small></div><div class="cutscene-list">'+rows.map(x=>'<button class="cutscene-card" data-act="cutscenePlay" data-id="'+x.id+'"><span class="cutscene-meta">'+x.day+'</span><strong>'+esc(x.title)+'</strong><span>'+esc(x.description)+'</span><b aria-hidden="true">재생 ↗</b></button>').join('')+'</div></section></div>';}
function close(){if(!active)return;const a=active,c=a.c;active=null;generation++;clearInterval(a.watch);clearTimeout(a.finishTimer);c.token++;c.cancelMemoryTransition();c.disposeCinema();c.resetInput();
 if(a.entry.kind==='neighborhood'){c.outside.model?.story.cancel();c.outside.exit(true);W.LunaStoryNotices.clear();}
 a.toolbar.remove();Object.assign(c,a.saved);for(const key of Object.keys(c.outside.config))if(!Object.hasOwn(a.outsideConfig,key))delete c.outside.config[key];Object.assign(c.outside.config,a.outsideConfig);c.ui.outside=a.outsideUI;c.g.day=a.gameDay;c.session.day=a.sessionDay;c.g.progress=a.progress;c.session.carry=a.carry;c.ui.cutscenes=true;c.screen('developer');c.render(true);document.querySelector('[data-act="cutscenePlay"][data-id="'+a.entry.id+'"]')?.focus({preventScroll:true});}
async function playNeighborhood(c,entry,valid){
 const o=c.outside,N=W.LunaOutsideNeighborhood,home=entry.key==='rest',upper=['reveal','feed'].includes(entry.key);
 c.g.progress={...structuredClone(c.g.progress),day:entry.sceneDay,money:1000,inventory:{tuna_can:1},objectives:{},flags:{boobi_revealed:entry.key==='feed',boobi_feeding_pending:entry.key==='feed',boobi_adopted:home,elevator_repair_paid:entry.key==='repair'}};
 c.session.carry=structuredClone(c.g.progress);c.ui.outside=true;c.screen('developer');
 Object.assign(o.config,{day:entry.sceneDay,flow:'out',place:home?'home':upper?'homeDoor':'bar',qaCase:null});await o.start();if(!valid())return;
 const m=o.model;m.controlsTutorial=false;m.paused=false;m.story.cancel();m.backgroundStory.cancel();
 // Stand outside the lift's foreground frame so the preview doesn't hide Luna.
 m.x=home?2.2:upper?N.places.box.x-.45:N.places.repair.x+.6;
 const target=N.targets(m).find(t=>t.id==='neighborhood-'+({reveal:'box',feed:'cat',repair:'repair',rest:'home-cat'}[entry.key]));
 if(!target)throw Error('검수 장면의 대상이 없습니다: '+entry.key);
 if(home)N.beforeRest(m,()=>{});else N.interact(m,target);
 o.snapCamera();o.tick(0);
 // Use the real outside state machine, including its authored movement/fades.
 // Closing during loading or a timed action invalidates all later callbacks.
 const a=active;a.watch=setInterval(()=>{if(!valid()||m.story.speech||m.neighborhood?.action||a.finishTimer)return;a.finishTimer=setTimeout(()=>{if(valid())close();},entry.key==='repair'?3800:900);},100);
}
async function play(c,id){
 const entry=catalog.find(x=>x.id===id);if(!entry||active||!c.session.developer||c.g.phase!=='ready'||c.outside.active)return;
 const saved={};for(const key of ['data','storyVersion','dialog','retryLoad','loadError','loadLabel','loadPercent','resumeView','cinemaHintUntil'])saved[key]=c[key];
 const toolbar=document.createElement('div');toolbar.id='cutscene-preview-toolbar';toolbar.innerHTML='<span>'+esc(entry.title)+'</span><button type="button" data-cutscene-exit>← 컷씬 목록 <kbd>Esc</kbd></button>';toolbar.querySelector('button').onclick=close;document.body.append(toolbar);
 active={c,entry,saved,progress:structuredClone(c.g.progress),carry:structuredClone(c.session.carry),gameDay:c.g.day,sessionDay:c.session.day,outsideConfig:{...c.outside.config},outsideUI:c.ui.outside,toolbar};
 c.session.day=entry.sceneDay??(Number.parseInt(entry.day,10)||0);c.g.day=c.session.day;
 c.data=W.LUNA_CAMPAIGN_DATA;c.storyVersion='A';
 const ticket=++generation;const valid=()=>active?.c===c&&generation===ticket;
 const load=async()=>{if(!valid())return;c.disposeCinema();c.dialog=null;c.loadLabel=entry.title+' · 불러오는 중';c.loadPercent=0;c.screen('loading');c.retryLoad=load;
  try{
   if(entry.kind==='neighborhood'){await playNeighborhood(c,entry,valid);return;}
   if(entry.kind==='dialog'){c.scene(entry.key,entry.title,entry.background,close);return;}
   if(entry.kind==='johnny'){await W.LunaJohnnyMemory.prepare(c.D);if(valid())c.scene(entry.key,entry.title,'johnny-memory',close);return;}
   if(entry.kind==='memory'){c.playTerraceMemory(close,entry.key);return;}
   const scene=await c.prepareStudio(entry.key);
   if(!valid())return;
   const wakeAt=scene.clips?.find(x=>x.type==='visual'&&x.actor==='house')?.start||0;
   c.cinema={studio:entry.kind==='studio',scenes:[scene],index:0,scene,time:entry.wake?wakeAt:0,player:null,title:entry.title,returnTransition:'cut',returnTo:close};
   if(entry.key==='opening')c.cinema.skipUntil=0;
   c.cinemaHintUntil=performance.now()+2000;c.bgm.setSuppressed('cinema',true);c.screen('prologue');if(entry.kind==='studio')W.LunaStudioCinema.unlock();else W.Sfx?.resume();
  }catch(error){if(!valid())return;c.loadError=error.message;c.screen('load-error');}
 };await load();
}
W.LunaCutsceneLibrary={catalog,html,play,close,setFilter(value){if(['all','0일차','1일차','2일차','3일차','외부 이벤트'].includes(value))filter=value;},get active(){return !!active;},key(e){if(!active)return false;if(e.code==='Escape'){if(!e.repeat)close();return true;}if(e.target.closest?.('[data-cutscene-exit]')&&['Enter','Space'].includes(e.code)){if(!e.repeat)close();return true;}return false;},action(a){if(active&&['title','picker','exit-run','developer'].includes(a)){close();return true;}return false;}};
})(window);
