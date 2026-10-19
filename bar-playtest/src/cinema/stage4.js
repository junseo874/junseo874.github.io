/* 폐기물 처리 통로(수직 샤프트) — S#4(3-5) 「떨어지는 루나」 배경.
   노션 참고 이미지 기준: 양쪽 금속 벽 + 배관·패널이 있는 좁은 수직 통로.
   아래로 갈수록 밝아진다(화이트아웃과 이어짐). 임시 배경. */
window.StageShaft = (function () {

  const W = 480, H = 2600, FLOOR = 2600;      // 바닥 없음 — 계속 떨어지는 통로
  const L = 96, R = 384;                       // 통로 내벽 x

  const C = {
    wall:'#171d25', wallHi:'#222a34', deep:'#0a0e13',
    metal:'#333c47', metalHi:'#4d5a68', pipe:'#2a323d', pipeHi:'#3a4450',
    cyan:'#4fd6e0', red:'#d8434b', haz:'#8a6a24',
  };
  const r  = (g,x,y,w,h,c)   => { g.fillStyle=c; g.fillRect(x|0,y|0,w|0,h|0); };
  const ra = (g,x,y,w,h,c,a) => { g.save(); g.globalAlpha=a; r(g,x,y,w,h,c); g.restore(); };
  function rnd(s){ const x=Math.sin(s*127.1)*43758.5453; return x-Math.floor(x); }

  let staticCanvas=null;
  function buildStatic(){
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const g=c.getContext('2d'); g.imageSmoothingEnabled=false;

    // 통로 안 — 아래로 갈수록 밝아진다
    const lg=g.createLinearGradient(0,0,0,H);
    lg.addColorStop(0,'#0b0f15'); lg.addColorStop(0.72,'#141a22');
    lg.addColorStop(0.92,'#3a4a55'); lg.addColorStop(1,'#9fb6bf');
    g.fillStyle=lg; g.fillRect(L,0,R-L,H);

    // 양쪽 벽
    [[0,L,1],[R,W-R,-1]].forEach(function(side){
      const x0=side[0], w=side[1], dir=side[2];
      r(g,x0,0,w,H,C.wall);
      const inner=dir>0?x0+w-6:x0;                       // 내벽 립
      r(g,inner,0,6,H,C.metal); ra(g,inner+(dir>0?4:0),0,2,H,C.metalHi,0.5);
      for(let y=0;y<H;y+=64){                            // 패널 분할선
        r(g,x0,y,w,2,'#10151b'); ra(g,x0,y+2,w,1,C.wallHi,0.3);
      }
      const px=dir>0?x0+18:x0+w-30;                      // 세로 배관
      r(g,px,0,12,H,C.pipe); ra(g,px,0,3,H,C.pipeHi,0.5);
      for(let y=40;y<H;y+=150){ r(g,px-3,y,18,8,'#3a4450'); ra(g,px-3,y,18,2,C.metalHi,0.4); }
      const cx=dir>0?x0+44:x0+w-52;                      // 가는 케이블
      r(g,cx,0,4,H,'#20262e');
      for(let y=90;y<H;y+=300){                          // 점검 램프(꺼짐) · 표식
        r(g,dir>0?x0+w-16:x0+8,y,8,10,'#1a2028');
        ra(g,dir>0?x0+w-15:x0+9,y+2,6,4,rnd(y)>0.6?C.red:'#233038',0.55);
      }
    });

    // 통로 안쪽 디테일 — 가로 보강 링, 사다리 조각, 낙서 스텐실
    for(let y=120;y<H-200;y+=260){
      ra(g,L,y,R-L,4,'#222a34',0.8); ra(g,L,y,R-L,1,C.metalHi,0.35);
      if(rnd(y*3)>0.5){ const x=L+20+rnd(y)*(R-L-60);
        for(let k=0;k<4;k++) r(g,x,y+14+k*12,22,3,'#26303a'); }
      if(rnd(y*7)>0.65){
        const s2=1, str='B'+(4+Math.floor(y/500));
        PixFont.text(g,str,L+30+rnd(y*11)*(R-L-90),y+30,s2,'#2c3641');
      }
    }
    // 최하단 — 빛무리
    ra(g,L,H-140,R-L,140,'#dfeef2',0.5);
    ra(g,L,H-70,R-L,70,'#ffffff',0.6);
    staticCanvas=c;
  }

  /* st.speed 0~1 — 낙하 속도감. 벽을 스치는 세로 스트릭이 강해진다 */
  function streaks(g,t,st){
    const k=st.speed||0;
    if(k<=0) return;
    g.save();
    for(let i=0;i<26;i++){
      const x=L+8+rnd(i*3.7)*(R-L-16);
      const len=30+rnd(i*7.1)*90*k;
      const y=((rnd(i*1.9)*H)+t*(500+700*rnd(i*5.3))*k)%H;
      g.globalAlpha=0.05+0.16*k*rnd(i*9.7);
      g.fillStyle=i%3?'#cfe4ea':'#8fb6c8';
      g.fillRect(x,y,1+(rnd(i*4.1)<0.2?1:0),len);
    }
    g.restore();
  }

  function paint(g,t,st){
    if(!staticCanvas) buildStatic();
    r(g,0,0,W,H,C.deep);
    g.drawImage(staticCanvas,0,0);
    streaks(g,t,st);
  }

  return { W:W, H:H, FLOOR:FLOOR, paint:paint, C:C };
})();
