/* Presentation only: no writes to gameplay tables, recipes or generated part IDs. */
window.LunaBarViews=function({D,g,ui,L,esc,a,button,itemArt,drinkArt,recipeLines}){
  const categories=['glass','tool','liquor','fridge'];
  const categoryName=id=>({glass:L('잔 선반','Glasses'),tool:L('도구 선반','Tools'),liquor:L('술 선반','Liquor'),fridge:L('냉장고','Fridge')})[id];
  const actors=new WeakMap();
  const opener={id:'opener',kind:'auxiliary','name.ko':'병따개','name.en':'Bottle opener',
    'desc.ko':'병마개를 여는 보조 도구. 병 재료의 병따기 단계에서 사용합니다.',
    'desc.en':'An auxiliary tool used to open capped bottles.'};
  const itemName=id=>id==='opener'?L('병따개','Bottle opener'):g.name(id);
  function actorBounds(guest){
    if(!guest.appearance)return D.webActorBounds?.[guest.actor]||[0,0,551,440];
    const boxes=guest.appearance.layers.map(k=>D.assets[k]?.alphaBBox).filter(Boolean);
    return boxes.length?[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))]:[0,0,551,440];
  }

  function actorLayers(guest,expression,talking){
    if(guest.appearance){
      const app=guest.appearance, gender=app.gender;
      const eyes=app.layers.find(k=>/eyes_\d+$/.test(k))?.split('_').at(-1);
      const mouth=app.layers.find(k=>/mouth_\d+$/.test(k))?.split('_').at(-1);
      const replace={['guest_'+gender+'_body']:'guest_'+gender+'_talk_body',
        ['guest_'+gender+'_eyes_'+eyes]:'guest_'+gender+'_talk_eyes_'+eyes,
        ['guest_'+gender+'_mouth_'+mouth]:'guest_'+gender+'_talk_mouth_'+mouth};
      const available=Object.values(replace).every(k=>D.assets[k]);
      return {keys:talking&&available?app.layers.map(k=>replace[k]||k):app.layers,
        pose:talking?(available?'talk':'static-fallback'):'idle'};
    }
    const states=D.characterLayers[guest.actor];if(!states)return {keys:[],pose:'placeholder'};
    const state=expression==='default'?'idle':expression||'idle';
    const suffix='_'+(talking?'talk':'default');
    const key=Object.keys(states).find(k=>k.toLowerCase().endsWith(state.toLowerCase()+suffix))
      ||Object.keys(states).find(k=>k.endsWith('idle'+suffix))
      ||Object.keys(states).find(k=>k.endsWith('idle_default'))||Object.keys(states)[0];
    return {keys:states[key],pose:key};
  }
  function actorHTML(guest,x){
    let state=actors.get(guest);
    if(!state){state={start:g.realTime,pose:null,poseAt:g.realTime,speech:null,exitAt:null,glass:guest.glass,drinkUntil:0};actors.set(guest,state);}
    if(guest.glass&&guest.glass!==state.glass){state.drinkUntil=g.realTime+1;}
    state.glass=guest.glass;
    const d=g.currentDialogue();
    // Personality IDs may repeat; only the focused general guest owns this bubble.
    const speaking=d?.actor===guest.actor&&(g.phase!=='general'||g.seats[g.focus]===guest);
    const talking=g.screen==='bar'&&speaking&&d.chars<d.text.length;
    const cycle=D.webArtRules.animationCycleSeconds||1;
    if(talking){
      const pose=actorLayers(guest,d.expression,true);
      // One continuous clock per guest/pose, NOT per letter or dialogue line.
      if(!state.speech||state.speech.pose.pose!==pose.pose){
        state.speech={pose,startedAt:g.realTime,stopAt:null};
      }else{state.speech.pose=pose;state.speech.stopAt=null;}
    }else if(state.speech){
      const speech=state.speech;
      if(speech.stopAt===null){
        // The bubble disappears while the camera moves. Keep this guest's own
        // expression and finish the current cycle instead of snapping to idle.
        const animated=speech.pose.keys.some(k=>(D.assets[k]?.frames||1)>1);
        speech.stopAt=animated?speech.startedAt+Math.ceil(Math.max(0,g.realTime-speech.startedAt)/cycle)*cycle:g.realTime;
      }
      if(g.realTime>=speech.stopAt)state.speech=null;
    }
    const drinking=guest.actor==='samho'&&g.realTime<state.drinkUntil&&!state.speech;
    const pose=state.speech?.pose||actorLayers(guest,drinking?'drink':speaking?d.expression:'idle',false);
    if(pose.pose!==state.pose){state.pose=pose.pose;state.poseAt=g.realTime;}
    if(guest.state==='EXITING'&&state.exitAt===null)state.exitAt=g.realTime;
    const entering=Math.min(1,(g.realTime-state.start)/.65);
    // General farewell dialogue remains visible, then the guest leaves.
    const exiting=state.exitAt===null?0:Math.min(1,Math.max(0,(g.realTime-state.exitAt-(g.phase==='general'?2.5:0))/.45));
    const opacity=Math.min(entering,1-exiting),offset=(1-entering)*25+exiting*25;
    const box=actorBounds(guest),base=guest.actor==='bubi'?535:guest.appearance?500:522;
    const top=base-box[3],centerOffset=275.5-(box[0]+box[2])/2;
    const speechState=state.speech?(talking?'looping':'finishing'):'idle';
    return `<div class="actor pixel-actor" data-actor="${esc(guest.actor)}" data-baseline="${base}" data-pose="${esc(pose.pose)}" data-talking="${talking}" data-speech-state="${speechState}" style="left:calc(${x}% + ${centerOffset}px);top:${top}px;opacity:${opacity};--arrival:${offset}px">
      ${pose.keys.length?pose.keys.map(k=>{
        // CharacterPart.SetClipSpeed: Clip.length / TARGET_LENGTH(1s).
        // The engine normalizes cycle length; source sample rate is NOT playback FPS.
        const s=D.assets[k],frames=s.frames||1,frame=Math.floor(Math.max(0,g.realTime-(state.speech?.startedAt??state.poseAt))/cycle*frames)%frames;
        const fw=s.frameWidth||s.w/frames,fh=s.frameHeight||s.h;
        const [dx,dy]=D.webPoseOffsets?.[guest.actor]?.[pose.pose]||[0,0];
        // Port's older serious canvas is smaller: keep native pixels, bottom-center.
        return `<div class="actor-layer" data-layer="${esc(k)}" data-frame="${frame}" style="width:${fw/551*100}%;height:${fh/530*100}%;left:${50+dx/551*100}%;bottom:${-dy/530*100}%;background-image:url('${s.src}');background-size:${frames*100}% 100%;background-position:${frames>1?frame/(frames-1)*100:0}% 0"></div>`;
      }).join(''):'<div class="dummy-actor"></div>'}
    </div>`;
  }
  function worldHTML(){
    const visible=Object.entries(g.seats).filter(([,v])=>v);
    const general=g.phase==='general',wide=general?g.overview:visible.length>1;
    const coords=general?{L:520,M:1020,R:1520}:{L:750,M:1020,R:1290};
    const cameraWidth=wide?1280:960,scale=1280/cameraWidth;
    const center=wide?1020:general?coords[g.focus]:coords[visible[0]?.[0]||'M'];
    const cameraX=Math.max(0,Math.min(2041-cameraWidth,center-cameraWidth/2));
    const cameraY=500-534/scale;
    const transform=depth=>`transform:translate(${-cameraX*scale*depth}px,${-cameraY*scale}px) scale(${scale})`;
    const plane=(name,depth,content)=>`<div class="bar-scene-layer ${name}" data-depth="${depth}" style="${transform(depth)}">${content}</div>`;
    const back=visible.filter(([,v])=>!!v.appearance),front=visible.filter(([,v])=>!v.appearance);
    const zones=(g.phase==='practice'?['M']:['L','M','R']).map(seat=>{
      const guest=g.seats[seat];if(g.phase!=='practice'&&!guest)return '';
      const canCoaster=general&&g.focus===seat&&guest.state==='WAIT_COASTER';
      const canServe=!!g.drink&&(g.phase==='practice'||guest?.coaster&&(general?g.focus===seat&&guest.state==='WAIT_SERVE':g.currentOrder?.seat===seat));
      const baseline=general?530:542;
      return `<div class="coaster-zone native-coaster ${ui.drag&&(canCoaster&&ui.drag==='coaster'||canServe&&ui.drag==='drink')?'drop-ready':''}" data-drop="${g.phase==='practice'?'L':seat}" data-table-baseline="${baseline}" style="left:${coords[seat]-60}px;top:${baseline-124}px">${guest?.coaster||g.phase==='practice'?`<img class="coaster" src="${a('coaster')}" alt="코스터" draggable="false">`:''}${guest?.glass?drinkArt(guest.glass,'table'):''}${ui.drag&&canServe?'<span class="seat-note">'+L('여기에 제공','Drop here')+'</span>':''}</div>`;
    }).join('');
    return `<div class="stage bar-stage" data-camera-width="${cameraWidth}">
      ${plane('far-plane',.88,`<img src="${a('bar_far')}" alt="">`)}
      ${plane('mid-plane',.95,`<img src="${a('bar_mid')}" alt="">`)}
      ${plane('guest-plane',1,back.map(([seat,guest])=>actorHTML(guest,coords[seat]/2041*100)).join(''))}
      ${plane('counter-plane',1,`<img src="${a('bar_front')}" alt="">`)}
      ${plane('regular-plane',1,front.map(([seat,guest])=>actorHTML(guest,coords[seat]/2041*100)).join(''))}
      ${plane('serve-plane',1,zones)}<div class="vignette"></div></div>`;
  }
  function recipePanel(c){
    const recipe=g.t.recipes.filter(r=>r.context===c.id);
    const tags=g.t.cocktail_tags.filter(t=>t.context===c.id);
    const needsOpener=recipe.some(r=>g.t.shelf_items.find(i=>i.id===r.ingredient)?.prep_action==='open');
    const icons=[c.glass,...(c.mix==='shake'?['shaker']:c.mix==='stir'?['mixing_glass']:[]),...(needsOpener?['opener']:[]),...recipe.map(r=>r.ingredient)];
    return `<aside class="prep-recipe" aria-label="${L('선택한 칵테일 레시피','Selected cocktail recipe')}">
      <div class="prep-recipe-heading"><small>${esc(c['name.en'])}</small>${button('×','togglePrepRecipe','aria-label="'+L('레시피 접기','Close recipe')+'"')}<h2>${esc(g.name(c.id))}</h2></div>
      <div class="prep-recipe-scroll"><div class="recipe-tags"><span>${esc(c.mix.toUpperCase())}</span>${tags.map(t=>`<span>${esc(t[g.lang]||t.ko)}</span>`).join('')}</div>
      <div class="recipe-hero">${drinkArt(c.id,'recipe')}</div><div class="recipe-icon-grid">${icons.map(id=>`<div title="${esc(itemName(id))}">${itemArt(id,'','recipe')}<small>${esc(itemName(id))}</small></div>`).join('')}</div>
      <section><h3>${L('칵테일 설명','About this cocktail')}</h3><p>${esc(g.text(c,'flavor')||L('소개 문구 준비 중','Description pending'))}</p></section>
      <section><h3>${L('제조법','Method')}</h3><p>${esc(g.text(c,'recipe_desc'))}</p>${recipeLines(c)}</section></div>
    </aside>`;
  }
  function layout(tab=ui.tab){
    const all=g.itemsAvailable().filter(i=>tab==='glass'?i.kind==='glass':tab==='tool'?i.kind==='tool':i.kind==='ingredient'&&i.shelf_group===tab);
    if(tab==='tool')all.push(opener);
    const capacity=tab==='liquor'?16:tab==='fridge'?14:8;
    const pages=Math.max(1,Math.ceil(all.length/capacity));let page=tab===ui.tab?Math.min(ui.shelfPage||0,pages-1):0;
    if(tab===ui.tab)ui.shelfPage=page;
    let items=all.slice(page*capacity,(page+1)*capacity);
    let topCount=0;
    if(tab==='fridge'){
      const short=items.filter(i=>!a('item_'+i.id)||D.assets['item_'+i.id].h<=119);
      const top=short.slice(0,7);topCount=top.length;
      items=[...top,...items.filter(i=>!top.includes(i))];
    }
    const positioned=items.map((item,i)=>{
      let w,h,x,y;
      if(tab==='glass'){w=90;h=190;x=480-(items.length-1)*48+i*96;y=366;}
      else if(tab==='tool'){w=140;h=230;x=320+i*160;y=367;}
      else if(tab==='liquor'){w=57;h=171;x=274+(i%8)*59;y=i<8?193:397;}
      else {const top=i<topCount;w=93;h=top?119:223;x=190+(top?i:i-topCount)*95;y=top?153:393;}
      return {item,w,h,x,y};
    });return {all,pages,positioned};
  }
  function prepHTML(){
    const p=g.prep,c=g.cocktail(p.selected),{pages,positioned}=layout();
    const selected=[p.glass,p.tool,p.opener?'opener':null,...p.ingredients].filter(Boolean);
    const hovered=positioned.find(o=>o.item.id===ui.hoverItem);
    const tooltip=hovered?(()=>{const {item,x,y,h}=hovered;const below=y-h<70;
      return `<div id="ingredient-tip" role="tooltip" class="ingredient-tip ${below?'below':''}" style="left:${Math.max(175,Math.min(785,x))/960*100}%;${below?'top':'bottom'}:${(below?y+18:540-y+h+18)/540*100}%"><strong>${esc(itemName(item.id))}</strong><span>${esc(g.text(item,'desc')||L('소개 문구 준비 중','Description pending'))}</span>${!a('item_'+item.id)?`<small>${L('전용 이미지 미제공 · 팀 더미 이미지 사용','Shared team placeholder artwork')}</small>`:''}</div>`;
    })():'';
    return `<div class="craft-screen prep-screen ${ui.recipeOpen?'prep-open':''}">
      <header class="prep-heading">${button('← '+L('뒤로','Back'),'prepBack')}<span>${esc(g.name(p.selected))} <small> / ${L('재료 담기','Preparation')}</small></span><small class="prep-reset-note">${L('뒤로 가면 선택이 모두 초기화됩니다.','Back clears every selection.')}</small></header>
      <div class="prep-main"><div class="shelf-viewport"><div class="shelf-track" style="transform:translateX(${-categories.indexOf(ui.tab)*100}%)">
      ${categories.map(tab=>{const {positioned:placed}=layout(tab);return `<div class="shelf-slide" data-current="${tab===ui.tab}" ${tab===ui.tab?'':'inert'}><div class="shelf-fit"><div class="shelf-scene" style="background-image:url('${a('prep_'+tab)}')" data-category="${tab}">
        ${placed.map(({item:i,x,y,w,h})=>{
          const art=D.assets['item_'+i.id]||D.assets.item_dummy,ratio=Math.min(w/art.w,h/art.h),bottom=(art.h-(art.alphaBBox?.[3]||art.h))*ratio;
          return `<button class="shelf-item ${selected.includes(i.id)?'selected':''}" data-act="${i.id==='opener'?'pickOpener':'pick'}" data-id="${i.id}" data-hover-item="${i.id}" data-baseline="${y}" aria-label="${esc(itemName(i.id))}" aria-pressed="${selected.includes(i.id)}" ${hovered?.item.id===i.id?'aria-describedby="ingredient-tip"':''} style="left:${x/960*100}%;bottom:${(540-y)/540*100}%;width:${w/960*100}%;height:${h/540*100}%"><img class="shelf-sprite" src="${art.src}" alt="${esc(itemName(i.id))}" draggable="false" style="width:${art.w*ratio/w*100}%;height:${art.h*ratio/h*100}%;bottom:${-bottom/h*100}%">${selected.includes(i.id)?'<span class="picked-mark">✓</span>':''}${!a('item_'+i.id)?`<span class="shelf-placeholder-label">${esc(itemName(i.id))}</span>`:''}</button>`;
        }).join('')}
        ${!placed.length?`<div class="shelf-empty">${L('오늘 해금된 항목이 없습니다.','Nothing unlocked here today.')}</div>`:''}${tab===ui.tab?tooltip:''}
      </div></div></div>`;}).join('')}</div></div>
      <button class="shelf-arrow prev" data-act="shelfCategory" data-id="-1" aria-label="${L('이전 선반','Previous shelf')}" ${ui.tab==='glass'?'disabled':''}>‹</button>
      <button class="shelf-arrow next" data-act="shelfCategory" data-id="1" aria-label="${L('다음 선반','Next shelf')}" ${ui.tab==='fridge'?'disabled':''}>›</button>
      ${pages>1?`<div class="shelf-pagination">${button('‹','shelfPage','data-id="-1" '+(!ui.shelfPage?'disabled':''))}<span>${ui.shelfPage+1} / ${pages}</span>${button('›','shelfPage','data-id="1" '+(ui.shelfPage===pages-1?'disabled':''))}</div>`:''}
      </div><div class="prep-controls">${button('▤ '+L('레시피','Recipe'),'togglePrepRecipe',`aria-expanded="${!!ui.recipeOpen}"`,'recipe-toggle')}
        <div class="shelf-navigation"><span><kbd>A</kbd> ${categoryName(ui.tab)} <kbd>D</kbd></span><div class="shelf-dots">${categories.map(id=>button(`<span></span><i>${categoryName(id)}</i>`,'tab',`data-id="${id}" aria-label="${categoryName(id)}" aria-pressed="${ui.tab===id}"`,ui.tab===id?'selected':'')).join('')}</div></div>
        ${button(L('제조 시작','Start crafting'),'craft',!p.glass||!p.ingredients.length?'disabled':'','craft-start')}</div>
      <div class="prep-inventory"><div class="inventory-label">${L('선택한 재료','YOUR SELECTION')}<small>${selected.length} ${L('개','items')}</small></div><div class="inventory-scroll">${selected.map(id=>button(`${itemArt(id,'','inventory')}<span class="remove-mark">×</span><span class="inventory-item-name">${esc(itemName(id))}</span>`,id==='opener'?'pickOpener':'pick',`data-id="${id}" aria-label="${esc(itemName(id))} ${L('선택 해제','remove')}"`,'inventory-slot')).join('')}<div class="inventory-slot empty-slot" aria-hidden="true">＋</div></div></div>
      ${ui.recipeOpen?recipePanel(c):''}</div>`;
  }
  function motionHTML(s,crop){
    const art=D.assets[s.type==='stir'?'mix_stir_motion':'mix_shake_motion'];
    const frame=Math.floor(s.elapsed/(D.mixView.motionCycleSeconds||1)*art.frames)%art.frames;
    const [x,y,w,h]=crop,fw=art.frameWidth,fh=art.frameHeight;
    // Height-based sizing preserves source pixels in the portrait AND the close-up.
    return `<div class="motion-crop"><div class="mix-motion" data-motion-frame="${frame}" style="width:calc(100cqh * ${fw/h});height:calc(100cqh * ${fh/h});left:calc(50% - 100cqh * ${(x+w/2)/h});top:calc(100cqh * ${-y/h});background-image:url('${art.src}');background-size:${art.frames*100}% 100%;background-position:${frame/(art.frames-1)*100}% 0"></div></div>`;
  }
  function mixGauge(s,vertical=false){
    const results=s.outcomes||[];
    return `<div class="mix-gauge ${vertical?'vertical':''}" role="img" aria-label="${L('성공','Success')} ${s.success} / ${s.targetStacks}">${Array.from({length:s.targetStacks},(_,i)=>`<i class="${i<results.length?(results[i]?'good':'miss'):i===s.attempts&&!s.completed?'current':''}"></i>`).join('')}</div>`;
  }
  function mixTimer(s){
    const sec=Math.floor(s.elapsed),time=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
    return `<div class="mix-timer" aria-label="${L('현재 기믹 시간','Step time')} ${time}"><svg viewBox="0 0 36 42" aria-hidden="true"><path d="M13 2h10M18 2v6M29 9l3-3"/><circle cx="18" cy="25" r="14"/><path d="M18 13v12h9"/></svg><span>${time}</span></div>`;
  }
  function stirBoard(s){
    const pos=[[50,0],[100,50],[50,100],[0,50]],next=s.started?(s.stirPos+1)%4:0;
    const progress=s.completed?1:s.stirStep/4,limit=g.c('stir_circle_limit_sec',2);
    const [x,y,w,h]=D.mixView.stirCupCrop,ref=D.assets.mix_stir_reference;
    return `<section class="mix-board stir-board"><div class="mix-guide"><b>${L('시계 방향으로 젓기','STIR CLOCKWISE')}</b><span>${L('W 시작 · D → S → A → W','Start W · D → S → A → W')}<br>${L('한 바퀴 제한','Circle limit')} ${limit}${L('초','s')} · ${s.targetStacks}${L('회',' rounds')}</span></div>${mixTimer(s)}
      <div class="stir-dial">
        <div class="stir-cup-reference" aria-label="${L('믹싱 글라스 윗면','Mixing glass, overhead')}"><img src="${ref.src}" alt="" draggable="false" style="width:${ref.w/w*100}%;height:${ref.h/h*100}%;left:${-x/w*100}%;top:${-y/h*100}%"></div>
        <svg class="stir-orbit" viewBox="0 0 400 400" aria-hidden="true"><circle class="orbit-base" cx="200" cy="200" r="180"/><circle class="orbit-progress" cx="200" cy="200" r="180" pathLength="100" stroke-dasharray="${progress*100} 100" transform="rotate(-90 200 200)"/></svg>
        ${['W','D','S','A'].map((k,i)=>`<button class="mix-direction ${i===next&&!s.completed?'next':''} ${s.started&&i===s.stirPos?'pressed':''}" style="left:${pos[i][0]}%;top:${pos[i][1]}%" data-act="stir" data-id="Key${k}" aria-label="${k}" ${s.completed?'disabled':''}>${k}</button>`).join('')}
      </div><div class="mix-feedback ${s.message==='MISS'?'miss':''}">${s.completed?L('스터 완료','STIR COMPLETE'):s.started?(s.message==='GOOD'||s.message==='MISS'?s.message:L('다음 키','NEXT')+' '+['W','D','S','A'][next]):L('W 키를 눌러 시작하세요','Press W to begin')}<small>${s.success} / ${s.targetStacks} ${L('성공','successful')} · ${s.attempts} ${L('진행','attempted')}${s.started&&!s.completed?' · '+Math.max(0,limit-s.circleTime).toFixed(1)+'s':''}</small></div>${mixGauge(s)}</section>`;
  }
  function shakeBoard(s){
    const points=[[75,60],[510,205],[75,350],[510,495]],loop=s.attempts%6;
    const [from,to]=loop<3?[points[loop],points[loop+1]]:[points[6-loop],points[5-loop]];
    const at=t=>[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t];
    const period=60/g.c('shake_bpm',60),t=s.completed?1:Math.min(1,s.beatTime/period),marker=at(t),target=at(.75),start=at(.59),end=at(.91);
    return `<section class="mix-board shake-board"><div class="mix-guide"><b>${L('리듬에 맞춰 흔들기','SHAKE TO THE BEAT')}</b><span>${L('분홍 표시가 노란 원에 오면 Space','Press Space as pink meets gold')}</span></div>${mixTimer(s)}${mixGauge(s,true)}
      <svg class="shake-path" viewBox="0 0 600 555" aria-hidden="true">
        <polyline points="${points.map(p=>p.join(',')).join(' ')}" class="shake-route"/>
        ${points.slice(0,-1).map((p,i)=>[.25,.5,.75].map(t=>`<circle cx="${p[0]+(points[i+1][0]-p[0])*t}" cy="${p[1]+(points[i+1][1]-p[1])*t}" r="10" class="shake-waypoint"/>`).join('')).join('')}
        ${points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="15" class="shake-turn"/><circle cx="${p[0]}" cy="${p[1]}" r="9" class="shake-turn-inner"/>`).join('')}
        <line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" class="shake-window"/>
        <circle cx="${target[0]}" cy="${target[1]}" r="24" class="shake-target"/>
        <circle data-shake-marker cx="${marker[0]}" cy="${marker[1]}" r="12" class="shake-traveler ${s.hit?(s.beatSuccess?'good':'miss'):''}"/>
      </svg><div class="shake-action"><span class="mix-feedback ${s.message==='MISS'?'miss':''}">${s.completed?L('쉐이킹 완료','SHAKE COMPLETE'):s.started?s.message||`${g.c('shake_bpm',60)} BPM`:L('Space로 시작','Space to start')}<small>${s.success} / ${s.targetStacks} ${L('성공','hits')}</small></span>${button(s.completed?L('완료','Complete'):s.started?'<kbd>Space</kbd> '+L('쉐이킹','Shake'):L('시작','Start')+' <kbd>Space</kbd>','gimmickInput',s.completed?'disabled':'','mix-hit')}</div></section>`;
  }
  function mixHTML(s){
    const stir=s.type==='stir';
    return `<div class="craft-screen mix-screen ${stir?'stir-screen':'shake-screen'}"><div class="craft-top"><h2>${stir?L('스터','STIR'):L('쉐이킹','SHAKE')} <small>${esc(g.name(g.craft.actual.selected))}</small></h2><span class="badge">${g.craft.index+1} / ${g.craft.queue.length}</span>${button(L('레시피','Recipe'),'craftRecipe','','subtle')}</div>
      <div class="mix-workspace"><div class="mix-cinematic"><div class="mix-cinema" style="background-image:url('${a(stir?'gimmick_stir':'gimmick_shake')}')">${motionHTML(s,stir?[102,0,450,550]:[350,0,650,600])}</div><div class="mix-detail" aria-label="${L('손 동작 확대','Hand detail')}" style="background-image:url('${a(stir?'gimmick_stir':'gimmick_shake')}')">${motionHTML(s,stir?[205,180,230,340]:[670,180,250,320])}<small>${L('동작 확대','DETAIL')}</small></div></div>${stir?stirBoard(s):shakeBoard(s)}</div>
      <div class="gimmick-footer"><div><p>${L('전체 제조 조작 시간','Total active craft time')} <span class="num">${g.craft.elapsed.toFixed(1)}s</span> / ${g.cocktail(g.craft.actual.selected).time_limit_sec}s</p><small>${L('대기·일시정지·화면 전환은 시간에서 제외됩니다.','Ready, pause and transitions are excluded.')}</small></div>${button(s.completed?L('다음 →','Next →'):L('현재 기믹 마치기 →','Finish this step →'),'endGimmick',!s.started?'disabled':'','primary')}</div></div>`;
  }
  return {actorHTML,worldHTML,prepHTML,mixHTML,categories};
};
