(function(W){'use strict';
const M=StudioModel,K=StudioKeyframes,{copy,clamp,round}=M;
const locked=(p,c)=>!!c&&!!p.tracks.find(t=>t.id===c.track)?.locked;
function effective(p){const solo=p.tracks.some(t=>t.solo);return solo?{...p,tracks:p.tracks.map(t=>({...t,muted:t.muted||!t.solo}))}:p;}
// Linked starts remain sequence time. Input gates suspend that clock, not each clip independently.
function reflow(p){const byId=new Map(p.clips.map(c=>[c.id,c])),visiting=new Set(),done=new Set();
 function visit(c){if(done.has(c.id))return;if(visiting.has(c.id))throw Error('클립 시작 연결이 순환합니다.');visiting.add(c.id);
  if(c.after){const parent=byId.get(c.after.id);if(!parent)throw Error('시작 기준 클립이 없습니다.');visit(parent);const at=round(parent.start+(c.after.edge==='start'?0:parent.duration)+c.after.offset);if(at<0||at+c.duration>600)throw Error('연결된 클립이 0–600초 범위를 벗어납니다.');if(!locked(p,c)&&c.start!==at){c.start=at;p.duration=Math.max(p.duration,round(at+c.duration));}}
  visiting.delete(c.id);done.add(c.id);
 }p.clips.forEach(visit);return p;
}
function reconnectOffset(p,c){if(!c?.after)return;const parent=p.clips.find(a=>a.id===c.after.id);if(parent)c.after.offset=round(c.start-parent.start-(c.after.edge==='start'?0:parent.duration));}
function detachMissing(p){const ids=new Set(p.clips.map(c=>c.id));for(const c of p.clips)if(c.after&&!ids.has(c.after.id))delete c.after;}
function tagIssues(text){const problems=[],stack=[];for(const m of text.matchAll(/\[(\/)?([a-z]+)(?::([^\]]*))?\]/gi)){let name=m[2].toLowerCase();if(name==='color')name='c';if(['t','br','camshake'].includes(name)){if(m[1]||StudioTags.parse(m[0]).text===m[0])problems.push('단일 태그 확인: '+m[0]);continue;}if(!['c','size','shake','noise','censor','wave','b'].includes(name)){problems.push('알 수 없는 태그: '+m[0]);continue;}if(m[1]){if(stack.at(-1)!==name)problems.push('태그 짝 확인: '+m[0]);else stack.pop();}else{if(StudioTags.parse(m[0]).text===m[0])problems.push('태그 값 확인: '+m[0]);else stack.push(name);}}for(const name of stack)problems.push('닫는 태그 누락: [/'+name+']');return [...new Set(problems)];}
// Helpers bake into ordinary keys: no hidden motion solver competing with recording.
function aim(p,c,{actor,second,offset=1.2,side='left',padding=3}){
 if(locked(p,c))throw Error('잠긴 트랙입니다.');const s=M.sample(p,c.start),a=s.actors[actor];if(!a)throw Error('대상 액터를 선택하세요.');
 const channels=c.type==='camera'?['x','y','w']:['x','y'];
 if(c.type!=='camera'&&!['move','visual'].includes(c.type))throw Error('이동 또는 카메라 클립을 선택하세요.');
 if(c.actor===actor)throw Error('이동 대상은 다른 액터로 선택하세요.');
 if(channels.some(ch=>(c.keyframes?.[ch]||[]).some(k=>k.t>0&&k.t<c.duration)))throw Error('중간 위치 키가 있습니다. 기존 경로를 보존하려면 새 클립에서 구도를 적용하세요.');
 let dest;if(c.type==='camera'){const b=second?s.actors[second]:a;if(!b)throw Error('두 번째 액터가 없습니다.');const w=clamp(Math.max(Math.abs(a.x-b.x)+padding,Math.abs(a.y-b.y)*16/9+padding),3,24);dest={x:(a.x+b.x)/2,y:(a.y+b.y)/2+.8,w};}
 else dest={x:a.x+(side==='left'?-1:1)*offset,y:a.y};
 const bounds={x:[-30,15],y:[-5,20],w:[3,24]};for(const ch of channels){const [lo,hi]=bounds[ch];if(dest[ch]<lo||dest[ch]>hi||K.value(c,ch,0)<lo||K.value(c,ch,0)>hi)throw Error('대상 구도가 기본 이동 범위를 넘습니다. 키프레임에서 직접 조절하세요.');}
 for(const ch of channels){K.endpoint(c,'from',ch,K.value(c,ch,0));K.endpoint(c,'to',ch,round(dest[ch]));}
 if(c.type==='move'){c.facing=dest.x<a.x?'right':'left';K.endpoint(c,'from','flipX',0);K.endpoint(c,'to','flipX',0);}
 c.aimNote=(p.actors[actor]?.name||actor)+(second?' / '+p.actors[second]?.name:'')+' · 적용 당시 좌표';
}
function addPreset(p,type,a,b,at){if(!p.actors[a]||!p.actors[b]||a===b)throw Error('서로 다른 액터 두 명을 선택하세요.');if(at+10>600)throw Error('600초 이내에 연출 묶음을 배치할 공간이 필요합니다.');if(p.clips.length>1980)throw Error('클립 수가 너무 많습니다.');
 const newClips=[],track=(kind,name)=>{const t={id:'track-'+crypto.randomUUID(),type:kind,name,height:48,muted:false};p.tracks.push(t);return t.id;},ts={};
 const add=(kind,start,data)=>{ts[kind]??=track(kind,'프리셋 · '+M.kinds[kind].name);const c=M.clip(kind,round(at+start),{track:ts[kind],...data});p.clips.push(c);newClips.push(c);return c;};
 const line=(actor,start,text)=>add('dialogue',start,{actor,text,title:p.actors[actor].name+' · '+text,duration:3,wait:true,waitMotion:'idle',waitAudio:'continue'});
 if(type==='encounter'){const s=M.sample(p,at),m=add('move',0,{actor:a,from:{x:s.actors[a].x,y:s.actors[a].y},to:{x:s.actors[a].x,y:s.actors[a].y},duration:2,animation:a==='samho'?'run':'walk'});aim(p,m,{actor:b});}
 const start=type==='encounter'?2:0;
 if(type==='memory'){add('fx',0,{effect:'noise',strength:.35,duration:1.2,title:'기억 진입 · 노이즈'});add('fx',0,{effect:'fadeOut',strength:.8,duration:.6,title:'기억 진입 · 암전'});add('fx',.6,{effect:'fadeIn',strength:.8,duration:.6,title:'기억 진입 · 복귀'});}
 const cam=add('camera',start,{from:copy(M.sample(p,at+start).camera),duration:1.2,title:'두 인물 · 투 샷'});aim(p,cam,{actor:a,second:b});
 const first=line(a,start+1.2,type==='memory'?'[noise]기억이 떠오릅니다.[/noise]':'잠깐 이야기할 수 있을까요?'),last=line(b,start+4.2,'무슨 일인가요?');last.after={id:first.id,edge:'end',offset:0};
 if(type==='memory'){const out=add('fx',start+7.2,{effect:'noise',strength:.25,duration:1,title:'기억 종료 · 잔상'});out.after={id:last.id,edge:'end',offset:0};}
 for(const id of [a,b])if(!p.visibleActors.includes(id))p.visibleActors.push(id);K.hydrate(p);reflow(p);p.duration=Math.max(p.duration,...newClips.map(c=>round(c.start+c.duration)));return newClips;
}
function audioDuringWait(p,time,gate,age){p=effective(p);if(!gate)return p;const policy=gate.waitAudio||'stop';if(policy==='stop')return {...p,clips:p.clips.filter(c=>c.type!=='audio')};return {...p,clips:p.clips.map(c=>c.type!=='audio'?c:{...c,keyframes:{},volume:K.audioGain(c,clamp(time-c.start,0,c.duration))*(policy==='fade'?Math.max(0,1-age):1),fadeIn:0,fadeOut:0})};}
function visualDuringWait(a,gate,age){if(!gate)return a;const policy=gate.waitMotion||'idle';if(policy==='continue')return {...a,age:a.age+age};if(policy==='hold')return a;const idle=a.assetId?.replace(/-[^-]+$/,'-idle');return idle&&StudioMedia.assets.has(idle)?{...a,assetId:idle,age,loop:true}:a;}
const oldSample=M.sample;M.sample=(p,t)=>oldSample(effective(p),t);
const oldIssues=M.issues;M.issues=p=>{const issues=oldIssues(p);try{reflow(copy(p));}catch(e){issues.push({id:p.clips.find(c=>c.after)?.id||'',text:e.message});}for(const c of p.clips){if(c.type==='dialogue')for(const text of tagIssues(c.text))issues.push({id:c.id,text:c.title+' — '+text});if(c.after&&locked(p,c))issues.push({id:c.id,text:c.title+' — 잠긴 클립의 시작 연결은 잠금을 해제하면 갱신됩니다.'});}return issues;};
const oldValidate=M.validate;M.validate=p=>{const q=oldValidate(p);for(const t of q.tracks)for(const k of ['locked','solo'])if(t[k]!==undefined&&typeof t[k]!=='boolean')throw Error('트랙 잠금·솔로 값을 확인하세요.');for(const c of q.clips){if(c.after&&(!q.clips.some(o=>o.id===c.after.id)||!['start','end'].includes(c.after.edge)||!Number.isFinite(c.after.offset)||Math.abs(c.after.offset)>600))throw Error('시작 연결을 확인하세요.');if(c.waitMotion&&!['idle','hold','continue'].includes(c.waitMotion)||c.waitAudio&&!['stop','continue','fade'].includes(c.waitAudio))throw Error('입력 대기 설정을 확인하세요.');}reflow(q);return q;};
W.StudioAuthoringModel={locked,effective,reflow,reconnectOffset,detachMissing,tagIssues,aim,addPreset,audioDuringWait,visualDuringWait};
})(window);
