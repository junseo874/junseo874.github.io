const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const csv=require('../src/shared/data/csv-catalog.js');
const {csv:encode}=require('../../tools/lib/csv-catalog-writer.cjs');
const {project}=require('../../tools/lib/shared-data-views.cjs');
const base=path.resolve(__dirname,'../data/shared-csv'),files={};
for(const[k,p]of Object.entries(csv.metadata))files[k+'.csv']=fs.readFileSync(path.join(base,p),'utf8');
for(const t of csv.parseRows(files['_Tables.csv']))files[t.table+'.csv']=fs.readFileSync(path.join(base,t.path),'utf8');
const views=JSON.parse(fs.readFileSync(path.join(base,'web-views.json'),'utf8'));
const ref=views.campaign.bar['1'],rows=csv.parseCsv(files['Steps.csv']),headers=rows[0];
const original=new csv.Catalog(files),scene=original.read(ref.source).scenes.find(s=>s.id===ref.scene);
// Legacy timeline registrations are not the live Studio/campaign cutscene list.
// Preserve the engine opening call, all protected finished/serve entries and posters.
const cutscenes=original.rawTables.get('Cutscenes'),cutsceneIds=new Set(cutscenes.map(r=>r.id));
assert.deepEqual([...cutsceneIds].sort(),[
 'tl_finished_cosmo','tl_finished_martini','tl_finished_ginfizz','tl_finished_kahlua',
 'tl_serve_cosmo','tl_serve_martini','tl_serve_ginfizz','tl_serve_kahlua','tl_serve_unknown',
 'sp_parttime_poster','sp_experiment_poster','tl_intro'
].sort(),'Keep the live engine opening registration as well as protected entries');
assert.equal(cutscenes.find(r=>r.id==='tl_intro').resource_key,'INTRO');
for(const row of original.rawTables.get('Steps')){
 // The day-zero programme is dispatched by the existing engine TV binding.
 if(row.type==='timeline'&&row.arg&&row.arg!=='\\N'&&row.arg!=='tv_news_d0')assert(cutsceneIds.has(row.arg),'Catalog timeline reference must still resolve: '+row.row_id);
}
const home=original.read('script/home'),tv=home.scenes.find(s=>s.id==='home_tv_cutscene');
assert.equal(tv.steps.length,1,'TV never autoplays a timeline before a choice');
assert.equal(tv.steps[0].type,'choice');
const watch=tv.steps[0].options.find(o=>o.id==='home_tv_day0_watch');
const leave=tv.steps[0].options.find(o=>o.id==='home_tv_day0_leave');
assert.equal(watch.text.ko,'본다');assert.equal(leave.text.ko,'취소');
assert.equal(watch.lock_reason.ko,'볼만한 방송이 없습니다.');
const {condition}=require('../src/core/story-conditions.js')({GRADES:[],n:Number,root:{}});
for(const day of [0,1,2,3])for(const seen of [false,true]){
 const context={day,flags:{tv_news_d0_seen:seen}};
 assert(condition(tv.steps[0].when,context),'TV choice available irrespective of seen flag');
 assert.equal(condition(watch.when,context),day===0,'Only the day-zero documentary is watchable');
 assert(condition(leave.when,context),'Cancel stays available');
}
assert.deepEqual(watch.result_steps.filter(r=>r.type==='timeline').map(r=>r.arg),['tv_news_d0']);
assert.equal(watch.result_steps[0].effects,'flag.tv_news_d0_seen = true');
assert(!original.rawTables.get('Steps').some(r=>/^tv_news_d[1-3]$/.test(r.arg)));
assert(!original.rawTables.get('StreetChoices').some(r=>/^home_tv_day[1-3]_/.test(r.id)));
// Do not introduce an ID the unchanged engine's CSV-memory fallback cannot play.
const memories=original.rawTables.get('Steps').filter(r=>r['web_fields.cinemaAfter']==='terrace-memory');
assert.equal(memories.length,2);assert(memories.some(r=>r['web_fields.memoryKey']==='terraceMemory3'));
// Craft CSV is the shipped web catalog, not an engine superset hidden by views.
// Removed recipes must also be absent in QA99 and the developer catalog.
for(const name of ['cocktails','shelf_items','recipes','cocktail_tags']){
 const view=views.tables[name],raw=original.rawTables.get(view.table);
 const selected=view.rows.map(spec=>raw.find(r=>spec.id&&r.web_row_id===spec.id)||raw.find(r=>Object.keys(spec.key).length&&Object.entries(spec.key).every(([k,v])=>r[k]===String(v))));
 assert(selected.every(Boolean),'All web craft rows must resolve: '+name);
 assert.equal(new Set(selected).size,raw.length,'Remove unused CSV rows instead of only hiding them in the web view: '+name);
}
const cocktails=original.rawTables.get('Cocktails'),items=original.rawTables.get('ShelfItems');
const cocktailIds=new Set(cocktails.map(r=>r.id)),itemIds=new Set(items.map(r=>r.id));
for(const row of original.rawTables.get('Recipes')){
 assert(cocktailIds.has(row.context),'Recipe cocktail exists: '+row.row_id);
 assert(itemIds.has(row.ingredient),'Recipe ingredient exists: '+row.row_id);
}
for(const row of original.rawTables.get('CocktailTags'))assert(cocktailIds.has(row.context),'Tag cocktail exists: '+row.row_id);
for(const row of cocktails)assert(itemIds.has(row.glass),'Cocktail glass exists: '+row.id);
assert(!cocktailIds.has('long_island'),'Long Island is removed, including QA99');
const step=scene.steps.find(s=>s.text?.ko&&s.web_core_keys?.includes('text'));
const raw=original.rawTables.get('Steps').find(r=>r.web_row_id===step.web_row_id);
assert(raw,'Find an actual shared campaign line');
const row=rows.find(r=>r[headers.indexOf('row_id')]===raw.row_id);
const marker='공통 CSV 수정 검증: "따옴표", 줄바꿈\n두 번째 줄';row[headers.indexOf('text.ko')]=marker;
files['Steps.csv']=encode(rows);
const changed=new csv.Catalog(files),result=project(changed,views,require('../data/presentation/runtime-assets.json'));
assert(changed.read(ref.source).scenes.find(s=>s.id===ref.scene).steps.some(s=>s.text?.ko===marker));
assert(result.story.bar['1'].some(s=>s.text===marker));
assert(result.data.tables.steps.some(s=>s['text.ko']===marker));
const W={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/features/campaign/campaign-engine.js'),'utf8'),W);
result.data.sharedCsv=true;const before=JSON.stringify(result.data.tables);
const session=new W.LunaCampaignEngine.Session({},result.data,result.story);session.install({developer:true});
assert.equal(JSON.stringify(result.data.tables),before,'Developer session must not overwrite CSV content');session.uninstall();
const mainExpected=JSON.parse(before);
session.install();
assert.equal(JSON.stringify(result.data.tables),JSON.stringify(mainExpected),'Main and developer sessions use the same authoritative CSV catalog');
session.uninstall();assert.equal(JSON.stringify(result.data.tables),before,'Leaving main restores all source rows and edits');
console.log('SHARED_DATA_PROJECTION_OK: one CSV edit reaches typed engine data, web story and bar tables; main filtering preserves edits and restores source.');
