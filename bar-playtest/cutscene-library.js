/* Developer-only gallery. Reuse live story data and players, never start a campaign. */
(function(W){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=[
 {id:'opening-a',day:'0일차',title:'폐기물 처리장 → 루나의 기상',kind:'studio',key:'opening',description:'현재 도입부 전체 · 크리스의 연락까지'},
 {id:'wake-a',day:'0일차',title:'루나의 기상 · 크리스의 연락',kind:'studio',key:'opening',wake:true,description:'집에서 깨어나는 구간부터 재생'},

 {id:'tv',day:'0일차',title:'TV 다큐 · 인공생명체의 역사',kind:'studio',key:'documentary',description:'흑백 이미지 5장 · 키 입력으로 대사 진행'},
 {id:'bd',day:'외부 이벤트',title:'BD 기록 · 연구소 로비 전투',kind:'legacy',key:'scene1',description:'BD 칩에서 재생되는 전투 기록'}
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
]){const data=W.LUNA_CAMPAIGN_DATA;if(data?.scenes[key]?.length)catalog.push({id:'A-'+key,day,title,kind,key,background,description:kind==='dialog'?'본편 대사 · 연결된 회상도 함께 재생':kind==='memory'?'테라스에서 이어지는 회상':'본편의 제조 연출과 대사'});}
let filter='all',active=null,generation=0;
function html(tabs){const rows=catalog.filter(x=>filter==='all'||x.day===filter);return '<div class="start-screen cutscene-library">'+tabs+'<section class="cutscene-panel"><header><div><small>CUTSCENE ARCHIVE</small><h2>컷씬 모아보기</h2><p>현재 본편의 컷씬을 바로 재생합니다. 일차·해금·선택 기록은 변경되지 않습니다.</p></div><span class="cutscene-count">'+rows.length+'개 장면</span></header><div class="cutscene-filters" aria-label="일차별 컷씬">'+[['all','전체'],...['0일차','1일차','2일차','3일차','외부 이벤트'].map(day=>[day,day])].map(([id,label])=>'<button data-act="cutsceneFilter" data-id="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>').join('')+'<small>재생 중 Esc · 목록으로 돌아가기</small></div><div class="cutscene-list">'+rows.map(x=>'<button class="cutscene-card" data-act="cutscenePlay" data-id="'+x.id+'"><span class="cutscene-meta">'+x.day+'</span><strong>'+esc(x.title)+'</strong><span>'+esc(x.description)+'</span><b aria-hidden="true">재생 ↗</b></button>').join('')+'</div></section></div>';}
function close(){if(!active)return;const a=active,c=a.c;active=null;generation++;c.token++;c.cancelMemoryTransition();c.disposeCinema();c.resetInput();a.toolbar.remove();Object.assign(c,a.saved);c.g.progress=a.progress;c.session.carry=a.carry;c.ui.cutscenes=true;c.screen('developer');c.render(true);document.querySelector('[data-act="cutscenePlay"][data-id="'+a.entry.id+'"]')?.focus({preventScroll:true});}
async function play(c,id){
 const entry=catalog.find(x=>x.id===id);if(!entry||active||!c.session.developer||c.g.phase!=='ready'||c.outside.active)return;
 const saved={};for(const key of ['data','storyVersion','dialog','retryLoad','loadError','loadLabel','loadPercent','resumeView','cinemaHintUntil'])saved[key]=c[key];
 const toolbar=document.createElement('div');toolbar.id='cutscene-preview-toolbar';toolbar.innerHTML='<span>'+esc(entry.title)+'</span><button type="button" data-cutscene-exit>← 컷씬 목록 <kbd>Esc</kbd></button>';toolbar.querySelector('button').onclick=close;document.body.append(toolbar);
 active={c,entry,saved,progress:structuredClone(c.g.progress),carry:structuredClone(c.session.carry),toolbar};
 c.data=W.LUNA_CAMPAIGN_DATA;c.storyVersion='A';
 const ticket=++generation;const valid=()=>active?.c===c&&generation===ticket;
 const load=async()=>{if(!valid())return;c.disposeCinema();c.dialog=null;c.loadLabel=entry.title+' · 불러오는 중';c.loadPercent=0;c.screen('loading');c.retryLoad=load;
  try{
   if(entry.kind==='dialog'){c.scene(entry.key,entry.title,entry.background,close);return;}
   if(entry.kind==='johnny'){await W.LunaJohnnyMemory.prepare(c.D);if(valid())c.scene(entry.key,entry.title,'johnny-memory',close);return;}
   if(entry.kind==='memory'){c.playTerraceMemory(close,entry.key);return;}
   let scene;
   if(entry.kind==='studio')scene=await c.prepareStudio(entry.key);
   else{for(const name of ['assets','sprites','stage','stage3','stage4','engine','sfx',entry.key,'player']){await c.script(name);if(!valid())return;}await new Promise(resolve=>W.Sprites.load(resolve));if(!valid())return;W.Engine.initAnchors?.();W.Engine.setLineOverrides({});W.Engine.setTypingScale(1);scene=W.buildScene1();}
   if(!valid())return;
   const wakeAt=scene.clips?.find(x=>x.type==='visual'&&x.actor==='house')?.start||0;
   c.cinema={studio:entry.kind==='studio',scenes:[scene],index:0,scene,time:entry.wake?wakeAt:0,player:null,title:entry.title,returnTransition:'cut',returnTo:close};
   if(entry.key==='opening')c.cinema.skipUntil=wakeAt;
   c.cinemaHintUntil=performance.now()+2000;c.cinemaBgmMuted=c.bgm.audio.muted;c.bgm.audio.muted=true;c.screen('prologue');if(entry.kind==='studio')W.LunaStudioCinema.unlock();else W.Sfx?.resume();
  }catch(error){if(!valid())return;c.loadError=error.message;c.screen('load-error');}
 };await load();
}
W.LunaCutsceneLibrary={catalog,html,play,close,setFilter(value){if(['all','0일차','1일차','2일차','3일차','외부 이벤트'].includes(value))filter=value;},get active(){return !!active;},key(e){if(!active)return false;if(e.code==='Escape'){if(!e.repeat)close();return true;}if(e.target.closest?.('[data-cutscene-exit]')&&['Enter','Space'].includes(e.code)){if(!e.repeat)close();return true;}return false;},action(a){if(active&&['title','picker','exit-run','developer'].includes(a)){close();return true;}return false;}};
})(window);
