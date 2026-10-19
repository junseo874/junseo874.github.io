const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 assert(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('outside-radio-lights.js'));
 assert(!fs.readFileSync(path.join(root,'src/features/outside/outside.js'),'utf8').includes('LunaRadioLights'));
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='B_Fore_Building_1');
   m.start({day:3,flow:'out',place:'bar'});m.x=n.x+(523-n.sprite.w*n.sprite.pivot.x)/n.sprite.ppu;
   m.story.cancel();m.backgroundStory.cancel();a.snapCamera();a.tick(0);
  });
  await p.waitForTimeout(200);
  assert(await p.evaluate(()=>typeof LunaRadioLights==='undefined'));
  assert(await p.evaluate(()=>LunaStreetSigns.signs.length===19&&typeof LunaStreetSigns.faultLevel==='function'));
  assert(!requests.some(url=>url.includes('outside-radio-lights')));
  await p.screenshot({path:'/private/tmp/radio-lamps-static.png'});
  assert.deepEqual(errors,[]);console.log('PASS communication blink renderer and asset load removed; original building retained; 19 other sign lights remain; no runtime errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
