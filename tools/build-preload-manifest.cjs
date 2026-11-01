// Only shipped gameplay visuals; review-only references and audio are not bulk downloaded.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../bar-playtest'),groups={common:[],bar:[]};
function walk(dir,group){if(!fs.existsSync(path.join(root,dir)))return;for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(file==='assets/ui/extracted')continue;if(entry.isDirectory())walk(file,group);else if(/\.(png|webp|jpe?g|gif|svg|woff2?|ttf|otf)$/i.test(file))groups[group].push(file);}}
for(const dir of ['ui','tutorials','fonts'])walk('assets/'+dir,'common');
for(const dir of ['backgrounds','characters','cocktails','items','serving'])walk('assets/'+dir,'bar');
// Keep the same loading groups after canonical art paths are moved. Outside-only
// artwork remains on-demand; do not bulk-preload the entire shared art tree.
for(const {from,to} of require('../docs/architecture/art-resource-paths.json').records){
 const group=/^assets\/(ui|tutorials|fonts)\//.test(from)?'common':/^assets\/(backgrounds|characters|cocktails|items|serving)\//.test(from)?'bar':null;
 if(group&&!groups[group].includes(to))groups[group].push(to);
}
const generated=require('../bar-playtest/data/presentation/generated-art/manifest.json');
for(const r of generated.records)if(r.sources.some(s=>s.src.startsWith('assets/ui/parts/')||s.src.startsWith('assets/ui/cursors/')))groups.common.push('assets/01.ArtResources/'+r.path);
groups.common.push(...require('../bar-playtest/data/presentation/generated-art-preload.json'));
// Old extraction copies are excluded while a migration is being verified.
const migrated=new Set(generated.records.flatMap(r=>r.sources.map(s=>s.src)));
for(const key of Object.keys(groups))groups[key]=[...new Set(groups[key].filter(p=>!migrated.has(p)))].sort();
const file=path.join(root,'data/presentation/preload-manifest.json'),text=JSON.stringify(groups,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(file,text);
else if(fs.readFileSync(file,'utf8')!==text)throw Error('Preload manifest is stale: run node tools/build-preload-manifest.cjs --write');
console.log('PRELOAD_MANIFEST_OK',Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])));
