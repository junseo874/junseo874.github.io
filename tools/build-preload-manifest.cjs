// Only shipped gameplay visuals; review-only references and audio are not bulk downloaded.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../bar-playtest'),groups={common:[],bar:[]};
function walk(dir,group){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(file==='assets/ui/extracted')continue;if(entry.isDirectory())walk(file,group);else if(/\.(png|webp|jpe?g|gif|svg|woff2?|ttf|otf)$/i.test(file))groups[group].push(file);}}
for(const dir of ['ui','tutorials','fonts'])walk('assets/'+dir,'common');
for(const dir of ['backgrounds','characters','cocktails','items','serving'])walk('assets/'+dir,'bar');
for(const values of Object.values(groups))values.sort();
const file=path.join(root,'data/presentation/preload-manifest.json'),text=JSON.stringify(groups,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(file,text);
else if(fs.readFileSync(file,'utf8')!==text)throw Error('Preload manifest is stale: run node tools/build-preload-manifest.cjs --write');
console.log('PRELOAD_MANIFEST_OK',Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])));
