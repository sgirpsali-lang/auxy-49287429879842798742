/* Auxy web: scroll feed (vertical, autoplay) + post composer */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, $ = C.$;
  A.mod.feed = { open: open };
  A.feed = { compose: compose };
  var PAGE = 8;

  /* ---------- composer ---------- */
  function videoInfo(file) {
    return new Promise(function (res) {
      var v = document.createElement('video'), u = URL.createObjectURL(file); v.preload = 'metadata'; v.muted = true; v.playsInline = true;
      v.onloadeddata = function () {
        var d = v.duration || 0; v.currentTime = Math.min(1, d / 2);
        v.onseeked = function () {
          try {
            var cv = document.createElement('canvas'), r = Math.min(1, 540 / Math.max(v.videoWidth, v.videoHeight));
            cv.width = Math.round(v.videoWidth * r); cv.height = Math.round(v.videoHeight * r); cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
            cv.toBlob(function (b) { URL.revokeObjectURL(u); res({ duration: d, poster: b }); }, 'image/jpeg', .8);
          } catch (e) { URL.revokeObjectURL(u); res({ duration: d, poster: null }); }
        };
      };
      v.onerror = function () { URL.revokeObjectURL(u); res({ duration: 0, poster: null }); }; v.src = u;
    });
  }
  function compose(onDone) {
    var file = null, prevUrl = null, ctl = {}, busy = false;
    var m = C.modal({
      title: 'پست جدید', wide: true,
      body: '<label class="drop" id="pdrop"><input type="file" id="pfile" accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,image/gif" hidden>' +
        '<div class="drop-in">' + C.icon('upload', { size: 30 }) + '<b>ویدیو یا عکس انتخاب کن</b><small>ویدیو تا ۱۰۰ مگابایت و ۱۰ دقیقه · یا فقط متن بنویس</small></div><div class="drop-prev" hidden></div></label>' +
        '<label class="field"><span>توضیح</span><textarea class="input" id="pcap" rows="4" maxlength="2200" placeholder="چیزی بنویس…"></textarea></label>' +
        '<div class="prog" id="pprog" hidden><i></i><span></span></div><div class="form-err" id="perr" hidden></div>',
      onClose: function () { if (prevUrl) URL.revokeObjectURL(prevUrl); if (busy && ctl.abort) ctl.abort(); },
      actions: [{ label: 'انصراف', onClick: function (a) { a.close(); } }, { label: 'انتشار', kind: 'primary', onClick: function (a, b) { publish(a, b); } }]
    });
    var el = m.el, fi = $('#pfile', el), prev = $('.drop-prev', el), err = $('#perr', el), prog = $('#pprog', el);
    function bad(t) { err.textContent = t; err.hidden = false; }
    fi.addEventListener('change', function () {
      var f = fi.files[0]; if (!f) return; err.hidden = true;
      var isV = /^video\//.test(f.type), isI = /^image\//.test(f.type);
      if (!isV && !isI) return bad('فقط ویدیو یا عکس.');
      if (isV && f.size > 100 * 1048576) return bad('حجم ویدیو نباید بیشتر از ۱۰۰ مگابایت باشد.');
      file = f; if (prevUrl) URL.revokeObjectURL(prevUrl); prevUrl = URL.createObjectURL(f);
      prev.hidden = false; $('.drop-in', el).hidden = true;
      prev.innerHTML = isV ? '<video src="' + prevUrl + '" muted playsinline controls></video>' : '<img src="' + prevUrl + '" alt="">';
    });
    async function publish(a, btn) {
      var cap = $('#pcap', el).value.trim(); err.hidden = true;
      if (!file && !cap) return bad('یک فایل انتخاب کن یا متنی بنویس.');
      busy = true; btn.disabled = true; prog.hidden = false;
      var bar = $('i', prog), lab = $('span', prog);
      try {
        var kind = 'text', url = null, poster = null;
        if (file) {
          kind = /^video\//.test(file.type) ? 'video' : 'image';
          var up = file;
          if (kind === 'image') up = await C.compress(file, 1600, .85);
          else {
            lab.textContent = 'بررسی ویدیو…';
            var info = await videoInfo(file);
            if (info.duration > 600) throw new Error('ویدیو نباید بیشتر از ۱۰ دقیقه باشد.');
            if (info.poster) { try { poster = (await C.upload('posts', new File([info.poster], 'poster.jpg', { type: 'image/jpeg' }))).url; } catch (e) { } }
          }
          lab.textContent = 'در حال آپلود…';
          url = (await C.upload('posts', up, { ctl: ctl, onProgress: function (p) { bar.style.width = (p * 100) + '%'; lab.textContent = 'آپلود ' + C.fa(Math.round(p * 100)) + '٪'; } })).url;
        }
        var r = await sb.from('posts').insert({ user_id: C.uid, kind: kind, caption: cap || null, media_url: url, poster_url: poster }).select('*').single();
        if (r.error) throw r.error;
        busy = false; C.toast('پست منتشر شد'); a.close(); if (onDone) onDone(r.data); C.emit('post', r.data);
      } catch (e) {
        busy = false; btn.disabled = false; prog.hidden = true; bar.style.width = '0';
        if (e.message !== 'abort') bad(/ویدیو نباید/.test(e.message) ? e.message : C.err(e));
      }
    }
  }

  /* ---------- feed ---------- */
  async function open(ctx) {
    var el = ctx.el, st = { tab: 'foryou', posts: [], liked: new Set(), saved: new Set(), done: false, loading: false, cursor: null, muted: !!C.settings.muteFeed, viewed: {} };
    await C.loadFollowing();
    el.innerHTML = '<div class="feed"><div class="feed-tabs" role="tablist"><button role="tab" data-t="foryou" class="on">برای شما</button><button role="tab" data-t="following">دنبال‌شده‌ها</button></div>' +
      '<button class="feed-add" aria-label="پست جدید">' + C.icon('plus', { size: 26, sw: 2.6 }) + '</button><div class="feed-scroll" tabindex="0"></div></div>';
    var root = $('.feed', el), sc = $('.feed-scroll', el), ioPlay, ioNear, drawer = null, dead = false;

    function postHtml(p) {
      var u = C.user(p.user_id), mine = p.user_id === C.uid, fol = C.following.has(p.user_id), liked = st.liked.has(p.id), saved = st.saved.has(p.id);
      var media = p.kind === 'video' ? '<video class="pm" data-src="' + esc(p.media_url) + '" poster="' + esc(p.poster_url || '') + '" loop playsinline muted preload="none"></video>' +
        '<button class="pm-snd icon-btn" data-a="snd" aria-label="صدا">' + C.icon(st.muted ? 'mute' : 'volume', { size: 20 }) + '</button><div class="pm-play">' + C.icon('play', { size: 56, fill: true }) + '</div>'
        : p.kind === 'image' ? '<img class="pm" src="' + esc(p.media_url) + '" alt="" loading="lazy" decoding="async">'
        : '<div class="pm-text"><p dir="auto">' + esc(p.caption) + '</p></div>';
      return '<article class="post" data-id="' + p.id + '" data-uid="' + p.user_id + '"><div class="post-media">' + media + '<div class="burst" aria-hidden="true">' + C.icon('heart', { size: 96, fill: true }) + '</div></div>' +
        '<div class="post-info"><div class="post-au"><a href="#/u/' + esc(u.username) + '">' + C.avatar(u, 40) + '<b>@' + esc(u.username) + '</b>' + C.badge(u) + '</a>' +
        (!mine ? '<button class="btn glass sm" data-a="follow" data-u="' + p.user_id + '">' + (fol ? 'دنبال می‌کنی' : 'دنبال کن') + '</button>' : '') + '</div>' +
        (p.kind !== 'text' && p.caption ? '<p class="post-cap" data-a="cap" dir="auto">' + esc(p.caption) + '</p>' : '') + '<time>' + C.ago(p.created_at) + '</time></div>' +
        '<div class="post-rail"><button data-a="like" class="' + (liked ? 'on' : '') + '" aria-label="پسندیدن">' + C.icon('heart', { size: 30, fill: liked }) + '<span>' + C.compact(p.likes_count) + '</span></button>' +
        '<button data-a="cm" aria-label="نظرها">' + C.icon('comment', { size: 29 }) + '<span data-cc>' + C.compact(p.comments_count) + '</span></button>' +
        '<button data-a="save" class="' + (saved ? 'on' : '') + '" aria-label="ذخیره">' + C.icon('list', { size: 28, fill: saved }) + '<span>ذخیره</span></button>' +
        '<button data-a="share" aria-label="اشتراک‌گذاری">' + C.icon('share', { size: 28 }) + '<span>ارسال</span></button>' +
        '<button data-a="more" aria-label="بیشتر">' + C.icon('more', { size: 26 }) + '</button></div></article>';
    }
    function empty() {
      return '<div class="post empty-post">' + C.empty(st.tab === 'following' ? 'users' : 'scroll', st.tab === 'following' ? 'هنوز کسی را دنبال نکرده‌ای' : 'هنوز پستی نیست', st.tab === 'following' ? 'از «برای شما» چند نفر را دنبال کن.' : 'اولین پست را تو بگذار.', '<button class="btn primary" data-a="new">پست جدید</button>') + '</div>';
    }
    function watch(nodes) { nodes.forEach(function (n) { ioPlay.observe(n); ioNear.observe(n); }); }
    async function more(first) {
      if (st.loading || st.done) return; st.loading = true;
      var q = sb.from('posts').select('*').order('created_at', { ascending: false }).limit(PAGE); if (st.cursor) q = q.lt('created_at', st.cursor);
      if (st.tab === 'following') {
        var f = Array.from(C.following);
        if (!f.length) { st.done = true; st.loading = false; if (first) sc.innerHTML = empty(); return; }
        q = q.in('user_id', f);
      }
      var r = await q, rows = r.data || []; if (dead) return;
      if (rows.length < PAGE) st.done = true;
      if (rows.length) st.cursor = rows[rows.length - 1].created_at;
      await C.hydrate(rows);
      var ids = rows.map(function (x) { return x.id; });
      if (ids.length) {
        var lr = await Promise.all([sb.from('post_likes').select('post_id').eq('user_id', C.uid).in('post_id', ids), sb.from('post_saves').select('post_id').eq('user_id', C.uid).in('post_id', ids)]);
        (lr[0].data || []).forEach(function (x) { st.liked.add(x.post_id); }); (lr[1].data || []).forEach(function (x) { st.saved.add(x.post_id); });
      }
      var seen = {}; st.posts.forEach(function (p) { seen[p.id] = 1; }); rows = rows.filter(function (p) { return !seen[p.id]; });
      st.posts = st.posts.concat(rows); st.loading = false;
      if (first && !st.posts.length) { sc.innerHTML = empty(); return; }
      if (first) sc.innerHTML = '';
      var tmp = document.createElement('div'); tmp.innerHTML = rows.map(postHtml).join('');
      var nodes = Array.prototype.slice.call(tmp.children); nodes.forEach(function (n) { sc.appendChild(n); }); watch(nodes);
    }
    ioNear = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var v = e.target.querySelector('video'); if (v && e.isIntersecting && !v.src && v.dataset.src) v.src = v.dataset.src; });
    }, { root: sc, rootMargin: '150% 0px' });
    ioPlay = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var art = e.target, v = art.querySelector('video'), id = art.getAttribute('data-id');
        if (e.isIntersecting) {
          if (art === sc.lastElementChild || art.nextElementSibling === sc.lastElementChild || art.nextElementSibling && art.nextElementSibling.nextElementSibling === sc.lastElementChild) more(false);
          if (v) {
            if (!v.src && v.dataset.src) v.src = v.dataset.src;
            if (C.settings.autoplayFeed && !C.settings.saver) { v.muted = st.muted; v.play().then(function () { art.classList.remove('paused'); }, function () { v.muted = true; v.play().catch(function () { }); }); }
            else art.classList.add('paused');
          }
          if (!st.viewed[id]) art._vt = setTimeout(function () { st.viewed[id] = 1; sb.rpc('increment_post_view', { p_id: id }).then(function () { }, function () { }); }, 2000);
        } else { clearTimeout(art._vt); if (v) v.pause(); }
      });
    }, { root: sc, threshold: .65 });

    async function start(deepId) {
      st.posts = []; st.done = false; st.cursor = null; sc.innerHTML = '<div class="post"><span class="spin"></span></div>';
      if (deepId) {
        var d = await sb.from('posts').select('*').eq('id', deepId).maybeSingle();
        if (d.data) {
          await C.hydrate([d.data]);
          var l = await Promise.all([sb.from('post_likes').select('post_id').eq('user_id', C.uid).eq('post_id', deepId), sb.from('post_saves').select('post_id').eq('user_id', C.uid).eq('post_id', deepId)]);
          if ((l[0].data || []).length) st.liked.add(deepId); if ((l[1].data || []).length) st.saved.add(deepId);
          st.posts = [d.data]; sc.innerHTML = postHtml(d.data); watch(Array.prototype.slice.call(sc.children));
          st.loading = false; await more(false); return;
        }
      }
      await more(true);
    }

    /* ---------- interactions ---------- */
    function art(n) { return n.closest('.post'); }
    function find(id) { return st.posts.filter(function (p) { return p.id === id; })[0]; }
    function burst(a) { a.classList.remove('bursting'); void a.offsetWidth; a.classList.add('bursting'); }
    async function like(a, force) {
      var id = a.getAttribute('data-id'), p = find(id), on = st.liked.has(id); if (!p) return;
      if (force && on) return burst(a);
      on ? st.liked.delete(id) : st.liked.add(id); p.likes_count += on ? -1 : 1; if (!on) burst(a);
      var b = $('[data-a=like]', a); b.classList.toggle('on', !on); b.innerHTML = C.icon('heart', { size: 30, fill: !on }) + '<span>' + C.compact(p.likes_count) + '</span>';
      var r = on ? await sb.from('post_likes').delete().eq('user_id', C.uid).eq('post_id', id) : await sb.from('post_likes').insert({ user_id: C.uid, post_id: id });
      if (r.error) { C.toast(C.err(r.error), 'bad'); on ? st.liked.add(id) : st.liked.delete(id); }
    }
    function openDrawer(a) {
      var id = a.getAttribute('data-id'), p = find(id);
      if (drawer) drawer.remove();
      drawer = C.el('<aside class="drawer" aria-label="نظرها"><div class="drawer-h"><b>نظرها</b><button class="icon-btn" data-x aria-label="بستن">' + C.icon('x', { size: 20 }) + '</button></div><div class="drawer-b"></div></aside>');
      root.appendChild(drawer); root.classList.add('with-drawer');
      drawer.querySelector('[data-x]').addEventListener('click', closeDrawer);
      C.load('comments').then(function () {
        A.comments.mount($('.drawer-b', drawer), {
          table: 'post_comments', fk: 'post_id', id: id, likes: true, reportType: 'post_comment',
          onCount: function (d) { p.comments_count = Math.max(0, p.comments_count + d); var s = $('[data-cc]', a); if (s) s.textContent = C.compact(p.comments_count); }
        });
      });
    }
    function closeDrawer() { if (drawer) { drawer.remove(); drawer = null; } root.classList.remove('with-drawer'); }
    sc.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-a]'), a = art(e.target); if (!a) return;
      if (!b) {
        var v = e.target.closest('.pm');
        if (v && v.tagName === 'VIDEO') { if (v.paused) { v.play().catch(function () { }); a.classList.remove('paused'); } else { v.pause(); a.classList.add('paused'); } }
        return;
      }
      var act = b.getAttribute('data-a'), id = a.getAttribute('data-id'), p = find(id);
      if (act === 'like') like(a);
      else if (act === 'cm') openDrawer(a);
      else if (act === 'share') C.share(C.objectUrl('post', id), 'پست در Auxy');
      else if (act === 'new') compose(function (np) { st.posts = []; start(); });
      else if (act === 'cap') b.classList.toggle('open');
      else if (act === 'snd') { st.muted = !st.muted; C.$$('.pm', sc).forEach(function (v) { if (v.tagName === 'VIDEO') v.muted = st.muted; }); C.$$('.pm-snd', sc).forEach(function (s) { s.innerHTML = C.icon(st.muted ? 'mute' : 'volume', { size: 20 }); }); }
      else if (act === 'follow') { var uid = b.getAttribute('data-u'); var on = await C.toggleFollow(uid); C.$$('[data-a=follow][data-u="' + uid + '"]', sc).forEach(function (x) { x.textContent = on ? 'دنبال می‌کنی' : 'دنبال کن'; }); }
      else if (act === 'save') {
        var s = st.saved.has(id); s ? st.saved.delete(id) : st.saved.add(id); b.classList.toggle('on', !s); b.innerHTML = C.icon('list', { size: 28, fill: !s }) + '<span>ذخیره</span>';
        var r = s ? await sb.from('post_saves').delete().eq('user_id', C.uid).eq('post_id', id) : await sb.from('post_saves').insert({ user_id: C.uid, post_id: id });
        if (r.error) { C.toast(C.err(r.error), 'bad'); s ? st.saved.add(id) : st.saved.delete(id); } else C.toast(s ? 'از ذخیره‌ها حذف شد' : 'ذخیره شد');
      } else if (act === 'more') {
        var pop = C.pop(b, ((p && p.user_id === C.uid) || C.isStaff() ? '<button data-x="del">' + C.icon('trash', { size: 18 }) + 'حذف پست</button>' : '') +
          '<button data-x="copy">' + C.icon('link', { size: 18 }) + 'کپی لینک</button><button data-x="rep">' + C.icon('flag', { size: 18 }) + 'گزارش</button>');
        pop.addEventListener('click', async function (ev) {
          var x = ev.target.closest('[data-x]'); if (!x) return; x = x.getAttribute('data-x');
          if (x === 'copy') C.copy(location.origin + '/home#/scroll/' + id);
          else if (x === 'rep') C.report('post', id);
          else if (x === 'del' && await C.confirm({ title: 'حذف پست', text: 'این پست برای همیشه حذف شود؟', ok: 'حذف', danger: true })) {
            var d = await sb.from('posts').delete().eq('id', id); if (d.error) return C.toast(C.err(d.error), 'bad');
            if (p) { C.removeFile(p.media_url); C.removeFile(p.poster_url); }
            st.posts = st.posts.filter(function (q) { return q.id !== id; }); a.remove(); C.toast('پست حذف شد'); if (!st.posts.length) sc.innerHTML = empty();
          }
        });
      }
    });
    sc.addEventListener('dblclick', function (e) { var a = art(e.target); if (a && e.target.closest('.post-media')) like(a, true); });
    $('.feed-add', el).addEventListener('click', function () { compose(function () { st.posts = []; start(); }); });
    $('.feed-tabs', el).addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b || b.getAttribute('data-t') === st.tab) return;
      st.tab = b.getAttribute('data-t'); C.$$('.feed-tabs button', el).forEach(function (x) { x.classList.toggle('on', x === b); }); closeDrawer(); sc.scrollTop = 0; start();
    });
    var kb = function (e) {
      if (/input|textarea|select/i.test(e.target.tagName) || document.querySelector('.modal')) return;
      var h = sc.clientHeight; if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); sc.scrollBy({ top: h, behavior: 'smooth' }); } else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); sc.scrollBy({ top: -h, behavior: 'smooth' }); } else if (e.key === 'l') { var cur = C.$$('.post', sc).filter(function (n) { var r = n.getBoundingClientRect(); return r.top > -h / 2 && r.top < h / 2; })[0]; if (cur) like(cur); }
    };
    document.addEventListener('keydown', kb);
    await start(ctx.params.id);
    return function () { dead = true; ioPlay.disconnect(); ioNear.disconnect(); document.removeEventListener('keydown', kb); C.$$('video', sc).forEach(function (v) { v.pause(); v.removeAttribute('src'); v.load(); }); };
  }
})();
