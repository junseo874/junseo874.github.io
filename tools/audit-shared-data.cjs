/* Read-only audit: never imports assets, overwrites content, or changes Unity. */
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const {load}=require('../bar-playtest/src/shared/data/csv-catalog.js');
const root=path.resolve(__dirname,'..');
const engine=path.resolve(process.argv[2]||path.join(root,'../Human-Bartender/HumanBartender/Assets/StreamingAssets/csv'));
const metadata=new Set(['dataset_id','parent_id','parent_field','source_order','template_id']);
const convert=v=>v==='\\N'?null:v==='\\E'?'':v==='true'?true:v==='false'?false:v;
async function main(){
 const catalog=await load(p=>fs.readFile(path.join(engine,p),'utf8'));
 const context={window:{}};vm.createContext(context);
 for(const file of ['game-data','campaign-data'])vm.runInContext(await fs.readFile(path.join(root,'bar-playtest/data/runtime/'+file+'.js'),'utf8'),context);
 const web=context.window.LUNA_DATA,story=context.window.LUNA_CAMPAIGN_DATA;
 const comparison=[];
 for(const spec of catalog.tables){
  const name=path.basename(spec.path,'.csv'),old=web.tables[name];
  if(!old){comparison.push({table:spec.table,path:spec.path,status:'not-imported',engineRows:catalog.rawTables.get(spec.table).length});continue;}
  const raw=catalog.rawTables.get(spec.table).filter(r=>!['scenes','steps','bar_choices','bar_choice_groups'].includes(name)||r.dataset_id.includes('/bar/'));
  const next=raw.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>!metadata.has(k)).map(([k,v])=>[k,convert(v)])));
  const before=new Map(old.map(r=>[r.row_id,r])),after=new Map(next.map(r=>[r.row_id,r]));
  const added=next.filter(r=>!before.has(r.row_id)).map(r=>r.row_id),removed=old.filter(r=>!after.has(r.row_id)).map(r=>r.row_id),changed=[];
  for(const row of next){const previous=before.get(row.row_id);if(!previous)continue;const keys=new Set([...Object.keys(previous),...Object.keys(row)]);const fields=[...keys].filter(k=>previous[k]!==row[k]);if(fields.length)changed.push({row:row.row_id,fields});}
  comparison.push({table:spec.table,path:spec.path,webRows:old.length,engineRows:next.length,added,removed,changed});
 }
 const engineScenes=new Map();for(const id of catalog.values.keys())if(id.startsWith('script/'))for(const scene of catalog.read(id).scenes||[])engineScenes.set(id+':'+scene.id,scene);
 const sceneSummary=[];
 for(const [id,rows]of Object.entries(story.scenes)){
  const match=[...engineScenes].find(([key])=>key.endsWith(':'+id));
  sceneSummary.push({webScene:id,webRows:rows.length,engineScene:match?.[0]??null,engineRows:match?.[1].steps?.length??null});
 }
 console.log(JSON.stringify({engine,tables:catalog.tables.length,datasets:catalog.values.size,records:[...catalog.rawTables.values()].reduce((n,r)=>n+r.length,0),comparison,campaignScenes:sceneSummary,warning:'This audit compares imported base rows. Runtime campaign overrides and event-module dialogue must also be reconciled before switching sources.'},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
