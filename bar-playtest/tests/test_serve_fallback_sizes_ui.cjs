const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  const ids=await p.evaluate(()=>LUNA_DATA.tables.cocktails.map(c=>c.id).filter(id=>!LUNA_SERVE_SHEETS[id]));
  // Bacardi was removed; verify the remaining paths by identity, not only count.
  assert.deepEqual([...ids].sort(),['red_wine','champagne','long_island','whiskey_sour','godfather','johnny_old_fashioned'].sort());
  for(const id of ids){
   await p.evaluate(id=>{const g=barGame;g.reset(99,'practice',1,true);g.selectCocktail(id);g.debugFill();g.startCraft();g.craft.results=g.craft.queue.map(q=>({...q,value:q.target,completed:true,completion:1,failures:0}));g.craft.index=g.craft.queue.length;g.nextGimmick();g.changed();},id);
   await p.locator('[data-act=offer]').waitFor();assert.equal(await p.locator('.serve-fallback').count(),1);
   for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:2048,height:1181}]){
    await p.setViewportSize(viewport);await p.waitForTimeout(80);
    const check=await p.evaluate(()=>{
     const stage=document.querySelector('.serve-presentation').getBoundingClientRect(),canvas=document.querySelector('.serve-canvas').getBoundingClientRect();
     const elements=[...document.querySelectorAll('.serve-fallback,.serve-actions button,.serve-grade')];
     return {fill:canvas.width/stage.width>.99&&canvas.height/stage.height>.99,inside:elements.every(e=>{const r=e.getBoundingClientRect();return r.left>=stage.left-.1&&r.right<=stage.right+.1&&r.top>=stage.top-.1&&r.bottom<=stage.bottom+.1;}),images:[...document.querySelectorAll('.serve-fallback img')].every(i=>i.complete&&i.naturalWidth>0)};
    });assert(check.fill&&check.inside&&check.images,JSON.stringify({id,viewport,check}));
    if(viewport.width===1280)await p.screenshot({path:'/private/tmp/serve-fallback-'+id+'.png'});
   }
   await p.setViewportSize({width:1280,height:720});
  }
  assert.deepEqual(errors,[]);console.log('PASS all '+ids.length+' existing static-art serving paths at 3 viewport sizes: '+ids.join(', '));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
