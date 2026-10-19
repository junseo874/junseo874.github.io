const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../data.js','utf8'),ctx);
const C=require('../src/core/core.js'),data=C.millilitreData(ctx.window.LUNA_DATA);
function story(coaster=true,glass='dry_martini'){
 const g=new C.Game(data);g.phase='regular';g.seats.R={actor:'tom',coaster,glass};
 g.story={scene:{id:'fade'},index:0,steps:[{type:'exit',actor:'tom'},{type:'say',actor:'luna','text.ko':'다음 손님을 기다리자.'}]};g.pump();return g;
}
const tick=(g,seconds)=>{for(let t=0;t<seconds-1e-8;t+=.1)g.tick(.1);};
for(const [coaster,glass]of [[true,'dry_martini'],[true,null],[false,'bottle_beer']]){
 const g=story(coaster,glass);assert(g.seats.R);assert(!g.tableFades.R);tick(g,.6);
 assert.equal(g.seats.R,null);assert.equal(g.tableFades.R.coaster,coaster);assert.equal(g.tableFades.R.glass,glass);assert.equal(g.story.index,0);
 const before=g.tableFades.R.elapsed;g.paused=true;tick(g,1);assert.equal(g.tableFades.R.elapsed,before);g.paused=false;
 tick(g,.4);assert(g.tableFades.R.elapsed>before);assert.equal(g.story.index,0);tick(g,.5);
 assert.equal(g.tableFades.R,undefined);assert.equal(g.story.index,1);assert.equal(g.dialogue.actor,'luna');
}
const empty=story(false,null);tick(empty,.6);assert.deepEqual(empty.tableFades,{});assert.equal(empty.story.index,1);
const g=new C.Game(data,{day:1});g.startGeneral();g.qaKeepGeneral=true;g.queueIndex=g.queue.length;
g.seats={L:null,M:null,R:{id:'test',actor:'tom',seat:'R',state:'EXITING',exitLeft:0,coaster:true,glass:'dry_martini',glassEmpty:true,glassKind:'cocktail',lines:[],lineIndex:0}};
g.tick(.1);assert.equal(g.seats.R,null);assert(g.tableFades.R);assert.equal(g.tableFades.R.baseline,548);assert.equal(g.tableFades.R.glassEmpty,true);
// An unfinished cleanup reserves the seat without retaining a guest/order.
g.seats.L={};g.seats.M={};g.queueIndex=0;const index=g.queueIndex;g.spawn();assert.equal(g.queueIndex,index);assert(g.spawnBlocked);
g.seats.L=null;g.seats.M=null;g.queueIndex=g.queue.length;g.qaKeepGeneral=false;g.tick(.2);assert.equal(g.phase,'general','Keep final table visible until its fade ends');tick(g,.8);assert.equal(g.phase,'regular');
g.reset(1,'regular',1,false);assert.deepEqual(g.tableFades,{});
console.log('PASS: story/general exit, coaster/glass/both fade, pause, no-items fast path, next-line timing, seat reservation, reset');
