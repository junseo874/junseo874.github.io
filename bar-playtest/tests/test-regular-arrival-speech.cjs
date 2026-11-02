const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const f of ['data/runtime/game-data.js','src/features/bar/bar-guest-art.js','src/features/bar/bar-views.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),W);
const {Game}=require('../src/core/core.js');
for(const variant of ['original','gpt'])for(const pair of [false,true]){
 const g=new Game(W.LUNA_DATA);g.reset(1,'regular',42,true,{variant});Object.assign(g,{phase:'regular',screen:'bar',dialogue:null,transition:0,pendingTransition:null,tutorial:null,overlay:null,cameraLeft:0,cameraMoving:false});g.seats={L:null,M:null,R:null};
 const entries=[{type:'enter',actor:'tom',arg:'L',sync:pair?'no_wait':'wait'},...(pair?[{type:'enter',actor:'chris',arg:'R',sync:'wait'}]:[])];
 g.story={scene:{id:'arrival-test'},steps:[...entries,{type:'say',actor:'tom','text.ko':'안녕하세요. 처음 왔는데 한 잔 부탁합니다.'},{type:'coaster',actor:'tom'},{type:'say',actor:'tom','text.ko':'고마워요.'}],index:0};
 g.pump();assert.equal(g.transition,1.65);assert.equal(g.currentDialogue(),null);assert.equal(g.advance(),false);
 const guest=g.seats.L,view=W.LunaBarViews({D:W.LUNA_DATA,g,ui:{},L:k=>k,esc:String});
 for(let i=0;i<8;i++){g.tick(.2);assert.equal(g.currentDialogue(),null);assert.equal(g.storyCoaster,null);assert(!view.actorHTML(guest,50).includes('data-talking="true"'));if(g.realTime-guest.arrivalAt>=.65)assert(view.actorHTML(guest,50).includes('opacity:1;'));}
 const before=g.realTime;g.paused=true;g.tick(.2);assert.equal(g.realTime,before);g.paused=false;
 g.tick(.051);assert(g.dialogue);assert.equal(g.dialogue.chars,0);assert.equal(g.storyCoaster,null);
 const html=view.actorHTML(guest,50);assert(html.includes('opacity:1;'));assert(html.includes('data-talking="true"'));
 g.tick(.08);assert(g.dialogue.chars>0);g.dialogue.chars=g.dialogue.text.length;g.advance();assert.equal(g.storyCoaster.seat,'L');
 // A seated scene has no entrance fade to wait for.
 g.storyCoaster=null;g.dialogue=null;g.seats={L:null,M:null,R:null};g.story={scene:{id:'seated-test'},steps:[{type:'enter',actor:'chris',arg:'R',entrance:'seated'},{type:'say',actor:'chris','text.ko':'이미 앉아 있었어.'}],index:0};g.pump();assert.equal(g.transition,0);assert(g.dialogue);assert.equal(g.seats.R.arrivalDuration,0);
}
console.log('REGULAR_ARRIVAL_SPEECH_OK: original/remix solo/pair, full fade before speech, pause, delayed first render, coaster timing and seated scenes.');
