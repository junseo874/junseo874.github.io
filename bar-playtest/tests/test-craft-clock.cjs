const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../src/core/core.js'),M=require('../src/features/crafting/minigames.js'),R=require('../src/features/bar/remix.js'),S=require('../src/features/crafting/shake-rhythm.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../data/runtime/game-data.js'),'utf8'),ctx);
const data=C.millilitreData(ctx.window.LUNA_DATA),near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const tick=(g,t)=>{for(let left=t;left>1e-8;left-=.01)g.tick(Math.min(.01,left));};
function game(kind,variant='original'){
 const g=new C.Game(data);R.attach(g);M.attach(g);S.attach(g);g.startMinigame(kind);
 if(variant==='gpt'){const craft=g.craft;g.reset(99,'practice',1,false,{variant});g.craft=craft;g.screen='gimmick';g.nextGimmick();}
 return g;
}
for(const variant of ['original','gpt'])for(const kind of ['open','pour','fill_up','stir','shake']){
 const g=game(kind,variant);tick(g,2);near(g.craft.elapsed,0);
 g.gimmickInput(kind==='stir'?'KeyW':'Space');if(g.gimmick.fluid)g.holdPour(false);
 tick(g,1.25);near(g.craft.elapsed,1.25);near(g.gimmick.elapsed,1.25);
 for(const pause of ['paused','hidden','overlay']){g[pause]=pause==='overlay'?'help':true;tick(g,2);near(g.craft.elapsed,1.25);g[pause]=pause==='overlay'?null:false;}
 tick(g,.75);near(g.craft.elapsed,2);
 g.startMinigame(kind);near(g.craft.elapsed,0);
}
// Two pours and one shake share one attempt and one scoring clock.
const g=game('pour');g.minigame=null;
g.craft.actual=structuredClone(M.example(g,'shake').actual);
g.craft.queue=[M.example(g,'pour').step,M.example(g,'pour').step,M.example(g,'shake').step];
for(const seconds of [2,3]){
 g.gimmickInput('Space');g.holdPour(false);tick(g,seconds);
 const total=g.craft.elapsed,step=g.gimmick;g.endGimmick();
 for(let i=0;i<300&&g.gimmick===step;i++)tick(g,.01);
 assert.notEqual(g.gimmick,step,'pour settling and feedback advance to the next step');near(g.craft.elapsed,total);
 assert.equal(g.gimmick.elapsed,0,'step resets without resetting the shared clock');tick(g,2);near(g.craft.elapsed,total);
}
assert.equal(g.gimmick.type,'shake');g.gimmickInput('Space');tick(g,4);near(g.craft.elapsed,9);
g.gimmick.completed=true;g.gimmick.success=g.gimmick.targetStacks;g.gimmick.attempts=g.gimmick.targetStacks;
tick(g,.5);near(g.craft.elapsed,9);tick(g,.5);
assert.equal(g.screen,'result');near(g.result.elapsed,9);tick(g,3);near(g.result.elapsed,9);
g.cancelCraft();assert.equal(g.craft,null);
g.startMinigame('open');g.gimmickInput('Space');tick(g,1);g.gimmick.completed=true;tick(g,2);near(g.craft.elapsed,1);
g.retryDataError();near(g.craft.elapsed,0);
console.log('CRAFT_CLOCK_OK: all five types/both modes, shared 2+3+4 seconds, score result, idle/pause/hidden/menu/completion exclusion, reset/retry');
