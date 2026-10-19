const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('bar-playtest/src/features/outside/home-art.js','utf8'),{window});
const {cityCrop,paintCity}=window.LunaHomeArt;
for(const offset of [-100,-1.5,-.8,0,.8,1.5,100]){
 const c=cityCrop(offset);assert(c.x>=0&&c.x+c.w<=643);assert.equal(c.h,270);
}
assert(cityCrop(.8).x<cityCrop(-.8).x,'City follows camera more slowly than room');
assert.deepEqual(cityCrop(1,true),cityCrop(-1,true),'Reduced motion is fixed');
let calls=[];const ctx={drawImage:(...args)=>calls.push(args)},im={};
paintCity(ctx,im,0,0,643,270,-.8);paintCity(ctx,im,0,0,643,270,.8);
assert.deepEqual(calls[0].slice(5),calls[1].slice(5),'Window and terrace destination bounds never move');
assert.notEqual(calls[0][1],calls[1][1]);
console.log('PASS city depth: bounded source, subtle inverse camera motion, fixed room apertures, reduced motion');
