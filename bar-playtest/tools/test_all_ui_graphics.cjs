const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sharp=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/ui-extracted-20261019');
(async()=>{
 const assets=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),audit=JSON.parse(fs.readFileSync(path.join(dir,'coverage.json')));
 for(const f of ['capture_all_ui_graphics.cjs','ui-graphic-snapshot.js'])assert.equal(audit.sourceHashes?.[f],crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex'),'Export must match the current source: '+f);
 assert.deepEqual(audit.failures,[]);assert(audit.states.length>=128);assert(audit.states.every(s=>s.paintLayers>0),'Every inspected UI state must have graphic coverage');
 const kinds=['goal-new','goal-complete','event','meet','up','down'];
 for(const kind of kinds){const rows=assets.filter(a=>a.sourceStates?.includes('notification-'+kind));assert.equal(rows.length,5,kind+' needs five isolated layers');
  assert.deepEqual(rows.map(a=>a.partKind).sort(),['background','border','border','icon','shadow']);
  for(const a of rows){const {data,info}=await sharp(path.join(root,a.src)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert(data.some((v,i)=>i%info.channels===info.channels-1&&v>0));
   if(a.partKind==='border'){const center=(Math.floor(info.height/2)*info.width+Math.floor(info.width/2))*info.channels;assert.equal(data[center+info.channels-1],0,'border must have a transparent center');}
   if(a.partKind==='background'){
    // Text-free CSS gradient: neighbouring pixels inside the text area vary only smoothly.
    for(let y=12;y<info.height-12;y++)for(let x=90;x<info.width-12;x++)for(let c=0;c<3;c++){const p=(y*info.width+x)*info.channels+c;assert(Math.abs(data[p]-data[p-info.channels])<=2,'No text/icon contamination inside panel background');}
   }
  }
 }
 const intro=assets.filter(a=>a.src.includes('/intro-'));assert.equal(intro.length,12);assert(intro.every(a=>a.sourceStates.includes('ui:opening-guide--default')));
 assert(assets.some(a=>a.sourceStates?.includes('fixture-skip')&&a.sourceSelector?.includes('campaign-skip')&&a.partKind==='background'));
 let pixels=0;
 for(const a of assets){const m=await sharp(path.join(root,a.src)).metadata();assert.equal(m.width,a.w,a.src);assert.equal(m.height,a.h,a.src);pixels+=m.width*m.height;}
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1500,height:1000},acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=extract');await p.waitForFunction(()=>resourceReview.ready,null,{timeout:60000});
  for(const label of ['새로운 목표','목표 달성','이벤트 발생','인물정보 등록','호감도 상승','호감도 하락']){
   await p.locator('[data-extract-shortcut="'+label+'"]').click();assert.equal(await p.locator('.extract-card').count(),5,label);
   await p.selectOption('#extract-part','background');assert.equal(await p.locator('.extract-card').count(),1);
   const event=p.waitForEvent('download');await p.locator('.extract-card [data-extract="raw"]').click();const d=await event;assert.equal(await d.failure(),null);const m=await sharp(fs.readFileSync(await d.path())).metadata();assert.equal(m.width,350);assert(m.height<150);
   await p.selectOption('#extract-part','border');assert.equal(await p.locator('.extract-card').count(),2);
   await p.selectOption('#extract-part','icon');assert.equal(await p.locator('.extract-card').count(),1);
   await p.selectOption('#extract-part','all');
  }
  await p.click('[data-extract-shortcut="새로운 목표"]');await p.screenshot({path:'/private/tmp/resource-popup-parts.png'});
  await p.click('[data-extract-shortcut=""]');await p.selectOption('#extract-category','UI · 기타 분리');await p.fill('#extract-search','튜토리얼');assert(await p.locator('.extract-card').count()>0);
  await p.selectOption('#extract-part','icon');assert(await p.locator('.extract-card').count()>0);await p.screenshot({path:'/private/tmp/resource-ui-icons.png'});
  await p.setViewportSize({width:390,height:844});await p.click('[data-extract-shortcut="인물정보 등록"]');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/private/tmp/resource-popup-parts-mobile.png',fullPage:true});
  await p.click('[data-group="common-popups"]');assert(await p.locator('#catalog-view').isVisible());assert(await p.locator('#extraction-view').isHidden());
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,states:audit.states.length,newAssets:assets.length,notificationParts:30,introParts:12,checkedPixels:pixels,totalGraphics:await p.evaluate(()=>ResourceExtraction.entries.length)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
