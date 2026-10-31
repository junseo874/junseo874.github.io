const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const C=require('../src/core/core.js'),M=require('../src/features/crafting/minigames.js'),R=require('../src/features/bar/remix.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/runtime/game-data.js'),'utf8'),ctx);
for(const type of ['pour','fill_up'])for(const variant of ['original','gpt']){
 const g=new C.Game(ctx.window.LUNA_DATA);R.attach(g);M.attach(g);g.startMinigame(type);g.variant=variant;
 const s=g.gimmick,f=s.fluid;assert.equal(g.endGimmick(),false,'Unstarted');
 g.holdPour(true);assert.equal(g.endGimmick(),false,'Held even before first angle update');
 for(let i=0;i<90;i++)g.tick(1/60);assert(s.angle>100);assert.equal(g.endGimmick(),false);assert.equal(s.held,true);assert.equal(f.finishRequested,false);
 g.holdPour(false);let returning=0;
 for(let i=0;i<240&&!f.canFinish(s);i++){
  returning++;assert.equal(g.endGimmick(),false,'Returning must not queue a finish');assert.equal(f.finishRequested,false);assert.equal(g.craft.index,0);g.tick(1/120);
 }
 assert(returning>10);assert.equal(s.angle,0);assert(f.canFinish(s));
 for(let i=0;i<30;i++)g.tick(1/60);assert.equal(f.finishRequested,false,'Rejected inputs do not auto-finish later');
 g.paused=true;assert.equal(g.endGimmick(),false);g.paused=false;
 assert(g.endGimmick());assert(f.finishRequested);assert.equal(g.endGimmick(),false,'No duplicate finish request');
 for(let i=0;i<600&&g.gimmick===s;i++)g.tick(1/120);
 assert.equal(g.screen,'minigame_result');assert.equal(g.craft.results.length,1);assert.equal(g.error,null);
 console.log('POUR_FINISH_LOCK_OK',type,variant,'held/returning rejected, no queued press, rest/cleanup/one result');
}
