/* Animator-supplied serving sheets: 6×5 cells with 2px gutters, 20 FPS. */
window.LUNA_SERVE_COMPOSITION=Object.freeze({drinkOffsetY:1});
window.LUNA_SERVE_BACKGROUND={src:'assets/01.ArtResources/04.Cutscenes/03.Bar/01.Serving/03.Background/Background.png',cols:1,frames:1,fps:0,w:959,h:550,atlasWidth:959,atlasHeight:550};
window.LUNA_SERVE_SHEETS=Object.fromEntries(Object.entries({
 gin_tonic:'gintonic',cosmopolitan:'cosmopolitan',dry_martini:'drymartini',
 gin_fizz:'ginfizz',kahlua_milk:'kahluamilk',bottle_beer:'beer',
 screwdriver:'screwdriver',tequila_sunrise:'tequila_sunrise',
 champagne:'champagne',red_wine:'wine',whiskey_sour:'whisky',
 godfather:'godfather',johnny_old_fashioned:'old_fashioned'
}).map(([id,file])=>[id,{src:'assets/01.ArtResources/04.Cutscenes/03.Bar/01.Serving/02.Drink_Serving_Screen_Sheets/'+file+'.png',
 cols:6,frames:30,fps:20,w:954,h:539,sx:2,sy:2,dx:956,dy:541,atlasWidth:5738,atlasHeight:2707,layered:true}]));
