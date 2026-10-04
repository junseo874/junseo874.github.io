const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();});
 const results=await p.evaluate(()=>{
 const a=outsidePlaytest,m=a.model,g=barGame,shop=LunaOutsideShop,bd=LunaBDVendor;g.progress.flags={};g.progress.inventory={};g.progress.money=1000;
 const conditions=[];for(let day=0;day<=3;day++)for(const flow of ['in','out']){m.start({day,flow});conditions.push({day,flow,shop:shop.visible(m),bd:bd.visible(m),poster:m.targets().some(t=>t.id==='wanted-poster')});}
 m.start({day:1,flow:'out'});const t=shop.targets(m)[0],finish=()=>{for(let i=0;m.story.speech&&!m.story.speech.choice&&i<50;i++)m.story.advance();};
 shop.interact(m,t);m.story.cancel();const cancelledMet=!!g.progress.flags.shiba_shop_met;
 shop.interact(m,t);finish();const met=g.progress.flags.shiba_shop_met;
 shop.interact(m,t);const repeat=m.story.speech.line.text;m.story.choose('shop-no');finish();
 shop.interact(m,t);m.story.choose('shop-yes');finish();g.progress.money=49;const disabled=shop.choiceView(m).options.filter(o=>o.id.startsWith('shop-buy')).every(o=>o.disabled),denied=m.story.choose('shop-buy-arcade_coupon');
 g.progress.money=1000;lunaCampaign.session.carry=structuredClone(g.progress);const bought=m.story.choose('shop-buy-wild_dog'),double=m.story.choose('shop-buy-wild_dog');finish();
 const purchase={money:g.progress.money,count:g.progress.inventory.wild_dog,carry:lunaCampaign.session.carry.inventory.wild_dog};
 m.start({day:2,flow:'in'});shop.interact(m,shop.targets(m)[0]);const retained=m.story.speech.choice;m.story.cancel();
 g.progress.money=499;bd.interact(m,bd.targets(m)[0]);finish();const bdDisabled=bd.choiceView().options[0].disabled,bdDenied=m.story.choose('buy');g.progress.money=1000;m.story.choose('buy');const bdDouble=m.story.choose('buy'),bdFlag=g.progress.flags.bd_chip_purchased,bdMoney=g.progress.money,bdTargetGone=!bd.targets(m).length;
 // The purchase dialogue keeps its actor until the cinema takes over.
 const stillSpeaking=bd.visible(m);m.story.cancel();m.start({day:3,flow:'out'});const bdGone=!bd.visible(m)&&!bd.targets(m).length;
 m.start({day:99,qaCase:'shop:repeat'});m.x=0;m.updateNear();m.interact();const before=g.progress.money;m.story.choose('shop-yes');finish();m.story.choose('shop-buy-arcade_coupon');const qaIsolated=g.progress.money===before;
 return {conditions,cancelledMet,met,repeat,disabled,denied,bought,double,purchase,retained,bdDisabled,bdDenied,bdDouble,bdFlag,bdMoney,bdTargetGone,stillSpeaking,bdGone,qaIsolated};
 });
 for(const c of results.conditions){assert.equal(c.shop,c.day>1||c.day===1&&c.flow==='out');assert.equal(c.bd,c.day>=1);assert(c.poster);}
 assert(!results.cancelledMet);assert(results.met);assert.equal(results.repeat,'뭐야? 뭐 사러 온 거야?');assert(results.disabled);assert(!results.denied);assert(results.bought);assert(!results.double);assert.deepEqual(results.purchase,{money:400,count:1,carry:1});assert(results.retained);assert(results.bdDisabled);assert(!results.bdDenied);assert(!results.bdDouble);assert(results.bdFlag);assert.equal(results.bdMoney,500);assert(results.bdTargetGone);assert(results.stillSpeaking);assert(results.bdGone);assert(results.qaIsolated);
 // Actual rendered choices and restored shop sprite in both simulator variants.
 for(const variant of ['original','gpt']){await p.evaluate(async variant=>{outsidePlaytest.exit(true);Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar',variant});await outsidePlaytest.start();const a=outsidePlaytest,m=a.model;barGame.progress.flags.shiba_shop_met=true;barGame.progress.inventory={};barGame.progress.money=400;m.x=-2.87;m.updateNear();a.snapCamera();m.interact();m.story.choose('shop-yes');for(let i=0;m.story.speech&&!m.story.speech.choice&&i<20;i++)m.story.advance();a.tick(0);},variant);assert.equal(await p.locator('.outside-speech strong').count(),0);assert(await p.locator('[data-choice="shop-buy-wild_dog"]').isDisabled());assert(await p.locator('[data-choice="shop-buy-bitters"]').isEnabled());await p.screenshot({path:'/private/tmp/outside-shop-'+variant+'.png'});await p.locator('[data-choice="shop-buy-bitters"]').click();assert.equal(await p.evaluate(()=>barGame.progress.money),100);}
 assert.deepEqual(errors,[]);console.log('OUTSIDE_CONDITIONS_OK',JSON.stringify(results));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
