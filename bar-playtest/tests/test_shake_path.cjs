const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=require('path').resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data/runtime/game-data.js','utf8'),ctx);
const C=require(dir+'/src/core/core.js'),R=require(dir+'/src/features/bar/remix.js'),M=require(dir+'/src/features/crafting/minigames.js'),S=require(dir+'/src/features/crafting/shake-rhythm.js');
assert.deepEqual(S.MODES,['path','fall','cross']);assert.equal(S.normalizeMode('drum'),'path');
for(const value of [undefined,null,'','invalid'])assert.equal(S.normalizeMode(value),'path');
const defaultState={targetStacks:20};S.init(defaultState);assert.equal(defaultState.rhythm.mode,'path');
function make(variant){const g=new C.Game(C.millilitreData(ctx.window.LUNA_DATA));R.attach(g);M.attach(g);S.attach(g,()=> 'path');g.startMinigame('shake',variant);return g;}
function seek(g,match){for(let i=0;i<6000;i++){g.tick(.005);const n=C.MIX.nearest(g.gimmick);if(match(n))return n;}throw Error('No route target');}
// The unwrapped core uses the same consume/rearm rules as the rhythm view.
const raw={type:'shake',elapsed:0,targetStacks:20,attempts:0,success:0,failures:0,outcomes:[]};C.MIX.init(raw);
assert(C.MIX.shakeHit(raw));assert.equal(C.MIX.shakeHit(raw),false);
raw.elapsed=.6;C.MIX.updatePath(raw,()=>0);assert.deepEqual(raw.pathFixedHits,[]);
raw.elapsed=6.1;C.MIX.updatePath(raw,()=>0);assert(C.MIX.shakeHit(raw));assert.equal(raw.success,2);
for(const variant of ['original','gpt']){
 const burst=make(variant);burst.gimmickInput('Space');for(let i=0;i<20;i++)burst.gimmickInput(i%2?'MouseLeft':'Space');
 assert.equal(burst.gimmick.success,1);assert.equal(burst.gimmick.failures,19);assert(burst.gimmick.completed);
 // Repeated presses within one fixed-node visit must not earn extra hits.
 const spam=make(variant),ss=spam.gimmick;spam.gimmickInput('Space');spam.gimmickInput('Space');
 assert.equal(ss.success,1);assert.equal(C.MIX.nearest(ss),null);
 spam.tick(.035);spam.gimmickInput('MouseLeft');spam.tick(.035);spam.gimmickInput('Space');
 assert.equal(ss.success,1);assert.equal(ss.failures,2);assert.deepEqual(ss.pathFixedHits,['fixed:0']);
 seek(spam,n=>n?.id==='fixed:0');assert(ss.rhythm.trackTime>5);
 spam.gimmickInput('Space');assert.equal(ss.success,2,'Returning to the same node rearms it');
 spam.retryMinigame();assert.deepEqual(spam.gimmick.pathFixedHits,[],'Retry clears consumed nodes');
 const g=make(variant),s=g.gimmick;g.tick(.2);assert(s.rhythm.clock>0);assert(!s.started);
 assert.equal(g.gimmickInput('KeyA'),false);g.gimmickInput('Space');assert.equal(s.attempts,0);
 seek(g,n=>n&&!n.fixed);const node=C.MIX.nearest(s);assert(s.nodes.some(n=>n.id===node.id));g.gimmickInput('MouseLeft');assert.equal(s.success,1);assert(!s.nodes.some(n=>n.id===node.id));
 for(let i=1;i<10;i++){seek(g,n=>!n);seek(g,n=>n);const before=[...s.pathPoint];g.gimmickInput('Space');assert.deepEqual(s.pathPoint,before);if(i===4)assert.equal(s.rhythm.tier,undefined);}
 assert.equal(s.success,10);assert.equal(s.rhythm.tier,undefined);
 let track=s.rhythm.trackTime,real=s.elapsed;g.tick(.1);assert(Math.abs(s.rhythm.trackTime-track-.1)<1e-8);assert(Math.abs(s.elapsed-real-.1)<1e-8);
 seek(g,n=>!n);g.gimmickInput('Space');assert.equal(s.message,'MISS');assert.equal(s.rhythm.tier,undefined);const clock=s.rhythm.clock;g.tick(.1);assert.equal(s.rhythm.clock,clock);
 seek(g,n=>n);g.gimmickInput('MouseLeft');g.tick(.1);assert(s.rhythm.clock>clock);assert.equal(s.rhythm.combo,undefined);
 g.paused=true;const paused=JSON.stringify(s);g.tick(.2);g.gimmickInput('Space');assert.equal(JSON.stringify(s),paused);g.paused=false;
 while(!s.completed){seek(g,n=>!n);seek(g,n=>n);g.gimmickInput('Space');}
 assert.equal(s.attempts,20);assert.equal(s.success,19);assert.equal(s.rhythm.notes.filter(n=>n.status).length,20);
 for(let i=0;i<40;i++)g.tick(.05);assert.equal(g.screen,'minigame_result');assert.equal(g.minigame.result.score,95);
 g.retryMinigame();assert.equal(g.gimmick.rhythm.mode,'path');assert.equal(g.gimmick.attempts,0);assert.equal(g.gimmick.nodes.length,0);
 // Unattended movement keeps the original generated patterns and does not consume attempts.
 const fresh=g.gimmick;g.gimmickInput('Space');for(let i=0;i<800;i++)g.tick(.01);assert.equal(fresh.attempts,0);assert(fresh.patternTurn>=2);assert(fresh.nodes.length>0);
 const original={...fresh,nodes:[],patternTurn:-1,patternIndex:-1,elapsed:fresh.rhythm.trackTime};C.MIX.updatePath(original,()=>0);assert.deepEqual(fresh.pathPoint,original.pathPoint);
 g.startMinigame('stir',variant);assert(!g.gimmick.rhythm);
}
console.log('PATH_OK: original route/generator, click+Space, generated target consumption, 20 attempts, fixed speed, pause, miss/resume, retry, stir isolation');
