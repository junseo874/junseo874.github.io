/* Day 0 terrace flashback: reuse disposal staging, not the full escape/fight scene. */
window.buildTerraceMemory = function(rows) {
  const sc = new Engine.Scene(StageDisposal), floor = StageDisposal.FLOOR;
  sc.actor('yuna', { name:'유나', x:566, y:floor, flip:true, anim:'yuna.stand', z:2 });
  sc.actor('luna', { name:'루나', x:600, y:floor, flip:false, anim:'luna.stand', z:1 });
  sc.stage('alarm', 0, .12); sc.alarmGain = 0;
  sc.stage('chute', 0, 1);
  sc.cam(0, {x:584, y:317, zoom:1.6});
  sc.eff({type:'lbox', t:0, dur:.7});
  // The campaign overlay handles fading, including skipping and resource loading.
  sc.cut(0, '0일차 · 유나와의 약속', '폐기물 처리소의 짧은 회상. 전투·탈출·추락 없이 테라스로 복귀한다.');
  sc.at(1.1);
  for(const row of rows) sc.line({actor:row.actor, speaker:row.who, text:row.text, hold:Math.max(1.8,row.text.length*.035), gap:.3});
  sc.end=sc.T+.15;
  // Same grain/scanline renderer as the opening dream, kept below the dialogue DOM.
  sc.eff({type:'slowmo',t:0,dur:sc.end+2});
  sc.eff({type:'tvnoise',t:0,dur:sc.end+2,amount:.18,atk:.8,rel:.8});
  sc.eff({type:'tvnoise',t:.05,dur:.9,amount:.32,atk:.25,rel:.45});
  sc.eff({type:'tvnoise',t:sc.end-1.2,dur:3.2,amount:.28,atk:.7,rel:.6});
  return sc.finalize();
};
