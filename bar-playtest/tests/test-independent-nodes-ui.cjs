/* Right click → choose a type → wire → save. Writes stay in a temporary CSV copy. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const rt=require('../../tools/lib/test-runtime.cjs'),S=require('../../tools/dialogue-editor-storage.cjs');
(async()=>{
 const baseUrl=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/',tmp=await fs.mkdtemp(path.join(os.tmpdir(),'luna-free-ui-')),opts={base:path.join(tmp,'csv'),runtime:path.join(tmp,'runtime'),backupRoot:path.join(tmp,'backup')};
 await require('./helpers/copy-editor-source.cjs')(opts.base);await fs.cp(path.join(__dirname,'../data/runtime'),opts.runtime,{recursive:true});
 const browser=await rt.load('playwright').chromium.launch({headless:true,executablePath:rt.chrome});try{
 const ctx=await browser.newContext({viewport:{width:1600,height:980}}),errors=[];ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',a=>a.accept());});
 await ctx.route('**/api/dialogue-editor',async r=>{try{await r.fulfill({json:r.request().method()==='POST'?await S.save(r.request().postDataJSON(),opts):{...await S.snapshot(opts.base),token:'ui-test',mode:'local-csv'}});}catch(e){await r.fulfill({status:409,json:{error:e.message}});}});
 await ctx.route('**/api/dialogue-editor/runtime',async r=>r.fulfill({json:await S.runtimeSnapshot(opts.base)}));
 const p=await ctx.newPage();p.setDefaultTimeout(10000);
 async function right(id){const point=await p.locator(id).evaluate(el=>{const r=el.getBoundingClientRect();for(let y=r.top+10;y<r.bottom-10;y+=15)for(let x=r.left+8;x<r.right-8;x+=16){const t=document.elementFromPoint(x,y);if(el.contains(t)&&!t.closest('[data-node],[data-line-pin]'))return{x,y};}return null;});assert(point,'visible blank canvas');await p.mouse.click(point.x,point.y,{button:'right'});await p.locator('.node-palette[open]').waitFor();}
 await p.goto(baseUrl+'dialogue-editor.html?view=flow');await p.locator('.flow-card').first().waitFor();await right('#map-port');await p.getByRole('searchbox',{name:'노드 종류 검색'}).fill('대사');await p.locator('[data-node-type=say]').click();await p.fill('#command-text','미연결 바 검수');await p.locator('#command-form footer button:not([type=button])').click();await p.locator('.flow-card.tone-loose').first().waitFor();assert.match(await p.locator('.flow-card.tone-loose').first().innerText(),/미연결 바 검수/);
 await p.click('#undo');assert.equal(await p.locator('.flow-card.tone-loose').count(),0);
 await p.goto(baseUrl+'outside-dialogue-editor.html?flow=newspaper/intro');await p.locator('.street-card').first().waitFor();
 await right('#street-graph');await p.locator('[data-node-type=repeat]').click();const form=p.locator('.street-node-config[open]');await form.locator('[name=title]').fill('검수용 재대화');await form.locator('[name=line]').fill('다시 오셨군.');await form.locator('[type=submit]').click();
 await p.locator('[data-creation=repeat]').waitFor();const repeat=await p.evaluate(()=>outsideDialogueEditor.flow);assert.match(repeat,/^graph\/graph_newspaper_repeat_/);
 await p.locator('.street-port[data-slot=revisit]').first().click();await p.locator('[data-creation=repeat] [data-act=target]').click();
 await p.locator('#chart-create').click();await p.locator('[data-node-type=talk]').click();await form.locator('[name=line]').fill('두 번째 대사의 끝.');await form.locator('[type=submit]').click();
 await p.locator('[data-creation=repeat] [data-slot=next]').click();await p.locator('[data-creation=talk] [data-act=target]').click();
 await p.locator('[data-creation=repeat] [data-act=preview]').click();await p.locator('#stage-next-node').click();assert.equal(await p.locator('#speech-text').innerText(),'두 번째 대사의 끝.');await p.click('#close-stage');
 const create=async(kind,edit)=>{await p.click('#chart-create');await p.locator('[data-node-type='+kind+']').click();await edit();await form.locator('[type=submit]').click();await p.locator('[data-creation='+kind+']').waitFor();};
 await create('effect',async()=>{await form.locator('[name=flag]').selectOption('+');await form.locator('[name=newFlag]').fill('newspaper_interview_test');});
 await create('condition',async()=>{await form.locator('[name=flag]').selectOption('newspaper_interview_test');});
 await create('notice',async()=>{await form.locator('[name=line]').fill('취재가 끝났다.');});
 const wire=async(a,pin,b)=>{await p.locator('[data-creation='+a+'] [data-slot='+pin+']').click();await p.locator('[data-creation='+b+'] [data-act=target]').click();};
 await wire('talk','next','effect');await wire('effect','next','condition');await wire('condition','yes','notice');
 await p.click('#review');await p.waitForFunction(()=>!document.querySelector('#commit').disabled);await p.click('#commit');await p.waitForFunction(()=>!document.querySelector('#review-dialog').open);
 await p.reload();await p.locator('[data-creation=repeat]').waitFor();assert.equal(await p.locator('[data-creation=repeat] [data-slot=next]').getAttribute('title'),'다음 노드 → 대화');
 const game=await ctx.newPage();await game.goto(baseUrl+'?dev=1');await game.waitForFunction(()=>window.lunaDialogueLiveData?.revision&&window.outsidePlaytest);
 if(await game.locator('.updates-confirm').isVisible())await game.locator('.updates-confirm').click();
 const check=await game.evaluate(async()=>{const c=lunaCampaign;c.session.install({developer:false});barGame.reset(1,'full',1,false);c.session.carry=structuredClone(barGame.progress);Object.assign(outsidePlaytest.config,{day:1,flow:'in',place:'home'});await outsidePlaytest.start();c.screen(c.playView);
  const m=outsidePlaytest.model;m.scene='street';m.level=0;Object.assign(m.config,{day:1,flow:'in'});m.story.cancel();m.backgroundStory.cancel();m.x=LunaOutsideNewspaper.place.x-.3;m.updateNear();
  const talk=()=>LunaOutsideNewspaper.interact(m,LunaOutsideNewspaper.targets(m)[0]),initial=barGame.progress.inventory?.gear_part||0;talk();const intro=m.story.speech.line.text;let picked=false;
  for(let i=0;i<180&&m.story.speech;i++){if(m.story.speech.choice){const id=Object.keys(LUNA_DATA.newspaperRoutes.routes).find(id=>LUNA_DATA.newspaperRoutes.routes[id][0]==='newspaper/right');m.story.choose(id);picked=true;}else m.story.advance();}
  const first=barGame.progress.inventory.gear_part;talk();const second=m.story.speech.line.text;m.story.advance();m.story.advance();const end=m.story.speech.line.text,notices=[],display=LunaStoryNotices.outsideEvent;LunaStoryNotices.outsideEvent=(model,text)=>{notices.push(text);return display(model,text);};try{for(let i=0;i<12&&m.story.speech;i++)m.story.advance();}finally{LunaStoryNotices.outsideEvent=display;}
  return{intro,picked,first:first-initial,second,end,notices,flag:barGame.progress.flags.newspaper_interview_test,net:barGame.progress.inventory.gear_part-initial};});
 assert(check.picked&&check.intro!=='다시 오셨군.');assert.equal(check.first,1);assert.equal(check.second,'다시 오셨군.');assert.equal(check.end,'두 번째 대사의 끝.');assert.equal(check.net,1);assert.equal(check.flag,true);assert.deepEqual(check.notices,['취재가 끝났다.']);assert.deepEqual(errors,[]);
 console.log('INDEPENDENT_NODES_UI_OK: both canvas palettes, editable nodes, click-wire, preview, save/reload, real first/second NPC interaction, no duplicate gear.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
