const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const w={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/runtime/serve-grade-reveal.js'),'utf8'),{window:w});vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/features/crafting/serve-grade.js'),'utf8'),{window:w});
const chunks=p=>Array.from({length:p.length/12},(_,i)=>Array.from(p.slice(i*12,i*12+12)));
for(const grade of w.LUNA_SERVE_GRADE_REVEAL.grades){
 const expected=chunks(grade.frames[204].particles).filter(a=>/BackBar|Twinkle|Float/.test(grade.layers[a[0]].name));
 assert.deepEqual(chunks(w.LunaServeGrade.ambientAt(3.4,grade.id).particles),expected,'Transition retains every original ambient particle: '+grade.id);
 for(const time of [6,14,24,104]){
  const prev=chunks(w.LunaServeGrade.ambientAt(time-1/60,grade.id).particles),next=chunks(w.LunaServeGrade.ambientAt(time,grade.id).particles);
  assert(next.some(a=>grade.layers[a[0]].name.includes('BackBar')&&a[10]>.05),'Soft glow remains at '+time);
  for(const a of prev.filter(a=>a[10]>.2&&!grade.layers[a[0]].name.includes('BackBar'))){
   const continued=next.some(b=>b[0]===a[0]&&Math.hypot(a[1]-b[1],a[2]-b[2])<.04);
   assert(continued,grade.id+' active sparkle disappears at loop boundary '+time+': '+a);
  }
  assert(next.every(a=>/BackBar|Twinkle|Float/.test(grade.layers[a[0]].name)),'Do not restart flash/beam/shockwave');
 }
 for(const l of grade.layers.filter(l=>/Twinkle|Float/.test(l.name)))assert((grade.id==='sewage'&&l.texture==='')||l.texture.endsWith('/TX_GradeReveal_Sparkle_01.png'),'Use original pixel sparkle');
 for(const [index,layer] of grade.layers.entries())if(layer.sheet.enabled){
  assert.equal(layer.sheet.columns,5);assert.equal(layer.sheet.rows,1);
  const samples=grade.frames.flatMap(f=>chunks(f.particles)).filter(p=>p[0]===index);
  const cells=[...new Set(samples.map(p=>p[11]))].sort();
  assert.deepEqual(cells,layer.name.endsWith('_Float')?[0,1]:[0,1,2,3,4],grade.id+' '+layer.name+' must retain its original frame sequence');
  if(layer.name.endsWith('_Twinkle')){
   const repeated=grade.ambient.loop.flatMap(f=>chunks(f.particles)).filter(p=>p[0]===index);
   assert.deepEqual([...new Set(repeated.map(p=>p[11]))].sort(),[0,1,2,3,4],'Persistent twinkles also animate through every cell');
  }
 }
}
console.log('GRADE_AMBIENT_OK: original five-frame sprite animation, Float curve, uninterrupted 3.4s handover and 14/24/104s loop boundaries, retained glow, no repeated entrance flash.');
