/* 제공된 연구소 로비 아트 + 타격·문 파괴 레이어. 원본 이미지는 보존한다. */
window.StageLobby = (function () {
  const W=900, H=460, FLOOR=400;
  /* 5x7 픽셀 폰트 — 사인·표지판용 최소 글자 */
  const F = {
    K:'10001,10010,10100,11000,10100,10010,10001', O:'01110,10001,10001,10001,10001,10001,01110',
    R:'11110,10001,10001,11110,10100,10010,10001', A:'01110,10001,10001,11111,10001,10001,10001',
    T:'11111,00100,00100,00100,00100,00100,00100', E:'11111,10000,10000,11110,10000,10000,11111',
    C:'01110,10001,10000,10000,10000,10001,01110', H:'10001,10001,10001,11111,10001,10001,10001',
    X:'10001,10001,01010,00100,01010,10001,10001', I:'11111,00100,00100,00100,00100,00100,11111',
    B:'11110,10001,10001,11110,10001,10001,11110', L:'10000,10000,10000,10000,10000,10000,11111',
    Y:'10001,10001,01010,00100,00100,00100,00100', F:'11111,10000,10000,11110,10000,10000,10000',
    V:'10001,10001,10001,10001,10001,01010,00100', N:'10001,11001,10101,10011,10001,10001,10001',
    S:'01111,10000,10000,01110,00001,00001,11110', G:'01110,10001,10000,10111,10001,10001,01110',
    D:'11110,10001,10001,10001,10001,10001,11110', U:'10001,10001,10001,10001,10001,10001,01110',
    P:'11110,10001,10001,11110,10000,10000,10000', M:'10001,11011,10101,10001,10001,10001,10001',
    W:'10001,10001,10001,10101,10101,11011,10001',
    '1':'00100,01100,00100,00100,00100,00100,01110', '2':'01110,10001,00001,00110,01000,10000,11111',
    '3':'11110,00001,00001,01110,00001,00001,11110', '-':'00000,00000,00000,11111,00000,00000,00000',
    '.':'00000,00000,00000,00000,00000,00000,00100', ' ':'00000,00000,00000,00000,00000,00000,00000',
  };
  function text(g, str, x, y, s, col) {
    g.fillStyle = col;
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const rows = (F[ch] || F[' ']).split(',');
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++)
        if (rows[r][c] === '1') g.fillRect(cx + c * s, y + r * s, s, s);
      cx += 6 * s;
    }
  }
  const textW = (str, s) => str.length * 6 * s - s;

  // 원본 검은 여백과 상단 빨간 테두리는 배경 본체에서 분리한다.
  // 710px → 900px. 원본 y=313을 배우 발 위치 y=400에 맞춘다.
  const SCALE = W / 710, TOP = FLOOR - (313 - 62) * SCALE;
  const point = (x, y) => [x * SCALE, TOP + (y - 62) * SCALE];
  const DOOR = [[0, 186], [49, 181], [50, 294], [0, 313]].map(p => point(...p));
  const DX = 0, DY = Math.floor(point(0, 181)[1]), DW = 64, DH = FLOOR - DY;
  const C = { cyan:'#4fd6e0', red:'#d8434b', metal:'#3a4856', floor:'#242e3a' };
  const rect = (g,x,y,w,h,c,a=1) => { g.save(); g.globalAlpha=a; g.fillStyle=c; g.fillRect(x,y,w,h); g.restore(); };
  function path(g, points) {
    g.beginPath(); points.forEach((p,i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath();
  }
  function rnd(n) { const v=Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); }
  let background, doorTexture, pieces;
  function prepare() {
    if (background) return;
    const img=Sprites.get('lobby_background').img;
    background=document.createElement('canvas'); background.width=W; background.height=H;
    const g=background.getContext('2d'); g.imageSmoothingEnabled=false;
    rect(g,0,0,W,H,'#0b0e10');
    // 위·아래 검은 여백을 제외하고 원본 비율을 보존한다.
    g.drawImage(img,0,62,710,286,0,TOP,W,286*SCALE);
    g.drawImage(img,0,327,710,19,0,TOP+286*SCALE,W,H-(TOP+286*SCALE));
    rect(g,0,TOP-10,W,10,'#191e22'); rect(g,0,TOP-2,W,2,'#31393e');
    for (let x=20;x<W;x+=110) rect(g,x,TOP-9,2,7,'#080b0e');
    doorTexture=document.createElement('canvas'); doorTexture.width=DW;doorTexture.height=DH;
    const dg=doorTexture.getContext('2d');dg.imageSmoothingEnabled=false;
    dg.translate(-DX,-DY);path(dg,DOOR);dg.clip();dg.drawImage(background,0,0);
    pieces=[];
    for(let row=0;row<4;row++) for(let col=0;col<2;col++) {
      const sx=col*32, sy=Math.floor(row*DH/4), sh=Math.floor((row+1)*DH/4)-sy;
      pieces.push({sx,sy,sw:32,sh,cx:sx+16,cy:DY+sy+sh/2,seed:row*2+col+1});
    }
  }
  function warningLights(g,t,st) {
    const img=Sprites.get('lobby_background').img;
    const pulse=(0.5+0.5*Math.sin(t*5.4))*(st.alarm||0);
    // 원본 상단의 빨간 선을 잘라 천장과 문 위의 경고등으로 재배치한다.
    g.save();g.globalAlpha=.35+.65*pulse;
    for(const x of [210,420,630]) g.drawImage(img,6,5,138,1,x,TOP-6,138,2);
    g.drawImage(img,6,5,54,1,7,DY-16,54,2);g.restore();
    if(pulse>0) {
      rect(g,0,TOP,W,FLOOR-TOP,'#ce343b',.022*pulse);
      rect(g,0,DY-20,80,22,'#e34a43',.11*pulse);
      rect(g,0,FLOOR,W,15,'#c52c31',.025*pulse);
    }
  }
  function opening(g) {
    g.save();path(g,DOOR);g.clip();
    rect(g,DX,DY,DW,DH,'#070c10');
    rect(g,DX+5,DY+6,10,DH-6,'#15222a');
    rect(g,DX+18,DY+10,2,DH-10,'#35505b',.4);
    rect(g,DX,DY+25,DW,2,'#24323a');
    rect(g,DX,FLOOR-8,DW,8,'#172126');
    g.restore();
  }
  function brokenFrame(g) {
    // 불규칙한 파단면과 남은 힌지. 원본 문틀은 그대로 남는다.
    for(let i=0;i<15;i++) {
      const y=DY+6+i*(DH-12)/15, x=59+rnd(i)*4;
      rect(g,x,y,3+rnd(i+3)*4,4+rnd(i+8)*7,i%3?'#3e494f':'#64747b');
    }
    for(let i=0;i<7;i++) rect(g,i*9,DY+5-i*.13,7,2+rnd(i+16)*5,'#48575f');
  }
  function door(g,st) {
    if((st.door||0)>.5) { opening(g);brokenFrame(g);return; }
    const impact=st.doorImpact||0;
    if(impact>0) {
      opening(g);
      g.save();g.translate(impact*3.5,-impact*.8);
      g.drawImage(doorTexture,DX,DY);g.restore();
    }
  }
  function paint(g,t,st) {
    prepare();g.drawImage(background,0,0);door(g,st);warningLights(g,t,st);
    if((st.outside||0)>0) {
      const f=rnd(Math.floor(t*14));
      if(f>.45) {
        rect(g,0,DY,DW,DH,'#ffdca1',.20*(f-.45)*st.outside);
        rect(g,0,FLOOR,170,30,'#ffdca1',.07*(f-.45)*st.outside);
      }
    }
  }
  function paintForeground(g,t,st) {
    if((st.door||0)<=.5) return;
    const age=Math.max(0,st.doorAge||0);
    for(const p of pieces) {
      const vx=180+rnd(p.seed)*140, vy=-85-rnd(p.seed+10)*115, gravity=570;
      const ground=FLOOR-3+rnd(p.seed+22)*9;
      const hit=(-vy+Math.sqrt(vy*vy+2*gravity*(ground-p.cy)))/gravity;
      const fly=Math.min(age,hit), rest=Math.max(0,age-hit);
      const x=p.cx+vx*fly+vx*.13*(1-Math.exp(-rest*5))/5;
      const y=p.cy+vy*fly+gravity*fly*fly/2-(rest>0?Math.abs(Math.sin(rest*18))*7*Math.exp(-rest*7):0);
      const turn=(p.seed%2?1:-1)*(2+rnd(p.seed+30)*4)*fly;
      // 착지 후 바닥에 누운 채 남는다. 스크럽 순서에 의존하지 않는다.
      const flat=rest>0?.16+.5*Math.exp(-rest*9):.7+.3*Math.abs(Math.cos(age*7+p.seed));
      rect(g,x-14,ground+3,28,2,'#030609',.30);
      g.save();g.translate(x,y);g.scale(1,flat);g.rotate(turn);
      g.drawImage(doorTexture,p.sx,p.sy,p.sw,p.sh,-p.sw/2,-p.sh/2,p.sw,p.sh);
      g.restore();
    }
  }
  return { W,H,FLOOR,paint,paintForeground,text,textW,C,doorCenter:32 };
})();
window.PixFont = { text: StageLobby.text, textW: StageLobby.textW };
