const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('../bar-playtest/src/shared/data/csv-catalog.js');
const {project}=require('./lib/shared-data-views.cjs');
const root=path.resolve(__dirname,'..'),base=path.join(root,'bar-playtest/data/shared-csv');
async function build(write=false){
 const catalog=await load(p=>fs.readFile(path.join(base,p),'utf8'));
 const views=JSON.parse(await fs.readFile(path.join(base,'web-views.json'),'utf8'));
 const presentation=JSON.parse(await fs.readFile(path.join(root,'bar-playtest/data/presentation/runtime-assets.json'),'utf8'));
 const result=project(catalog,views,presentation);
 const digest=crypto.createHash('sha256');for(const [id,value]of catalog.values)digest.update(id).update(JSON.stringify(value));
 result.data.sharedCsv=true;result.data.source={...result.data.source,sharedCsv:'data/shared-csv/system/table_index.csv',contentHash:digest.digest('hex'),tableCount:catalog.tables.length};
 const files={
  'game-data.js':'/* Generated from data/shared-csv. Run node tools/build-shared-data.cjs --write; do not edit. */\nwindow.LUNA_DATA = '+JSON.stringify(result.data)+';\n',
  'campaign-data.js':'/* Generated from the same engine CSV story rows. Do not edit. */\n(function(root){root.LUNA_CAMPAIGN_DATA='+JSON.stringify(result.story,null,2)+';})(typeof window===\'undefined\'?globalThis:window);\n'
 };
 for(const [name,text]of Object.entries(files)){
  const file=path.join(root,'bar-playtest/data/runtime',name);
  if(write)await fs.writeFile(file,text);
  else if(await fs.readFile(file,'utf8')!==text)throw Error('Stale generated runtime: '+name+'; rebuild shared CSV.');
 }
 console.log('SHARED_DATA_BUILD_OK: '+catalog.tables.length+' CSV tables; web/campaign projections use one source.');
 return result;
}
if(require.main===module)build(process.argv.includes('--write')).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={build};
