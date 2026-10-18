const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../pour-fluid'),C=require('../core'),M=require('../minigames'),R=require('../remix');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../data.js'),'utf8'),ctx);
for(const ingredient of ['gin','beer','soda_water','cola','champagne','milk']){
 const f=new P.Simulation({targetMl:45,ingredient}),s={held:false,angle:0};f.setTool(P.toolForIngredient(ingredient),s);s.held=true;s.dragAngle=150;
 for(let i=0;i<2400;i++){
  f.tick(s,1/120);assert(Math.abs(f.audit().error)<1e-7);
  assert(f.liquidMl+f.foamMl/f.foamDensity<=f.capacity+1e-7);
  if(f.emittedMl<100)assert.equal(f.overflowMl,0,'No early leaks');
  for(const p of f.overflowDrops)assert(p.y>=f.glass.top-1&&(p.side<0?p.x<f.glass.left:p.x>f.glass.right),'Only outside-rim overflow');
 }
 assert(f.overflowMl>0,ingredient+' must overflow');
 if(ingredient==='beer')assert(f.foamMl>0&&f.retainedFoamMl>0,'Keep beer head after overflow');
 s.held=false;for(let i=0;i<600;i++)f.tick(s,1/120);assert.equal(f.overflowDrops.length,0,'Drain and fade');
 console.log(ingredient,{overflow:f.overflowMl,foam:f.foamMl});
}
const g=new C.Game(ctx.window.LUNA_DATA);R.attach(g);M.attach(g);
g.startMinigame('pour',{ingredient:'beer'});const before=g.progress.money;g.holdPour(true);g.gimmick.dragAngle=150;
for(let i=0;i<720;i++)g.tick(1/60);
const f=g.gimmick.fluid,charged=Math.floor(f.overflowMl+1e-8);
assert(charged>0);assert.equal(before-g.progress.money,charged);assert.equal(g.progress.pourWaste,charged);
g.chargePourOverflow(f);assert.equal(before-g.progress.money,charged,'No duplicate charge');
g.overlay='settings';for(let i=0;i<120;i++)g.tick(1/60);assert.equal(before-g.progress.money,charged,'No cost while paused');g.overlay=null;
const synthetic={overflowMl:.999,overflowCharged:0,spilledMl:999};g.chargePourOverflow(synthetic);assert.equal(before-g.progress.money,charged,'No fee for missed stream or fractional ml');
synthetic.overflowMl=1.2;g.chargePourOverflow(synthetic);assert.equal(before-g.progress.money,charged+1);
synthetic.overflowMl=3.8;g.chargePourOverflow(synthetic);assert.equal(before-g.progress.money,charged+3);
let sounds=0;const w={LunaCurrencyAudio:{play(){sounds++;}}};vm.runInNewContext(fs.readFileSync(require.resolve('../currency-view.js'),'utf8'),{window:w});
const v=w.LunaCurrencyView(),progress={money:100,pourWaste:0};v.update(progress);
progress.money-=3;progress.pourWaste+=3;let state=v.update(progress,1/60);
assert.equal(sounds,0);assert.equal(state.unitLosses.length,3);assert.equal(state.unitSpending,true);
let html=w.LunaCurrencyView.html(state,progress);assert.equal((html.match(/data-loss-id=/g)||[]).length,3);assert(!html.includes('−3<'));
state=v.update(progress,0);assert.equal(state.unitLosses.length,3,'Repeated render cannot add receipts');
for(let i=0;i<50;i++)state=v.update(progress,1/60);assert.equal(state.unitLosses.length,0);
progress.money+=20;state=v.update(progress);assert.equal(sounds,1,'Other currency sounds unchanged');assert.equal(state.unitSpending,false);
console.log('PASS overflow conservation, foam retention, rim-only escape, exact per-ml cost, pause/idempotence, silent individual -1 receipts');
