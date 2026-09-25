/* Auxy web: owner/admin panel */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, S = A.sec, sb = A.client, esc = C.esc, $ = C.$;
  A.mod.admin = { open: open };
  var FIXED_ADMINS = ['ali','support','auxy'];
  var SECS = [['overview', 'نمای کلی', 'grid'], ['users', 'کاربران', 'users'], ['reports', 'گزارش‌ها', 'flag']];

  async function open(ctx) {
    var el = ctx.el;
    if (!C.isOwner() && !C.isStaff()) { el.innerHTML = C.empty('lock', 'دسترسی ندارید', '', '<a class="btn primary" href="#/">بازگشت</a>'); return; }
    var secs = C.isOwner() ? SECS : SECS.filter(function (s) { return s[0] !== 'users'; });
    var myUsername = String(C.me && C.me.profile && C.me.profile.username || '').toLowerCase();
    var adminLabel = FIXED_ADMINS.indexOf(myUsername) >= 0 ? 'ادمین Auxy' : (C.isOwner() ? 'پنل مالک' : 'پنل ناظر');
    async function authRetry(task) {
      var r = await task();
      if (r && r.error && /JWT|401|PGRST301|expired|invalid.*token/i.test(String(r.error.message || r.error))) {
        try { await sb.auth.refreshSession(); } catch (_) {}
        r = await task();
      }
      return r;
    }
    function showLoadError(host, e, retry) {
      host.innerHTML = C.empty('info', 'داده‌ها بارگذاری نشد', C.err(e), '<button class="btn primary" data-retry="' + (retry || '') + '">تلاش دوباره</button>');
    }
    var cur = secs.some(function (s) { return s[0] === ctx.params.section; }) ? ctx.params.section : 'overview';
    el.innerHTML = '<div class="studio"><div class="page-h" style="margin-bottom:10px">' + esc(adminLabel) + '</div><nav class="set-nav">' + secs.map(function (s) { return '<a href="#/admin/' + s[0] + '" class="' + (s[0] === cur ? 'on' : '') + '">' + C.icon(s[2], { size: 19 }) + '<span>' + s[1] + '</span></a>'; }).join('') + '</nav><div class="set-body"></div></div>';
    var body = $('.set-body', el);
    body.addEventListener('click', function(e){ var b=e.target.closest('[data-retry]'); if(!b)return; var k=b.getAttribute('data-retry')||cur; (k==='overview'?overview:k==='users'?users:reports)(); });
    (cur === 'overview' ? overview : cur === 'users' ? users : reports)();

    async function overview() {
      body.innerHTML = '<h1 class="page-h">نمای کلی</h1><div class="stat-grid" id="sg"><div class="sk sk-grid"></div></div>';
      var r = await authRetry(function(){ return sb.rpc('admin_stats'); }); if (r.error) { showLoadError(body,r.error,'overview'); return; }
      var d = r.data, cards = [['کاربران', d.users], ['امروز', d.users_today], ['مسدود', d.banned], ['فیلم‌ها', d.movies], ['پست‌ها', d.posts], ['نظرها', d.comments], ['پیام‌ها', d.messages], ['گزارش باز', d.reports_open], ['تبلیغ فعال', d.ads_active], ['نمایش تبلیغ', d.ad_views]];
      $('#sg', body).innerHTML = cards.map(function (c) { return '<div class="stat-card"><b>' + C.compact(c[1]) + '</b><span>' + c[0] + '</span></div>'; }).join('');
    }

    async function users() {
      if (!C.isOwner()) return;
      body.innerHTML = '<h1 class="page-h">کاربران</h1><div class="chat-search wide"><input type="search" id="uq" placeholder="جستجو با نام کاربری، نام یا ایمیل"></div><div id="ul"><div class="sk sk-rows"></div></div>';
      var q = '';
      async function load() {
        var r = await authRetry(function(){ return sb.rpc('admin_list_users', { p_q: q, p_limit: 50, p_offset: 0 }); }); if (r.error) { showLoadError($('#ul',body),r.error,'users'); return; }
        var rows = r.data || [];
        $('#ul', body).innerHTML = rows.length ? '<div class="table"><div class="tr th"><span>کاربر</span><span>نقش</span><span>ایمیل</span><span>وضعیت</span><span></span></div>' +
          rows.map(function (u) { return '<div class="tr" data-id="' + u.id + '"><span class="ttitle">' + C.avatar(u, 34) + '<b>' + esc(C.name(u) || '—') + '</b><small class="ltr">@' + esc(u.username || '—') + '</small></span>' +
            '<span><em class="tag ' + (u.role === 'owner' ? 'feat' : u.role === 'publisher' ? 'ok' : '') + '">' + C.roleLabel(u.role) + '</em></span><span class="ltr small">' + esc(u.email || '—') + '</span>' +
            '<span>' + (u.is_banned ? '<em class="tag danger">مسدود</em>' : '<em class="tag ok">عادی</em>') + '</span><span class="tacts"><button class="icon-btn" data-a="menu" aria-label="گزینه‌ها">' + C.icon('more', { size: 18 }) + '</button></span></div>'; }).join('') + '</div>' : C.empty('users', 'کاربری پیدا نشد');
      }
      $('#uq', body).addEventListener('input', C.debounce(function (e) { q = e.target.value.trim(); load(); }, 350));
      $('#ul', body).addEventListener('click', function (e) {
        var b = e.target.closest('[data-a=menu]'); if (!b) return;
        var id = b.closest('.tr').getAttribute('data-id');
        if (id === C.uid) return C.toast('روی حساب خودت نمی‌شود', 'bad');
        var pop = C.pop(b,
          '<button data-x="role" data-r="user">' + C.icon('user', { size: 18 }) + 'نقش: کاربر عادی</button>' +
          '<button data-x="role" data-r="publisher">' + C.icon('film', { size: 18 }) + 'نقش: ناشر</button>' +
          '<button data-x="role" data-r="moderator">' + C.icon('shield', { size: 18 }) + 'نقش: ناظر</button><hr>' +
          '<button data-x="ban">' + C.icon('ban', { size: 18 }) + 'مسدود / رفع مسدودی</button>' +
          '<button data-x="pw">' + C.icon('key', { size: 18 }) + 'بازنشانی رمز امنیتی</button>' +
          '<button data-x="del" class="danger">' + C.icon('trash', { size: 18 }) + 'حذف حساب</button>');
        pop.addEventListener('click', async function (ev) {
          var x = ev.target.closest('[data-x]'); if (!x) return; var act = x.getAttribute('data-x');
          if (act === 'role') { var r = await authRetry(function(){ return sb.rpc('admin_set_role', { p_user: id, p_role: x.getAttribute('data-r') }); }); if (r.error || !(r.data && r.data.ok)) return C.toast(C.err(r.error || (r.data && r.data.code) || 'خطا'), 'bad'); C.toast('نقش عوض شد'); load(); }
          else if (act === 'pw') { if (!(await C.confirm({ title: 'بازنشانی رمز', text: 'کاربر باید هنگام ورود بعدی رمز جدید بسازد.', ok: 'بازنشانی' }))) return; var r2 = await authRetry(function(){ return sb.rpc('admin_reset_password', { p_user: id }); }); if (r2.error) return C.toast(C.err(r2.error), 'bad'); C.toast('رمز بازنشانی شد'); }
          else if (act === 'ban') {
            var m = C.modal({ title: 'مسدود کردن یا رفع مسدودی', body: '<label class="field"><span>دلیل (در صورت مسدود کردن)</span><textarea class="input" id="br" rows="2" maxlength="300"></textarea></label>',
              actions: [{ label: 'رفع مسدودی', onClick: async function (a) { var r3 = await sb.rpc('admin_set_ban', { p_user: id, p_banned: false, p_reason: null }); if (r3.error || !(r3.data && r3.data.ok)) return C.toast(C.err(r3.error || (r3.data && r3.data.code) || 'خطا'), 'bad'); a.close(); C.toast('رفع مسدودی شد'); load(); } },
                { label: 'مسدود کن', kind: 'danger', onClick: async function (a) { var r3 = await sb.rpc('admin_set_ban', { p_user: id, p_banned: true, p_reason: $('#br', m.el).value.trim() }); if (r3.error || !(r3.data && r3.data.ok)) return C.toast(C.err(r3.error || (r3.data && r3.data.code) || 'خطا'), 'bad'); a.close(); C.toast('کاربر مسدود شد'); load(); } }] });
          } else if (act === 'del') {
            if (!(await C.confirm({ title: 'حذف حساب کاربر', text: 'این حساب برای همیشه حذف شود؟', ok: 'حذف', danger: true }))) return;
            var r4 = await authRetry(function(){ return sb.rpc('admin_delete_user', { p_user: id }); }); if (r4.error || !(r4.data && r4.data.ok)) return C.toast(C.err(r4.error || (r4.data && r4.data.code) || 'خطا'), 'bad'); C.toast('حساب حذف شد'); load();
          }
        });
      });
      load().catch(function(e){ showLoadError($('#ul',body),e,'users'); });
    }

    async function reports() {
      body.innerHTML = '<h1 class="page-h">گزارش‌ها</h1><div id="rl"><div class="sk sk-rows"></div></div>';
      var r = await authRetry(function(){ return sb.from('reports').select('*').order('created_at', { ascending: false }).limit(80); });
      if (r.error) { showLoadError($('#rl',body),r.error,'reports'); return; }
      var rows = r.data || [];
      try { await C.hydrate(rows, 'reporter_id'); } catch(e) { showLoadError($('#rl',body),e,'reports'); return; }
      $('#rl', body).innerHTML = rows.length ? '<div class="table"><div class="tr th"><span>گزارش‌دهنده</span><span>نوع</span><span>دلیل</span><span>وضعیت</span><span></span></div>' +
        rows.map(function (rp) { var u = C.user(rp.reporter_id); return '<div class="tr" data-id="' + rp.id + '"><span>@' + esc(u.username) + '</span><span>' + esc(rp.target_type) + '</span><span class="small">' + esc(rp.reason) + '</span>' +
          '<span><em class="tag ' + (rp.status === 'open' ? 'draft' : 'ok') + '">' + (rp.status === 'open' ? 'باز' : rp.status === 'done' ? 'بررسی‌شد' : 'رد‌شد') + '</em></span>' +
          (rp.status === 'open' ? '<span class="tacts"><button class="icon-btn" data-a="done" aria-label="بررسی‌شد">' + C.icon('check', { size: 18 }) + '</button><button class="icon-btn" data-a="dismiss" aria-label="رد">' + C.icon('x', { size: 18 }) + '</button></span>' : '<span></span>') + '</div>'; }).join('') + '</div>' : C.empty('flag', 'گزارشی نیست');
      $('#rl', body).addEventListener('click', async function (e) {
        var b = e.target.closest('[data-a]'); if (!b) return; var id = b.closest('.tr').getAttribute('data-id'), st = b.getAttribute('data-a') === 'done' ? 'done' : 'dismissed';
        var d = await sb.from('reports').update({ status: st }).eq('id', id); if (d.error) return C.toast(C.err(d.error), 'bad'); reports();
      });
    }
  }
})();
