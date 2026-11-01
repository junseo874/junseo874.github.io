// Rebuild the standalone graphic inventory after adding PNG artwork.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const labels={
 'choices/selected-background-right':'외부 선택지 · 활성 배경 / 오른쪽 배치',
 'choices/selected-background-left':'외부 선택지 · 활성 배경 / 왼쪽 배치',
 'choices/inactive-line':'외부 선택지 · 비활성 세로선',
 'choices/key-e':'외부 선택지 · E키 아이콘',
 'choices/key-frame':'외부 선택지 · 빈 키 테두리',
 'choices/pointer-right':'외부 선택지 · 오른쪽 삼각형',
 'choices/pointer-left':'외부 선택지 · 왼쪽 삼각형',
 'tutorial/key-w':'선택지 튜토리얼 · W키',
 'tutorial/key-s':'선택지 튜토리얼 · S키',
 'tutorial/key-e':'선택지 튜토리얼 · E키',
 'tutorial/mouse-wheel':'선택지 튜토리얼 · 마우스 휠',
 'tutorial/triangle-up':'선택지 튜토리얼 · 위 삼각형',
 'tutorial/triangle-down':'선택지 튜토리얼 · 아래 삼각형',
 'tutorial/panel-background':'선택지 튜토리얼 · 배경 패널 / 글자 없음',
 'tutorial/panel-accent':'선택지 튜토리얼 · 상단 발광 장식',
 'tutorial/divider':'선택지 튜토리얼 · 구분선',
 'interaction/outside-interact-e':'외부 상호작용 · 원형 E키 / 그림자 포함',
 'interaction/outside-interact-e-32x32':'외부 상호작용 · 원형 E키 / 아이콘만'
};
const tailLabels={A:'중앙',B:'왼쪽',C:'오른쪽'};
const rows=[],seen=new Set();
function walk(dir){if(!fs.existsSync(path.join(root,dir)))return;for(const f of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const src=dir+'/'+f.name;if(['extracted','parts','cursors','WebGenerated'].includes(f.name))continue;if(f.isDirectory()){walk(src);continue;}record(src);}}
function record(src){const f={name:path.basename(src)};if(!/\.png$/i.test(f.name)||seen.has(src))return;seen.add(src);
 // The unsliced exterior sheet is a layout example with baked-in sample dialogue.
 if(src==='assets/9_ArtResources/05.UI/06.Ect/exterior_textbox/GRD_textbox.png')return;
 const data=fs.readFileSync(path.join(root,src));if(data.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Not PNG: '+src);
 const part=src.startsWith('assets/ui/parts/'),id=(part?src.slice('assets/ui/parts/'.length):src.split('/').slice(2).join('/')).replace(/\.png$/,'');
 const tail=/^GRD_textbox_tail_([ABC])\.png$/.exec(f.name);
 const title=part?labels[id]:/exterior[-_]textbox/.test(src)?'외부 말풍선 · '+(tail?'꼬리 '+tailLabels[tail[1]]+' ('+tail[1]+')':f.name):/IMG_choice/.test(f.name)?'바 선택지 · '+f.name:f.name;
 if(part&&!title)throw Error('Missing part label '+src);
 const partKind=/background/.test(id)?'background':/key-frame|inactive-line/.test(id)?'border':/accent|divider/.test(id)?'decoration':'icon';
 rows.push({src,title,category:part?'UI · 분리 그래픽':'UI · 원본 조각',w:data.readUInt32BE(16),h:data.readUInt32BE(20),...(part?{partKind,note:id.includes('selected-background')?'텍스트 없는 가변 폭 배경 · 모서리 보존 권장':id==='tutorial/panel-background'?'본체 350×230 · 그림자용 투명 여백 포함':'현재 게임 디자인 · 투명 PNG'}:{})});
}
walk('assets/ui');
walk('assets/9_ArtResources/05.UI');
for(const {from,to} of require('../../docs/architecture/art-resource-paths.json').records)if(from.startsWith('assets/ui/'))record(to);
const generated=require('../data/presentation/generated-art/manifest.json');
for(const r of generated.records){const s=r.sources.find(s=>s.src.startsWith('assets/ui/extracted/notification-'))||r.sources[0],src='assets/9_ArtResources/'+r.path;
 const part=r.sources.find(s=>s.src.startsWith('assets/ui/parts/'));
 rows.push({src,title:part?labels[part.src.slice('assets/ui/parts/'.length).replace(/\.png$/,'')]:s.title,w:r.width,h:r.height,partKind:r.kind,
 noticeKinds:[...new Set(r.sources.flatMap(s=>s.states.filter(x=>x.startsWith('notification-')).map(x=>x.slice(13))))],
 category:part?'UI · 분리 그래픽':r.path.includes('/Cursors/')?'UI · 마우스 커서':r.kind==='artwork'?'기타 그래픽':r.sources.some(s=>s.states.some(x=>x.startsWith('notification-')))?'UI · 팝업 분리':'UI · 기타 분리',
 contexts:r.sources.map(s=>[s.title,s.contexts,...s.states].filter(Boolean).join(' ')).join(' | '),note:s.note||'웹 생성 PNG · 원본 크기·투명 여백 유지'});
}
const additional=path.join(root,'data/presentation/generated-art/extraction.json');
if(fs.existsSync(additional))for(const item of JSON.parse(fs.readFileSync(additional,'utf8')))if(!rows.some(r=>r.src===item.src)){
 const labels={background:'배경',border:'테두리',icon:'아이콘',shadow:'그림자'};
 if(item.sourceSelector){const s=item.sourceSelector,old=item.title;let element=/icon|svg/.test(s)?'아이콘':/kbd|key/.test(s)?'키 표시':/button|\.btn/.test(s)?'버튼':/before|after/.test(s)?'장식':/progress|gauge|meter|track|zone/.test(s)?'게이지':/card/.test(s)?'카드':/header|heading/.test(s)?'제목 영역':'패널';
  const label=element===labels[item.partKind]?element:element+' '+labels[item.partKind];
  item.title=item.title.split(' · '+s.replace(/^(div|span|button|section|aside|header|footer|svg|kbd)/,''))[0]+' · '+label+(item.iconGlyph?' ('+item.iconGlyph+')':'');item.contexts=(item.contexts||'')+' '+old;
 }
 rows.push(item);
}
if(new Set(rows.map(row=>row.src)).size!==rows.length)throw Error('Duplicate graphic path');
for(const row of rows)if(!fs.existsSync(path.join(root,row.src)))throw Error('Missing graphic '+row.src);
if(!process.argv.includes('--check'))fs.writeFileSync(path.join(root,'data/runtime/resource-extraction-catalog.js'),'// Generated by tools/build_resource_extraction_catalog.cjs\nwindow.ResourceExtractionAssets='+JSON.stringify(rows,null,2)+';\n');
console.log('Graphic inventory:',rows.length,'PNG files');
