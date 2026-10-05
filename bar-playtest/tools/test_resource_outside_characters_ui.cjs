const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1500,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
 await p.click('[data-group="out-characters"]');
 for(const [id,frames,actor,motion] of [['outside:samho:walk',8,'삼호','walk'],['outside:bubi:idle',17,'부비(고양이)','idle']]){
  const row=await p.evaluate(id=>resourceReview.rows.find(r=>r.id===id),id);assert.equal(row.status,'registered');assert.equal(row.layers[0].frames,frames);assert.equal(row.facets.actor,actor);assert(row.facets.motion.includes(motion));assert.equal(row.facets.media,'animation');
  await p.click('[data-facet="actor"][data-value="'+actor+'"]');await p.click('[data-facet="motion"][data-value="'+motion+'"]');await p.click('[data-facet="media"][data-value="animation"]');await p.click('[data-id="'+id+'"]');
  await p.locator('[data-action="play"]').click();assert.equal(await p.locator('#frame-slider').getAttribute('max'),String(frames-1));
  await p.waitForTimeout(300);const images=[];for(let i=0;i<frames;i++){
   await p.locator('#frame-slider').fill(String(i));
   const frame=await p.locator('#preview-canvas').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]){n++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return{n,box:[x0,y0,x1,y1],png:c.toDataURL()};});assert(frame.n>0,'No blank frame '+i);images.push(frame);
  }assert(new Set(images.map(f=>f.png)).size>1,'Frames actually animate');if(id.includes('bubi'))assert.equal(new Set(images.map(f=>JSON.stringify(f.box))).size,1,'Cat must not drift between frames');
  await p.locator('#frame-slider').fill('0');await p.locator('[data-action="play"]').click();const first=await p.locator('#frame-label').innerText();await p.waitForTimeout(140);assert.notEqual(await p.locator('#frame-label').innerText(),first);
  await p.screenshot({path:'/private/tmp/'+(id.includes('bubi')?'bubi-cat-review':'samho-move-review')+'.png'});await p.click('[data-filter-reset]');
 }
 assert.deepEqual(errors,[]);console.log('OUTSIDE_CHARACTER_REVIEW_OK Samho 8 frames, Bubi 17 frames, filters, playback, no blanks or cat drift');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
