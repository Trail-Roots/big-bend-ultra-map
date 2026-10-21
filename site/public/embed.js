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
  // lightbox open inside the iframe: the iframe takes over the WHOLE host window (fixed, top layer) while it is open. A placeholder of the
  // same height keeps the host layout exactly where it was (no shift); host scrolling is locked and the scroll position restored on close.
  var full = null, pendingH = 0;
  function openFull() {
    if (full) return; var r = f.getBoundingClientRect(), de = document.documentElement, bd = document.body;
    full = { css: f.style.cssText, x: scrollX, y: scrollY, top: r.top, ph: document.createElement('div'), hO: de.style.overflow, bO: bd.style.overflow, hS: de.style.scrollbarGutter };
    full.ph.style.cssText = 'display:block;width:100%;height:' + r.height + 'px'; full.ph.setAttribute('aria-hidden', 'true'); f.parentNode.insertBefore(full.ph, f);
    var gutter = innerWidth - de.clientWidth; if (gutter > 0) de.style.scrollbarGutter = 'stable';
    de.style.overflow = 'hidden'; bd.style.overflow = 'hidden';
    f.style.cssText = 'display:block;position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;z-index:2147483647;background:transparent';
    window.scrollTo(full.x, full.y);
    f.contentWindow.postMessage({ type: 'bbu-full', on: true, top: full.top, w: innerWidth, h: innerHeight }, origin);
  }
  function closeFull() {
    if (!full) return; var F = full; full = null; f.style.cssText = F.css;
    F.ph.parentNode && F.ph.parentNode.removeChild(F.ph); var de = document.documentElement; de.style.overflow = F.hO; document.body.style.overflow = F.bO; de.style.scrollbarGutter = F.hS;
    window.scrollTo(F.x, F.y); requestAnimationFrame(function () { window.scrollTo(F.x, F.y); pos(); });
    f.contentWindow && f.contentWindow.postMessage({ type: 'bbu-full', on: false }, origin);
  }
  addEventListener('message', function (e) {
    if (e.origin === origin && e.source === f.contentWindow && e.data && e.data.type === 'bbu-modal') { if (e.data.open) openFull(); else closeFull(); return; }
    if (e.origin !== origin || e.source !== f.contentWindow || !e.data || e.data.type !== 'bbu-embed-height') return;
    var h = Math.ceil(+e.data.height); if (h > 0) { pendingH = h; if (full) return; f.style.height = h + 'px'; }
    send(); pos();
  });
  // tell the page the HOST viewport size (its vh/vw limits use it); only on change, and the iframe's own height never alters it, so no feedback loop
  var sent = '';
  function send(force) { if (full && f.contentWindow) { f.contentWindow.postMessage({ type: 'bbu-host-viewport', w: innerWidth, h: innerHeight }, origin); return; } var v = innerWidth + 'x' + innerHeight; if (!f.contentWindow || (v === sent && !force)) return; sent = v; f.contentWindow.postMessage({ type: 'bbu-host-viewport', w: innerWidth, h: innerHeight }, origin); }
  // pinned navbar: the iframe's top edge relative to the host viewport (negative once scrolled past)
  var raf = 0;
  function pos() { if (raf || full) return; raf = requestAnimationFrame(function () { raf = 0; if (f.contentWindow) f.contentWindow.postMessage({ type: 'bbu-host-scroll', top: f.getBoundingClientRect().top }, origin); }); }
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
