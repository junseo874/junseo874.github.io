/* Dry-run migration: reads current sources, writes nothing. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const csv=require('../bar-playtest/src/shared/data/csv-catalog.js');
const {serialize}=require('./lib/csv-catalog-writer.cjs');
const {mergeWeb}=require('./lib/shared-data-model.cjs');
const {project}=require('./lib/shared-data-views.cjs');
const root=path.resolve(__dirname,'..');
function capture(engine=path.join(root,'../Human-Bartender/HumanBartender/Assets/StreamingAssets/csv')){
 const backup=path.join(root,'artifacts/shared-data-backup');
 const files=fs.existsSync(path.join(backup,'engine-files.json'))?JSON.parse(fs.readFileSync(path.join(backup,'engine-files.json'),'utf8')):{};
 if(!files['_Tables.csv']){for(const[k,p]of Object.entries(csv.metadata))files[k+'.csv']=fs.readFileSync(path.join(engine,p),'utf8');
 for(const t of csv.parseRows(files['_Tables.csv']))files[t.table+'.csv']=fs.readFileSync(path.join(engine,t.path),'utf8');}
 const catalog=new csv.Catalog(files),W={};W.window=W;
 for(const file of ['data/runtime/game-data.js','data/runtime/campaign-data.js','src/features/campaign/campaign-engine.js']){const saved=path.join(backup,path.basename(file));vm.runInNewContext(fs.readFileSync(file.startsWith('data/')&&fs.existsSync(saved)?saved:path.join(root,'bar-playtest',file),'utf8'),W);}
 const data=require('../bar-playtest/src/core/core.js').millilitreData(W.LUNA_DATA);
 new W.LunaCampaignEngine.Session({},data,W.LUNA_CAMPAIGN_DATA).install();
 const outside=require('./lib/capture-outside-data.cjs')(root);
 const model=mergeWeb(catalog,data,W.LUNA_CAMPAIGN_DATA,outside),output=serialize(files,model.values);
 const {tables,...presentation}=data;
 const result=project(new csv.Catalog(output),model.views,presentation);
 // JSON removes cross-realm prototypes only. No expected values are relaxed.
 const plain=x=>JSON.parse(JSON.stringify(x));
 function equal(a,b,label){
  const differences=[];function walk(a,b,p){if(differences.length>=12)return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],p+'.'+k);}else if(a!==b)differences.push({path:p,actual:a,expected:b});}walk(plain(a),plain(b),label);
  assert.equal(differences.length,0,JSON.stringify(differences,null,2));
 }
 equal(result.data.tables,data.tables,'tables');
 equal(result.story,W.LUNA_CAMPAIGN_DATA,'campaign');
 equal(result.data.sharedStory,outside,'outside');
 return{files,output,model,presentation,data,story:W.LUNA_CAMPAIGN_DATA};
}
if(require.main===module){capture(process.argv[2]);console.log('SHARED_DATA_MIGRATION_OK: final web tables and every campaign row preserved through engine CSV schema.');}
module.exports={capture};
