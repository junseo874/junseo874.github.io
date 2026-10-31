const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
const menu=()=>({options:[{id:'cancel',label:'취소'}]});
for(const name of ['LunaHomeInteractions','LunaOutsideNeighborhood','LunaOutsideQA','LunaOutsideBeggar','LunaOutsideNotion','LunaOutsideShop','LunaOutsideThug'])W[name]={choiceView:menu,faceConversation(){},anchor(){return null;}};
W.LunaOutsideContent={events:[]};
vm.runInNewContext(fs.readFileSync(root+'/src/shared/dialogue/dialogue-rhythm.js','utf8'),W);
vm.runInNewContext(fs.readFileSync(root+'/src/features/outside/events/outside-story.js','utf8'),W);
const model={x:1,y:2,updateNear(){}},target={x:4,y:5};model.story=new W.LunaOutsideStory.Story(model);
for(const type of ['home-choice','neighborhood-choice','qa-choice','beggar-choice','notion-choice','thug-choice','shop-choice']){
 const s=model.story,choice={type,actor:'shiba',text:''};
 s.beginRows(type,target,[{type:'say',actor:'luna',text:'이전 대사',emphasis:[{start:0,end:2}]},choice]);
 s.speech.elapsed=99;const before=s.view();s.advance();const after=s.view();
 assert(after.choice);assert.equal(after.full,before.full);assert.equal(after.title,before.title);assert.deepEqual(after.anchor,before.anchor);assert.deepEqual(after.emphasis,before.emphasis);
 assert.equal(s.speech.line,choice,'choice metadata stays intact');
 s.beginRows('fresh',target,[choice]);assert.equal(s.view().full,'','new interaction never inherits stale speech');assert(s.view().purchase.options.length);
 s.beginRows('explicit',target,[{type:'say',actor:'luna',text:'이전 대사'},{...choice,text:'새 질문'}]);s.speech.elapsed=99;s.advance();assert.equal(s.view().full,'새 질문');
}
const C=require(root+'/src/core/core.js'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(root+'/data/runtime/game-data.js','utf8'),ctx);
const g=new C.Game(ctx.window.LUNA_DATA);g.reset(99,'regular',1,false);g.cameraLeft=0;g.transition=0;g.cameraMoving=false;g.dialogue=null;g.choice={rows:[]};
const line=g.makeLine('luna','바 대사');line.chars=line.text.length;g.lastStoryLine=line;assert.equal(g.currentDialogue(),null,'bar choices do not retain the preceding line');
g.lastStoryLine=null;assert.equal(g.currentDialogue(),null);g.choice=null;assert.equal(g.currentDialogue(),null);
g.dialogue=line;assert.equal(g.currentDialogue(),line,'ordinary bar dialogue is unchanged');
console.log('CHOICE_SPEECH_OK: all seven exterior choice types retain speech; bar choices do not');
