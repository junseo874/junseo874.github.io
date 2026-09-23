/* Read-only static resource audit. Run from any directory: node tools/check-site.cjs */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..'),errors=[],checked=new Set(),files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(['.git','node_modules','__pycache__','test-results','playwright-report'].includes(entry.name))continue;
  const full=path.join(dir,entry.name);
  if(entry.isSymbolicLink()){errors.push('Symlink is not deployable: '+path.relative(ROOT,full));continue;}
  if(entry.isDirectory())walk(full);else files.push(full);
}}
walk(ROOT);
function check(from,ref){
  if(!ref||/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref)||ref.includes('${'))return;
  let pathname;try{pathname=decodeURIComponent(ref.replaceAll('&amp;','&').split(/[?#]/)[0]);}catch{errors.push('Invalid URL: '+ref);return;}
  if(!pathname)return;
  const dest=pathname.startsWith('/')?path.join(ROOT,pathname):path.resolve(path.dirname(from),pathname);
  const relative=path.relative(ROOT,dest);
  if(relative.startsWith('..')){errors.push('Reference leaves site: '+path.relative(ROOT,from)+' → '+ref);return;}
  if(checked.has(dest))return;checked.add(dest);
  let current=ROOT;
  for(const part of relative.split(path.sep).filter(Boolean)){
    if(!fs.existsSync(current)||!fs.statSync(current).isDirectory()){errors.push('Missing: '+ref+' from '+path.relative(ROOT,from));return;}
    const exact=fs.readdirSync(current).find(n=>n.normalize('NFC')===part.normalize('NFC'));
    if(!exact){errors.push('Missing / wrong case: '+ref+' from '+path.relative(ROOT,from));return;}
    current=path.join(current,exact);
  }
  if(fs.statSync(current).isDirectory()&&!fs.existsSync(path.join(current,'index.html')))errors.push('No directory entry point: '+ref);
}
for(const file of files.filter(p=>/\.(?:html|css)$/.test(p))){
  const text=fs.readFileSync(file,'utf8');
  const markup=text.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi,'$1</script>');
  if(file.endsWith('.html'))for(const m of markup.matchAll(/\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gs))check(file,m[2]);
  for(const m of text.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g))check(file,m[2]);
}
const app=path.join(ROOT,'bar-playtest'),ctx={window:{addEventListener(){}},document:{createElement(){return{addEventListener(){}};},body:{append(){}}},localStorage:{getItem(){return null;}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(app,'data.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(app,'bgm.js'),'utf8'),ctx);
const D=ctx.window.LUNA_DATA;
for(const item of Object.values(D.assets))check(path.join(app,'index.html'),item.src);
const audio=new ctx.window.LunaBarBgm();for(const item of audio.tracks)check(path.join(app,'index.html'),item.src);
assert.equal(Object.keys(D.tables).length,29,'Missing source table');
assert.equal(audio.tracks.length,4,'Missing BGM');
for(const file of files.filter(p=>p.startsWith(path.join(app,'assets')+path.sep)))if(fs.statSync(file).size===0)errors.push('Empty asset: '+path.relative(ROOT,file));
console.log(JSON.stringify({siteFiles:files.length,localReferences:checked.size,tables:Object.keys(D.tables).length,assetKeys:Object.keys(D.assets).length,audioTracks:audio.tracks.length,errors},null,2));
if(errors.length)process.exitCode=1;
else console.log('SITE_RESOURCES_OK: exact-case local links, 29 tables, sprites, fonts, 4 BGM tracks, no external filesystem links.');
