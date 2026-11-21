const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');

(async () => {
 const browser = await runtime.load('playwright').chromium.launch({executablePath: runtime.chrome, headless: true});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[], requests=[];
  page.on('request', r=>requests.push(r.url()));
  page.on('pageerror', e=>errors.push(e.message));
  page.on('response', r=>{if(r.status()>=400) errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await page.locator('.updates-confirm').click();
  await page.locator('[data-outside-action="start"]').click();
  await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await page.keyboard.press('Space');
  const result=await page.evaluate(()=>{
   const o=outsidePlaytest, m=o.model, c=o.sceneContext, T=LunaOutsideTraffic, A=LunaOutsideAdCarrier;
   const sheet=LUNA_OUTSIDE_DATA.assets[LUNA_OUTSIDE_DATA.streetVehicleSheet].src;
   const paint=o.tick.bind(o), draw=c.drawImage, frames=new Set(), order=[];
   const residence=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-building');
   const front=LUNA_OUTSIDE_DATA.assets[residence.sprite.asset].src;
   const carrierDraw=A.draw, horizontal=new Set();
   let positions=new Map();
   o.tick=()=>{};
   m.start({day:3,flow:'out',place:'bar'});m.tick=()=>{};m.story.cancel();m.backgroundStory.cancel();
   LunaCaptureMode.set(true);
   A.draw=function(...args){order.push('flight');return carrierDraw(...args);};
   c.drawImage=function(im,...params){
    if(im.src?.endsWith(sheet)){
     if(this.imageSmoothingEnabled)throw Error('Vehicle lost nearest-neighbour sampling');
     const found=Object.entries(T.sprites).find(([,s])=>[s.x,s.y,s.w,s.h].every((v,i)=>v===params[i]));
     if(!found)throw Error('Unexpected full-sheet or obsolete vehicle draw');
     frames.add(found[0]);
     const matrix=this.getTransform();
     positions.set([found[0],params[6],matrix.a].join('|'),{kind:found[0],x:matrix.e,y:matrix.f});
    }
    if(im.src?.endsWith(front))order.push('residence');
    return draw.call(this,im,...params);
   };
   try{
    for(const height of [0,2.55,4,7.5]){
     m.x=-8.78;m.y=height;o.snapCamera();
     for(let t=0;t<=160&&horizontal.size<7;t+=2){
      positions=new Map();m.time=t;paint(0);const before=positions;
      positions=new Map();m.time=t+.25;paint(0);
      for(const [key,current] of positions){
       const previous=before.get(key);
       if(!previous||previous.x===current.x)continue;
       if(previous.y!==current.y)throw Error(current.kind+' moved vertically during flight');
       horizontal.add(current.kind);
      }
     }
    }
    m.x=-8.78;m.y=-.7;m.time=36;o.snapCamera();paint(0);
   }finally{c.drawImage=draw;A.draw=carrierDraw;}
   return {frames:[...frames].sort(),horizontal:[...horizontal].sort(),firstFlight:order.indexOf('flight'),firstResidence:order.indexOf('residence')};
  });
  assert.deepEqual(result.frames,['blue','carrier','compact','red','screen','silver','train']);
  assert.deepEqual(result.frames,result.horizontal);
  assert(result.firstFlight>=0 && result.firstResidence>result.firstFlight);
  await page.screenshot({path:'/private/tmp/ad-carrier-street.png'});
  await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
  await page.waitForFunction(()=>window.resourceReview?.ready);
  const reviewed=await page.evaluate(async()=>{
   const rows=resourceReview.rows.filter(r=>r.id==='fx:ad-carrier'||r.id.startsWith('fx:street-vehicle-'));
   for(const r of rows){
    resourceReview.select(r.id);
    const l=r.layers[0],im=new Image();im.src=l.src;await im.decode();
    if(im.naturalWidth!==1415||im.naturalHeight!==714||l.rects.length!==1)throw Error('Review does not show original crop');
   }
   return rows.length;
  });
  assert.equal(reviewed,7);
  assert(!requests.some(url=>/ad-carrier\.png|Web_IMG_ad_portrait|ad-portrait-(violet|crimson)/i.test(url)));
  assert.deepEqual(errors,[]);
  console.log('SUPPLIED_FLEET_UI_OK',result,reviewed+' review crops');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
