const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(root+'/data/runtime/game-data.js','utf8'),ctx);
const C=require('../src/core/core.js'),R=require('../src/features/bar/remix.js'),D=ctx.window.LUNA_DATA;
function tick(g,n){for(let i=0;i<n*20;i++)g.tick(.05);assert.equal(g.error,null);}
for(const variant of ['original','gpt']){
 const g=new C.Game(D);R.attach(g);g.reset(1,'regular',42,false,{variant});g.phase='regular';
 g.seats={L:{actor:'tom',coaster:true,state:'STORY',glass:'dry_martini',glassEmpty:false},M:null,R:{actor:'chris',coaster:true,state:'STORY',glass:'gin_tonic',glassEmpty:false}};
 g.story={scene:{id:'empty-test'},index:0,steps:[{type:'say',actor:'chris','text.ko':'음...'},{type:'empty_glass',actor:'chris'},{type:'empty_glass',actor:'chris'},{type:'say',actor:'luna','text.ko':'어떤가요?'}]};g.pump();
 assert.equal(g.seats.R.glassEmpty,false,'Still full while the preceding line types');g.dialogue.chars=g.dialogue.text.length;g.advance();
 assert.equal(g.seats.R.glassEmpty,true);assert.equal(g.seats.L.glassEmpty,false);assert.equal(g.dialogue.text,'어떤가요?');assert.equal(g.transactions.length,0);
 g.reset(99,'general',42,true,{variant});g.qaKeepGeneral=true;g.queue=[{personality:'gentle',order:'gin_tonic',max_rounds:2}];g.queueIndex=0;g.spawn();
 const guest=Object.values(g.seats).find(Boolean);g.focus=guest.seat;assert(g.coaster(guest.seat,'drag'));
 g.focus=guest.seat==='L'?'R':'L';tick(g,20);assert.equal(guest.state,'WAIT_SERVE');
 for(let round=0;round<2;round++){
  g.focus=guest.seat;g.cameraMoving=false;g.cameraLeft=0;g.drink={id:'empty-test-'+round,selected:'gin_tonic',actual:{glass:'long_drink'},missingCore:[],grade:'excellent',score:100};
  assert(g.serve(guest.seat,'drag'));assert.equal(guest.glassEmpty,false,'New serving refills the table');assert.equal(guest.glassKind,'long_drink');g.focus=guest.seat==='L'?'R':'L';
  for(let i=0;i<800&&guest.state!=='DRINKING';i++)tick(g,.05);
  assert.equal(guest.state,'DRINKING');assert.equal(guest.glassEmpty,false);
  const remaining=guest.drinkLeft;g.paused=true;tick(g,5);assert.equal(guest.drinkLeft,remaining);g.paused=false;
  tick(g,remaining+.05);assert.equal(guest.glassEmpty,true);assert.equal(guest.state,'REACTION');tick(g,30);assert.equal(g.transactions.length,round+1);
  if(!round)assert.equal(guest.state,'WAIT_SERVE');
 }
 assert.equal(g.seats[guest.seat],null);tick(g,20);assert.equal(g.transactions.length,2);
 console.log('EMPTY_GLASS_OK',variant,'targeted trigger, line timing, automatic drinking, pause, offscreen, refill and single settlement');
}
for(const [key,file] of [['beer','beer-glass.png'],['cocktail','cocktail-glass.png'],['long_drink','long-drink-glass.png']]){
 const asset=D.assets['table_empty_glass_'+key];assert(asset);assert(asset.src.endsWith(file));assert(fs.existsSync(path.join(root,asset.src)));
}
