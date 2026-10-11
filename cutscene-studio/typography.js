(function(W){'use strict';
function layout(ctx,clip,width,worldScale){
 // Measure at a fixed world reference so camera zoom cannot change wrapping.
 const ratio=worldScale/100;width=Math.round(width/ratio*1e6)/1e6;worldScale=100;
 const parsed=W.StudioTags.parse(clip.text),base=.116*worldScale*(clip.fontScale??100)/100;
 const family=W.StudioModel.fonts[clip.fontFamily]?.css||W.StudioModel.fonts.system.css;
 const font=(size,bold)=>(bold?'700 ':'500 ')+size+'px '+family;
 const rows=[{glyphs:[],width:0,size:base,ascent:base*.85,descent:base*.25}];let row=rows[0];
 for(const [i,ch]of parsed.chars.entries()){
  const size=base*ch.size,style=font(size,ch.bold);ctx.font=style;
  if(ch.ch==='\n'){rows.push(row={glyphs:[],width:0,size:base,ascent:base*.85,descent:base*.25});continue;}
  const metrics=ctx.measureText(ch.ch);let advance=metrics.width;
  // Reserve the widest replacement glyph so animated noise stays inside the bubble.
  if(ch.noise||ch.censor)for(const glyph of ch.censor?'▓▒█':'░▐#?▒%01')advance=Math.max(advance,ctx.measureText(glyph).width);
  if(row.glyphs.length&&row.width+advance>width){rows.push(row={glyphs:[],width:0,size:base,ascent:base*.85,descent:base*.25});}
  row.glyphs.push({...ch,i,x:row.width,font:style,fontSize:size,width:advance});row.width+=advance;row.size=Math.max(row.size,size);row.ascent=Math.max(row.ascent,metrics.actualBoundingBoxAscent||size*.85);row.descent=Math.max(row.descent,metrics.actualBoundingBoxDescent||size*.25);
 }
 let height=0;const glyphs=[];
 for(const line of rows){const h=Math.max(line.size*1.6,line.ascent+line.descent+base*.25),baseline=height+(h-line.ascent-line.descent)/2+line.ascent;for(const ch of line.glyphs)glyphs.push({...ch,y:baseline});height+=h;}
 return {parsed,glyphs:glyphs.map(ch=>({...ch,x:ch.x*ratio,y:ch.y*ratio,width:ch.width*ratio,fontSize:ch.fontSize*ratio,font:font(ch.fontSize*ratio,ch.bold)})),height:height*ratio,rows:rows.map(row=>({...row,width:row.width*ratio}))};
}
W.StudioTypography={layout};
})(typeof window==='undefined'?globalThis:window);
