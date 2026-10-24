const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const runtime=require('../../tools/lib/test-runtime.cjs'),{chromium}=runtime.load('playwright');
const asset=fs.readFileSync(path.resolve(__dirname,'../assets/ui/imported/money.png'));
assert.equal(crypto.createHash('sha256').update(asset).digest('hex'),'a68bcda5c0d8a112fba6a4b18cf26a142157d917b96ca752531b69fe6b7d1659','Supplied IMG_money original bytes');
(async()=>{const b=await chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.emulateMedia({reducedMotion:'reduce'});
 let checks=0;
 async function inspect(scope,amount,width){
  const hud=p.locator(scope+' .currency-hud');await hud.waitFor();
  await p.waitForFunction(({scope,text})=>document.querySelector(scope+' .currency-value')?.textContent===text,{scope,text:amount.toLocaleString('en-US')});
  const info=await hud.evaluate(async el=>{const im=el.querySelector('.currency-art');await im.decode();const r=el.getBoundingClientRect(),a=im.getBoundingClientRect(),text=el.querySelector('.currency-value'),n=text.getBoundingClientRect(),css=getComputedStyle(el);return{src:im.getAttribute('src'),native:[im.naturalWidth,im.naturalHeight],ratio:a.width/a.height,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},fits:n.left>=r.left+r.width*.28&&n.right<=r.right&&n.top>=r.top&&n.bottom<=r.bottom,text:text.textContent,svg:el.querySelectorAll('svg').length,border:css.borderWidth,radius:css.borderRadius,background:css.backgroundColor,shadow:css.boxShadow};});
  assert.equal(info.src,'assets/ui/imported/money.png');assert.deepEqual(info.native,[542,108]);assert(Math.abs(info.ratio-542/108)<.01);
  assert.equal(info.text,amount.toLocaleString('en-US'));assert(info.fits,JSON.stringify(info));assert.equal(info.svg,0);assert.equal(info.border,'0px');assert.equal(info.radius,'0px');assert.equal(info.background,'rgba(0, 0, 0, 0)');assert.equal(info.shadow,'none');
  assert(info.rect.x>=0&&info.rect.y>=0&&info.rect.right<=width+1&&info.rect.bottom<=width*9/16+1);checks++;
 }
 for(const variant of ['original','gpt'])for(const width of [640,1280,1920]){
  await p.setViewportSize({width,height:width*9/16});
  await p.evaluate(variant=>{lunaCampaign.ui.variant=variant;barGame.reset(99,'practice',1,true,{variant});barGame.screen='bar';barGame.speed=0;},variant);await p.waitForTimeout(100);
  for(const amount of [1234,999999999,0]){await p.evaluate(amount=>{barGame.progress.money=amount;barGame.changed();},amount);await inspect('#app',amount,width);}
 }
 await p.setViewportSize({width:1280,height:720});
 for(const main of [false,true]){
  await p.evaluate(async main=>{outsidePlaytest.exit(true);lunaCampaign.session.install({developer:!main});barGame.reset(2,'full',1,false);Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'bar'});await outsidePlaytest.start();lunaCampaign.screen(lunaCampaign.playView);outsidePlaytest.tick(0);},main);
  for(const amount of [1234,999999999,0]){await p.evaluate(amount=>{barGame.progress.money=amount;outsidePlaytest.tick(0);},amount);await inspect('#outside-root',amount,1280);}
  if(main){await p.evaluate(()=>{barGame.progress.money=1234;outsidePlaytest.tick(0);});await p.screenshot({path:'/private/tmp/currency-new-art-outside.png'});}
 }
 const manifest=await p.evaluate(async()=>await(await fetch('data/presentation/preload-manifest.json')).json());assert(manifest.common.includes('assets/ui/imported/money.png'));
 assert.deepEqual(errors,[]);console.log('CURRENCY_ART_OK',checks,'native-art/aspect/number/viewport checks, bar original/remix + main/developer exterior, exact source bytes and preload.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
