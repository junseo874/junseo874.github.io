const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require(dir+'/core'),R=require(dir+'/remix'),M=require(dir+'/minigames'),P=require(dir+'/pour-fluid'),pour=require('./pour-test-driver.cjs');
let count=0;const test=(name,fn)=>{fn();console.log('PASS',name);count++;};
function game(kind='pour',variant='original'){const g=new C.Game(ctx.window.LUNA_DATA);R.attach(g);M.attach(g);g.startMinigame(kind,variant);return g;}
function advance(g,seconds,dt=1/120){for(let t=0;t<seconds-1e-9;t+=dt)g.tick(Math.min(dt,seconds-t));}
function conserved(f){const a=f.audit();assert(Math.abs(a.error)<1e-7,JSON.stringify(a));for(const p of f.particles)assert([p.x,p.y,p.vx,p.vy,p.ml].every(Number.isFinite));}
test('pourer uses 25% flow, a short ramp and a steady plateau without automatic target stop',()=>{
 for(const v of ['original','gpt'])for(const kind of ['pour','fill_up']){const g=game(kind,v),f=g.gimmick.fluid;assert.equal(f.rate,g.c('pour_emit_rate_ml_per_sec',70)*.25);assert.equal(f.maxAngle,125);assert.equal(f.flowAt(95),0);assert.equal(f.flowAt(100),.5);assert.equal(f.flowAt(105),1);assert.equal(f.flowAt(125),1);g.holdPour(true);advance(g,9);assert(f.caughtMl>f.targetMl);assert.equal(f.finishRequested,false);conserved(f);}
});
test('no input, no motion, no volume, no clock',()=>{const g=game(),s=g.gimmick;const before=JSON.stringify(s);advance(g,5);assert.equal(JSON.stringify(s),before);assert.equal(g.craft.elapsed,0);});
test('emitted volume is not counted until particles enter the glass',()=>{const g=game(),s=g.gimmick;g.holdPour(true);advance(g,1.1);assert(s.fluid.emittedMl>0);assert(s.fluid.airMl>0);assert.equal(s.value,0);conserved(s.fluid);advance(g,.7);assert(s.value>0);assert(s.fluid.caughtMl<s.fluid.emittedMl);});
test('release keeps falling liquid alive; finalization waits and is committed once',()=>{for(const v of ['original','gpt']){
 const g=game('pour',v),s=g.gimmick;g.holdPour(true);advance(g,1.7);const before=s.value;g.endGimmick();g.endGimmick();assert.equal(g.craft.results.length,0);assert.equal(g.gimmickInput('Space'),false);g.holdPour(true);assert.equal(s.held,false);
 advance(g,6);assert.equal(g.screen,'minigame_result');assert(g.minigame.result.value>before);assert.equal(g.craft.results.length,1);assert(s.fluid.ready);assert(s.fluid.airMl<1e-8);g.endGimmick();assert.equal(g.craft.results.length,1);conserved(s.fluid);
}});
test('identical timed inputs at 30 / 60 / 120 FPS produce the same volume and particles',()=>{
 const records=[];
 for(const fps of [30,60,120]){const f=new P.Simulation({targetMl:45,unitMl:30}),s={angle:0,held:true};for(let i=0;i<fps*2;i++)f.tick(s,1/fps);f.requestFinish(s);for(let i=0;i<fps*8&&!f.ready;i++)f.tick(s,1/fps);assert(f.ready);conserved(f);records.push(f.audit());}
 for(const a of records.slice(1))for(const key of ['emitted','caught','spilled'])assert(Math.abs(a[key]-records[0][key])<1e-7);
});
test('overflow and misses never turn into retained volume; particle memory stays bounded',()=>{
 const f=new P.Simulation({targetMl:45,unitMl:30}),s={angle:0,held:true};// The pourer is slower: hold long enough to exceed the vessel capacity, not merely 15 seconds.
 for(let i=0;i<2100;i++)f.tick(s,1/60);
 assert(f.spilledMl>0);assert(f.caughtMl<f.emittedMl);assert(f.peakParticles<=1100);f.requestFinish(s);
 for(let i=0;i<900&&!f.ready;i++)f.tick(s,1/60);assert(f.ready);conserved(f);
});
test('pause freezes settling too, retry and exit cannot commit an old attempt',()=>{
 const g=game('fill_up','gpt'),s=g.gimmick;g.holdPour(true);advance(g,2);g.endGimmick();g.overlay='settings';
 const frozen=JSON.stringify(s);advance(g,4);assert.equal(JSON.stringify(s),frozen);assert.equal(g.craft.results.length,0);g.overlay=null;
 g.retryMinigame();const next=g.gimmick;advance(g,4);assert.equal(next.value,0);assert.equal(next.started,false);assert.equal(g.craft.results.length,0);assert.equal(next.fluid.emittedMl,0);
 g.reset(0,'regular',1,true,{variant:'original'});advance(g,1);assert.equal(g.minigame,null);assert.notEqual(g.screen,'minigame_result');
});
test('all unit conversions, successful quantity score, fill-up and thick liquid',()=>{
 for(const unit of ['ml','oz','tsp']){
  const g=game();g.gimmick.unit=unit;g.gimmick.target=unit==='oz'?1.5:unit==='tsp'?9:45;P.init(g.gimmick,g);
  const s=g.gimmick;g.holdPour(true);for(let i=0;i<1500&&g.gimmick===s;i++){if(!s.fluid.finishRequested&&s.fluid.predicted(s)>=s.target)g.endGimmick();g.tick(1/120);}
  assert(Math.abs(g.craft.results[0].liquid.caught-45)<1);conserved(s.fluid);
 }
 for(const kind of ['pour','fill_up'])for(const variant of ['original','gpt']){const g=game(kind,variant);pour(g);assert.equal(g.minigame.result.score,100);}
 const f=new P.Simulation({targetMl:30,unitMl:30,viscosity:.065}),s={angle:0,held:true};for(let i=0;i<1800&&!f.ready;i++){if(f.predicted(s)>=1)f.requestFinish(s);f.tick(s,1/120);}assert(f.ready);conserved(f);
});
test('automatic final-drop waiting adds no active craft time once the bottle is upright',()=>{
 const g=game(),s=g.gimmick;g.holdPour(true);advance(g,1.7);g.endGimmick();while(g.gimmick===s&&s.angle>0)g.tick(1/120);
 const elapsed=g.craft.elapsed;advance(g,6);assert.equal(g.craft.elapsed,elapsed);assert.equal(g.craft.results.length,1);
});
console.log('POUR_FLUID_OK',count,'groups');
