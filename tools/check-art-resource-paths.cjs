// Verify the shared art naming contract without requiring the external source folder.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../bar-playtest');
const manifest=require('../docs/architecture/art-resource-paths.json');
for(const r of manifest.records){
 assert.equal(r.to,'assets/9_ArtResources/'+r.source);
 assert.ok(fs.existsSync(path.join(root,r.to)),'Missing '+r.to);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r.to))).digest('hex'),r.sha256,'Changed artwork '+r.to);
 assert.ok(!fs.existsSync(path.join(root,r.from)),'Old duplicate '+r.from);
}
console.log('ART_RESOURCE_PATHS_OK:',manifest.records.length,'original paths preserved; bytes unchanged.');
