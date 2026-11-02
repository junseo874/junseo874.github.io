const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {snapshot,save}=require('../../tools/dialogue-editor-storage.cjs');
const {Model}=require('../src/dev/dialogue-editor/outside-model.js');
(async()=>{
 const source=await snapshot(),m=await new Model(source.files,source.presentation).init();
 assert(!m.visibleFlows().some(f=>f.id==='newspaper/options'||f.id==='newspaper/common'||f.id==='choices/stock'));
 assert(m.sequence('newspaper/right').length>m.rows('newspaper/right').length);
 const question=m.rows('newspaper/intro').at(-1);m.checkpoint();m.addMenuOption(question);m.setMenuField(question,2,'text.ko','새로운 답변');m.setMenuField(question,2,'route','native:newspaper-right');
 const cfg=m.menuConfig(question),removed=cfg.active[0];m.removeMenuOption(question,removed);m.moveMenuOption(question,cfg.active.at(-1),-1);assert.equal(m.menu(question)[0].label,'새로운 답변');m.undo();assert.equal(m.menu(m.row(question.row_id)).length,2);m.redo();
 const menu=m.addMenu('believer/intro',1),branch=m.addOptionBranch(menu,0);m.set(m.rows(branch.id)[0],'text.ko','선택 후 새 분기');m.addMenuOption(menu);m.setMenuField(menu,1,'route','end');
 assert.deepEqual((await m.validate()).errors,[]);
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'outside-choices-')),base=path.join(tmp,'csv'),runtime=path.join(tmp,'runtime');await fs.cp(path.join(__dirname,'../data/shared-csv'),base,{recursive:true});await fs.mkdir(runtime);for(const name of ['game-data.js','campaign-data.js'])await fs.copyFile(path.join(__dirname,'../data/runtime',name),path.join(runtime,name));
 await save({mode:'outside',revision:source.revision,files:m.output()},{base,runtime,backupRoot:path.join(tmp,'backups')});
 const saved=await snapshot(base),loaded=await new Model(saved.files,saved.presentation).init();assert.deepEqual((await loaded.validate()).errors,[]);assert.equal(loaded.menu(loaded.rows('newspaper/intro').at(-1))[0].label,'새로운 답변');
 const W={LunaRuleParts:{conditions:require('../src/core/story-conditions.js')},barGame:{progress:{money:1000,flags:{},affinity:{}}},LunaOutsideContent:{events:[]},LunaOutsideNewspaper:{choiceView:()=>({options:[{id:'newspaper-wrong',label:'old wrong'},{id:'newspaper-right',label:'old right'}]}),choose:(model,id)=>{model.answer=id;return true;}}};const context={window:W,globalThis:W};vm.createContext(context);
 for(const file of [path.join(runtime,'game-data.js'),path.join(__dirname,'../src/shared/dialogue/dialogue-rhythm.js'),path.join(__dirname,'../src/features/outside/events/outside-authoring.js'),path.join(__dirname,'../src/features/outside/events/outside-story.js')])vm.runInContext(await fs.readFile(file,'utf8'),context);
 const model={config:{day:1},x:0,y:0,updateNear(){}};model.story=new W.LunaOutsideStory.Story(model);const story=model.story;
 story.beginRows('newspaper',{x:1,y:0},[W.LUNA_DATA.sharedStory['newspaper/intro'].at(-1)]);assert.equal(story.choose('newspaper-wrong'),false,'deleted options cannot dispatch');const view=story.view();assert.equal(view.purchase.options[0].label,'새로운 답변');assert(story.choose(view.purchase.options[0].id));assert.equal(model.answer,'newspaper-right');
 let completed=0;story.beginRows('believer',{x:1,y:0},W.LUNA_DATA.sharedStory['believer/intro'],false,()=>completed++);story.speech.index=1;story.seek();assert(story.speech.choice);const generic=story.view();assert.equal(generic.purchase.options.length,2);assert(story.choose(generic.purchase.options[0].id));assert.equal(story.speech.line.text,'선택 후 새 분기');assert.equal(completed,0);story.speech.elapsed=1e6;story.advance();assert.equal(story.speech.line.text,W.LUNA_DATA.sharedStory['believer/intro'][2].text,'branch returns to original continuation');
 // A saved custom menu can be deleted later, with its generated descendants only.
 loaded.remove('believer/intro',menu.row_id);assert(!loaded.row(menu.row_id));assert(!loaded.flow(branch.id));assert.deepEqual((await loaded.validate()).errors,[]);await save({mode:'outside',revision:saved.revision,files:loaded.output()},{base,runtime,backupRoot:path.join(tmp,'backups')});
 // Dynamic stock prompts and options migrate to the same existing CSV formats.
 const stock=m.rows('choices/stock')[0];m.set(stock,'text.ko','편집한 상점 안내');m.addMenuOption(stock);assert.equal(m.step(stock)['text.ko'],'편집한 상점 안내');assert.deepEqual((await m.validate()).errors,[]);
 assert.equal((await snapshot()).revision,source.revision);
 console.log('OUTSIDE_CHOICE_AUTHORING_OK merged flows, add/delete/order/undo, CSV round-trip, native dispatch guard, new branch and continuation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
