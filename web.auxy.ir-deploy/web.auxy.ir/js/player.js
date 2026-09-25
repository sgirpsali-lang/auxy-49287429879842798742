/* Auxy web: player. Order before every movie: VAST ad (if configured) -> own ad -> movie.
   Set window.AUXY_CFG.vastTag in home/index.html once a VAST tag is available. */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, $ = C.$;
  var P = A.mod.player = { open: open };
  var CFG = window.AUXY_CFG || {};

  /* ---------- ads ---------- */
  function vastAd(stage) {   // untested until a real tag exists; fails safe (returns false)
    if (!CFG.vastTag) return Promise.resolve(null);
    return C.extScript('https://imasdk.googleapis.com/js/sdkloader/ima3.js').then(function () {
      return new Promise(function (res) {
        var g = window.google, box = C.el('<div class="ad vast"><div class="vast-c"></div><video class="vast-v" playsinline></video></div>');
        stage.appendChild(box);
        var vid = $('.vast-v', box), adc = new g.ima.AdDisplayContainer($('.vast-c', box), vid); adc.initialize();
        var loader = new g.ima.AdsLoader(adc), mgr = null, done = false;
        function fin(ok) { if (done) return; done = true; try { mgr && mgr.destroy(); } catch (e) { } box.remove(); res(ok); }
        loader.addEventListener(g.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, function (e) {
          mgr = e.getAdsManager(vid);
          mgr.addEventListener(g.ima.AdErrorEvent.Type.AD_ERROR, function () { fin(false); });
          ['COMPLETE', 'SKIPPED', 'ALL_ADS_COMPLETED'].forEach(function (t) { mgr.addEventListener(g.ima.AdEvent.Type[t], function () { fin(true); }); });
          try { mgr.init(innerWidth, innerHeight, g.ima.ViewMode.FULLSCREEN); mgr.start(); } catch (err) { fin(false); }
        });
        loader.addEventListener(g.ima.AdErrorEvent.Type.AD_ERROR, function () { fin(false); });
        var rq = new g.ima.AdsRequest(); rq.adTagUrl = CFG.vastTag; rq.linearAdSlotWidth = innerWidth; rq.linearAdSlotHeight = innerHeight;
        loader.requestAds(rq);
        setTimeout(function () { if (!mgr) fin(false); }, 8000);   // one attempt, never a retry loop
      });
    }).catch(function () { return false; });
  }

  async function ownAd(stage, m, onAbort) {
    var r = await sb.from('ads').select('*').eq('active', true);
    var list = r.data || []; if (!list.length) return null;
    var ad = C.pick(list), isVid = ad.kind === 'video';
    return new Promise(function (res) {
      var w = C.el('<div class="ad"><div class="ad-media"></div><div class="ad-top"><span class="ad-tag">تبلیغ</span><span class="ad-count"></span></div>' +
        '<div class="ad-act"></div></div>');
      stage.appendChild(w);
      var media = $('.ad-media', w), count = $('.ad-count', w), act = $('.ad-act', w), done = false, v = null, tm = null;
      function fin(completed) {
        if (done) return; done = true; clearTimeout(tm); clearInterval(tm);
        if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
        w.remove();
        sb.from('ad_views').insert({ ad_id: ad.id, user_id: C.uid, movie_id: m.id, completed: !!completed }).then(function () { }, function () { });
        res(true);
      }
      onAbort(function () { done = true; clearInterval(tm); w.remove(); res(false); });
      if (ad.link_url && /^https:\/\//i.test(ad.link_url)) act.innerHTML = '<a class="btn glass" target="_blank" rel="noopener noreferrer sponsored" href="' + esc(ad.link_url) + '">بیشتر بدانید</a>';
      var skip = C.el('<button type="button" class="btn glass ad-skip" disabled></button>'); act.appendChild(skip);
      skip.addEventListener('click', function () { if (!skip.disabled) fin(false); });
      if (isVid) {
        v = document.createElement('video'); v.className = 'ad-v'; v.playsInline = true; v.autoplay = true; v.preload = 'auto'; v.src = ad.media_url; media.appendChild(v);
        var started = false;
        var bail = setTimeout(function () { if (!started) fin(false); }, 7000);   // ad failed to load -> just play the movie
        v.addEventListener('playing', function () { started = true; clearTimeout(bail); });
        v.addEventListener('error', function () { clearTimeout(bail); if (!done) { done = true; w.remove(); res(null); } });
        v.addEventListener('ended', function () { fin(true); });
        v.play().catch(function () { v.muted = true; v.play().catch(function () { }); });
        v.addEventListener('timeupdate', function () {
          var left = Math.max(0, Math.ceil((v.duration || 0) - v.currentTime));
          if (ad.skip_after_seconds != null) {
            var t = Math.ceil(ad.skip_after_seconds - v.currentTime);
            if (t > 0) { skip.disabled = true; skip.textContent = 'رد کردن تا ' + C.fa(t) + ' ثانیه'; }
            else { skip.disabled = false; skip.innerHTML = 'رد کردن ' + C.icon('x', { size: 16 }); }
          } else { skip.hidden = true; }
          count.textContent = left ? C.fa(left) + ' ثانیه تا شروع فیلم' : '';
        });
      } else {
        media.innerHTML = '<img class="ad-i" src="' + esc(ad.media_url) + '" alt="' + esc(ad.title) + '">';
        var left = ad.duration_seconds || 5;
        (function tick() {
          if (left > 0) { skip.disabled = true; skip.textContent = 'ادامه تا ' + C.fa(left) + ' ثانیه'; count.textContent = C.fa(left) + ' ثانیه تا شروع فیلم'; left--; tm = setTimeout(tick, 1000); }
          else { skip.disabled = false; skip.innerHTML = 'ادامه به فیلم ' + C.icon('x', { size: 16 }); count.textContent = ''; }
        })();
        skip.addEventListener('click', function () { fin(true); });
      }
    });
  }

  /* ---------- player ---------- */
  async function open(m, o) {
    o = o || {};
    if (P.busy) return; P.busy = true;
    var root = C.el('<div class="pl" role="dialog" aria-modal="true" aria-label="پخش ' + esc(m.title) + '"><div class="pl-stage"></div></div>');
    document.body.appendChild(root); document.body.classList.add('no-scroll');
    var stage = $('.pl-stage', root), dead = false, cleans = [], aborts = [];
    var addClean = function (f) { cleans.push(f); };
    function close() {
      if (dead) return; dead = true;
      aborts.forEach(function (f) { try { f(); } catch (e) { } }); cleans.forEach(function (f) { try { f(); } catch (e) { } });
      root.classList.add('out'); setTimeout(function () { root.remove(); }, 200);
      document.body.classList.remove('no-scroll'); P.busy = false;
      if (document.fullscreenElement) document.exitFullscreen().catch(function () { });
      document.removeEventListener('keydown', onKey);
    }
    var onKey = function (e) { if (e.key === 'Escape' && !document.fullscreenElement && !dead) close(); };
    document.addEventListener('keydown', onKey);
    try { if (root.requestFullscreen) root.requestFullscreen().catch(function () { }); } catch (e) { }
    stage.innerHTML = '<div class="pl-wait"><span class="spin"></span></div><button class="pl-x icon-btn" aria-label="بستن">' + C.icon('x', { size: 22 }) + '</button>';
    $('.pl-x', stage).addEventListener('click', close);

    var shown = await vastAd(stage);
    if (dead) return;
    if (!shown) shown = await ownAd(stage, m, function (f) { aborts.push(f); });
    if (dead) return;
    var wait = $('.pl-wait', stage); if (wait) wait.remove();
    var x = $('.pl-x', stage); if (x) x.remove();
    movie(stage, m, o, close, addClean);
  }

  function movie(stage, m, o, close, addClean) {
    stage.insertAdjacentHTML('beforeend',
      '<video class="pl-v" playsinline preload="' + (C.settings.saver ? 'metadata' : 'auto') + '"></video>' +
      '<div class="pl-top"><button class="icon-btn" data-c="back" aria-label="بازگشت">' + C.icon('chevR', { size: 24 }) + '</button><b>' + esc(m.title) + '</b></div>' +
      '<button class="pl-big" data-c="play" aria-label="پخش">' + C.icon('play', { size: 46, fill: true }) + '</button>' +
      '<div class="pl-msg" hidden></div>' +
      '<div class="pl-bar"><div class="seek" role="slider" aria-label="جلو و عقب"><i class="buf"></i><i class="cur"></i><b class="knob"></b></div>' +
      '<div class="pl-row"><button class="icon-btn" data-c="play" aria-label="پخش/توقف">' + C.icon('play', { size: 24, fill: true }) + '</button>' +
      '<span class="pl-time">۰۰:۰۰ / ۰۰:۰۰</span><span class="grow"></span>' +
      '<button class="icon-btn" data-c="mute" aria-label="صدا">' + C.icon('volume', { size: 22 }) + '</button><input class="vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="میزان صدا">' +
      '<button class="btn glass sm" data-c="speed">1x</button><button class="icon-btn" data-c="pip" aria-label="تصویر در تصویر">' + C.icon('pip', { size: 22 }) + '</button>' +
      '<button class="icon-btn" data-c="full" aria-label="تمام‌صفحه">' + C.icon('full', { size: 22 }) + '</button></div></div>');
    var root = stage.parentNode, v = $('.pl-v', stage), msg = $('.pl-msg', stage), seek = $('.seek', stage), cur = $('.cur', seek), buf = $('.buf', seek), knob = $('.knob', seek);
    var timeEl = $('.pl-time', stage), vol = $('.vol', stage), hls = null, lastSave = 0, viewed = false, idleT, speeds = [1, 1.25, 1.5, 2, .75], si = 0;
    function say(t) { msg.textContent = t; msg.hidden = !t; }
    function setIcons() {
      var p = v.paused;
      C.$$('[data-c=play]', stage).forEach(function (b) { b.innerHTML = C.icon(p ? 'play' : 'pause', { size: b.classList.contains('pl-big') ? 46 : 24, fill: true }); });
      stage.classList.toggle('paused', p);
    }
    function ui() {
      var d = v.duration || 0, t = v.currentTime || 0, r = d ? t / d : 0;
      cur.style.width = (r * 100) + '%'; knob.style.insetInlineStart = (r * 100) + '%';
      if (v.buffered.length) buf.style.width = (v.buffered.end(v.buffered.length - 1) / (d || 1) * 100) + '%';
      timeEl.textContent = C.dur(t) + ' / ' + C.dur(d);
    }
    function save(force) {
      var d = Math.floor(v.duration || 0), t = Math.floor(v.currentTime || 0);
      if (!d || (!force && Date.now() - lastSave < 10000)) return; lastSave = Date.now();
      sb.from('watch_progress').upsert({ user_id: C.uid, movie_id: m.id, position_seconds: t, duration_seconds: d, updated_at: new Date().toISOString() }, { onConflict: 'user_id,movie_id' }).then(function () { }, function () { });
      if (A.mod.browse && A.mod.browse.setProgress) A.mod.browse.setProgress(m.id, t, d);
    }
    function toggle() { v.paused ? v.play().catch(function () { say('پخش نشد. دوباره امتحان کنید.'); }) : v.pause(); }
    function jump(s) { v.currentTime = Math.max(0, Math.min((v.duration || 0) - .1, v.currentTime + s)); }
    function idle() { stage.classList.remove('idle'); clearTimeout(idleT); if (!v.paused) idleT = setTimeout(function () { stage.classList.add('idle'); }, 2600); }
    function full() { document.fullscreenElement ? document.exitFullscreen().catch(function () { }) : root.requestFullscreen && root.requestFullscreen().catch(function () { }); }

    v.addEventListener('loadedmetadata', function () {
      var r = o.resume;
      if (r && r.position_seconds > 20 && r.position_seconds < v.duration - 30) { v.currentTime = r.position_seconds; C.toast('ادامه از ' + C.dur(r.position_seconds)); }
      ui();
    });
    v.addEventListener('timeupdate', function () { ui(); save(false); });
    v.addEventListener('progress', ui);
    v.addEventListener('play', function () { setIcons(); idle(); if (!viewed) { viewed = true; sb.rpc('increment_movie_view', { p_id: m.id }).then(function () { }, function () { }); } });
    v.addEventListener('pause', function () { setIcons(); idle(); save(true); });
    v.addEventListener('waiting', function () { say('در حال بارگذاری…'); });
    v.addEventListener('playing', function () { say(''); });
    v.addEventListener('error', function () { say('این فیلم پخش نشد. اتصال را بررسی کنید.'); });
    v.addEventListener('ended', function () { save(true); if (document.fullscreenElement) document.exitFullscreen().catch(function () { }); say('پایان فیلم'); });
    v.addEventListener('volumechange', function () { $('[data-c=mute]', stage).innerHTML = C.icon(v.muted || v.volume === 0 ? 'mute' : 'volume', { size: 22 }); });
    vol.addEventListener('input', function () { v.volume = Number(vol.value); v.muted = v.volume === 0; });

    var ck = 0;
    stage.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (b) {
        var c = b.getAttribute('data-c');
        if (c === 'back') close(); else if (c === 'play') toggle(); else if (c === 'mute') v.muted = !v.muted;
        else if (c === 'speed') { si = (si + 1) % speeds.length; v.playbackRate = speeds[si]; b.textContent = speeds[si] + 'x'; }
        else if (c === 'pip') { (document.pictureInPictureElement ? document.exitPictureInPicture() : (v.requestPictureInPicture ? v.requestPictureInPicture() : Promise.reject())).catch(function () { C.toast('این مرورگر تصویر در تصویر را پشتیبانی نمی‌کند'); }); }
        else if (c === 'full') full();
        return;
      }
      if (e.target === v) { if (ck) { clearTimeout(ck); ck = 0; full(); } else ck = setTimeout(function () { ck = 0; toggle(); }, 230); }
    });
    var seeking = false;
    function seekTo(e) { var r = seek.getBoundingClientRect(); var p = Math.max(0, Math.min(1, (r.right - e.clientX) / r.width)); if (v.duration) v.currentTime = p * v.duration; ui(); }
    seek.addEventListener('pointerdown', function (e) { seeking = true; seek.setPointerCapture(e.pointerId); seekTo(e); });
    seek.addEventListener('pointermove', function (e) { if (seeking) seekTo(e); });
    seek.addEventListener('pointerup', function () { seeking = false; });
    stage.addEventListener('pointermove', idle); stage.addEventListener('touchstart', idle, { passive: true });
    var keys = function (e) {
      if (/input|textarea|select/i.test(e.target.tagName) && e.target.type !== 'range') return;
      var k = e.key;
      if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); } else if (k === 'ArrowLeft' || k === 'l') jump(10); else if (k === 'ArrowRight' || k === 'j') jump(-10);
      else if (k === 'ArrowUp') { e.preventDefault(); v.volume = Math.min(1, v.volume + .1); vol.value = v.volume; } else if (k === 'ArrowDown') { e.preventDefault(); v.volume = Math.max(0, v.volume - .1); vol.value = v.volume; }
      else if (k === 'm') v.muted = !v.muted; else if (k === 'f') full();
      idle();
    };
    document.addEventListener('keydown', keys);
    var vis = function () { if (document.hidden) { v.pause(); save(true); } };
    document.addEventListener('visibilitychange', vis);
    addClean(function () { save(true); document.removeEventListener('keydown', keys); document.removeEventListener('visibilitychange', vis); clearTimeout(idleT); v.pause(); v.removeAttribute('src'); v.load(); if (hls) hls.destroy(); });

    var url = m.video_url;
    if (/\.m3u8(\?|$)/i.test(url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
      C.extScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js').then(function () {
        if (window.Hls && Hls.isSupported()) { hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: C.settings.saver ? 10 : 30 }); hls.loadSource(url); hls.attachMedia(v); v.play().catch(function () { }); }
        else say('این مرورگر پخش این فرمت را پشتیبانی نمی‌کند.');
      }, function () { say('بارگذاری پخش‌کننده انجام نشد.'); });
    } else { v.src = url; v.play().catch(function () { setIcons(); }); }
    setIcons(); idle();
  }
})();
