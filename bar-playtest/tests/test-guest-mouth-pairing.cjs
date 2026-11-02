// Mouth numbers must be visual identities, not merely similarly named files.
const assert=require('node:assert/strict'),path=require('node:path');
const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
const D=require('../data/presentation/runtime-assets.json');
(async()=>{
 for(const gender of ['m','f'])for(const n of [1,2,3]){
  const a=D.assets[`guest_${gender}_mouth_${n}`],b=D.assets[`guest_${gender}_talk_mouth_${n}`];
  const still=await sharp(path.resolve(__dirname,'..',a.src)).ensureAlpha().raw().toBuffer();
  const last=await sharp(path.resolve(__dirname,'..',b.src)).extract({left:3*551,top:0,width:551,height:530}).ensureAlpha().raw().toBuffer();
  // Male original static mouths are one source pixel above the talk-sheet mouth.
  const offset=gender==='m'?551*4:0;let pixels=0;
  for(let i=0;i<still.length;i+=4)if(still[i+3]){
   assert.deepEqual(still.subarray(i,i+4),last.subarray(i+offset,i+offset+4),`${gender} mouth ${n} pixel ${i/4}`);pixels++;
  }
  assert(pixels>0);
 }
 console.log('GUEST_MOUTH_PAIRING_OK: all six static mouths exactly match corresponding talk final-frame pixels (male source Y +1).');
})().catch(e=>{console.error(e);process.exitCode=1;});
