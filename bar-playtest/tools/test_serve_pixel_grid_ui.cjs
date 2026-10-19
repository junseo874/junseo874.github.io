const assert=require('node:assert/strict');
const sharp=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  for(const dpr of [1,1.5,2]){
   const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:dpr});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
   await page.waitForFunction(()=>window.LunaServeView&&window.LunaServePixels);
   assert(await page.evaluate(()=>{
    for(const dpr of [.8,1,1.1,1.25,4/3,1.5,1.75,2,2.625,3,3.5])for(const width of [390,640,953,955,1103,1921,2048]){
     const rect={left:13.3,top:41.7,width,height:width*9/16};rect.right=rect.left+rect.width;rect.bottom=rect.top+rect.height;
     const r=LunaServePixels.layout(rect,dpr);
     if(rect.width*dpr-r.width>10||rect.height*dpr-r.height>10||r.width>rect.width*dpr+.01||r.height>rect.height*dpr+.01)return false;
    }return true;
   }),'Browser zoom must not reintroduce quantized framing or overscan');
   if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
   await page.evaluate(()=>{
    const root=document.createElement('div');root.id='ppu-fixture';root.style='position:fixed;left:0;top:0;z-index:999999;width:1280px;height:720px;transform-origin:0 0;background:#0d0e18';
    root.innerHTML='<section class="serve-presentation"><canvas class="serve-canvas"></canvas><canvas class="serve-carbonation"></canvas></section>';document.body.append(root);
    const g={screen:'result',result:{selected:'dry_martini'},realTime:0,isPaused:()=>false};
    window.ppuFixture={root,g,view:LunaServeView({g})};ppuFixture.view.sync(root);
   });
   await page.waitForFunction(()=>{const f=ppuFixture;f.view.sync(f.root);const c=f.root.querySelector('canvas');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v);});
   for(const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:960,height:600},{width:1103,height:777},{width:640,height:360}]){
    await page.setViewportSize(viewport);
    const result=await page.evaluate(async()=>{
     const f=ppuFixture,scale=Math.min(innerWidth/1280,innerHeight/720);
     f.root.style.zoom=scale;f.root.style.left=(innerWidth-1280*scale)/2/scale+'px';f.root.style.top=(innerHeight-720*scale)/2/scale+'px';
     const images=await Promise.all([LUNA_SERVE_BACKGROUND,LUNA_SERVE_SHEETS.dry_martini].map(async sheet=>{const im=new Image();im.src=sheet.src;await im.decode();return {im,sheet};}));
     const native=document.createElement('canvas');native.width=960;native.height=540;const nc=native.getContext('2d');nc.imageSmoothingEnabled=false;
     const expected=document.createElement('canvas'),actual=f.root.querySelector('.serve-canvas'),fx=f.root.querySelector('.serve-carbonation');
     for(let frame=0;frame<30;frame++){
      f.g.realTime=frame/20+.001;f.view.sync(f.root);
      if(Number(actual.dataset.frame)!==frame)throw Error('Wrong animation frame');
      nc.clearRect(0,0,960,540);
      for(const {im,sheet:s} of images)nc.drawImage(im,s.sx+frame%6*s.dx,s.sy+Math.floor(frame/6)*s.dy,s.w,s.h,3,s===LUNA_SERVE_BACKGROUND?0:LUNA_SERVE_COMPOSITION.drinkOffsetY,s.w,s.h);
      expected.width=actual.width;expected.height=actual.height;const ec=expected.getContext('2d');ec.imageSmoothingEnabled=false;ec.drawImage(native,0,0,expected.width,expected.height);
      if(expected.toDataURL()!==actual.toDataURL())throw Error('Frame resampled or wrong atlas crop: '+frame);
     }
     const b=actual.getBoundingClientRect(),fb=fx.getBoundingClientRect(),dpr=devicePixelRatio,k=Number(actual.dataset.pixelScale);
     for(const [label,value] of [['left',b.left*dpr],['top',b.top*dpr],['width',b.width*dpr],['height',b.height*dpr]])if(Math.abs(value-Math.round(value))>.015)throw Error(label+' not on physical pixel grid: '+value);
     if(Math.abs(b.width*dpr-actual.width)>.015||Math.abs(b.height*dpr-actual.height)>.015)throw Error('Second CSS resampling');
     if(JSON.stringify(b.toJSON())!==JSON.stringify(fb.toJSON()))throw Error('FX and sprite grids differ');
     const stage=f.root.getBoundingClientRect();
     if(b.width/stage.width<.99||b.height/stage.height<.99)throw Error('Composition shrank instead of fitting the viewport');
     const flat=document.createElement('canvas');flat.width=actual.width;flat.height=actual.height;const fc=flat.getContext('2d');fc.fillStyle='#0d0e18';fc.fillRect(0,0,flat.width,flat.height);fc.drawImage(actual,0,0);
     return {dpr,viewport:[innerWidth,innerHeight],scale:k,frames:30,png:flat.toDataURL(),crop:{left:Math.round(b.left*dpr),top:Math.round(b.top*dpr),width:actual.width,height:actual.height}};
    });
    const {png,crop,...stats}=result;
    const screenshot=await page.screenshot();
    const actualPixels=await sharp(screenshot).extract(crop).removeAlpha().raw().toBuffer();
    const expectedPixels=await sharp(Buffer.from(png.split(',')[1],'base64')).removeAlpha().raw().toBuffer();
    let exact=actualPixels.equals(expectedPixels);
    // Chromium may round a zoomed layer's raster origin one physical pixel
    // away from its DOM rect. A rigid offset is fine; no changed texels are.
    if(!exact)for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
     const candidate={...crop,left:crop.left+dx,top:crop.top+dy};
     if(candidate.left<0||candidate.top<0||candidate.left+crop.width>viewport.width*dpr||candidate.top+crop.height>viewport.height*dpr)continue;
     const shifted=await sharp(screenshot).extract(candidate).removeAlpha().raw().toBuffer();
     if(shifted.equals(expectedPixels)){exact=true;console.log('Integer raster origin rounding',{dx,dy});}
    }
    assert(exact,'Composited browser pixels must match native canvas, without CSS blur: '+JSON.stringify(stats));
    console.log('PASS',stats);
    if(dpr===1&&viewport.width===1280)await page.screenshot({path:'/private/tmp/martini-pixel-grid.png'});
   }
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
