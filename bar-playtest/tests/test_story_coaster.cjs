const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(root+'/data/runtime/game-data.js','utf8'),ctx);
const C=require('../src/core/core.js'),R=require('../src/features/bar/remix.js'),D=ctx.window.LUNA_DATA;
const line=(actor,text)=>({type:'say',actor,'text.ko':text});
function fixture(variant,steps){
 const g=new C.Game(D);R.attach(g);g.reset(1,'regular',42,false,{variant});g.phase='regular';
 g.seats={L:{actor:'tom',coaster:false,state:'STORY'},M:null,R:{actor:'chris',coaster:false,state:'STORY'}};
 g.story={scene:{id:'coaster-test'},steps,index:0};g.pump();return g;
}
function advance(g){g.dialogue.chars=g.dialogue.text.length;g.advance();}
function settled(g){g.cameraMoving=false;g.cameraLeft=0;g.transition=0;}
for(const variant of ['original','gpt']){
 const g=fixture(variant,[line('tom','첫 대사'),line('luna','다음 대사'),{type:'coaster',actor:'tom'},line('tom','주문해도 될까?'),{type:'coaster',actor:'tom'},{type:'order',actor:'tom',arg:'exact:dry_martini'},{type:'craft',actor:'tom'}]);
 assert.equal(g.storyCoaster,null,'No implicit gate on first greeting');assert.equal(g.coaster('L','drag'),false);
 advance(g);assert.equal(g.dialogue.text,'다음 대사');assert.equal(g.storyCoaster,null);
 advance(g);assert.equal(g.story.index,2);assert.equal(g.storyCoaster.seat,'L');assert(g.storyCoasterReady());
 settled(g);assert.equal(g.coaster('R','drag'),false);assert.equal(g.coaster('L'),false);
 for(const key of ['paused','hidden','cameraMoving','cameraLeft','transition','overlay']){g[key]=key==='overlay'?'settings':true;assert.equal(g.coaster('L','drag'),false,key);g[key]=key==='overlay'?null:false;}
 assert(g.coaster('L','keyboard'));assert.equal(g.dialogue.text,'주문해도 될까?');assert(g.seats.L.coaster);assert.equal(g.storyCoaster,null);assert.equal(g.coaster('L','drag'),false);
 advance(g);assert.equal(g.story.index,6);assert.equal(g.logs.filter(e=>e.event==='story_coaster').length,1);assert.equal(g.currentOrder.cocktail,'dry_martini');
 const pair=fixture(variant,[{type:'coaster',actor:'tom'},{type:'coaster',actor:'chris'},line('luna','둘 다 드렸어요.')]);
 settled(pair);assert(pair.coaster('L','drag'));assert.equal(pair.storyCoaster.seat,'R');assert(pair.coaster('R','drag'));assert.equal(pair.dialogue.actor,'luna');
 const visitor=fixture(variant,[line('chris','인사만 할게.'),line('luna','안녕하세요.')]);advance(visitor);assert.equal(visitor.storyCoaster,null);assert.equal(visitor.seats.R.coaster,false);
 const order=fixture(variant,[{type:'order',actor:'tom',arg:'exact:dry_martini'},{type:'craft',actor:'tom'}]);
 assert.equal(order.storyCoaster,null,'Orders do not invent a missing trigger');assert.equal(order.seats.L.coaster,false);assert.equal(order.currentOrder.cocktail,'dry_martini');
 const explicit=fixture(variant,[{type:'coaster',actor:'chris'},line('chris','고마워.')]);assert(explicit.storyCoaster,'Explicit trigger works without a later order');
 explicit.reset(1,'general',4);assert.equal(explicit.storyCoaster,null);
 console.log('STORY_COASTER_OK',variant,'explicit timing, two targets, no implicit gates, guard, duplicate and reset');
}
