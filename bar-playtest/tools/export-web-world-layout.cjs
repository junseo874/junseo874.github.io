/* Export the effective website placement, not a second hand-maintained copy. */
const fs=require('node:fs'),path=require('node:path'),{load,chrome}=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await load('playwright').chromium.launch({executablePath:chrome,headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.WEB_URL||'http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.waitForFunction(()=>window.LUNA_OUTSIDE_DATA?.engineWorldVersion&&window.lunaCampaign);
  const data=await page.evaluate(()=>LunaEngineWorld.exportLayout(LUNA_OUTSIDE_DATA));
  if(errors.length)throw new Error(errors.join('\n'));
  const text=JSON.stringify(data,null,2)+'\n';
  if(process.argv.includes('--write')){
   const file=path.resolve(__dirname,'../data/presentation/web-world-layout.json');fs.writeFileSync(file,text);console.log(file);
  }else process.stdout.write(text);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
