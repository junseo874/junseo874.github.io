/* Playback adapter: use the same timeline, sprite renderer and subtitle layout
   as Cutscene Studio; never read or overwrite the editor's saved drafts. */
(function(W){'use strict';
const base=new URL('../../cutscene-studio/',document.currentScript.src),version='manual-tv-20261012';
let ready;const loaded=new Set();
async function prepare(id){
 if(!ready)ready=(async()=>{
  for(const name of ['tags','media','model','model-v2','keyframes','opening-template','typography','extras'])if(!loaded.has(name))await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=new URL(name+'.js?v='+version,base);script.onload=()=>{loaded.add(name);resolve();};script.onerror=()=>{script.remove();reject(Error('컷씬 모듈을 불러오지 못했습니다: '+name));};document.head.append(script);
  });
  await StudioMedia.ready;StudioOpening.register();
  for(const asset of StudioMedia.assets.values())if(asset.builtin&&asset.src)asset.src=new URL(asset.src,base).href;
 })().catch(error=>{ready=null;throw error;});
 await ready;
 const project=id==='documentary'?StudioOpening.documentary():StudioOpening.template();
 const ids=new Set(project.clips.map(c=>c.assetId).filter(Boolean));
 await Promise.all([...ids].map(async id=>{
  const asset=StudioMedia.assets.get(id);
  if(!asset)throw Error('컷씬 리소스가 없습니다: '+id);
  if(asset.kind==='audio')return StudioMedia.decode(id);
  if(asset.sheet)return;
  const image=StudioMedia.getImage(id);await image.decode();
 }));
 return {...project,end:project.duration};
}
function player(canvas,ui,project){
 canvas.width=1280;canvas.height=720;ui.hidden=true;
 const ctx=canvas.getContext('2d'),playback={playbackOnly:true,project,waitAge:0},extras=StudioExtras(playback);
 let waiting=null;
 let time=0,lastCamera=project.camera,typeLine=null,typeCount=0;
 const projectPoint=(x,y)=>({x:640+(x-lastCamera.x)*1280/lastCamera.w,y:360-(y-lastCamera.y)*1280/lastCamera.w});
function speech(c,s){
 const held=waiting?.id===c.id,waitAge=held?waiting.age:0,revealed=held&&waiting.revealed;
 if(StudioOpening.dialogue(ctx,c,s,lastCamera,time,waitAge,revealed,held))return;
 const a=s.actors[c.actor];if(!a||a.visible<.5||a.opacity<=0||a.asset&&!a.active)return;
 const k=1280/lastCamera.w,p=projectPoint(a.x+(c.offsetX||0),a.y+c.offset);
 ctx.save();const box=StudioTypography.bubble(ctx,c,k),{parsed,glyphs}=box.text,w=box.width,h=box.height;
 const left=p.x-w/2,top=p.y-h,clock=time+waitAge;
 ctx.fillStyle='#101c24ed';ctx.strokeStyle=c.remote?'#000':c.textEffect==='emphasis'?'#eac582':'#81bfc4';ctx.lineWidth=(c.remote?.022:.009)*k;ctx.beginPath();ctx.roundRect(left,top,w,h,.05*k);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-.045*k,p.y);ctx.lineTo(p.x,p.y+.05*k);ctx.lineTo(p.x+.045*k,p.y);ctx.fill();ctx.stroke();
 const elapsed=Math.max(0,time-c.start)+waitAge,count=c.textEffect==='instant'||revealed?parsed.chars.length:StudioTags.count(parsed,elapsed,c.cps);ctx.textBaseline='alphabetic';
 for(const ch of glyphs){if(ch.i>=count)continue;ctx.font=ch.font;ctx.fillStyle=ch.color||(c.textEffect==='emphasis'?'#f5d395':'#e2e8e5');const shake=ch.shake||(c.textEffect==='shake'?.8:0),dx=Math.sin(clock*49+ch.i*17)*k*.008*shake,dy=Math.cos(clock*61+ch.i*11)*k*.008*shake+(ch.wave?Math.sin(clock*7+ch.i*.5)*k*.018:0);let text=ch.ch;if(ch.censor&&text!==' ')text='▓▒█'[Math.floor(clock*8+ch.i)%3];else if(ch.noise&&text!==' ')text='░▐#?▒%01'[Math.floor(clock*15+ch.i*5)%8];ctx.fillText(text,left+box.paddingX+ch.x+dx,top+box.paddingY+ch.y+dy);}
 if(c.wait&&held&&count>=parsed.chars.length)W.LunaDialogueCue.draw(ctx,{right:left+w,bottom:p.y,size:.116*k*(c.fontScale??100)/100*.9,clock});
 ctx.restore();
}
 function render(t,previous,soundOn=true,volume=.55,dialogueWait=null){
  waiting=dialogueWait;playback.waitAge=waiting?.age||0;
  time=t;const s=StudioModel.sample(project,time);lastCamera={...s.camera};
  ctx.fillStyle='#090e16';ctx.fillRect(0,0,1280,720);ctx.imageSmoothingEnabled=false;
  for(const id of [...project.visibleActors].sort((a,b)=>(s.actors[a].layer||0)-(s.actors[b].layer||0))){const a=s.actors[id];if(a.visible>=.5)extras.drawAsset(ctx,a,lastCamera,time);}
  for(const c of project.clips.filter(c=>c.type==='dialogue'&&c.overlay&&c.id!==s.dialogue?.id&&time>=c.start&&time<c.start+c.duration))speech(c,s);
  if(s.dialogue)speech(s.dialogue,s);
  for(const f of s.fx){ctx.save();extras.fx(ctx,f,time);
   if(['fadeIn','fadeOut','flash'].includes(f.effect)){ctx.fillStyle=f.effect==='flash'?'#e6f6f5':'#020407';ctx.globalAlpha=(f.effect==='fadeIn'?1-f.u:f.effect==='fadeOut'?f.u:Math.sin(Math.PI*f.u))*f.strength;ctx.fillRect(0,0,1280,720);}
   if(f.effect==='noise'){ctx.globalAlpha=f.strength*.23;ctx.fillStyle='#b1d6da';for(let i=0;i<110;i++){const v=Math.sin(i*119.7+Math.floor(time*24)*37.9)*43758.54;ctx.fillRect((v-Math.floor(v))*1280,(i*83)%720,1+i%23,1+i%2);}ctx.globalAlpha=f.strength*.1;for(let y=0;y<720;y+=4)ctx.fillRect(0,y,1280,1);}
   ctx.restore();
  }
  // Do not start audio while rendering a paused frame or fading into a sequence.
  StudioMedia.sync(project,time,soundOn&&previous!=null,1,volume);
  const c=s.dialogue,parsed=c&&StudioTags.parse(c.text),held=c&&waiting?.id===c.id,n=c?(c.textEffect==='instant'||held&&waiting.revealed?parsed.chars.length:StudioTags.count(parsed,time-c.start+(held?waiting.age:0),c.cps)):0;
  if(soundOn&&previous!=null&&typeLine===c&&c?.textEffect!=='instant'&&n>typeCount)W.LunaDialogueAudio?.reveal(parsed.text,typeCount,n);
  typeLine=c;typeCount=n;
 }
 return {render,renderer:{sample:t=>StudioModel.sample(project,t)},dispose(){StudioMedia.stop();},pause(){StudioMedia.stop();}};
}
W.LunaStudioCinema={prepare,player,unlock:()=>W.StudioMedia?.unlock().catch(()=>{})};
})(window);
