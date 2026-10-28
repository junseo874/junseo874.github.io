/* Inspect every registered player-facing UI state and export paint layers only.
 * Dialogue is used for layout, never copied into a PNG. No game/save files change.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
const root=path.resolve(__dirname,'..'),base=process.env.RESOURCE_REVIEW_URL||'http://127.0.0.1:8123/bar-playtest/',folder='assets/ui/extracted',out=path.join(root,folder);
const kindNames={background:'배경',border:'테두리',icon:'아이콘',shadow:'그림자'},stateNames={normal:'기본',hover:'호버',active:'누름',focus:'포커스'};
const noticeKinds=[['goal-new','새로운 목표','◇'],['goal-complete','목표 달성','✓'],['event','이벤트 발생','!'],['meet','인물정보 등록','＋'],['up','호감도 상승','↑'],['down','호감도 하락','↓']];
const snapshots=new Map(),coverage=[],extraImages=new Map(),failures=[];
function keyFor(p){return crypto.createHash('sha256').update(JSON.stringify([p.w,p.h,p.kind,p.style,p.glyph,p.svg,p.rotation||0])).digest('hex').slice(0,16);}
function record(data,context,mandatory=false){
 let added=0;for(const p of data.parts){
  const key=(mandatory?context.id+'-':'')+keyFor(p);let item=snapshots.get(key);
  if(!item){item={...p,key,contexts:[],category:mandatory?'UI · 팝업 분리':'UI · 기타 분리'};snapshots.set(key,item);added++;}
  if(!item.contexts.some(c=>c.id===context.id&&c.source===p.source&&c.state===p.state))item.contexts.push({...context,source:p.source,state:p.state});
 }
 for(const a of data.originals)extraImages.set(a.src,{...a,title:context.title});return added;
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1}),page=await ctx.newPage(),draw=await ctx.newPage();
  await page.bringToFront();await page.goto(base+'resource-review.html');await page.waitForFunction(()=>window.resourceReview?.ready,null,{timeout:60000});
  const game=page.frames().find(f=>f.url().includes('resourceReview=1'));await game.addScriptTag({path:path.join(__dirname,'ui-graphic-snapshot.js')});
  await page.evaluate(()=>document.querySelector('#lab').classList.remove('parked'));
  // Mandatory notifications are read from their actual game CSS, independent of timing.
  for(const [kind,title,glyph]of noticeKinds){
   const data=await game.evaluate(({kind,title,glyph})=>{
    const root=document.createElement('div');root.id='graphic-export-fixture';root.style.cssText='position:fixed;left:32px;top:32px;z-index:99999;width:600px;height:240px';
    root.innerHTML='<div class="story-notice story-notice-'+(['event','goal-new','goal-complete'].includes(kind)?'event':'people')+'" data-kind="'+kind+'" style="position:absolute;left:0;top:0;right:auto;bottom:auto;opacity:1;transform:none"><span class="story-notice-icon"></span><div><small></small><strong></strong></div></div>';
    root.querySelector('.story-notice-icon').textContent=glyph;root.querySelector('small').textContent=title;root.querySelector('strong').textContent='알림 내용';document.body.append(root);
    const data=UIGraphicSnapshot.collect(root,{states:false});root.remove();return data;
   },{kind,title,glyph});
   record(data,{id:'notification-'+kind,title:'팝업 · '+title},true);coverage.push({id:'notification-'+kind,title,paintLayers:data.parts.length});
  }
  const states=await page.evaluate(()=>resourceReview.rows.filter(r=>r.launch&&['bar-ui','out-ui','common-popups'].includes(r.group)).flatMap(r=>(r.variants||[{id:'default',label:'기본',launch:r.launch}]).map(v=>({id:r.id+'--'+v.id,title:r.title+' · '+(v.label||v.id),launch:v.launch}))));
  states.push({id:'extra-title',title:'타이틀 화면',launch:{type:'background',id:'title'}});
  let index=0;
  for(const state of states){
   await page.bringToFront();
   try{
    await page.evaluate(async state=>{await resourceReview.launch(state.launch,state.title,'그래픽 요소 분리 검수');if(document.querySelector('#lab-note').classList.contains('error'))throw Error(document.querySelector('#lab-note').textContent);},state);
    await page.waitForTimeout(380);
    const data=await game.evaluate(()=>UIGraphicSnapshot.collect());
    record(data,state);coverage.push({id:state.id,title:state.title,paintLayers:data.parts.length});
    await page.evaluate(()=>resourceReview.close(true));
   }catch(e){failures.push({id:state.id,message:e.message});console.log('STATE FAILED',state.id,e.message.slice(0,180));await page.evaluate(()=>resourceReview.close(true));}
   if(++index%12===0)console.log('Scanned',index,'/',states.length,'UI states;',snapshots.size,'unique graphic layers');
  }
  // Add state-independent UI not represented by a review card (keys, loading,
  // skip prompt, inspection overlay, world choices) using native markup/skin.
  const fixtures=[
   ['skip','컷씬 스킵 안내','<div class="campaign-stage"><button class="campaign-skip is-visible"><kbd>Space</kbd><span>건너뛰기</span><div class="campaign-skip-track"><i style="transform:scaleX(1)"></i></div></button></div>'],
   ['inspection','오브젝트 관찰','<div id="outside-root"><div class="outside-overlay is-inspection"><button class="outside-inspection-exit"><kbd>E</kbd><span>나가기</span></button></div></div>'],
   ['outside-key','외부 상호작용 / 전경','<div id="outside-root"><button class="outside-interact"><kbd>E</kbd><span>상호작용</span></button><button class="outside-viewpoint"><kbd>Y</kbd></button></div>']
  ];
  for(const [id,title,html]of fixtures){
   const data=await game.evaluate(html=>{const r=document.createElement('div');r.style.cssText='position:fixed;inset:0;width:1280px;height:720px;z-index:99999';r.innerHTML=html;document.body.append(r);for(const e of r.querySelectorAll('[hidden]'))e.hidden=false;const data=UIGraphicSnapshot.collect(r);r.remove();return data;},html);
   record(data,{id:'fixture-'+id,title});coverage.push({id:'fixture-'+id,title,paintLayers:data.parts.length});
  }
  const font=fs.readFileSync(path.join(root,'assets/fonts/kopubworld-dotum-medium.ttf')).toString('base64');
  // Embed the actual bundled font: a blank export document otherwise cannot
  // load the same font over HTTP without the game's origin/CORS context.
  await draw.route(base+'graphic-export-host.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
  await draw.goto(base+'graphic-export-host.html');
  await draw.setContent('<base href="'+base+'"><style>@font-face{font-family:LunaPixel;src:url(data:font/ttf;base64,'+font+')}html,body{margin:0;background:transparent}*{box-sizing:border-box}</style><div id="paint"></div>',{waitUntil:'domcontentloaded'});
  await draw.evaluate(()=>document.fonts.load('16px LunaPixel'));
  await draw.evaluate(()=>document.fonts.load('600 20px Paperlogy'));
  const manifest=[],blank=[];let n=0;
  for(const item of snapshots.values()){
   const box=await draw.evaluate(item=>{
    const host=document.querySelector('#paint');host.replaceChildren();const e=document.createElement('div');host.append(e);
    for(const [key,value]of Object.entries(item.style))e.style.setProperty(key,value);
    const outline=item.kind==='border'&&!['none','hidden'].includes(item.style['outline-style'])?Math.max(0,(parseFloat(item.style['outline-width'])||0)+(parseFloat(item.style['outline-offset'])||0)):0;
    const pad=item.kind==='shadow'?48:Math.ceil(outline);e.style.cssText+=';position:absolute;left:'+pad+'px;top:'+pad+'px;width:'+item.w+'px;height:'+item.h+'px;margin:0;padding:0;overflow:hidden;';
    if(item.kind!=='background'){e.style.background='none';}
    if(item.kind!=='border'){for(const side of ['Top','Right','Bottom','Left'])e.style['border'+side+'Color']='transparent';}
    if(item.kind!=='shadow')e.style.boxShadow='none';
    if(item.kind!=='border')e.style.outline='none';
    if(item.kind==='icon'){
     e.style.border='none';e.style.clipPath='none';e.style.display='grid';e.style.placeItems='center';
     if(item.svg)e.innerHTML=item.svg;else e.textContent=item.glyph;
    }
    const angle=(item.rotation||0)*Math.PI/180,rw=Math.ceil(Math.abs(item.w*Math.cos(angle))+Math.abs(item.h*Math.sin(angle))),rh=Math.ceil(Math.abs(item.w*Math.sin(angle))+Math.abs(item.h*Math.cos(angle)));
    if(item.rotation){e.style.transform='rotate('+item.rotation+'deg)';e.style.transformOrigin='center';e.style.left=pad+(rw-item.w)/2+'px';e.style.top=pad+(rh-item.h)/2+'px';}
    return {width:rw+pad*2,height:rh+pad*2,pad};
   },item);
   await draw.setViewportSize({width:Math.max(1,box.width),height:Math.max(1,box.height)});
   const buffer=await draw.screenshot({omitBackground:true});
   const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   if(!data.some((v,i)=>i%info.channels===info.channels-1&&v>0)){blank.push({key:item.key,source:item.source,kind:item.kind});continue;}
   const src=folder+'/'+item.key+'-'+item.kind+'.png';fs.writeFileSync(path.join(root,src),buffer);
   const first=item.contexts[0],selector=item.source.replace(/^(div|span|button|section|aside|header|footer|svg|kbd)/,'');
   manifest.push({src,title:first.title+' · '+selector+' · '+kindNames[item.kind]+(item.state==='normal'?'':' / '+stateNames[item.state]),category:item.category,w:box.width,h:box.height,partKind:item.kind,contexts:item.contexts.map(c=>c.title+' '+c.source+' '+stateNames[c.state]).join(' | '),sourceSelector:item.source,sourceStates:item.contexts.map(c=>c.id),contentRect:{x:box.pad,y:box.pad,w:item.w,h:item.h},note:'설명 텍스트 제외 · '+kindNames[item.kind]+'만 분리'+(box.pad?' · 효과 여백 '+box.pad+'px':''),...(item.glyph?{iconGlyph:item.glyph}:{})});
   if(++n%80===0)console.log('Rendered',n,'/',snapshots.size,'graphic PNGs');
  }
  for(const a of extraImages.values()){
   if(!a.src.startsWith(base.split('/bar-playtest/')[0])||a.src.includes('GRD_textbox.png'))continue;
   const disk=path.resolve(root,'..','.'+new URL(a.src).pathname);
   if(!fs.existsSync(disk))continue;
   try{const m=await sharp(disk).metadata();if(m.format!=='png')continue;const src=path.relative(root,disk).split(path.sep).join('/');if(manifest.some(a=>a.src===src))continue;manifest.push({src,title:a.title+' · 원본 이미지',category:'UI · 원본 조각',w:m.width,h:m.height,note:'실제 UI에서 참조하는 원본 PNG'});}catch{}
  }
  // Intro input pictograms are drawn on a canvas, not DOM. Invoke the existing
  // drawing function and intercept text/fill/stroke independently (no redraw).
  const opening=fs.readFileSync(path.resolve(root,'../cutscene-studio/src/opening-template.js'),'utf8');
  const functionSource=opening.slice(opening.indexOf('function introControls('),opening.indexOf('function dialogue('));
  for(const [key,index]of [['E',0],['SPACE',1]])for(const pressed of [false,true])for(const kind of ['background','border','icon']){
   const image=await draw.evaluate(({functionSource,key,index,pressed,kind})=>{
    const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d'),fillText=g.fillText.bind(g);
    if(kind!=='background')g.fill=()=>{};if(kind!=='border')g.stroke=()=>{};
    g.fillText=(text,...args)=>{if(kind==='icon'&&text===key)fillText(text,...args);};
    const fn=new Function('W','INTRO_UI_FONT',functionSource+';return introControls;')(window,'"Paperlogy", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif');fn(g,pressed?index*1.2+.3:0);
    const out=document.createElement('canvas');out.width=index?166:68;out.height=71;out.getContext('2d').drawImage(c,index?677:486,463,out.width,71,0,0,out.width,71);return out.toDataURL('image/png');
   },{functionSource,key,index,pressed,kind});
   const src=folder+'/intro-'+key.toLowerCase()+'-'+(pressed?'pressed':'normal')+'-'+kind+'.png';fs.writeFileSync(path.join(root,src),Buffer.from(image.split(',')[1],'base64'));
   manifest.push({src,title:'게임 시작 안내 · '+key+'키 '+(pressed?'누름':'기본')+' · '+kindNames[kind],category:'UI · 기타 분리',partKind:kind,w:index?166:68,h:71,sourceStates:['ui:opening-guide--default'],note:'실제 캔버스 렌더러에서 분리 · 안내 문구 없음',...(kind==='icon'?{iconGlyph:key}:{})});
  }
  const intro=coverage.find(c=>c.id==='ui:opening-guide--default');if(intro){intro.paintLayers=12;intro.renderer='cutscene-studio/src/opening-template.js / introControls';}
  const sourceHashes=Object.fromEntries(['capture_all_ui_graphics.cjs','ui-graphic-snapshot.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex')]));
  const audit={generatedAt:new Date().toISOString(),sourceHashes,states:coverage,failures,emptyPaintLayersExcluded:blank,assets:manifest.length,scope:'현재 리소스 확인에 등록된 플레이어 UI 전체 상태, 목표/이벤트/인물/호감도 6종, 타이틀/외부 키/관찰/스킵 UI. 게임 장면·캐릭터 합성·대사 텍스트·동적 액체 시뮬레이션 제외.'};
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify(audit,null,2)+'\n');
  require('./build_resource_extraction_catalog.cjs');
  console.log(JSON.stringify({states:coverage.length,assets:manifest.length,failures,blank:blank.length}));
  if(failures.length)process.exitCode=1;
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
