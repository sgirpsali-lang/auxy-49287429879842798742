/* Auxy web: core (helpers, settings, router, chrome, realtime, boot) */
(function () {
  'use strict';
  var A = window.AUXY, sb = A.client, doc = document;
  var C = A.core = {};
  C.settings = {theme:'dark',accent:'white',motion:'full',font:'md',saver:false,autoplayFeed:true,muteFeed:true,sounds:true,showOnline:true,compact:false,enterSend:true,linkPreview:true,readMarks:true,voiceAuto:false,inAppBrowser:true};
  A.mod = A.mod || {};

  /* =============== tiny helpers =============== */
  var $ = C.$ = function (s, r) { return (r || doc).querySelector(s); };
  C.$$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var esc = C.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  };
  C.el = function (html) { var t = doc.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  C.fa = function (n) { return Number(n || 0).toLocaleString('fa-IR'); };
  C.compact = function (n) {
    n = Number(n || 0);
    if (n >= 1e6) return C.fa(Math.round(n / 1e5) / 10) + ' م';
    if (n >= 1e3) return C.fa(Math.round(n / 100) / 10) + ' هزار';
    return C.fa(n);
  };
  C.ago = function (d) {
    var s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 45) return 'همین الان';
    if (s < 3600) return C.fa(Math.round(s / 60)) + ' دقیقه پیش';
    if (s < 86400) return C.fa(Math.round(s / 3600)) + ' ساعت پیش';
    if (s < 604800) return C.fa(Math.round(s / 86400)) + ' روز پیش';
    return new Date(d).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  C.clock = function (d) { return new Date(d).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); };
  C.dayLabel = function (d) {
    var x = new Date(d), n = new Date(), y = new Date(Date.now() - 864e5);
    if (x.toDateString() === n.toDateString()) return 'امروز';
    if (x.toDateString() === y.toDateString()) return 'دیروز';
    return x.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  C.dur = function (sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var p = function (x) { return String(x).padStart(2, '0'); };
    return (h ? h + ':' : '') + p(m) + ':' + p(s);
  };
  C.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };
  C.throttle = function (fn, ms) { var l = 0; return function () { var n = Date.now(); if (n - l >= ms) { l = n; fn.apply(this, arguments); } }; };
  C.uid8 = function () { return Math.random().toString(36).slice(2, 8); };
  C.pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };

  /* tiny event bus */
  var bus = {};
  C.on = function (ev, fn) { (bus[ev] = bus[ev] || []).push(fn); return function () { bus[ev] = (bus[ev] || []).filter(function (f) { return f !== fn; }); }; };
  C.emit = function (ev, d) { (bus[ev] || []).slice().forEach(function (f) { try { f(d); } catch (e) { console.error(e); } }); };

  /* =============== icons =============== */
  var IC = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h5v-6h3v6h5V10"/>',
    scroll: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m10 9 5 3-5 3z"/>',
    chat: '<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.2-4.4A8.5 8.5 0 1 1 20.5 12z"/>',
    list: '<path d="M6 3.5h12v17l-6-4-6 4z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    heart: '<path d="M12 20.5s-8-4.9-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.7-8 10.6-8 10.6z"/>',
    comment: '<path d="M20.5 11.5a8 8 0 0 1-8 8H4l1.6-3.7A8 8 0 1 1 20.5 11.5z"/>',
    share: '<path d="M4 12.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5"/><path d="M12 15V3.5"/><path d="m7.5 8 4.5-4.5L16.5 8"/>',
    play: '<path d="M7 4.5v15l13-7.5z"/>',
    pause: '<path d="M7 4.5h3.2v15H7zM13.8 4.5H17v15h-3.2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    checks: '<path d="m2.5 12.5 4 4L14 8M10 16.5l1 1L20 8"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    logout: '<path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="m16 8 4 4-4 4M20 12H9"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19.5 8.5l-4-4L4 16z"/>',
    chevL: '<path d="m15 5-7 7 7 7"/>',
    chevR: '<path d="m9 5 7 7-7 7"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    volume: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    pip: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor"/>',
    lock: '<rect x="5.5" y="11" width="13" height="9.5" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    eye: '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.2A9.6 9.6 0 0 1 12 5c6.2 0 10 7 10 7a17 17 0 0 1-3.2 4M6.3 6.5A17 17 0 0 0 2 12s3.8 7 10 7a9.7 9.7 0 0 0 4.2-.9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h0"/>',
    flag: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 16v4h16v-4"/>',
    reply: '<path d="M10 7 4 12.5 10 18M4 12.5h9a7 7 0 0 1 7 7"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h0M15 9.5h0"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    down: '<path d="M12 5v14m-6-6 6 6 6-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    megaphone: '<path d="m4 13 12-5v8L4 12z"/><path d="M16 8.2c1.8.4 3.1 1.8 3.1 3.8s-1.3 3.4-3.1 3.8"/><path d="M4 12v5a2 2 0 0 0 2 2h1"/>',
  };
  C.icon = function (n, o) {
    o = o || {};
    var s = o.size || 22;
    return '<svg class="ic" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="' + (o.fill ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="' + (o.sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
  };
  C.logo = function (kind) {
    var f = kind === 'wordmark' ? 'auxy-wordmark' : 'auxy';
    return '<img class="lg-d" src="/' + f + '-white.png" alt="Auxy"><img class="lg-l" src="/' + f + '-black.png" alt="Auxy">';
  };

  /* =============== users / avatars =============== */
  C.users = {};
  var UCOLS = 'id,username,display_name,avatar_url,role,is_banned';
  C.hydrate = async function (rows, keys) {
    keys = [].concat(keys || 'user_id');
    var need = {};
    rows.forEach(function (r) { keys.forEach(function (k) { var id = r[k]; if (id && !C.users[id]) need[id] = 1; }); });
    var ids = Object.keys(need);
    if (ids.length) {
      var r = await sb.from('profiles').select(UCOLS).in('id', ids);
      (r.data || []).forEach(function (u) { C.users[u.id] = u; });
    }
    ids.forEach(function (id) {
      if (!C.users[id]) C.users[id] = { id: id, username: 'deleted', display_name: 'کاربر حذف‌شده', avatar_url: null, role: 'user' };
    });
    return rows;
  };
  C.user = function (id) { return C.users[id] || { id: id, username: 'user', display_name: 'کاربر' }; };
  C.name = function (u) { return (u && (u.display_name || u.username)) || 'کاربر'; };
  C.convName = function (c) { return c && c.kind === 'channel' ? (c.title || 'کانال') : (c && c.kind === 'group' ? (c.title || 'گروه') : C.name(C.user(c && c.other_id))); };
  C.convName = function (c) { return c && c.kind === 'channel' ? (c.title || 'کانال') : (c && c.kind === 'group' ? (c.title || 'گروه') : C.name(C.user(c && c.other_id))); };
  C.avatar = function (u, s) {
    s = s || 40; u = u || {};
    if (u.system) u = { username: '', display_name: 'Auxy', avatar_url: '/auxy-black.png', system: true };
    var letter = esc(String(u.username || u.display_name || '?').charAt(0).toUpperCase());
    return '<span class="av' + (u.system ? ' av-system' : '') + '" style="--s:' + s + 'px"' + (u.system ? ' data-system="1"' : '') + '>' +
      (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' : '') +
      '<b' + (u.avatar_url ? ' style="display:none"' : '') + '>' + letter + '</b></span>';
  };
  C.badge = function (u) {
    if (!u || (u.role !== 'owner' && u.role !== 'publisher')) return '';
    return '<svg class="vb" viewBox="0 0 24 24" width="15" height="15" aria-label="حساب رسمی"><path fill="currentColor" d="M12 2.5l2.4 1.9 3-.1 1 2.9 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-1 2.9-3-.1L12 21.5l-2.4-1.9-3 .1-1-2.9-2.5-1.7.9-2.9-.9-2.9 2.5-1.7 1-2.9 3 .1z"/><path d="m8 12.3 2.7 2.7 5-5.3" fill="none" stroke="var(--bg)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  C.roleLabel = function (r) { return { owner: 'مالک', publisher: 'ناشر رسمی', moderator: 'ناظر', user: 'کاربر' }[r] || 'کاربر'; };
  C.isOwner = function () { var u = C.me && C.me.profile && String(C.me.profile.username || '').toLowerCase(); return !!(C.me && (C.me.profile.role === 'owner' || ['ali','support','auxy'].indexOf(u) >= 0)); };
  C.isPublisher = function () { return C.me && (C.me.profile.role === 'publisher' || C.me.profile.role === 'owner'); };
  C.isStaff = function () { return !!(C.me && (C.isOwner() || C.me.profile.role === 'moderator')); };

  /* =============== feedback UI =============== */
  var toasts = function () { return $('#toasts'); };
  C.toast = function (text, kind) {
    var t = C.el('<div class="toast ' + (kind || '') + '" role="status">' + esc(text) + '</div>');
    toasts().appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 3200);
  };
  C.err = function (e) {
    var m = String((e && e.message) || e || '');
    if (/network|fetch|Failed/i.test(m)) return 'اتصال برقرار نشد. اینترنت را بررسی کنید.';
    if (/permission|denied|policy|not allowed/i.test(m)) return 'اجازه‌ی این کار را ندارید.';
    return 'مشکلی پیش آمد. دوباره تلاش کنید.';
  };

  var modalStack = [];
  C.modal = function (o) {
    o = o || {};
    var m = C.el('<div class="modal' + (o.wide ? ' wide' : '') + (o.locked ? ' locked' : '') + (o.cls ? ' ' + o.cls : '') + '"><div class="m-back"></div>' +
      '<div class="m-box" role="dialog" aria-modal="true"' + (o.title ? ' aria-label="' + esc(o.title) + '"' : '') + '>' +
      (o.title || !o.locked ? '<div class="m-head"><h3>' + esc(o.title || '') + '</h3>' + (o.locked ? '' : '<button class="icon-btn" data-close aria-label="بستن">' + C.icon('x', { size: 20 }) + '</button>') + '</div>' : '') +
      '<div class="m-body"></div>' + (o.foot === false ? '' : '<div class="m-foot"></div>') + '</div></div>');
    var body = $('.m-body', m), foot = $('.m-foot', m), closed = false;
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    var api = { el: m, body: body, foot: foot };
    api.close = function (v) {
      if (closed) return; closed = true;
      m.classList.add('out');
      modalStack = modalStack.filter(function (x) { return x !== api; });
      if (!modalStack.length) doc.body.classList.remove('no-scroll');
      setTimeout(function () { m.remove(); }, C.settings.motion === 'off' ? 0 : 200);
      if (o.onClose) o.onClose(v);
    };
    (o.actions || []).forEach(function (a) {
      var b = C.el('<button type="button" class="btn ' + (a.kind || 'ghost') + '">' + esc(a.label) + '</button>');
      b.addEventListener('click', function () { a.onClick ? a.onClick(api, b) : api.close(); });
      foot && foot.appendChild(b);
      a.el = b;
    });
    m.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') || (e.target.classList.contains('m-back') && !o.locked)) api.close();
    });
    $('#ov').appendChild(m);
    doc.body.classList.add('no-scroll');
    modalStack.push(api);
    var f = $('input,textarea,select', body); if (f && !o.noFocus) setTimeout(function () { try { f.focus(); } catch (e) { } }, 60);
    return api;
  };
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) {
      var top = modalStack[modalStack.length - 1];
      if (!top.el.classList.contains('locked')) top.close();
    }
  });
  C.confirm = function (o) {
    return new Promise(function (res) {
      var done = false;
      var m = C.modal({
        title: o.title || 'مطمئنی؟', body: '<p class="muted">' + esc(o.text || '') + '</p>',
        onClose: function () { if (!done) res(false); },
        actions: [
          { label: o.cancel || 'انصراف', kind: 'ghost', onClick: function (a) { a.close(); } },
          { label: o.ok || 'تأیید', kind: o.danger ? 'danger' : 'primary', onClick: function (a) { done = true; res(true); a.close(); } }
        ]
      });
    });
  };
  C.pop = function (anchor, html, cls) {
    $$pop();
    var p = C.el('<div class="pop ' + (cls || '') + '" role="menu">' + html + '</div>');
    doc.body.appendChild(p);
    var r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
    var left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    var top = r.bottom + 8; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    setTimeout(function () {
      var off = function (e) { if (!p.contains(e.target)) { p.remove(); doc.removeEventListener('pointerdown', off, true); } };
      doc.addEventListener('pointerdown', off, true);
      p.addEventListener('click', function () { setTimeout(function () { p.remove(); }, 0); });
    }, 0);
    return p;
  };
  function $$pop() { C.$$('.pop').forEach(function (p) { p.remove(); }); }
  C.empty = function (icon, title, text, action) {
    return '<div class="empty"><div class="empty-ic">' + C.icon(icon, { size: 34 }) + '</div><h3>' + esc(title) + '</h3>' +
      (text ? '<p>' + esc(text) + '</p>' : '') + (action || '') + '</div>';
  };
  C.skel = function (n, cls) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="sk ' + (cls || '') + '"></div>'; return s; };

  C.copy = function (t) {
    var ok = function () { C.toast('کپی شد'); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () { C.toast('کپی نشد', 'bad'); });
    else { var i = doc.createElement('textarea'); i.value = t; doc.body.appendChild(i); i.select(); try { doc.execCommand('copy'); ok(); } catch (e) { } i.remove(); }
  };
  C.share = function (url, title) {
    url = String(url || '');
    var full = /^https?:\/\//i.test(url) ? url : (location.origin + (url.charAt(0) === '/' ? url : (url.charAt(0) === '#' ? '/home' + url : '/home/' + url)));
    if (navigator.share) navigator.share({ title: title || 'Auxy', url: full }).catch(function () { });
    else C.copy(full);
  };
  C.report = function (type, id) {
    var reasons = ['هرزنامه یا تبلیغ ناخواسته', 'خشونت یا محتوای آزاردهنده', 'توهین و نفرت‌پراکنی', 'محتوای نامناسب', 'نقض حق نشر', 'دلیل دیگر'];
    var m = C.modal({
      title: 'گزارش', body: '<label class="field"><span>دلیل</span><select class="input" id="rr">' + reasons.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>توضیح بیشتر (اختیاری)</span><textarea class="input" id="rt" rows="3" maxlength="300"></textarea></label>',
      actions: [{ label: 'انصراف', onClick: function (a) { a.close(); } }, {
        label: 'ارسال گزارش', kind: 'primary', onClick: async function (a) {
          var reason = $('#rr', m.el).value + ($('#rt', m.el).value.trim() ? ' — ' + $('#rt', m.el).value.trim() : '');
          var r = await sb.from('reports').insert({ reporter_id: C.uid, target_type: type, target_id: id, reason: reason.slice(0, 500) });
          if (r.error) return C.toast(C.err(r.error), 'bad');
          C.toast('گزارش ثبت شد. ممنون'); a.close();
        }
      }]
    });
  };

  /* =============== public links + rich text =============== */
  C.publicUrl = function (username) { return location.origin + '/' + encodeURIComponent(String(username || '').replace(/^@+/, '').toLowerCase()); };
  C.objectUrl = function (kind, id) { return location.origin + '/x/' + encodeURIComponent(String(kind || 'item')) + '/' + encodeURIComponent(String(id || '')); };
  C.linkify = function (text) {
    var safe = C.esc(String(text == null ? '' : text)), stash = [];
    safe = safe.replace(/https?:\/\/[^\s<]+/gi, function (raw) {
      var clean = raw.replace(/[.,!?;:،؛)\]\}]+$/g, ''), trail = raw.slice(clean.length), token = '__AUXY_LINK_' + stash.length + '__';
      stash.push('<a class="msg-link auxy-external" data-link="' + C.esc(clean) + '" href="' + C.esc(clean) + '" rel="noreferrer">' + C.esc(clean) + '</a>');
      return token + trail;
    });
    safe = safe.replace(/(^|[\s(\[«])@([a-z][a-z0-9_]{2,23})\b/gi, function (_, pre, name) {
      return pre + '<a class="msg-link auxy-user" href="#/r/' + encodeURIComponent(name.toLowerCase()) + '">@' + name + '</a>';
    });
    return safe.replace(/__AUXY_LINK_(\d+)__/g, function (_, i) { return stash[Number(i)] || ''; });
  };
  C.navigateExternal = function (url) { if (url) C.go('/browser?url=' + encodeURIComponent(url)); };

  /* =============== files =============== */
  C.upload = async function (bucket, file, o) {
    o = o || {};
    var s = (await sb.auth.getSession()).data.session;
    if (!s) throw new Error('auth');
    if (!file) throw new Error('file');
    var ext = (String(file.name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    var path = (o.folder || C.uid) + '/' + Date.now().toString(36) + '-' + C.uid8() + '.' + ext;
    if (o.ctl) o.ctl.abort = function () { /* supabase-js upload has no public XHR abort hook */ };
    var up = await sb.storage.from(bucket).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined
    });
    if (up.error) throw up.error;
    if (o.onProgress) o.onProgress(1);
    var pub = sb.storage.from(bucket).getPublicUrl(path);
    return { path: path, url: pub.data.publicUrl };
  };
  C.removeFile = function (url) {
    var m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(url || '');
    if (m) sb.storage.from(m[1]).remove([decodeURIComponent(m[2])]).then(function () { }, function () { });
  };
  C.compress = function (file, max, q) {
    return new Promise(function (res) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return res(file);
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var r = Math.min(1, max / Math.max(img.width, img.height)), cv = doc.createElement('canvas');
        cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) {
          URL.revokeObjectURL(u);
          if (!b) return res(file);
          res(new File([b], String(file.name || 'img').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', q || .85);
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    });
  };
  C.extScript = function (url) {
    C._ext = C._ext || {};
    return C._ext[url] || (C._ext[url] = new Promise(function (res, rej) {
      var s = doc.createElement('script'); s.src = url; s.onload = res; s.onerror = function () { delete C._ext[url]; rej(new Error('script')); }; doc.head.appendChild(s);
    }));
  };

  /* =============== settings =============== */
  var DEF = { theme: 'dark', accent: 'white', motion: 'full', font: 'md', saver: false, autoplayFeed: true, muteFeed: true, sounds: true, showOnline: true, compact: false, enterSend: true, linkPreview: true, readMarks: true, voiceAuto: false, inAppBrowser: true };
  var saved = {}; try { saved = JSON.parse(localStorage.getItem('auxy:settings') || '{}'); } catch (e) { }
  C.settings = Object.assign({}, DEF, saved);
  C.applySettings = function () {
    var s = C.settings, r = doc.documentElement;
    var th = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme;
    r.setAttribute('data-theme', th); r.setAttribute('data-accent', s.accent); r.setAttribute('data-motion', s.motion);
    r.setAttribute('data-font', s.font); r.setAttribute('data-saver', s.saver ? '1' : '0'); r.setAttribute('data-compact', s.compact ? '1' : '0');
    var mt = $('meta[name=theme-color]'); if (mt) mt.setAttribute('content', th === 'light' ? '#ffffff' : '#000000');
  };
  var saveT;
  C.saveSettings = function (p) {
    Object.assign(C.settings, p); C.applySettings();
    try { localStorage.setItem('auxy:settings', JSON.stringify(C.settings)); } catch (e) { }
    clearTimeout(saveT);
    saveT = setTimeout(function () { if (C.uid) sb.from('user_private').update({ settings: C.settings }).eq('user_id', C.uid).then(function () { }, function () { }); }, 700);
    C.emit('settings', C.settings);
  };
  C.motionOn = function () { return C.settings.motion === 'full'; };
  C.applySettings();

  /* =============== module loader + router =============== */
  var loaded = {};
  C.load = function (n) {
    if (A.mod[n]) return Promise.resolve();
    if (loaded[n]) return loaded[n];
    return (loaded[n] = new Promise(function (res, rej) {
      var s = doc.createElement('script'); s.src = '/js/' + n + '.js?v=' + A.VERSION;
      s.onload = res; s.onerror = function () { delete loaded[n]; rej(new Error('load ' + n)); }; doc.head.appendChild(s);
    }));
  };
  var ROUTES = [
    ['/', 'browse', 'home'], ['/genre/:g', 'browse', 'genre'], ['/movie/:id', 'browse', 'movie'], ['/mylist', 'browse', 'mylist'],
    ['/search', 'browse', 'search'], ['/series/:id', 'series', 'open'], ['/episode/:id', 'series', 'episode'],
    ['/scroll', 'feed', 'open'], ['/scroll/:id', 'feed', 'open'], ['/chat', 'chat', 'open'], ['/chat/:id', 'chat', 'open'],
    ['/saved', 'saved', 'open'], ['/u/:name', 'social', 'profile'], ['/r/:name', 'publicx', 'open'],
    ['/notifications', 'social', 'notifications'], ['/settings', 'settings', 'open'], ['/settings/:section', 'settings', 'open'],
    ['/studio', 'studio', 'open'], ['/admin', 'admin', 'open'], ['/admin/:section', 'admin', 'open'],
    ['/join/:token', 'chat', 'join'], ['/gjoin/:token', 'chat', 'joinGroup'],
    ['/invite/channel/:token', 'chat', 'join'], ['/invite/group/:token', 'chat', 'joinGroup'],
    ['/browser', 'browser', 'open'], ['/x/:kind/:id', 'deep', 'open']
  ].map(function (r) {
    var keys = [];
    var re = new RegExp('^' + r[0].replace(/:([a-z]+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '/?$');
    return { re: re, keys: keys, mod: r[1], fn: r[2] };
  });
  C.go = function (p) { location.hash = '#' + p; };
  var cleanup = null, navId = 0, view;
  var NAVMAP = { '': 'home', genre: 'home', movie: 'home', search: 'home', series: 'home', episode: 'home', mylist: 'mylist', saved: 'chat', scroll: 'scroll', chat: 'chat', notifications: 'notifications', u: 'profile', r:'profile', x:'home', browser:'home', admin:'admin', studio:'studio' };
  function setActive(path) {
    var seg = path.split('/')[1] || '';
    var key = NAVMAP[seg];
    C.$$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === key); });
    doc.body.setAttribute('data-page', seg || 'home');
  }
  async function navigate() {
    var h = location.hash.replace(/^#/, '') || '/', i = h.indexOf('?');
    var path = (i < 0 ? h : h.slice(0, i)).replace(/\/+$/, '') || '/', qs = new URLSearchParams(i < 0 ? '' : h.slice(i + 1));
    var route = null, params = {};
    for (var k = 0; k < ROUTES.length; k++) {
      var m = ROUTES[k].re.exec(path);
      if (m) { route = ROUTES[k]; route.keys.forEach(function (key, j) { params[key] = decodeURIComponent(m[j + 1]); }); break; }
    }
    if (!route) { C.go('/'); return; }
    var id = ++navId;
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    $$pop(); C.emit('navigate', path);
    view.className = 'view v-' + route.mod; view.innerHTML = '';
    var page = doc.createElement('div'); page.className = 'page'; page.innerHTML = '<div class="page-load"><div class="sk-bar"></div></div>'; view.appendChild(page);   // fresh container per route: listeners never stack
    setActive(path);
    try {
      await C.load(route.mod);
      if (id !== navId) return;
      var ret = await A.mod[route.mod][route.fn]({ params: params, query: qs, el: page, path: path });
      if (id !== navId) { if (typeof ret === 'function') try { ret(); } catch (e) { } return; }
      if (typeof ret === 'function') cleanup = ret;
      view.classList.add('in');
    } catch (e) {
      console.error(e);
      page.innerHTML = C.empty('info', 'بارگذاری نشد', 'اتصال اینترنت را بررسی کنید.', '<button class="btn primary" onclick="location.reload()">تلاش دوباره</button>');
    }
    if (!/^\/(chat|scroll)/.test(path)) scrollTo(0, 0);
  }
  C.refreshRoute = navigate;

  /* =============== chrome (top bar, tab bar) =============== */
  var NAV = [
    ['home', '#/', 'home', 'خانه'], ['scroll', '#/scroll', 'scroll', 'اسکرول'],
    ['chat', '#/chat', 'chat', 'چت'], ['mylist', '#/mylist', 'list', 'لیست من']
  ];
  function renderChrome() {
    var p = C.me.profile;
    $('#top').innerHTML = '<a class="brand" href="#/" aria-label="Auxy">' + C.logo('wordmark') + '</a>' +
      '<nav class="nav" aria-label="ناوبری">' + NAV.map(function (n) {
        return '<a href="' + n[1] + '" data-nav="' + n[0] + '">' + C.icon(n[2], { size: 20 }) + '<span>' + n[3] + '</span>' + (n[0] === 'chat' ? '<b class="nb" data-badge="chat" hidden></b>' : '') + '</a>';
      }).join('') + '</nav>' +
      '<div class="top-end"><form class="search" role="search" id="sForm">' + C.icon('search', { size: 18 }) +
      '<input id="sInput" type="search" placeholder="جستجو در فیلم‌ها و کاربران…" aria-label="جستجو" autocomplete="off" enterkeyhint="search"></form>' +
      '<a class="icon-btn" href="#/notifications" data-nav="notifications" aria-label="اعلان‌ها">' + C.icon('bell', { size: 21 }) + '<b class="nb" data-badge="notif" hidden></b></a>' +
      '<button class="me-btn" id="meBtn" aria-label="حساب من" aria-haspopup="menu">' + C.avatar(p, 34) + '</button></div>';
    $('#tabbar').innerHTML = NAV.map(function (n) {
      return '<a href="' + n[1] + '" data-nav="' + n[0] + '">' + C.icon(n[2], { size: 24 }) + '<span>' + n[3] + '</span>' + (n[0] === 'chat' ? '<b class="nb" data-badge="chat" hidden></b>' : '') + '</a>';
    }).join('') + '<a href="#/notifications" data-nav="notifications">' + C.icon('bell', { size: 24 }) + '<span>اعلان‌ها</span><b class="nb" data-badge="notif" hidden></b></a>' +
      '<a href="#/u/' + esc(p.username) + '" data-nav="profile">' + C.avatar(p, 26) + '<span>من</span></a>';
    var si = $('#sInput'), sf = $('#sForm');
    var go = C.debounce(function () { var q = si.value.trim(); if (q.length >= 2) C.go('/search?q=' + encodeURIComponent(q)); }, 450);
    si.addEventListener('input', go);
    sf.addEventListener('submit', function (e) { e.preventDefault(); var q = si.value.trim(); if (q) C.go('/search?q=' + encodeURIComponent(q)); });
    $('#meBtn').addEventListener('click', function (e) {
      var pr = C.me.profile;
      var pop = C.pop(e.currentTarget, '<a href="#/u/' + esc(pr.username) + '"><span class="pop-me">' + C.avatar(pr, 38) + '<span><b>' + esc(C.name(pr)) + C.badge(pr) + '</b><small>@' + esc(pr.username) + '</small></span></span></a>' +
        '<hr><a href="#/settings">' + C.icon('settings', { size: 18 }) + 'تنظیمات</a>' +
        (C.isPublisher() ? '<a href="#/studio">' + C.icon('film', { size: 18 }) + 'استودیو (افزودن فیلم)</a>' : '') +
        (C.isStaff() ? '<a href="#/admin">' + C.icon('shield', { size: 18 }) + (C.isOwner() ? 'پنل مالک' : 'پنل ناظر') + '</a>' : '') +
        '<hr><button data-out>' + C.icon('logout', { size: 18 }) + 'خروج</button>');
      pop.addEventListener('click', function (ev) { if (ev.target.closest('[data-out]')) A.signOut(); });
    });
    setBadges();
  }
  function setBadges() {
    C.$$('[data-badge]').forEach(function (b) {
      var n = C.unread[b.getAttribute('data-badge')] || 0;
      b.hidden = !n; b.textContent = n > 99 ? '۹۹+' : C.fa(n);
    });
  }
  C.on('badges', setBadges);
  C.unread = { notif: 0, chat: 0 };
  C.convs = [];
  C.chatState = { active: null };
  C.refreshBadges = async function () {
    var r = await Promise.all([
      sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', C.uid).eq('read', false),
      sb.rpc('my_conversations')
    ]);
    C.unread.notif = (r[0] && r[0].count) || 0;
    C.convs = (r[1] && r[1].data) || [];
    C.unread.chat = C.convs.reduce(function (a, c) { return a + (c.unread || 0); }, 0);
    C.emit('badges');
  };

  /* =============== realtime (notifications, messages, presence) =============== */
  C.online = new Set();
  var audio;
  C.beep = function () {
    if (!C.settings.sounds) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = .04;
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + .09);
    } catch (e) { }
  };
  function startRealtime() {
    var uid = C.uid;
    sb.channel('u:' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid }, function (p) {
        C.unread.notif++; C.emit('badges'); C.emit('notif', p.new); C.beep();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (p) {
        var m = p.new; if (!m) return;
        var mine = m.sender_id === uid, conv = C.convs.filter(function (c) { return c.conv_id === m.conversation_id; })[0];
        if (!mine) {
          if (!conv) { C.refreshBadges().then(function () { C.emit('message', m); }); return; }
          var open = C.chatState.active === m.conversation_id && doc.hasFocus();
          if (!open && !conv.muted) { conv.unread = (conv.unread || 0) + 1; C.unread.chat++; C.beep(); C.emit('badges'); }
        }
        if (conv) { conv.last_body = m.body; conv.last_media = m.media_url; conv.last_at = m.created_at; conv.last_sender = m.sender_id; }
        C.emit('message', m);
      }).subscribe();
    var pr = sb.channel('auxy:presence', { config: { presence: { key: uid } } });
    pr.on('presence', { event: 'sync' }, function () { C.online = new Set(Object.keys(pr.presenceState())); C.emit('presence'); })
      .subscribe(function (st) { if (st === 'SUBSCRIBED' && C.settings.showOnline) pr.track({ t: Date.now() }); });
    C.presence = pr;
    C.on('settings', function () { if (C.settings.showOnline) pr.track({ t: Date.now() }); else pr.untrack(); });
  }

  /* =============== ambient effects: spotlight + 3D tilt =============== */
  function ambient() {
    if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var glow = $('#glow'), gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy, on = false, cur = null, raf = 0;
    function loop() { gx += (tx - gx) * .16; gy += (ty - gy) * .16; glow.style.transform = 'translate3d(' + (gx - 310) + 'px,' + (gy - 310) + 'px,0)'; raf = Math.abs(tx - gx) + Math.abs(ty - gy) > .5 ? requestAnimationFrame(loop) : 0; }
    function reset() { if (cur) { cur.style.transform = ''; cur.classList.remove('hov'); cur = null; } }
    doc.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !C.motionOn()) { glow.classList.remove('on'); return; }
      tx = e.clientX; ty = e.clientY; if (!on) { on = true; glow.classList.add('on'); }
      if (!raf) raf = requestAnimationFrame(loop);
      var t = e.target.closest && e.target.closest('[data-tilt]');
      if (cur && cur !== t) reset();
      if (t) {
        cur = t; var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, k = Number(t.getAttribute('data-tilt')) || 6;
        t.style.setProperty('--gx', (x * 100) + '%'); t.style.setProperty('--gy', (y * 100) + '%');
        t.style.transform = 'perspective(900px) rotateX(' + ((.5 - y) * k) + 'deg) rotateY(' + ((x - .5) * k) + 'deg)'; t.classList.add('hov');
      }
    }, { passive: true });
    doc.addEventListener('pointerleave', function () { glow.classList.remove('on'); on = false; reset(); });
    doc.addEventListener('scroll', reset, { passive: true, capture: true });
  }

  /* =============== follows =============== */
  C.following = null;
  C.loadFollowing = async function () {
    if (C.following) return C.following;
    var r = await sb.from('follows').select('following_id').eq('follower_id', C.uid);
    C.following = new Set((r.data || []).map(function (x) { return x.following_id; }));
    return C.following;
  };
  C.toggleFollow = async function (id) {
    await C.loadFollowing();
    var on = C.following.has(id);
    on ? C.following.delete(id) : C.following.add(id);
    var r = on ? await sb.from('follows').delete().eq('follower_id', C.uid).eq('following_id', id)
               : await sb.from('follows').insert({ follower_id: C.uid, following_id: id });
    if (r.error) { on ? C.following.add(id) : C.following.delete(id); C.toast(C.err(r.error), 'bad'); return on; }
    C.emit('follow', { id: id, on: !on });
    return !on;
  };

  /* =============== boot =============== */
  var PROFILE_COLS = 'id,username,display_name,avatar_url,bio,role,is_banned,followers_count,following_count,posts_count,created_at';
  C.reloadMe = async function () {
    var last = null;
    for (var attempt = 1; attempt <= 4; attempt++) {
      try {
        var ensure = await sb.rpc('ensure_profile');
        if (ensure.error) throw ensure.error;
        var pr = await sb.from('profiles').select(PROFILE_COLS).eq('id', C.uid).maybeSingle();
        if (pr.error) throw pr.error;
        var pv = await sb.from('user_private').select('*').eq('user_id', C.uid).maybeSingle();
        if (pv.error) throw pv.error;
        if (!pr.data || !pv.data) throw new Error('profile_rows_missing');
        C.me = { id: C.uid, email: (C.session.user && C.session.user.email) || pv.data.email || pv.data.recovery_email || null, profile: pr.data, priv: pv.data };
        C.users[C.uid] = pr.data;
        return C.me;
      } catch (e) {
        last = e;
        if (e && (e.status === 401 || e.code === 'PGRST301')) {
          try {
            var rr = await sb.auth.refreshSession();
            if (rr.data && rr.data.session) { C.session = rr.data.session; C.uid = rr.data.session.user.id; continue; }
          } catch (_) {}
        }
        await new Promise(function(r){setTimeout(r,300 * attempt);});
      }
    }
    throw last || new Error('profile');
  };
  function bootError(msg) {
    var b = $('#boot');
    b.innerHTML = '<div class="boot-msg"><h2>' + esc(msg) + '</h2><p>اتصال یا تنظیمات دیتابیس را بررسی کنید.</p><button class="btn primary" onclick="location.reload()">تلاش دوباره</button> <button class="btn ghost" onclick="AUXY.signOut()">خروج</button></div>';
  }
  function showBanned(reason) {
    $('#boot').innerHTML = '<div class="boot-msg"><h2>حساب شما مسدود شده است</h2><p>' + esc(reason || 'برای اطلاعات بیشتر با پشتیبانی Auxy تماس بگیرید.') + '</p><button class="btn ghost" onclick="AUXY.signOut()">خروج</button></div>';
  }
  C.deviceKey = function () {
    try { var k=localStorage.getItem('auxy:device-key'); if(k) return k; k=(crypto&&crypto.randomUUID?crypto.randomUUID():('d_'+Date.now()+'_'+Math.random().toString(36).slice(2)))+'_'+Math.random().toString(36).slice(2); localStorage.setItem('auxy:device-key',k); return k; } catch(e){ return 'd_'+Date.now(); }
  };
  C.registerCurrentDevice = async function () {
    var key=C.deviceKey(); var label=/Android/i.test(navigator.userAgent)?'Android':/iPhone|iPad/i.test(navigator.userAgent)?'iPhone / iPad':/Windows/i.test(navigator.userAgent)?'Windows':/Mac/i.test(navigator.userAgent)?'Mac':'دستگاه';
    try { await sb.rpc('register_device',{p_device_key:key,p_label:label,p_user_agent:navigator.userAgent}); var rv=await sb.rpc('is_current_device_revoked',{p_device_key:key}); if(rv.data===true){await A.signOut(); location.replace('/login/'); return false;} } catch(e) { console.warn('[Auxy device]',e); }
    return true;
  };
  C.boot = async function (session) {
    C.session = session; C.uid = session.user.id; view = $('#view');
    try {
      if (A.syncAuthPassword) await A.syncAuthPassword();
      await C.reloadMe();
      if (!(await C.registerCurrentDevice())) return;
      try { await sb.rpc('ensure_auxy_welcome'); } catch (e) { console.warn('[Auxy welcome]', e); }
    } catch (e) { console.error('[Auxy boot/profile]', e); return bootError('پروفایل شما بارگذاری نشد'); }
    if (C.me.profile.is_banned) return showBanned();
    if (C.me.priv.settings && typeof C.me.priv.settings === 'object' && Object.keys(C.me.priv.settings).length) {
      Object.assign(C.settings, C.me.priv.settings); C.applySettings();
      try { localStorage.setItem('auxy:settings', JSON.stringify(C.settings)); } catch (e) { }
    }
    var p = C.me.profile, pv = C.me.priv;
    try {
      /* Native Auth owns the password. There is no second application password
         setup screen anymore. */
      if (!p.username) {
        await C.load('onboarding');
        await A.mod.onboarding.run();
        await C.reloadMe();
      }
      if (p.username && !C.me.priv.onboarded) {
        var fin = await sb.rpc('finish_onboarding');
        if (fin.error) throw fin.error;
        await C.reloadMe();
      }
    } catch (e) { console.error('[Auxy boot/onboarding]', e); return bootError('مراحل ساخت حساب کامل نشد'); }
    start();
  };
  function start() {
    $('#boot').classList.add('out'); setTimeout(function () { var b = $('#boot'); if (b) b.remove(); }, 400);
    $('#app').hidden = false; renderChrome(); ambient(); startRealtime();
    if (!C.__globalLinkHandler) {
      C.__globalLinkHandler = function (e) {
        var a = e.target && e.target.closest ? e.target.closest('.auxy-external') : null;
        if (a) { var url = a.getAttribute('data-link') || a.getAttribute('href'); if (url && /^https?:\/\//i.test(url)) { e.preventDefault(); C.navigateExternal(url); } }
      };
      doc.addEventListener('click', C.__globalLinkHandler);
    }
    C.refreshBadges();
    C.__deviceTimer && clearInterval(C.__deviceTimer);
    C.__deviceTimer = setInterval(async function(){ try { var key=C.deviceKey(), rv=await sb.rpc('is_current_device_revoked',{p_device_key:key}); if(rv.data===true){ clearInterval(C.__deviceTimer); await A.signOut(); location.replace('/login/'); return; } await sb.rpc('register_device',{p_device_key:key,p_label:navigator.platform||'دستگاه',p_user_agent:navigator.userAgent}); } catch(e){} },15000);
    addEventListener('hashchange', navigate);
    addEventListener('keydown', function (e) {
      if (e.key === '/' && !/input|textarea|select/i.test((e.target.tagName || ''))) { e.preventDefault(); var i = $('#sInput'); if (i) i.focus(); }
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener && matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (C.settings.theme === 'system') C.applySettings(); });
    navigate();
  }
})();
