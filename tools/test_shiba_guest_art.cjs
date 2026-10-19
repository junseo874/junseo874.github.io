const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {PNG}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const {chromium}=require('./lib/test-runtime.cjs').load('playwright');
const root=path.resolve(__dirname,'..'),base=path.join(root,'bar-playtest'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'};
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'data/runtime/game-data.js'),'utf8'),scope);
const D=scope.window.LUNA_DATA,original=JSON.stringify(D.characterLayers);vm.runInNewContext(fs.readFileSync(path.join(base,'src/features/bar/bar-guest-art.js'),'utf8'),scope);
const art=D.assets.char_shiba_static,png=PNG.sync.read(fs.readFileSync(path.join(base,art.src)));let bounds=[png.width,png.height,0,0];
for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3])bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x+1),Math.max(bounds[3],y+1)];
assert.deepEqual(Array.from(art.alphaBBox),bounds);assert.equal(D.webTableAnchors.shiba,bounds[3]);assert.equal(art.displayScale||1,1);
for(const [id,layers]of Object.entries(JSON.parse(original)))if(!['shiba','tom'].includes(id))assert.equal(JSON.stringify(D.characterLayers[id]),JSON.stringify(layers));
const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(e?'not found':b);});});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:require('./lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/bar-playtest/`);await page.locator('[data-campaign="developer"]').click();await page.locator('.updates-confirm').click();
 await page.evaluate(()=>{const g=barGame;g.reset(99,'general',7);g.phase='general';g.screen='bar';g.queue=[{character:'shiba',personality:'gentle',max_rounds:1}];g.queueIndex=0;g.seats={L:null,M:null,R:null};g.spawn();const guest=g.seats[g.focus];guest.seated=true;guest.left=999;guest.limit=999;g.changed();});
 const actor=page.locator('.actor[data-actor="shiba"]');await actor.waitFor();await page.waitForTimeout(800);
 assert.equal(await actor.getAttribute('data-table-anchor'),'422');
 const layer=actor.locator('.actor-layer');assert.equal(await layer.count(),1);
 assert((await layer.evaluate(el=>getComputedStyle(el).backgroundImage)).includes('char-shiba-idle-20261019.png'));
 assert.equal(await layer.evaluate(el=>el.style.width),'100%');assert.equal(await layer.evaluate(el=>el.style.height),'100%');
 await page.evaluate(()=>{const g=barGame,guest=g.seats[g.focus];g.setBarks(guest,['call']);g.dialogSpeed=.1;g.changed();});await page.waitForTimeout(80);
 assert((await layer.evaluate(el=>getComputedStyle(el).backgroundImage)).includes('char-shiba-idle-20261019.png'));
 await page.screenshot({path:'/private/tmp/shiba-new-bar-guest.png'});
 for(const size of [{width:640,height:360},{width:1920,height:1080}]){await page.setViewportSize(size);await page.waitForTimeout(80);assert(await actor.isVisible());assert.equal(await actor.getAttribute('data-table-anchor'),'422');}
 assert.deepEqual(errors,[]);console.log('PASS: PNG alpha bounds, native canvas/scale, table anchor, unchanged other guest layers, live bar guest idle/talk art, three viewport sizes.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
