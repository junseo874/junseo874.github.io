const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=require('path').resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require(dir+'/core.js'),R=require(dir+'/remix.js'),M=require(dir+'/minigames.js'),S=require(dir+'/shake-rhythm.js');
assert.deepEqual(S.MODES,['fall','path','cross']);assert.equal(S.normalizeMode('drum'),'path');
function make(variant){const g=new C.Game(C.millilitreData(ctx.window.LUNA_DATA));R.attach(g);M.attach(g);S.attach(g,()=> 'path');g.startMinigame('shake',variant);return g;}
function seek(g,match){for(let i=0;i<6000;i++){g.tick(.005);const n=C.MIX.nearest(g.gimmick);if(match(n))return n;}throw Error('No route target');}
for(const variant of ['original','gpt']){
 const g=make(variant),s=g.gimmick;g.tick(.2);assert(s.rhythm.clock>0);assert(!s.started);
 assert.equal(g.gimmickInput('KeyA'),false);g.gimmickInput('Space');assert.equal(s.attempts,0);
 seek(g,n=>n&&!n.fixed);const node=C.MIX.nearest(s);assert(s.nodes.some(n=>n.id===node.id));g.gimmickInput('MouseLeft');assert.equal(s.success,1);assert(!s.nodes.some(n=>n.id===node.id));
 for(let i=1;i<10;i++){seek(g,n=>!n);seek(g,n=>n);const before=[...s.pathPoint];g.gimmickInput('Space');assert.deepEqual(s.pathPoint,before);if(i===4)assert.equal(s.rhythm.tier,1);}
 assert.equal(s.rhythm.combo,10);assert.equal(s.rhythm.tier,2);
 let track=s.rhythm.trackTime,real=s.elapsed;g.tick(.1);assert(Math.abs(s.rhythm.trackTime-track-.15)<1e-8);assert(Math.abs(s.elapsed-real-.1)<1e-8);
 seek(g,n=>!n);g.gimmickInput('Space');assert.equal(s.message,'MISS');assert.equal(s.rhythm.tier,0);const clock=s.rhythm.clock;g.tick(.1);assert.equal(s.rhythm.clock,clock);
 seek(g,n=>n);g.gimmickInput('MouseLeft');g.tick(.1);assert(s.rhythm.clock>clock);assert.equal(s.rhythm.combo,1);
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
console.log('PATH_OK: original route/generator, click+Space, generated target consumption, 20 attempts, tier speed, pause, miss/resume, retry, stir isolation');
