/* STREAM project page v2: small, dependency-free behaviour shared by index.html and gallery.html.
   1. Placeholder buttons (href="#") are marked "soon"; a real URL switches that off automatically.
   2. Video slots: the placeholder frame stays until the video loads; autoplay (muted, loop) only when
      in view and only without prefers-reduced-motion; a pause/play toggle is always offered.
   3. Tiles: hero montage and gallery are driven by assets/gallery/manifest.json.
      Missing entries or images that fail to load render as grey placeholders. An entry's optional "webp" is
      served to grid/montage tiles through <picture> (PNG "src" is the fallback); the lightbox always shows the PNG.
   4. BibTeX copy button.
   5. ARIA tabs (arrow keys, Home/End), shared by the gallery (datasets, #hash) and the index page's figure tabs
      ([data-tabs]); the gallery also has a <dialog> lightbox for real images.
   6. References: one collapsed <details id="refs-box"> per page. A superscript click or a #ref-N hash opens it
      first, so the browser can scroll to the entry and :target can tint it. Without JS the details still works. */
(function () {
  "use strict";

  var MANIFEST_URL = "assets/gallery/manifest.json";
  var FALLBACK = {
    tiles_per_organ: 20,
    organs: [
      { id: "brca", label: "TCGA-BRCA", images: [] },
      { id: "coadread", label: "TCGA-COADREAD", images: [] },
      { id: "spider-skin", label: "SPIDER-skin", images: [] }
    ],
    hero: { from: [["brca", 6, 0], ["coadread", 6, 0], ["spider-skin", 4, 0]] }
  };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------------------------------------------------------------- 1. placeholder buttons */
  function initTodoLinks() {
    $all("a[data-todo]").forEach(function (a) {
      var href = (a.getAttribute("href") || "").trim();
      if (href && href !== "#") {
        a.classList.remove("is-soon");
        a.removeAttribute("aria-disabled");
        a.removeAttribute("title");
        $all(".soon, .soon-sr", a).forEach(function (s) { s.remove(); });
        return;
      }
      a.classList.add("is-soon");
      a.setAttribute("aria-disabled", "true");
      a.addEventListener("click", function (e) { e.preventDefault(); });
    });
  }

  /* ---------------------------------------------------------------- 2. video slots */
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/></svg>';

  function initClips() {
    var clips = $all(".clip");
    if (!clips.length) return;
    var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (v.dataset.userPaused === "1") return;
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.35 }) : null;

    clips.forEach(function (fig) {
      var v = $("video", fig);
      if (!v) return;
      var frame = $(".clip-frame", fig);
      var toggle = null;

      function sync() {
        if (!toggle) return;
        var playing = !v.paused && !v.ended;
        toggle.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
        toggle.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
      }
      function ready() {
        if (fig.classList.contains("is-ready")) return;
        fig.classList.add("is-ready");
        toggle = el("button", "clip-toggle", { type: "button" });
        toggle.addEventListener("click", function () {
          if (v.paused) { v.dataset.userPaused = "0"; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else { v.dataset.userPaused = "1"; v.pause(); }
        });
        frame.appendChild(toggle);
        sync();
      }
      v.addEventListener("loadeddata", ready);
      v.addEventListener("loadedmetadata", function () { if (reduceMotion) ready(); });
      v.addEventListener("play", sync);
      v.addEventListener("pause", sync);
      var sources = $all("source", v);
      var last = sources[sources.length - 1];
      if (last) last.addEventListener("error", function () { v.removeAttribute("poster"); });

      if (reduceMotion) {
        v.autoplay = false;
        v.dataset.userPaused = "1";
        return;
      }
      if (io) io.observe(v);
      else { v.autoplay = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  }

  /* ---------------------------------------------------------------- 3. manifest-driven tiles */
  function loadManifest() {
    if (!window.fetch) return Promise.resolve({ m: FALLBACK, ok: false });
    return fetch(MANIFEST_URL, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (m) { return { m: m, ok: true }; })
      .catch(function () { return { m: FALLBACK, ok: false }; });
  }

  function organById(m, id) {
    var list = m.organs || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function emptyTile() {
    var d = el("div", "tile is-empty");
    d.setAttribute("aria-hidden", "true");
    return d;
  }

  function imageTile(entry, organLabel, n, lazy, asButton) {
    var t = el(asButton ? "button" : "figure", "tile");
    if (asButton) t.type = "button";
    var img = el("img");
    var host = t;
    if (entry.webp) {
      host = el("picture");
      host.appendChild(el("source", null, { type: "image/webp", srcset: entry.webp }));
      t.appendChild(host);
    }
    img.src = entry.src;
    img.alt = entry.alt || ("STREAM-generated " + organLabel + " sample " + n + (entry.caption ? ": " + entry.caption : ""));
    img.width = 256; img.height = 256;
    img.decoding = "async";
    if (lazy) img.loading = "lazy";
    host.appendChild(img);
    if (asButton) t.setAttribute("aria-label", "Open " + organLabel + " sample " + n);
    if (entry.caption && !asButton) {
      var cap = el("figcaption");
      cap.textContent = entry.caption;
      t.appendChild(cap);
    }
    return { node: t, img: img };
  }

  /* spec: [[organId, count, start], ...] or [[organId, count, [index, ...]], ...] (explicit 0-based indices);
     organs are interleaved round-robin for a mixed montage */
  function pick(m, spec) {
    var lanes = spec.map(function (s) {
      var o = organById(m, s[0]), out = [], idx = Array.isArray(s[2]) ? s[2] : null, start = idx ? 0 : (s[2] || 0);
      for (var i = 0; i < s[1]; i++) {
        var j = idx ? idx[i] : start + i;
        out.push({ organ: o, id: s[0], entry: o && o.images && j != null ? o.images[j] : null, n: j + 1 });
      }
      return out;
    });
    var res = [], more = true;
    for (var k = 0; more; k++) {
      more = false;
      lanes.forEach(function (lane) { if (k < lane.length) { res.push(lane[k]); more = true; } });
    }
    return res;
  }

  function renderTiles(host, items, noteEl) {
    host.innerHTML = "";
    var missing = 0;
    items.forEach(function (it) {
      var li = el("li");
      if (it.entry && it.entry.src) {
        var label = it.organ ? it.organ.label : it.id;
        var t = imageTile(it.entry, label, it.n, true, false);
        t.img.addEventListener("error", function () { t.node.replaceWith(emptyTile()); if (noteEl) noteEl.hidden = false; });
        li.appendChild(t.node);
      } else {
        missing++;
        li.appendChild(emptyTile());
      }
      host.appendChild(li);
    });
    if (noteEl) noteEl.hidden = missing === 0;
  }

  function initIndexTiles() {
    var montage = $("#montage");
    if (!montage) return;
    function draw(m) {
      renderTiles(montage, pick(m, (m.hero && m.hero.from) || FALLBACK.hero.from), $("#montage-note"));
    }
    draw(FALLBACK);
    loadManifest().then(function (r) { draw(r.m); });
  }

  /* ---------------------------------------------------------------- 4. BibTeX copy */
  function initCopy() {
    $all("button[data-copy]").forEach(function (btn) {
      var target = $(btn.getAttribute("data-copy"));
      var label = $("span", btn);
      var status = $("#copy-status");
      if (!target) return;
      btn.addEventListener("click", function () {
        var text = target.textContent;
        function done(ok) {
          btn.classList.toggle("is-done", ok);
          if (label) label.textContent = ok ? "Copied" : "Press Ctrl+C";
          if (status) status.textContent = ok ? "BibTeX copied to clipboard" : "Copy failed; select the text and copy it manually";
          setTimeout(function () { btn.classList.remove("is-done"); if (label) label.textContent = "Copy"; }, 1800);
        }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback(text)); });
        } else done(fallback(text));
      });
    });
    function fallback(text) {
      var ta = el("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ---------------------------------------------------------------- 5. ARIA tabs + gallery page */
  /* Wires one role="tablist": click or arrow keys select a tab, show its aria-controls panel and hide the others.
     onSelect(tab) runs after every selection. Returns { tabs, select }. */
  function initTablist(tablist, onSelect) {
    var tabs = $all('[role="tab"]', tablist);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (onSelect) onSelect(tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var j = null;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    return { tabs: tabs, select: select };
  }

  /* index page: figure tabs; the tab marked aria-selected="true" in the HTML starts selected */
  function initFigureTabs() {
    $all("[data-tabs]").forEach(function (box) {
      var list = $('[role="tablist"]', box);
      if (!list) return;
      var tl = initTablist(list, null);
      var initial = tl.tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tl.tabs[0];
      if (initial) tl.select(initial, false);
    });
  }

  function initGallery() {
    var root = $("#gallery");
    if (!root) return;
    var lb = $("#lightbox"), lbImg = $("#lb-img"), lbCap = $("#lb-cap");
    var current = { list: [], i: 0 };

    var tablist = $('[role="tablist"]', root);
    if (tablist) {
      var tl = initTablist(tablist, function (tab) {
        var id = tab.getAttribute("data-organ-tab");
        if (history.replaceState) history.replaceState(null, "", "#" + id);
      });
      var initial = tl.tabs.filter(function (t) { return "#" + t.getAttribute("data-organ-tab") === location.hash; })[0] || tl.tabs[0];
      if (initial) tl.select(initial, false);
    }

    function show(i) {
      var item = current.list[i];
      if (!item) return;
      current.i = i;
      lbImg.src = item.entry.src;
      lbImg.alt = item.alt;
      lbCap.textContent = item.label + " · sample " + item.n + (item.entry.caption ? " · " + item.entry.caption : "");
    }
    function open(list, i) {
      current.list = list;
      if (!lb || typeof lb.showModal !== "function") { window.open(list[i].entry.src, "_blank", "noopener"); return; }
      show(i);
      lb.showModal();
    }
    if (lb) {
      $("#lb-prev").addEventListener("click", function () { show((current.i - 1 + current.list.length) % current.list.length); });
      $("#lb-next").addEventListener("click", function () { show((current.i + 1) % current.list.length); });
      $("#lb-close").addEventListener("click", function () { lb.close(); });
      lb.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); $("#lb-prev").click(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); $("#lb-next").click(); }
      });
      lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
      lb.addEventListener("close", function () { lbImg.removeAttribute("src"); });
    }

    function draw(m, ok) {
      var missing = 0;
      (m.organs || []).forEach(function (o) {
        var per = o.tiles || m.tiles_per_organ || 20;
        var grid = $('[data-organ="' + o.id + '"]', root);
        if (!grid) return;
        grid.innerHTML = "";
        var list = [];
        for (var i = 0; i < per; i++) {
          var entry = o.images ? o.images[i] : null;
          var li = el("li");
          if (entry && entry.src) {
            var t = imageTile(entry, o.label, i + 1, i >= 10, true);
            var item = { entry: entry, n: i + 1, label: o.label, alt: t.img.alt };
            list.push(item);
            (function (node, item, img) {
              node.addEventListener("click", function () { open(list, list.indexOf(item)); });
              img.addEventListener("error", function () {
                node.replaceWith(emptyTile());
                var k = list.indexOf(item); if (k >= 0) list.splice(k, 1);
                var pn = $("#placeholder-note"); if (pn) pn.hidden = false;
              });
            })(t.node, item, t.img);
            li.appendChild(t.node);
          } else {
            missing++;
            li.appendChild(emptyTile());
          }
          grid.appendChild(li);
        }
        var desc = $('[data-organ-desc="' + o.id + '"]', root);
        if (desc && o.description) {
          /* keep the HTML (and its citation superscript) when the manifest text is the same sentence */
          var plain = desc.cloneNode(true);
          $all("sup.cite", plain).forEach(function (s) { s.parentNode.removeChild(s); });
          if (plain.textContent.trim() !== o.description) desc.textContent = o.description;
        }
      });
      var pnote = $("#placeholder-note");
      if (pnote) pnote.hidden = missing === 0;
      var mnote = $("#manifest-note");
      if (mnote) mnote.hidden = ok;
    }
    draw(FALLBACK, true);
    loadManifest().then(function (r) { draw(r.m, r.ok); });
  }

  /* ---------------------------------------------------------------- 6. collapsed References list */
  function initRefs() {
    var box = document.getElementById("refs-box");
    if (!box) return;
    function entry(hash) {
      if (!/^#ref-\d+$/.test(hash || "")) return null;
      var t = document.getElementById(hash.slice(1));
      return t && box.contains(t) ? t : null;
    }
    /* runs before the default jump, so the target is already visible when the browser scrolls to it */
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("sup.cite a") : null;
      if (a && entry(a.getAttribute("href"))) box.open = true;
    });
    function reveal() {
      var t = entry(location.hash);
      if (!t) return;
      box.open = true;
      t.scrollIntoView({ block: "center" });
    }
    window.addEventListener("hashchange", reveal);
    reveal();
  }

  function init() {
    initTodoLinks();
    initClips();
    initIndexTiles();
    initCopy();
    initFigureTabs();
    initGallery();
    initRefs();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
