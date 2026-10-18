/* Authored eleven-piece exterior textbox; retain the source art unchanged. */
(function(W){
'use strict';
const sizes=[[66,67],[1144,67],[67,67],[66,117],[1144,117],[67,117],[66,67],[478,67],[145,121],[525,67],[67,67]];
function html(){
 // Each export has a one-pixel transparent gutter. Crop only that gutter
 // using the SVG viewport, so stretched edges meet without transparent seams.
 return '<span class="exterior-textbox-skin" aria-hidden="true">'+sizes.map(([w,h],i)=>
  '<svg class="textbox-piece piece-'+(i+1)+'" viewBox="1 1 '+(w-2)+' '+(h-2)+'" preserveAspectRatio="none" focusable="false"><image href="assets/exterior-textbox/GRD_textbox_'+(i+1)+'.png" width="'+w+'" height="'+h+'"/></svg>'
 ).join('')+'</span>';
}
W.LunaExteriorTextbox={html};
})(window);
