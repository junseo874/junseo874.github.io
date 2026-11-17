const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  const limits=await page.evaluate(async()=>{
   const c=lunaCampaign,o=outsidePlaytest;c.session.install({developer:false});barGame.reset(0,'full',1,false);
   c.session.day=0;c.session.carry=structuredClone(barGame.progress);Object.assign(o.config,{day:0,flow:'out',place:'homeDoor'});
   await o.start();c.screen(c.playView);
   const m=o.model,n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-foreground-fade');
   const left=LunaResidence.layout.upperMin+.16,right=n.x+8.54*n.sx;
   m.x=left;o.snapCamera();const paint=LunaOutsideArt.paintCorridorForeground;window.samples=[];
   LunaOutsideArt.paintCorridorForeground=(ctx,img,sp,rect,actor,model)=>{
    const draws=[];paint({get globalAlpha(){return ctx.globalAlpha;},set globalAlpha(v){ctx.globalAlpha=v;},
     drawImage(...args){draws.push(ctx.globalAlpha);ctx.drawImage(...args);}},img,sp,rect,actor,model);
    if(actor)samples.push({u:(m.x-n.x)*100/n.sx,draws});
   };
   return {left,right};
  });
  for(const [key,end,sign]of [['KeyD',limits.right,1],['KeyA',limits.left,-1]]){
   await page.evaluate(()=>{samples.length=0;outsidePlaytest.tick(0);});
   if(sign<0)await page.keyboard.down('ShiftLeft');
   await page.keyboard.down(key);try{await page.waitForFunction(([end,s])=>(outsidePlaytest.model.x-end)*s>=0,[end,sign],{timeout:25000});}
   finally{await page.keyboard.up(key);if(sign<0)await page.keyboard.up('ShiftLeft');}
   const frames=await page.evaluate(()=>samples.filter(s=>s.draws.length===3));
   assert(frames.some(({draws:[l,c,p]})=>l<.55&&c===1&&p===1),'left leg only');
   const approach=frames.filter(s=>s.u>695&&s.u<730);
   assert(approach.length&&approach.every(s=>s.draws.every(a=>a===1)),'near the column but not touching');
   assert(frames.some(({draws:[l,c,p]})=>l===1&&c>.28&&c<.95&&p===1),'first partial overlap');
   assert(frames.some(({draws:[l,c,p]})=>l===1&&c<.26&&p===1),'thick column alone');
   assert(frames.some(({draws:[l,c,p]})=>l===1&&c===1&&p<.8),'narrow pipe alone');
  }
  const edges=await page.evaluate(()=>{
   const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
   const art=canvas(861,119),g=art.getContext('2d'),image=canvas(40,12),body=image.getContext('2d');
   g.fillRect(10,0,20,2);g.fillRect(10,2,3,18);g.fillRect(756,5,20,10);g.fillRect(845,5,10,10);body.fillRect(11,2,4,8);
   const sp={x:0,y:0,w:861,h:119,pivot:{x:0,y:1}},frame={x:10,y:0,w:20,h:12,pivot:{x:.5,y:1}};
   function at(x,y,flip=false,clock={story:{},time:0}){
    const alpha=[],ctx={globalAlpha:1,drawImage(){alpha.push(this.globalAlpha);}};
    LunaOutsideArt.paintCorridorForeground(ctx,art,sp,{x:0,y:0,w:861,h:119},{image,frame,flip,box:{x,y,w:20,h:12}},clock);
    return alpha;
   }
   function transition(steps){
    const clock={story:{},time:0};at(820,4,false,clock);
    function sample(x,t){clock.time=t;return at(x,4,true,clock)[1];}
    for(let i=1;i<steps;i++)sample(761,.08*i/steps);
    return [sample(761,.08),sample(761,.08),sample(761,.28),sample(1200,.36),sample(1200,.52)];
   }
   return [at(761,4),at(761.5,4),at(761,4,true),at(761,14,true),at(820,4),at(852,4),at(28,4),at(20,4),at(761,150),transition(2),transition(8)];
  });
  // Atlas padding alone overlaps; then half a pixel, a mirrored body, a body
  // below the obstacle (descending lift), the empty gap, and the pipe.
  assert.deepEqual(edges[0],[1,1,1]);assert(edges[1][1]<1&&edges[1][1]>.24);
  assert.deepEqual(edges[2],[1,.24,1]);assert.deepEqual(edges[3],[1,1,1]);
  assert.deepEqual(edges[4],[1,1,1]);assert.deepEqual(edges[5],[1,1,.24]);
  assert.deepEqual(edges[6],[1,1,1]);assert.deepEqual(edges[7],[.24,1,1]);assert.deepEqual(edges[8],[1]);
  for(const sequence of edges.slice(9))for(const [i,v] of [.316,.316,.24,.924,1].entries())assert(Math.abs(sequence[i]-v)<1e-7);
  assert.deepEqual(errors,[]);console.log('PASS real corridor round trip, precise alpha contact, independent pieces, empty gaps, facing and height');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
