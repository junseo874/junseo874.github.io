const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),root=path.resolve(__dirname,'..'),b={window:{}};
for(const f of ['data.js','campaign-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),b);const d=b.window.LUNA_DATA,c=b.window.LUNA_CAMPAIGN_DATA;
const raw=context=>d.tables.steps.filter(r=>r.context===context&&r.type==='say').map(r=>[r.actor,r['text.ko']]);
const expected=rows=>rows.filter(r=>r.type==='say').map(r=>[r.actor,r.text]);
assert.equal(JSON.stringify(raw('d1_tutorial_chris')),JSON.stringify(expected(c.day0Bar)));
for(const day of [1,2,3]){const scenes=d.tables.scenes.filter(s=>+s.day===day&&s.phase==='bar');assert.equal(scenes.length,1);assert.equal(JSON.stringify(raw(scenes[0].id)),JSON.stringify(expected(c.bar[day])));}
assert(c.day0Bar.some(r=>r.text.endsWith('1803호야.')));assert(!c.day0Bar.some(r=>r.text.includes('1703호')));
assert(c.day0Bar.some(r=>r.text==='잠은 자야 하지만, 수면 공간에 크게 영향을 받지는 않아요.'));
assert(c.day0Bar.some(r=>r.text==='내가 사람 보는 눈은 있는데 말이야. 루나, 너는 크게 될 놈이야.'));
assert(c.day0Bar.some(r=>r.text==='반면 저 크리스라는 음침한 놈은 아주 인생의 밑바닥을 찍을 놈이지.'));
assert(c.scenes.terraceMemory[2].text.startsWith('그래. 감정을 알게 된다면 행복이 뭔지 알게 될 거야.'));
assert(c.bar[1].some(r=>r.text==='됐고. 여기 맥주, 진짜 맥아로 만드는 거 맞나?'));
assert.equal(c.scenes.johnny.length,56);assert(c.scenes.johnny.slice(44,47).every(r=>r.actor==='johnny'));
assert.equal(c.scenes.ending.length,20);assert.equal(c.scenes.ending.filter(r=>r.cinemaAfter).length,1);assert.equal(c.scenes.ending[7].memoryKey,'terraceMemory3');assert.equal(c.scenes.ending[8].text,'왜, 무슨 생각이라도 났어?');
assert(c.scenes.ending.some(r=>r.text==='…오늘 톰이랑 삼호를 보면서 생각한 거야?'));assert.equal(c.scenes.ending.at(-1).text,'네. 보스.');assert(!c.scenes.ending.some(r=>r.text==='…그렇게 생각한다면 그런 거겠지.'));
console.log('DIALOGUE_SYNC_OK latest day0/1 changes, raw/main shared bar data, Johnny names retained, day3 expanded terrace and memory return');
