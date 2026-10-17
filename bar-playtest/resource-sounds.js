/* File-backed sounds used by the web build. Preview never changes game settings. */
(function(W){
'use strict';
const group='common-sounds',kindNames={music:'배경음악',ambience:'환경음',ui:'UI / 알림',scene:'이동 / 컷씬',craft:'제조 기믹',dialogue:'대사 출력음'},stateNames={active:'사용 중',option:'선택 가능',archive:'미사용 / 보관',master:'음악 원본'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries=[
 ['ambience','street-loop.ogg','거리 환경음','외부 거리와 바 테라스 대화','street-audio.js','active',true,'audio/ambience/'],
 ['ambience','rain-loop.ogg','빗소리','비 오는 거리와 테라스 · 0–1일차','street-audio.js','active',true,'audio/ambience/'],
 ['ui','hover_clean.wav','호버 / 선택 이동','버튼 호버와 키보드 선택 이동','hover-audio.js'],
 ['ui','click_clean.wav','버튼 클릭','공통 UI 버튼 선택 / 확인','click-audio.js'],
 ['ui','controls-popup.wav','조작 튜토리얼 등장','이동·상호작용 팝업이 나타날 때','controls-tutorial.js'],
 ['ui','message_01.wav','스토리 알림','목표·인물 등 스토리 알림 등장','story-notice-audio.js'],
 ['ui','access_granted_01.wav','목표 완료','목표 완료 알림 등장','story-notice-audio.js'],
 ['ui','credits.wav','금액 변동','획득·지출 금액 알림','currency-audio.js'],
 ['scene','home-door.wav','집 문 여닫기','집 출입 시 문 효과음','home-door-audio.js'],
 ['scene','chris-contact-confirm.wav','크리스 연락','도입부 크리스 연락 알림','../cutscene-studio/opening-template.js','active',false,'../cutscene-studio/assets/opening/'],
 ['scene','change-clothes.wav','옷 갈아입기','기상 후 검은 화면에서 옷을 갈아입는 연출','../cutscene-studio/opening-template.js','active',false,'../cutscene-studio/assets/opening/'],
 ['craft','pour_02_loop.wav','따르기','재료를 붓는 동안 반복 · 유량에 따라 음량 변화','pour-view.js','active',true],
 ['craft','stir_01_loop.wav','스터 · 01','스터 동작 중 재생하는 기본음','stir-polish.js','active',true],
 ['craft','stir_02_loop.wav','스터 · 02','스터 소리 2번 선택 시 사용','stir-polish.js','option',true],
 ['craft','shaker_01_hit.wav','쉐이킹 · 01','쉐이킹 성공 입력 · 사운드 1번','shake-polish.js','option'],
 ['craft','shaker_02_hit.wav','쉐이킹 · 02','쉐이킹 성공 입력 · 사운드 2번','shake-polish.js','option'],
 ['craft','beercan_open.wav','맥주 개봉','병따개 기믹에서 개봉하는 소리','open-view.js'],
 ['craft','beer_fizz_tail.wav','맥주 탄산','개봉 후 이어지는 탄산 소리','open-view.js'],
 ['ui','hover_holo_01.wav','이전 호버음','현재 호버는 hover_clean.wav 사용','이전 리소스','archive'],
 ['ui','story-notice-retro9.wav','이전 스토리 알림음','현재 알림은 message_01.wav 사용','이전 리소스','archive'],
 ['craft','pour_01_loop.wav','이전 따르기음','현재 따르기는 pour_02_loop.wav 사용','이전 리소스','archive'],
 ['music','LUNA_Track_02.mp3','Track 02 · MP3 원본','게임에는 M4A 변환본 사용','음악 원본 보관','master',false,'../sound/'],
 ['music','LUNA Track 02_master.wav','Track 02 · WAV 마스터','게임에는 M4A 변환본 사용','음악 원본 보관','master',false,'../sound/']
];
let player=null,volume=.35;
function collect(rows,C,F){
 if(!C.groups.some(g=>g[0]===group))C.groups.unshift([group,'공통','사운드 / 미리 듣기']);
 const sounds=entries.map(e=>[...e]);
 for(const [i,t] of F.barBgm.tracks.entries())sounds.push(['music',t.src.split('/').at(-1),t.title,['바 내부 플레이리스트','타이틀·로비·외부 거리','집·테라스 / 바 내부 플레이리스트','바 내부 플레이리스트'][i],'bgm.js','active',true,t.src.slice(0,t.src.lastIndexOf('/')+1)]);
 for(const version of ['low','main'])for(let n=1;n<=6;n++)sounds.push(['dialogue',version+'-'+n+'.wav','대사 '+(version==='low'?'저음':'기본음')+' · '+n,'타이핑 중 6개 샘플 순환 · '+(version==='low'?'기본 설정':'설정에서 버전 1 선택'),'dialogue-audio.js',version==='low'?'active':'option',false,'audio/dialogue/']);
 return [...rows,...sounds.map(([kind,file,title,usage,source,state='active',loop=false,base='audio/'])=>({id:'sound:'+base+file,group,title,usage,status:'registered',layers:[],audio:{src:base+file,kind,state,loop,source},note:'게임 적용 위치: '+source}))];
}
function thumb(r){return '<span class="sound-symbol" aria-hidden="true">♫</span><span class="sound-kind">'+esc(kindNames[r.audio.kind])+' · '+esc(stateNames[r.audio.state])+'</span>';}
function detail(r){const a=r.audio;return '<small>공통 / SOUND RESOURCE</small><h2>'+esc(r.title)+'</h2><p>'+esc(r.usage)+'</p><span class="badge registered">'+esc(stateNames[a.state])+'</span><section class="sound-preview" aria-label="사운드 미리 듣기"><span class="sound-symbol" aria-hidden="true">♫</span><audio id="sound-player" controls preload="metadata" aria-label="'+esc(r.title)+' 미리 듣기" src="'+esc(a.src)+'"></audio><div class="sound-actions"><button data-sound-play>재생</button><button data-sound-stop>처음으로</button><label><input type="checkbox" data-sound-loop> 반복 재생</label></div><p data-sound-status role="status">재생을 누르면 원본 소리를 들을 수 있습니다.</p><small>미리 듣기 음량은 게임 설정과 별개입니다. 게임 내 볼륨·필터·속도 조정 전 원본입니다.</small></section><div id="inspect-downloads">'+W.ResourceDownload.controls(r)+'</div><dl class="meta"><dt>분류 / 사용 상태</dt><dd>'+esc(kindNames[a.kind])+' / '+esc(stateNames[a.state])+'</dd><dt>사용하는 곳</dt><dd>'+esc(r.usage)+'</dd><dt>형식 / 길이</dt><dd>'+esc(a.src.split('.').at(-1).toUpperCase())+' · <span data-sound-duration>확인 중…</span></dd><dt>게임에서 반복 사용</dt><dd>'+(a.loop?'예 · 상황에 따라 재생 / 정지':'아니요 · 발생 시 재생')+'</dd><dt>연결 코드 / 출처</dt><dd>'+esc(a.source)+'</dd><dt>원본 파일</dt><dd><a href="'+esc(a.src)+'" target="_blank" rel="noopener">'+esc(a.src)+'</a></dd></dl>';}
function stop(){if(!player)return;player.pause();player.removeAttribute('src');player.load();player=null;}
function bind(){
 const audio=player=document.querySelector('#sound-player'),root=audio.closest('.sound-preview'),status=root.querySelector('[data-sound-status]'),play=root.querySelector('[data-sound-play]');
 audio.volume=volume;
 audio.onvolumechange=()=>{volume=audio.volume;};
 audio.onloadedmetadata=()=>{const out=document.querySelector('[data-sound-duration]');if(out&&player===audio)out.textContent=Number.isFinite(audio.duration)?(audio.duration<1?audio.duration.toFixed(3)+'초':Math.floor(audio.duration/60)+'분 '+(audio.duration%60).toFixed(1)+'초'):'길이 확인 불가';};
 const failed=()=>{play.textContent='다시 재생';status.textContent='소리를 불러오지 못했습니다. 다시 재생하거나 원본을 다운로드해 주세요.';const out=document.querySelector('[data-sound-duration]');if(out)out.textContent='확인 불가';};
 audio.onerror=()=>{if(player===audio&&audio.hasAttribute('src'))failed();};
 audio.onplay=()=>{play.textContent='일시정지';status.textContent='재생 중';};
 audio.onpause=()=>{play.textContent='재생';status.textContent=audio.ended?'재생 완료':'일시정지';};
 audio.onended=()=>{play.textContent='다시 재생';status.textContent='재생 완료';};
 play.onclick=async()=>{if(!audio.paused){audio.pause();return;}try{if(audio.error)audio.load();await audio.play();}catch(e){if(player===audio&&e.name!=='AbortError')failed();}};
 root.querySelector('[data-sound-stop]').onclick=()=>{audio.pause();audio.currentTime=0;status.textContent='처음부터 재생할 수 있습니다.';};
 root.querySelector('[data-sound-loop]').onchange=e=>{audio.loop=e.target.checked;};
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)player?.pause();});
W.addEventListener('pagehide',stop);
W.ResourceSounds={collect,thumb,detail,bind,stop,kindNames,stateNames};
})(window);
