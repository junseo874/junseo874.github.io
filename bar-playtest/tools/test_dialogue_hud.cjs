const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
 await p.evaluate(()=>barGame.reset(99,'general',7));await p.waitForTimeout(200);
 assert.equal(await p.locator('.center-hint').count(),0);assert.equal(await p.locator('.currency-value').textContent(),'300');
 assert.equal(await p.locator('.currency-hud svg').count(),1);
 for(const value of [0,9999,1234567]){await p.evaluate(value=>barGame.progress.money=value,value);await p.waitForTimeout(100);assert.equal(await p.locator('.currency-value').textContent(),value.toLocaleString('en-US'));}
 await p.screenshot({path:'/private/tmp/bar-hud-empty.png'});
 await p.evaluate(()=>{for(let i=0;i<60;i++)barGame.tick(.1);const g=barGame.seats.L;barGame.progress.money=9999;barGame.dialogSpeed=.001;g.lines=[barGame.makeLine(g.actor,'오늘은 진토닉으로 부탁할게요.')];g.lineIndex=0;g.lines[0].chars=0;});
 await p.waitForTimeout(700);const initial=await p.locator('.dialogue-box').boundingBox();
 assert.equal(initial.width,538);assert.equal(initial.height,124);
 assert.equal(await p.locator('.dialogue-text').evaluate(e=>getComputedStyle(e).fontSize),'18px');
 assert.equal(await p.locator('.speaker').textContent(),'손님');
 await p.evaluate(()=>barGame.seats.L.lines[0].chars=10);await p.waitForTimeout(150);assert.deepEqual(await p.locator('.dialogue-box').boundingBox(),initial);
 await p.evaluate(()=>barGame.seats.L.lines[0].chars=barGame.seats.L.lines[0].text.length);await p.waitForTimeout(150);assert.deepEqual(await p.locator('.dialogue-box').boundingBox(),initial);
 await p.screenshot({path:'/private/tmp/bar-hud-guest.png'});
 for(const [width,height] of [[1742,981],[1920,1080],[820,650],[600,800],[1280,720]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(100);
  const measure=await p.evaluate(()=>{const shell=document.querySelector('.app-shell').getBoundingClientRect(),hud=document.querySelector('.currency-hud').getBoundingClientRect(),help=document.querySelector('.help-corner').getBoundingClientRect(),dot=document.querySelector('.seat-indicators span').getBoundingClientRect(),box=document.querySelector('.dialogue-box').getBoundingClientRect();return {fits:hud.right<=shell.right&&hud.top>=shell.top,helpFits:help.left>=shell.left&&help.top>=shell.top&&help.right<hud.left,noNav:!document.querySelector('.topbar'),ratio:box.width/shell.width,dot:dot.width/shell.width};});
  assert(measure.fits&&measure.helpFits&&measure.noNav);assert(Math.abs(measure.ratio-538/1280)<.001);assert(Math.abs(measure.dot-14/1280)<.001);
 }
 await p.evaluate(()=>{barGame.reset(99,'practice',1);barGame.screen='bar';barGame.phase='regular';barGame.seats={L:{actor:'port',state:'STORY'},M:null,R:null};barGame.dialogue=barGame.makeLine('port','루나, 오늘은 어떤 칵테일을 추천해 주겠나?');barGame.dialogue.chars=100;});
 await p.waitForTimeout(750);assert.equal(await p.locator('.dialogue-next').innerText(),'▼');await p.screenshot({path:'/private/tmp/bar-hud-regular.png'});
 const guestY=(await p.locator('.dialogue-box').boundingBox()).y;
 await p.evaluate(()=>{barGame.dialogue=barGame.makeLine('luna','오늘은 진토닉을 추천해 드립니다.');barGame.dialogue.chars=100;});await p.waitForTimeout(150);
 assert.equal(await p.locator('.speaker').textContent(),'루나');assert((await p.locator('.dialogue-box').boundingBox()).y>guestY);await p.screenshot({path:'/private/tmp/bar-hud-luna.png'});
 for(const lang of ['ko','en']){
  await p.evaluate(lang=>{barGame.lang=lang;const text=lang==='ko'?'오래 기다리셨습니다. 주문하신 칵테일을 준비하면서 재료와 향을 꼼꼼히 확인했습니다. 오늘은 천천히 잔을 기울이시면서 즐거운 시간을 보내셨으면 좋겠습니다.':'Thank you for waiting. I checked the ingredients and their aromas carefully while preparing your cocktail. I hope you can take your time and enjoy a pleasant evening here with us.';barGame.dialogue=barGame.makeLine('luna',text);barGame.dialogue.chars=0;},lang);await p.waitForTimeout(100);
  const h=(await p.locator('.dialogue-box').boundingBox()).height;assert(h>124);await p.evaluate(()=>barGame.dialogue.chars=barGame.dialogue.text.length);await p.waitForTimeout(100);assert.equal((await p.locator('.dialogue-box').boundingBox()).height,h);
  assert(await p.locator('.dialogue-text').evaluate(e=>e.scrollWidth<=e.clientWidth));await p.screenshot({path:'/private/tmp/bar-hud-long-'+lang+'.png'});
 }
 assert.deepEqual(errors,[]);console.log('DIALOGUE_HUD_OK: no waiting popup, live money including zero, HUD bounds, five viewport sizes, reference-sized dots/bubbles, smaller text, named speakers, next arrow, KO/EN wrapping and stable typing bounds.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
