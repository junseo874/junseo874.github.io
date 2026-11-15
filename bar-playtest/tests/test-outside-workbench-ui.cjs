/* Same workspace rails and details as the bar, using the real local pages read-only. */
const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{const c=await b.newContext({viewport:{width:1420,height:900}}),bar=await c.newPage(),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));const url=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/';
 await bar.goto(url+'dialogue-editor.html?view=flow');await bar.waitForSelector('#node-detail .dp-tab');
 await p.goto(url+'outside-dialogue-editor.html?flow=newspaper/intro');await p.waitForSelector('#node-detail .dp-tab');
 const box=async(page,sel)=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round);});
 const same=async(which)=>{assert.deepEqual(await box(bar,'.studio-rail'),await box(p,'.studio-rail'));assert.deepEqual(await box(bar,'.rail-foot'),await box(p,'.rail-foot'));assert.deepEqual(await box(bar,which),await box(p,'#inspector'));};
 await same('#node-detail');
 await p.locator('.dp-filters [data-category=place]').click();assert.equal(await p.locator('#node-detail > details:visible').count(),1);assert(await p.locator('[data-detail-action=place]').isVisible());await p.locator('[data-detail-action=place]').click();assert(await p.locator('#placement-dialog').isVisible());await p.keyboard.press('Escape');
 await p.locator('.dp-filters [data-category=all]').click();await p.locator('.dp-search').fill('말도 없는 속성');assert(await p.locator('.dp-empty').isVisible());await p.locator('.dp-search').press('Escape');assert(!(await p.locator('.dp-empty').isVisible()));await p.locator('[data-member]').nth(1).click();assert.equal(await p.locator('#node-detail .inspector-title small').textContent(),'#02');
 await p.locator('[data-detail-action=stage]').click();assert(await p.locator('#stage-range').innerText().then(v=>v.includes('선택한 노드')));await p.locator('#play').click();for(let i=0;i<5;i++)await p.locator('#next').click();await p.locator('#next').click();assert.equal(await p.locator('#cursor').textContent(),'6 / 6');assert((await p.locator('#stage-range').innerText()).includes('완료'));await p.keyboard.press('Escape');
 await p.locator('#chart-search').fill('정답일세');assert(await p.locator('#chart-jump option').count()>1);await p.locator('#chart-search').press('Enter');await p.locator('#chart-zoom').selectOption('50%');assert.equal(await p.locator('#graph-sheet').evaluate(e=>e.style.transform),'scale(0.5)');
 await p.locator('#view-script').click();await bar.locator('#line-mode').click();await same('#line-workspace #inspector');await p.locator('[data-category=source]').click();assert(await p.locator('[data-field="text.en"]').isVisible());assert(!(await p.locator('#node-detail [data-field="text.ko"]').isVisible()));
 await p.setViewportSize({width:600,height:780});assert(await p.locator('.pane-switch').isVisible());await p.locator('.pane-switch [data-pane=edit]').click();assert(await p.locator('#inspector').isVisible());assert(!(await p.locator('main>.workspace').isVisible()));await p.locator('.pane-switch [data-pane=preview]').click();assert(await p.locator('main>.workspace').isVisible());assert(!(await p.locator('#inspector').isVisible()));
 await p.setViewportSize({width:375,height:680});await p.locator('.pane-switch [data-pane=both]').click();assert(await p.locator('#inspector').isVisible());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('#dirty').textContent(),'수정 없음');assert.deepEqual(errors,[]);
 console.log('OUTSIDE_WORKBENCH_UI_OK: rail and details match the bar in both modes, property filters, member selection, bounded node replay, search navigation, responsive panes.');}
 finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
