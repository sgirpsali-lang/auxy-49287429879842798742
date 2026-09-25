/* Auxy web: comments panel (used by the scroll feed and by movie pages) */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, $ = C.$;
  var PAGE = 15;
  A.mod.comments = {};
  A.comments = { mount: mount };

  function fmt(t) {
    return esc(t).replace(/@([a-z0-9_]{3,24})/gi, function (m, n) { return '<a href="#/u/' + n.toLowerCase() + '">@' + n + '</a>'; }).replace(/\n/g, '<br>');
  }

  /* o: { table, fk, id, likes, reportType, onCount(delta) } */
  function mount(el, o) {
    var st = { items: [], replies: {}, liked: {}, open: {}, page: 0, done: false, replyTo: null, busy: false };
    el.innerHTML = '<div class="cm"><form class="cm-form">' + C.avatar(C.me.profile, 34) +
      '<div class="cm-in"><div class="cm-reply" hidden></div><textarea class="input" rows="1" maxlength="1000" placeholder="نظرت را بنویس…" aria-label="نظر"></textarea></div>' +
      '<button class="icon-btn send" type="submit" aria-label="ارسال" disabled>' + C.icon('send', { size: 20 }) + '</button></form>' +
      '<div class="cm-list"></div><button class="btn ghost block cm-more" type="button" hidden>نظرهای بیشتر</button></div>';
    var form = $('.cm-form', el), ta = $('textarea', el), send = $('.send', el), list = $('.cm-list', el), more = $('.cm-more', el), rep = $('.cm-reply', el);

    function one(c, isReply) {
      var u = C.user(c.user_id), mine = c.user_id === C.uid;
      var kids = st.replies[c.id] || [];
      return '<div class="cmt' + (isReply ? ' reply' : '') + '" data-id="' + c.id + '">' +
        '<a href="#/u/' + esc(u.username) + '">' + C.avatar(u, isReply ? 28 : 34) + '</a><div class="cmt-b">' +
        '<div class="cmt-h"><a href="#/u/' + esc(u.username) + '"><b>' + esc(C.name(u)) + '</b>' + C.badge(u) + '</a><time>' + C.ago(c.created_at) + '</time></div>' +
        '<p class="cmt-t">' + fmt(c.body) + '</p><div class="cmt-a">' +
        (o.likes ? '<button type="button" data-a="like" class="' + (st.liked[c.id] ? 'on' : '') + '">' + C.icon('heart', { size: 15, fill: !!st.liked[c.id] }) + '<span>' + C.compact(c.likes_count) + '</span></button>' : '') +
        '<button type="button" data-a="reply">پاسخ</button>' +
        '<button type="button" data-a="more" aria-label="بیشتر">' + C.icon('more', { size: 16 }) + '</button></div>' +
        (!isReply && kids.length ? '<button type="button" class="cmt-tg" data-a="toggle">' + (st.open[c.id] ? 'پنهان کردن پاسخ‌ها' : 'نمایش ' + C.fa(kids.length) + ' پاسخ') + '</button>' : '') +
        (!isReply && st.open[c.id] ? '<div class="cmt-replies">' + kids.map(function (k) { return one(k, true); }).join('') + '</div>' : '') +
        '</div></div>';
    }
    function render() {
      list.innerHTML = st.items.length ? st.items.map(function (c) { return one(c, false); }).join('') :
        '<p class="cm-empty">هنوز نظری نیست. اولین نفر باش.</p>';
      more.hidden = st.done;
    }
    async function load() {
      if (st.busy) return; st.busy = true; more.disabled = true;
      var r = await sb.from(o.table).select('*').eq(o.fk, o.id).is('parent_id', null).order('created_at', { ascending: false }).range(st.page * PAGE, st.page * PAGE + PAGE - 1);
      var rows = r.data || []; if (rows.length < PAGE) st.done = true; st.page++;
      var ids = rows.map(function (x) { return x.id; }), reps = [];
      if (ids.length) { var rr = await sb.from(o.table).select('*').in('parent_id', ids).order('created_at', { ascending: true }); reps = rr.data || []; }
      await C.hydrate(rows.concat(reps));
      if (o.likes) {
        var all = ids.concat(reps.map(function (x) { return x.id; }));
        if (all.length) { var lr = await sb.from('comment_likes').select('comment_id').eq('user_id', C.uid).in('comment_id', all); (lr.data || []).forEach(function (x) { st.liked[x.comment_id] = 1; }); }
      }
      rows.forEach(function (x) { st.items.push(x); });
      reps.forEach(function (x) { (st.replies[x.parent_id] = st.replies[x.parent_id] || []).push(x); });
      st.busy = false; more.disabled = false; render();
    }
    function find(id) {
      for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) return st.items[i];
      for (var k in st.replies) { var f = st.replies[k].filter(function (x) { return x.id === id; })[0]; if (f) return f; }
    }
    function setReply(c) {
      st.replyTo = c;
      if (c) { rep.hidden = false; rep.innerHTML = 'پاسخ به <b>@' + esc(C.user(c.user_id).username) + '</b> <button type="button" class="icon-btn" aria-label="لغو">' + C.icon('x', { size: 14 }) + '</button>'; ta.focus(); }
      else { rep.hidden = true; rep.innerHTML = ''; }
    }
    rep.addEventListener('click', function (e) { if (e.target.closest('button')) setReply(null); });
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; send.disabled = !ta.value.trim(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = ta.value.trim(); if (!body || send.disabled) return;
      send.disabled = true;
      var parent = st.replyTo ? (st.replyTo.parent_id || st.replyTo.id) : null;
      if (st.replyTo && st.replyTo.parent_id) body = '@' + C.user(st.replyTo.user_id).username + ' ' + body;
      var row = { user_id: C.uid, parent_id: parent, body: body }; row[o.fk] = o.id;
      var r = await sb.from(o.table).insert(row).select('*').single();
      if (r.error) { C.toast(C.err(r.error), 'bad'); send.disabled = false; return; }
      C.users[C.uid] = C.me.profile;
      if (parent) { (st.replies[parent] = st.replies[parent] || []).push(r.data); st.open[parent] = true; }
      else st.items.unshift(r.data);
      ta.value = ''; ta.style.height = 'auto'; setReply(null); render();
      if (o.onCount) o.onCount(1);
    });
    more.addEventListener('click', load);
    list.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var box = b.closest('.cmt'), id = box.getAttribute('data-id'), c = find(id), a = b.getAttribute('data-a');
      if (!c) return;
      if (a === 'toggle') { st.open[id] = !st.open[id]; render(); }
      else if (a === 'reply') setReply(c);
      else if (a === 'like') {
        var was = !!st.liked[id]; st.liked[id] = was ? 0 : 1; c.likes_count += was ? -1 : 1; render();
        var r = was ? await sb.from('comment_likes').delete().eq('user_id', C.uid).eq('comment_id', id) : await sb.from('comment_likes').insert({ user_id: C.uid, comment_id: id });
        if (r.error) { st.liked[id] = was ? 1 : 0; c.likes_count += was ? 1 : -1; render(); C.toast(C.err(r.error), 'bad'); }
      } else if (a === 'more') {
        var mine = c.user_id === C.uid;
        var pop = C.pop(b, (mine || C.isStaff() ? '<button data-x="del">' + C.icon('trash', { size: 18 }) + 'حذف</button>' : '') + '<button data-x="rep">' + C.icon('flag', { size: 18 }) + 'گزارش</button>');
        pop.addEventListener('click', async function (ev) {
          var x = ev.target.closest('[data-x]'); if (!x) return;
          if (x.getAttribute('data-x') === 'rep') return C.report(o.reportType, id);
          if (!(await C.confirm({ title: 'حذف نظر', text: 'این نظر حذف شود؟', ok: 'حذف', danger: true }))) return;
          var d = await sb.from(o.table).delete().eq('id', id);
          if (d.error) return C.toast(C.err(d.error), 'bad');
          var n = 1;
          if (c.parent_id) st.replies[c.parent_id] = (st.replies[c.parent_id] || []).filter(function (k) { return k.id !== id; });
          else { n += (st.replies[id] || []).length; st.items = st.items.filter(function (k) { return k.id !== id; }); delete st.replies[id]; }
          render(); if (o.onCount) o.onCount(-n);
        });
      }
    });
    load();
    return { destroy: function () { el.innerHTML = ''; } };
  }
})();
