const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
global.window=global;require('../data/presentation/barrel-fire.js');const d=LUNA_BARREL_FIRE,game=path.resolve(__dirname,'..'),engine=path.resolve(game,'../../Human-Bartender/HumanBartender');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(d.props._Anim_Fps,16);assert.equal(d.props._Pixel_Size,.01);assert.equal(d.fire.order,-1);assert.equal(d.front.order,0);assert.equal(d.front.sortingLayer,d.fire.sortingLayer);
assert.deepEqual([d.back.sprite.w,d.back.sprite.h],[2218,207]);assert.deepEqual([d.front.sprite.w,d.front.sprite.h],[21,28]);
assert.equal(d.constants.hotGain,10);assert.equal(d.constants.warmGain,.5);assert.equal(d.props._Tex_D_speedY,1.5);assert.equal(d.props._Tex_D_02_speedY,2.5);
for(const a of Object.values(d.assets))assert.equal(hash(fs.readFileSync(path.join(game,a.src))),a.sha256,a.src);
(async()=>{
 const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
 // Verify originals when the source checkout is available; CI only needs the snapshot.
 if(fs.existsSync(engine)){
  for(const [f,v]of Object.entries(d.sources))assert.equal(hash(fs.readFileSync(path.join(engine,f))),v.sha256,'engine snapshot changed: '+f);
  for(const a of Object.values(d.assets)){
   const source=path.join(engine,a.source),dest=path.join(game,a.src);
   if(/\.png$/i.test(source))assert.deepEqual(fs.readFileSync(source),fs.readFileSync(dest),'original PNG bytes');
   else{
    const b=fs.readFileSync(source),w=b.readUInt16LE(12),h=b.readUInt16LE(14),actual=await sharp(dest).removeAlpha().raw().toBuffer();assert.equal(actual.length,w*h*3);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=18+b[0]+((b[17]&32?y:h-1-y)*w+x)*3,i=(y*w+x)*3;assert.equal(actual[i],b[src+2]);assert.equal(actual[i+1],b[src+1]);assert.equal(actual[i+2],b[src]);}
   }
  }
 }
 console.log('ENGINE_BARREL_FIRE_OK original PNG bytes, lossless TGA RGB/orientation, current source hashes, scene sorting, 16fps/100PPU and graph material parameters');
})().catch(e=>{console.error(e);process.exitCode=1;});
