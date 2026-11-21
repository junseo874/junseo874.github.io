// Only shipped gameplay visuals; review-only references and audio are not bulk downloaded.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../bar-playtest'),groups={common:[],bar:[]};
function walk(dir,group){if(!fs.existsSync(path.join(root,dir)))return;for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(file==='assets/ui/extracted')continue;if(entry.isDirectory())walk(file,group);else if(/\.(png|webp|jpe?g|gif|svg|woff2?|ttf|otf)$/i.test(file))groups[group].push(file);}}
for(const dir of ['ui','tutorials','fonts'])walk('assets/'+dir,'common');
for(const dir of ['backgrounds','characters','cocktails','items','serving'])walk('assets/'+dir,'bar');
walk('assets/01.ArtResources/03.Crafting/04.Minigames/03.Ingredients','bar');
// Newly supplied bar assets may have no historical path-migration entry.
for(const a of Object.values(require('../bar-playtest/data/presentation/runtime-assets.json').assets))if(a.src?.startsWith('assets/'))groups.bar.push(a.src);
// Keep the same loading groups after canonical art paths are moved. Outside-only
// artwork remains on-demand; do not bulk-preload the entire shared art tree.
for(const {from,to} of require('../docs/architecture/art-resource-paths.json').records){
 const group=/^assets\/(ui|tutorials|fonts)\//.test(from)?'common':/^assets\/(backgrounds|characters|cocktails|items|serving)\//.test(from)?'bar':null;
 if(group&&!groups[group].includes(to))groups[group].push(to);
}
for(const file of ['BTN_offer.png','BTN_trash.png'])groups.bar.push('assets/01.ArtResources/05.UI/03.Crafting/03.Offer/'+file);
for(const grade of ['Excellent','Good','Decent','Poor','Sewage'])groups.bar.push('assets/01.ArtResources/05.UI/03.Crafting/03.Offer/Engine/FX_TX_GradeText_'+grade+'_01.png');
// Serving atlases decode on demand; preload only the static backdrop.
groups.bar.push('assets/01.ArtResources/04.Cutscenes/03.Bar/01.Serving/03.Background/Background.png');
groups.bar=groups.bar.filter(p=>!p.includes('/01.Serving/02.Drink_Serving_Screen_Sheets/'));
const generated=require('../bar-playtest/data/presentation/generated-art/manifest.json');
for(const r of generated.records)if(r.sources.some(s=>s.src.startsWith('assets/ui/parts/')||s.src.startsWith('assets/ui/cursors/')))groups.common.push('assets/01.ArtResources/'+r.path);
groups.common.push(...require('../bar-playtest/data/presentation/generated-art-preload.json'));
// Shared authored notifications must be decoded before the first story event.
for(const name of ['decrease','increase','ingredient','new_character','new_event','objective','objective_complete'])groups.common.push('assets/01.ArtResources/05.UI/01.Shared/MainScreen/notify/IMG_'+name+'.png');
// Old extraction copies are excluded while a migration is being verified.
const migrated=new Set(generated.records.flatMap(r=>r.sources.map(s=>s.src)));
for(const key of Object.keys(groups))groups[key]=[...new Set(groups[key].filter(p=>!migrated.has(p)))].sort();
// Inventory is not a startup checklist. Keep later screens auditable without
// requiring their artwork or alternate fonts before the first playable frame.
const inventory=new Set([...groups.common,...groups.bar]);
const runtime=require('../bar-playtest/data/presentation/runtime-assets.json').assets;
const firstBar=new Set(['bar','bar_far','bar_mid','bar_front','coaster','dialogue','dialogue_luna','choice','next','money'].map(k=>runtime[k].src));
groups.common=groups.common.filter(p=>p.includes('/MainScreen/notify/')||p.endsWith('/IMG_money.png')||p.endsWith('/Web_IMG_cursor_default_icon.png'));
// Match the URLs painted by CSS, including version queries (a distinct browser cache key).
function cssImages(file){
 const urls=[...fs.readFileSync(path.join(root,file),'utf8').matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)].map(m=>m[1]);
 return urls.filter(p=>p.startsWith('../')&&/\.png(?:\?|$)/i.test(p)).map(p=>path.posix.join(path.posix.dirname(file),p));
}
for(const file of ['src/features/outside/outside.css','src/shared/dialogue/exterior-textbox.css'])groups.common.push(...cssImages(file));
const generatedCss=cssImages('src/shared/ui/generated-art.css');
groups.common.push(...generatedCss.filter(p=>p.includes('/WebGenerated/Outside/')||p.includes('/WebGenerated/Tutorial/')||p.endsWith('/Web_GRD_modal_backdrop_background.png')));
groups.common=[...new Set(groups.common)].sort();
const barCss=cssImages('src/features/bar/bar-views.css');
for(const p of barCss)firstBar.add(p);
for(const p of generatedCss)if(p.includes('/05.UI/03.Bar/')||p.includes('/WebGenerated/Notifications/')||p.endsWith('/Web_BTN_service_handle_background.png'))firstBar.add(p);
groups.bar=[...firstBar];
walk('assets/01.ArtResources/05.UI/01.Shared/01.MainScreen','bar');
const versioned=new Set(barCss.filter(p=>p.includes('?')).map(p=>p.split('?')[0]));
groups.bar=[...new Set(groups.bar)].filter(p=>!groups.common.includes(p)&&!versioned.has(p)).sort();
groups.onDemand=[...inventory].filter(p=>!groups.common.includes(p)&&!groups.bar.includes(p)).sort();
const file=path.join(root,'data/presentation/preload-manifest.json'),text=JSON.stringify(groups,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(file,text);
else if(fs.readFileSync(file,'utf8')!==text)throw Error('Preload manifest is stale: run node tools/build-preload-manifest.cjs --write');
console.log('PRELOAD_MANIFEST_OK',Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])));
