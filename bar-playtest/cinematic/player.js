/* Playback-only adapter for Cutscene/web. Dialogue layout, tags and audio are
   extracted from its main.js; editor, timeline and simulator controls stay there. */
(function(global){
global.LunaCinemaPlayer=function(canvas,ui,sc){
  const bubble=ui.querySelector('.bubble');
  const rd=new Engine.Renderer(canvas,sc);
  rd.opts.sfxLabel=false;
  let t=0,scale=1280/Engine.VW,soundOn=true,playing=true;
  function headOf(a, cam, tt) {
    const st = sc.actorState(a, tt);
    const key = st.anim, d = Engine.ANIM[key.v];
    const h = Sprites.contentHeight(d.sheet) * st.scale;
    return rd.project(cam, st.x, st.y - h - 8);
  }

  /* ---------- 말풍선 글자 DOM ---------- */
  let curLine = null, charSpans = [], noiseChars = [], nzKey = -1, measEl = null;
  const HANGUL = /[\uAC00-\uD7A3]/;
  /* 노이즈 — 글자별 스크램블. 특수문자로만 깨지고(전각/반각), 40% 확률로 원문이 스친다.
     각 글자는 원문 폭 고정 박스(.fixw) 안에서만 교체되어 레이아웃이 흔들리지 않는다. */
  const NZ_FULL = '＃＠％＆￦＄？！';               // 전각 — 한글 폭
  const NZ_HALF = '#@$%&!?~^=/';                   // 반각 — 영숫자 폭
  function scrambleChar(nc, k) {
    const r = Engine.rnd(k * 31.7 + nc.i * 7.3);
    if (r < 0.30) return nc.orig;                  // 원문 스침 확률 (PD: 30%)
    const set = nc.hang ? NZ_FULL : NZ_HALF;
    const pick = Engine.rnd(k * 13.1 + nc.i * 3.7);
    return set[Math.floor(pick * set.length) % set.length];
  }

  function buildLineDom(l) {
    const styles = Engine.charStyles(l.text.length, l.spans);
    const visEl = bubble.querySelector('.vis');
    const ghostEl = bubble.querySelector('.ghost');
    visEl.innerHTML = '';
    charSpans = []; noiseChars = []; nzKey = -1;
    const wCache = {};
    const txtEl0 = bubble.querySelector('.txt');
    function charW(ch) {
      if (wCache[ch] == null) wCache[ch] = domW(txtEl0, ch);
      return wCache[ch];
    }
    for (let i = 0; i < l.text.length; i++) {
      const st = styles[i];
      const orig = l.text[i];
      const isSpace = /\s/.test(orig);
      let ch = orig;
      if (st.censor && !isSpace) ch = '▓▒█▒'[i % 4];   // 모자이크 블록
      const sp = document.createElement('span');
      sp.textContent = ch;
      if (st.color) sp.style.color = st.color;
      if (st.shake) {
        sp.classList.add('shk');
        sp.style.setProperty('--sha', (st.shake * 0.9) + 'px');
        sp.style.animationDelay = (-Engine.rnd(i * 5.3) * 0.4).toFixed(2) + 's';
      }
      // 노이즈·모자이크 글자는 원문 글자 폭 고정 박스 — 폴백 글리프가 커도 안 삐져나온다
      if ((st.noise || st.censor) && !isSpace) {
        sp.classList.add('fixw');
        sp.style.width = charW(orig) + 'px';
      }
      if (st.censor) sp.classList.add('cz');
      else if (st.noise) {
        sp.classList.add('nz');
        if (!isSpace) noiseChars.push({ sp: sp, orig: ch, i: i, hang: HANGUL.test(ch) });
      }
      sp.style.visibility = 'hidden';
      visEl.appendChild(sp);
      charSpans.push(sp);
    }
    ghostEl.textContent = l.text;                  // 박스 폭 = 원문 글자 폭이라 크기는 원문 기준
    /* 말풍선 폭을 명시적으로 고정한다.
       - 말풍선 내부의 shrink-to-fit은 잦은 내용 교체 때 직전 값을 재사용하는 문제가 있었고
       - canvas measureText는 픽셀 웹폰트(Galmuri)의 DOM 렌더 폭과 다르게 나온다.
       그래서 문서에 붙인 독립 nowrap 측정기(DOM)로 실제 렌더 폭을 잰다. */
    function domW(refEl, text) {
      if (!measEl) {
        measEl = document.createElement('div');
        measEl.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none';
        document.body.appendChild(measEl);
      }
      const cs2 = getComputedStyle(refEl);
      measEl.style.fontFamily = cs2.fontFamily;
      measEl.style.fontSize = cs2.fontSize;
      measEl.style.fontWeight = cs2.fontWeight;
      measEl.style.fontStyle = cs2.fontStyle;
      measEl.style.letterSpacing = cs2.letterSpacing;
      measEl.textContent = text;
      return measEl.offsetWidth;
    }
    const txtEl = bubble.querySelector('.txt');
    const natural = Math.max.apply(null, l.text.split('\n').map(function (ln) {
      return domW(txtEl, ln || ' ');
    })) + 2;
    // Size for dialogue text only; speaker identity stays in the scene data.
    const min5 = domW(txtEl, '가나다라마');
    const cb = getComputedStyle(bubble);
    const padX = parseFloat(cb.paddingLeft) + parseFloat(cb.paddingRight) +
                 parseFloat(cb.borderLeftWidth) + parseFloat(cb.borderRightWidth);
    // box-sizing:border-box라 style.width는 패딩·보더 포함 폭이다 — 내용 폭에 padX를 더해 지정
    const inner = Math.min(Math.max(natural, min5), ui.clientWidth * 0.62 - padX);
    bubble.style.width = Math.ceil(inner + padX) + 'px';
  }

  /* 화면 페이드·암전·화이트홀드의 현재 가림 정도(0~1) — 말풍선도 같이 사라지게 */
  function overlayDim() {
    let dim = 0;
    for (const f of sc.fx) {
      if (t < f.t || t > f.t + f.dur) continue;
      if (f.type === 'fade') {
        const u = (t - f.t) / f.dur;
        dim = Math.max(dim, f.dir === 'in' ? 1 - u : u);
      } else if (f.type === 'black' || f.type === 'whitehold') dim = 1;
    }
    return dim;
  }

  function paintLine(cam) {
    const l = sc.lineAt(t);
    if (!l) { bubble.classList.remove('on'); curLine = null; return; }
    bubble.style.opacity = (1 - overlayDim()).toFixed(3);
    const n = Engine.typedCount(l, t - l.t - l.lead);   // [T:초] 정지 태그 반영
    const isRadio = l.kind === 'radio', isPa = l.kind === 'pa';

    bubble.classList.add('on');
    bubble.classList.toggle('radio', isRadio);
    bubble.classList.toggle('pa', isPa);
    bubble.classList.toggle('below', !!l.below);
    bubble.classList.toggle('glitch', !!l.glitch);
    // ghost에 전체 대사(모자이크 치환 후)를 먼저 넣어 크기를 확정하고,
    // vis는 글자 단위 span — 태그 스타일(색·떨림·지지직·모자이크) 적용 + 노출 토글
    if (curLine !== l) { curLine = l; buildLineDom(l); }
    for (let i = 0; i < charSpans.length; i++)
      charSpans[i].style.visibility = i < n ? '' : 'hidden';
    const nk = Math.floor(t * 15);                 // 지지직 — 글자가 계속 깨진다
    if (nk !== nzKey) {
      nzKey = nk;
      for (const nc of noiseChars)
        nc.sp.textContent = scrambleChar(nc, nk);
    }

    // 붙일 지점 — 월드 좌표(천장 스피커 등)가 지정돼 있으면 그쪽, 아니면 화자 머리 위.
    // 무전·방송은 기기를 든 배우(sc.radioActor)에게 붙는다.
    let p = null;
    if (l.at) p = rd.project(cam, l.at[0], l.at[1]);
    else {
      const id = l.actor || ((isRadio || isPa) ? sc.radioActor : null);
      const a = id ? sc.actors[id] : null;
      const st = a ? sc.actorState(a, t) : null;
      if (a && st && st.vis) p = headOf(a, cam, t);
    }

    const tail = bubble.querySelector('.tail');
    if (p) {
      const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
      const px = p.x * scale, py = p.y * scale, pad = 6 * scale;
      let left = Math.round(px - bw / 2);
      left = Math.max(pad, Math.min(Engine.VW * scale - bw - pad, left));
      let top = Math.round(l.below ? py + 7 * scale : py - bh - 6 * scale);
      top = Math.max(pad + 10 * scale, Math.min(Engine.VH * scale - bh - pad - 10 * scale, top));
      bubble.style.left = left + 'px';
      bubble.style.top = top + 'px';
      tail.style.left = Math.max(6 * scale, Math.min(bw - 14 * scale, px - left - 4 * scale)) + 'px';
      tail.style.display = '';
    } else {
      bubble.style.left = Math.round(Engine.VW * scale / 2 - bubble.offsetWidth / 2) + 'px';
      bubble.style.top = Math.round(Engine.VH * scale * 0.6) + 'px';
      tail.style.display = 'none';
    }
  }


  function fireCues(t0, t1) {
    if (!soundOn) return;
    for (const c of sc.sfx) if (c.t > t0 && c.t <= t1) Sfx.play(c.label);
  }
  function updateLoops() {
    if (!soundOn) return;
    if (!playing) { Sfx.silence(); Sfx.setLowpass(0); return; }
    const l = sc.lineAt(t);
    Sfx.setLoops({
      ambience: true,
      // 무대의 alarm 트랙은 경광등(시각)도 겸하므로, 소리만 끄고 싶은 씬은 muteAlarm 플래그를 쓴다
      alarm: (sc.muteAlarm ? 0 : (sc.alarmGain == null ? 1 : sc.alarmGain)) * Engine.evalNum(sc.stageTracks.alarm, t, 0),
      radio: !!(l && (l.kind === 'radio' || l.kind === 'pa')),
    });
    const slow = sc.fx.some(f => f.type === 'slowmo' && t >= f.t && t <= f.t + f.dur);
    Sfx.setLowpass(slow ? 1 : 0);
  }

  /* 타이핑 블립 — 재생 중 노출 글자 수가 늘어난 프레임에만 소리를 낸다.
     대사가 바뀌거나 스크럽하면 기준만 다시 잡고 울리지 않는다.
     한 프레임에 여러 글자가 찍혀도 블립은 1개만 (기관총 방지). */
  let typeLine = null, typeCount = 0;
  function fireTyping() {
    if (!soundOn || !playing) { typeLine = null; return; }
    const l = sc.lineAt(t);
    if (!l) { typeLine = null; return; }
    const n = Engine.typedCount(l, t - l.t - l.lead);
    if (typeLine !== l) { typeLine = l; typeCount = n; return; }
    if (n > typeCount) {
      Sfx.blip({ ch: l.text[n - 1], i: n - 1, kind: l.kind, speaker: l.speaker, glitch: l.glitch });
      typeCount = n;
    }
  }


  return {renderer:rd,
    render(time,previous,enabled,volume){
      t=time;soundOn=enabled;Sfx.setVolume(volume);Sfx.setEnabled(enabled);
      if(previous!=null){fireCues(previous,t);fireTyping();updateLoops();}
      paintLine(rd.render(t));
    },
    dispose(){measEl?.remove();bubble.classList.remove('on');}
  };
};
})(window);
