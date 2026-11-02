const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 // Isolate the manually sampled arrival clock from real-time camera CSS motion.
 await p.addStyleTag({content:'* { animation:none!important; transition:none!important; }'});
 for(const text of ['안녕.','안녕하세요. 처음 왔는데 여기 앉아도 괜찮을까요?']){
  const rows=await p.evaluate(text=>{
   const g=barGame;g.reset(99,'general',42,true);Object.assign(g,{tutorial:null,overlay:null,transition:0,cameraLeft:0,cameraMoving:false,paused:true,spawnLeft:999,story:null});
   g.seats={L:null,M:null,R:null};g.queue=[{personality:'gentle',order:'gin_tonic',max_rounds:1}];g.queueIndex=0;g.spawn();
   const guest=Object.values(g.seats).find(Boolean);g.focus=guest.seat;guest.lines=[g.makeLine(guest.actor,text)];guest.lineIndex=0;
   const origin=g.realTime,rows=[];let previous=0;
   for(const t of [0,.2,.64,.65,.66,.675,.7,.8,.9,1.1]){
    g.realTime=origin+t;g.tickGeneral(t-previous);previous=t;g.cameraLeft=0;g.cameraMoving=false;lunaCampaign.render(true);
    const actor=document.querySelector('.actor.pixel-actor'),line=guest.lines[0];
    rows.push({t,chars:line.chars,hold:line.hold,visible:!!g.currentDialogue(),opacity:+actor.style.opacity,talking:actor.dataset.talking,frame:+actor.querySelector('[data-layer*="talk_mouth"]').dataset.frame});
   }return rows;
  },text);
  for(const r of rows.filter(r=>r.t<.65)){assert.equal(r.chars,0);assert.equal(r.hold,0);assert(!r.visible);assert.equal(r.talking,'false');}
  const start=rows.find(r=>r.t===.65);assert(start.visible);assert.equal(start.opacity,1);assert.equal(start.chars,0);assert.equal(start.talking,'true');assert.equal(start.frame,0);
  assert(rows.some(r=>r.t>.65&&r.chars>0));
  if(text.length>10)assert(new Set(rows.filter(r=>r.talking==='true').map(r=>r.frame)).size>1);
 }
 assert.deepEqual(errors,[]);console.log('GUEST_ARRIVAL_SPEECH_UI_OK: short/long greetings stay hidden and untyped during fade, then speech and mouth start at full opacity.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