// The recording centers the 539px sheet on a 550px backdrop. Crop 5px from
// the backdrop's top to fill the existing 960×540 stage without a vertical stretch.
window.LunaServeComposition={
 draw(ctx,background,drink,sheet,frame){
  if(background)ctx.drawImage(background,0,5,959,540,0,0,960,540);
  if(drink&&sheet)ctx.drawImage(drink,sheet.sx+frame%sheet.cols*sheet.dx,
   sheet.sy+Math.floor(frame/sheet.cols)*sheet.dy,sheet.w,sheet.h,
   3,window.LUNA_SERVE_COMPOSITION.drinkOffsetY,sheet.w,sheet.h);
 }
};
// Compose unchanged source texels on a 960x540 (16:9) stage: 3px padding
// on each side, 1px above. Then sample ONCE to the display's physical pixels.
// Integer-only enlargement made framing shrink/jump as the window or DPR
// changed. Pixel alignment must not choose the size of the composition.
window.LunaServePixels={
 layout(rect,dpr=1){
  const sx=rect.width/1280,sy=rect.height/720;
  // Keep the raster within the stage and on the CSS/device pixel lattice.
  // At fractional DPR this can inset the edges by at most a few physical
  // pixels, never by a percentage of the composition.
  const gcd=(a,b)=>b?gcd(b,a%b):a,ratio=Math.round(dpr*100),lattice=ratio/gcd(ratio,100);
  // Arbitrary browser zoom (e.g. DPR 1.3333) must not turn a rational
  // approximation into a huge 133px inset. Prefer physical pixels there.
  const quantum=lattice<=5?lattice:1;
  const start=v=>Math.ceil((v-1e-5)/quantum)*quantum,end=v=>Math.floor((v+1e-5)/quantum)*quantum;
  const x=start(rect.left*dpr),y=start(rect.top*dpr);
  const width=Math.max(1,end(rect.right*dpr)-x),height=Math.max(1,end(rect.bottom*dpr)-y);
  return {width,height,scale:width/960,scaleY:height/540,left:(x/dpr-rect.left)/sx,
   top:(y/dpr-rect.top)/sy,
   cssWidth:width/dpr/sx,cssHeight:height/dpr/sy};
 },
 fit(canvas,layout){
  if(canvas.width!==layout.width)canvas.width=layout.width;
  if(canvas.height!==layout.height)canvas.height=layout.height;
  // Layout zoom cancels the UI zoom before rasterization. A scale transform
  // would introduce another filtered texture, especially below 100% UI size.
  // Translation alone avoids CSS layout's 1/64px offset rounding at odd DPRs.
  const zoom=layout.cssWidth/layout.width;
  Object.assign(canvas.style,{left:'0px',top:'0px',width:layout.width+'px',height:layout.height+'px',zoom,transformOrigin:'0 0',
   transform:`translate(${layout.left/zoom}px,${layout.top/zoom}px)`});
  canvas.dataset.pixelScale=String(layout.scale);
 }
};
window.LunaServeView=function({g,D,C,L,esc,button,drinkArt,labelType,onStart}){
 const sheets=window.LUNA_SERVE_SHEETS,background=window.LUNA_SERVE_BACKGROUND;
 const drinkOffsetY=window.LUNA_SERVE_COMPOSITION.drinkOffsetY;
 const images=new Map(),duration=window.LunaServeGrade.timing.handoff;
 const gradeFX=window.LunaServeGrade,controlsAt=duration+gradeFX.timing.readable;
 const gradePlayback=gradeFX.createPlayback();
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 let current=null;
 const native=document.createElement('canvas');native.width=960;native.height=540;
 const nativeContext=native.getContext('2d');
 const nativeFX=document.createElement('canvas');nativeFX.width=960;nativeFX.height=540;
 function image(src){
  if(!images.has(src)){const img=new Image(),entry={img,ready:false,failed:false};images.set(src,entry);
   img.onload=()=>entry.ready=true;img.onerror=()=>entry.failed=true;img.src=src;}
  return images.get(src);
 }
 image(background.src);
 const visible=()=>['result','discarding'].includes(g.screen)&&!!g.result;
 function state(){
  if(!visible()){if(current)gradePlayback.dispose();current=null;return null;}
  if(current?.result!==g.result||current?.grade!==g.result.grade){
   current={result:g.result,grade:g.result.grade,startedAt:null,elapsed:0,frame:0,ready:false};
   gradePlayback.reset(g.result.grade);
   // Large RGBA atlases are decoded on demand; don't retain every drink sheet.
   const keep=sheets[g.result.selected]?.src;
   for(const src of images.keys())if(src!==background.src&&src!==keep)images.delete(src);
  }
  const sheet=sheets[g.result.selected],bg=image(background.src),art=sheet?image(sheet.src):null;
  const grade=image((gradeFX.assets[g.result.grade]||gradeFX.assets.decent).src);
  const loaded=(bg.ready||bg.failed)&&(!art||art.ready||art.failed)&&(grade.ready||grade.failed)&&gradePlayback.ready;
  current.loaded=loaded;
  if(loaded&&current.startedAt===null){current.startedAt=g.realTime;onStart?.(current);}
  current.elapsed=current.startedAt===null?0:Math.max(0,g.realTime-current.startedAt);
  current.frame=Math.min((sheet?.frames||30)-1,Math.floor(current.elapsed*(sheet?.fps||20)));
  current.ready=loaded&&current.elapsed>=controlsAt+gradeFX.timing.fade;
  return current;
 }
 function ready(){return !!state()?.ready&&!g.isPaused()&&!(g.remix?.resultLock>0)&&g.screen==='result';}
 function html(){
  const s=state();if(!s)return '';
  const r=s.result,declined=g.screen==='discarding',sheet=sheets[r.selected],failed=sheet&&image(sheet.src).failed;
  return '<section class="serve-presentation" style="--serve-art-offset-y:'+drinkOffsetY*720/540+'px" aria-label="'+L('칵테일 제공','Present drink')+'" '+(g.isPaused()?'inert':'')+' data-ready="'+s.ready+'" data-cocktail="'+esc(r.selected)+'">'+
   '<canvas class="serve-canvas" width="1280" height="720" aria-label="'+esc(g.name(r.selected))+'"></canvas>'+
   (!s.loaded?'<div class="serve-loading" role="status">'+L('제공 장면 불러오는 중…','Loading drink presentation…')+'</div>':'')+
   (s.loaded&&(!sheet||failed)?'<div class="serve-fallback" style="--serve-progress:'+Math.min(1,s.elapsed/duration)+'">'+drinkArt(r.selected)+'</div>':'')+
   (window.LunaServeCarbonation?.profiles[r.selected]?'<canvas class="serve-carbonation" width="1280" height="720" aria-hidden="true"></canvas>':'')+
   (s.loaded&&s.elapsed>=duration?'<canvas class="serve-grade-effects" width="1280" height="720" aria-hidden="true"></canvas><div class="serve-grade" role="status" data-grade="'+esc(r.grade)+'"><span class="serve-grade-label">'+L('제조완료','Complete')+' · '+esc(r.grade.toUpperCase())+'</span></div>':'')+
   (s.loaded&&s.elapsed>=controlsAt&&!declined?'<div class="serve-actions" style="opacity:0">'+button('<svg viewBox="0 0 32 38" aria-hidden="true"><path d="M3 9h26M11 7V3h10v4M5 12l2 23h18l2-23M12 15v15M20 15v15"/></svg><span class="serve-grade-label">'+L('버리기','Discard')+'</span>','discard',(ready()?'':'disabled ' )+'aria-label="'+L('버리기','Discard')+'"','serve-discard')+'<div class="serve-offer">'+button(L('제공하기','Offer drink'),'offer',ready()?'':'disabled','primary')+button(L('판정 결과','Score details'),'serveDetails',ready()?'':'disabled','serve-details-button')+'</div></div>':'')+
   '</section>';
 }
 function sync(root){
  const s=state(),canvas=root.querySelector('.serve-canvas');if(!s||!canvas)return;
  const rect=canvas.parentElement.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const layout=window.LunaServePixels.layout(rect,window.devicePixelRatio||1);
  window.LunaServePixels.fit(canvas,layout);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
  nativeContext.imageSmoothingEnabled=false;nativeContext.clearRect(0,0,native.width,native.height);
  const bg=image(background.src),sheet=sheets[s.result.selected],art=sheet?image(sheet.src):null;
  if(s.loaded)window.LunaServeComposition.draw(nativeContext,bg.ready?bg.img:null,art?.ready?art.img:null,sheet,s.frame);
  ctx.drawImage(native,0,0,canvas.width,canvas.height);
  canvas.dataset.frame=String(s.frame);
  canvas.dataset.source=art?.failed?'fallback':sheet?.src||'fallback';
  canvas.dataset.background=background.src;
  const actions=root.querySelector('.serve-actions');if(actions)actions.style.opacity=String(gradeFX.controlsOpacity(s.elapsed));
  const fx=root.querySelector('.serve-carbonation');
  if(fx){
   window.LunaServePixels.fit(fx,layout);
   // Fallback artwork can have different dimensions; never attach the sheet mask to it.
   const fallback=!sheet||art?.failed;
   const time=fallback||!s.loaded?-1:s.elapsed-duration;
   window.LunaServeCarbonation.draw(nativeFX,s.result.selected,time,[3,drinkOffsetY,1,1]);
   const fc=fx.getContext('2d');fc.imageSmoothingEnabled=false;fc.clearRect(0,0,fx.width,fx.height);
   fc.drawImage(nativeFX,0,0,fx.width,fx.height);
   for(const key of ['active','time','cocktail']){if(nativeFX.dataset[key]!==undefined)fx.dataset[key]=nativeFX.dataset[key];else delete fx.dataset[key];}
  }
  const gradeCanvas=root.querySelector('.serve-grade-effects');
  if(gradeCanvas){if(gradeCanvas.width!==layout.width||gradeCanvas.height!==layout.height)gradePlayback.invalidate(gradeCanvas);window.LunaServePixels.fit(gradeCanvas,layout);const entry=image((gradeFX.assets[s.result.grade]||gradeFX.assets.decent).src);gradePlayback.draw(gradeCanvas,entry.ready?entry.img:null,s.elapsed-duration,reduced||!!root.querySelector('.serve-fallback'),{background:canvas,carbonation:fx});}

 }
 function detailsHTML(){
  const r=g.result;if(!r)return '';
  const grade=score=>[...g.t.grade_cuts].sort((a,b)=>Number(b.min_pct)-Number(a.min_pct)).find(c=>score>=Number(c.min_pct))?.grade||'sewage';
  const labels={gimmick:L('기믹 오차','Gimmick errors'),glass:L('잔 불일치','Wrong glass'),tool:L('도구 누락·불일치','Missing / wrong tool'),missing:L('재료 누락','Missing ingredients'),extra:L('추가 재료','Extra ingredients'),overtime:L('제조시간 초과','Overtime')};
  return '<div class="serve-score-detail"><h3>'+esc(g.name(r.selected))+' · '+esc(r.grade.toUpperCase())+' · '+r.score.toFixed(1)+'/100</h3>'+
   '<table class="result-table"><thead><tr><th>'+L('기믹','Gimmick')+'</th><th>'+L('평균 점수','Mean score')+'</th><th>'+L('등급','Grade')+'</th><th>'+L('반영 비중','Weight')+'</th></tr></thead><tbody>'+
   r.representatives.map(x=>'<tr><td>'+esc(labelType(x.family))+' ×'+x.count+'</td><td>'+x.mean.toFixed(1)+'</td><td>'+grade(x.mean).toUpperCase()+'</td><td>'+x.weight+'</td></tr>').join('')+
   '</tbody></table><p>'+L('같은 기믹의 점수를 평균 낸 뒤 비중에 따라 합산하고, 아래 감점을 반영해 최종 등급을 결정합니다.','Scores of the same gimmick are averaged, weighted, then adjusted by the penalties below.')+'</p>'+
   '<div class="serve-step-details">'+r.results.map(x=>{
    const q=g.craft?.queue.find(q=>q.type===x.type&&q.ingredient===x.ingredient),value=['pour','fill_up'].includes(x.type)?Number(x.value).toFixed(1)+' / '+(q?.target??'—')+' '+(q?.unit||''):x.type==='open'?L('실수 ','Misses ')+x.failures:Math.round((x.completion||0)*100)+'%';
    return '<div><span>'+esc(labelType(x.type))+(x.ingredient?' · '+esc(g.name(x.ingredient)):'')+'</span><b>'+esc(value)+'</b></div>';
   }).join('')+'</div><table class="result-table">'+Object.entries(r.penalties).map(([k,v])=>'<tr><td>'+labels[k]+'</td><td class="'+(v?'bad':'muted')+'">−'+v.toFixed(1)+'</td></tr>').join('')+'</table>'+
   '<p class="serve-grade-cuts">'+[...g.t.grade_cuts].sort((a,b)=>Number(b.min_pct)-Number(a.min_pct)).map(x=>esc(x.grade.toUpperCase())+' ≥ '+x.min_pct).join(' · ')+'</p>'+
   (r.debug?'<p class="dummy-tag">'+L('테스트 강제 판정이므로 표의 계산과 등급이 다를 수 있습니다.','Debug override: the displayed grade may differ from the calculation.')+'</p>':'')+
   '<small>'+L('주문 일치 여부와 서빙 최종 등급은 손님에게 잔을 전달할 때 판정합니다.','Order matching and the final serving grade are checked when the guest receives the drink.')+'</small></div>';
 }
 return {html,sync,ready,detailsHTML,dispose:()=>gradePlayback.dispose()};
};
