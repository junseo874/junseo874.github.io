const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const f of ['data/runtime/game-data.js','data/runtime/campaign-data.js','src/features/bar/bar-guest-art.js','src/features/bar/bar-views.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),W);
const {Game}=require('../src/core/core.js'),D=W.LUNA_DATA;
const steps=D.tables.steps.filter(r=>r.context==='campaign_d3_bar').sort((a,b)=>a.seq-b.seq);
assert.equal(steps.filter(r=>r.type==='say').length,96);
for(const text of ['고마워, 루나. 진심으로.','그렇게 힘들지는 않았어요.','...기억해 두겠습니다.','고민? 무슨 고민?','뭐? 무슨 소리야 그건?','크.. 시원하네.'])assert(steps.some(r=>r['text.ko']===text),text);
const empty=steps.findIndex(r=>r.type==='empty_glass'&&r.actor==='samho');
assert.equal(steps[empty-1]['text.ko'],'여기 있어요.');assert.equal(steps[empty+1].type,'expression');assert.equal(steps[empty+1].arg,'drunk');assert.equal(steps[empty+2]['text.ko'],'크.. 시원하네.');
assert.equal(steps.find(r=>r.row_id==='kihyun_campaign_d3_bar_66').actor,'samho');
assert(steps.find(r=>r.row_id==='kihyun_campaign_d3_bar_9').effects.includes('day3_sugar_received'));
const choice=D.tables.bar_choices.filter(r=>r.context==='ch_campaign_d3_bar_1');assert.equal(choice.length,2);assert(choice[1]['text.ko'].includes('어린아이'));
const g=new Game(D);g.reset(3,'regular',1);Object.assign(g,{screen:'bar',phase:'regular',overlay:null,tutorial:null,transition:0,cameraLeft:0,cameraMoving:false});
g.seats={L:{actor:'samho',seated:true,expression:'default',glass:'bottle_beer'},M:null,R:{actor:'tom',seated:true,expression:'default'}};
g.story={scene:{id:'drunk-test'},steps:steps.slice(empty,empty+3).concat([{type:'say',actor:'tom',arg:'default','text.ko':'많이 마시지는 마.'}]),index:0};
g.pump();assert.equal(g.seats.L.glassEmpty,true);assert.equal(g.seats.L.expression,'drunk');
const view=W.LunaBarViews({D,g,ui:{},L:k=>k,esc:String});
g.cameraLeft=0;g.cameraMoving=false;
assert(view.actorHTML(g.seats.L,50).includes('data-pose="drunk_talk"'));
g.dialogue.chars=g.dialogue.text.length;assert(view.actorHTML(g.seats.L,50).includes('data-pose="drunk_default"'));
g.advance();g.cameraLeft=0;g.cameraMoving=false;assert.equal(g.dialogue.actor,'tom');assert(view.actorHTML(g.seats.L,50).includes('data-pose="drunk_default"'));
g.story={scene:{id:'reset-expression'},steps:[{type:'expression',actor:'samho',arg:'default'},{type:'say',actor:'samho',arg:'default','text.ko':'다시 기본 표정.'}],index:0};g.pump();g.cameraLeft=0;assert.equal(g.seats.L.expression,'default');assert(view.actorHTML(g.seats.L,50).includes('data-pose="idle_talk"'));
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
console.log('DAY3_NOTION_SCRIPT_OK: authored drunk cue persists; serving alone keeps normal idle/talk across all days and variants.');
