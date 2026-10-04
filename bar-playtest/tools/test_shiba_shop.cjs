const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['outside-shop.js','outside-story.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
const shop=W.LunaOutsideShop,notices=[];W.outsidePlaytest={notifyItem:(m,id)=>notices.push(id)};
function setup(inventory={},flags={},qa=false){const p={money:2000,inventory,flags};W.barGame={progress:p,changed(){},log(){}};W.lunaCampaign={session:{carry:structuredClone(p)}};W.LunaBDVendor={balance:()=>2000};const m={config:{day:1,flow:'out'},scene:'street',level:0,x:-2.8,backgroundStory:{cancel(){}},updateNear(){},qa:qa?{shopProgress:structuredClone(p)}:null};m.story=new W.LunaOutsideStory.Story(m);return m;}
const target={id:shop.id,x:-2.68,y:-.596};
function drain(m){const lines=[];for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){lines.push(m.story.speech.line.text);m.story.speech.elapsed=99;m.story.advance();}return lines;}
function menu(m){shop.begin(m,target,false);assert(shop.choose(m,'shop-yes'));drain(m);}
const ids=m=>Array.from(shop.choiceView(m).options,o=>o.id);
for(const qa of [false,true])for(const [first,second]of [['wild_dog','bitters'],['bitters','wild_dog']]){
const m=setup({}, {},qa),p=qa?m.qa.shopProgress:W.barGame.progress;
shop.begin(m,target,true);const intro=drain(m);assert.equal(intro[1],'뭘 봐, 시바.');assert.equal(intro.at(-1),'한번 보고 생각해 볼게요.');assert(p.flags.shiba_shop_met);assert.equal(m.story.speech.line.stage,'items');assert.deepEqual(ids(m),['shop-buy-wild_dog','shop-buy-bitters','shop-no']);
assert.equal(shop.choose(m,'shop-buy-arcade_coupon'),false);assert.equal(p.money,2000);
assert(shop.choose(m,'shop-buy-'+first));drain(m);assert.equal(p.inventory[first],1);menu(m);assert(!ids(m).includes('shop-buy-'+first));const before=p.money;assert.equal(shop.choose(m,'shop-buy-'+first),false);assert.equal(p.money,before);
assert(shop.choose(m,'shop-buy-'+second));drain(m);assert.equal(m.story.speech.line.stage,'quiz');assert.equal(p.money,before);assert(shop.choose(m,'shop-answer-2'));drain(m);assert.equal(p.money,before);assert(shop.choose(m,'shop-answer-1'));drain(m);assert.equal(p.money,1100);assert.equal(p.inventory[second],1);
// Permanent purchase flags survive item consumption and a new street visit/day.
p.inventory={};m.config.day=3;menu(m);assert.deepEqual(ids(m),['shop-no']);assert.equal(shop.choose(m,'shop-buy-'+first),false);assert.equal(shop.choose(m,'shop-buy-'+second),false);assert.equal(p.money,1100);
if(!qa){assert(W.lunaCampaign.session.carry.flags.shiba_bought_wild_dog);assert(W.lunaCampaign.session.carry.flags.shiba_bought_bitters);}
}
const legacy=setup({wild_dog:1});menu(legacy);assert.deepEqual(ids(legacy),['shop-buy-bitters','shop-no']);
const poor=setup();W.barGame.progress.money=0;menu(poor);assert.equal(poor.story.speech.line.stage,'allowance');shop.choose(poor,'shop-allowance-no');assert(shop.choiceView(poor).options.filter(o=>o.id.startsWith('shop-buy-')).every(o=>o.disabled));assert.equal(shop.choose(poor,'shop-buy-bitters'),false);
assert.deepEqual(Array.from(shop.items,i=>i.id),['wild_dog','bitters']);assert.equal(notices.length,8);console.log('SHIBA_SHOP_OK first visit opens goods, removed coupon, both purchase orders, quiz, one-time guards, legacy inventory, carry, QA, no funds');
