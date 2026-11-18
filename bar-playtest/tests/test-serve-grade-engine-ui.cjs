/* Compare actual Unity-rendered reference frames, not screenshots blessed from
 * this web implementation. Different GPU backends can quantize edge pixels and
 * sin-based sparkle hashes differently; the complete composition must agree. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const folder=path.join(__dirname,'fixtures/grade-engine'),reference=JSON.parse(fs.readFileSync(path.join(folder,'reference.json'))),b=await load('playwright').chromium.launch({executablePath:chrome,headless:true});
 try{
  const p=await b.newPage();await p.route('**/grade-qa.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><base href="/bar-playtest/">'}));
  await p.goto('http://127.0.0.1:8123/bar-playtest/grade-qa.html');
  for(const src of ['data/runtime/serve-grade-reveal.js','src/features/crafting/serve-grade-engine.js','src/features/crafting/serve-grade.js'])await p.addScriptTag({url:'http://127.0.0.1:8123/bar-playtest/'+src});
  assert.deepEqual(await p.evaluate(()=>LUNA_SERVE_GRADE_REVEAL.sourceHashes),reference.sourceHashes,'References must correspond to the imported Unity source');
  const frames=await p.evaluate(async indices=>{
   const images=new Map(),white=document.createElement('canvas');white.width=white.height=1;white.getContext('2d').fillStyle='#fff';white.getContext('2d').fillRect(0,0,1,1);images.set('white',white);
   for(const g of LUNA_SERVE_GRADE_REVEAL.grades)for(const src of [g.image,...g.layers.map(l=>l.texture).filter(Boolean)])if(!images.has(src)){const i=new Image();i.src=src;await i.decode();images.set(src,i);}
   const c=document.createElement('canvas');c.width=1280;c.height=720;const renderer=LunaGradeEngine.create(),out=[];
   for(const g of LUNA_SERVE_GRADE_REVEAL.grades)for(const frame of indices){
    const sample=frame<204?g.frames[frame]:LunaServeGrade.ambientAt(frame/60,g.id);
    for(const spriteOnly of [false,true]){
     const particles=[];for(let i=0;i<sample.particles.length;i+=12)if(!spriteOnly||g.layers[sample.particles[i]].sheet.enabled)particles.push(...sample.particles.slice(i,i+12));
     renderer.draw(c,g,{particles},LunaServeGrade.motionAt(frame/60,g.id),spriteOnly?null:images.get(g.image),frame/60,null,null,images);out.push({name:g.id+'-'+frame+(spriteOnly?'-sprites':''),spriteOnly,png:c.toDataURL().split(',')[1]});
    }
   }
   renderer.dispose();return out;
  },reference.frames);
  let largest=0,spriteError=0,spriteLight=0;const spriteGrades=new Map();
  for(const frame of frames){
   const sharp=load('sharp'),region={left:0,top:0,width:1280,height:240};
   const actual=await sharp(Buffer.from(frame.png,'base64')).extract(region).removeAlpha().raw().toBuffer();
   const expected=await sharp(path.join(folder,frame.name+'.png')).extract(region).removeAlpha().raw().toBuffer();
   let error=0;for(let i=0;i<actual.length;i++)error+=Math.abs(actual[i]-expected[i]);const mae=error/actual.length;largest=Math.max(largest,mae);
   assert(mae<2.5,frame.name+': Unity/web RGB difference '+mae+' exceeds 1% of the display range in the full effect region');
   // A whole-screen average hid the missing sprite animation. Evaluate isolated
   // sprites against their emitted light, so empty pixels cannot dilute error.
   if(frame.spriteOnly){const light=expected.reduce((a,b)=>a+b,0),grade=frame.name.split('-')[0],sum=spriteGrades.get(grade)||[0,0];spriteError+=error;spriteLight+=light;sum[0]+=error;sum[1]+=light;spriteGrades.set(grade,sum);}
  }
  assert(spriteLight>10000,'Native reference must contain visible sprite animation');
  for(const [grade,[error,light]]of spriteGrades)assert(light>0&&error/light<.03,grade+' isolated sprite mismatch: '+error/light);
  console.log('UNITY_GRADE_MATCH_OK: '+frames.length+' actual engine reference frames; largest RGB error '+largest.toFixed(3)+'/255; isolated sprite error '+(spriteError/spriteLight*100).toFixed(2)+'%.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
