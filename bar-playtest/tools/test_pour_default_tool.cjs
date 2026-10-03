const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require('../core'),R=require('../remix'),M=require('../minigames'),P=require('../pour-fluid');
for(const variant of ['original','gpt']){
 const g=new C.Game(C.millilitreData(ctx.window.LUNA_DATA));R.attach(g);M.attach(g);g.startMinigame('pour',variant);
 for(const [type,target,unit,expected] of [['pour',99.9,'ml','pourer'],['pour',100,'ml','none'],['pour',300,'ml','none'],['fill_up',100,'ml','none'],['fill_up',90,'ml','pourer'],['pour',4,'oz','none'],['pour',3,'oz','pourer'],['pour',20,'tsp','none'],['pour',19,'tsp','pourer']]){
  g.craft.queue=[{type,ingredient:'gin',target,unit}];g.craft.index=0;g.nextGimmick();const s=g.gimmick;
  assert.equal(s.fluid.tool,expected);assert.equal(g.pourTool,expected);assert.equal(s.fluid.rate/s.fluid.baseRate,expected==='none'?4:1);assert.equal(s.fluid.caughtMl,0);assert.equal(s.started,false);
  assert(g.setPourTool(expected==='none'?'pourer':'none'));g.tick(.05);assert.notEqual(s.fluid.tool,expected,'manual choice must survive ticks');
  g.nextGimmick();assert.equal(g.gimmick.fluid.tool,expected,'new step restores per-target default');
 }
}
console.log('POUR_DEFAULT_TOOL_OK 99.9/100/300ml, pour/fill-up, oz/tsp conversion, original/GPT, flow rates, manual override and next step reset');
