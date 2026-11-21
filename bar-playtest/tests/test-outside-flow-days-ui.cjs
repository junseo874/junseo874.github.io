/* Navigate real tabs in the local editor. No POST or production save is allowed. */
const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({headless:true,executablePath:rt.chrome});
 try{
  const context=await b.newContext({viewport:{width:1450,height:920}}),p=await context.newPage(),errors=[],writes=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});p.setDefaultTimeout(6500);
  const url=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/outside-dialogue-editor.html',el=id=>p.locator('#'+id);
  const open=async query=>{await p.goto(url+query);await p.waitForFunction(()=>!!window.outsideDialogueEditor);};
  const tab=async d=>{await el('outside-day-'+d).click();await p.waitForFunction(d=>document.querySelector('#street-graph').dataset.day===String(d)&&document.querySelector('.street-card.selected'),d);};
  const group=async id=>{await el('flow-group').selectOption(id);await p.waitForFunction(id=>document.querySelector('#flow-group').value===id&&document.querySelector('#site-title').textContent.includes(LunaOutsideFlowMap.sites.find(s=>s.id===id).name),id);};
  const groups=()=>p.locator('#flow-group option').evaluateAll(opts=>opts.map(o=>o.value)),flow=()=>p.evaluate(()=>outsideDialogueEditor.flow);
  await open('');assert.equal(await el('outside-day-0').getAttribute('aria-selected'),'true');assert((await groups()).includes('witness'));assert(!(await groups()).includes('newspaper'));
  await group('believer');const first=await flow();assert.match(await el('outside-day-hint').innerText(),/공용.*0·1/);
  await tab(1);assert.equal(await flow(),first);assert((await groups()).includes('newspaper'));assert(!(await groups()).includes('witness'));
  await group('newspaper');await el('flow-search').fill('신문');await tab(2);assert.equal(await p.locator('#flow-list [data-person]').count(),0);await el('flow-search').fill('');
  await group('memory');assert.equal(await flow(),'johnny');assert((await p.locator('#chart-jump option').allTextContents()).slice(1).every(t=>t.includes('조니')));
  await tab(3);assert.equal(await flow(),'terraceMemory3');assert.equal(await p.locator('#related-flows [data-flow]').count(),0);
  assert((await p.locator('.street-card .node-head small').allTextContents()).every(t=>t.includes('3일차')));
  await group('samho');await el('place-npc').click();assert.deepEqual(await p.locator('#place-actor option').evaluateAll(os=>os.map(o=>o.value)),['commute3']);await el('cancel-placement').click();
  await tab(2);assert.equal(await flow(),'johnny','return to previously selected day and flow');await group('samho');await el('place-npc').click();assert.deepEqual(await p.locator('#place-actor option').evaluateAll(os=>os.map(o=>o.value)),['commute2']);await p.keyboard.press('Escape');
  // Reopening a manually moved card must not leave the user staring at an empty origin.
  await p.evaluate(()=>{const id=document.querySelector('.street-card.selected').dataset.node;localStorage.setItem('luna.outside.flow-layout.v1',JSON.stringify({samho:{[id]:{x:1860,y:1120}}}));});
  await p.reload();await p.waitForFunction(()=>{const g=document.querySelector('#street-graph'),c=document.querySelector('.street-card.selected .node-head');if(!c)return false;const a=g.getBoundingClientRect(),b=c.getBoundingClientRect();return g.scrollLeft>0&&g.scrollTop>0&&b.left>=a.left&&b.top>=a.top&&b.left<a.right&&b.top<a.bottom;});
  await tab(1);await group('newspaper');
  assert.equal(await flow(),'newspaper/intro');await tab('all');assert((await groups()).includes('workshop'));
  await el('outside-day-all').press('Home');assert.equal(await el('outside-day-0').getAttribute('aria-selected'),'true');assert.equal(await el('dirty').innerText(),'수정 없음');
  await open('?flow=newspaper/intro');assert.equal(await el('outside-day-1').getAttribute('aria-selected'),'true');await p.reload();await p.waitForFunction(()=>!!window.outsideDialogueEditor);assert.equal(await flow(),'newspaper/intro');
  await open('?day=2&flow=newspaper/intro');assert.equal(await el('outside-day-2').getAttribute('aria-selected'),'true');assert.notEqual(await flow(),'newspaper/intro');await open('?flow=workshop');assert.equal(await el('outside-day-all').getAttribute('aria-selected'),'true');
  await tab(3);await group('shop');await el('chart-create').click();await p.locator('[data-node-type=talk]').click();
  const form=p.locator('.street-node-config[open]');assert.equal(await form.locator('[name=day]').inputValue(),'3');assert(await form.locator('[name=day]').isDisabled());await form.locator('[name=title]').fill('3일차 임시 대화');await form.locator('[type=submit]').click();
  const authored=p.locator('.street-card[data-creation=talk]');await authored.waitFor();const id=await flow();
  await tab(2);await group('shop');assert.equal(await authored.count(),0);await tab(3);assert.equal(await flow(),id);await authored.waitFor();
  await el('undo').click();await authored.waitFor({state:'detached'});assert.equal(await el('dirty').innerText(),'수정 없음');
  await tab('all');await group('shop');await el('chart-create').click();await p.locator('[data-node-type=talk]').click();
  assert.deepEqual(await form.locator('[name=day] option').allTextContents(),['2일차','3일차']);await form.locator('[name=day]').selectOption('3');await form.locator('[type=button]').click();assert.equal(await el('dirty').innerText(),'수정 없음');
  await p.setViewportSize({width:375,height:680});await tab(3);assert(await p.evaluate(()=>{const r=document.querySelector('#outside-day-tabs').getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth;}));
  const sw=r=>p.locator('#outside-trip-filters [data-trip="'+r+'"]'),pressed=r=>sw(r).getAttribute('aria-pressed');
  const scope=async(d,t)=>p.waitForFunction(([d,t])=>outsideDialogueEditor.day===d&&outsideDialogueEditor.commute===t&&document.querySelector('#street-graph').dataset.commute===t&&(t==='none'||document.querySelector('.street-card.selected')),[d,t]);
  await open('?day=0&flow=believer/intro');await scope(0,'both');
  assert(await p.evaluate(()=>[...document.querySelectorAll('#outside-trip-filters button')].every(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth;})&&document.documentElement.scrollWidth<=innerWidth));
  await sw('out').press('Space');await scope(0,'in');assert.equal(await pressed('in'),'true');assert.equal(await pressed('out'),'false');
  assert.equal(new URL(p.url()).searchParams.get('commute'),'in');assert(!(await groups()).includes('believer'));assert(!(await groups()).includes('intro'));
  await p.setViewportSize({width:1450,height:920});
  const game=await b.newPage();await game.goto(new URL('./?dev=1',url).href);
  await game.waitForFunction(()=>window.barGame&&window.LunaOutsideNewspaper&&window.LunaOutsideContent);
  const live=await game.evaluate(()=>{
   // Query the real encounter rules for a fresh visit; do not advance or edit a save.
   const result={};for(let d=0;d<4;d++)for(const r of ['in','out']){
    const m={scene:'street',level:0,config:{day:d,flow:r}};
    result[d+'/'+r]={believer:!!LunaOutsideBeliever.targets(m).length,newspaper:!!LunaOutsideNewspaper.targets(m).length,
     shop:!!LunaOutsideShop.targets(m).length,poster:LunaOutsideContent.targets(m).some(t=>t.id==='wanted-poster'),
     thug:LunaOutsideThug.visible({...m,level:1}),witness:LunaOutsideBeggar.targets(m).some(t=>t.id==='street-beggar-witness')};
   }return result;
  });await game.close();
  const expected=[
   {in:[['room','poster'],['intro','witness','believer','terrace']],out:[['beggar','believer','terrace'],['intro','newspaper']]},
   {in:[['believer','newspaper','thug','news'],['trade','witness']],out:[['believer','newspaper','trade'],['thug','news','witness']]},
   {in:[['samho','shop','information'],['memory','terrace']],out:[['shop','memory','terrace'],['samho','information']]},
   {in:[['samho','shop','poster'],['contract','memory']],out:[['contract','memory','terrace'],['samho']]}
  ];
  for(const [d,visits] of expected.entries())for(const [r,[include,exclude]] of Object.entries(visits)){
   await tab(d);if(await pressed(r)!=='true')await sw(r).click();const other=r==='in'?'out':'in';if(await pressed(other)==='true')await sw(other).click();await scope(d,r);
   const seen=await groups();for(const name of include)assert(seen.includes(name),[d,r,name]);for(const name of exclude)assert(!seen.includes(name),[d,r,name]);
   for(const [name,visible] of Object.entries(live[d+'/'+r]))assert.equal(seen.includes(name),visible,'editor vs game: '+[d,r,name]);
  }
  await open('?day=2&commute=in&flow=commute2');await scope(2,'in');await el('place-npc').click();
  assert.deepEqual(await p.locator('#place-actor option').evaluateAll(os=>os.map(o=>o.value)),['commute2']);await el('cancel-placement').click();
  await sw('in').click();await scope(2,'none');assert(await el('outside-trip-empty').isVisible());assert.equal(await flow(),'');
  for(const selector of ['.street-card','#line-list [data-row]','#chart-jump option','#node-detail > *','#related-flows [data-flow]'])assert.equal(await p.locator(selector).count(),0,selector);
  assert(await el('popup-preview').isDisabled()&&await el('place-npc').isDisabled());assert.deepEqual((await groups()).filter(Boolean),[]);
  await el('outside-day-1').click();await scope(1,'none');await p.reload();await p.waitForFunction(()=>!!window.outsideDialogueEditor);await scope(1,'none');
  await el('outside-trip-reset').click();await scope(1,'both');assert.equal(await pressed('in'),'true');assert.equal(await pressed('out'),'true');
  await open('?flow=believer/intro&commute=in');await scope(1,'in');assert.equal(await flow(),'believer/intro');
  assert.equal(await el('outside-day-hint').innerText(),'공용 대본 · 1일차 | 출근길');assert((await el('outside-day-hint').getAttribute('title')).includes('0일차: 퇴근길'));
  await open('?day=0&flow=believer/intro&commute=in');await scope(0,'in');assert.notEqual(await flow(),'believer/intro');
  await open('?day=1&commute=out&flow=newspaper/intro');await scope(1,'out');await group('trade');
  const remembered=await flow();await sw('in').click();await sw('out').click();await scope(1,'in');assert.notEqual(await flow(),remembered);
  await sw('in').click();await scope(1,'none');await sw('out').click();await scope(1,'out');assert.equal(await flow(),remembered);
  await el('view-script').click();await sw('out').click();assert(await el('outside-trip-empty').isVisible());await sw('out').click();
  assert.equal(await flow(),remembered);assert(await el('line-list').isVisible());assert.equal(await el('dirty').innerText(),'수정 없음');
  await open('?day=0&commute=in&flow=prologue');await scope(0,'in');assert.notEqual(await flow(),'prologue');assert(!(await groups()).includes('intro'));
  await open('?day=1&commute=in&flow=believer/intro&view=script');
  const field=p.locator('#inspector textarea[data-field="text.ko"]').first(),original=await field.inputValue();
  await field.fill('첫 탭에서 편집 중인 대사');const draftSlots=()=>p.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('luna.outside.editor.draft.')).sort());
  const untouched=await draftSlots();assert.equal(untouched.length,1);
  const tab2=await p.context().newPage();tab2.on('dialog',d=>d.dismiss());await tab2.goto(p.url());await tab2.waitForFunction(()=>!!window.outsideDialogueEditor);
  assert.deepEqual(await draftSlots(),untouched,'opening another tab must not erase a live draft');
  await tab2.locator('#inspector textarea[data-field="text.ko"]').first().fill('둘째 탭의 독립 편집');assert.equal((await draftSlots()).length,2);
  await tab2.click('#undo');assert.deepEqual(await draftSlots(),untouched);await tab2.close();await el('undo').click();
  await field.fill('시간대 간 공유 대본 검수');await sw('out').click();await sw('in').click();
  assert.equal(await field.inputValue(),'시간대 간 공유 대본 검수','both visits edit one in-memory script');
  await sw('out').click();assert(await el('outside-trip-empty').isVisible());await el('undo').click();
  assert.equal(await el('dirty').innerText(),'수정 없음');await sw('out').click();assert.equal(await field.inputValue(),original);
  // GitHub Pages supplies only static CSV files; no local save API is needed to browse visits.
  await p.route('**/api/dialogue-editor',r=>r.abort());await open('?day=3&commute=out&flow=notion/contract');await scope(3,'out');
  assert.equal(await flow(),'notion/contract');assert(!(await groups()).includes('samho'));
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('OUTSIDE_FLOW_DAYS_UI_OK: eight day/trip visits, independent switches, empty/reset, deep links, navigation, graph/script/placement, mobile and no CSV writes');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
