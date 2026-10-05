// Run against the local simulator. Captures are documentation thumbnails, not game artwork.
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),fs=require('fs');
const out=process.env.LUNA_PREVIEW_DIR||path.resolve(__dirname,'../assets/resource-previews');
(async()=>{fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1000,height:760}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
 // Keep the live game at its intended 16:9 aspect ratio, then capture at card/detail resolution.
 await p.addStyleTag({content:'.frame-wrap,.lab.parked .frame-wrap{width:640px!important;height:360px!important;max-width:none!important;border:0!important}'});
 const rows=await p.evaluate(()=>resourceReview.rows.filter(r=>['bar-ui','out-ui'].includes(r.group)&&r.launch).map(r=>({id:r.id,title:r.title,launch:r.launch,note:r.note})));
 const files=new Set();
 for(const [i,r]of rows.entries()){
  const file=r.id.replace(/[^a-z0-9_-]/gi,'_')+'.jpg';if(files.has(file))throw Error('Duplicate preview filename '+file);files.add(file);
  await p.evaluate(r=>resourceReview.launch(r.launch,r.title,r.note),r);
  const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
  const wait=r.launch.type==='terrace'||r.launch.type==='johnny-memory'?2900:r.launch.type==='day-transition'?2050:r.launch.type==='door'?3350:r.launch.type==='outside'?1700:1000;
  await p.waitForTimeout(wait);
  await f.evaluate(()=>{if(barGame.dialogue)barGame.dialogue.chars=barGame.dialogue.text.length;if(lunaCampaign.dialog){const d=lunaCampaign.dialog;d.chars=d.rows[d.index].text.length;lunaCampaign.paintLine();}for(const s of [outsidePlaytest.model?.story,outsidePlaytest.model?.backgroundStory])if(s?.speech)s.speech.elapsed=99;outsidePlaytest.refreshHUD();});
  await p.waitForTimeout(60);
  const error=await p.locator('#lab-note').evaluate(e=>e.classList.contains('error')?e.textContent:null);if(error)throw Error(r.id+': '+error);
  await p.locator('#game').screenshot({path:path.join(out,file),type:'jpeg',quality:80});
  await p.evaluate(()=>resourceReview.close());
  if(i%12===0||i===rows.length-1)console.log('CAPTURE',i+1,'/',rows.length,r.id);
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('PREVIEWS_OK',rows.length);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
