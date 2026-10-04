/* Day 0/3 terrace memories share disposal staging, without the full fight scene. */
window.buildTerraceMemory = function(rows,{day3=false}={}) {
  const sc = new Engine.Scene(StageDisposal), floor = StageDisposal.FLOOR;
  sc.actor('yuna', { name:'유나', x:566, y:floor, flip:true, anim:'yuna.stand', z:2 });
  sc.actor('luna', { name:'루나', x:600, y:floor, flip:false, anim:'luna.stand', z:1 });
  sc.stage('alarm', 0, .12); sc.alarmGain = 0;
  sc.stage('chute', 0, 1);
  sc.cam(0, {x:584, y:317, zoom:1.6});
  sc.eff({type:'lbox', t:0, dur:.7});
  // The campaign overlay handles fading, including skipping and resource loading.
  sc.cut(0, day3?'3일차 · 유나의 선택':'0일차 · 유나와의 약속', day3?'유나가 루나를 통로로 밀어 보내는 짧은 회상 후 테라스로 복귀한다.':'폐기물 처리소의 짧은 회상. 전투·탈출·추락 없이 테라스로 복귀한다.');
  sc.at(1.1);
  for(const row of rows) sc.line({actor:row.actor, speaker:row.who, text:row.text, hold:Math.max(1.8,row.text.length*.035), gap:.3});
  if(day3){const t=sc.T+.15;sc.set('yuna','anim',t,'yuna.walk');sc.key('yuna','x',t,566);sc.key('yuna','x',t+.24,588,'eo');sc.set('yuna','anim',t+.24,'yuna.stand');sc.key('luna','rot',t,0);sc.key('luna','rot',t+.45,-24,'eo');sc.key('luna','x',t,600);sc.key('luna','x',t+.6,636,'eo');sc.key('luna','y',t+.18,floor);sc.key('luna','y',t+.75,floor+96,'ei');sc.key('luna','alpha',t+.45,1);sc.key('luna','alpha',t+.78,0);sc.set('luna','vis',t+.8,false);sc.end=t+1.1;}else sc.end=sc.T+.15;
  // Same grain/scanline renderer as the opening dream, kept below the dialogue DOM.
  sc.eff({type:'slowmo',t:0,dur:sc.end+2});
  sc.eff({type:'tvnoise',t:0,dur:sc.end+2,amount:.18,atk:.8,rel:.8});
  sc.eff({type:'tvnoise',t:.05,dur:.9,amount:.32,atk:.25,rel:.45});
  sc.eff({type:'tvnoise',t:sc.end-1.2,dur:3.2,amount:.28,atk:.7,rel:.6});
  return sc.finalize();
};
