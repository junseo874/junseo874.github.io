// One-time, non-destructive staging. Engine publication is a separate validated step.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{capture}=require('./test-shared-data-migration.cjs');
const {parseCsv,parseRows,Catalog,metadata}=require('../bar-playtest/src/shared/data/csv-catalog.js');
const {csv}=require('./lib/csv-catalog-writer.cjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'bar-playtest/data/shared-csv');
try{await fs.access(path.join(target,'engine-sync.json'));throw Error('Migration already published. Edit the shared CSV; never rerun the legacy migration.');}catch(e){if(e.code!=='ENOENT')throw e;}
try{await fs.access(target);if(!process.argv.includes('--refresh-staging'))throw Error('Shared CSV already exists; never re-import over edited data.');}catch(e){if(e.code!=='ENOENT')throw e;}
const dependencyRoot=process.argv[2];if(!dependencyRoot)throw Error('Pass the bundled Node dependency directory.');
const dependencyRequire=createRequire(path.join(dependencyRoot,'package.json'));
const {Workbook}=await import(pathToFileURL(dependencyRequire.resolve('@oai/artifact-tool')).href);
const captured=capture(),workbook=Workbook.create(),written={};
for(const [name,text]of Object.entries(captured.output)){
 const matrix=parseCsv(text,name),sheet=workbook.worksheets.add(name.replace('.csv',''));
 const range=sheet.getRangeByIndexes(0,0,matrix.length,matrix[0].length);range.setNumberFormat('@');range.values=matrix;
 const values=range.values.map(row=>row.map(v=>v==null?'':String(v)));
 if(JSON.stringify(values)!==JSON.stringify(matrix))throw Error('Spreadsheet changed CSV cell values: '+name);
 written[name]=csv(values);
}
workbook.recalculate();new Catalog(written);
const backup=path.join(root,'artifacts/shared-data-backup');await fs.mkdir(backup,{recursive:true});
await fs.writeFile(path.join(backup,'engine-files.json'),JSON.stringify(captured.files));
for(const name of ['game-data.js','campaign-data.js']){try{await fs.access(path.join(backup,name));}catch(e){if(e.code!=='ENOENT')throw e;await fs.copyFile(path.join(root,'bar-playtest/data/runtime',name),path.join(backup,name));}}
await fs.mkdir(path.join(backup,'outside'),{recursive:true});
for(const file of ['data/runtime/outside-dialogues.js',...['outside-events','outside-thug','outside-shop','outside-beggar'].map(n=>'src/features/outside/events/'+n+'.js')]){const saved=path.join(backup,'outside',path.basename(file));try{await fs.access(saved);}catch(e){if(e.code!=='ENOENT')throw e;await fs.copyFile(path.join(root,'bar-playtest',file),saved);}}
const paths=Object.fromEntries(Object.entries(metadata).map(([k,v])=>[k+'.csv',v]));
for(const t of parseRows(written['_Tables.csv']))paths[t.table+'.csv']=t.path;
for(const [name,text]of Object.entries(written)){const file=path.join(target,paths[name]);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);}
await fs.writeFile(path.join(target,'web-views.json'),JSON.stringify(captured.model.views,null,2)+'\n');
await fs.mkdir(path.join(root,'bar-playtest/data/presentation'),{recursive:true});
await fs.writeFile(path.join(root,'bar-playtest/data/presentation/runtime-assets.json'),JSON.stringify(captured.presentation,null,2)+'\n');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
await fs.writeFile(path.join(backup,'engine-baseline.json'),JSON.stringify(Object.fromEntries(Object.entries(captured.files).map(([name,text])=>[name,digest(text)])),null,2)+'\n');
console.log('STAGED_SHARED_CSV_OK: '+Object.keys(written).length+' files; original runtime and engine untouched; backup saved.');
