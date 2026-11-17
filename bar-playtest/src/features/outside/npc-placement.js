/* Shared presentation contract. X is authored in Unity world units; the encounter owns its
 * floor/pivot, not the dialogue CSV. Move multi-person set pieces as a formation. */
(function(root){
'use strict';
const file='npc-placements.json',empty=()=>({version:1,positions:{}}),defaultText=JSON.stringify(empty(),null,2)+'\n';
const floorNames={street:'거리 · 지면',corridor:'상층 복도',home:'집 · 소파',counter:'시BAR · 진열대'};
const specs={};function spot(id,label,floor,x,y,min,max,cast){specs[id]={id,label,floor,scene:floor==='home'?'home':'street',x,y,min,max,cast};}
// X anchors the pelvis over the seat. The saved Y remains the street plane;
// lift the foot pivot 7.4 art pixels. The open lid is behind the reader on the left.
spot('newspaper','신문 읽는 남자','street',-7.18,-.974,-13.55,5.95,[['Newspaper',0,.074]]);
spot('believer','기신교 신도','street',4.7,-.974,-13.55,5.95,[['M1',0]]);
spot('beggar','노숙자','street',-10.01,-.94,-13.35,5.75,[['Homeless',0]]);
spot('witness','근처 행인','street',-11.05,-.94,-13.35,5.75,[['M1',0]]);
specs.beggar.nearby='witness';specs.witness.nearby='beggar';
spot('repair','수리공','street',-11.675,-.974,-13.35,5.65,[['Repairman',0]]);
spot('guard','통행 경비','street',-14.125,-.974,-14.45,-13.9,[['Gang1',0]]);
spot('camp','갱단 보스 · 동료','street',-15.5,-.974,-16.05,-15.35,[['Gang5',0],['Gang3',.78]]);
spot('thug','1일차 복도 불량배','corridor',-15.66,9.392,-16.3,-14.1,[['Neighbor',0]]);
spot('information','2일차 옆집 아저씨','corridor',-14.26,9.392,-16.15,-14.02,[['Neighbor',0]]);
spot('box','부비의 상자 · 이웃','corridor',-15.59,10.07,-17.1,-15.45,[['box',-.055,-.22],['Neighbor',1.33,-.678]]);
spot('home-cat','부비 · 소파 옆 크리스','home',2.65,-.46,2.42,2.9,[['cat',.057,-.327],['Chris',-.9,-.51]]);
spot('shop','개시바 · 가게','counter',-2.68,-.596,-3.05,-2.35,[['shiba',0]]);
spot('commute2','2일차 출근 · 삼호','street',-5.99,-.7,-12.1,4.8,[['samho',0]]);
spot('commute3','3일차 출근 · 삼호','street',-11.06,-.7,-12.1,4.8,[['samho',0]]);
spot('contract','3일차 계약 · 삼호와 밀수업자','street',-10.06,-.7,-12,3.4,[['samho',0],['M1',2,-.274]]);
spot('trade','1일차 밀거래 · 삼호와 밀수업자','street',3,-.7,-12,3.8,[['samho',0],['M1',2,-.274]]);
spot('store-pair','편의점 앞 행인','street',-5.78,-.94,-13.3,5.1,[['M1',0],['M2',.66]]);
spot('bar-pair','바 앞 행인','street',-1.18,-.94,-13.3,5.1,[['M2',0],['W1',.53]]);
spot('commute-pair','출근길 행인','street',-11.255,-.94,-13.3,5.1,[['M1',0],['M2',.7]]);
spot('reopening-pair','재개점 소문 행인','street',-4.35,-.94,-13.3,5.1,[['M2',0],['W1',.7]]);
spot('residents','상층 복도 주민','corridor',-18.8,9.346,-18.8,-14.7,[['M2',0],['W1',.65]]);
// Partners can be adjusted independently inside a safe dialogue/animation span.
function partner(parent,label,gap){const a=specs[parent],[kind,dx,dy=0]=a.cast[1],id=parent+'-partner';spot(id,label,a.floor,Math.round((a.x+dx)*1000)/1000,Math.round((a.y+dy)*1000)/1000,a.min+gap[0],a.max+gap[1],[[kind,0]]);Object.assign(specs[id],{parent,gap,dx});a.partner=id;}
for(const [id,name,gap]of [['store-pair','편의점 행인 2',[.45,1.3]],['bar-pair','바 앞 행인 2',[.42,1.3]],['residents','복도 주민 2',[.45,1.15]],['commute-pair','출근길 행인 2',[.45,1.3]],['reopening-pair','재개점 행인 2',[.45,1.3]],['camp','보스 옆 갱단원',[.48,.84]],['contract','계약 · 밀수업자',[.55,2.25]],['trade','밀거래 · 밀수업자',[.55,2.25]],['box','상자 쪽 옆집 아저씨',[1.15,1.55]],['home-cat','소파 옆 크리스',[-1.15,-.65]]])partner(id,name,gap);
function position(v,id){const s=specs[id];return v?.positions?.[id]?.x??(s.parent?Math.round((position(v,s.parent)+s.dx)*1000)/1000:s.x);}
function pose(v,id,i=0){const s=specs[id],[kind,dx,dy=0,flip=false]=s.cast[i];
 return{kind,x:i&&s.partner?position(v,s.partner):position(v,id)+dx,y:s.y+dy,flip};}
// The editable handle of a formation is its shared origin, not its first member.
function editPoint(v,id){const s=specs[id];return s.cast.length===1?pose(v,id):{x:position(v,id),y:s.y};}
function range(v,id){const s=specs[id];return s.parent?s.gap.map(offset=>position(v,s.parent)+offset):[s.min,s.max];}
function write(v,id,x){const s=specs[id],before=position(v,id),next=snap(id,x,v),child=s.partner,at=child&&v.positions[child]?position(v,child):null,base=s.parent?position(v,s.parent)+s.dx:s.x;
 if(Math.abs(base-next.x)<.00001)delete v.positions[id];else v.positions[id]=next;
 if(at!==null)write(v,child,at+next.x-before);return v;}
function snap(id,x,v){const s=specs[id];if(!s||!Number.isFinite(x))throw Error('유효한 배치 대상과 X 좌표를 선택하세요.');return{x:Math.round(Math.max(range(v,id)[0],Math.min(range(v,id)[1],x))*1000)/1000,y:s.y};}
function validate(v){if(!v||v.version!==1||!v.positions||typeof v.positions!=='object'||Array.isArray(v.positions)||Object.keys(v).some(k=>!['version','positions'].includes(k)))throw Error('웹 씬 배치 형식이 올바르지 않습니다.');
 for(const [id,p]of Object.entries(v.positions)){if(!Object.hasOwn(specs,id)||!p||Object.keys(p).length!==2||!Object.hasOwn(p,'x')||!Object.hasOwn(p,'y'))throw Error('등록되지 않은 NPC 또는 좌표입니다: '+id);
 const s=snap(id,p.x,v);if(p.y!==s.y||s.x!==p.x)throw Error('허용된 바닥·이동 범위를 벗어났습니다: '+specs[id].label);}return v;}
const api={file,empty,defaultText,specs,floorNames,snap,position,pose,editPoint,range,write,validate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaNpcPlacement=api;
})(typeof window==='undefined'?globalThis:window);
