// Portable validation of the engine-aligned web export; never writes to Unity.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const contract=require('../bar-playtest/data/presentation/engine-art-sync.json');
const root=path.resolve(__dirname,'../bar-playtest/assets/01.ArtResources');
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const expected=new Set(contract.records.map(r=>r.path));
for(const r of contract.records){
 const target=path.join(root,r.path);assert(fs.existsSync(target),'Missing '+r.path);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),r.sha256,'Changed pixels/source bytes '+r.path);
 if(r.from!==r.path&&!expected.has(r.from))assert(!fs.existsSync(path.join(root,r.from)),'Duplicate old path '+r.from);
}
const actual=files(root).filter(f=>!path.basename(f).startsWith('.')).map(f=>path.relative(root,f));
assert.deepEqual([...actual].sort(),[...expected].sort());
assert(actual.every(f=>!f.endsWith('.meta')),'Do not export Unity GUID/import settings');
assert(actual.every(f=>! /\.(md|json|txt)$/i.test(f)),'Keep management data outside art');
console.log('ENGINE_ART_SYNC_OK:',expected.size,'files;',contract.records.filter(r=>r.kind.startsWith('existing')).length,'engine paths;',contract.records.filter(r=>r.kind==='new').length,'new paths; all source bytes preserved');
