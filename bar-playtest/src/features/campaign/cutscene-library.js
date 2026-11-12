/* Developer-only gallery. Reuse live story data and players, never start a campaign. */
(function(W){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=[
 {id:'opening-a',day:'0일차',title:'도입부 · 마지막 부탁',kind:'studio',key:'opening',introOnly:true,description:'독립 도입 연출만 재생 · 기상·환복·통화는 시스템 구현 범위'},
 {id:'tv',day:'0일차',title:'TV 다큐 · 인공생명체의 역사',kind:'studio',key:'documentary',description:'흑백 이미지 5장 · 대사·화면 효과'}
];
for(const [key,day,title,kind,background] of [
 ['terraceMemory','0일차','유나의 기억 · 폐기물 처리소','memory'],
 ['johnny','2일차','조니의 기억 · 칵테일 제조','johnny'],
 ['terraceMemory3','3일차','유나의 기억 · 마지막 회상','memory']
]){const data=W.LUNA_CAMPAIGN_DATA;if(data?.scenes[key]?.length)catalog.push({id:'A-'+key,day,title,kind,key,background,description:key==='workshop'?'본편 미사용 · 크리스와 포트의 대화 · 이 탭에서만 재생':kind==='dialog'?'본편 대사 · 연결된 회상도 함께 재생':kind==='memory'?'테라스에서 이어지는 회상':'본편의 제조 연출과 대사'});}
let filter='all',active=null,generation=0;
function html(tabs){const rows=catalog.filter(x=>filter==='all'||x.day===filter);return '<div class="start-screen cutscene-library">'+tabs+'<section class="cutscene-panel"><header><div><small>CUTSCENE ARCHIVE</small><h2>엔진 타임라인 제작 대상</h2><p>독립 연출 5개만 확인합니다. 테라스 대화·기상·외부 이벤트는 게임 시스템 구현 범위입니다.</p></div><span class="cutscene-count">'+rows.length+'개 장면</span></header><p><a href="../cutscene-studio/trailer.html" class="cutscene-trailer-link"><strong>트레일러 미리보기 ↗</strong><span>본편과 분리된 홍보용 시퀀스 · 장면별 바로 보기</span></a></p><div class="cutscene-filters" aria-label="일차별 컷씬">'+[['all','전체'],...['0일차','2일차','3일차'].map(day=>[day,day])].map(([id,label])=>'<button data-act="cutsceneFilter" data-id="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>').join('')+'<small>재생 중 Esc · 목록으로 돌아가기</small></div><div class="cutscene-list">'+rows.map(x=>'<button class="cutscene-card" data-act="cutscenePlay" data-id="'+x.id+'"><span class="cutscene-meta">'+x.day+'</span><strong>'+esc(x.title)+'</strong><span>'+esc(x.description)+'</span><b aria-hidden="true">재생 ↗</b></button>').join('')+'</div></section></div>';}
function close(){if(!active)return;const a=active,c=a.c;active=null;generation++;clearInterval(a.watch);clearTimeout(a.finishTimer);c.token++;c.cancelMemoryTransition();c.disposeCinema();c.resetInput();
 if(a.entry.kind==='neighborhood'){c.outside.model?.story.cancel();c.outside.exit(true);W.LunaStoryNotices.clear();}
 a.toolbar.remove();Object.assign(c,a.saved);for(const key of Object.keys(c.outside.config))if(!Object.hasOwn(a.outsideConfig,key))delete c.outside.config[key];Object.assign(c.outside.config,a.outsideConfig);c.ui.outside=a.outsideUI;c.g.day=a.gameDay;c.session.day=a.sessionDay;c.g.progress=a.progress;c.session.carry=a.carry;c.ui.cutscenes=true;c.screen('developer');c.render(true);document.querySelector('[data-act="cutscenePlay"][data-id="'+a.entry.id+'"]')?.focus({preventScroll:true});}
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
   if(entry.kind==='dialog'){c.scene(entry.key,entry.title,entry.background,close);return;}
   if(entry.kind==='johnny'){await W.LunaJohnnyMemory.prepare(c.D);if(valid())c.scene(entry.key,entry.title,'johnny-memory',close);return;}
   if(entry.kind==='memory'){c.playTerraceMemory(close,entry.key);return;}
   let scene=await c.prepareStudio(entry.key);
   if(!valid())return;
   if(entry.introOnly){
    const start=scene.clips.find(x=>x.title==='도입 · 2초간 검은 화면')?.start;
    const end=scene.clips.find(x=>x.type==='visual'&&x.actor==='house')?.start;
    if(!(start>=0&&end>start))throw Error('도입부와 기상 시스템의 경계를 찾지 못했습니다.');
    // tl_intro is 11.8 s: black 2 s + automatic cards 3.6/3.2/3 s.
    // Exclude the manual play guide as well as wake/contact system scenes.
    // Keep clip-local audio keyframes/offsets unchanged when shifting the origin.
    scene={...scene,end:end-start,duration:end-start,
     chapters:scene.chapters.filter(x=>x.time>=start&&x.time<end).map(x=>({...x,time:x.time-start})),
     clips:scene.clips.filter(x=>x.start>=start&&x.start<end).map(x=>({...x,start:x.start-start,duration:Math.min(x.duration,end-x.start)}))};
   }
   const wakeAt=scene.clips?.find(x=>x.type==='visual'&&x.actor==='house')?.start||0;
   c.cinema={studio:entry.kind==='studio',scenes:[scene],index:0,scene,time:entry.wake?wakeAt:0,player:null,title:entry.title,returnTransition:'cut',returnTo:close};
   if(entry.key==='opening')c.cinema.skipUntil=0;
   c.cinemaHintUntil=performance.now()+2000;c.bgm.setSuppressed('cinema',true);c.screen('prologue');if(entry.kind==='studio')W.LunaStudioCinema.unlock();else W.Sfx?.resume();
  }catch(error){if(!valid())return;c.loadError=error.message;c.screen('load-error');}
 };await load();
}
W.LunaCutsceneLibrary={catalog,html,play,close,setFilter(value){if(['all','0일차','2일차','3일차'].includes(value))filter=value;},get active(){return !!active;},key(e){if(!active)return false;if(e.code==='Escape'){if(!e.repeat)close();return true;}if(e.target.closest?.('[data-cutscene-exit]')&&['Enter','Space'].includes(e.code)){if(!e.repeat)close();return true;}return false;},action(a){if(active&&['title','picker','exit-run','developer'].includes(a)){close();return true;}return false;}};
})(window);
