const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../bar-playtest/assets/9_ArtResources');
const m=require('../bar-playtest/data/presentation/generated-art/manifest.json');
const seen=new Set();
for(const r of m.records){
 assert(r.path.endsWith('.png'),'PNG only: '+r.path);assert(!seen.has(r.path));seen.add(r.path);
 const bytes=fs.readFileSync(path.join(root,r.path));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
 assert.equal(bytes.readUInt32BE(16),r.width);assert.equal(bytes.readUInt32BE(20),r.height);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),r.sha256);
 for(const s of r.sources)assert(!fs.existsSync(path.resolve(root,'../..',s.src)),'Retired duplicate: '+s.src);
}
for(const name of seen){assert(path.basename(name).startsWith('Web_'));assert(!/_\d+x\d+/.test(name),'Resolution in filename: '+name);}
assert(!fs.existsSync(path.join(root,'00.Documentation')));
console.log('WEB_GENERATED_ART_OK:',seen.size,'PNG files; names and bytes verified');
