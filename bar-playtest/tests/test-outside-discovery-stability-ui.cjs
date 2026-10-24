const assert=require('node:assert/strict');
const runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  for(const dpr of [1,2]){
   const page=await browser.newPage({viewport:{width:973,height:650},deviceScaleFactor:dpr}),errors=[];
   page.on('pageerror',e=>errors.push(e.stack));
   await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
   if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
   await page.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();});
   for(const viewport of [{width:973,height:650},{width:1280,height:720}]){
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const result=await page.evaluate(()=>{
     const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood,D=LunaOutsideDiscovery,C=LunaPixelCamera;
     const ok=(v,label)=>{if(!v)throw Error(label);},close=(a,b)=>Math.abs(a-b)<1e-6;
     barGame.progress.flags={gang_pass_granted:true};
     m.start({day:1,flow:'out',place:'bar'});m.controlsTutorial=false;m.paused=false;
     // Facing and every idle cell must leave the badge's world anchor unchanged.
     for(const actor of ['repair','boss']){
      const t=m.targets().find(t=>t.actor===actor),heads=[];
      for(const side of [-1,1])for(let frame=0;frame<18;frame++){
       m.x=t.x+side*.2;m.time=frame/24;
       heads.push(N.targetAnchor(m,t,true));
      }
      ok(heads.every(h=>close(h.x,t.x)&&close(h.y,heads[0].y)),'stable facing/idle anchor: '+actor);
     }
     // A stationary badge must translate exactly with the sprite's raster grid,
     // not a second logical-pixel grid, during horizontal AND vertical pans.
     const t=m.targets().find(t=>t.actor==='repair');m.x=t.x+.2;
     const pose=N.poses(m).find(p=>p.id==='repair'),head=N.targetAnchor(m,t,true),f=a.pixelSurface.factor;
     const ctx={save(){},restore(){},fillText(){}},offsets=[];
     for(let i=0;i<80;i++){
      const cam=C.view({x:t.x-.13+i*.0017,y:i*.0019,w:4.8},a.pixelSurface,{qa:true});
      const marker=D.draw(ctx,m,[t],(x,y)=>D.project({x,y},pose,cam,a.pixelSurface),()=>head,f)[0];
      const sp=C.sprite(pose.sp,pose.x,pose.y,pose.scale,pose.scale,pose.flip,cam,a.pixelSurface);
      ok(close(marker.x*f,Math.round(marker.x*f))&&close(marker.y*f,Math.round(marker.y*f)),'physical-pixel text alignment');
      offsets.push({x:(marker.x-sp.x)*f,y:(marker.y-sp.y)*f});
     }
     ok(offsets.every(o=>close(o.x,offsets[0].x)&&close(o.y,offsets[0].y)),'badge moves with sprite without independent pixel steps');
     // Exercise the actual model, camera easing and renderer, crossing the NPC
     // in both directions rather than testing an isolated anchor alone.
     m.x=t.x-.245;m.updateNear();a.snapCamera();a.tick(0);
     let frames=0,minX=m.x,maxX=m.x;
     for(const move of [1,-1])for(let i=0;i<70;i++){
      m.tick(.01,{move});a.tick(.01);
      const marker=a.discoveryMarkers.find(v=>v.id===t.id),cam=a.renderCamera,head=N.targetAnchor(m,t,true);
      ok(marker,'badge remains visible while walking nearby');
      const pose=N.poses(m).find(p=>p.id===t.actor),p=D.project(head,pose,cam,a.pixelSurface),f=a.pixelSurface.factor;
      ok(close(marker.x,Math.round(p.x*f+1e-7)/f)&&close(marker.y,Math.round((p.y-22)*f+1e-7)/f),'live marker stays attached');
      minX=Math.min(minX,m.x);maxX=Math.max(maxX,m.x);frames++;
     }
     ok(minX<t.x-.2&&maxX>t.x+.2,'player actually crosses NPC both ways');
     return {factor:f,frames,minX,maxX};
    });
    console.log('PASS stable discovery markers',dpr,viewport,result);
   }
   await page.screenshot({path:'/private/tmp/discovery-stable-dpr'+dpr+'.png'});
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
