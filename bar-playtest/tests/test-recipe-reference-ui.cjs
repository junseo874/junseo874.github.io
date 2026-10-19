const assert=require('node:assert/strict');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await load('playwright').chromium.launch({executablePath:chrome,headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}});
 await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await page.waitForFunction(()=>resourceReview.ready);
 await page.addStyleTag({content:'.frame-wrap,.lab.parked .frame-wrap{width:1280px!important;height:720px!important;max-width:none!important;border:0!important}'});
 await page.evaluate(()=>resourceReview.launch({type:'ui',id:'recipes'},'레시피',''));
 const frame=page.frames().find(f=>f.url().includes('resourceReview=1'));
 await frame.locator('.recipe-card[data-id="dry_martini"]').hover();
 await frame.locator('.recipe-preview').waitFor();await frame.evaluate(()=>document.fonts.ready);
 const style=await frame.locator('.recipe-preview').evaluate(panel=>{
  const q=s=>panel.querySelector(s), rect=e=>({x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight});
  return {box:rect(panel),images:[panel,q('.recipe-hero'),q('.recipe-icon-slot')].map(e=>getComputedStyle(e).backgroundImage),hero:rect(q('.recipe-hero')),title:getComputedStyle(q('h2')).fontWeight,english:getComputedStyle(q('.prep-recipe-heading>small')).textTransform,description:getComputedStyle(q('section p')).lineHeight};
 });
 assert.deepEqual(style.box,{x:442,y:30,w:346,h:660});
 for(const [i,name]of ['IMG_recipe_box.png','IMG_cocktail_box.png','IMG_recipe_igd_box.png'].entries())assert(style.images[i].includes(name),'Original resource '+name);
 assert(Math.abs(style.hero.w/style.hero.h-841/431)<.03,'Keep the hero art aspect ratio');
 assert.equal(style.title,'700');assert.equal(style.english,'uppercase');assert.equal(style.description,'16.15px');
 // A long recipe remains readable past the visual bottom fade.
 await frame.locator('.recipe-preview section:last-of-type p').evaluate(e=>e.textContent+=' 설명을 끝까지 읽을 수 있어야 합니다.'.repeat(70));
 const scroll=frame.locator('.recipe-preview .prep-recipe-scroll');
 await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);
 assert(await scroll.evaluate(e=>e.scrollTop>0&&e.scrollHeight-e.scrollTop-e.clientHeight<2));
 await frame.locator('.recipe-card[data-id="gin_fizz"]').hover();
 await frame.locator('.recipe-card[data-id="dry_martini"]').hover();
 await frame.evaluate(()=>document.fonts.ready);
 await frame.locator('.recipe-list').evaluate(e=>e.scrollTop=0);
 await page.waitForTimeout(150);
 await page.locator('#game').screenshot({path:'artifacts/typography/recipe-reference-panel.png'});
 await frame.locator('.recipe-card[data-id="dry_martini"]').click();
 await frame.locator('.prep-screen').waitFor();
 console.log('PASS original recipe art, reference layout, typography, full description scrolling, hover and recipe selection');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
