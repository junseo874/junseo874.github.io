/* Day 0/3 terrace memories share disposal staging, without the full fight scene. */
window.buildTerraceMemory = function(rows,{day3=false}={}) {
  const floor = StageDisposal.FLOOR;
  // The final memory paints the chute lip over Luna during her fall.
  const stage = day3 ? { ...StageDisposal } : StageDisposal;
  const sc = new Engine.Scene(stage);
  const lunaX = day3 ? 871 : 600;
  const yunaX = lunaX - 43;
  const scale = 1.4;
  sc.actor('yuna', { name:'유나', x:yunaX, y:floor, scale, flip:true, anim:'yuna.stand', z:2 });
  sc.actor('luna', { name:'루나', x:lunaX, y:floor, scale, flip:false, anim:'luna.stand', z:1 });
  sc.alarmGain = 0;
  sc.manualMemory = true;
  sc.cam(0, {x:day3 ? 660 : 584, y:280, zoom:.75});
  // The campaign overlay handles fading, including skipping and resource loading.
  sc.cut(0, day3?'3일차 · 유나의 선택':'0일차 · 유나와의 약속', day3?'유나가 루나를 통로로 밀어 보내는 짧은 회상 후 테라스로 복귀한다.':'폐기물 처리소의 짧은 회상. 전투·탈출·추락 없이 테라스로 복귀한다.');
  sc.at(1.1);
  for(const row of rows) sc.line({actor:row.actor, speaker:row.who, text:row.text, cps:1/window.LunaOutsideStory.cps, hold:Math.max(1.8,row.text.length*.035), gap:.3});
  if (day3) {
    const t = sc.T + .15, contact = t + .34;
    const trip = contact + .35, drop = trip + .27, hidden = drop + .52;
    sc.set('yuna','anim',t,'yuna.walk');
    sc.key('yuna','x',t,yunaX);
    sc.key('yuna','x',contact,lunaX-24,'ei');
    sc.key('yuna','rot',t,0);
    sc.key('yuna','rot',contact-.13,-4);
    sc.key('yuna','rot',contact,14,'ei');
    sc.key('yuna','x',contact+.1,lunaX-17,'eo');
    sc.set('yuna','anim',contact+.1,'yuna.stand');
    sc.key('yuna','rot',contact+.1,17,'eo');
    sc.key('yuna','rot',trip+.12,0);

    // The upper body takes the shove first. The feet skid along the floor,
    // catch at the sill, then trail the torso as it tips into the opening.
    sc.key('luna','rot',contact,0);
    sc.key('luna','rot',contact+.1,19,'eo');
    sc.key('luna','rot',trip,12);
    sc.key('luna','rot',drop,49,'ei');
    sc.key('luna','rot',hidden,38,'eo');
    sc.key('luna','x',contact+.045,lunaX);
    sc.key('luna','x',trip,902,'eo');
    sc.key('luna','x',drop,906,'ei');
    sc.key('luna','x',hidden,921,'eo');
    sc.key('luna','y',trip,floor);
    sc.key('luna','y',drop,floor-13,'ei');
    sc.key('luna','y',hidden,floor+68,'ei');
    sc.set('luna','vis',hidden,false);
    sc.end = hidden + .35;

    // The painted sill progressively hides the part of Luna inside the chute.
    stage.paintForeground = (g, time) => {
      if (time < contact || time >= hidden) return;
      const k = StageDisposal.W / 720, top = floor - 350*k;
      g.save();
      g.beginPath();
      g.moveTo(665*k, top+317*k);
      g.lineTo(669*k, top+314*k);
      g.lineTo(703*k, top+318*k);
      g.lineTo(712*k, top+318*k);
      g.lineTo(712*k, StageDisposal.H);
      g.lineTo(665*k, StageDisposal.H);
      g.closePath();
      g.clip();
      StageDisposal.paint(g);
      g.restore();
    };
  } else sc.end = sc.T+.15;
  // Same grain/scanline renderer as the opening dream, kept below the dialogue DOM.
  // eff() extends the timeline, so anchor every effect to the authored ending.
  const end = sc.end;
  sc.eff({type:'slowmo',t:0,dur:end});
  sc.eff({type:'tvnoise',t:0,dur:end,amount:.25,atk:0,rel:0});
  sc.eff({type:'tvnoise',t:.05,dur:.9,amount:.32,atk:.25,rel:.45});
  sc.eff({type:'tvnoise',t:end-1.2,dur:1.2,amount:.28,atk:.7,rel:0});
  return sc.finalize();
};
