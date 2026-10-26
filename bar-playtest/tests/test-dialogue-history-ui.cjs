const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(()=>{lunaCampaign.screen('developer');LunaFocusSettings.setEnabled(false);const g=barGame;g.reset(99,'general',1,true);g.speed=0;g.changed();});
 await p.locator('.service-handle').click();await p.locator('.service-actions').waitFor();
 assert.deepEqual(await p.locator('.service-actions button').allTextContents(),['칵테일 레시피','매출 현황','단골 손님 정보','대화 기록']);
 await p.screenshot({path:'/private/tmp/dialogue-history-service.png'});
 await p.getByRole('button',{name:'대화 기록',exact:true}).click();
 await p.locator('.dialogue-history-panel').waitFor();assert(await p.locator('.dialogue-history-empty').isVisible());
 assert.equal(await p.locator('.dialogue-history-heading .resource-close img').first().getAttribute('src'),'assets/ui/recipe_choice/BTN_recipe_choice_close.png');
 await p.keyboard.press('Escape');assert.equal(await p.locator('.dialogue-history-panel').count(),0);assert.equal(await p.locator('.luna-settings:visible').count(),0);
 // Actual story completion still feeds the same history, rather than a second log.
 const record=await p.evaluate(()=>{const g=barGame;g.reset(1,'regular',1,true);g.tutorial=null;g.cameraLeft=0;g.cameraMoving=false;g.transition=0;g.pendingTransition=null;g.story.index=g.story.steps.findIndex(s=>s.type==='say');g.pump();if(!g.dialogue)throw Error('Expected real story line');const text=g.dialogue.text;g.storyCoaster=null;g.dialogue.chars=text.length;g.advance();return {text,last:g.history.at(-1)?.text};});
 assert.equal(record.last,record.text);
 await p.evaluate(()=>{const g=barGame;g.reset(1,'general',1,true);g.phase='regular';g.speed=0;g.dialogSpeed=0;g.history=Array.from({length:45},(_,i)=>({actor:i%2?'luna':'chris',text:'대화 '+(i+1)+'.\n이전 대화를 다시 확인합니다.'}));g.history.push({actor:'tom',text:'<img src=x onerror=alert(1)> 이름을 아직 모르는 손님.',anonymous:true});g.dialogue=g.makeLine('luna','보인 대사 아직 읽지 않은 비밀');g.dialogue.chars=5;g.changed();});
 await p.waitForFunction(()=>!barGame.cameraMoving&&barGame.cameraLeft===0&&barGame.transition===0);
 await p.keyboard.press('KeyY');
 const scroll=p.locator('.dialogue-history-scroll');
 await p.waitForTimeout(250);
 assert.equal(await p.locator('.dialogue-history-entry').count(),47,JSON.stringify(await p.evaluate(()=>({phase:barGame.phase,screen:barGame.screen,dialogue:barGame.dialogue,current:barGame.currentDialogue(),moving:barGame.cameraMoving,left:barGame.cameraLeft,transition:barGame.transition,error:barGame.error}))));
 assert.equal(await p.locator('.dialogue-history-entry').nth(45).locator('b').innerText(),'???');
 assert.equal(await scroll.locator('img').count(),0,'escaped dialogue');
 assert(!(await scroll.innerText()).includes('읽지 않은 비밀'),'unrevealed text must not leak');
 assert(await scroll.evaluate(e=>e.scrollTop>0&&Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<2),'opens at latest');
 const before=await p.evaluate(()=>({chars:barGame.dialogue.chars,history:barGame.history.length,time:barGame.barTime}));
 await p.keyboard.press('KeyE');await p.keyboard.press('Enter');await p.waitForTimeout(250);
 assert.deepEqual(await p.evaluate(()=>({chars:barGame.dialogue.chars,history:barGame.history.length,time:barGame.barTime})),before,'no background progress');
 await scroll.evaluate(e=>e.scrollTop=0);await p.evaluate(()=>barGame.changed());assert.equal(await scroll.evaluate(e=>e.scrollTop),0,'rerender preserves reading position');
 await p.getByRole('button',{name:'최근 대화로 ↓'}).click();assert(await scroll.evaluate(e=>e.scrollTop>0));
 for(let i=0;i<6;i++){await p.keyboard.press(i%2?'Shift+Tab':'Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('.dialogue-history-panel')),'focus stays in panel');}
 await p.screenshot({path:'/private/tmp/dialogue-history-filled.png'});
 for(const [width,height]of [[960,720],[1920,1080],[390,844]]){await p.setViewportSize({width,height});await p.waitForTimeout(120);const rect=await p.locator('.dialogue-history-panel').boundingBox();assert(rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,JSON.stringify(rect));assert(await scroll.evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 await p.keyboard.press('KeyY');assert.equal(await p.locator('.dialogue-history-panel').count(),0);
 await p.keyboard.press('KeyY');await p.locator('.dialogue-history-heading button').click();assert.equal(await p.locator('.dialogue-history-panel').count(),0);
 await p.setViewportSize({width:1280,height:720});await p.keyboard.press('KeyY');await p.locator('.dialogue-history-scrim').click({position:{x:1000,y:300}});assert.equal(await p.locator('.dialogue-history-panel').count(),0);
 // The same control is usable in the main session and reset never retains a past shift.
 await p.evaluate(()=>{const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:false});g.reset(1,'general',1,true);g.speed=0;c.screen(c.playView);g.changed();});
 await p.locator('.service-handle').click();await p.getByRole('button',{name:'대화 기록',exact:true}).click();assert(await p.locator('.dialogue-history-empty').isVisible());
 await p.keyboard.press('Escape');await p.evaluate(()=>{barGame.tutorial={kind:'recipe'};barGame.overlay='service';barGame.changed();});assert(await p.getByRole('button',{name:'대화 기록',exact:true}).isDisabled(),'recipe tutorial still gates unrelated service buttons');
 assert.deepEqual(errors,[]);console.log('DIALOGUE_HISTORY_OK: service order/art, real story recording, read-only pause, no spoilers, anonymous names, escaping, latest/scroll retention, focus, Esc/Y/button/scrim, 4 viewports and main/reset');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
