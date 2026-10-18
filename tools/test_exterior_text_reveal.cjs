const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
 let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 fs.readFile(file,(err,body)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'not found':body);});
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/bar-playtest/`);
 await page.evaluate(()=>document.fonts.ready);
 const report=await page.evaluate(()=>{
  const host=document.createElement('section');host.id='outside-root';document.body.append(host);
  const examples=['네.','고마워! 사람 보는 눈이 있네. 내가 이 은혜는 꼭 갚을게.',
   '테스트 텍스트 가나다라 한줄은 이렇게','테스트 텍스트 가나다라 마바사 아자차카 타파하 !?\n두줄도 가능합니다 가능하면 가운데 정렬 기본으로~',
   '150원만 주면 내가 열 배로 불려 주지. 공공질서 혼란, 공무집행 방해!','정말길어서한줄에들어가지않는단어도중간에튕기지않아야합니다',
   'Wait until the complete sentence wraps before revealing its first word.', '첫 줄\n\n셋째 줄 😊 <>&'];
  let checks=0,oldJumps=0;
  const box=el=>{const b=el.getBoundingClientRect();return [b.x,b.y,b.width,b.height].map(n=>Math.round(n*100)/100);};
  for(const background of [false,true])for(const width of [180,280,420])for(const scale of [.8,1,1.7])for(const full of examples){
   const el=document.createElement('div');el.className=background?'outside-background-speech':'outside-speech';
   el.style.cssText=`left:640px;top:500px;max-width:${width}px;transform:translate(-50%,-100%) scale(${scale})`;
   el.innerHTML=LunaExteriorTextbox.html()+'<p></p>';host.append(el);const p=el.querySelector('p');
   LunaExteriorTextbox.mountText(p,full,['150원','공공집행','공공질서 혼란'],background);
   const chars=[...p.firstChild.children],expected=chars.map(box),outer=box(el);
   for(let count=0;count<=chars.length;count++){
    LunaExteriorTextbox.revealText(p,count);
    if(JSON.stringify(box(el))!==JSON.stringify(outer))throw Error('Bubble resized: '+full);
    chars.forEach((ch,i)=>{
     if(JSON.stringify(box(ch))!==JSON.stringify(expected[i]))throw Error('Glyph moved: '+full+' @'+count);
     if(getComputedStyle(ch).visibility!==(i<count?'visible':'hidden'))throw Error('Incorrect reveal');
    });checks++;
   }
   LunaExteriorTextbox.revealText(p,0);LunaExteriorTextbox.revealText(p,chars.length);
   if(p.textContent!==full||p.getAttribute('aria-label')!==full)throw Error('Text changed');
   if(p.scrollWidth>p.clientWidth+1)throw Error('Text overflow: '+full);
   el.remove();
  }
  // Prove the fixture detects the old prefix-only line/centering movement.
  const old=document.createElement('div');old.className='outside-speech';old.innerHTML='<p><span class="outside-speech-measure"></span><span></span></p>';host.append(old);
  const p=old.querySelector('p'),ink=p.lastChild,full=examples[1];p.firstChild.textContent=full;
  let previous=null;
  for(let n=1;n<=full.length;n++){ink.textContent=full.slice(0,n);const r=document.createRange();r.setStart(ink.firstChild,0);r.setEnd(ink.firstChild,1);const b=box({getBoundingClientRect:()=>r.getBoundingClientRect()});if(previous&&JSON.stringify(b)!==JSON.stringify(previous))oldJumps++;previous=b;}
  host.remove();return{checks,oldJumps};
 });
 assert(report.oldJumps>0,'Must reproduce old movement');
 await page.locator('[data-campaign="developer"]').click();
 await page.locator('.updates-confirm').click();
 await page.evaluate(async()=>{LunaFocusSettings.enabled=false;await outsidePlaytest.start();});
 await page.waitForFunction(()=>!outsidePlaytest.loading&&!outsidePlaytest.loadError);
 const integration=await page.evaluate(()=>{
  const o=outsidePlaytest,m=o.model,full='고마워! 사람 보는 눈이 있네. 내가 이 은혜는 꼭 갚을게.';
  m.paused=false;m.controlsTutorial=null;
  m.story.beginRows('wrap-regression',{x:m.x,y:m.y},[{type:'say',actor:'luna',text:full,emphasis:['은혜']}]);
  const rects=()=>[...document.querySelectorAll('#outside-root .outside-speech-text>span')].map(el=>{const r=el.getBoundingClientRect();return[r.x,r.y,r.width,r.height];});
  o.refreshHUD();const initial=rects(),nodes=[...document.querySelectorAll('#outside-root .outside-speech-text>span')];
  for(let i=0;i<=Array.from(full).length;i++){
   m.story.speech.elapsed=(i+.01)/LunaOutsideStory.cps;o.refreshHUD();
   if(JSON.stringify(initial)!==JSON.stringify(rects()))throw Error('Runtime text moved');
   if(nodes.some((el,j)=>el!==document.querySelectorAll('#outside-root .outside-speech-text>span')[j]))throw Error('Runtime rebuilt text');
   const cue=document.querySelector('#outside-root .outside-speech .dialogue-advance-cue');
   if(Boolean(cue&&!cue.hidden)!== (i===Array.from(full).length))throw Error('Advance cue timing');
  }
  m.story.speech.elapsed=0;o.refreshHUD();m.story.advance();o.refreshHUD();
  if([...nodes].some(el=>el.style.visibility!=='visible'))throw Error('Skip reveal failed');
  return nodes.length;
 });
 await page.locator('#outside-root .outside-speech').waitFor({state:'visible'});
 await page.screenshot({path:'/private/tmp/exterior-text-stable-reveal.png'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',...report,runtimeGlyphs:integration}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
