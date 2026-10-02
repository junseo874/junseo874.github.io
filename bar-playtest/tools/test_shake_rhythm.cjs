const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=require('path').resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require(dir+'/core.js'),R=require(dir+'/remix.js'),M=require(dir+'/minigames.js'),S=require(dir+'/shake-rhythm.js');
function make(mode,variant){const g=new C.Game(C.millilitreData(ctx.window.LUNA_DATA));R.attach(g);M.attach(g);S.attach(g,()=>mode);g.startMinigame('shake',variant);return g;}
function step(g,t){for(let i=0;i<t-1e-9;i+=.01)g.tick(Math.min(.01,t-i));}
for(const mode of S.MODES.filter(mode=>mode!=='path'))for(const v of ['original','gpt']){
 const g=make(mode,v),s=g.gimmick;step(g,.3);assert(s.rhythm.clock>0);assert(!s.started);assert.equal(g.endGimmick(),false);
 g.gimmickInput('Space');assert.equal(s.attempts,0);
 step(g,1.8);g.gimmickInput('KeyD');assert.equal(s.message,'MISS');const frame=s.motionFrame;step(g,.3);assert.equal(s.motionFrame,frame);assert.equal(s.rhythm.combo,0);
 step(g,.3);g.gimmickInput('KeyD');assert.equal(s.message,'PERFECT');assert.equal(s.rhythm.combo,1);const clock=s.rhythm.clock;step(g,.15);assert(s.rhythm.clock>clock);
 g.paused=true;const before=JSON.stringify(s);step(g,1);g.gimmickInput('KeyA');assert.equal(JSON.stringify(s),before);g.paused=false;
 for(const note of s.rhythm.notes.filter(n=>!n.status)){step(g,(note.time-s.rhythm.trackTime)/S.noteSpeed(s.rhythm.tier));g.gimmickInput(note.lane?'KeyD':'KeyA');}
 assert.equal(s.attempts,20);assert.equal(s.success,19);assert.equal(s.rhythm.best,19);step(g,2);assert.equal(g.screen,'minigame_result');assert.equal(g.minigame.result.success,19);assert(Math.abs(g.minigame.result.score-1900/20)<1e-6);
 g.retryMinigame();assert.equal(g.gimmick.rhythm.mode,mode);assert.equal(g.gimmick.attempts,0);
}
let g=make('fall','original');g.gimmickInput('Space');step(g,16);assert.equal(g.screen,'minigame_result');assert.equal(g.minigame.result.score,0);
g=make('fall','original');let s=g.gimmick;g.gimmickInput('Space');g.gimmickInput('KeyA');assert.equal(s.rhythm.extraPresses,1);assert(!s.rhythm.playing);for(const n of s.rhythm.notes){step(g,(n.time-s.rhythm.trackTime)/S.noteSpeed(s.rhythm.tier));g.gimmickInput(n.lane?'KeyD':'KeyA');}step(g,1);assert(Math.abs(g.minigame.result.score-2000/21)<1e-9);
g.startMinigame('stir','original');assert(!g.gimmick.rhythm);assert.equal(g.gimmick.targetStacks,g.c('stir_target_stacks',10));g.startMinigame('stir','gpt');assert.equal(g.gimmick.targetStacks,8);
// Exercise the complete gin fizz queue, not just isolated mini-game results.
for(const mode of S.MODES.filter(mode=>mode!=='path'))for(const variant of ['original','gpt']){
 const g=make(mode,variant);g.reset(99,'practice',2,true,{variant});g.selectCocktail('gin_fizz');g.debugFill();g.startCraft();let guard=0;
 while(g.screen==='gimmick'&&guard++<30){const s=g.gimmick;if(s.fluid){require('./pour-test-driver.cjs')(g);continue;}assert(s.rhythm);g.gimmickInput('Space');for(const n of s.rhythm.notes){step(g,(n.time-s.rhythm.trackTime)/S.noteSpeed(s.rhythm.tier));g.gimmickInput(n.lane?'KeyD':'KeyA');}step(g,2);}
 assert.equal(g.screen,'result');assert.equal(g.craft.results.filter(r=>r.type==='shake').length,1);assert.equal(g.craft.results.find(r=>r.type==='shake').completion,1);assert.equal(g.error,null);
}
console.log('RHYTHM_CORE_OK: 2 chart modes x 2 rules, initial loop, miss stop, single-hit resume, pause, 20 notes, automatic misses, scoring, retry, stir isolation');
