const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),W={StudioModel:{},StudioMedia:{},StudioKeyframes:{}};W.window=W;
for(const f of ['data/runtime/game-data.js','data/runtime/campaign-data.js','../cutscene-studio/src/opening-template.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),W);
const spec=require('./fixtures/exterior-notion.json'),D=W.LUNA_DATA,C=W.LUNA_CAMPAIGN_DATA.scenes;
const inherited=new Set(['beggar/intro','beggar/repeat','shop/revisit']);
for(const[key,expected]of Object.entries(spec.dialogues)){
 const rows=key==='StudioOpening.source.tv'?W.StudioOpening.source.tv.map(text=>({actor:'tv',text})):D.sharedStory[key]||C[key];
 assert(rows,key);assert.equal(rows.length,expected.rows,key+' row count');
 const text=rows.filter(r=>r.text!=null&&!(!r.type?.endsWith('say')&&inherited.has(key))).map(r=>[r.actor,r.text]);
 assert.equal(text.length,expected.spoken,key+' spoken count');
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(text)).digest('hex'),expected.sha256,key+' Notion text/order');
 assert(!rows.some(r=>r.text&&/…|연결 컷씬:|말풍선에서 선택지 표시/.test(r.text)),key+' no annotations in speech');
}
for(const[k,n]of [['night0',13],['night2',11],['ending',7]]){assert(C[k][n].cinemaAfter);assert.equal(C[k].filter(r=>r.cinemaAfter).length,1);}
assert.equal(C.night2[11].cinemaAfter,'johnny-memory');assert(C.night2.every(r=>r.type!=='choice'&&r.stage!=='luna-alone'));
assert.equal(C.night0[13].memoryKey,'terraceMemory');assert.equal(C.ending[7].memoryKey,'terraceMemory3');
assert.deepEqual(Array.from(C.night1.find(r=>r.text.includes('와일드 독, 비터스, 각설탕')).emphasis),['와일드 독','비터스','각설탕']);
assert(!C.johnny[0].tomPresent);assert(C.johnny.slice(1).every(r=>r.tomPresent));assert(C.johnny.slice(0,12).every(r=>!r.served));assert(C.johnny.slice(12).every(r=>r.served));
for(const key of ['bossRepairFirst','bossRepairRepeat','bossPayFirst','bossPayRepeat']){const r=D.sharedStory['neighborhood/'+key];assert.equal(r.filter(x=>x.action==='wild-dog-grant').length,1,key);}
assert.equal(D.sharedStory['neighborhood/repairPaid'][5].action,'repair');assert.equal(D.sharedStory['neighborhood/bossIntro'].filter(r=>r.action==='boss-met').length,1);
for(const key of ['intro','info/gang','info/coratech','info/chris'])assert(D.sharedStory['notion/'+key].every(r=>['luna','day2-corridor-thug'].includes(r.actor)));
assert(D.sharedStory['notion/contract'].filter(r=>r.text).every(r=>['luna','contract-samho','contract-smuggler'].includes(r.actor)));
assert.deepEqual(Array.from(D.sharedStory['notion/contract'].flatMap((r,i)=>r.action?[i+':'+r.action]:[])),['9:dealer-exit','10:approach','19:samho-exit']);
const outcomes={'shop/purchased':['너 그거 어디 가서 나한테 샀다고 하면 죽어, 시바.','... 네.'],'shop/quizCorrect':['정답. 칵테일 뜻은 알고 만들어, 시바.','감사해요.'],'shop/quizRetry':['멍청한 답 내놓지 말고 제대로 들어.','처음부터 다시 설명한다. 제대로 들어, 시바.'],'shop/noStockPurchase':['뭐야, 그럼 꺼져.'],'shop/noBrowse':['뭐야, 그럼 꺼져.'],'shop/browse':['뭘 파는 지 볼 수 있나요?','전부 다 보여 주긴 싫고, 몇 개만 보여 줄게.'],'shop/allowanceYes':['박용석 바보!','좋아, 잘했어. 자, 여기 500원.'],'home/bed':['크리스가 사용하는 침대. 푹신해 보인다.'],'home/wardrobe':['기능을 알 수 없는 버튼이 보인다.'],'home/wardrobePressed':['아직 애니메이션이 없는 걸...'],'neighborhood/homeCat':['꾸륵 꺍.']};
for(const [id,text] of Object.entries(outcomes))assert.deepEqual(Array.from(D.sharedStory[id].filter(r=>r.text!=null),r=>r.text),text,id);
assert.deepEqual(Array.from(D.sharedStory['shop/allowanceYes'],r=>r.type),['say','shop-allowance-grant','say']);
assert.equal(D.sharedStory['believer/intro'].filter(r=>r.action==='grant-emblem').length,1);assert.equal(D.sharedStory['newspaper/common'].filter(r=>r.action==='grant-gear').length,1);
console.log('EXTERIOR_NOTION_SYNC_OK: Notion dialogue tables, text/order, actors, actions, terrace links and memory staging.');
