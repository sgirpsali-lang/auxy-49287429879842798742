/* Auxy web: profiles + notifications */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, $ = C.$;
  A.mod.social = { profile: profile, notifications: notifications };
  var PCOLS = 'id,username,display_name,avatar_url,bio,role,is_banned,followers_count,following_count,posts_count,created_at';

  function tile(p) {
    var img = p.kind === 'image' ? p.media_url : p.poster_url;
    return '<a class="ptile" href="#/scroll/' + p.id + '" data-tilt="6">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '<div class="ptile-t"><p dir="auto">' + esc((p.caption || '').slice(0, 120)) + '</p></div>') +
      (p.kind === 'video' ? '<span class="ptile-v">' + C.icon('play', { size: 16, fill: true }) + '</span>' : '') +
      '<span class="ptile-l">' + C.icon('heart', { size: 14, fill: true }) + C.compact(p.likes_count) + '</span></a>';
  }
  function grid(list, emptyMsg) { return list.length ? '<div class="pgrid">' + list.map(tile).join('') + '</div>' : C.empty('scroll', emptyMsg); }

  async function profile(ctx) {
    var el = ctx.el, uname = String(ctx.params.name || '').toLowerCase();
    var r = await sb.from('profiles').select(PCOLS).eq('username', uname).maybeSingle();
    var p = r.data;
    if (!p) { el.innerHTML = '<div class="page-pad">' + C.empty('user', 'این کاربر پیدا نشد', '@' + uname, '<a class="btn primary" href="#/">بازگشت</a>') + '</div>'; return; }
    C.users[p.id] = p;
    var mine = p.id === C.uid; if (mine) p = Object.assign(p, C.me.profile);
    await C.loadFollowing();
    var pr = await sb.from('posts').select('id,kind,caption,media_url,poster_url,likes_count,comments_count,created_at').eq('user_id', p.id).order('created_at', { ascending: false }).limit(30);
    var posts = pr.data || [], tab = 'posts', saved = null;

    function head() {
      var fol = C.following.has(p.id);
      return '<header class="prof-h">' + C.avatar(p, 104) + '<div class="prof-i"><h1>' + esc(C.name(p)) + C.badge(p) + '</h1><small class="ltr">@' + esc(p.username) + '</small>' +
        (p.role !== 'user' ? ' <span class="role-tag">' + C.roleLabel(p.role) + '</span>' : '') + (p.bio ? '<p class="bio" dir="auto">' + C.linkify(p.bio) + '</p>' : '') +
        '<div class="prof-stats"><button data-a="followers"><b>' + C.compact(p.followers_count) + '</b> دنبال‌کننده</button><button data-a="following"><b>' + C.compact(p.following_count) + '</b> دنبال‌شده</button><span><b>' + C.compact(p.posts_count) + '</b> پست</span></div>' +
        '<div class="prof-btns">' + (mine ? '<a class="btn primary" href="#/settings/account">' + C.icon('edit', { size: 18 }) + 'ویرایش پروفایل</a><button class="btn glass" data-a="post">' + C.icon('plus', { size: 18 }) + 'پست جدید</button>'
          : '<button class="btn ' + (fol ? 'glass' : 'primary') + '" data-a="follow">' + (fol ? 'دنبال می‌کنی' : 'دنبال کن') + '</button><button class="btn glass" data-a="msg">' + C.icon('chat', { size: 18 }) + 'پیام</button>') +
        '<button class="btn glass" data-a="copylink" aria-label="کپی لینک">' + C.icon('link',{size:18}) + 'لینک</button><button class="btn glass icon" data-a="more" aria-label="بیشتر">' + C.icon('more', { size: 20 }) + '</button></div></div></header>';
    }
    function paint() {
      el.innerHTML = '<div class="prof">' + head() + (mine ? '<nav class="prof-tabs"><button data-t="posts" class="' + (tab === 'posts' ? 'on' : '') + '">' + C.icon('grid', { size: 18 }) + 'پست‌ها</button><button data-t="saved" class="' + (tab === 'saved' ? 'on' : '') + '">' + C.icon('list', { size: 18 }) + 'ذخیره‌شده</button></nav>' : '<div class="prof-line"></div>') +
        '<div id="pbody">' + (tab === 'posts' ? grid(posts, mine ? 'هنوز پستی نگذاشته‌ای.' : 'هنوز پستی نیست.') : (saved ? grid(saved, 'چیزی ذخیره نکرده‌ای.') : '<div class="sk sk-grid"></div>')) + '</div></div>';
    }
    async function list(kind) {
      var col = kind === 'followers' ? 'following_id' : 'follower_id', other = kind === 'followers' ? 'follower_id' : 'following_id';
      var q = await sb.from('follows').select(other).eq(col, p.id).limit(100), rows = q.data || [];
      await C.hydrate(rows, other);
      C.modal({ title: kind === 'followers' ? 'دنبال‌کننده‌ها' : 'دنبال‌شده‌ها', foot: false, body: rows.length ? '<div class="ulist">' + rows.map(function (x) { var u = C.user(x[other]); return '<a class="uitem" href="#/u/' + esc(u.username) + '" data-close>' + C.avatar(u, 42) + '<span><b>' + esc(C.name(u)) + C.badge(u) + '</b><small>@' + esc(u.username) + '</small></span></a>'; }).join('') + '</div>' : '<p class="chat-none">لیست خالی است.</p>' });
    }
    paint();
    el.addEventListener('click', async function (e) {
      var t = e.target.closest('[data-t]');
      if (t) {
        tab = t.getAttribute('data-t'); paint();
        if (tab === 'saved' && !saved) {
          var s = await sb.from('post_saves').select('post_id').eq('user_id', C.uid).order('created_at', { ascending: false }).limit(60), ids = (s.data || []).map(function (x) { return x.post_id; });
          saved = ids.length ? ((await sb.from('posts').select('id,kind,caption,media_url,poster_url,likes_count,comments_count,created_at').in('id', ids)).data || []) : [];
          if (tab === 'saved') paint();
        }
        return;
      }
      var b = e.target.closest('[data-a]'); if (!b) return; var a = b.getAttribute('data-a');
      if (a === 'follow') { var on = await C.toggleFollow(p.id); p.followers_count += on ? 1 : -1; paint(); }
      else if (a === 'msg') { var r2 = await sb.rpc('start_direct_chat', { p_user: p.id }); if (r2.error) return C.toast(C.err(r2.error), 'bad'); C.go('/chat/' + r2.data); }
      else if (a === 'followers' || a === 'following') list(a);
      else if (a === 'post') { await C.load('feed'); A.feed.compose(function (np) { posts.unshift(np); p.posts_count++; C.me.profile.posts_count++; paint(); }); }
      else if (a === 'copylink') { C.copy(C.publicUrl(p.username)); }
      else if (a === 'more') {
        var pop = C.pop(b, '<button data-x="share">' + C.icon('share', { size: 18 }) + 'اشتراک‌گذاری پروفایل</button>' + (!mine ? '<button data-x="rep">' + C.icon('flag', { size: 18 }) + 'گزارش کاربر</button>' : ''));
        pop.addEventListener('click', function (ev) { var x = ev.target.closest('[data-x]'); if (!x) return; x = x.getAttribute('data-x'); if (x === 'share') C.share(C.publicUrl(p.username), C.name(p)); else C.report('user', p.id); });
      }
    });
  }

  var TXT = { follow: 'شروع به دنبال کردن تو کرد', post_like: 'پست تو را پسندید', post_comment: 'برای پست تو نظر گذاشت', comment_reply: 'به نظر تو پاسخ داد' };
  async function notifications(ctx) {
    var el = ctx.el;
    async function load() {
      var r = await sb.from('notifications').select('*').eq('user_id', C.uid).order('created_at', { ascending: false }).limit(50), rows = r.data || [];
      await C.hydrate(rows, 'actor_id');
      el.innerHTML = '<div class="page-pad narrow"><h1 class="page-h">اعلان‌ها</h1>' + (rows.length ? '<div class="nlist">' + rows.map(function (n) {
        var u = C.user(n.actor_id), href = n.type === 'follow' ? '#/u/' + esc(u.username) : '#/scroll/' + n.post_id;
        return '<a class="nitem' + (n.read ? '' : ' new') + '" href="' + href + '">' + C.avatar(u, 44) + '<span><b>' + esc(C.name(u)) + '</b> ' + (TXT[n.type] || 'اعلان جدید') + '<time>' + C.ago(n.created_at) + '</time></span></a>';
      }).join('') + '</div>' : C.empty('bell', 'اعلانی نداری', 'وقتی کسی تو را دنبال کند یا پستت را ببیند، اینجا می‌بینی.')) + '</div>';
      if (rows.some(function (n) { return !n.read; })) {
        sb.from('notifications').update({ read: true }).eq('user_id', C.uid).eq('read', false).then(function () { });
        C.unread.notif = 0; C.emit('badges');
      }
    }
    await load();
    var off = C.on('notif', load);
    return off;
  }
})();
