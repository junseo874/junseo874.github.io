(function(root){
'use strict';
// Experimental session memory only: never stored in campaign flags, saves or source tables.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api={lastEpisode:null};
const row=(actor,text)=>({type:'say',actor,text,temporary:true});
const notes={ob_parttime_1:['구인 전단','거리의 일자리도 누군가에게는 하루를 버티는 방법이다.'],ob_experiment_1:['임상시험 전단','큰 보수라는 말 뒤에 어떤 조건이 있는지 더 읽어 보았다.'],np_shiba_1:['시바와의 첫 대화','다가간다고 바로 가까워지는 건 아니었다.'],np_shiba_2:['시바에게 다시 인사','한 번 더 찾아가도 인사는 조금씩 달라진다.'],np_shiba_treat:['시바에게 간식을 건넴','말 대신 건넬 수 있는 것도 있었다.'],demo_out_pair_neon:['거리에서 들은 농담','절전 중이라는 간판 이야기는 월급 이야기로 이어졌다.'],demo_out_pair_delivery:['골목의 대화','멀리서 본 수상한 풍경과 직접 들은 이야기는 달랐다.'],demo_out_direct_lift:['주민의 인사','집이 멀게 느껴지는 날도 있다는 말을 들었다.'],d1_elevator:['엘리베이터의 라디오','같은 도시에 있어도 서로 다른 이야기를 듣고 산다.'],np_tv_1:['집에서 들은 방송','귀가 후에도 도시의 목소리가 남아 있었다.'],np_tv_2:['다른 방송','방송은 누군가의 하루를 다른 말로 전하고 있었다.']};
api.init=function(m,options){m.remixX=m.config.day!==99&&options.variant==='gpt'&&!root.lunaCampaign?.active?{entries:[],seen:new Set(),panel:null,choice:null,pending:false,introUntil:6,finished:false,barMemory:api.lastEpisode?{...api.lastEpisode}:null}:null;};
api.add=function(m,id,title,text){const r=m.remixX;if(!r||r.seen.has(id))return;r.seen.add(id);r.entries.push({id,title,text});};
api.tick=function(m){const r=m.remixX;if(!r)return;for(const story of [m.story,m.backgroundStory])for(const id of story.done){if(notes[id])api.add(m,id,...notes[id]);}
 if(r.pendingEntry&&m.story.done.has('rx_shift_reply')){api.add(m,'rx-choice',...r.pendingEntry);r.pendingEntry=null;}
 if(r.pending&&m.story.done.has('rx_shift_intro')&&!m.story.speech){r.pending=false;r.panel='choice';m.paused=true;m.revision++;}
};
api.interact=function(m,t){const r=m.remixX;if(!r)return false;
 if(t.id==='sofa'||t.id==='bar'&&m.config.flow==='in'){r.panel='reflection';r.finished=true;m.paused=true;m.revision++;return true;}
 if(t.actor==='shop-loner'){
  if(r.choice){m.story.beginRows('rx_shift_repeat',t,[row('shop-loner',r.choice==='wait'?'아까 기다려 줘서 고마웠어요. 내일은 조금 일찍 퇴근할 수 있으면 좋겠네요.':'내일은 영업 끝나기 전에 올게요. 오늘은 그냥 집에 가서 쉬어야겠어요.')]);return true;}
  r.pending=true;m.story.beginRows('rx_shift_intro',t,[row('shop-loner','바는 닫았죠? 한 잔 하려고 했는데, 퇴근이 늦어졌네요.'),row('luna','많이 피곤해 보이세요.'),row('shop-loner','……오늘은 누가 뭘 물으면 대답할 힘도 없네요.')]);return true;
 }
 return false;
};
api.open=function(m){if(!m.remixX||m.transition||m.ride||m.encounter||m.story.blocking)return false;m.remixX.panel='notebook';m.paused=true;m.revision++;return true;};
api.action=function(m,action){const r=m.remixX;if(!r)return false;
 if(action==='rx-notebook')return api.open(m);
 if(action==='rx-close'){r.panel=null;m.paused=false;m.revision++;m.updateNear();return true;}
 if(action==='rx-wait'||action==='rx-speak'){
  if(r.panel!=='choice')return true;
  const wait=action==='rx-wait';r.choice=wait?'wait':'speak';r.pendingEntry=[wait?'잠깐의 침묵':'짧은 안내',wait?'대답을 재촉하지 않았다. 그 사람은 잠시 뒤 먼저 이야기를 꺼냈다.':'내일 다시 오라고 안내했다. 그 사람은 쉬러 돌아가기로 했다.'];r.panel=null;m.paused=false;
  const t={id:'encounter-shop-loner',actor:'shop-loner',x:-4.15,y:-.7};m.story.beginRows('rx_shift_reply',t,wait?[row('shop-loner','……말을 더 안 해 주니까 오히려 좋네요.'),row('shop-loner','내일은 진토닉 한 잔 마시러 올게요. 오늘은 좀 쉬어야겠어요.'),row('luna','네. 내일 뵐게요.')]:[row('luna','오늘은 문을 닫았지만, 내일 다시 오시면 돼요.'),row('shop-loner','그렇죠. 오늘은 쉬어야겠어요. 알려 줘서 고마워요.')]);m.revision++;return true;
 }
 return false;
};
api.dialog=function(m){const r=m.remixX;if(!r?.panel)return'';const b=(label,id)=>`<button data-outside-action="${id}">${label}</button>`;
 if(r.panel==='choice')return `<section class="outside-dialog rx-reflection" role="dialog" aria-modal="true" aria-label="행인에게 답하기"><small>GPT 실험 장면 · 응대 방식</small><h2>지금은 어떤 말이 필요할까?</h2><p>점수나 정답은 없어요. 말하거나 기다린 뒤, 상대의 답을 들어보세요.</p><div class="rx-actions">${b('잠깐 기다린다','rx-wait')}${b('내일 다시 오라고 안내한다','rx-speak')}</div>${b('아직 정하지 않고 돌아가기','rx-close')}</section>`;
 const memory=r.barMemory;
 return `<section class="outside-dialog rx-reflection" role="dialog" aria-modal="true" aria-label="오늘 남은 이야기"><small>GPT 실험 · ${r.panel==='reflection'?'하루의 마무리':'이번 탐색의 기록'}</small><h2>${r.panel==='reflection'?'오늘 남은 이야기':'들었던 말, 했던 일'}</h2><p>${r.panel==='reflection'?'많이 돌아다녔는지보다, 어떤 만남이 남았는지.':'끝까지 들은 대화만 기록해요. 모든 곳에 들를 필요는 없어요.'}</p><div class="rx-memory-list">${memory?`<article><small>직전 GPT 실험에서 만든 한 잔${memory.debug?' · 테스트 제조':''}</small><h3>${esc(memory.title)}</h3><p>${esc(memory.text)}</p></article>`:''}${r.entries.map(e=>`<article><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></article>`).join('')||'<p>아직 끝까지 들은 대화가 없어요. 그냥 집으로 돌아와 쉬어도 괜찮아요.</p>'}</div><p class="rx-footnote">새 대화와 회고 문장은 실험용 초안입니다. 본편의 일차·관계·돈·저장 데이터는 바꾸지 않습니다.</p><div class="rx-actions">${b(r.panel==='reflection'?'여운을 남기고 계속 둘러보기':'닫기','rx-close')}${r.panel==='reflection'?b('탐색 마치기','exit'):''}</div></section>`;
};
api.hint=function(m){return m.remixX&&m.time<m.remixX.introUntil&&!m.paused?'<div class="rx-street-intro" role="status">'+(m.config.flow==='out'?'오늘은 집으로. 돌아가는 길에 잠깐 누군가의 말을 들어도 좋겠어요.':'다시 바에 가는 길. 어제와 같은 거리도 조금 다르게 보일지 몰라요.')+'</div>':'';};
root.LunaRemixExperience=api;
})(typeof window==='undefined'?globalThis:window);
