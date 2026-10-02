(function(root){
'use strict';
// Experimental session memory only: never stored in campaign flags, saves or source tables.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api={lastEpisode:null};
const notes={outside_day0_port_pair:['언노운의 불빛','포트 가게 앞에서 두 행인이 언노운의 재개장을 기대하는 이야기를 나누었다.'],outside_day0_shiba_wanted:['개시바 지명수배','코라테크 치안관리부가 개시바를 수배하고 있었다.']};
api.init=function(m,options){m.remixX=m.config.day!==99&&options.variant==='gpt'&&!root.lunaCampaign?.active?{entries:[],seen:new Set(),panel:null,choice:null,pending:false,introUntil:6,finished:false,barMemory:api.lastEpisode?{...api.lastEpisode}:null}:null;};
api.add=function(m,id,title,text){const r=m.remixX;if(!r||r.seen.has(id))return;r.seen.add(id);r.entries.push({id,title,text});};
api.tick=function(m){const r=m.remixX;if(!r)return;for(const story of [m.story,m.backgroundStory])for(const id of story.done){if(notes[id])api.add(m,id,...notes[id]);}

};
api.interact=function(m,t){const r=m.remixX;if(!r)return false;
 if(t.id==='sofa'||t.id==='bar'&&m.config.flow==='in'){r.panel='reflection';r.finished=true;m.paused=true;m.revision++;return true;}

 return false;
};
api.open=function(m){if(!m.remixX||m.transition||m.ride||m.encounter||m.story.blocking)return false;m.remixX.panel='notebook';m.paused=true;m.revision++;return true;};
api.action=function(m,action){const r=m.remixX;if(!r)return false;
 if(action==='rx-notebook')return api.open(m);
 if(action==='rx-close'){r.panel=null;m.paused=false;m.revision++;m.updateNear();return true;}

 return false;
};
api.dialog=function(m){const r=m.remixX;if(!r?.panel)return'';const b=(label,id)=>`<button data-outside-action="${id}">${label}</button>`;
 const memory=r.barMemory;
 return `<section class="outside-dialog rx-reflection" role="dialog" aria-modal="true" aria-label="오늘 남은 이야기"><small>GPT 실험 · ${r.panel==='reflection'?'하루의 마무리':'이번 탐색의 기록'}</small><h2>${r.panel==='reflection'?'오늘 남은 이야기':'들었던 말, 했던 일'}</h2><p>${r.panel==='reflection'?'많이 돌아다녔는지보다, 어떤 만남이 남았는지.':'끝까지 들은 대화만 기록해요. 모든 곳에 들를 필요는 없어요.'}</p><div class="rx-memory-list">${memory?`<article><small>직전 GPT 실험에서 만든 한 잔${memory.debug?' · 테스트 제조':''}</small><h3>${esc(memory.title)}</h3><p>${esc(memory.text)}</p></article>`:''}${r.entries.map(e=>`<article><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></article>`).join('')||'<p>아직 끝까지 들은 대화가 없어요. 그냥 집으로 돌아와 쉬어도 괜찮아요.</p>'}</div><p class="rx-footnote">외부 대사는 노션 기획을 따르며, 회고 문장만 실험용 요약입니다. 본편의 일차·관계·돈·저장 데이터는 바꾸지 않습니다.</p><div class="rx-actions">${b(r.panel==='reflection'?'여운을 남기고 계속 둘러보기':'닫기','rx-close')}${r.panel==='reflection'?b('탐색 마치기','exit'):''}</div></section>`;
};
api.hint=function(m){return m.remixX&&m.time<m.remixX.introUntil&&!m.paused?'<div class="rx-street-intro" role="status">'+(m.config.flow==='out'?'오늘은 집으로. 돌아가는 길에 잠깐 누군가의 말을 들어도 좋겠어요.':'다시 바에 가는 길. 어제와 같은 거리도 조금 다르게 보일지 몰라요.')+'</div>':'';};
root.LunaRemixExperience=api;
})(typeof window==='undefined'?globalThis:window);
