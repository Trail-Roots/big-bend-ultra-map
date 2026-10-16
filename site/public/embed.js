/* Big Bend Ultra map embed: <script src="https://trail-roots.github.io/big-bend-ultra-map/embed.js" async></script>
   Inserts an iframe of ?view=embed right where the script tag is and keeps its height matched to the page (postMessage).
   Also: keeps the map's navbar pinned to the top of the HOST window (sends the iframe's position on scroll), and makes the host's
   Print give the real 8 print pages (a cross-origin iframe prints blank, so the built page images are printed instead). */
(function () {
  var s = document.currentScript; if (!s) return;
  var base = new URL('./', s.src), origin = base.origin;
  var f = document.createElement('iframe');
  f.src = base.href + '?view=embed&h=auto'; f.title = 'Big Bend Ultra course map'; f.loading = 'lazy'; f.className = 'bbu-embed';
  f.setAttribute('allow', 'fullscreen'); f.style.cssText = 'display:block;width:100%;border:0;height:' + (s.dataset.height || '900') + 'px';
  s.parentNode.insertBefore(f, s.nextSibling);
  // lightbox open inside the iframe: hold the host scroll position (no jump when the dialog takes focus), restore it on close
  var held = null;
  function hold() { if (held) window.scrollTo(held[0], held[1]); }
  addEventListener('message', function (e) {
    if (e.origin === origin && e.source === f.contentWindow && e.data && e.data.type === 'bbu-modal') {
      if (e.data.open) { held = [scrollX, scrollY]; requestAnimationFrame(hold); setTimeout(hold, 60); } else { var h0 = held; held = null; if (h0) { window.scrollTo(h0[0], h0[1]); requestAnimationFrame(function () { window.scrollTo(h0[0], h0[1]); }); } }
      return;
    }
    if (e.origin !== origin || e.source !== f.contentWindow || !e.data || e.data.type !== 'bbu-embed-height') return;
    var h = Math.ceil(+e.data.height); if (h > 0) f.style.height = h + 'px';
    send(); pos();
  });
  // tell the page the HOST viewport size (its vh/vw limits use it); only on change, and the iframe's own height never alters it, so no feedback loop
  var sent = '';
  function send(force) { var v = innerWidth + 'x' + innerHeight; if (!f.contentWindow || (v === sent && !force)) return; sent = v; f.contentWindow.postMessage({ type: 'bbu-host-viewport', w: innerWidth, h: innerHeight }, origin); }
  // pinned navbar: the iframe's top edge relative to the host viewport (negative once scrolled past)
  var raf = 0;
  function pos() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; if (f.contentWindow) f.contentWindow.postMessage({ type: 'bbu-host-scroll', top: f.getBoundingClientRect().top }, origin); }); }
  addEventListener('scroll', pos, { passive: true });
  f.addEventListener('load', function () { send(true); pos(); });
  addEventListener('resize', function () { send(); pos(); }); addEventListener('orientationchange', function () { setTimeout(send, 100); });
  // print: the built print pages as images (preloaded), only they print; landscape / portrait per page
  var box = document.createElement('div'); box.className = 'bbu-print'; box.setAttribute('aria-hidden', 'true');
  var st = document.createElement('style');
  st.textContent = '.bbu-print{display:none}@page bbuL{size:letter landscape;margin:0}@page bbuP{size:letter portrait;margin:0}' +
    '@media print{body>*:not(.bbu-print){display:none!important}html,body{margin:0!important;padding:0!important;background:#fff!important}.bbu-print{display:block!important}' +
    '.bbu-print div{break-after:page;page-break-after:always;overflow:hidden}.bbu-print div:last-child{break-after:auto;page-break-after:auto}' +
    '.bbu-print .L{page:bbuL;width:11in;height:8.5in}.bbu-print .P{page:bbuP;width:8.5in;height:11in}.bbu-print img{display:block;width:100%;height:100%;object-fit:contain}}';
  document.head.appendChild(st);
  fetch(base.href + 'print/pages.json').then(function (r) { return r.json(); }).then(function (P) {
    P.forEach(function (p) { var d = document.createElement('div'), i = new Image(); d.className = p.o; i.alt = ''; i.decoding = 'sync'; i.src = base.href + p.src; d.appendChild(i); box.appendChild(d); });
    document.body.appendChild(box);
  }).catch(function () {});
  addEventListener('beforeprint', function () { if (box.parentNode !== document.body || box.nextSibling) document.body.appendChild(box); });
})();
