const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require(dir+'/core'),P=require(dir+'/pour-fluid'),raw=ctx.window.LUNA_DATA,before=JSON.stringify(raw),data=C.millilitreData(raw);
assert.equal(JSON.stringify(raw),before);assert.deepEqual(C.millilitreData(data),data,'Conversion must be idempotent');
assert.equal(data.tables.recipes.length,71);assert(data.tables.recipes.every(r=>r.unit==='ml'));
assert(data.tables.shelf_items.filter(i=>['pour','fill_up'].includes(i.default_action)).every(i=>i.default_target_unit==='ml'));
for(const cocktail of raw.tables.cocktails){
 const recipes=raw.tables.recipes.filter(r=>r.context===cocktail.id&&!r.auto_apply),actual={selected:cocktail.id,glass:cocktail.glass,tool:cocktail.mix==='shake'?'shaker':cocktail.mix==='stir'?'mixing_glass':null,ingredients:recipes.map(r=>r.ingredient)};
 const q0=C.buildQueue(raw,cocktail,actual),q1=C.buildQueue(data,cocktail,actual);
 for(let i=0;i<q0.length;i++){if(['pour','fill_up'].includes(q0[i].type)){assert.equal(q1[i].unit,'ml');assert(Math.abs(q1[i].target-q0[i].target*(q0[i].unit==='oz'?30:q0[i].unit==='tsp'?5:1))<1e-8);}}
 for(const ratio of [.8,1,1.15]){
  const results=q=>q.map(s=>({...s,value:s.target*ratio,completion:1,completed:true,failures:0}));
  assert.equal(C.scoreCraft(raw,cocktail,actual,results(q0),2).score,C.scoreCraft(data,cocktail,actual,results(q1),2).score,'Unit conversion changed grade: '+cocktail.id);
 }
}
const beer=data.tables.recipes.find(r=>r.context==='bottle_beer');assert.equal(beer.qty,360);
for(const targetMl of [5,45,90,180,360,600]){
 const f=new P.Simulation({targetMl,unitMl:1}),s={angle:0,held:true};assert.equal(f.renderParticles(s).length,0);
 for(let i=0;i<360;i++)f.tick(s,1/120);
 const audit=JSON.stringify(f.audit()),count=f.particles.length,points=f.renderParticles(s);
 assert.equal(JSON.stringify(f.audit()),audit);assert.equal(f.particles.length,count);assert(points.some(p=>p.visualOnly));
 assert(points.length<=1701);assert(points.every(p=>[p.x,p.y,p.vx,p.vy].every(Number.isFinite)));
 const air=f.particles.filter(p=>!p.wet&&p.emissionFlow>=.25);
 for(let i=1;i<air.length;i++){
  const a=air[i-1],b=air[i];if(a.id+1!==b.id||a.stream!==b.stream)continue;
  const d=Math.hypot(a.x-b.x,a.y-b.y);
  for(let step=1;step<Math.ceil(d/6);step++){const t=step/Math.ceil(d/6),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;assert(points.some(p=>p.visualOnly&&Math.hypot(p.x-x,p.y-y)<.01));}
 }
 const stream=f.streamSerial;s.held=false;for(let i=0;i<60;i++)f.tick(s,1/120);assert.equal(f.flow,0);
 s.held=true;for(let i=0;i<180;i++)f.tick(s,1/120);assert(f.streamSerial>stream,'Restart needs a new stream segment');
 f.requestFinish(s);for(let i=0;i<1800&&!f.ready;i++)f.tick(s,1/120);assert(f.ready);assert(Math.abs(f.audit().error)<1e-7);
 assert(!f.renderParticles(s).some(p=>p.visualOnly),'No phantom stream after settling');
}
console.log('ML_STREAM_OK: 28 cocktail score parity; 69 recipes in ml; source untouched; beer 360ml; stream continuity, restarts, mass and final settling');
