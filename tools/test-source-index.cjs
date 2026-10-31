const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,features,find,outline}=require('./lib/source-index.cjs');
const aliases=new Set();
for(const [key,value]of Object.entries(features)){
  assert(fs.existsSync(path.join(root,value.docs)),value.docs);
  for(const file of value.paths)assert(fs.existsSync(path.join(root,file)),file);
  for(const alias of [key,...value.aliases]){assert(!aliases.has(alias),alias);aliases.add(alias);assert.equal(find(alias).feature,key);}
}
assert(find('scoreCraft').files.some(f=>f.file.endsWith('craft-rules.js')&&f.symbols.some(s=>s.name==='scoreCraft')));
assert(find('pump').files.some(f=>f.file.endsWith('story-flow.js')));
assert(find('outside-view').files.some(f=>f.file.endsWith('outside-view.js')));
assert.deepEqual(find('nonexistent-feature-xyz').files,[]);
assert(find('cinema').files.every(f=>!f.file.includes('/data/')));
assert.deepEqual(outline('  function sample() {}\n    tick(dt) {\n    if (x) {'),[{name:'sample',line:1},{name:'tick',line:2}]);
const {execFileSync}=require('node:child_process');
const located=JSON.parse(execFileSync(process.execPath,[path.join(root,'tools/locate.cjs'),'outside','--symbols','--json'],{encoding:'utf8'}));
assert(located.files.length<=40);
assert(located.files.reduce((n,file)=>n+file.symbols.length,0)<=80);
assert.equal(located.truncated,true);
for(const name of fs.readdirSync(path.join(root,'docs/architecture')).filter(n=>n.endsWith('.md'))){
  const file=path.join(root,'docs/architecture',name),text=fs.readFileSync(file,'utf8');
  for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
    const target=match[1].split('#')[0];if(!target||/^[a-z]+:/.test(target))continue;
    assert(fs.existsSync(path.resolve(path.dirname(file),target)),name+': broken documentation link '+target);
  }
}
console.log('SOURCE_INDEX_OK: feature/alias/file/symbol lookup and generated-data exclusion');
