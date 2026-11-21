// 폐기물 처리장 원화의 바닥을 배우의 발 위치에 맞춘다.
window.StageDisposal = (function () {
  const W = 980, H = 460, FLOOR = 380;
  const PIT = { x0: 656, x1: 772 };
  const art = new Image();
  const artURL = new URL('../../assets/01.ArtResources/02.Environments/05.Cutscenes/01.Lab/Lab_Wastedisposalsite.png', document.currentScript.src).href;
  const background = document.createElement('canvas');
  background.width = W;
  background.height = H;
  const ctx = background.getContext('2d');
  ctx.fillStyle = '#07090d';
  ctx.fillRect(0, 0, W, H);
  const ready = new Promise(resolve => {
    art.onload = () => {
      const scale = W / art.naturalWidth;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, 0, FLOOR - 350 * scale, W, art.naturalHeight * scale);
      resolve(true);
    };
    art.onerror = () => resolve(false);
  });
  art.src = artURL;

  function paint(g) {
    g.drawImage(background, 0, 0);
  }
  return { W, H, FLOOR, PIT, paint, ready, artURL };
})();
