const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const f of ['data/runtime/game-data.js','data/runtime/campaign-data.js','src/features/bar/bar-guest-art.js','src/features/bar/bar-views.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),W);
const {Game}=require('../src/core/core.js'),D=W.LUNA_DATA;
const steps=D.tables.steps.filter(r=>r.context==='campaign_d3_bar').sort((a,b)=>a.seq-b.seq);
assert.equal(steps.filter(r=>r.type==='say').length,91);
assert(!steps.some(r=>r.actor==='samho'&&['order','craft','serve','coaster','empty_glass'].includes(r.type)),'Latest day 3 contains no Samho drink');
assert(steps.filter(r=>r.type==='say'&&r.actor==='samho').every(r=>r.arg==='default'));
assert(!steps.some(r=>r.type==='expression'),'Use native say/arg, never a standalone expression command');
assert(steps.find(r=>r.effects?.includes('day3_sugar_received')));
const choice=D.tables.bar_choices.filter(r=>r.context==='ch_campaign_d3_bar_1');assert.equal(choice.length,2);assert(choice[1]['text.ko'].includes('어린아이'));
const g=new Game(D);g.reset(3,'regular',1);Object.assign(g,{screen:'bar',phase:'regular',overlay:null,tutorial:null,transition:0,cameraLeft:0,cameraMoving:false});
g.seats={L:{actor:'samho',seated:true,expression:'default',glass:'bottle_beer'},M:null,R:{actor:'tom',seated:true,expression:'default'}};
// The authored day no longer requests drunk; the reusable native expression still works.
g.story={scene:{id:'drunk-test'},steps:[{type:'empty_glass',actor:'samho'},{type:'say',actor:'samho',arg:'drunk','text.ko':'크.. 시원하네.'},{type:'say',actor:'tom',arg:'default','text.ko':'일어나 볼래?'}],index:0};
g.pump();assert.equal(g.seats.L.glassEmpty,true);assert.equal(g.seats.L.expression,'drunk');
const view=W.LunaBarViews({D,g,ui:{},L:k=>k,esc:String});
g.cameraLeft=0;g.cameraMoving=false;
assert(view.actorHTML(g.seats.L,50).includes('data-pose="drunk_talk"'));
g.dialogue.chars=g.dialogue.text.length;assert(view.actorHTML(g.seats.L,50).includes('data-pose="drunk_default"'));
g.advance();g.cameraLeft=0;g.cameraMoving=false;assert.equal(g.dialogue.actor,'tom');assert(view.actorHTML(g.seats.L,50).includes('data-pose="drunk_default"'));
g.story={scene:{id:'reset-expression'},steps:[{type:'say',actor:'samho',arg:'default','text.ko':'다시 기본 표정.'}],index:0};g.pump();g.cameraLeft=0;assert.equal(g.seats.L.expression,'default');assert(view.actorHTML(g.seats.L,50).includes('data-pose="idle_talk"'));
for(const variant of ['original','gpt'])for(const day of [0,1,2,3]){
 const game=new Game(D);game.reset(day,'regular',1,true,{variant});Object.assign(game,{phase:'regular',screen:'bar',dialogue:null,transition:0,cameraLeft:0,cameraMoving:false});
 const samho={actor:'samho',seated:true,expression:'default',glass:null};game.seats={L:samho,M:null,R:null};
 const v=W.LunaBarViews({D,g:game,ui:{},L:k=>k,esc:String});
 assert(v.actorHTML(samho,50).includes('data-pose="idle_default"'));
 samho.glass='bottle_beer';samho.state='DRINKING';
 for(const t of [0,.1,.6,1.3]){game.realTime=t;assert(v.actorHTML(samho,50).includes('data-pose="idle_default"'),'serving must not select a drinking/drunk pose');}
 game.dialogue=game.makeLine('samho','시원하네.');assert(v.actorHTML(samho,50).includes('data-pose="idle_talk"'));
 game.dialogue.chars=game.dialogue.text.length;assert(v.actorHTML(samho,50).includes('data-pose="idle_default"'));
}
console.log('DAY3_NOTION_SCRIPT_OK: latest story keeps Samho sober; native drunk pose still works, persists across speakers and resets with default.');
