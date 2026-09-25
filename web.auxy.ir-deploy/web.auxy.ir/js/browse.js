/* Auxy web: main page (Netflix-style): hero, rows, genres, movie page, my list, search */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, $ = C.$;
  var B = A.mod.browse = { home: home, genre: genre, movie: movie, mylist: mylist, search: search };
  var MAT = { all: 'همه‌سنین', '7': '+۷', '13': '+۱۳', '16': '+۱۶', '18': '+۱۸' };
  A.MATURITY = MAT;
  var D = { movies: null, series: null, byId: {}, list: new Set(), progress: {}, order: [], likes: new Set(), at: 0 };

  async function data(force) {
    if (!force && D.movies && Date.now() - D.at < 60000) return D;
    var r = await Promise.all([
      sb.from('movies').select('*').order('created_at', { ascending: false }).limit(300),
      sb.from('my_list').select('movie_id,created_at').eq('user_id', C.uid).order('created_at', { ascending: false }),
      sb.from('watch_progress').select('*').eq('user_id', C.uid).order('updated_at', { ascending: false }).limit(60),
      sb.from('movie_likes').select('movie_id').eq('user_id', C.uid),
      sb.from('series').select('*').eq('published', true).order('created_at', { ascending: false }).limit(100)
    ]);
    D.movies = r[0].data || []; D.byId = {}; D.movies.forEach(function (m) { D.byId[m.id] = m; });
    D.list = new Set((r[1].data || []).map(function (x) { return x.movie_id; }));
    D.progress = {}; D.order = [];
    (r[2].data || []).forEach(function (p) { D.progress[p.movie_id] = p; D.order.push(p.movie_id); });
    D.likes = new Set((r[3].data || []).map(function (x) { return x.movie_id; }));
    D.series = r[4].data || [];
    D.at = Date.now(); return D;
  }
  B.invalidate = function () { D.at = 0; };
  B.setProgress = function (id, pos, dur) {
    D.progress[id] = { movie_id: id, position_seconds: pos, duration_seconds: dur };
    D.order = [id].concat(D.order.filter(function (x) { return x !== id; }));
  };
  B.progressOf = function (id) { return D.progress[id]; };

  /* ---------- formatting ---------- */
  function fdur(min) {
    if (!min) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? C.fa(h) + ' ساعت' : '') + (h && m ? ' و ' : '') + (m ? C.fa(m) + ' دقیقه' : '');
  }
  function meta(m) {
    var a = [];
    if (m.year) a.push(C.fa(m.year).replace(/٬/g, ''));
    var d = fdur(m.duration_minutes); if (d) a.push(d);
    if (m.maturity && MAT[m.maturity]) a.push('<span class="mat">' + MAT[m.maturity] + '</span>');
    return a.join('<i>·</i>');
  }
  function poster(m, o) {
    o = o || {};
    var pr = D.progress[m.id], pct = pr && pr.duration_seconds ? Math.min(100, Math.round(pr.position_seconds / pr.duration_seconds * 100)) : 0;
    return '<a class="poster" href="#/movie/' + m.id + '" data-tilt="8" title="' + esc(m.title) + '"><div class="poster-img">' +
      '<div class="poster-fb"><b>' + esc(m.title) + '</b></div>' +
      (m.poster_url ? '<img src="' + esc(m.poster_url) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</div>' +
      '<div class="poster-ov"><b>' + esc(m.title) + '</b><span>' + meta(m) + '</span></div>' +
      (!m.published ? '<span class="draft">پیش‌نویس</span>' : '') +
      '<button class="poster-add' + (D.list.has(m.id) ? ' on' : '') + '" data-list="' + m.id + '" aria-label="لیست من">' + C.icon(D.list.has(m.id) ? 'check' : 'plus', { size: 18 }) + '</button>' +
      (o.progress && pct ? '<div class="poster-prog"><i style="width:' + pct + '%"></i></div>' : '') + '</a>';
  }
  function seriesRow(items) {
    if (!items || !items.length) return '';
    return '<section class="row"><div class="row-h"><h2>سریال‌ها</h2><a href="#\/search?q=سریال">همه ' + C.icon('chevL', { size: 16 }) + '</a></div><div class="row-w"><div class="row-s series-row">' + items.map(function(s){
      return '<a class="series-tile" href="#\/series/'+s.id+'"><div class="series-tile-img">'+(s.poster_url?'<img src="'+esc(s.poster_url)+'" alt="" loading="lazy">':'<div class="poster-fb"><b>'+esc(s.title)+'</b></div>')+'</div><b>'+esc(s.title)+'</b><small>'+esc(s.year||'')+'</small></a>';
    }).join('')+'</div></div></section>';
  }
  function row(title, items, o) {
    o = o || {};
    return '<section class="row"><div class="row-h"><h2>' + esc(title) + '</h2>' + (o.more ? '<a href="' + o.more + '">همه ' + C.icon('chevL', { size: 16 }) + '</a>' : '') + '</div>' +
      '<div class="row-w"><button class="row-nav prev" data-dir="1" aria-label="قبلی">' + C.icon('chevR', { size: 22 }) + '</button><div class="row-s">' +
      items.map(function (m) { return poster(m, o); }).join('') + '</div><button class="row-nav next" data-dir="-1" aria-label="بعدی">' + C.icon('chevL', { size: 22 }) + '</button></div></section>';
  }
  function grid(items) { return '<div class="grid-posters">' + items.map(function (m) { return poster(m); }).join('') + '</div>'; }
  function genresOf(movies) {
    var g = {};
    movies.forEach(function (m) { (m.genres || []).forEach(function (x) { (g[x] = g[x] || []).push(m); }); });
    return g;
  }
  function chips(all, cur) {
    var names = Object.keys(all);
    if (!names.length) return '';
    return '<div class="chips scroll-x"><a class="chip' + (!cur ? ' on' : '') + '" href="#/">همه</a>' +
      names.map(function (n) { return '<a class="chip' + (n === cur ? ' on' : '') + '" href="#/genre/' + encodeURIComponent(n) + '">' + esc(n) + '</a>'; }).join('') + '</div>';
  }
  function hero(m) {
    var pr = D.progress[m.id], bg = m.backdrop_url || m.poster_url;
    return '<section class="hero" id="hero">' +
      (bg ? '<img class="hero-bg" src="' + esc(bg) + '" alt="" fetchpriority="high" decoding="async" onerror="this.remove()">' : '<div class="hero-bg art"></div>') +
      '<div class="hero-shade"></div><div class="hero-in"><div class="kicker">' + (m.featured ? 'ویژه‌ی Auxy' : 'تازه') + '</div>' +
      '<h1>' + esc(m.title) + '</h1><div class="meta">' + meta(m) + '</div>' +
      (m.description ? '<p class="clamp">' + esc(m.description) + '</p>' : '') +
      '<div class="hero-btns"><button class="btn primary big" data-play="' + m.id + '">' + C.icon('play', { size: 20, fill: true }) + (pr && pr.position_seconds > 20 ? 'ادامه تماشا' : 'پخش') + '</button>' +
      '<button class="btn glass big" data-list="' + m.id + '">' + C.icon(D.list.has(m.id) ? 'check' : 'plus', { size: 20 }) + 'لیست من</button>' +
      '<a class="btn glass big" href="#/movie/' + m.id + '">' + C.icon('info', { size: 20 }) + 'اطلاعات</a></div></div></section>';
  }

  /* ---------- shared interactions ---------- */
  function wire(el) {
    el.addEventListener('click', function (e) {
      var l = e.target.closest('[data-list]');
      if (l) { e.preventDefault(); e.stopPropagation(); return toggleList(l.getAttribute('data-list')); }
      var p = e.target.closest('[data-play]');
      if (p) { e.preventDefault(); return play(p.getAttribute('data-play')); }
      var n = e.target.closest('.row-nav');
      if (n) { var s = n.parentNode.querySelector('.row-s'); s.scrollBy({ left: Number(n.getAttribute('data-dir')) * s.clientWidth * .85, behavior: C.motionOn() ? 'smooth' : 'auto' }); }
    });
    var h = $('#hero', el);
    if (h && C.motionOn() && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      var raf = 0;
      h.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0; var r = h.getBoundingClientRect();
          h.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3));
          h.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3));
        });
      });
    }
  }
  async function toggleList(id) {
    var on = D.list.has(id);
    on ? D.list.delete(id) : D.list.add(id);
    C.$$('[data-list="' + id + '"]').forEach(function (b) {
      b.classList.toggle('on', !on);
      var ic = b.querySelector('.ic'); if (ic) ic.outerHTML = C.icon(!on ? 'check' : 'plus', { size: b.classList.contains('poster-add') ? 18 : 20 });
    });
    var r = on ? await sb.from('my_list').delete().eq('user_id', C.uid).eq('movie_id', id) : await sb.from('my_list').insert({ user_id: C.uid, movie_id: id });
    if (r.error) { C.toast(C.err(r.error), 'bad'); B.invalidate(); } else C.toast(on ? 'از لیست شما حذف شد' : 'به لیست شما اضافه شد');
  }
  async function play(id) {
    var m = D.byId[id]; if (!m) return;
    await C.load('player');
    A.mod.player.open(m, { resume: D.progress[id] });
  }
  B.play = play;

  /* ---------- home ---------- */
  function skelHome() {
    return '<div class="sk-hero sk"></div>' + [1, 2].map(function () { return '<div class="row"><div class="sk sk-title"></div><div class="row-s">' + C.skel(7, 'sk-poster') + '</div></div>'; }).join('');
  }
  async function home(ctx) {
    var el = ctx.el; el.innerHTML = skelHome();
    var d = await data();
    var movies = d.movies.filter(function (m) { return m.published; });
    if (!movies.length) {
      el.innerHTML = '<section class="hero empty-hero"><div class="hero-bg art"></div><div class="hero-shade"></div><div class="hero-in"><div class="kicker">Auxy</div><h1>کتابخانه هنوز خالی است</h1>' +
        '<p>فیلم‌ها به‌زودی اینجا اضافه می‌شوند. تا آن موقع می‌توانی اسکرول را ببینی یا با دوستانت چت کنی.</p><div class="hero-btns">' +
        (C.isPublisher() ? '<a class="btn primary big" href="#/studio">' + C.icon('plus', { size: 20 }) + 'افزودن اولین فیلم</a>' : '') +
        '<a class="btn glass big" href="#/scroll">' + C.icon('scroll', { size: 20 }) + 'اسکرول</a><a class="btn glass big" href="#/chat">' + C.icon('chat', { size: 20 }) + 'چت</a></div></div></section>';
      return;
    }
    var hm = movies.filter(function (m) { return m.featured; })[0] || movies[0];
    var g = genresOf(movies), html = hero(hm) + '<div class="rows">' + seriesRow(d.series) + chips(g);
    var cont = d.order.map(function (id) { return d.byId[id]; }).filter(function (m) {
      var p = m && d.progress[m.id]; return m && m.published && p && p.duration_seconds && p.position_seconds / p.duration_seconds > .02 && p.position_seconds / p.duration_seconds < .95;
    });
    if (cont.length) html += row('ادامه تماشا', cont.slice(0, 20), { progress: true });
    var mine = movies.filter(function (m) { return d.list.has(m.id); });
    if (mine.length) html += row('لیست من', mine.slice(0, 20), { more: '#/mylist' });
    html += row('تازه‌ها', movies.slice(0, 20));
    var pop = movies.filter(function (m) { return m.views > 0; }).sort(function (a, b) { return b.views - a.views; }).slice(0, 15);
    if (pop.length) html += row('پربازدیدترین‌ها', pop);
    Object.keys(g).slice(0, 8).forEach(function (n) { html += row(n, g[n].slice(0, 20), { more: '#/genre/' + encodeURIComponent(n) }); });
    el.innerHTML = html + '</div>';
    wire(el);
  }

  async function genre(ctx) {
    var el = ctx.el, d = await data(), name = ctx.params.g;
    var movies = d.movies.filter(function (m) { return m.published; }), g = genresOf(movies), items = g[name] || [];
    el.innerHTML = '<div class="page-pad"><h1 class="page-h">' + esc(name) + '</h1>' + chips(g, name) +
      (items.length ? grid(items) : C.empty('film', 'فیلمی در این دسته نیست', '', '<a class="btn primary" href="#/">بازگشت</a>')) + '</div>';
    wire(el);
  }
  async function mylist(ctx) {
    var el = ctx.el, d = await data();
    var items = d.movies.filter(function (m) { return d.list.has(m.id) && (m.published || C.isPublisher()); });
    el.innerHTML = '<div class="page-pad"><h1 class="page-h">لیست من</h1>' +
      (items.length ? grid(items) : C.empty('list', 'لیست شما خالی است', 'روی + کنار هر فیلم بزنید تا برای بعد ذخیره شود.', '<a class="btn primary" href="#/">دیدن فیلم‌ها</a>')) + '</div>';
    wire(el);
  }

  /* ---------- movie page ---------- */
  async function movie(ctx) {
    var el = ctx.el, d = await data(), id = ctx.params.id, m = d.byId[id];
    if (!m) { var r = await sb.from('movies').select('*').eq('id', id).maybeSingle(); m = r.data; if (m) d.byId[m.id] = m; }
    if (!m) { el.innerHTML = C.empty('film', 'این فیلم پیدا نشد', 'ممکن است حذف شده باشد.', '<a class="btn primary" href="#/">بازگشت</a>'); return; }
    var pr = d.progress[m.id], liked = d.likes.has(m.id), likes = m.likes_count || 0, bg = m.backdrop_url || m.poster_url;
    var sim = d.movies.filter(function (x) { return x.id !== m.id && x.published && (x.genres || []).some(function (g) { return (m.genres || []).indexOf(g) > -1; }); }).slice(0, 14);
    el.innerHTML = '<section class="mv" id="mv">' + (bg ? '<img class="mv-bg" src="' + esc(bg) + '" alt="" decoding="async" onerror="this.remove()">' : '') + '<div class="mv-shade"></div>' +
      '<div class="mv-in"><div class="mv-poster" data-tilt="10">' + (m.poster_url ? '<img src="' + esc(m.poster_url) + '" alt="' + esc(m.title) + '">' : '<div class="poster-fb"><b>' + esc(m.title) + '</b></div>') + '</div>' +
      '<div class="mv-info">' + (!m.published ? '<span class="draft static">پیش‌نویس (فقط ناشران می‌بینند)</span>' : '') + '<h1>' + esc(m.title) + '</h1><div class="meta">' + meta(m) + '</div>' +
      '<div class="hero-btns"><button class="btn primary big" data-play="' + m.id + '">' + C.icon('play', { size: 20, fill: true }) + (pr && pr.position_seconds > 20 ? 'ادامه از ' + C.dur(pr.position_seconds) : 'پخش') + '</button>' +
      '<button class="btn glass big" data-list="' + m.id + '">' + C.icon(d.list.has(m.id) ? 'check' : 'plus', { size: 20 }) + 'لیست من</button>' +
      '<button class="btn glass big" id="mvLike" aria-pressed="' + liked + '">' + C.icon('heart', { size: 20, fill: liked }) + '<span>' + C.compact(likes) + '</span></button>' +
      '<button class="btn glass icon" id="mvShare" aria-label="اشتراک‌گذاری">' + C.icon('share', { size: 20 }) + '</button>' +
      (C.isPublisher() ? '<a class="btn glass icon" href="#/studio?edit=' + m.id + '" aria-label="ویرایش">' + C.icon('edit', { size: 20 }) + '</a>' : '') + '</div>' +
      (m.description ? '<p class="mv-desc">' + esc(m.description) + '</p>' : '') +
      ((m.genres || []).length ? '<div class="chips">' + m.genres.map(function (g) { return '<a class="chip" href="#/genre/' + encodeURIComponent(g) + '">' + esc(g) + '</a>'; }).join('') + '</div>' : '') +
      '<div class="mv-stats"><span>' + C.icon('eye', { size: 16 }) + C.compact(m.views) + ' بازدید</span></div></div></div></section>' +
      '<section class="mv-sec"><h2>نظرها</h2><div id="mvc"></div></section>' + (sim.length ? '<div class="rows">' + row('مشابه', sim) + '</div>' : '');
    wire(el);
    $('#mvShare', el).addEventListener('click', function () { C.copy(C.objectUrl('movie', m.id)); });
    var lb = $('#mvLike', el);
    lb.addEventListener('click', async function () {
      var on = d.likes.has(m.id); on ? d.likes.delete(m.id) : d.likes.add(m.id); likes += on ? -1 : 1; m.likes_count = likes;
      lb.setAttribute('aria-pressed', !on); lb.innerHTML = C.icon('heart', { size: 20, fill: !on }) + '<span>' + C.compact(likes) + '</span>';
      var r = on ? await sb.from('movie_likes').delete().eq('user_id', C.uid).eq('movie_id', m.id) : await sb.from('movie_likes').insert({ user_id: C.uid, movie_id: m.id });
      if (r.error) { C.toast(C.err(r.error), 'bad'); B.invalidate(); }
    });
    await C.load('comments');
    A.comments.mount($('#mvc', el), { table: 'movie_comments', fk: 'movie_id', id: m.id, likes: false, reportType: 'movie_comment' });
  }

  /* ---------- search ---------- */
  async function search(ctx) {
    var el = ctx.el, q = (ctx.query.get('q') || '').trim(), si = $('#sInput'); if (si && si.value !== q) si.value = q;
    if (q.length < 2) { el.innerHTML = '<div class="page-pad">' + C.empty('search', 'جستجو', 'حداقل دو حرف بنویسید. فیلم‌ها و کاربران را پیدا می‌کنیم.') + '</div>'; return; }
    el.innerHTML = '<div class="page-pad"><h1 class="page-h">نتیجه برای «' + esc(q) + '»</h1><div class="grid-posters">' + C.skel(8, 'sk-poster') + '</div></div>';
    await data();
    var like = '%' + q.replace(/[%_,()\\]/g, ' ') + '%';
    var r = await Promise.all([
      sb.from('movies').select('*').ilike('title', like).limit(40),
      sb.from('profiles').select('id,username,display_name,avatar_url,role,followers_count').or('username.ilike.' + like + ',display_name.ilike.' + like).limit(20)
    ]);
    var ms = (r[0].data || []).filter(function (m) { return m.published || C.isPublisher(); }), us = r[1].data || [];
    ms.forEach(function (m) { D.byId[m.id] = D.byId[m.id] || m; });
    us.forEach(function (u) { C.users[u.id] = u; });
    el.innerHTML = '<div class="page-pad"><h1 class="page-h">نتیجه برای «' + esc(q) + '»</h1>' +
      (us.length ? '<h2 class="sec-h">کاربران</h2><div class="ulist">' + us.map(function (u) {
        return '<a class="uitem" href="#/u/' + esc(u.username) + '">' + C.avatar(u, 46) + '<span><b>' + esc(C.name(u)) + C.badge(u) + '</b><small>@' + esc(u.username) + ' · ' + C.compact(u.followers_count) + ' دنبال‌کننده</small></span></a>';
      }).join('') + '</div>' : '') +
      (ms.length ? '<h2 class="sec-h">فیلم‌ها</h2>' + grid(ms) : '') +
      (!us.length && !ms.length ? C.empty('search', 'چیزی پیدا نشد', 'عبارت دیگری را امتحان کنید.') : '') + '</div>';
    wire(el);
  }
})();
