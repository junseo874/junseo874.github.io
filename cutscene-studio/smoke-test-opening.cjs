const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1680,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const open=async id=>{await page.goto('http://127.0.0.1:8123/cutscene-studio/?template='+id+'&revision=20261012-framing-v6');await page.waitForFunction(()=>cutsceneStudio.ready);await page.locator('#guides').uncheck();await page.evaluate(()=>cutsceneStudio.select(null));};
  const screenshot=async(t,name)=>{await page.evaluate(t=>cutsceneStudio.seek(t),t);await page.locator('#stage').screenshot({path:path.join(os.tmpdir(),'split-'+name+'.png')});};
  await open('opening');
  const cleanBackground=await page.evaluate(async()=>{
   const legacy=StudioMedia.assets.get('opening-disposal'),current=StudioMedia.assets.get('opening-disposal-clean');
   const digest=async url=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(url,{cache:'no-store'})).arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
   return {same:legacy.src===current.src,hash:await digest(current.src),fallbackHash:await digest('assets/opening/disposal.png'),legacyLuna:StudioMedia.assets.get('opening-luna-anchor').sheet};
  });
  assert.ok(cleanBackground.same);
  assert.equal(cleanBackground.hash,'ea9798152e00eed4e33353712d31bc81b6dd673902e9a849949ad000fd5d6b7d');
  assert.equal(cleanBackground.fallbackHash,cleanBackground.hash);
  assert.equal(cleanBackground.legacyLuna,'luna_idle');
  await page.evaluate(()=>{localStorage.setItem('unknown-cutscene-studio-v1','prior-main');localStorage.setItem('unknown-cutscene-studio-v1:opening:20261012-lab-v3','prior-opening');});
  const first=await page.evaluate(()=>{
   const p=cutsceneStudio.project;StudioModel.validate(p);
   const lines=p.clips.filter(c=>c.type==='dialogue'),home=p.clips.find(c=>c.actor==='house'),poses=p.clips.filter(c=>c.type==='visual'&&c.actor==='home-luna'),wake=poses[1].start;
   const interrupt=p.clips.find(c=>c.track==='interruption'),beneath=lines.find(c=>c.overlay);
   const sample=t=>StudioModel.sample(p,t).actors['home-luna'];
   return {issues:StudioModel.issues(p),duration:p.duration,count:lines.length,expected:StudioOpening.source.dream.length+StudioOpening.source.phone.length,
    noTV:!p.actors.tv&&!p.clips.some(c=>c.track==='tv-lines'||c.assetId?.startsWith('documentary-tv-')),
    fixedCameras:p.clips.filter(c=>c.type==='camera').every(c=>JSON.stringify(c.from)===JSON.stringify(c.to)),
    poses,home:home.start,wake,phone:p.chapters.at(-1).time,
    room:p.clips.find(c=>c.type==='visual'&&c.actor==='disposal'),camera:p.camera,
    actorMidpoint:(p.actors.yuna.x+p.actors['dream-luna'].x)/2,
    bubblesInFrame:lines.filter(c=>['dream-lines','interruption'].includes(c.track)).every(c=>{
     const s=StudioModel.sample(p,c.start+.1),a=s.actors[c.actor],cam=s.camera,g=document.createElement('canvas').getContext('2d');
     const w=c.bubbleWidth,h=Math.max(.45,StudioTypography.layout(g,c,w-.27,1).height+.22),x=a.x+(c.offsetX||0),y=a.y+c.offset;
     return x-w/2>cam.x-cam.w/2&&x+w/2<cam.x+cam.w/2&&y+h<cam.y+cam.w*9/32&&y-.05>cam.y-cam.w*9/32;
    }),
    samples:[sample(home.start+.1),sample(wake-.01),sample(wake+.01),sample(wake+1)],
    fadeOut:p.clips.find(c=>c.effect==='fadeOut'&&Math.abs(c.start+c.duration-wake)<.001),
    fadeIn:p.clips.find(c=>c.effect==='fadeIn'&&c.start===wake),
    alarm:p.clips.find(c=>c.assetId==='opening-alarm'),
    aligned:lines.filter(c=>['dream-lines','interruption'].includes(c.track)).every(c=>c.offsetX===0&&c.offset===.68),
    overlap:interrupt.start<beneath.start+beneath.duration&&interrupt.start>beneath.start};
  });
  assert.deepEqual(first.issues,[]);assert.equal(first.count,first.expected);assert.equal(first.count,20);
  assert.ok(first.noTV&&first.fixedCameras&&first.aligned&&first.overlap);
  assert.equal(first.room.scale,1.3);assert.equal(first.camera.w,4.8);assert.equal(first.camera.x,first.actorMidpoint);assert.ok(first.bubblesInFrame);
  assert.equal(first.poses.length,2);assert.equal(first.poses[0].start+first.poses[0].duration,first.wake);
  assert.ok(first.fadeOut&&first.fadeIn&&first.alarm.start<first.wake&&first.alarm.start+first.alarm.duration>first.wake);
  for(const pose of first.poses){assert.deepEqual(pose.from,pose.to);for(const prop of ['x','y','rotation'])assert.ok(!pose.keyframes?.[prop]||pose.keyframes[prop].every(k=>k.value===pose.keyframes[prop][0].value));}
  assert.equal(first.samples[0].rotation,-90);assert.equal(first.samples[1].rotation,-90);assert.equal(first.samples[2].rotation,0);assert.equal(first.samples[3].rotation,0);
  for(const [t,n]of [[first.home-10,'dream'],[first.home+1.8,'sleep'],[first.wake,'black'],[first.wake+.7,'awake'],[first.phone+2,'phone']])await screenshot(t,n);
  await page.evaluate(()=>cutsceneStudio.seek(2));await page.locator('#play').click();await page.waitForTimeout(900);
  assert.ok(await page.evaluate(()=>cutsceneStudio.time>2.4&&StudioMedia.activeVoices>0));await page.locator('#play').click();
  const roundtrip=async()=>{const saved=await page.evaluate(()=>JSON.stringify(cutsceneStudio.project));await page.locator('#file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(saved)});await page.locator('#confirm-replace').click();assert.equal(await page.evaluate(()=>JSON.stringify(cutsceneStudio.project)),saved);};
  await roundtrip();
  await open('documentary');
  const doc=await page.evaluate(()=>{
   const p=cutsceneStudio.project;StudioModel.validate(p);
   const lines=p.clips.filter(c=>c.type==='dialogue'),boards=p.clips.filter(c=>c.type==='visual');
   const cv=document.createElement('canvas');cv.width=1280;cv.height=720;const g=cv.getContext('2d');
   let centered=true;
   for(const c of lines){const state=StudioModel.sample(p,c.start+.1),a=state.actors.tv,asset=StudioMedia.assets.get(a.assetId),w=asset.fw/asset.ppu*a.scale,rows=new Map();
    const original=g.fillText;g.fillText=function(text,x,y){const row=rows.get(y)||{left:x,right:x};row.left=Math.min(row.left,x);row.right=Math.max(row.right,x+this.measureText(text).width);rows.set(y,row);};
    // Centering is measured on the completed subtitle, not its typed prefix.
    StudioOpening.dialogue(g,c,state,state.camera,c.start+.1,0,true);g.fillText=original;
    centered&&=[...rows.values()].every(r=>Math.abs((r.left+r.right)/2-w/2)<.015);
   }
   return {issues:StudioModel.issues(p),duration:p.duration,texts:lines.map(c=>c.text),source:StudioOpening.source.tv,centered,
    separate:Object.keys(p.actors).length===1&&!p.clips.some(c=>c.actor==='house'||c.track==='alarm-audio'),
    longest:lines.reduce((a,b)=>a.text.length>b.text.length?a:b).start,
    assets:boards.map(c=>{const a=StudioMedia.assets.get(c.assetId),im=StudioMedia.getImage(c.assetId),s=StudioModel.sample(p,c.start+.01),w=a.fw/a.ppu*c.scale,h=a.fh/a.ppu*c.scale;return {src:a.src,start:c.start,loaded:im.complete&&im.naturalWidth===1672,full:!a.captionBand&&w>=s.camera.w&&h>=s.camera.w*9/16};})};
  });
  assert.deepEqual(doc.issues,[]);assert.deepEqual(doc.texts,doc.source);assert.equal(doc.texts.length,33);assert.ok(doc.centered&&doc.separate);
  assert.deepEqual(doc.assets.map(a=>a.src),['care','self','war','aftermath','treaty'].map(n=>'assets/opening/documentary-'+n+'.png'));
  assert.ok(doc.assets.every(a=>a.loaded&&a.full));
  for(const [i,a]of doc.assets.entries())await screenshot(a.start+2,'documentary-'+i);
  await screenshot(doc.longest+.5,'documentary-long');
  await page.evaluate(()=>{cutsceneStudio.select(null);cutsceneStudio.add('dialogue');StudioModel.validate(cutsceneStudio.project);});await page.locator('#undo').click();
  await roundtrip();await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);
  assert.equal(await page.evaluate(()=>cutsceneStudio.project.template),'documentary');
  assert.equal(await page.evaluate(()=>localStorage.getItem('unknown-cutscene-studio-v1')),'prior-main');
  assert.equal(await page.evaluate(()=>localStorage.getItem('unknown-cutscene-studio-v1:opening:20261012-lab-v3')),'prior-opening');
  await open('opening');assert.equal(await page.evaluate(()=>cutsceneStudio.project.template),'opening');
  assert.deepEqual(errors,[]);
  console.log('PASS split opening:',first.count,'lines /',first.duration,'s; documentary:',doc.texts.length,'lines /',doc.duration,'s; full-frame, centered subtitles, blackout pose swap, audio, JSON, draft isolation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
