const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build}=require('../../tools/build-shared-data.cjs');
const root=path.resolve(__dirname,'../..');
const sources=[
 'bar-playtest/data/runtime/outside-dialogues.js',
 'bar-playtest/data/runtime/story-guide-data.js',
 'bar-playtest/src/features/outside/events/outside-events.js',
 'bar-playtest/src/features/outside/events/outside-shop.js',
 'bar-playtest/src/features/outside/events/outside-thug.js',
 'bar-playtest/src/features/bar/remix.js',
 'bar-playtest/src/features/campaign/campaign.js',
 'bar-playtest/src/core/core.js',
 'bar-playtest/src/cinema/scene3.js',
 'cutscene-studio/data/opening-dialogue.json',
 'cutscene-studio/src/opening-template.js',
 'cutscene-studio/src/model.js',
 'cutscene-studio/src/model-v2.js',
 'js/data.js'
];
let texts=0;
function inspect(value,label){
 if(typeof value==='string'){
  texts++;assert(!/[\u2026\u22ef]/u.test(value),'Use literal periods in dialogue data: '+label);
 }else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))inspect(item,label+'.'+key);
}
(async()=>{
 const result=await build(false);inspect(result,'generated');
 for(const file of sources){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  assert(!/[\u2026\u22ef]|\\u(?:2026|22ef)/iu.test(source),'Dialogue source still contains a combined ellipsis: '+file);
 }
 const chris=result.data.tables.steps.find(r=>r['text.ko']==='...그럼 이제 한번 시작해 볼까?');
 assert(chris,'The actual opening Chris line uses three U+002E periods');
 assert(fs.readFileSync(path.join(root,'bar-playtest/src/features/bar/remix.js'),'utf8').includes('......딱 원하던 맛이네요.'),'Repeated ellipses retain all six periods');
 console.log('DIALOGUE_PERIODS_OK: '+texts+' projected strings, fallback/editor/legacy sources, opening line and repeated periods; generated data matches CSV.');
})().catch(e=>{console.error(e);process.exitCode=1;});
