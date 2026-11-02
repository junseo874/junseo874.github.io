/* Dependency-free UTF-8 ZIP (stored entries). Includes the actual CSV files,
   their view links and regenerated runtimes, not a browser-only draft. */
(function(W){
'use strict';
const enc=new TextEncoder(),table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function zip(files){let offset=0;const chunks=[],central=[];for(const [path,text]of Object.entries(files)){
 const name=enc.encode(path),data=enc.encode(text),sum=crc(data),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
 v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);header.set(name,30);
 const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,sum,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);
 v.setUint16(12,33,true);d.setUint16(14,33,true); // valid ZIP date: 1980-01-01
 chunks.push(header,data);central.push(dir);offset+=header.length+data.length;
 }const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,central.reduce((n,x)=>n+x.length,0),true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
async function packageFiles(model,result){
 const sources={...model.files,...model.output()},catalog=await W.LunaCsv.load(p=>Promise.resolve(sources[p]));
 const hash=await crypto.subtle.digest('SHA-256',enc.encode([...catalog.values].map(([id,v])=>id+JSON.stringify(v)).join('')));
 result.data.sharedCsv=true;result.data.source={...result.data.source,sharedCsv:'data/shared-csv/system/table_index.csv',contentHash:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''),tableCount:catalog.tables.length};
 const files=Object.fromEntries(Object.entries(model.output()).map(([p,t])=>['bar-playtest/data/shared-csv/'+p,t]));
 files['bar-playtest/data/runtime/game-data.js']='/* Generated from data/shared-csv. Run node tools/build-shared-data.cjs --write; do not edit. */\nwindow.LUNA_DATA = '+JSON.stringify(result.data)+';\n';
 files['bar-playtest/data/runtime/campaign-data.js']='/* Generated from the same engine CSV story rows. Do not edit. */\n(function(root){root.LUNA_CAMPAIGN_DATA='+JSON.stringify(result.story,null,2)+';})(typeof window===\'undefined\'?globalThis:window);\n';
 files['APPLY.txt']='바 대사 편집기 내보내기\n압축 안의 bar-playtest 폴더를 같은 버전의 웹 저장소 루트에 병합하세요.\nCSV와 web-views.json, runtime 두 파일을 함께 적용합니다. GitHub에는 적용 후 커밋/푸시해야 반영됩니다.\nUnity 엔진 폴더에는 자동 반영되지 않습니다. 다른 사람이 원본을 수정했다면 먼저 변경 내용을 비교하세요.\n';return files;
}
W.LunaDialogueExport={zip,packageFiles};
})(window);
