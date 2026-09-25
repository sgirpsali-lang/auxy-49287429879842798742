/* Auxy in-app external browser */
(function(){
  'use strict';
  var A=window.AUXY,C=A.core,esc=C.esc,$=C.$;
  A.mod.browser={open:open};
  function open(ctx){
    var el=ctx.el,url=ctx.query.get('url')||'';
    el.innerHTML='<div class="browser-page"><header class="browser-bar"><a class="icon-btn" href="#/">'+C.icon('chevR',{size:20})+'</a><input id="burl" class="input ltr" value="'+esc(url)+'" inputmode="url"><button class="btn primary" id="bgo">برو</button><button class="btn glass" id="bext">بیرون</button></header><iframe id="bf" title="مرورگر داخلی Auxy" referrerpolicy="no-referrer" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"></iframe></div>';
    var i=$('#burl',el),f=$('#bf',el);
    function go(){var u=i.value.trim();if(!u)return;if(!/^https?:\/\//i.test(u))u='https://'+u;i.value=u;f.src=u;}
    $('#bgo',el).onclick=go;
    $('#bext',el).onclick=function(){var u=i.value.trim();if(u)window.open(u,'_blank','noopener');};
    if(url)go();
  }
})();
