const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const root=path.resolve(__dirname,'../..'),art=path.resolve(root,'../9_ArtResources'),rows=require('../../artifacts/resource-refresh/imported.json');
 for(const r of rows)assert(fs.readFileSync(path.join(root,'bar-playtest/assets/01.ArtResources',r.path)).equals(fs.readFileSync(path.join(art,r.source))),r.source+' original bytes');
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'home'});await outsidePlaytest.start();const m=outsidePlaytest.model;m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();barGame.progress.flags.boobi_adopted=true;m.x=2.1;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  const cats=await p.evaluate(async()=>{
   const A=LunaBubiArt,seat=A.sofa(),n=LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='home-bedding');
   for(const [id,c]of Object.entries(A.clips)){const im=new Image();im.src=c.src;await im.decode();if(im.naturalWidth!==c.fw*c.frames||im.naturalHeight!==c.fh)throw Error('cells '+id);for(let i=0;i<c.frames;i++){const f=A.frame(id,(i+.01)/c.fps);if(f.x!==i*c.fw||f.x+f.w>im.naturalWidth)throw Error('frame '+id);}}
   const m=outsidePlaytest.model,ys=[];for(const time of [0,1.2,1.6,2,3]){m.neighborhood.homeArrival=time;outsidePlaytest.tick(0);ys.push(time);}m.neighborhood.homeArrival=3;
   return{seat,nx:n.x,ny:n.y,final:A.frame('jump',100,true).x,expected:A.clips.jump.fw*(A.clips.jump.frames-1)};
  });
  assert(cats.seat.y<cats.ny&&cats.seat.y>cats.ny-.2,'feet on sofa seat');assert.equal(cats.final,cats.expected);
  await p.waitForTimeout(200);await p.screenshot({path:path.join(root,'artifacts/resource-refresh/bubi-home.png')});
  await p.evaluate(()=>{LunaStoryNotices.clear();const g=barGame;LunaStoryNotices.affinity(g.progress,'tom',1);LunaStoryNotices.startGoal(g.progress,'art_refresh_test','바로 출근하기');for(let i=0;i<6;i++)LunaStoryNotices.tick(g,outsidePlaytest,lunaCampaign,.1);});
  const notices=await p.locator('#story-notices .story-notice:not([hidden])').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,bg:s.backgroundImage,text:e.querySelector('strong').textContent};}));
  assert.equal(notices.length,2);assert(notices[0].bg.includes('IMG_decrease.png'));assert(notices[1].bg.includes('IMG_objective.png'));
  for(const n of notices){assert.equal(n.w,254);assert(Math.abs(n.h-232/3)<.02);assert(n.x>=19&&n.x<22);}
  assert(notices[1].y>=notices[0].y+notices[0].h,'notices stack without overlap');
  await p.screenshot({path:path.join(root,'artifacts/resource-refresh/notices.png')});
  const mapping=await p.evaluate(async()=>{
   const a=[];for(const kind of ['down','meet','event','goal-complete']){const e=document.createElement('div');e.className='story-notice';e.dataset.kind=kind;document.body.append(e);const src=getComputedStyle(e).backgroundImage.match(/url\("?([^"\)]+)/)[1],im=new Image();im.src=src;await im.decode();a.push([kind,im.naturalWidth,im.naturalHeight,src]);e.remove();}return a;
  });for(const r of mapping)assert.deepEqual(r.slice(1,3),[762,232]);assert(mapping[0][3].includes('IMG_increase.png'));
  const applied=await p.evaluate(()=>({haru:barData.characterLayers.haru,assets:barData.assets}));
  for(const expression of ['fail','success'])assert.deepEqual(applied.haru[expression+'_default'],['char_haru_'+expression]);
  for(const key of ['gimmick','gimmick_shake','gimmick_stir'])assert(!applied.assets[key].src.includes('dummy_'));
  // Load the same stage used by the campaign's memory player, then render its native art.
  await p.evaluate(async()=>{await lunaCampaign.script('stage3');await StageDisposal.ready;const c=document.createElement('canvas');c.id='lab-refresh';c.width=StageDisposal.W;c.height=StageDisposal.H;c.style.cssText='position:fixed;inset:0;z-index:99999;width:980px;height:460px';document.body.append(c);StageDisposal.paint(c.getContext('2d'),0,{alarm:0,door:0,chute:0});});
  await p.locator('#lab-refresh').screenshot({path:path.join(root,'artifacts/resource-refresh/lab-disposal.png')});
  assert((await p.evaluate(()=>StageDisposal.artURL)).includes('Lab_Wastedisposalsite.png'));
  await p.evaluate(()=>{document.querySelector('#lab-refresh').remove();outsidePlaytest.exit(true);LunaStoryNotices.clear();barGame.reset(0,'full',1);lunaCampaign.playTerraceMemory(()=>{},'terraceMemory');});
  await p.waitForFunction(()=>lunaCampaign.cinema?.player&&!lunaCampaign.memoryTransition);
  assert(await p.evaluate(()=>lunaCampaign.cinema.scene.st===StageDisposal),'Real memory uses the supplied disposal stage');
  await p.evaluate(()=>{const c=lunaCampaign.cinema;c.time=2;c.player.render(2,null,false,0);});
  await p.screenshot({path:path.join(root,'artifacts/resource-refresh/lab-memory.png')});
  // The reference panel is 762×232 in a 3840×2160 screen. Check all seven
  // live variants and review downloads, not a separately drawn review mockup.
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=popups');
  await p.waitForFunction(()=>resourceReview.ready);
  await p.addStyleTag({content:'.frame-wrap,.lab.popup-mode .frame-wrap{width:1280px!important;height:720px!important;max-width:none!important;border:0!important}'});
  const variants=await p.evaluate(()=>resourceReview.rows.filter(r=>['popup:meet','popup:affinity','popup:event','popup:goal','ui:exterior:purchase'].includes(r.id)).flatMap(r=>(r.variants||[{id:'default',launch:r.launch}]).map(v=>({id:r.id,d:{...v.launch,reviewId:r.id,popupId:r.id,variantId:v.id},selector:ResourceLatest.selector(r,v.launch),preview:ResourceLatest.screen(r,v.id),layers:r.layers}))));
  assert.equal(variants.length,12);const seen=new Set();
  const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
  for(const v of variants){
   assert(v.preview.includes('notice-scale-20261109'));assert(v.layers.length>0);
   await p.evaluate(v=>resourceReview.launch(v.d,v.id),v);
   const el=f.locator(v.selector).filter({visible:true}).first();await el.waitFor();
   await f.waitForFunction(selector=>{const el=document.querySelector(selector);return el&&!el.hidden&&Number(getComputedStyle(el).opacity)>.99;},v.selector);
   const shape=await el.evaluate(e=>({w:parseFloat(getComputedStyle(e).width),h:parseFloat(getComputedStyle(e).height),bg:getComputedStyle(e).backgroundImage,heading:getComputedStyle(e.querySelector('small')).clipPath,text:e.querySelector('strong').textContent}));
   assert(Math.abs(shape.w/1280-762/3840)<.0001);assert(Math.abs(shape.h/720-232/2160)<.0001);assert.equal(shape.heading,'inset(50%)');assert(shape.text);seen.add(shape.bg);
   assert(await p.locator('#lab-downloads a[download]').count()>=3);
   assert.equal(await p.locator('#lab-note.error').count(),0);
   await p.evaluate(()=>resourceReview.close());
  }
  assert.equal(seen.size,7,'all seven native panels replay in the resource viewer');
  const extracted=await p.evaluate(()=>ResourceExtractionAssets.filter(r=>r.noticeKinds?.length));
  assert.equal(extracted.length,7);assert(extracted.every(r=>r.partKind==='original'&&r.src.includes('/MainScreen/notify/')),'only current authored panels in notification extraction');
  for(const title of ['새로운 목표','목표 달성','이벤트 발생','인물정보 등록','호감도 상승','호감도 하락','신규 재료 획득']){
   await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=extract');await p.waitForFunction(()=>resourceReview.ready);
   await p.locator('[data-extract-shortcut="'+title+'"]').click();
   assert.equal(await p.locator('.extract-card').count(),1,title+' resolves to one current original');
  }
  assert.deepEqual(errors,[]);console.log('RESOURCE_REFRESH_OK: 21 original files, 7 Bubi sheets/pivots, native notices/stacking, Haru reactions, actual disposal renderer, reference-scale notice variants and resource preview/downloads.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
