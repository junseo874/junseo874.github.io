/* 지하 폐기물 처리장 — S#3 「마지막 대화」 배경.
   좌측 중문(하운드가 부순다) / 중앙 폐기물 탱크·컨테이너 / 우측 바닥의 폐기물 처리 통로
   입구(해치)와 그 옆 제어 단말·폐쇄 버튼. 약한 경보음 상황이라 적색등은 은은하게만.
   축척 동일(1px ≒ 3.6cm). 임시 배경이다. */
window.StageDisposal = (function () {

  const W = 980, H = 460, FLOOR = 380, CEIL = 64;
  const PIT = { x0: 656, x1: 772 };            // 통로 입구 개구부 (약 4.2m)

  const C = {
    void:'#07090d', ceil:'#10151b', wall:'#1b2129', wallHi:'#252c35', wallLo:'#13181f',
    seam:'#0d1117', metal:'#37404b', metalHi:'#515d6b', metalLo:'#222933',
    floor:'#242b34', floorHi:'#2e3742', floorLo:'#181e26',
    red:'#d8434b', amber:'#e0a03a', cyan:'#4fd6e0', green:'#3ad07a', haz:'#8a6a24',
  };
  const r  = (g,x,y,w,h,c)   => { g.fillStyle=c; g.fillRect(x|0,y|0,w|0,h|0); };
  const ra = (g,x,y,w,h,c,a) => { g.save(); g.globalAlpha=a; r(g,x,y,w,h,c); g.restore(); };
  const T  = (g,s,x,y,sc,c)  => PixFont.text(g,s,x,y,sc,c);
  const TW = (s,sc)          => PixFont.textW(s,sc);
  function rnd(s){ const x=Math.sin(s*127.1)*43758.5453; return x-Math.floor(x); }

  function ceiling(g){
    r(g,0,0,W,CEIL,C.ceil); r(g,0,0,W,14,C.void);
    r(g,0,CEIL-4,W,4,'#1a2129'); ra(g,0,CEIL-5,W,1,C.metalHi,0.3);
    r(g,0,CEIL+6,W,16,'#252d37');                       // 대형 덕트
    ra(g,0,CEIL+6,W,2,C.metalHi,0.35); ra(g,0,CEIL+20,W,2,'#000',0.4);
    for(let x=40;x<W;x+=170){ r(g,x,CEIL+2,6,24,'#2c3540'); }
    for(let x=110;x<W;x+=280){                          // 꺼진 작업등
      r(g,x-16,CEIL+24,32,6,'#20262e'); r(g,x-13,CEIL+26,26,3,'#171c22');
    }
  }

  function wall(g){
    r(g,0,CEIL,W,FLOOR-CEIL,C.wall);
    r(g,0,CEIL,W,26,C.wallLo);
    for(let x=0;x<W;x+=58) r(g,x,CEIL,1,FLOOR-CEIL,C.seam);
    ra(g,0,CEIL+60,W,1,C.wallHi,0.35); r(g,0,CEIL+61,W,1,C.seam);
    r(g,0,238,W,4,'#20262e'); ra(g,0,238,W,1,C.metalHi,0.25);   // 배선관
    r(g,0,FLOOR-9,W,9,'#151b22'); ra(g,0,FLOOR-10,W,1,C.metalHi,0.25);
    T(g,'WASTE DISPOSAL',470-TW('WASTE DISPOSAL',2)/2,120,2,'#2c3641');
    T(g,'B4-D',470-TW('B4-D',1)/2,148,1,'#26303a');
    for(let x=200;x<W;x+=300){                          // 벽 스텐실·주의판
      r(g,x,150,26,18,'#241f14'); ra(g,x,150,26,2,C.haz,0.4);
      T(g,'!',x+11,154,1,'#7a5f28');
    }
  }

  /* 좌측 중문 — 하운드가 부순다. st.door 0→1 */
  function door(g,t,st){
    const x=52,y=232,w=104,h=FLOOR-y;
    r(g,x-18,y-26,w+36,h+26,'#12171e');                 // 리세스
    ra(g,x-18,y-26,w+36,2,C.metalHi,0.3);
    const s2=2,str='B4-D',tw=TW(str,s2);
    r(g,x+w/2-tw/2-8,y-22,tw+16,7*s2+8,'#1a2028');
    T(g,str,x+w/2-tw/2,y-19,s2,'#3d4a58');
    if(st.door<=0.5){
      r(g,x,y,w,h,'#39424e'); ra(g,x,y,w,2,'#5a6774',0.9);
      r(g,x,y,3,h,'#4a5563'); r(g,x+w-3,y,3,h,C.metalLo);
      r(g,x+w/2-1,y,2,h,'#20262e');
      for(let i=0;i<2;i++){ const dx=x+6+i*(w/2);
        r(g,dx,y+10,w/2-12,44,'#333c47'); ra(g,dx,y+10,w/2-12,1,'#525f6d',0.7);
        r(g,dx,y+60,w/2-12,34,'#2d3540'); }
      for(let i=0;i<7;i++) r(g,x+6+i*14,y+h-20,7,13,i%2?'#262e37':C.haz);
      const blink=st.alarm>0?(Math.floor(t*2)%2?1:0.3):1;
      ra(g,x+w/2-3,y+18,6,5,C.red,blink*0.9);
    }else{
      r(g,x-2,y+2,w+4,h-2,'#04070a'); ra(g,x-2,y+2,w+4,h-2,'#6a8b98',0.05);
      for(let i=0;i<22;i++){ const s3=rnd(i*3.3);
        const px=x+(i%2?3:w-15)+s3*13, py=y+4+(i/22)*(h-16);
        r(g,px,py,4+s3*10,3+s3*6,i%3?'#39424e':'#262e37');
        if(i%4===0) ra(g,px,py,4+s3*10,1,'#7d94a8',0.55); }
      r(g,x-4,y-2,w+8,5,'#48545f'); ra(g,x-4,y-2,w+8,1,'#7d94a8',0.8);
      r(g,x-4,y,6,h,'#39424e'); r(g,x+w-2,y,6,h,'#39424e');
      for(let i=0;i<5;i++){ const s3=rnd(i*17.7);
        r(g,x+w+8+s3*130,FLOOR-4-s3*3,6+s3*11,3+s3*4,'#333c47'); }
    }
  }

  function tanks(g){
    for(let i=0;i<2;i++){                                // 폐기물 탱크
      const x=236+i*122, w=86, y=FLOOR-118;
      r(g,x,y,w,118,'#2a323d'); ra(g,x,y,w,3,C.metalHi,0.4);
      r(g,x+6,y+10,w-12,3,'#38424e'); r(g,x+6,y+96,w-12,3,'#38424e');
      r(g,x+w/2-9,y-12,18,12,'#333c47');
      ra(g,x+8,y+26,w-16,26,'#1d242c',0.9);
      T(g,'W-0'+(i+1),x+w/2-TW('W-0'+(i+1),1)/2,y+34,1,'#4d5a68');
      for(let k=0;k<5;k++) r(g,x+4,y+14+k*20,2,2,'#4a5563');
      r(g,x-4,FLOOR-8,w+8,8,'#222933');
    }
    for(let i=0;i<4;i++){                                // 드럼통
      const x=478+i*26-(i%2)*8, y=FLOOR-34-(i%2)*10;
      r(g,x,y,22,34,i%2?'#39424e':'#3d3428'); ra(g,x,y,22,2,C.metalHi,0.4);
      r(g,x,y+10,22,3,'#20262e'); r(g,x,y+22,22,3,'#20262e');
    }
  }

  /* 우측 바닥 — 폐기물 처리 통로 입구. st.chute 0(폐쇄)→1(개방) */
  function pit(g,t,st){
    const x0=PIT.x0,x1=PIT.x1,w=x1-x0;
    r(g,x0-14,FLOOR-4,w+28,4,'#2c3540');                 // 테두리 턱
    ra(g,x0-14,FLOOR-4,w+28,1,C.metalHi,0.5);
    for(let i=0;i<Math.floor((w+28)/13);i++)             // 위험 스트라이프
      r(g,x0-14+i*13,FLOOR-4,7,4,i%2?'#262e37':C.haz);
    r(g,x0,FLOOR,w,60,'#04060a');                        // 수직 통로 어둠
    ra(g,x0,FLOOR,w,60,'#3ad07a',st.chute>0.5?0.04:0.0);
    for(let i=0;i<4;i++) ra(g,x0+4+i*(w/4),FLOOR+6,2,50,'#141b22',0.9);
    const open=Math.max(0,Math.min(1,st.chute));         // 해치 커버 — 양쪽으로 슬라이드
    const cover=(w/2)*(1-open);
    if(cover>1){
      [[x0,1],[x1-cover,0]].forEach(function(d){
        const cx=d[0];
        r(g,cx,FLOOR,cover,7,'#3d4652'); ra(g,cx,FLOOR,cover,2,C.metalHi,0.55);
        r(g,cx,FLOOR+7,cover,2,'#1a2028');
        for(let k=6;k<cover-4;k+=15) r(g,cx+k,FLOOR+2,2,3,'#525f6d');
      });
    }
    // 통로 상태등
    const lit=st.chute>0.5?C.green:C.red;
    r(g,x0-10,FLOOR-26,8,16,'#20262e');
    ra(g,x0-8,FLOOR-23,4,4,lit,0.9); ra(g,x0-11,FLOOR-26,10,20,lit,0.10);
    T(g,'EXIT',(x0+x1)/2-TW('EXIT',1)/2,FLOOR-16,1,'#4d5a68');
  }

  function console_(g,t,st){                             // 해킹 단말 (통로 좌측)
    const x=590,y=FLOOR-52;
    r(g,x+8,y+30,6,22,'#2c3540');
    r(g,x,y,26,32,'#1d242c'); ra(g,x,y,26,2,C.metalHi,0.5);
    const on=st.hack||0, flick=0.5+0.5*Math.sin(t*9);
    ra(g,x+3,y+4,20,16,on>0?C.cyan:'#16323a',on>0?0.25+0.3*on*flick:0.5);
    if(on>0) for(let l=0;l<3;l++) ra(g,x+5,y+6+l*5,6+((l*7+Math.floor(t*6))%11),1,'#d6f2f8',0.7*on);
    r(g,x+3,y+24,20,4,'#12171e');
  }

  function button(g,t,st){                               // 폐쇄 버튼 — 해킹 단말 바로 옆 스탠드
    const x=624,y=FLOOR-44;
    r(g,x+5,y+24,5,20,'#2c3540');                        // 지지대
    r(g,x,y,16,26,'#232b34'); ra(g,x,y,16,2,C.metalHi,0.45);
    const pressed=st.btn||0;
    ra(g,x+3,y+5,10,10,pressed>0?C.red:'#6e262c',pressed>0?1:0.9);
    ra(g,x+5,y+7,6,4,'#ff8a90',pressed>0?0.9:0.35);      // 버튼 하이라이트
    if(pressed>0) ra(g,x-3,y+1,22,18,C.red,0.3*pressed);
    r(g,x+2,y+18,12,4,'#171d24');
  }

  function floorPlate(g){
    r(g,0,FLOOR,W,H-FLOOR,C.floor);
    ra(g,0,FLOOR,W,1,C.metalHi,0.3); r(g,0,FLOOR+1,W,3,C.floorHi);
    for(let x=0;x<W;x+=46) r(g,x,FLOOR,1,H-FLOOR,C.floorLo);
    r(g,0,FLOOR+28,W,H-FLOOR-28,'#10151b');
    for(let x=30;x<W;x+=220) ra(g,x,FLOOR+8,40,2,C.haz,0.35);   // 유도선
  }

  let staticCanvas=null;
  function buildStatic(){
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
    r(g,0,0,W,H,C.void);
    ceiling(g); wall(g); tanks(g); floorPlate(g);
    staticCanvas=c;
  }

  function alarmLight(g,t,st){                           // 약한 경보 — 은은한 맥동만
    const k=st.alarm==null?0:st.alarm;
    if(k<=0) return;
    const p=0.4+0.6*Math.pow(Math.max(0,Math.sin(t*2.6)),2);
    [150,470,830].forEach(function(x){
      r(g,x-6,CEIL+30,12,5,'#242b34');
      ra(g,x-4,CEIL+35,8,5,C.red,(0.3+0.5*p)*k);
      ra(g,x-30,CEIL+38,60,90,C.red,0.05*k*p);
      ra(g,x-46,FLOOR-2,92,6,C.red,0.05*k*p);
    });
    ra(g,0,CEIL,W,FLOOR-CEIL,C.red,0.022*k*p);
  }

  function paint(g,t,st){
    if(!staticCanvas) buildStatic();
    g.drawImage(staticCanvas,0,0);
    door(g,t,st);
    pit(g,t,st);
    console_(g,t,st);
    button(g,t,st);
    alarmLight(g,t,st);
  }

  return { W:W, H:H, FLOOR:FLOOR, PIT:PIT, paint:paint, C:C };
})();
