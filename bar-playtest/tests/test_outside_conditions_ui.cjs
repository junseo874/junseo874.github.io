const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();});
 const results=await p.evaluate(()=>{
 const a=outsidePlaytest,m=a.model,g=barGame,shop=LunaOutsideShop;g.progress.flags={};g.progress.inventory={};g.progress.money=1000;
 const conditions=[];for(let day=0;day<=3;day++)for(const flow of ['in','out']){m.start({day,flow});conditions.push({day,flow,shop:shop.visible(m),bd:m.targets().some(t=>t.id==='bd-vendor'),poster:m.targets().some(t=>t.id==='wanted-poster')});}
 m.start({day:1,flow:'out'});const t=shop.targets(m)[0],finish=()=>{for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}};
 shop.interact(m,t);m.story.cancel();const cancelledMet=!!g.progress.flags.shiba_shop_met;
 shop.interact(m,t);finish();const met=g.progress.flags.shiba_shop_met;
 shop.interact(m,t);const repeat=m.story.speech.line.text;finish();m.story.choose('shop-no');finish();
 shop.interact(m,t);finish();m.story.choose('shop-yes');finish();g.progress.money=49;const disabled=shop.choiceView(m).options.filter(o=>o.id.startsWith('shop-buy')).every(o=>o.disabled),denied=m.story.choose('shop-buy-arcade_coupon');
 g.progress.money=1000;lunaCampaign.session.carry=structuredClone(g.progress);const bought=m.story.choose('shop-buy-bitters'),double=m.story.choose('shop-buy-bitters');finish();
 const purchase={money:g.progress.money,count:g.progress.inventory.bitters,carry:lunaCampaign.session.carry.inventory.bitters};
 m.start({day:2,flow:'in'});shop.interact(m,shop.targets(m)[0]);const retained=!!g.progress.flags.shiba_shop_met&&m.story.speech.rows===shop.revisit;m.story.cancel();
 m.start({day:99,qaCase:'shop:repeat'});m.x=0;m.updateNear();m.interact();const before=g.progress.money;finish();m.story.choose('shop-yes');finish();m.story.choose('shop-buy-arcade_coupon');const qaIsolated=g.progress.money===before;
 return {conditions,cancelledMet,met,repeat,expectedRepeat:shop.revisit[0].text,disabled,denied,bought,double,purchase,retained,qaIsolated};
 });
 for(const c of results.conditions){assert.equal(c.shop,c.day>1||c.day===1&&c.flow==='out');assert.equal(c.bd,false);assert(c.poster);}
 assert(!results.cancelledMet);assert(results.met);assert.equal(results.repeat,results.expectedRepeat);assert(results.disabled);assert(!results.denied);assert(results.bought);assert(!results.double);assert.deepEqual(results.purchase,{money:700,count:1,carry:1});assert(results.retained);assert(results.qaIsolated);
 // Actual rendered choices and restored shop sprite in both simulator variants.
 for(const variant of ['original','gpt']){await p.evaluate(async variant=>{outsidePlaytest.exit(true);Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar',variant});await outsidePlaytest.start();const a=outsidePlaytest,m=a.model;barGame.progress.flags.shiba_shop_met=true;barGame.progress.inventory={};delete barGame.progress.flags.shiba_bought_bitters;barGame.progress.money=400;m.x=-2.87;m.updateNear();a.snapCamera();m.interact();for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}m.story.choose('shop-yes');for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}a.tick(0);},variant);assert.equal(await p.locator('.outside-speech strong').count(),0);assert.equal(await p.locator('[data-choice="shop-buy-wild_dog"]').count(),0);assert(await p.locator('[data-choice="shop-buy-bitters"]').isEnabled());await p.screenshot({path:'/private/tmp/outside-shop-'+variant+'.png'});await p.locator('[data-choice="shop-buy-bitters"]').click();assert.equal(await p.evaluate(()=>barGame.progress.money),100);}
 assert.deepEqual(errors,[]);console.log('OUTSIDE_CONDITIONS_OK',JSON.stringify(results));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
