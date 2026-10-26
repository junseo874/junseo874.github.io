const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['src/features/outside/events/outside-shop.js','src/features/outside/events/outside-story.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
W.LunaOutsideContent={events:[]};
const S=W.LunaOutsideShop,target={id:S.id,x:0,y:0};
function setup(inventory={}){const p={money:1000,inventory,flags:{shiba_shop_met:true}};W.barGame={progress:p,changed(){},log(){}};W.lunaCampaign={session:{carry:structuredClone(p)}};const m={config:{day:1,flow:'out'},scene:'street',level:0,x:0,y:0,updateNear(){}};m.story=new W.LunaOutsideStory.Story(m);m.backgroundStory=new W.LunaOutsideStory.BackgroundStories(m);return m;}
function drain(m){for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}}
for(const order of ['wild-first','bitters-first']){
 const m=setup(order==='wild-first'?{wild_dog:1}:{}),p=W.barGame.progress;
 S.openStock(m,target);assert(S.choose(m,'shop-buy-bitters'));drain(m);assert.equal(p.money,700);
 if(order==='bitters-first'){p.inventory.wild_dog=1;S.openStock(m,target);drain(m);}
 assert.equal(m.story.speech.line.stage,'quiz');assert(!S.choiceView(m).options[0].disabled);
 p.money=0;assert(S.choose(m,'shop-answer-2'));drain(m);assert.equal(p.money,0);
 assert(S.choose(m,'shop-answer-1'));drain(m);assert(p.flags.shiba_old_fashioned_taught);assert.equal(p.inventory.bitters,1);
 S.openStock(m,target);drain(m);assert.notEqual(m.story.speech.line.stage,'quiz');
}
{
 const m=setup(),p=W.barGame.progress;p.money=0;S.openStock(m,target);drain(m);S.choose(m,'shop-allowance-yes');drain(m);
 assert.equal(p.money,500);assert(p.flags.shiba_allowance_received);assert(W.lunaCampaign.session.carry.flags.shiba_allowance_received);
 for(const day of [1,2,3]){m.config.day=day;p.money=0;S.openStock(m,target);drain(m);assert.equal(m.story.speech.line.stage,'items');assert.equal(S.grantAllowance(m),false);assert.equal(p.money,0);}
}
{
 const m=setup(),events=W.LunaOutsideStory.events,order=[];let inside=true;
 m.dialog={};const offer=()=>{for(const [id,priority]of [['later',40],['first',10]])events.offer(m,id,()=>inside,()=>{order.push(id);m.encounter={kind:id};return true;},priority);};
 offer();assert(!events.pump(m));m.dialog=null;assert(events.pump(m));assert.deepEqual(order,['first']);assert(!events.pump(m));
 m.encounter=null;assert(events.pump(m));assert.deepEqual(order,['first','later']);m.encounter=null;offer();assert(!events.pump(m),'same boundary cannot retrigger');
 inside=false;offer();inside=true;offer();assert(events.pump(m),'re-entry may restart an unfinished event');
}
{
 const m=setup(),b=m.backgroundStory,rows=[{type:'say',actor:'luna',text:'자동 대사'}];
 b.beginRows('ambient',target,rows);b.tick(.1);const age=b.speech.elapsed;
 m.story.beginRows('manual',target,[{type:'say',actor:'luna',text:'첫 번째 대사'},{type:'say',actor:'luna',text:'다음 대사'}]);
 b.tick(2);assert.equal(b.speech.elapsed,age);assert.equal(b.views().length,0);
 m.story.advance();assert.equal(m.story.speech.index,0);m.story.advance();assert.equal(m.story.speech.index,1);
 m.story.cancel();b.tick(.2);assert(b.speech.elapsed>age);
 b.tick(10);assert(!b.speech);assert(!b.beginRows('ambient',target,rows));b.tick(3.99);assert(!b.beginRows('ambient',target,rows));b.tick(.01);assert(b.beginRows('ambient',target,rows));
}
console.log('APPROVED_RULES_OK: independent lesson in both orders, no quiz charge, allowance once across days, priority/boundary queue, manual typing, ambient pause and 4s repeat interval');
