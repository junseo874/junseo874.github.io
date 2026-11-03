// Reassemble the captured CSS surface WITHOUT changing live game paint or original artwork.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
const root=path.resolve(__dirname,'..'),dir='assets/01.ArtResources/',meta='data/presentation/generated-art/';
const records=require('../'+meta+'manifest.json').records,capture=require('../'+meta+'extraction.json');
async function build(){
 const groups=new Map(),paired=new Set(),independent=new Set(),outputs=new Map();
 for(const r of records.filter(r=>['background','border'].includes(r.kind)))for(const s of r.sources.filter(s=>s.src.startsWith('assets/ui/extracted/'))){
  const key=JSON.stringify([s.title.replace(/ · (배경|테두리)(?= \/|$)/,''),s.selector,s.contexts,s.states]);
  if(!groups.has(key))groups.set(key,{background:[],border:[]});groups.get(key)[r.kind].push({r,s});
 }
 const fits=(b,e)=>e.width>=b.width&&e.width-b.width===e.height-b.height&&(e.width-b.width)%2===0;
 for(const g of groups.values()){
  const used=new Set();
  for(const {r:e,s} of g.border){
   let candidates=g.background.filter(({r:b})=>fits(b,e));
   // Capture emits each element's background immediately before its border.
   // When identical selector/state/size names collide, use that provenance only.
   if(candidates.length>1||g.border.filter(({r})=>candidates.some(({r:b})=>fits(b,r))).length>1){
    const prev=capture[capture.findIndex(a=>a.src===dir+e.path&&a.title===s.title)-1];
    candidates=candidates.filter(({r:b})=>prev?.src===dir+b.path&&prev.partKind==='background');
   }
   if(!candidates.length){independent.add(dir+e.path);continue;}
   const {r:b}=candidates[0],key=b.sha256+e.sha256;used.add(b.path);paired.add(dir+e.path);paired.add(dir+b.path);
   let row=outputs.get(key);
   if(!row){const folder=path.dirname(b.path),name=path.basename(b.path,'.png').replace(/^Web_/,'').replace(/_background(?=_|$)/,'');
    const src=dir+folder+(folder.includes('/WebGenerated')?'':'/WebGenerated')+'/Combined/Web_'+name+'_surface_'+crypto.createHash('sha256').update(key).digest('hex').slice(0,10)+'.png';
    const pad=(e.width-b.width)/2;const bytes=await sharp({create:{width:e.width,height:e.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:path.join(root,dir+b.path),left:pad,top:pad},{input:path.join(root,dir+e.path),left:0,top:0}]).png().toBuffer();
    fs.mkdirSync(path.dirname(path.join(root,src)),{recursive:true});fs.writeFileSync(path.join(root,src),bytes);
    row={src,title:s.title.replace(' · 테두리',' · 배경+윤곽선'),partKind:'surface',w:e.width,h:e.height,category:'UI · 기타 분리',noticeKinds:[],contexts:'',note:'배경과 윤곽선을 합친 PNG · 텍스트 제외'};outputs.set(key,row);
   }
   row.contexts+=' '+s.title+' '+(s.contexts||'');for(const id of s.states.filter(x=>x.startsWith('notification-'))){row.category='UI · 팝업 분리';if(!row.noticeKinds.includes(id.slice(13)))row.noticeKinds.push(id.slice(13));}
  }
  for(const {r} of g.background)if(!used.has(r.path))independent.add(dir+r.path);
 }
 const result={hidden:[...paired].filter(p=>!independent.has(p)),rows:[...outputs.values()]};fs.writeFileSync(path.join(root,meta,'surfaces.json'),JSON.stringify(result,null,2)+'\n');console.log('UI surfaces:',result.rows.length,'combined PNGs;',result.hidden.length,'paired source cards replaced');
}
build().catch(e=>{console.error(e);process.exitCode=1});
