window.LunaDreamBands=function(g,beat,progress,shift,direction){
 const canvas=g.canvas,w=canvas.width,h=canvas.height;
 g.save();g.resetTransform();g.globalAlpha=1;g.imageSmoothingEnabled=false;
 // Displace the already painted frame, including lettering and scanlines.
 const band=(y,height,dx)=>{
  const top=Math.round(y*h/720),rows=Math.max(1,Math.round(height*h/720));
  g.drawImage(canvas,0,top,w,rows,Math.round(dx*w/1280),top,w,rows);
 };
 band(355+beat%5,3+Math.round(3*progress),direction*shift);
 band(364,3,-direction*Math.ceil(shift*.55));
 band(115+(beat*71)%420,8+Math.round(24*progress),-direction*shift);
 g.restore();
};
