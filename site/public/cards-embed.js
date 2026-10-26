/* Big Bend Ultra race cards (limited embed): <div id="bbu-cards"></div><script src="https://trail-roots.github.io/big-bend-ultra-map/cards-embed.js" async></script>
   Inserts an iframe of cards-embed.html (race-card previews only; every click opens trailroots.com/big-bend-ultra in a new tab) into
   #bbu-cards (or right after the script tag) and keeps its height matched to the content, so there is never an inner scrollbar. */
(function () {
  // schema.org event (Google event markup) for the HOST page: added to its <head> once, however many embeds / re-inits
  (function (ld) { if (!ld || document.querySelector('script[type="application/ld+json"][data-bbu-event]')) return; var j = document.createElement('script'); j.type = 'application/ld+json'; j.setAttribute('data-bbu-event', ''); j.text = ld.replace(/</g, '\\u003c'); (document.head || document.documentElement).appendChild(j); })(/*EVENTLD*/null);
  var s = document.currentScript; if (!s) return;
  var base = new URL('./', s.src), origin = base.origin;
  var f = document.createElement('iframe');
  f.src = base.href + 'cards-embed.html'; f.title = 'Big Bend Ultra races'; f.className = 'bbu-cards'; f.setAttribute('scrolling', 'no');
  f.style.cssText = 'display:block;width:100%;border:0;overflow:hidden;height:' + (s.dataset.height || '520') + 'px';
  var box = document.getElementById(s.dataset.target || 'bbu-cards');
  if (box) box.appendChild(f); else s.parentNode.insertBefore(f, s.nextSibling);
  addEventListener('message', function (e) {
    if (e.origin !== origin || e.source !== f.contentWindow || !e.data || e.data.type !== 'bbu-cards-height') return;
    var h = Math.ceil(+e.data.height); if (h > 0) f.style.height = h + 'px';
  });
  // width changes on the host re-flow the cards: ask the page for its new height
  var t = 0; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (f.contentWindow) f.contentWindow.postMessage({ type: 'bbu-cards-ping' }, origin); }, 80); });
})();
