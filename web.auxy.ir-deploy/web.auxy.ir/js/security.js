/* Auxy web: security helpers (username rules, password strength, re-auth prompt) */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, S = A.sec = {};

  /* =============== usernames =============== */
  var UMSG = {
    empty: 'نام کاربری را وارد کنید.',
    too_short: 'نام کاربری باید حداقل ۳ حرف باشد.',
    too_long: 'نام کاربری نباید بیشتر از ۲۴ حرف باشد.',
    spaces: 'نام کاربری نباید فاصله داشته باشد.',
    invalid_chars: 'فقط حروف انگلیسی، عدد و _ مجاز است.',
    edge_underscore: 'نام کاربری نباید با _ شروع یا تمام شود.',
    double_underscore: 'دو _ پشت سر هم مجاز نیست.',
    needs_letter: 'نام کاربری باید حداقل یک حرف انگلیسی داشته باشد.',
    reserved: 'این نام کاربری رزرو شده و قابل انتخاب نیست.',
    taken: 'این نام کاربری قبلاً گرفته شده است.',
    cooldown: 'نام کاربری را هر ۱۴ روز فقط یک‌بار می‌شود عوض کرد.',
    auth: 'نشست شما منقضی شده. دوباره وارد شوید.',
    error: 'بررسی انجام نشد. دوباره تلاش کنید.',
    already_set: 'نام کاربری قبلاً انتخاب شده است.'
  };
  S.usernameMsg = function (c) { return UMSG[c] || UMSG.error; };
  S.usernameError = function (raw) {
    var u = String(raw || '').toLowerCase();
    if (!u) return 'empty';
    if (/\s/.test(u)) return 'spaces';
    if (u.length < 3) return 'too_short';
    if (u.length > 24) return 'too_long';
    if (!/^[a-z0-9_]+$/.test(u)) return 'invalid_chars';
    if (/^_|_$/.test(u)) return 'edge_underscore';
    if (/__/.test(u)) return 'double_underscore';
    if (!/[a-z]/.test(u)) return 'needs_letter';
    return null;
  };
  S.usernameRules = function (raw) {
    var u = String(raw || '').toLowerCase();
    return [
      { ok: u.length >= 3, label: 'حداقل ۳ حرف' },
      { ok: u.length > 0 && /^[a-z0-9_]+$/.test(u), label: 'فقط حروف انگلیسی، عدد و _' },
      { ok: u.length > 0 && !/\s/.test(u), label: 'بدون فاصله' },
      { ok: u.length > 0 && !/^_|_$|__/.test(u), label: 'بدون _ در ابتدا/انتها و بدون __ پشت‌سرهم' },
      { ok: /[a-z]/.test(u), label: 'حداقل یک حرف انگلیسی' }
    ];
  };
  S.checkUsername = async function (u) {
    var r = await sb.rpc('check_username', { p_username: u });
    if (r.error) return { ok: false, code: 'error' };
    return r.data || { ok: false, code: 'error' };
  };

  /* =============== password strength =============== */
  var COMMON = ['password', 'passw0rd', 'qwerty', 'qwertyuiop', 'letmein', 'iloveyou', 'admin', 'administrator', 'welcome', 'monkey', 'dragon',
    'football', 'baseball', 'abc123', 'trustno1', 'sunshine', 'princess', 'master', 'shadow', 'superman', 'michael', 'login', 'starwars',
    'hello', 'freedom', 'whatever', 'qazwsx', 'asdfghjkl', 'zaq1zaq1', 'changeme', 'default', 'secret', 'auxy', 'auxyauxy', 'iran', 'tehran',
    'ali', 'mohammad', 'hossein', 'reza', 'jooon', 'khoda', 'salam', 'irani', '123456', '12345678', '123456789', '1234567890', '1q2w3e4r',
    '1q2w3e4r5t', '111111', '11111111', '000000', '00000000', '123123', '654321', 'passpass', 'pass1234', 'test1234', 'user1234', 'aaaaaa'];
  function leet(s) {
    return s.toLowerCase().replace(/@/g, 'a').replace(/\$/g, 's').replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/!/g, 'i');
  }
  S.isCommon = function (pw) {
    var l = pw.toLowerCase(), n = leet(l).replace(/[^a-z]/g, ''), base = l.replace(/[^a-z0-9]+$/, '').replace(/[0-9]+$/, '');
    return COMMON.some(function (c) {
      return l === c || n === c || base === c || (c.length >= 5 && l.indexOf(c) === 0 && l.length <= c.length + 3);
    });
  };
  var ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'abcdefghijklmnopqrstuvwxyz'];
  S.hasPattern = function (pw) {
    var l = pw.toLowerCase();
    if (/(.)\1\1/.test(l)) return true;
    var run = 1, dir = 0;
    for (var i = 1; i < l.length; i++) {
      var d = l.charCodeAt(i) - l.charCodeAt(i - 1);
      if ((d === 1 || d === -1) && /[a-z0-9]/.test(l[i]) && /[a-z0-9]/.test(l[i - 1])) { run = (d === dir) ? run + 1 : 2; dir = d; } else { run = 1; dir = 0; }
      if (run >= 4) return true;
    }
    for (var r = 0; r < ROWS.length; r++) {
      for (var k = 0; k + 4 <= ROWS[r].length; k++) {
        var seg = ROWS[r].slice(k, k + 4);
        if (l.indexOf(seg) > -1 || l.indexOf(seg.split('').reverse().join('')) > -1) return true;
      }
    }
    return false;
  };
  var LABELS = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی', 'خیلی قوی'];
  S.strength = function (pw, ctx) {
    pw = String(pw || ''); ctx = ctx || {};
    var len = pw.length, lower = /[a-z]/.test(pw), upper = /[A-Z]/.test(pw), digit = /\d/.test(pw), sym = /[^A-Za-z0-9]/.test(pw);
    var classes = (lower ? 1 : 0) + (upper ? 1 : 0) + (digit ? 1 : 0) + (sym ? 1 : 0);
    var pool = (lower ? 26 : 0) + (upper ? 26 : 0) + (digit ? 10 : 0) + (sym ? 33 : 0);
    var bits = pool ? len * Math.log2(pool) : 0;
    var uniq = new Set(pw.split('')).size;
    if (len && uniq < len * .6) bits *= uniq / (len * .6);
    var common = len > 0 && S.isCommon(pw), pattern = len > 0 && S.hasPattern(pw);
    if (common) bits = Math.min(bits, 12);
    if (pattern) bits -= 12;
    var lp = pw.toLowerCase(), local = String(ctx.email || '').split('@')[0].toLowerCase();
    var ctxHit = len > 0 && ((ctx.username && ctx.username.length >= 3 && lp.indexOf(ctx.username.toLowerCase()) > -1) || (local.length >= 3 && lp.indexOf(local) > -1));
    if (ctxHit) bits -= 14;
    bits = Math.max(0, bits);
    var score = !len ? -1 : bits < 28 ? 0 : bits < 40 ? 1 : bits < 54 ? 2 : bits < 70 ? 3 : 4;
    var checks = [
      { k: 'len', ok: len >= 10 },
      { k: 'classes', ok: classes >= 3 },
      { k: 'common', ok: len > 0 && !common },
      { k: 'ctx', ok: len > 0 && !ctxHit },
      { k: 'pattern', ok: len > 0 && !pattern }
    ];
    var all = checks.every(function (c) { return c.ok; });
    return { score: score, label: score < 0 ? '—' : LABELS[score], bits: Math.round(bits), checks: checks, ok: all && score >= 3 };
  };
  var CHECK_LABELS = {
    len: 'حداقل ۱۰ نویسه',
    classes: 'ترکیب حداقل سه نوع: حرف کوچک، حرف بزرگ، عدد، نماد',
    common: 'رمز رایج و قابل‌حدس نباشد',
    ctx: 'شامل نام کاربری یا ایمیل شما نباشد',
    pattern: 'تکرار (aaa) یا الگوی ساده (1234، abcd، qwerty) نداشته باشد'
  };
  S.meter = function (root, ctxFn) {
    root.innerHTML = '<div class="pw-meter" data-level="-1"><div class="pw-bars"><i></i><i></i><i></i><i></i><i></i></div><span class="pw-label">—</span></div>' +
      '<ul class="pw-checks">' + ['len', 'classes', 'common', 'ctx', 'pattern'].map(function (k) { return '<li data-k="' + k + '">' + C.icon('check', { size: 14, sw: 2.6 }) + '<span>' + CHECK_LABELS[k] + '</span></li>'; }).join('') + '</ul>';
    var m = root.querySelector('.pw-meter'), lab = root.querySelector('.pw-label');
    return {
      update: function (pw) {
        var r = S.strength(pw, ctxFn ? ctxFn() : {});
        m.setAttribute('data-level', r.score); lab.textContent = r.label;
        r.checks.forEach(function (c) { root.querySelector('[data-k="' + c.k + '"]').classList.toggle('ok', c.ok); });
        return r;
      }
    };
  };
  S.generate = function (n) {
    n = n || 16;
    var L = 'abcdefghijkmnpqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', Y = '!@#$%^&*-_+=?', all = L + U + D + Y;
    function rnd(max) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; }
    for (var t = 0; t < 30; t++) {
      var out = [L[rnd(L.length)], U[rnd(U.length)], D[rnd(D.length)], Y[rnd(Y.length)]];
      while (out.length < n) out.push(all[rnd(all.length)]);
      for (var i = out.length - 1; i > 0; i--) { var j = rnd(i + 1), x = out[i]; out[i] = out[j]; out[j] = x; }
      var pw = out.join('');
      if (!S.hasPattern(pw)) return pw;
    }
    return out.join('');
  };
  S.pwMsg = function (r) {
    var m = {
      too_short: 'رمز باید حداقل ۱۰ نویسه باشد.', too_long: 'رمز خیلی بلند است.',
      weak_classes: 'رمز باید ترکیبی از حداقل سه نوع نویسه باشد.', common: 'این رمز خیلی رایج است.',
      contains_username: 'رمز نباید شامل نام کاربری باشد.', repeats: 'رمز نباید نویسه‌ی تکراری پشت‌سرهم داشته باشد.',
      no_password: 'رمز امنیتی هنوز تنظیم نشده است.', auth: 'نشست شما منقضی شده. دوباره وارد شوید.',
      self: 'روی حساب خودتان نمی‌شود.', owner: 'روی حساب مالک نمی‌شود.', no_username: 'ابتدا نام کاربری را انتخاب کنید.'
    };
    if (!r) return 'مشکلی پیش آمد.';
    if (r.code === 'wrong') return 'رمز اشتباه است. ' + (r.remaining ? C.fa(r.remaining) + ' تلاش دیگر باقی مانده.' : 'حساب برای ۱۵ دقیقه قفل شد.');
    if (r.code === 'locked') return 'به‌خاطر تلاش‌های ناموفق، تا ساعت ' + C.clock(r.locked_until) + ' قفل شده است.';
    if (r.code === 'cooldown') return 'نام کاربری را تا ' + new Date(r.retry_at).toLocaleDateString('fa-IR') + ' نمی‌شود عوض کرد.';
    return m[r.code] || UMSG[r.code] || 'مشکلی پیش آمد. دوباره تلاش کنید.';
  };

  /* =============== password field HTML + eye toggles =============== */
  S.pwField = function (id, label, autocomplete, extra) {
    return '<label class="field"><span>' + esc(label) + '</span><div class="pw-wrap"><input class="input ltr" id="' + id + '" type="password" autocomplete="' + (autocomplete || 'off') + '" spellcheck="false" autocapitalize="off" ' + (extra || '') + '>' +
      '<button type="button" class="icon-btn" data-eye="' + id + '" aria-label="نمایش رمز">' + C.icon('eye', { size: 18 }) + '</button></div></label>';
  };
  S.wireEyes = function (root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-eye]'); if (!b) return;
      var i = root.querySelector('#' + b.getAttribute('data-eye')); if (!i) return;
      var show = i.type === 'password'; i.type = show ? 'text' : 'password';
      b.innerHTML = C.icon(show ? 'eyeoff' : 'eye', { size: 18 });
    });
  };

  /* =============== re-auth prompt =============== */
  /* opts: { title, desc, confirm, danger, submit: async (password) => {ok, ...} }
     resolves with the successful result, or null if cancelled */
  S.askPassword = function (o) {
    return new Promise(function (res) {
      var done = false;
      var m = C.modal({
        title: o.title || 'تأیید با رمز امنیتی',
        body: '<p class="muted">' + esc(o.desc || 'برای ادامه، رمز امنیتی‌تان را وارد کنید.') + '</p>' + S.pwField('apw', 'رمز امنیتی', 'off') + '<div class="form-err" id="aerr" hidden></div>',
        onClose: function () { if (!done) res(null); },
        actions: [
          { label: 'انصراف', kind: 'ghost', onClick: function (a) { a.close(); } },
          {
            label: o.confirm || 'تأیید', kind: o.danger ? 'danger' : 'primary', onClick: async function (a, btn) {
              var pw = m.el.querySelector('#apw').value, err = m.el.querySelector('#aerr');
              if (!pw) { err.textContent = 'رمز را وارد کنید.'; err.hidden = false; return; }
              btn.disabled = true; err.hidden = true;
              try {
                var r = await o.submit(pw);
                if (r && r.ok) { done = true; res(r); a.close(); return; }
                err.textContent = S.pwMsg(r); err.hidden = false;
              } catch (e) { err.textContent = C.err(e); err.hidden = false; }
              btn.disabled = false;
            }
          }
        ]
      });
      S.wireEyes(m.el);
      m.el.querySelector('#apw').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); m.foot.querySelector('.btn:last-child').click(); } });
    });
  };
  S.verify = function (pw) { return A.verifyPassword(pw).catch(function (e) { return { ok: false, code: e.code || 'wrong', message: e.message }; }); };
})();
