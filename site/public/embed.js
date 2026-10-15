/* Big Bend Ultra map embed: <script src="https://trail-roots.github.io/big-bend-ultra-map/embed.js" async></script>
   Inserts an iframe of ?view=embed right where the script tag is and keeps its height matched to the page (postMessage). */
(function () {
  var s = document.currentScript; if (!s) return;
  var base = new URL('./', s.src), origin = base.origin;
  var f = document.createElement('iframe');
  f.src = base.href + '?view=embed&h=auto'; f.title = 'Big Bend Ultra course map'; f.loading = 'lazy';
  f.setAttribute('allow', 'fullscreen'); f.style.cssText = 'display:block;width:100%;border:0;height:' + (s.dataset.height || '900') + 'px';
  s.parentNode.insertBefore(f, s.nextSibling);
  addEventListener('message', function (e) {
    if (e.origin !== origin || e.source !== f.contentWindow || !e.data || e.data.type !== 'bbu-embed-height') return;
    var h = Math.ceil(+e.data.height); if (h > 0) f.style.height = h + 'px';
    send();
  });
  // tell the page the HOST viewport size (its vh/vw limits use it); only on change, and the iframe's own height never alters it, so no feedback loop
  var sent = '';
  function send(force) { var v = innerWidth + 'x' + innerHeight; if (!f.contentWindow || (v === sent && !force)) return; sent = v; f.contentWindow.postMessage({ type: 'bbu-host-viewport', w: innerWidth, h: innerHeight }, origin); }
  f.addEventListener('load', function () { send(true); });
  addEventListener('resize', function () { send(); }); addEventListener('orientationchange', function () { setTimeout(send, 100); });
})();
