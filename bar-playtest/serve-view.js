/* One-shot serving presentation. Original PNG sheets remain unchanged. */
window.LunaServeView=function({g,D,C,L,esc,button,drinkArt,labelType}){
 const sheets={
  gin_tonic:{src:'assets/serve-gin-tonic.png',cols:6,w:959,h:540,sx:2,sy:3,dx:961,dy:543,full:true},
  cosmopolitan:{src:'assets/serve-cosmo.png',cols:5,w:376,h:531,x:340,y:-10,scale:.85},
  dry_martini:{src:'assets/serve-dry-martini.png',cols:5,w:376,h:531,x:340,y:-10,scale:.85},
  gin_fizz:{src:'assets/serve-gin-fizz.png',cols:5,w:336,h:496,x:315,y:-12,scale:.91},
  kahlua_milk:{src:'assets/serve-kahlua.png',cols:5,w:285,h:479,x:364,y:-16,scale:.93}
 };
 const images=new Map(),duration=1.5;
 let current=null;
 function image(src){
  if(!images.has(src)){const img=new Image(),entry={img,ready:false,failed:false};images.set(src,entry);
   img.onload=()=>entry.ready=true;img.onerror=()=>entry.failed=true;img.src=src;}
  return images.get(src);
 }
 image('assets/serve-background.png');
 const visible=()=>['result','discarding'].includes(g.screen)&&!!g.result;
 function state(){
  if(!visible()){current=null;return null;}
  if(current?.result!==g.result)current={result:g.result,startedAt:null,elapsed:0,frame:0,ready:false};
  const sheet=sheets[g.result.selected],bg=image('assets/serve-background.png'),art=sheet?image(sheet.src):null;
  const loaded=(sheet?.full?art.ready||art.failed:bg.ready||bg.failed)&&(!art||art.ready||art.failed);
  if(loaded&&current.startedAt===null)current.startedAt=g.realTime;
  current.elapsed=current.startedAt===null?0:Math.max(0,g.realTime-current.startedAt);
  current.frame=Math.min(29,Math.floor(current.elapsed*20));
  current.ready=loaded&&current.elapsed>=duration;
  return current;
 }
 function ready(){return !!state()?.ready&&!g.isPaused()&&!(g.remix?.resultLock>0)&&g.screen==='result';}
 function html(){
  const s=state();if(!s)return '';
  const r=s.result,declined=g.screen==='discarding',sheet=sheets[r.selected],failed=sheet&&image(sheet.src).failed;
  return '<section class="serve-presentation" aria-label="'+L('칵테일 제공','Present drink')+'" '+(g.isPaused()?'inert':'')+' data-ready="'+s.ready+'" data-cocktail="'+esc(r.selected)+'">'+
   '<canvas class="serve-canvas" width="1280" height="720" aria-label="'+esc(g.name(r.selected))+'"></canvas>'+
   (!sheet||failed?'<div class="serve-fallback" style="--serve-progress:'+Math.min(1,s.elapsed/duration)+'">'+drinkArt(r.selected)+'</div>':'')+
   (s.ready?'<div class="serve-grade" role="status" data-grade="'+esc(r.grade)+'">'+esc(r.grade.toUpperCase())+'</div>':'')+
   (s.ready&&!declined?'<div class="serve-actions">'+button(L('버리기','Discard'),'discard',ready()?'':'disabled','serve-discard')+'<div class="serve-offer">'+button(L('제공하기','Offer drink'),'offer',ready()?'':'disabled','primary')+button(L('판정 결과','Score details'),'serveDetails',ready()?'':'disabled','serve-details-button')+'</div></div>':'')+
   '</section>';
 }
 function sync(root){
  const s=state(),canvas=root.querySelector('.serve-canvas');if(!s||!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,1280,720);
  const bg=image('assets/serve-background.png'),sheet=sheets[s.result.selected],art=sheet?image(sheet.src):null;
  if(sheet?.full&&art.ready){
   ctx.drawImage(art.img,sheet.sx+s.frame%sheet.cols*sheet.dx,sheet.sy+Math.floor(s.frame/sheet.cols)*sheet.dy,sheet.w,sheet.h,0,0,1280,720);
  }else{
   if(bg.ready)ctx.drawImage(bg.img,0,6,959,540,0,0,1280,720);
   if(art?.ready){
    const k=1280/959;
    ctx.drawImage(art.img,s.frame%sheet.cols*sheet.w,Math.floor(s.frame/sheet.cols)*sheet.h,sheet.w,sheet.h,sheet.x*k,sheet.y*k,sheet.w*sheet.scale*k,sheet.h*sheet.scale*k);
   }
  }
  canvas.dataset.frame=String(s.frame);
  canvas.dataset.source=art?.failed?'fallback':sheet?.src||'fallback';
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
 return {html,sync,ready,detailsHTML};
};
