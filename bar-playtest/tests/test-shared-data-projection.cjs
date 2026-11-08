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
