/* Auxy web: settings */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, S = A.sec, sb = A.client, esc = C.esc, $ = C.$;
  A.mod.settings = { open: open };
  var SECS = [['account', 'حساب', 'user'], ['security', 'امنیت و دستگاه‌ها', 'lock'], ['appearance', 'ظاهر', 'sun'], ['performance', 'عملکرد و صرفه‌جویی', 'sparkle'], ['privacy', 'اعلان و حریم خصوصی', 'bell'], ['chat', 'چت و پیام', 'chat'], ['about', 'درباره', 'info']];
  var ACCENTS = [['white', '#ffffff', 'سفید'], ['blue', '#4f8cff', 'آبی'], ['violet', '#9b7bff', 'بنفش'], ['green', '#34d399', 'سبز'], ['rose', '#fb7185', 'صورتی'], ['amber', '#fbbf24', 'کهربایی']];

  function row(t, d, ctl) { return '<div class="srow"><div><b>' + t + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</div><div class="sctl">' + ctl + '</div></div>'; }
  function sw(k) { return '<label class="switch"><input type="checkbox" data-k="' + k + '"' + (C.settings[k] ? ' checked' : '') + '><i></i></label>'; }
  function seg(k, opts) { return '<div class="seg" data-k="' + k + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (String(C.settings[k]) === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  function refreshAvatar() { var b = $('#meBtn'); if (b) b.innerHTML = C.avatar(C.me.profile, 34); }

  async function open(ctx) {
    var el = ctx.el, sec = ctx.params.section, cur = SECS.filter(function (s) { return s[0] === sec; })[0] ? sec : 'account';
    el.innerHTML = '<div class="set"><nav class="set-nav" aria-label="بخش‌های تنظیمات">' + SECS.map(function (s) { return '<a href="#/settings/' + s[0] + '" class="' + (s[0] === cur ? 'on' : '') + '">' + C.icon(s[2], { size: 19 }) + '<span>' + s[1] + '</span></a>'; }).join('') + '</nav><div class="set-body"></div></div>';
    var body = $('.set-body', el), p = C.me.profile;
    var views = { account: account, security: security, appearance: appearance, performance: performance, privacy: privacy, chat: chatSettings, about: about };
    views[cur]();

    el.addEventListener('change', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (k && e.target.type === 'checkbox') { var o = {}; o[k] = e.target.checked; C.saveSettings(o); } });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.seg button'), sc = e.target.closest('.sw-color');
      if (b) { var g = b.parentNode, o = {}; o[g.getAttribute('data-k')] = b.getAttribute('data-v'); C.saveSettings(o); C.$$('button', g).forEach(function (x) { x.classList.toggle('on', x === b); }); }
      if (sc) { C.saveSettings({ accent: sc.getAttribute('data-v') }); C.$$('.sw-color', el).forEach(function (x) { x.classList.toggle('on', x === sc); }); }
    });

    /* ---------- account ---------- */
    function account() {
      body.innerHTML = '<h1 class="page-h">حساب</h1><div class="scard"><div class="prof-edit"><label class="av-edit" title="تغییر عکس">' + C.avatar(p, 88) + '<span>' + C.icon('image', { size: 18 }) + '</span><input type="file" id="avf" accept="image/jpeg,image/png,image/webp" hidden></label>' +
        '<div><b class="ltr">@' + esc(p.username) + '</b><small>' + esc(C.me.email || '') + ' · ' + C.roleLabel(p.role) + '</small></div></div>' +
        '<label class="field"><span>نام نمایشی</span><input class="input" id="dn" maxlength="40" value="' + esc(p.display_name || '') + '"></label>' +
        '<label class="field"><span>درباره‌ی من <em id="bc"></em></span><textarea class="input" id="bio" rows="3" maxlength="160">' + esc(p.bio || '') + '</textarea></label>' +
        '<div class="form-err" id="aerr" hidden></div><button class="btn primary" id="save">ذخیره</button></div>' +
        '<div class="scard">' + row('نام کاربری', 'با رمز امنیتی تأیید می‌شود و هر ۱۴ روز یک‌بار قابل تغییر است.', '<button class="btn glass" id="chun">تغییر</button>') + row('لینک عمومی پروفایل', 'آدرس کوتاه و رسمی حساب در Auxy.', '<button class="btn glass" id="copyPublic">کپی لینک</button>') + '</div>';
      var bio = $('#bio', body), bc = $('#bc', body); function cnt() { bc.textContent = C.fa(bio.value.length) + '/۱۶۰'; } bio.addEventListener('input', cnt); cnt();
      async function saveProfile(url) {
        var r = await sb.rpc('update_profile', { p_display_name: $('#dn', body).value, p_bio: bio.value, p_avatar_url: url === undefined ? (p.avatar_url || '') : url });
        if (r.error || !r.data || !r.data.ok) { var er = $('#aerr', body); er.textContent = r.data && r.data.code === 'bio_long' ? 'متن درباره‌ی من خیلی بلند است.' : C.err(r.error); er.hidden = false; return false; }
        p.display_name = $('#dn', body).value.trim() || null; p.bio = bio.value.trim() || null; if (url !== undefined) p.avatar_url = url || null; C.users[p.id] = p; refreshAvatar(); return true;
      }
      $('#save', body).addEventListener('click', async function () { $('#aerr', body).hidden = true; if (await saveProfile()) C.toast('ذخیره شد'); });
      $('#copyPublic', body).addEventListener('click', function(){ C.copy(C.publicUrl(p.username)); });
      $('#avf', body).addEventListener('change', async function (e) {
        var f = e.target.files[0]; if (!f) return;
        try { C.toast('در حال آپلود…'); var up = await C.upload('avatars', await C.compress(f, 512, .85)); if (await saveProfile(up.url)) { C.toast('عکس پروفایل عوض شد'); account(); } } catch (er) { C.toast(C.err(er), 'bad'); }
      });
      $('#chun', body).addEventListener('click', function () {
        var m = C.modal({
          title: 'تغییر نام کاربری', body: '<label class="field"><span>نام کاربری جدید</span><div class="un-wrap"><b>@</b><input class="input ltr" id="nun" maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false"></div></label><div class="un-status" id="nus"></div>',
          actions: [{ label: 'انصراف', onClick: function (a) { a.close(); } }, {
            label: 'ادامه', kind: 'primary', onClick: async function (a, btn) {
              var u = $('#nun', m.el).value.toLowerCase(), st = $('#nus', m.el), e0 = S.usernameError(u);
              if (e0) { st.className = 'un-status bad'; st.textContent = S.usernameMsg(e0); return; }
              btn.disabled = true; var ck = await S.checkUsername(u); btn.disabled = false;
              if (!ck.ok) { st.className = 'un-status bad'; st.textContent = S.usernameMsg(ck.code); return; }
              a.close();
              var res = await S.askPassword({ title: 'تأیید تغییر نام کاربری', desc: 'برای تغییر به @' + u + ' رمز فعلی حساب را وارد کنید.', confirm: 'تغییر بده', submit: async function (pw) {
                try { await A.verifyPassword(pw); } catch (e) { return { ok: false, code: e.code === 'invalid_credentials' ? 'wrong' : 'auth' }; }
                var r = await sb.rpc('change_username_native', { p_username: u });
                return r.data || { ok: false, code: r.error ? (r.error.message || 'error') : 'error' };
              } });
              if (res && res.ok) { p.username = res.username; C.users[p.id] = p; C.toast('نام کاربری عوض شد'); account(); }
            }
          }]
        });
      });
    }

    /* ---------- security ---------- */
    function security() {
      body.innerHTML = '<h1 class="page-h">امنیت و دستگاه‌ها</h1><div class="scard" id="devices"><div class="sk sk-rows"></div></div>' +
        '<div class="scard">' + row('رمز عبور', 'رمز اصلی ورود به حساب.', '<button class="btn glass" id="cpw">تغییر رمز</button>') +
        row('خروج از این دستگاه', '', '<button class="btn glass" id="so">خروج</button>') +
        row('خروج از همه دستگاه‌ها', 'همه نشست‌های Auxy بسته می‌شوند.', '<button class="btn glass" id="soa">خروج از همه</button>') + '</div>' +
        '<div class="scard danger">' + row('حذف حساب', 'همه‌ی اطلاعات حساب به‌صورت دائمی حذف می‌شود.', '<button class="btn danger" id="del">حذف حساب</button>') + '</div>';
      $('#so', body).addEventListener('click', function () { A.signOut(); });
      $('#soa', body).addEventListener('click', async function () { if (await C.confirm({ title: 'خروج از همه دستگاه‌ها', text: 'نشست‌های Auxy روی این حساب بسته می‌شوند.', ok: 'خروج' })) A.signOutEverywhere(); });
      $('#del', body).addEventListener('click', async function(){ if(!(await C.confirm({title:'حذف حساب',text:'این عملیات برگشت‌پذیر نیست.',ok:'حذف حساب',danger:true})))return;var r=await sb.rpc('delete_my_account_native');if(r.error)return C.toast(C.err(r.error),'bad');A.signOut(); });
      $('#cpw', body).addEventListener('click', function () {
        var meter, m = C.modal({
          title: 'تغییر رمز عبور', body: S.pwField('op', 'رمز فعلی', 'current-password') + S.pwField('np', 'رمز جدید', 'new-password') + S.pwField('np2', 'تکرار رمز جدید', 'new-password') + '<div id="mtr"></div><div class="form-err" id="cerr" hidden></div>',
          actions: [{ label: 'انصراف', onClick: function (a) { a.close(); } }, { label: 'تغییر رمز', kind: 'primary', onClick: async function (a, btn) {
            var er=$('#cerr',m.el),o=$('#op',m.el).value,n=$('#np',m.el).value,n2=$('#np2',m.el).value;er.hidden=true;var q=meter.update(n);if(!o){er.textContent='رمز فعلی را وارد کن.';er.hidden=false;return;}if(!q.ok){er.textContent='رمز جدید هنوز به‌اندازه‌ی کافی قوی نیست.';er.hidden=false;return;}if(n!==n2){er.textContent='تکرار رمز یکی نیست.';er.hidden=false;return;}btn.disabled=true;try{await A.changePassword(o,n);C.toast('رمز عبور عوض شد.');a.close();}catch(e){er.textContent=e.code==='invalid_credentials'?'رمز فعلی نادرست است.':'تغییر رمز انجام نشد.';er.hidden=false;}btn.disabled=false;
          }}]
        });
        S.wireEyes(m.el); meter=S.meter($('#mtr',m.el),function(){return{username:p.username,email:C.me.email};});$('#np',m.el).addEventListener('input',function(e){meter.update(e.target.value);});
      });
      (async function(){
        var d=$('#devices',body),r=await sb.rpc('list_my_devices');
        if(r.error){d.innerHTML='<b>دستگاه‌ها</b><p class="muted">'+esc(C.err(r.error))+'</p>';return;}
        var key=C.deviceKey(); d.innerHTML='<h3>دستگاه‌های فعال</h3><p class="muted">هر دستگاه نشست جداگانه دارد و می‌توانی دسترسی آن را خاتمه بدهی.</p>'+(r.data||[]).map(function(x){return '<div class="device-row"><div><b>'+esc(x.label||'دستگاه')+(x.device_key===key?'<span class="tag ok"> این دستگاه</span>':'')+'</b><small dir="ltr">'+esc((x.user_agent||'').slice(0,120))+'</small><time>'+esc(new Date(x.last_seen_at).toLocaleString('fa-IR'))+'</time></div>'+(x.revoked_at?'<span class="tag danger">خاتمه یافته</span>':'<button class="btn ghost mini" data-revoke="'+x.id+'">خاتمه</button>')+'</div>';}).join('')||'<p class="muted">دستگاهی ثبت نشده.</p>';
        d.addEventListener('click',async function(e){var b=e.target.closest('[data-revoke]');if(!b)return;var id=b.getAttribute('data-revoke'),rowEl=b.closest('.device-row'),target=(r.data||[]).filter(function(x){return x.id===id;})[0];var rr=await sb.rpc('revoke_device',{p_device:id});if(rr.error)return C.toast(C.err(rr.error),'bad');if(target&&target.device_key===key){await A.signOut();return;}rowEl.querySelector('button')?.remove();var s=document.createElement('span');s.className='tag danger';s.textContent='خاتمه یافته';rowEl.appendChild(s);});
      })();
    }

    /* ---------- chat settings ---------- */
    function chatSettings() {
      body.innerHTML = '<h1 class="page-h">چت و پیام</h1><div class="scard">' +
        row('نمایش پیش‌نمایش لینک', 'لینک‌های متنی همچنان قابل کلیک هستند.', sw('linkPreview')) +
        row('ارسال با Enter', 'با Shift+Enter خط جدید بساز.', sw('enterSend')) +
        row('علامت خوانده‌شدن', 'علامت‌های ارسال و خوانده‌شدن پیام‌ها نمایش داده شود.', sw('readMarks')) +
        row('پخش خودکار ویس', 'ویس‌ها خودکار پخش نشوند.', sw('voiceAuto')) +
        row('باز کردن لینک خارجی داخل Auxy', 'اول لینک را در مرورگر داخلی باز کن.', sw('inAppBrowser')) + '</div>';
    }

    /* ---------- appearance / performance / privacy / about ---------- */
    function appearance() {
      body.innerHTML = '<h1 class="page-h">ظاهر</h1><div class="scard">' + row('تم', '', seg('theme', [['dark', 'تاریک'], ['light', 'روشن'], ['system', 'مثل سیستم']])) +
        row('رنگ تأکید', 'رنگ دکمه‌ها و نشان‌ها', '<div class="swatches">' + ACCENTS.map(function (a) { return '<button type="button" class="sw-color' + (C.settings.accent === a[0] ? ' on' : '') + '" data-v="' + a[0] + '" style="--c:' + a[1] + '" aria-label="' + a[2] + '"></button>'; }).join('') + '</div>') +
        row('اندازه‌ی نوشته', '', seg('font', [['sm', 'کوچک'], ['md', 'متوسط'], ['lg', 'بزرگ']])) + row('نمای فشرده', 'فاصله‌ها کمتر می‌شود', sw('compact')) + '</div>';
    }
    function performance() {
      body.innerHTML = '<h1 class="page-h">عملکرد و صرفه‌جویی</h1><div class="scard">' + row('انیمیشن‌ها', 'حالت «کم» یا «خاموش» برای گوشی‌های ضعیف‌تر و مصرف باتری کمتر.', seg('motion', [['full', 'کامل'], ['reduced', 'کم'], ['off', 'خاموش']])) +
        row('صرفه‌جویی در مصرف اینترنت', 'پخش خودکار ویدیوها را خاموش می‌کند و کمتر پیش‌بارگذاری می‌کند.', sw('saver')) + row('پخش خودکار در اسکرول', '', sw('autoplayFeed')) + row('شروع ویدیوها بدون صدا', '', sw('muteFeed')) + '</div>' +
        '<div class="scard">' + row('بازنشانی تنظیمات', 'همه‌ی تنظیمات به حالت پیش‌فرض برمی‌گردد.', '<button class="btn glass" id="rs">بازنشانی</button>') + '</div>';
      $('#rs', body).addEventListener('click', async function () { if (await C.confirm({ title: 'بازنشانی', text: 'همه‌ی تنظیمات به حالت پیش‌فرض برگردد؟', ok: 'بازنشانی' })) { C.saveSettings({ theme: 'dark', accent: 'white', motion: 'full', font: 'md', saver: false, autoplayFeed: true, muteFeed: true, sounds: true, showOnline: true, compact: false }); performance(); } });
    }
    function privacy() {
      body.innerHTML = '<h1 class="page-h">اعلان و حریم خصوصی</h1><div class="scard">' + row('صدای اعلان و پیام', '', sw('sounds')) + row('نمایش وضعیت آنلاین', 'اگر خاموش باشد بقیه نمی‌بینند تو آنلاین هستی.', sw('showOnline')) + '</div>';
    }
    function about() {
      body.innerHTML = '<h1 class="page-h">درباره</h1><div class="scard"><div class="about-l">' + C.logo() + '</div>' + row('نسخه‌ی وب', '', '<span class="ltr">Auxy Web v1</span>') +
        row('قوانین و مقررات', '', '<a class="btn glass" href="https://auxy.ir/terms" target="_blank" rel="noopener">مشاهده</a>') + row('حریم خصوصی', '', '<a class="btn glass" href="https://auxy.ir/privacy" target="_blank" rel="noopener">مشاهده</a>') + row('سایت Auxy', '', '<a class="btn glass" href="https://auxy.ir" target="_blank" rel="noopener">auxy.ir</a>') + '</div>';
    }
  }
})();
