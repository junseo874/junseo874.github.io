const assert=require('node:assert/strict');
const deps='/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),sharp=require(deps+'sharp');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio','--disable-gpu']});
 try{
  let checks=0;
  for(const dpr of [1,2]){
   const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:dpr}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
   async function audit(name,width,height){
    await p.setViewportSize({width,height});await p.waitForTimeout(90);
    const w=Math.min(width,height*16/9),h=w*9/16,x=(width-w)/2,y=(height-h)/2;
    const png=await p.screenshot({scale:'css'}),{data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});let outside=0,bad=0,inside=0;
    for(let py=0;py<height;py++)for(let px=0;px<width;px++){const i=(py*width+px)*info.channels,lit=data[i]||data[i+1]||data[i+2];if(px+1<x||px>x+w||py+1<y||py>y+h){outside++;if(lit)bad++;}else if(lit)inside++;}
    assert.equal(bad,0,name+' outside must be RGB(0,0,0), DPR '+dpr);assert(inside>100,name+' must not black out the game');if(width/height!==16/9)assert(outside>0);
    const borders=await p.locator('#game-letterbox>i').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.opacity,s.transitionDuration,s.animationName];}));assert(borders.every(s=>s[0]==='rgb(0, 0, 0)'&&s[1]==='1'&&s[2]==='0s'&&s[3]==='none'));checks++;
    return {x,y,w,h};
   }
   for(const [w,h]of [[1440,900],[1920,800],[390,844]]){
    const frame=await audit('native update dialog',w,h),r=await p.locator('.updates-dialog').boundingBox();assert(r&&r.y>=frame.y&&r.y+r.height<=frame.y+frame.h,'Update controls remain in aperture');assert(await p.locator('.updates-confirm').isVisible());
   }
   await p.locator('.updates-dismiss input').check();await p.locator('.updates-confirm').click();
   await p.evaluate(()=>lunaCampaign.screen('title'));
   for(const [w,h]of [[1280,720],[900,900],[1920,800],[1001,777]])await audit('title',w,h);
   await p.evaluate(()=>lunaCampaign.screen('options'));await audit('settings',1440,900);
   await p.evaluate(()=>{lunaCampaign.developer();barGame.reset(99,'practice',1);});await audit('bar preparation',1440,900);
   await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await p.evaluate(()=>lunaCampaign.screen('developer'));assert(await p.locator('#campaign-root').isHidden());await audit('street',1920,800);
   await p.evaluate(()=>{outsidePlaytest.model.paused=true;outsidePlaytest.refreshHUD();});await audit('street pause',900,900);assert(await p.locator('#campaign-root').isHidden());await p.evaluate(()=>{outsidePlaytest.model.paused=false;outsidePlaytest.refreshHUD();});
   const input=await p.evaluate(()=>({outside:document.elementFromPoint(10,10)?.parentElement?.id,inside:document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#game-letterbox')?.id}));assert.equal(input.outside,'game-letterbox');assert(!input.inside,'Matte must not intercept gameplay');
   // Stress fades, debug overlays and dragged art beneath the permanent matte.
   await p.evaluate(()=>{const e=document.createElement('div');e.id='letterbox-test-flash';e.style.cssText='position:fixed;inset:0;background:#fff;z-index:2147483646;pointer-events:none';document.body.append(e);});
   for(const [w,h]of [[1440,900],[1920,800],[390,844],[1001,777]])await audit('full-viewport white transition',w,h);
   await p.evaluate(()=>document.querySelector('#letterbox-test-flash').remove());
   await p.setViewportSize({width:1440,height:900});await p.screenshot({path:'/private/tmp/letterbox-black-'+dpr+'.png',scale:'css'});
   assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS pure black outside 16:9:',checks,'pixel audits; DPR 1/2, wide/tall/portrait/fractional sizes, native dialog, title, bar, street, pause and white fades');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
