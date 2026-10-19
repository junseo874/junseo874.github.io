const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
 const result=await p.evaluate(()=>{const project=lunaCampaign.cinema.scene,ctx=document.createElement('canvas').getContext('2d'),lines=project.clips.filter(c=>c.type==='dialogue');return lines.map(c=>{
  const box=StudioTypography.bubble(ctx,c,1),zoom=StudioTypography.bubble(ctx,c,300),maxRow=Math.max(...box.text.rows.map(r=>r.width));
  if(Math.abs(zoom.width/300-box.width)>1e-6||Math.abs(zoom.height/300-box.height)>1e-6)throw Error('zoom changed world size');
  if(Math.abs(box.width-Math.max(.35,maxRow+.2))>1e-6)throw Error('unnecessary horizontal space');
  if(box.text.glyphs.some(g=>g.x+g.width>box.width-.2+1e-6))throw Error('text overflow');
  return {text:StudioTags.parse(c.text).text,start:c.start,width:box.width,height:box.height,font:c.fontScale};
 });});
 const short=result.find(c=>c.text==='뭐가?'),long=result.find(c=>c.text.startsWith('저 같은'));assert(short.width<long.width*.4);assert.equal(long.font,75);assert(long.width<2.65);assert(long.height<.45);
 for(const [name,time]of [['short',short.start+1],['line',long.start+1],['overlap',result.find(c=>c.text.startsWith('아니.')).start+.6]]){await p.evaluate(t=>{lunaCampaign.cinema.time=t;lunaCampaign.cinema.player.render(t,null,false);},time);await p.locator('.campaign-stage').screenshot({path:'/private/tmp/compact-bubble-'+name+'.png'});}
 assert.deepEqual(errors,[]);console.log('PASS 20 lines: full-text fit, camera-invariant world size, no overflow',JSON.stringify({short,long}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
