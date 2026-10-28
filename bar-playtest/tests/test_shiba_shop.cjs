const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['src/features/outside/events/outside-shop.js','src/features/outside/events/outside-story.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
const shop=W.LunaOutsideShop,notices=[];W.outsidePlaytest={notifyItem:(m,id)=>notices.push(id)};
function setup(inventory={},flags={},qa=false){const p={money:2000,inventory,flags};W.barGame={progress:p,changed(){},log(){}};W.lunaCampaign={session:{carry:structuredClone(p)}};const m={config:{day:2,flow:'out'},scene:'street',level:0,x:-2.8,backgroundStory:{cancel(){}},updateNear(){},qa:qa?{shopProgress:structuredClone(p)}:null};m.story=new W.LunaOutsideStory.Story(m);return m;}
const target={id:shop.id,x:-2.68,y:-.596};
function drain(m){const lines=[];for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){lines.push(m.story.speech.line.text);m.story.speech.elapsed=99;m.story.advance();}return lines;}
function menu(m){shop.begin(m,target,false);drain(m);assert(shop.choose(m,'shop-yes'));drain(m);}
const ids=m=>Array.from(shop.choiceView(m).options,o=>o.id);

for(const qa of [false,true])for(const hasWildDog of [false,true]){
 const m=setup(hasWildDog?{wild_dog:1}:{},{},qa),p=qa?m.qa.shopProgress:W.barGame.progress;
 shop.begin(m,target,true);const intro=drain(m);assert.equal(intro[1],'뭘 봐, 시바.');assert(p.flags.shiba_shop_met);assert.deepEqual(ids(m),['shop-no','shop-buy-bitters']);
 assert.equal(shop.choose(m,'shop-buy-wild_dog'),false);assert.equal(shop.choose(m,'shop-buy-arcade_coupon'),false);assert.equal(p.money,2000);
 assert(shop.choose(m,'shop-buy-bitters'));drain(m);
 if(hasWildDog){assert.equal(m.story.speech.line.stage,'quiz');assert.equal(p.money,1700);assert(shop.choose(m,'shop-answer-2'));drain(m);assert.equal(p.money,1700);assert(shop.choose(m,'shop-answer-1'));drain(m);assert(p.flags.shiba_old_fashioned_taught);}
 assert.equal(p.money,1700);assert.equal(p.inventory.bitters,1);assert.equal(p.inventory.wild_dog,hasWildDog?1:undefined);
 p.inventory={};m.config.day=3;shop.begin(m,target,false);assert.deepEqual(drain(m),['이제 팔 거 없어. 꺼져, 시바.']);assert.equal(m.story.speech,null);assert(!shop.choose(m,'shop-buy-bitters'));assert(!shop.choose(m,'shop-buy-wild_dog'));assert.equal(p.money,1700);
 if(!qa){assert(W.lunaCampaign.session.carry.flags.shiba_bought_bitters);assert(!W.lunaCampaign.session.carry.flags.shiba_bought_wild_dog);}
}
const legacy=setup({wild_dog:1},{shiba_bought_wild_dog:true});menu(legacy);assert.deepEqual(ids(legacy),['shop-no','shop-buy-bitters']);
const poor=setup();W.barGame.progress.money=0;menu(poor);assert.equal(poor.story.speech.line.stage,'allowance');shop.choose(poor,'shop-allowance-no');assert(shop.choiceView(poor).options.filter(o=>o.id.startsWith('shop-buy-')).every(o=>o.disabled));assert.equal(shop.choose(poor,'shop-buy-bitters'),false);
assert.deepEqual(Array.from(shop.items,i=>i.id),['bitters']);assert.equal(notices.length,4);console.log('SHIBA_SHOP_OK: no Wild Dog sales in game/QA, bitters with/without gang ingredient, quiz, single purchase, legacy inventory, carry and no funds');
