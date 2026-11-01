const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
const manifest=require('../data/presentation/generated-art/manifest.json');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],retired=[];
 p.on('pageerror',e=>errors.push(e.message));
 const old=new Set(manifest.records.flatMap(r=>r.sources.map(s=>'/bar-playtest/'+s.src)));
 await p.route('**/*',route=>{const pathname=decodeURIComponent(new URL(route.request().url()).pathname);if(old.has(pathname)){retired.push(pathname);return route.abort();}return route.continue();});
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.waitForFunction(()=>window.LunaCursors?.length===12&&window.lunaCampaign);
 if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.waitForTimeout(300);
 const result=await p.evaluate(async()=>{
  const fixture=document.createElement('div');fixture.id='generated-art-fixture';fixture.style.cssText='position:fixed;inset:0;background:#101820;z-index:2147483647;display:grid;grid-template-columns:repeat(2,440px);gap:24px;padding:28px;align-content:start';
  document.body.append(fixture);
  const results=[];
  for(const kind of ['goal-new','goal-complete','event','meet','up','down']){
   const el=document.createElement('div');el.className='story-notice '+(['goal-new','goal-complete','event'].includes(kind)?'story-notice-event':'story-notice-people');el.dataset.kind=kind;el.style.cssText='position:relative;right:auto;bottom:auto;scale:1;transform:none;opacity:1';
   el.innerHTML='<span class="story-notice-icon">◇</span><div><small>'+kind+'</small><strong>새로운 목표</strong></div>';fixture.append(el);
   const bg=getComputedStyle(el).backgroundImage,src=bg.match(/url\("?([^"\)]+)/)?.[1];if(!src)throw Error('No PNG '+kind);
   const im=new Image();im.src=src;await im.decode();results.push({kind,bg,w:im.naturalWidth});
  }
  for(const c of LunaCursors){if(!c.src.endsWith('.png'))throw Error('Non-PNG cursor');const im=new Image();im.src=c.src;await im.decode();if(im.naturalWidth!==32)throw Error('Cursor size');}
  return results;
 });
 for(const r of result){assert(r.bg.includes('/WebGenerated/'));assert.equal(r.w,350);}
 await p.locator('#generated-art-fixture').screenshot({path:'/private/tmp/generated-notices-runtime.png'});
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
 const entries=await p.evaluate(()=>ResourceExtraction.collect(resourceReview.rows));
 for(const r of manifest.records)assert(entries.some(e=>decodeURIComponent(e.src).endsWith('assets/9_ArtResources/'+r.path)),r.path);
 assert.deepEqual(retired,[]);assert.deepEqual(errors,[]);
 console.log('GENERATED_ART_UI_OK: 792 local PNGs registered; 6 runtime notice skins; 12 PNG cursors; old paths blocked without requests');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
