/* Explicit, conflict-protected CSV publication. Never writes Unity code or art. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const csv=require('../bar-playtest/src/shared/data/csv-catalog.js');
const {project}=require('./lib/shared-data-views.cjs');
const root=path.resolve(__dirname,'..'),web=path.join(root,'bar-playtest/data/shared-csv');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
async function snapshot(directory){
 const files={},paths={};for(const[k,p]of Object.entries(csv.metadata)){paths[k+'.csv']=p;files[k+'.csv']=await fs.readFile(path.join(directory,p),'utf8');}
 for(const t of csv.parseRows(files['_Tables.csv'])){paths[t.table+'.csv']=csv.safePath(t.path);files[t.table+'.csv']=await fs.readFile(path.join(directory,t.path),'utf8');}
 return{files,paths,catalog:new csv.Catalog(files)};
}
async function main(){
 const mode=process.argv[2]||'--check';if(!['--check','--to-engine','--from-engine'].includes(mode))throw Error('Use --check, --to-engine or --from-engine [Unity CSV directory].');
 const engine=path.resolve(process.argv[3]||path.join(root,'../Human-Bartender/HumanBartender/Assets/StreamingAssets/csv'));
 if(!engine.endsWith(path.join('StreamingAssets','csv'))||engine===web)throw Error('Target must be a Unity StreamingAssets/csv directory.');
 const local=await snapshot(web),remote=await snapshot(engine);
 if(mode==='--check'){
  for(const name of new Set([...Object.keys(local.files),...Object.keys(remote.files)]))if(local.files[name]!==remote.files[name])throw Error('CSV copies differ: '+name);
  await require('./build-shared-data.cjs').build();console.log('SHARED_CSV_SYNC_OK: byte-identical web/engine CSV and current generated runtime.');return;
 }
 const from=mode==='--to-engine'?local:remote,to=mode==='--to-engine'?remote:local,destination=mode==='--to-engine'?engine:web;
 let baseline;try{baseline=JSON.parse(await fs.readFile(path.join(web,'engine-sync.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;if(mode!=='--to-engine')throw Error('Initial publication must be --to-engine.');baseline=JSON.parse(await fs.readFile(path.join(root,'artifacts/shared-data-backup/engine-baseline.json'),'utf8'));}
 for(const[name,text]of Object.entries(from.files))if(to.files[name]!==text&&to.files[name]!==undefined&&hash(to.files[name])!==baseline[name])throw Error('Destination changed since last synchronization; refusing overwrite: '+name);
 const views=JSON.parse(await fs.readFile(path.join(web,'web-views.json'),'utf8'));
 project(from.catalog,views,{}); // All web references must resolve before any copy.
 // Recheck destinations immediately before writing; concurrent edits are conflicts.
 for(const[name,text]of Object.entries(to.files)){const actual=await fs.readFile(path.join(destination,to.paths[name]),'utf8');if(actual!==text)throw Error('Concurrent edit: '+name);}
 for(const[name,text]of Object.entries(from.files)){
  const target=path.join(destination,from.paths[name]);await fs.mkdir(path.dirname(target),{recursive:true});
  if(text===to.files[name])continue;await fs.writeFile(target+'.shared-tmp',text);await fs.rename(target+'.shared-tmp',target);
 }
 await require('./build-shared-data.cjs').build(true);
 await fs.writeFile(path.join(web,'engine-sync.json'),JSON.stringify(Object.fromEntries(Object.entries(from.files).map(([name,text])=>[name,hash(text)])),null,2)+'\n');
 const verify=await snapshot(destination);for(const[name,text]of Object.entries(from.files))if(verify.files[name]!==text)throw Error('Publication verification failed: '+name);
 console.log('SHARED_CSV_SYNC_OK: '+Object.keys(from.files).length+' byte-identical CSV files; '+mode);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
