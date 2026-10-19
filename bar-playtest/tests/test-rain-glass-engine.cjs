const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={};vm.createContext(scope);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/features/outside/effects/rain-glass-simulation.js'),'utf8'),scope);
const{Simulation,Motion,Random}=scope.LunaRainSimulation;
const quiet={spawnPerSecond:0,gravity:0,slideRadius:100,evaporation:0};
const s=new Simulation(quiet),a=s.newDrop(100,100,5),b=s.newDrop(107,100,4);a.age=b.age=1;s.drops.push(a,b);s.step(.01,0);
assert.equal(s.drops.length,1);assert(Math.abs(s.drops[0].radius**2-41)<1e-9);assert.equal(s.drops[0].mx,7);assert.equal(s.drops[0].mergeRemaining,1);
const frozen=JSON.stringify(s.drops);s.step(0,0);assert.equal(JSON.stringify(s.drops),frozen);s.step(.1,0);assert(s.drops[0].mergeRemaining<1);for(let i=0;i<5;i++)s.step(.1,0);assert.equal(s.drops[0].mergeRemaining,0);
const forming=new Simulation(quiet),d=forming.newDrop(240,135,3);d.mx=8;forming.drops.push(d);const start=forming.formation(d);forming.step(.1,0);assert(forming.formation(d)>start&&forming.formation(d)<1);forming.resize(4/3);assert.equal(forming.drops[0].mx,6);assert.equal(d.radius,3);
const moving=new Simulation({spawnPerSecond:0,pinVariation:0,meander:0,trailChance:0,evaporation:0}),flow=moving.newDrop(100,250,4.5),bead=moving.newDrop(300,250,1);flow.adhesionPause=.3;flow.adhesionTravel=30;moving.drops.push(flow,bead);for(let i=0;i<30;i++)moving.step(1/60,0,{x:0,y:0},true);assert(flow.y<250&&flow.vy<0);assert.equal(flow.adhesionPause,0);assert.equal(bead.y,250);
const wet=new Simulation();wet.prewarm();assert(wet.drops.length>80&&wet.drops.length<=650);for(let i=0;i<120;i++)wet.step(1/60,1,{x:-14,y:0},true);assert(wet.drops.some(d=>d.vy<-.1));assert(wet.drops.some(d=>d.vy===0));assert.equal(wet.upload().length,wet.drops.length*16);
const motion=new Motion();motion.sample(0,0,2.7,1/60);for(let i=0;i<60;i++)motion.sample(i%2*.001,0,2.7,1/60);assert(!motion.moving);for(let i=0;i<60;i++)motion.sample(i*.01,0,2.7,1/60);assert(motion.moving);motion.sample(80,0,2.7,1/60);assert(!motion.moving&&motion.vx===0&&motion.cuts===1);
// Known .NET Framework System.Random(1) values, not a new browser PRNG sequence.
const rng=new Random(1);assert(Math.abs(rng.next()-.24866858415709278)<1e-14);assert(Math.abs(rng.next()-.11074397718102856)<1e-14);
console.log('PASS engine rain simulation: seeded random, formation, area-preserving merge/relaxation, pause, pinned beads, moving drops, cut rejection');

// Long sessions must renew beads rather than feed mass into a full droplet pool.
for(const walking of [false,true]){
 const sim=new Simulation();sim.prewarm();let maxCoverage=0;const samples=[];
 for(let i=0;i<5400;i++){sim.step(1/30,1,{x:walking?-90:-14,y:0},walking);maxCoverage=Math.max(maxCoverage,sim.coverage());assert(sim.drops.length<=320);if([899,1799,5399].includes(i))samples.push({seconds:(i+1)/30,drops:sim.drops.length,coverage:sim.coverage()});}
 assert(maxCoverage<=.08+1e-9,'Conservative area budget includes stretched drops and raster padding');
 assert(sim.drops.some(d=>d.age<2)&&sim.drops.some(d=>d.age>10),'Old beads gradually make room for new rain');
 console.log('PASS 180 seconds of bounded rain',walking?'walking':'stationary',JSON.stringify(samples));
}
const full=new Simulation({maxDrops:1,spawnPerSecond:100,gravity:0,slideRadius:100,retireAfter:100});const pinned=full.newDrop(100,100,1);full.drops=[pinned];full.intensity=1;for(let i=0;i<150;i++)full.step(1/30,1);assert.equal(full.drops[0].radius,1,'Full pool must not keep enlarging existing beads');
