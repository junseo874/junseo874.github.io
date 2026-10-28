// Render code-authored UI as isolated 1x PNGs. No scene or dialogue text is captured.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/ui/parts');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:800,height:600},deviceScaleFactor:1});
 const css=['src/app/styles.css','src/shared/dialogue/world-choices.css','src/features/outside/outside.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
 const font=fs.readFileSync(path.join(root,'assets/fonts/kopubworld-dotum-medium.ttf')).toString('base64');
 const base=css+`\n@font-face{font-family:LunaPixel;src:url(data:font/ttf;base64,${font})}html,body{margin:0;background:transparent}*,*:before,*:after{animation:none!important;transition:none!important}`;
 async function capture(name,html,w,h,style=''){
  await p.setContent(`<style>${base}\n${style}</style>${html}`);await p.evaluate(()=>document.fonts.ready);await p.mouse.move(700,500);
  const file=path.join(out,name+'.png');fs.mkdirSync(path.dirname(file),{recursive:true});await p.screenshot({path:file,clip:{x:0,y:0,width:w,height:h},omitBackground:true});
 }
 const panel=(side,html)=>`<section class="world-choices outside-choices" data-side="${side}">${html}</section>`;
 for(const side of ['right','left']){
  await capture('choices/selected-background-'+side,panel(side,'<button class="is-selected"></button>'),64,32,'.world-choices.outside-choices{left:0;top:0;width:64px}.world-choices.outside-choices button{width:64px;height:32px}');
  // Attribute selector specificity is intentional: left-layout rules must not move the marker outside the crop.
  await capture('choices/pointer-'+side,panel(side,'<kbd class="world-choice-confirm"></kbd>'),5,6,'.world-choices{left:0;top:0}.world-choices[data-side] .world-choice-confirm{left:0;right:auto;top:0;width:0;height:0;padding:0;border:0;box-shadow:none;background:none}.world-choices[data-side] .world-choice-confirm:after{left:0;top:0}');
 }
 await capture('choices/inactive-line','<div style="width:2px;height:30px;background:#347f91"></div>',2,30);
 for(const blank of [false,true])await capture('choices/'+(blank?'key-frame':'key-e'),panel('right',`<kbd class="world-choice-confirm">${blank?'':'E'}</kbd>`),32,34,'.world-choices{left:0;top:0}.world-choices .world-choice-confirm{left:5px;top:5px}.world-choice-confirm:after{display:none}');
 const guide=html=>'<aside class="world-choice-tutorial">'+html+'</aside>';
 const isolate='.world-choice-tutorial{left:0;top:0;width:auto;height:auto;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none}.world-choice-tutorial:before{display:none}.choice-wheel-input{display:flex}';
 for(const key of ['W','S','E'])await capture('tutorial/key-'+key.toLowerCase(),guide('<kbd>'+key+'</kbd>'),27,30,isolate);
 // Pull icon markup from the actual component instead of maintaining a second SVG drawing.
 await p.setContent('<div id="host"></div>');await p.addScriptTag({path:path.join(root,'src/shared/dialogue/world-choices.js')});
 const icons=await p.evaluate(()=>{LunaWorldChoices.create(document.querySelector('#host'),()=>{});return {mouse:document.querySelector('.choice-guide-mouse').outerHTML,triangles:[...document.querySelectorAll('.choice-guide-triangle')].map(el=>el.outerHTML)};});
 await capture('tutorial/mouse-wheel',guide(icons.mouse),24,32,isolate);
 for(const [i,id]of ['up','down'].entries())await capture('tutorial/triangle-'+id,guide('<span class="choice-wheel-input">'+icons.triangles[i]+'</span>'),12,10,isolate);
 await capture('tutorial/panel-background',guide(''),510,400,'.world-choice-tutorial{left:80px;top:60px;height:230px}.world-choice-tutorial:before{display:none}');
 await capture('tutorial/panel-accent',guide(''),80,35,'.world-choice-tutorial{left:0;top:0;width:80px;height:35px;padding:0;border:0;background:none;box-shadow:none}.world-choice-tutorial:before{left:16px;top:16px}');
 await capture('tutorial/divider','<div style="width:308px;height:1px;background:#375361"></div>',308,1);
 for(const small of [false,true])await capture('interaction/outside-interact-e'+(small?'-32x32':''),'<button class="outside-interact"><kbd>E</kbd></button>',small?32:48,small?32:48,`.outside-interact{left:${small?0:8}px;top:${small?0:8}px;bottom:auto;min-height:0;margin:0;padding:0}`);
 require('./build_resource_extraction_catalog.cjs');console.log('Rendered 18 isolated UI parts from current game styles.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
