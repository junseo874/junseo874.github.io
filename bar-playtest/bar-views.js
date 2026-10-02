/* Presentation only: no writes to gameplay tables, recipes or generated part IDs. */
window.LunaBarViews=function({D,g,ui,L,esc,a,button,itemArt,drinkArt,recipeLines}){
  const categories=['glass','tool','liquor','fridge'];
  const categoryName=id=>({glass:L('잔 선반','Glasses'),tool:L('도구 선반','Tools'),liquor:L('술 선반','Liquor'),fridge:L('냉장고','Fridge')})[id];
  const actors=new WeakMap(),seatSignals=new WeakMap();
  function seatIndicator(seat){
    const guest=g.seats[seat];
    if(!guest)return {className:'seat-empty',state:'empty',label:seat+' · '+L('빈 좌석','Empty')};
    let signal=seatSignals.get(guest);
    if(!signal){
      const entry=g.logs?.findLast(e=>e.event==='guest_enter'&&e.guest===guest.id);
      signal={enteredAt:entry?.time??g.realTime,exitAt:null};seatSignals.set(guest,signal);
    }
    const waiting=['WAIT_COASTER','WAIT_SERVE'].includes(guest.state),exiting=guest.state==='EXITING';
    if(exiting&&signal.exitAt===null)signal.exitAt=g.realTime;
    if(!exiting)signal.exitAt=null;
    const arrival=g.realTime-signal.enteredAt<2.4;
    // Actual patience seconds, not the former 20% threshold.
    const state=exiting?'exit':waiting&&guest.left<=10?'danger':
      waiting&&guest.limit>0&&guest.left/guest.limit<=.5?'warn':'occupied';
    const pulse=exiting?'exit':arrival&&state==='occupied'?'arrival':null;
    const since=exiting?signal.exitAt:signal.enteredAt;
    const dim=pulse&&Math.floor(Math.max(0,g.realTime-since)/.4)%2===1;
    const status={WAIT_COASTER:L('코스터 대기','Needs coaster'),ORDER_DIALOGUE:L('주문 중','Ordering'),
      WAIT_SERVE:L('서빙 대기','Awaiting drink'),DRINKING:L('마시는 중','Drinking'),
      REACTION:L('반응 중','Responding'),EXITING:L('퇴장 중','Leaving'),REORDER_WAIT:L('추가 주문','Reordering')}[guest.state]||L('손님 있음','Occupied');
    return {state,className:'seat-'+state+(pulse?' seat-pulse-'+pulse:'')+(dim?' seat-pulse-dim':''),
      label:seat+' · '+status+(waiting?' · '+L('남은 인내심 ','Patience ')+Math.max(0,Math.ceil(guest.left))+L('초','s'):'')};
  }
  // Presentation clocks never consume gameplay RNG. Idle and speech are separate.
  const idleCycle=1.6, speechCycle=.9, blinkDuration=.3;
  let actorSerial=0;
  const headY={chris_idle:[0,0,0,-1],port_idle:[0,1,-1,-1],
    port_joy:[0,1,-1,-1],port_anger:[0,1,-2,-2],port_serious:[0,1,-1,-1],
    aili_idle:[0,0,1,0],samho_idle:[0,0,-1,1]};
  function blinkRandom(state){
    state.blinkSeed=(Math.imul(state.blinkSeed,1664525)+1013904223)>>>0;
    return state.blinkSeed/4294967296;
  }
  function blinkFrame(state,rest,sequence){
    if(g.realTime>=state.blinkAt+blinkDuration){
      // No catch-up burst when returning from another screen.
      state.blinkAt=g.realTime+3.2+blinkRandom(state)*2.8;
    }
    const elapsed=g.realTime-state.blinkAt;
    return elapsed<0?rest:sequence[Math.min(sequence.length-1,Math.floor(elapsed/blinkDuration*sequence.length))];
  }
  const opener={id:'opener',kind:'auxiliary','name.ko':'병따개','name.en':'Bottle opener',
    'desc.ko':'병이나 와인을 오픈할 때 쓰는 도구.',
    'desc.en':'A tool for opening bottles, including wine bottles.'};
  const itemName=id=>id==='opener'?L('병따개','Bottle opener'):g.name(id);
  function actorBounds(guest){
    if(!guest.appearance)return D.webActorBounds?.[guest.actor]||[0,0,551,440];
    const boxes=guest.appearance.layers.map(k=>D.assets[k]?.alphaBBox).filter(Boolean);
    return boxes.length?[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))]:[0,0,551,440];
  }

  // All standard human canvases share a torso cut at y=440. Hands may extend
  // below that line onto the tabletop; the lowest opaque pixel is NOT the seat anchor.
  function poseOffset(guest,pose){
    if(guest.appearance)return [0,0];
    const arts=pose.keys.map(k=>D.assets[k]);
    if(arts.every(a=>(a.frameWidth||a.w)===551&&a.h===530))return [0,0];
    const [dx]=D.webPoseOffsets?.[guest.actor]?.[pose.pose]||[0,0];
    if(guest.actor==='samho'&&pose.pose.startsWith('drunk_')){
      // This engine image is a crop of the full-size drink pose, not of idle.
      const ref=D.assets.char_samho_drink_body,art=arts[0];
      return [ref.alphaBBox[0]-art.alphaBBox[0]-(551-art.frameWidth)/2,
        ref.alphaBBox[1]-art.alphaBBox[1]-(530-art.h)];
    }
    const bottom=Math.max(...arts.map(a=>530-a.h+a.alphaBBox[3]));
    const handOverhang=guest.actor==='port'&&pose.pose.includes('serious')?35:0;
    return [dx,440-(bottom-handOverhang)];
  }
  function cameraLayout(){
    const visible=Object.entries(g.seats).filter(([,v])=>v);
    const general=g.phase==='general',exploring=g.tutorial?.kind==='seatExplore',wide=exploring?false:general?g.overview:visible.length>1;
    const coords=general?{L:520,M:1020,R:1520}:{L:750,M:1020,R:1290};
    const cameraWidth=wide?1280:960,scale=1280/cameraWidth;
    const center=wide?1020:general||exploring?coords[g.focus]:coords[visible[0]?.[0]||'M'];
    const cameraX=Math.max(0,Math.min(2041-cameraWidth,center-cameraWidth/2));
    const cameraY=500-534/scale,key=[cameraWidth,cameraX,cameraY].join(':');
    return {visible,general,wide,coords,cameraWidth,scale,cameraX,cameraY,key};
  }
  function syncCamera(root){
    const plane=root.querySelector('.counter-plane'),layout=cameraLayout();
    // getAnimations forces style resolution, so a newly applied transform is
    // observed before it can reveal/type the next line. No guessed timeout.
    g.cameraMoving=!!plane&&(plane.dataset.cameraKey!==layout.key||plane.getAnimations().some(a=>a.playState==='running'||a.pending));
  }
  function dialogueAnchor(actor){
    const c=cameraLayout();
    if(actor==='luna'||c.general||!c.wide)return '';
    const seat=c.visible.find(([,guest])=>guest.actor===actor)?.[0];
    if(!seat)return '';
    const x=(c.coords[seat]-c.cameraX)*c.scale;
    return 'style="left:'+Math.max(289,Math.min(991,x))+'px" data-speaker-seat="'+seat+'"';
  }
  function actorLayers(guest,expression,talking){
    if(guest.appearance){
      const app=guest.appearance, gender=app.gender;
      const eyes=app.layers.find(k=>/eyes_\d+$/.test(k))?.split('_').at(-1);
      const mouth=app.layers.find(k=>/mouth_\d+$/.test(k))?.split('_').at(-1);
      // Keep the complete base body/head. The "talk" body has a cut-out face
      // and four identical frames; mixing it with a static mouth leaves a hole.
      // Some static default mouths are open smiles. Use the closed final
      // animation frame while silent instead of reverting to an open image.
      const replace={['guest_'+gender+'_eyes_'+eyes]:'guest_'+gender+'_talk_eyes_'+eyes};
      const mouthKey='guest_'+gender+'_talk_mouth_'+mouth;
      if(talking||D.assets[mouthKey])replace['guest_'+gender+'_mouth_'+mouth]=mouthKey;
      else if(gender==='m'&&['4','5'].includes(mouth))replace['guest_m_mouth_'+mouth]='guest_m_mouth_3';
      return {keys:app.layers.map(k=>D.assets[replace[k]]?replace[k]:k),
        pose:talking?(D.assets[mouthKey]?'talk':'static-fallback'):'idle'};
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
    if(!state){
      state={start:g.realTime,pose:null,poseAt:g.realTime,loopPose:null,speech:null,exitAt:null,glass:guest.glass,drinkUntil:0,blinkSeed:Math.imul(++actorSerial,2654435761)>>>0};
      state.blinkAt=g.realTime+2.4+blinkRandom(state)*3;
      actors.set(guest,state);
    }
    if(g.variant==='gpt'&&g.phase==='general'){if(guest.state==='DRINKING'&&state.guestState!=='DRINKING')state.drinkUntil=g.realTime+1.2;state.guestState=guest.state;}else if(guest.glass&&guest.glass!==state.glass){state.drinkUntil=g.realTime+1;}
    state.glass=guest.glass;
    const d=g.currentDialogue();
    // Personality IDs may repeat; only the focused general guest owns this bubble.
    const speaking=!!d&&d.actor===guest.actor&&(g.phase!=='general'||g.seats[g.focus]===guest);
    const talking=g.screen==='bar'&&speaking&&d.chars<d.text.length;
    const poseFamily=pose=>guest.appearance?'guest':pose.pose.replace(/_(talk|default)$/,'');
    if(talking){
      const pose=actorLayers(guest,d.expression,true);
      // Starting speech never restarts breathing or the blink schedule.
      if(!state.speech||state.speech.pose.pose!==pose.pose){
        state.speech={pose,startedAt:g.realTime,stopAt:null};
      }else{state.speech.pose=pose;state.speech.stopAt=null;}
    }else if(state.speech){
      const speech=state.speech;
      const cameraInterrupted=g.cameraMoving||g.cameraLeft>0;
      if(!cameraInterrupted){
        // Typing/reveal/line completion stops speech; body and eyes keep looping.
        state.speech=null;
      }else if(speech.stopAt===null){
        // Close the articulation briefly during a pan, with no extra loop.
        speech.stopAt=g.realTime+.18;
        speech.releasePhase=((g.realTime-speech.startedAt)/speechCycle)%1;
      }
      if(state.speech&&g.realTime>=speech.stopAt)state.speech=null;
    }
    const drinking=guest.actor==='samho'&&g.realTime<state.drinkUntil&&!state.speech;
    const pose=state.speech?.pose||actorLayers(guest,drinking?'drink':speaking?d.expression:'idle',false);
    const family=poseFamily(pose);
    if(family!==state.loopPose){state.loopPose=family;state.poseAt=g.realTime;}
    state.pose=pose.pose;
    if(guest.state==='EXITING'&&state.exitAt===null)state.exitAt=g.realTime;
    const entering=guest.seated?1:Math.min(1,(g.realTime-state.start)/.65);
    // General farewell dialogue remains visible, then the guest leaves.
    const exiting=state.exitAt===null?0:Math.min(1,Math.max(0,(g.realTime-state.exitAt-(g.phase==='general'?2.5:0))/.45));
    const opacity=Math.min(entering,1-exiting),offset=(1-entering)*25+exiting*25;
    const box=actorBounds(guest),base=guest.actor==='bubi'?535:500;
    const anchor=guest.appearance||guest.actor==='bubi'?box[3]:440;
    const top=base-anchor,centerOffset=275.5-(box[0]+box[2])/2;
    const [dx,dy]=poseOffset(guest,pose);
    const speechState=state.speech?(talking?'looping':'finishing'):'idle';
    return `<div class="actor pixel-actor" data-actor="${esc(guest.actor)}" data-baseline="${base}" data-table-anchor="${anchor}" data-pose="${esc(pose.pose)}" data-talking="${talking}" data-speech-state="${speechState}" style="left:calc(${x}% + ${centerOffset}px);top:${top}px;opacity:${opacity};--arrival:${offset}px">
      ${pose.keys.length?pose.keys.map(k=>{
        const s=D.assets[k],frames=s.frames||1;
        const poseCycle=family==='drink'?1:idleCycle;
        const bodyFrame=Math.floor(Math.max(0,g.realTime-state.poseAt)/poseCycle*frames)%frames;
        let frame=bodyFrame,partY=0;
        const mouth=/(?:mouth_\d+|face_bottom(?:_talk|_default)?)$/.test(k);
        const eyes=/eyes(?:_\d+)?$/.test(k);
        if(mouth&&frames>1){
          if(state.speech){
            frame=Math.floor(Math.max(0,g.realTime-state.speech.startedAt)/speechCycle*frames)%frames;
            if(state.speech.stopAt!==null){
              const progress=1-(state.speech.stopAt-g.realTime)/.18;
              const first=Math.floor(state.speech.releasePhase*frames);
              frame=Math.min(frames-1,first+Math.floor(progress*(frames-first)));
            }
          }else if(guest.appearance)frame=frames-1;
        }
        if(eyes&&frames>1){
          if(guest.appearance)frame=blinkFrame(state,3,[0,1,2,1,0,3]);
          else if(guest.actor==='chris'&&family.toLowerCase().endsWith('idle'))frame=blinkFrame(state,0,[1,2,1,0]);
          else if(guest.actor==='bubi')frame=blinkFrame(state,0,[1,2,3,0]);
          // Sunglasses/robot eyes are head-motion frames, not blink frames.
        }
        if(!guest.appearance&&(eyes||mouth)&&frame!==bodyFrame){
          const shifts=headY[family.toLowerCase()]||headY[guest.actor+'_'+family.toLowerCase()];
          if(shifts)partY=(shifts[bodyFrame]||0)-(shifts[frame]||0);
        }
        const scale=s.displayScale||1,fw=(s.frameWidth||s.w/frames)*scale,fh=(s.frameHeight||s.h)*scale;
        // Keep source pixels and a stable pose-level anchor, never recrop per frame.
        return `<div class="actor-layer" data-layer="${esc(k)}" data-frame="${frame}" style="width:${fw/551*100}%;height:${fh/530*100}%;left:${50+dx/551*100}%;bottom:${-(dy+partY)/530*100}%;background-image:url('${s.src}');background-size:${frames*100}% 100%;background-position:${frames>1?frame/(frames-1)*100:0}% 0"></div>`;
      }).join(''):'<div class="dummy-actor"></div>'}
    </div>`;
  }
  function worldHTML(){
    const {visible,general,wide,coords,cameraWidth,scale,cameraX,cameraY,key}=cameraLayout();
    const transform=depth=>`transform:translate(${-cameraX*scale*depth}px,${-cameraY*scale}px) scale(${scale})`;
    const plane=(name,depth,content)=>`<div class="bar-scene-layer ${name}" data-depth="${depth}" data-camera-key="${key}" style="${transform(depth)}">${content}</div>`;
    const back=visible.filter(([,v])=>!!v.appearance),front=visible.filter(([,v])=>!v.appearance);
    const zones=(g.phase==='practice'?['M']:['L','M','R']).map(seat=>{
      const guest=g.seats[seat];if(g.phase!=='practice'&&!guest)return '';
      const canCoaster=general&&g.focus===seat&&guest.state==='WAIT_COASTER'||g.tutorial?.kind==='coaster'&&g.tutorial.seat===seat;
      const canServe=!!g.drink&&(g.phase==='practice'||guest?.coaster&&(general?g.focus===seat&&guest.state==='WAIT_SERVE':g.currentOrder?.seat===seat));
      const baseline=general?530:542;
      return `<div class="coaster-zone native-coaster ${ui.drag&&(canCoaster&&ui.drag==='coaster'||canServe&&ui.drag==='drink')?'drop-ready':''}" data-drop="${g.phase==='practice'?'L':seat}" data-table-baseline="${baseline}" style="left:${coords[seat]-60}px;top:${baseline-124}px">${guest?.coaster||g.phase==='practice'?`<img class="coaster" src="${a('coaster')}" alt="코스터" draggable="false">`:''}${guest?.glass?(g.variant==='gpt'&&guest.glassEmpty?itemArt(guest.glassKind||g.cocktail(guest.glass).glass,'drink-art empty-glass'):drinkArt(guest.glass,'table')):''}${ui.drag&&canServe?'<span class="seat-note">'+L('여기에 제공','Drop here')+'</span>':''}</div>`;
    }).join('');
    return `<div class="stage bar-stage" data-camera-width="${cameraWidth}">
      ${plane('far-plane',.88,`<img src="${a('bar_far')}" alt="">`)}
      ${plane('mid-plane',.95,`<img src="${a('bar_mid')}" alt="">`)}
      ${plane('guest-plane',1,back.map(([seat,guest])=>actorHTML(guest,coords[seat]/2041*100)).join(''))}
      ${plane('counter-plane',1,`<img src="${a('bar_front')}" alt="">`)}
      ${plane('regular-plane',1,front.map(([seat,guest])=>actorHTML(guest,coords[seat]/2041*100)).join(''))}
      ${plane('serve-plane',1,zones)}<div class="vignette"></div></div>`;
  }
  function recipePanel(c,{preview=false,remixPreview=false}={}){
    const recipe=g.t.recipes.filter(r=>r.context===c.id);
    const tags=g.t.cocktail_tags.filter(t=>t.context===c.id);
    const needsOpener=recipe.some(r=>g.t.shelf_items.find(i=>i.id===r.ingredient)?.prep_action==='open');
    const icons=[c.glass,...(c.mix==='shake'?['shaker']:c.mix==='stir'?['mixing_glass']:[]),...(needsOpener?['opener']:[]),...recipe.map(r=>r.ingredient)];
    return `<aside ${preview?'':'id="prep-recipe-detail"'} class="prep-recipe${preview?' recipe-preview '+(remixPreview?'remix-recipe-detail':'recipe-peek'):''}" aria-label="${preview?L('칵테일 레시피 미리보기','Cocktail recipe preview'):L('선택한 칵테일 레시피','Selected cocktail recipe')}">
      <div class="prep-recipe-heading"><small>${esc(c['name.en'])}</small>${preview?'':button('×','togglePrepRecipe','aria-label="'+L('레시피 접기','Close recipe')+'"')}<h2>${esc(g.name(c.id))}</h2></div>
      <div class="prep-recipe-scroll"><div class="recipe-tags"><span>${esc(c.mix.toUpperCase())}</span>${tags.map(t=>`<span>${esc(t[g.lang]||t.ko)}</span>`).join('')}</div>
      <div class="recipe-hero">${drinkArt(c.id,'recipe')}</div><div class="recipe-icon-grid">${icons.map((id,index)=>`<div class="recipe-icon-slot" tabindex="0" aria-label="${esc(itemName(id))}" aria-describedby="recipe-item-tip-${c.id}-${index}">${itemArt(id,'','recipe')}<div id="recipe-item-tip-${c.id}-${index}" role="tooltip" class="ingredient-tip recipe-item-tip"><strong>${esc(itemName(id))}</strong></div></div>`).join('')}</div>
      <section><h3>${L('칵테일 설명','About this cocktail')}</h3><p>${esc(g.text(c,'flavor')||L('소개 문구 준비 중','Description pending'))}</p></section>
      <section><h3>${L('제조법','Method')}</h3><p>${esc(g.text(c,'recipe_desc'))}</p>${preview?'':recipeLines(c)}</section>${remixPreview?button(L('이 레시피로 만들기 →','Prepare this recipe →'),'selectRecipe',`data-id="${c.id}"`,'primary recipe-preview-select'):''}</div>
    </aside>`;
  }
  const shelfOrder={
    glass:['old_fashioned','long_drink','mug','cocktail','sour','wine'],
    tool:['mixing_glass','shaker','opener'],
    liquorTop:['gin','rum','vodka','whiskey','tequila'],
    liquorBottom:['grenadine','sour_mix'],
    fridgeTop:['soda_water','cola'],
    fridgeBottom:['beer','orange_juice','dry_vermouth','red_wine','champagne']
  };
  function orderedShelf(items,priority){
    return [...priority.map(id=>items.find(i=>i.id===id)).filter(Boolean),...items.filter(i=>!priority.includes(i.id))];
  }
  function layout(tab=ui.tab){
    let all=g.itemsAvailable().filter(i=>tab==='glass'?i.kind==='glass':tab==='tool'?i.kind==='tool':i.kind==='ingredient'&&i.shelf_group===tab);
    if(tab==='tool')all.push(opener);
    if(tab==='glass'||tab==='tool')all=orderedShelf(all,shelfOrder[tab]);
    // Classify before pagination: excess stock stays on the same row of the next page.
    let rows=null;
    if(tab==='liquor')rows={
      top:orderedShelf(all.filter(i=>i.category==='base'),shelfOrder.liquorTop),
      bottom:orderedShelf(all.filter(i=>i.category!=='base'),shelfOrder.liquorBottom)
    };
    if(tab==='fridge'){
      const top=all.filter(i=>shelfOrder.fridgeTop.includes(i.id)||!shelfOrder.fridgeBottom.includes(i.id)&&(!a('item_'+i.id)||D.assets['item_'+i.id].h<=119));
      rows={top:orderedShelf(top,shelfOrder.fridgeTop),bottom:orderedShelf(all.filter(i=>!top.includes(i)),shelfOrder.fridgeBottom)};
    }
    const rowCapacity=tab==='fridge'?7:8;
    const pages=rows?Math.max(1,Math.ceil(rows.top.length/rowCapacity),Math.ceil(rows.bottom.length/rowCapacity)):Math.max(1,Math.ceil(all.length/8));
    let page=tab===ui.tab?Math.min(ui.shelfPage||0,pages-1):0;
    if(tab===ui.tab)ui.shelfPage=page;
    let items=all.slice(page*8,(page+1)*8),topCount=0;
    if(rows){const top=rows.top.slice(page*rowCapacity,(page+1)*rowCapacity);topCount=top.length;items=[...top,...rows.bottom.slice(page*rowCapacity,(page+1)*rowCapacity)];}
    const positioned=items.map((item,i)=>{
      let w,h,x,y;
      if(tab==='glass'){w=90;h=190;x=240+shelfOrder.glass.indexOf(item.id)*96;y=340;}
      else if(tab==='tool'){w=140;h=230;x=320+shelfOrder.tool.indexOf(item.id)*160;y=346;}
      else if(tab==='liquor'){const top=i<topCount;w=57;h=171;x=274+(top?i:i-topCount)*59;y=top?193:397;}
      else {const top=i<topCount;w=93;h=top?119:171;x=145+(top?i:i-topCount)*95;y=top?162:402;
        // Front stock sits slightly left and below the background stock.
        // Match native visible heights for the supplied refrigerator artwork.
        if(['soda_water','cola','beer','orange_juice','dry_vermouth','red_wine','champagne'].includes(item.id)){
          const art=D.assets['item_'+item.id],bounds=art?.alphaBBox;
          h=bounds?bounds[3]-bounds[1]:h;
        }
      }
      return {item,w,h,x,y};
    });return {all,pages,positioned};
  }
  function prepRecipeBrief(c){
    const rows=g.t.recipes.filter(r=>r.context===c.id&&!r.auto_apply);
    const p=g.prep;
    const needed=[{id:c.glass,kind:L('잔','Glass'),checked:p.glass===c.glass}];
    const tool=c.mix==='shake'?'shaker':c.mix==='stir'?'mixing_glass':null;
    if(tool)needed.push({id:tool,kind:L('도구','Tool'),checked:p.tool===tool});
    if(rows.some(r=>r.ingredient==='beer'||g.t.shelf_items.find(i=>i.id===r.ingredient)?.prep_action==='open'))needed.push({id:'opener',kind:L('도구','Tool'),checked:!!p.opener});
    for(const id of new Set(rows.map(r=>r.ingredient)))needed.push({id,kind:L('재료','Ingredient'),checked:p.ingredients.includes(id)});
    const ingredients=needed.map(({id,kind,checked})=>'<span class="prep-brief-row'+(checked?' is-packed':'')+'" data-required-item="'+esc(id)+'" data-packed="'+checked+'"><span class="prep-brief-check" aria-hidden="true">'+(checked?'✓':'')+'</span><span class="prep-brief-kind">'+kind+'</span><span class="prep-brief-name">'+esc(itemName(id))+'</span><span class="prep-brief-status">'+(checked?L('담음','Selected'):L('미선택','Not selected'))+'</span></span>').join('');
    return button('<span class="prep-brief-heading"><strong>'+esc(g.name(c.id))+'</strong><span aria-hidden="true">›</span></span><span class="prep-brief-ingredients">'+ingredients+'</span>','togglePrepRecipe','aria-expanded="'+!!ui.recipeOpen+'" aria-controls="prep-recipe-detail" title="'+L('클릭하여 상세 레시피 보기','Click to view the full recipe')+'"','recipe-toggle prep-recipe-brief');
  }
  function prepHTML(){
    const p=g.prep,c=g.cocktail(p.selected),{pages,positioned}=layout();
    const selected=[p.glass,p.tool,p.opener?'opener':null,...p.ingredients].filter(Boolean);
    const hovered=positioned.find(o=>o.item.id===ui.hoverItem);
    const tooltip=hovered?(()=>{const {item,x,y,h}=hovered;const below=y-h<120;
      return `<div id="ingredient-tip" role="tooltip" class="ingredient-tip ${below?'below':''}" style="left:${Math.max(175,Math.min(785,x))/960*100}%;${below?'top':'bottom'}:${(below?y+18:540-y+h+18)/540*100}%"><strong>${esc(itemName(item.id))}</strong><span>${esc(g.text(item,'desc')||L('소개 문구 준비 중','Description pending'))}</span>${!a('item_'+item.id)?`<small>${L('전용 이미지 미제공 · 팀 더미 이미지 사용','Shared team placeholder artwork')}</small>`:''}</div>`;
    })():'';
    return `<div class="craft-screen prep-screen ${ui.recipeOpen?'prep-open':''}">${prepRecipeBrief(c)}
      <div class="prep-main"><div class="shelf-viewport"><div class="shelf-track" style="transform:translateX(${-categories.indexOf(ui.tab)*100}%)">
      ${categories.map(tab=>{const {positioned:placed}=layout(tab);return `<div class="shelf-slide" data-current="${tab===ui.tab}" ${tab===ui.tab?'':'inert'}><div class="shelf-fit"><div class="shelf-scene" style="background-image:url('${a('prep_'+tab)}')" data-category="${tab}">
        ${placed.map(({item:i,x,y,w,h})=>{
          const art=D.assets['item_'+i.id]||D.assets.item_dummy,box=art.alphaBBox||[0,0,art.w,art.h];
          // Ingredients fit by their visible pixels, not transparent canvas padding.
          const ingredient=i.kind==='ingredient',visibleW=Math.max(1,box[2]-box[0]),visibleH=Math.max(1,box[3]-box[1]);
          const ratio=ingredient?Math.min(w/visibleW,h/visibleH):Math.min(w/art.w,h/art.h);
          const bottom=(art.h-box[3])*ratio,centerOffset=ingredient?(art.w/2-(box[0]+box[2])/2)*ratio:0;
          return `<button class="shelf-item ${selected.includes(i.id)?'selected':''}" data-act="${i.id==='opener'?'pickOpener':'pick'}" data-id="${i.id}" data-hover-item="${i.id}" data-baseline="${y}" aria-label="${esc(itemName(i.id))}" aria-pressed="${selected.includes(i.id)}" ${hovered?.item.id===i.id?'aria-describedby="ingredient-tip"':''} style="left:${x/960*100}%;bottom:${(540-y)/540*100}%;width:${w/960*100}%;height:${h/540*100}%"><img class="shelf-sprite" src="${art.src}" alt="${esc(itemName(i.id))}" draggable="false" style="left:${50+centerOffset/w*100}%;width:${art.w*ratio/w*100}%;height:${art.h*ratio/h*100}%;bottom:${-bottom/h*100}%">${!a('item_'+i.id)?`<span class="shelf-placeholder-label">${esc(itemName(i.id))}</span>`:''}</button>`;
        }).join('')}
        ${!placed.length?`<div class="shelf-empty">${L('오늘 해금된 항목이 없습니다.','Nothing unlocked here today.')}</div>`:''}${tab===ui.tab?tooltip:''}
      </div></div></div>`;}).join('')}</div></div>
      <button class="shelf-arrow prev" data-act="shelfCategory" data-id="-1" aria-label="${L('이전 선반','Previous shelf')}" ${ui.tab==='glass'?'disabled':''}><span aria-hidden="true">‹</span><small aria-hidden="true">A</small></button>
      <button class="shelf-arrow next" data-act="shelfCategory" data-id="1" aria-label="${L('다음 선반','Next shelf')}" ${ui.tab==='fridge'?'disabled':''}><span aria-hidden="true">›</span><small aria-hidden="true">D</small></button>
      ${pages>1?`<div class="shelf-pagination">${button('‹','shelfPage','data-id="-1" '+(!ui.shelfPage?'disabled':''))}<span>${ui.shelfPage+1} / ${pages}</span>${button('›','shelfPage','data-id="1" '+(ui.shelfPage===pages-1?'disabled':''))}</div>`:''}
      </div><div class="prep-controls">${button('← '+L('뒤로','Back'),'prepBack','title="'+L('뒤로 가면 선택이 모두 초기화됩니다.','Back clears every selection.')+'"','prep-back')}
        <div class="shelf-navigation"><div class="shelf-dots">${categories.map(id=>button(`<span></span><i>${categoryName(id)}</i>`,'tab',`data-id="${id}" aria-label="${categoryName(id)}" aria-pressed="${ui.tab===id}"`,ui.tab===id?'selected':'')).join('')}</div></div>
        ${button(L('제조 시작','Start crafting'),'craft',!p.glass||!p.ingredients.length?'disabled':'','craft-start')}</div>
      <div class="prep-inventory"><div class="inventory-scroll">${selected.map(id=>button(`${itemArt(id,'','inventory')}<span class="remove-mark">×</span><span class="inventory-item-name">${esc(itemName(id))}</span>`,id==='opener'?'pickOpener':'pick',`data-id="${id}" aria-label="${esc(itemName(id))} ${L('선택 해제','remove')}"`,'inventory-slot')).join('')}<div class="inventory-slot empty-slot" aria-hidden="true">＋</div></div></div>
      ${ui.recipeOpen?recipePanel(c):''}</div>`;
  }
  function motionHTML(s,crop){
    const art=D.assets[s.type==='stir'?'mix_stir_motion':'mix_shake_motion'];
    const frame=s.motionFrame||0;
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
  function iceTransform(x,y,spin,scale=1){return 'translate('+x+' '+y+') rotate('+spin+') scale('+scale+')';}
  function iceShape(index,x,y,size,spin,opacity=1,scale=1){
    return '<g data-ice-cube data-ice-index="'+index+'" transform="'+iceTransform(x,y,spin,scale)+'" opacity="'+opacity+'"><rect x="'+(-size/2)+'" y="'+(-size/2)+'" width="'+size+'" height="'+size+'" rx="3" fill="#b8ecf1" fill-opacity=".68" stroke="#e6ffff" stroke-width="1.5"/><path d="M '+(-size*.3)+' '+(size*.28)+' V '+(-size*.27)+' H '+(size*.22)+'" fill="none" stroke="#f4ffff" stroke-width="2"/></g>';
  }
  function sideIce(s){
    return s.ice.map((c,index)=>{const depth=c.y/s.iceRadius,t=(depth+1)/2,scale=1.08+(.86-1.08)*t;return{c,index,depth,x:80+c.x/s.iceRadius*30,y:142-c.sideY-depth*30*.34,scale,alpha:.95+(.62-.95)*t};}).sort((a,b)=>b.depth-a.depth);
  }
  function sideSpoon(s){const sin=Math.sin(s.spoonAngle*Math.PI/180);return 'M'+(80+sin*30)+' 22 L'+(80+sin*23)+' 145';}
  function stirProgress(s){return s.completed?0:s.started?Math.max(0,1-s.circleTime/g.c('stir_circle_limit_sec',1.5)):1;}
  function sideGlass(s){
    const cubes=sideIce(s);
    return '<svg class="stir-side-glass" viewBox="0 0 160 220" aria-label="'+L('같은 얼음의 측면','Side view of the same ice')+'"><path d="M27 55 L37 187 Q80 204 123 187 L133 55" fill="#304553" stroke="#cde9ed" stroke-width="4"/><ellipse cx="80" cy="55" rx="53" ry="14" fill="#0c161e" stroke="#cfecf2" stroke-width="4"/><g data-side-ice>'+cubes.map(v=>iceShape(v.index,v.x,v.y,v.c.size*(30/41.58),-v.c.sideSpin,v.alpha,v.scale)).join('')+'</g><path data-side-spoon d="'+sideSpoon(s)+'" stroke="#e8f4f8" stroke-width="4"/><path d="M38 84L44 182Q80 193 116 182L123 84" fill="#99d9e9" fill-opacity=".12" stroke="#9bc0ce" stroke-opacity=".5"/></svg>';
  }
  function stirBoard(s){
    const pos=[[50,0],[100,50],[50,100],[0,50]],next=s.started?(s.stirPos+1)%4:0;
    const progress=stirProgress(s);
    return '<section class="mix-board stir-board">'+mixTimer(s)+
      '<div class="stir-dial"><svg class="stir-live-glass" viewBox="0 0 200 200" aria-label="'+L('입력에 반응하는 숟가락과 얼음','Input-driven spoon and ice')+'"><circle cx="100" cy="100" r="91" fill="#293c4d" stroke="#99acbf" stroke-width="5"/><circle cx="100" cy="100" r="85" fill="#d5e4e9" stroke="#fafcff" stroke-width="2"/><circle cx="100" cy="100" r="74" fill="#7eacbf" fill-opacity=".55"/>'+s.ice.map((c,index)=>iceShape(index,100+c.x,100-c.y,c.size,-c.spin)).join('')+'<g data-stir-polish aria-hidden="true"></g><g data-spoon-angle="'+s.spoonAngle.toFixed(3)+'" transform="rotate('+s.spoonAngle+' 100 100)"><path d="M100 18V101" stroke="#222d40" stroke-width="6"/><path d="M100 18V101" stroke="#c3dbe4" stroke-width="2.5"/><ellipse cx="100" cy="22" rx="4.2" ry="7.5" fill="#dcebf2" stroke="#364559" stroke-width="1.5"/></g></svg>'+
      '<svg class="stir-orbit" viewBox="0 0 400 400" aria-hidden="true"><circle class="orbit-base" cx="200" cy="200" r="180"/><circle class="orbit-progress '+(s.started&&progress<.34?'danger':'')+'" cx="200" cy="200" r="180" pathLength="100" stroke-dasharray="'+progress*100+' 100" transform="rotate(-90 200 200)"/></svg>'+
      ['W','D','S','A'].map((k,i)=>'<button class="mix-direction '+(i===next&&!s.completed?'next':'')+' '+(s.started&&i===s.stirPos&&!s.completed?'pressed':'')+'" style="left:'+pos[i][0]+'%;top:'+pos[i][1]+'%" data-act="stir" data-id="Key'+k+'" aria-label="'+k+'" '+(s.completed?'disabled':'')+'>'+k+'</button>').join('')+
      '</div>'+mixGauge(s)+'</section>';
  }
  // The full UI is throttled; these existing visual nodes must follow every simulation frame.
  // Scope queries to the current screen so retry/exit never retains a detached canvas or actor.
  function syncStirMotion(root){
    const s=g.gimmick;
    if(g.screen!=='gimmick'||s?.type!=='stir')return;
    const screen=root.querySelector('.stir-screen');if(!screen)return;
    const attr=(el,name,value)=>{value=String(value);if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value);};
    const frame=s.motionFrame||0,art=D.assets.mix_stir_motion;
    for(const el of screen.querySelectorAll('[data-motion-frame]')){
      attr(el,'data-motion-frame',frame);
      const pos=frame/(art.frames-1)*100+'% 0px';
      if(el.style.backgroundPosition!==pos)el.style.backgroundPosition=pos;
    }
    const spoon=screen.querySelector('[data-spoon-angle]');
    attr(spoon,'data-spoon-angle',s.spoonAngle.toFixed(3));
    attr(spoon,'transform','rotate('+s.spoonAngle+' 100 100)');
    for(const el of screen.querySelectorAll('.stir-live-glass [data-ice-index]')){
      const c=s.ice[Number(el.dataset.iceIndex)];if(!c)continue;
      attr(el,'transform',iceTransform(100+c.x,100-c.y,-c.spin));
    }
    const layer=screen.querySelector('[data-side-ice]');
    if(layer){
      const nodes=new Map([...layer.children].map(el=>[Number(el.dataset.iceIndex),el]));
      sideIce(s).forEach((v,i)=>{
        const el=nodes.get(v.index);if(!el)return;
        attr(el,'transform',iceTransform(v.x,v.y,-v.c.sideSpin,v.scale));attr(el,'opacity',v.alpha);
        if(layer.children[i]!==el)layer.insertBefore(el,layer.children[i]||null);
      });
    }
    attr(screen.querySelector('[data-side-spoon]'),'d',sideSpoon(s));
    const ring=screen.querySelector('.orbit-progress'),progress=stirProgress(s);
    attr(ring,'stroke-dasharray',progress*100+' 100');
    ring?.classList.toggle('danger',s.started&&progress<.34);
  }
  function shakeBoard(s){
    if(s.rhythm)return window.LunaShakeRhythm.board(s,L);
    const mix=window.LunaCore.MIX,at=(x,y)=>[55+x*118,42+y*118],points=mix.points.map(([x,y])=>at(x,y)),marker=at(...s.pathPoint);
    const candidates=[...s.nodes,...mix.points.map(([x,y],i)=>({x,y,id:'fixed:'+i,fixed:true}))],radius=mix.radius*118;
    const nodes=candidates.map(n=>{const p=at(n.x,n.y);return '<g data-shake-node="'+n.id+'"><circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+radius+'" class="shake-judge-range"/><circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(n.fixed?10:8)+'" class="'+(n.fixed?'shake-turn':'shake-waypoint')+'"/></g>';}).join('');
    return '<section class="mix-board shake-board">'+mixTimer(s)+mixGauge(s,true)+
      '<svg class="shake-path" data-shake-surface viewBox="0 0 420 540" aria-label="'+L('쉐이킹 클릭 영역','Shaking input area')+'"><polyline points="'+points.map(p=>p.join(',')).join(' ')+'" class="shake-route"/>'+nodes+
      '<g data-shake-trail></g><g data-shake-fx></g>'+
      '<circle data-shake-marker cx="'+marker[0]+'" cy="'+marker[1]+'" r="9" class="shake-traveler '+(s.feedbackLeft>0?(s.beatSuccess?'good':'miss'):'')+'"/></svg>'+
      '<div class="shake-action">'+button(s.completed?L('완료','Complete'):s.started?L('클릭 / Space','Click / Space'):L('시작','Start'),'gimmickInput',s.completed?'disabled':'','mix-hit')+'</div></section>';
  }
  function mixHTML(s){
    const stir=s.type==='stir';
    return `<div class="craft-screen mix-screen ${stir?'stir-screen':'shake-screen'}">${g.minigame?button(L('다른 기믹 선택','Other minigames'),'miniExit','','gimmick-exit'):''}
      ${!stir?'<div class="shake-sound-picker" role="group" aria-label="'+L('쉐이킹 효과음 선택','Shaker sound selection')+'">'+[1,2].map(id=>button(L('사운드 '+id,'Sound '+id),'shakeSound','data-id="'+id+'" aria-pressed="'+(ui.shakeSound===id)+'"','shake-sound-option')).join('')+'<small data-shake-audio-status aria-live="polite"></small></div>':''}
      ${stir?'<div class="shake-sound-picker stir-sound-picker" role="group" aria-label="'+L('스터 효과음 선택','Stir sound selection')+'">'+[1,2].map(id=>button(L('사운드 '+id,'Sound '+id),'stirSound','data-id="'+id+'" aria-pressed="'+(ui.stirSound===id)+'"','shake-sound-option')).join('')+'<small data-stir-audio-status aria-live="polite"></small></div>':''}
      <div class="mix-workspace"><div class="mix-cinematic"><div class="mix-cinema" style="background-image:url('${a(stir?'gimmick_stir':'gimmick_shake')}')">${motionHTML(s,stir?[102,0,450,550]:[350,0,650,600])}</div></div>${stir?stirBoard(s):shakeBoard(s)}</div>
      ${s.rhythm?'':button(g.minigame?L('결과 보기 →','View result →'):s.completed?L('다음 →','Next →'):L('현재 기믹 마치기 →','Finish this step →'),'endGimmick',!s.started||g.remix?.hold||s.rhythm&&!s.completed?'disabled':'','primary gimmick-finish')}</div>`;
  }
  return {recipePanel,actorHTML,worldHTML,prepHTML,mixHTML,categories,syncCamera,syncStirMotion,dialogueAnchor,seatIndicator};
};
