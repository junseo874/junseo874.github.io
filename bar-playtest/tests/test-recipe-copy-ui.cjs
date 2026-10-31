const assert=require('node:assert/strict');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.waitForFunction(()=>window.barGame&&window.lunaCampaign);
  const ids=await page.evaluate(()=>barGame.t.cocktails.map(c=>c.id));
  assert.equal(ids.length,14);
  for(const id of ids){
   await page.evaluate(id=>{
    const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:true});
    c.ui.variant='original';g.variant='original';g.reset(99,'practice',1,true);
    c.ui.peek=id;c.screen(c.playView);g.changed();c.render(true);
   },id);
   await page.waitForSelector('.recipe-preview');
   const result=await page.evaluate(async id=>{
    const c=barGame.cocktail(id),panel=document.querySelector('.recipe-preview');
    const paragraphs=[...panel.querySelectorAll('section>p')];
    const images=await Promise.all([...panel.querySelectorAll('img')].map(async img=>{await img.decode();return img.naturalWidth>0;}));
    const scroll=panel.querySelector('.prep-recipe-scroll');
    scroll.scrollTop=scroll.scrollHeight;
    return {flavor:paragraphs[0].textContent,expectedFlavor:c['flavor.ko'],method:paragraphs[1].textContent,expectedMethod:c['recipe_desc.ko'],whitespace:getComputedStyle(paragraphs[0]).whiteSpace,images,
     overflow:scroll.scrollWidth>scroll.clientWidth+1,atEnd:Math.abs(scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop)<2};
   },id);
   assert.equal(result.flavor,result.expectedFlavor.replace(/\r\n/g,'\n'),id+' description');
   assert.equal(result.method,result.expectedMethod,id+' method');
   assert(!/\d\s*oz/i.test(result.method),id+' Korean method uses ml');
   assert.equal(result.whitespace,'pre-line');assert(result.images.every(Boolean));
   assert(!result.overflow,id+' no horizontal clipping');assert(result.atEnd,id+' full copy scrollable');
  }
  for(const [drink,glass,name]of [['bottle_beer','weizen','바이젠잔'],['whiskey_sour','flute','플루트잔'],['dry_martini','martini','마티니잔']]){
   await page.evaluate(({drink,glass})=>{
    const g=barGame,c=lunaCampaign;g.reset(99,'practice',1,true);g.selectCocktail(drink);g.pickItem(glass);
    c.ui.tab='glass';c.ui.recipeOpen=true;c.ui.hoverItem=glass;c.render(true);
   },{drink,glass});
   await page.waitForSelector('#prep-recipe-detail');
   const result=await page.evaluate(async glass=>{
    const g=barGame,panel=document.querySelector('#prep-recipe-detail');
    const images=await Promise.all([...document.querySelectorAll('.prep-screen img')].map(async img=>{await img.decode();return img.naturalWidth>0;}));
    return {name:g.name(glass),picked:g.prep.glass,expected:g.cocktail(g.prep.selected).glass,images,
     tip:document.querySelector('#ingredient-tip')?.textContent,
     method:panel.querySelectorAll('section>p')[1].textContent};
   },glass);
   assert.equal(result.name,name);assert.equal(result.picked,glass);assert.equal(result.expected,glass);
   assert(result.images.every(Boolean));assert(result.tip.includes(name));assert(result.method.includes(name));
  }
  await page.evaluate(()=>{const g=barGame,c=lunaCampaign;g.reset(99,'practice',1,true);g.selectCocktail('gin_tonic');c.ui.recipeOpen=true;c.ui.tab='tool';c.ui.hoverItem='opener';c.render(true);});
  assert((await page.locator('#ingredient-tip').textContent()).includes('맥주병이나 와인병을 열 때 쓰는 도구.'));
  await page.locator('.prep-recipe-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await page.screenshot({path:'/private/tmp/recipe-copy-20261030.png'});
  assert.deepEqual(errors,[]);
  console.log('RECIPE_COPY_UI_OK: all 14 previews, original paragraphs, scrollable Korean ml copy, glass names/selection/art/tooltips, opener.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
