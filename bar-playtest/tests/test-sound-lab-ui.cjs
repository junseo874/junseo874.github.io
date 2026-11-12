const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
await p.addInitScript(()=>{window.audioStarts=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){audioStarts.push({args,frame:document.querySelector('.serve-canvas')?.dataset.frame});return start.apply(this,args);};});
await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
await p.getByRole('link',{name:'사운드',exact:true}).click();await p.locator('#open-serve').click();await p.waitForFunction(()=>!document.querySelector('[data-version]').disabled);
for(let i=0;i<3;i++){
 await p.locator('[data-version="'+i+'"]').click();await p.waitForFunction(()=>LunaSoundLab.playing);
 await p.waitForFunction(()=>!LunaSoundLab.playing);
 assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),'29');
 assert.equal(await p.locator('#stage').getAttribute('data-sound-version'),String(i+1));
}
assert.deepEqual(await p.evaluate(()=>audioStarts.map(x=>x.args[1])),[.40,.85,.20]);
assert.deepEqual(await p.evaluate(()=>audioStarts.map(x=>x.args[2])),[1.50,1.35,1.25]);
assert.equal(await p.evaluate(()=>LunaSoundLab.animationSpeed),1);
assert(await p.evaluate(()=>LunaSoundLab.profiles.every(p=>!p.file.includes('edited/'))));
assert(await p.evaluate(()=>audioStarts.every(x=>!x.frame||x.frame==='0')));
await p.locator('#drink').selectOption('dry_martini');await p.waitForFunction(()=>LunaSoundLab.playing);await p.waitForFunction(()=>!LunaSoundLab.playing);
assert((await p.locator('.serve-canvas').getAttribute('data-source')).includes('drymartini'));
await p.screenshot({path:'/tmp/luna-sound-lab.png'});
await p.locator('#replay').click();await p.waitForFunction(()=>LunaSoundLab.playing);await p.locator('#stop').click();assert.equal(await p.evaluate(()=>LunaSoundLab.playing),false);
await p.setViewportSize({width:760,height:850});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);console.log('SOUND_LAB_OK: simulator link, three timed variants, frame 29, source offsets, replay/stop, drink change, responsive layout');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
