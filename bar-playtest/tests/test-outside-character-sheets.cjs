const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['data/runtime/outside-scene-data.js','src/features/outside/events/outside-ambient.js','src/shared/platform/interaction-glow.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
(async()=>{
 const A=W.LunaOutsideAmbient,D=W.LUNA_OUTSIDE_DATA;
 assert.equal(Object.keys(A.sheets).length,11);
 assert.equal(A.roleKinds.neighbor,'Neighbor');assert.equal(A.roleKinds.repair,'Repairman');
 assert.equal(A.roleKinds['day1-corridor-thug'],A.roleKinds.neighbor);
 assert.equal(A.roleKinds['day2-corridor-thug'],A.roleKinds.neighbor);
 assert.equal(A.roleKinds.chris,'Chris');
 const gang=['guard','boss','gangmate','gang-left','gang-far'].map(id=>A.roleKinds[id]);
 assert.equal(new Set(gang).size,5);assert.equal(A.roleKinds.boss,'Gang5');
 for(const actor of ['repair','guard','boss']){
  const target={id:'neighborhood-'+actor,actor,x:1,y:-.974};
  assert.equal(W.LunaInteractionGlow.region(target,null,A.sprite(A.roleKinds[actor]),1,-.974,{}).length,4,actor+' new sheet outline');
  assert.equal(W.LunaInteractionGlow.region(target,null,A.sprite('M2'),1,-.974,{}),null,'unrelated generic must not glow');
 }
 assert.equal(W.LunaInteractionGlow.region({id:'day2-thug-information',x:1,y:10},null,A.sprite('Neighbor'),1,9.726,{}).length,4,'neighbor information outline uses actual floor');
 for(const [kind,sheet]of Object.entries(A.sheets)){
  const asset=D.assets['ambient-'+kind],{data,info}=await sharp(path.join(root,asset.src)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,129*sheet.frames,kind+' complete sheet');assert.equal(info.height,138);
  for(let frame=0;frame<sheet.frames;frame++){
   let bottom=0,pixels=0;
   for(let y=0;y<138;y++)for(let x=0;x<129;x++)if(data[(y*info.width+frame*129+x)*4+3]>20){bottom=y+1;pixels++;}
   assert(pixels>100,kind+' nonempty cell '+frame);assert.equal(bottom,114,kind+' grounded sole '+frame);
  }
  for(const fps of [12,18]){
   D.animations.idle.fps=fps;const cycle=D.animations.idle.frames.length/fps;
   for(let frame=0;frame<sheet.frames*3;frame++){
    const time=(frame+.25)*cycle/sheet.frames,sp=A.sprite(kind,time);
    assert.equal(sp.x,(frame%sheet.frames)*129,kind+' all frames and wrap');assert.equal(sp.y,0);
    assert.equal((1-sp.pivot.y)*sp.h,114,kind+' pivot matches soles');
    assert.equal(A.sprite(kind,time).x,sp.x,kind+' paused clock');
   }
   assert.equal(A.sprite(kind,cycle*.999).x,(sheet.frames-1)*129);
   assert.equal(A.sprite(kind,cycle*1.001).x,0,kind+' shares Luna loop');
  }
 }
 console.log('OUTSIDE_CHARACTER_SHEETS_OK: 11 sheets, source dimensions, every frame, grounded soles, role mapping, loop timing and pauses');
})().catch(e=>{console.error(e);process.exitCode=1;});
