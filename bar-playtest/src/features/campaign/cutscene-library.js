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
catalog.push({id:'ending-credits',day:'3일차',title:'엔딩 크레딧',kind:'credits',description:'데모 제작진과 감사 인사'});
const creditPages=[
 [['SIMCHUNG','presents']],
 [['Director','Lee Jun Seo'],['Lead Programmer','Lee Dong Hun'],['Programmers','Han Chi U','Park Yong Seok']],
 [['Lead Artist','Min Su Hyeon'],['Technical Artist','Park Yong Seok'],['Environment Artists','Min Su Hyeon','Jeon Ji Min'],['Animator','Jeong Yu Bin']],
 [['Character Artists','Han So Yoon','Jeong Yu Bin'],['Prop Artist','Cho Hyeon A'],['Visual Effects','Gwak Yo Sep','Park Yong Seok']],
 [['UI/UX Designer','Shin Seo Yeon'],['Game Designers','Go Hyeon Jeong','Im Su Jin','Lee Jun Seo']],
 [['Narrative','Lee Jun Seo','Lee Gi Hyeon'],['Music','Yu Ji Hun'],['Sound','Lee Gi Hyeon','Lee Jun Seo']],
 [['Special Thanks','Lee Deuk U','Hwang Seung Ha','Lee Su Yeon','Choi Bu Ho','Son Byeong Hyeok','Baek Chan Hyeok','Lee Sin Ji','Choi Yong Geun','Shin Yu Hyeon','Lee Su Ha','Wang Do Hyeon']]
];
const companions=['pigeon','luna','Chris','bubi','Repairman','shiba','samho','Neighbor'];
const creditImages=new Map();
function creditImage(url){
 let image=creditImages.get(url);
 if(!image){image=new Image();creditImages.set(url,image);image.src=url;}
 return image;
}
function drawCreditSprite(ctx,url,...rect){
 const image=creditImage(url);
 if(image.complete&&image.naturalWidth)ctx.drawImage(image,...rect);
}
function paintCompanion(canvas,kind,time){
 const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,128,96);
 const game=W.LUNA_OUTSIDE_DATA;
 if(kind==='shiba'){
  const building=game.scenes.street.nodes.find(n=>n.name==='B_Fore_Building_1');
  drawCreditSprite(ctx,game.assets[building.sprite.asset].src,316,211,85,95,21,0,85,95);
  const anim=game.animations.shiba,f=anim.frames[Math.floor(time*anim.fps)%anim.frames.length];
  drawCreditSprite(ctx,game.assets[f.asset].src,f.x,f.y,f.w,f.h,45,68-f.h,f.w,f.h);
 }else if(kind==='bubi'){
  const sofa=game.scenes.home.nodes.find(n=>n.name==='home-bedding'),clip=W.LunaBubiArt.clips.sleep;
  drawCreditSprite(ctx,game.assets[sofa.sprite.asset].src,0,0,111,54,8,28,111,54);
  drawCreditSprite(ctx,clip.src,Math.floor(time*clip.fps)%clip.frames*clip.fw+48,94,38,23,59,43,38,23);
 }else if(kind==='pigeon'){
  const birds=W.LunaBirdSprites,c=birds.crops.pigeon;
  drawCreditSprite(ctx,birds.assets.pigeon,birds.frameAt(time)*birds.sheet.width+c.x,c.y,c.w,c.h,47,42,c.w*2,c.h*2);
 }else{
  const animation=kind==='luna'?game.animations.idle:kind==='samho'?game.animations.samhoIdle:null;
  const frame=animation?animation.frames[Math.floor(time*animation.fps)%animation.frames.length]:W.LunaOutsideAmbient.sprite(kind,time);
  // Keep the original cell scale and align the visible feet, including transparent padding.
  const sole=kind==='samho'?74:kind==='luna'?frame.h*(1-frame.pivot.y)+27:114;
  drawCreditSprite(ctx,game.assets[frame.asset].src,frame.x,frame.y,frame.w,frame.h,Math.round(64-frame.w/2),Math.round(80-sole),frame.w,frame.h);
 }
}
function creditsHTML(){
 const groups=creditPages.map((page,index)=>'<div class="credit-group">'+
  (index===0?'<img class="credit-team-logo" src="assets/ui/simchung-team-logo.png" width="2004" height="1779" alt="">':'')+page.map(([role,...names])=>
  '<section><h2>'+esc(role)+'</h2>'+names.map(name=>'<span>'+esc(name)+'</span>').join('')+'</section>'
 ).join('')+'</div>').join('');
 return '<section class="ending-credits" aria-label="엔딩 크레딧"><img class="credit-game-logo" src="assets/ui/IMG_logo_m.png" alt="PROJECT LUNA"><div class="credit-copy">'+groups+'</div><canvas width="128" height="96" aria-hidden="true"></canvas><p class="credit-thanks" hidden>데모 플레이해주셔서 감사합니다.</p><button data-campaign="finish-credits">건너뛰기</button></section>';
}
function advanceCredits(c,dt){
 const panel=c.host.querySelector('.ending-credits');if(!panel)return;
 c.creditTime+=dt;
 const roll=panel.querySelector('.credit-copy');
 const travel=panel.clientHeight+roll.offsetHeight;
 const hold=2;
 const distance=Math.max(0,c.creditTime-hold)*62;

 const still=W.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const canvas=panel.querySelector('canvas');
 // The full roll fits through the bottom edge once its own height has travelled.
 const lastNameEntered=roll.offsetHeight;
 const thanks=panel.querySelector('.credit-thanks');
 const finaleTime=(distance-travel)/62;
 if(finaleTime>=0){
  canvas.style.opacity='0';
  roll.style.opacity='0';
  panel.querySelector('.credit-game-logo').style.visibility='hidden';
  panel.querySelector('[data-campaign="finish-credits"]').hidden=true;
  thanks.hidden=finaleTime<.65;
  const alpha=Math.max(0,Math.min(1,(finaleTime-.65)/1.1,(5.75-finaleTime)/1.1));
  thanks.style.opacity=String(alpha*alpha*(3-2*alpha));
  if(finaleTime>=6.1)c.action('finish-credits');
  return;
 }
 const logo=panel.querySelector('.credit-game-logo');
 logo.style.transform='translate(-50%, -50%) translateY(-'+(still?0:distance)+'px)';
 logo.style.visibility=still&&c.creditTime>=hold?'hidden':'visible';
 roll.style.visibility=still&&c.creditTime<hold?'hidden':'visible';
 if(still&&c.creditTime<hold){
  panel.querySelector('canvas').style.opacity='0';
  return;
 }
 const y=panel.clientHeight-distance;
 let index=0;
 while(index+1<roll.children.length&&y+roll.children[index+1].offsetTop<=panel.clientHeight/2)index++;
 if(still){
  // Display one stationary group at a time for reduced-motion playback.
  if(panel.dataset.group!==String(index)){
   [...roll.children].forEach((group,i)=>{group.style.visibility=i===index?'visible':'hidden';});
   panel.dataset.group=String(index);
  }
  const group=roll.children[index];
  roll.style.transform='translateY('+((panel.clientHeight-group.offsetHeight)/2-group.offsetTop)+'px)';
 }else{
  if(panel.hasAttribute('data-group')){
   for(const group of roll.children)group.style.visibility='';
   delete panel.dataset.group;
  }
  roll.style.transform='translateY('+y+'px)';
 }
 const introText=roll.firstElementChild.querySelector('section');
 const introCenter=introText.offsetTop+introText.offsetHeight/2;
 const startDistance=panel.clientHeight/2+introCenter;
 if(distance<startDistance){
  canvas.style.opacity='0';
  creditImage(W.LunaBirdSprites.assets.pigeon);
  return;
 }
 const slot=(lastNameEntered-startDistance)/companions.length;
 const elapsed=distance-startDistance;
 const shot=Math.min(companions.length-1,Math.floor(elapsed/slot));
 const local=elapsed-shot*slot;
 // Fade the entire vignette together, passing through black before swapping sprites.
 const fadeOut=shot===companions.length-1?1-Math.max(0,distance-lastNameEntered)/(62*.9):(slot-local)/(62*.8);
 const fade=Math.max(0,Math.min(1,local/(62*.8),fadeOut));
 canvas.style.opacity=String(fade*fade*(3-2*fade));
 if(fade>0)paintCompanion(canvas,companions[shot],still?0:local/62);
}
let filter='all',active=null,generation=0;
function html(tabs){const rows=catalog.filter(x=>filter==='all'||x.day===filter);return '<div class="start-screen cutscene-library">'+tabs+'<section class="cutscene-panel"><header><div><h2>장면 선택</h2><p>도입부부터 엔딩 크레딧까지 재생할 수 있습니다. 테라스 대화·기상·외부 이벤트는 게임 시스템 구현 범위입니다.</p></div><span class="cutscene-count">'+rows.length+'개 장면</span></header><p><a href="../cutscene-studio/trailer.html" class="cutscene-trailer-link"><strong>트레일러 미리보기 ↗</strong><span>본편과 분리된 홍보용 시퀀스 · 장면별 바로 보기</span></a></p><div class="cutscene-filters" aria-label="일차별 컷씬">'+[['all','전체'],...['0일차','2일차','3일차'].map(day=>[day,day])].map(([id,label])=>'<button data-act="cutsceneFilter" data-id="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>').join('')+'<small>재생 중 Esc · 목록으로 돌아가기</small></div><div class="cutscene-list">'+rows.map(x=>'<button class="cutscene-card" data-act="cutscenePlay" data-id="'+x.id+'"><span class="cutscene-meta">'+x.day+'</span><strong>'+esc(x.title)+'</strong><span>'+esc(x.description)+'</span><b aria-hidden="true">재생 ↗</b></button>').join('')+'</div></section></div>';}
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
   if(entry.kind==='credits'){c.screen('ending');return;}
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
W.LunaCutsceneLibrary={catalog,html,creditsHTML,advanceCredits,play,close,setFilter(value){if(['all','0일차','2일차','3일차'].includes(value))filter=value;},get active(){return !!active;},key(e){if(!active)return false;if(e.code==='Escape'){if(!e.repeat)close();return true;}if(e.target.closest?.('[data-cutscene-exit]')&&['Enter','Space'].includes(e.code)){if(!e.repeat)close();return true;}return false;},action(a){if(active&&['title','picker','exit-run','developer'].includes(a)){close();return true;}return false;}};
})(window);
