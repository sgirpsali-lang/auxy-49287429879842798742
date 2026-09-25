/* Auxy web: direct chats, groups, channels, permissions, voice, saved messages */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, $ = C.$;
  A.mod.chat = { open: open, join: join, joinGroup: joinGroup };

  var EMOJI = ['😀','😂','😍','🥰','😎','🤔','😢','😭','😡','👍','👎','🙏','👏','🔥','💯','❤️','💔','🎉','🎬','🍿','⭐','✨','😴','🤝','🙌','😅','😉','😊','🤩','🥳','😱','🤯','🚀','✅','❌','💙','🫶','🥹','🤣','😘','😇','🤗','🤭','🫡','👀','🎊','🎈','❤️‍🔥','💀','😈','🤠','🧠','💎'];
  var currentCleanup = null;

  function findConv(id) { return (C.convs || []).filter(function (c) { return c.conv_id === id; })[0]; }
  function chatName(c) { return C.convName(c); }
  function convAvatar(c, s) {
    if (c && c.kind === 'system') return C.avatar({ system: true }, s);
    if (c && (c.kind === 'group' || c.kind === 'channel')) return C.avatar({ username: c.title || 'C', display_name: c.title || '', avatar_url: c.avatar_url }, s);
    return C.avatar(C.user(c && c.other_id), s);
  }
  function preview(c) {
    if (c.last_media && !c.last_body) return (c.last_sender === C.uid ? 'شما: ' : '') + (c.last_media.indexOf('voice') > -1 ? 'ویس' : 'رسانه');
    return (c.last_sender === C.uid ? 'شما: ' : '') + (c.last_body || 'گفتگو را شروع کن');
  }
  async function findUsers(q) {
    q = String(q || '').replace(/[%_,()\\]/g, ' ').trim();
    if (q.length < 2) return [];
    var r = await sb.from('profiles').select('id,username,display_name,avatar_url,role,followers_count').or('username.ilike.' + q + '%,display_name.ilike.%' + q + '%').neq('id', C.uid).limit(12);
    (r.data || []).forEach(function (u) { C.users[u.id] = u; });
    return r.data || [];
  }
  async function join(ctx) {
    var r = await sb.rpc('join_channel_invite', { p_token: String(ctx.params.token || '').trim() });
    if (r.error) { ctx.el.innerHTML = C.empty('link', 'لینک کانال معتبر نیست', C.err(r.error), '<a class="btn primary" href="#/chat">بازگشت</a>'); return; }
    await C.refreshBadges(); C.go('/chat/' + r.data);
  }
  async function joinGroup(ctx) {
    var r = await sb.rpc('join_group_invite', { p_token: String(ctx.params.token || '').trim() });
    if (r.error) { ctx.el.innerHTML = C.empty('link', 'لینک گروه معتبر نیست', C.err(r.error), '<a class="btn primary" href="#/chat">بازگشت</a>'); return; }
    await C.refreshBadges(); C.go('/chat/' + r.data);
  }

  function userPicker(o) {
    var chosen = [];
    var body = (o.group ?
      '<label class="field"><span>نام گروه</span><input class="input" id="gt" maxlength="60" placeholder="مثلاً دوستان فیلم"></label>' +
      '<label class="field"><span>Username عمومی (اختیاری)</span><div class="un-wrap"><b>@</b><input class="input ltr" id="gu" maxlength="24" autocomplete="off"></div></label>' +
      '<label class="field"><span>نوع گروه</span><select class="input" id="gp"><option value="private">گروه خصوصی</option><option value="public">گروه عمومی</option></select></label>' +
      '<label class="field"><span>توضیحات</span><textarea class="input" id="gd" rows="2" maxlength="500"></textarea></label>' : '') +
      '<label class="field"><span>' + (o.group ? 'اعضای اولیه' : 'جستجوی کاربر') + '</span><input class="input" id="uq" placeholder="username یا نام" autocomplete="off"></label><div class="chips" id="chips"></div><div class="ulist" id="ur"></div>';
    var m = C.modal({ wide: true, title: o.title, body: body, actions: o.group ? [
      { label: 'انصراف', onClick: function (a) { a.close(); } },
      { label: 'ساخت گروه', kind: 'primary', onClick: function (a, b) { o.done(m, chosen, b); } }
    ] : [] });
    var inp = $('#uq', m.el), out = $('#ur', m.el), chips = $('#chips', m.el);
    function drawChips() { chips.innerHTML = chosen.map(function (u) { return '<button type="button" class="chip on" data-r="' + u.id + '">@' + esc(u.username) + ' ×</button>'; }).join(''); }
    inp.addEventListener('input', C.debounce(async function () {
      var us = await findUsers(inp.value);
      out.innerHTML = us.map(function (u) { return '<button class="uitem" data-u="' + u.id + '">' + C.avatar(u, 40) + '<span><b>' + esc(C.name(u)) + '</b><small>@' + esc(u.username) + '</small></span></button>'; }).join('') || (inp.value.trim().length > 1 ? '<p class="chat-none">کاربری پیدا نشد.</p>' : '');
    }, 250));
    m.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-u]'), r = e.target.closest('[data-r]');
      if (b) {
        var id = b.getAttribute('data-u');
        if (!o.group) { o.pick(m, id); return; }
        if (!chosen.some(function (x) { return x.id === id; })) { chosen.push(C.users[id]); drawChips(); }
      }
      if (r) { chosen = chosen.filter(function (x) { return x.id !== r.getAttribute('data-r'); }); drawChips(); }
    });
  }
  async function newDirect(m, id) {
    var r = await sb.rpc('start_direct_chat', { p_user: id });
    if (r.error) return C.toast(C.err(r.error), 'bad');
    m.close(); await C.refreshBadges(); C.go('/chat/' + r.data);
  }
  async function newGroup(m, chosen, btn) {
    var title = $('#gt', m.el).value.trim(), username = $('#gu', m.el).value.trim().toLowerCase().replace(/^@+/, '') || null;
    var pub = $('#gp', m.el).value === 'public', desc = $('#gd', m.el).value.trim() || null;
    if (!title) return C.toast('نام گروه را وارد کن', 'bad');
    if (pub && !/^[a-z][a-z0-9_]{2,23}$/.test(username || '')) return C.toast('گروه عمومی به username معتبر نیاز دارد', 'bad');
    btn.disabled = true;
    var r = await sb.rpc('create_group_v2', { p_title: title, p_username: username, p_description: desc, p_is_public: pub, p_members: chosen.map(function (u) { return u.id; }) });
    btn.disabled = false;
    if (r.error) return C.toast(C.err(r.error), 'bad');
    m.close(); await C.refreshBadges(); C.go('/chat/' + r.data);
  }
  async function newChannel() {
    var m = C.modal({ wide: true, title: 'ساخت کانال', body:
      '<label class="field"><span>نام کانال</span><input class="input" id="ct" maxlength="60"></label>' +
      '<label class="field"><span>Username عمومی</span><div class="un-wrap"><b>@</b><input class="input ltr" id="cu" maxlength="24" autocomplete="off"></div></label>' +
      '<label class="field"><span>توضیحات</span><textarea class="input" id="cd" maxlength="500" rows="3"></textarea></label>' +
      '<label class="check"><input id="cp" type="checkbox"><span>کانال عمومی باشد</span></label><p class="muted">کانال خصوصی username عمومی ندارد و با لینک دعوت قابل دسترسی است.</p>', actions: [
      { label: 'انصراف', onClick: function (a) { a.close(); } },
      { label: 'ساخت کانال', kind: 'primary', onClick: async function (a, b) {
        var title = $('#ct', m.el).value.trim(), username = $('#cu', m.el).value.trim().toLowerCase().replace(/^@+/, '') || null, pub = $('#cp', m.el).checked, desc = $('#cd', m.el).value.trim() || null;
        if (!title) return C.toast('نام کانال را وارد کن', 'bad');
        if (pub && !/^[a-z][a-z0-9_]{2,23}$/.test(username || '')) return C.toast('کانال عمومی username معتبر می‌خواهد', 'bad');
        b.disabled = true; var r = await sb.rpc('create_channel', { p_title: title, p_username: username, p_description: desc, p_is_public: pub }); b.disabled = false;
        if (r.error) return C.toast(C.err(r.error), 'bad'); a.close(); await C.refreshBadges(); C.go('/chat/' + r.data);
      } }
    ] });
  }
  async function channelSearch() {
    var m = C.modal({ wide: true, title: 'کانال‌های عمومی', body: '<label class="field"><span>جستجو</span><input class="input" id="cq" placeholder="نام یا @username"></label><div class="ulist" id="cr"></div>', actions: [{ label: 'بستن', onClick: function (a) { a.close(); } }] });
    var q = $('#cq', m.el), out = $('#cr', m.el);
    async function run(v) { var r = await sb.rpc('search_channels', { p_q: String(v || '').replace(/^@+/, '').trim(), p_limit: 30 }); out.innerHTML = r.error ? '<p class="chat-none">' + esc(C.err(r.error)) + '</p>' : (r.data || []).map(function (x) { return '<button class="uitem" data-ch="' + x.conv_id + '">' + C.avatar({ username: x.title, display_name: x.title, avatar_url: x.avatar_url }, 42) + '<span><b>' + esc(x.title) + '</b><small class="ltr">@' + esc(x.username || '') + ' · ' + C.fa(x.member_count || 0) + ' دنبال‌کننده</small></span></button>'; }).join('') || '<p class="chat-none">پیدا نشد.</p>'; }
    await run(''); q.addEventListener('input', C.debounce(function (e) { run(e.target.value); }, 250));
    m.el.addEventListener('click', async function (e) { var b = e.target.closest('[data-ch]'); if (!b) return; var r = await sb.rpc('join_channel', { p_conv: b.getAttribute('data-ch') }); if (r.error) return C.toast(C.err(r.error), 'bad'); m.close(); await C.refreshBadges(); C.go('/chat/' + r.data); });
  }

  function open(ctx) {
    if (currentCleanup) { try { currentCleanup(); } catch (e) {} currentCleanup = null; }
    var el = ctx.el, st = { active: null, msgs: [], members: [], more: false, q: '', reply: null, edit: null, canSend: false, canManage: false, canAdmins: false, canView: false, media: null, recorder: null, tch: null, dead: false };
    el.innerHTML = '<div class="chat"><aside class="chat-list"><div class="chat-list-h"><h2>پیام‌ها</h2><div><button class="icon-btn" data-a="channel" aria-label="کانال">' + C.icon('megaphone', { size: 21 }) + '</button><button class="icon-btn" data-a="group" aria-label="گروه">' + C.icon('users', { size: 21 }) + '</button><button class="icon-btn" data-a="new" aria-label="پیام جدید">' + C.icon('edit', { size: 21 }) + '</button></div></div><div class="chat-search">' + C.icon('search', { size: 17 }) + '<input type="search" placeholder="جستجو در گفتگوها"></div><div class="chat-items"></div></aside><section class="chat-thread"></section></div>';
    var root = $('.chat', el), list = $('.chat-items', el), thread = $('.chat-thread', el);
    function renderList() {
      var rows = C.convs.filter(function (c) { return !st.q || chatName(c).toLowerCase().indexOf(st.q) > -1; });
      list.innerHTML = rows.length ? rows.map(function (c) { return '<a class="citem ' + (st.active === c.conv_id ? 'on' : '') + '" href="#/chat/' + c.conv_id + '"><span class="cav">' + convAvatar(c, 48) + (c.kind === 'direct' && C.online.has(c.other_id) ? '<i class="dot"></i>' : '') + '</span><span class="cbody"><span class="crow"><b>' + esc(chatName(c)) + (c.kind === 'system' ? '<span class="verified"> ✓</span>' : '') + '</b><time>' + (c.last_at ? C.clock(c.last_at) : '') + '</time></span><span class="crow"><span class="cprev">' + esc(preview(c)) + '</span>' + (c.unread ? '<em class="badge">' + C.compact(c.unread) + '</em>' : '') + '</span></span></a>'; }).join('') : '<p class="chat-none">گفتگویی نیست.</p>';
    }
    async function loadMeta(c) {
      var r = await sb.from('conversations').select('username,description,is_public,invite_token,theme,message_limit,created_by').eq('id', st.active).single(); if (!r.error && r.data) Object.assign(c, r.data);
      var mr = await sb.rpc('get_conversation_members', { p_conv: st.active }); st.members = mr.error ? [] : (mr.data || []); var me = st.members.filter(function (x) { return x.user_id === C.uid; })[0];
      st.canSend = c.kind === 'direct' || c.kind === 'group' || (c.kind === 'channel' && me && (me.role === 'owner' || (me.role === 'admin' && me.permissions && me.permissions.send_messages === true)));
      st.canManage = !!(me && (me.role === 'owner' || (me.role === 'admin' && me.permissions && me.permissions.manage_members === true)));
      st.canAdmins = !!(me && (me.role === 'owner' || (me.role === 'admin' && me.permissions && me.permissions.manage_admins === true)));
      st.canView = !!st.members.length;
      return me;
    }
    function otherRead() { var rows = st.members.filter(function (x) { return x.user_id !== C.uid; }); return rows.length && rows.every(function (x) { return new Date(x.last_read_at).getTime() >= 0; }) ? Math.max.apply(Math, rows.map(function (x) { return new Date(x.last_read_at).getTime(); })) : 0; }
    function bubble(m, idx) {
      var c = findConv(st.active), mine = m.sender_id === C.uid, del = !!m.deleted_at, u = m.sender_id ? C.user(m.sender_id) : { system: true, display_name: 'Auxy', avatar_url: '/auxy-black.png' };
      var prev = st.msgs[idx - 1], cont = prev && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) < 300000;
      var rep = m.reply_to ? st.msgs.filter(function (x) { return x.id === m.reply_to; })[0] : null;
      var read = mine && st.members.filter(function (x) { return x.user_id !== C.uid; }).length > 0 && st.members.filter(function (x) { return x.user_id !== C.uid; }).every(function (x) { return new Date(x.last_read_at).getTime() >= new Date(m.created_at).getTime(); });
      var media = '';
      if (m.media_type === 'audio' && m.media_url) media = '<audio class="msg-audio" controls preload="metadata"' + (C.settings.voiceAuto ? ' autoplay' : '') + ' src="' + esc(m.media_url) + '"></audio>';
      else if (m.media_type === 'image' && m.media_url) media = '<img class="msg-img" src="' + esc(m.media_url) + '" alt="" loading="lazy">';
      return '<div class="msg ' + (mine ? 'mine ' : '') + (cont ? 'cont ' : '') + (m._tmp ? 'tmp ' : '') + '" data-id="' + m.id + '">' + (!mine && c.kind === 'group' ? (cont ? '<span class="msg-av"></span>' : '<span class="msg-av">' + C.avatar(u, 30) + '</span>') : '') + '<div class="bub">' + (!mine && c.kind === 'group' && !cont ? '<b class="msg-name">' + esc(C.name(u)) + '</b>' : '') + (m.sender_id === null ? '<b class="msg-name">Auxy ✓</b>' : '') + (rep ? '<div class="quote"><b>' + esc(rep.sender_id ? C.name(C.user(rep.sender_id)) : 'Auxy') + '</b><span>' + esc(rep.body || 'رسانه') + '</span></div>' : '') + (del ? '<p class="gone">این پیام حذف شد</p>' : media + (m.body ? '<p dir="auto">' + C.linkify(m.body) + '</p>' : '')) + '<span class="meta">' + (m.edited_at && !del ? 'ویرایش‌شده · ' : '') + C.clock(m.created_at) + (mine && C.settings.readMarks!==false ? (m._tmp ? C.icon('clock', { size: 14 }) : C.icon(read ? 'checks' : 'check', { size: 14 })) : '') + (m._saved ? '<span class="saved-dot">★</span>' : '') + '</span></div>' + (!del && !m._tmp && m.sender_id !== null ? '<button class="msg-more icon-btn" data-a="m" aria-label="گزینه‌های پیام">' + C.icon('more', { size: 16 }) + '</button>' : '') + '</div>';
    }
    function renderMsgs(stick) { var box = $('.msgs', thread); if (!box) return; var near = box.scrollHeight - box.scrollTop - box.clientHeight < 140; box.innerHTML = (st.more ? '<button class="btn ghost sm older" data-a="older">پیام‌های قدیمی‌تر</button>' : '') + st.msgs.map(bubble).join('') + (st.msgs.length ? '' : '<p class="chat-none">هنوز پیامی نیست.</p>'); if (stick || near) box.scrollTop = box.scrollHeight; }
    function setReply() { var b = $('.reply-bar', thread); if (!b) return; var x = st.edit ? ['ویرایش پیام', st.edit.body] : st.reply ? ['پاسخ به ' + C.name(C.user(st.reply.sender_id)), st.reply.body || 'رسانه'] : null; b.hidden = !x; if (x) b.innerHTML = '<div><b>' + esc(x[0]) + '</b><span>' + esc(x[1] || '') + '</span></div><button class="icon-btn" data-a="cancel">' + C.icon('x', { size: 18 }) + '</button>'; }
    async function markRead() { if (!st.active) return; var c = findConv(st.active); if (c && c.unread) { C.unread.chat = Math.max(0, C.unread.chat - c.unread); c.unread = 0; C.emit('badges'); renderList(); } await sb.rpc('mark_read', { p_conv: st.active }); }
    function applyTheme(c) { var t = c.theme || {}; thread.style.setProperty('--chat-accent', t.accent || ''); thread.style.setProperty('--chat-bg', t.background || ''); thread.classList.toggle('themed', !!(t.accent || t.background)); }
    function typing() { if (st.tch) sb.removeChannel(st.tch); st.tch = sb.channel('typing:' + st.active).on('broadcast', { event: 't' }, function (p) { if (p.payload && p.payload.u !== C.uid) { var x = $('.th-sub', thread); if (x) x.innerHTML = '<span class="typing">در حال نوشتن…</span>'; setTimeout(function () { if (st.active) renderHead(); }, 2800); } }).subscribe(); }
    function renderHead() { var c = findConv(st.active); if (!c || !$('.th-name', thread)) return; $('.th-name', thread).textContent = chatName(c); $('.th-sub', thread).innerHTML = c.kind === 'group' ? C.fa(c.member_count || 0) + ' عضو' : c.kind === 'channel' ? C.fa(c.member_count || 0) + ' دنبال‌کننده' : c.kind === 'system' ? '<span class="verified">✓ Auxy رسمی</span>' : (C.online.has(c.other_id) ? '<span class="on-t">آنلاین</span>' : ''); }
    async function send(text, mediaUrl, mediaType, mediaName) {
      var c = findConv(st.active); if (!c || !st.canSend) return;
      var max = Math.min(4000, Number(c.message_limit || 4000)); if (text && text.length > max) return C.toast('حداکثر ' + C.fa(max) + ' نویسه مجاز است.', 'bad');
      if (st.edit) { var e = st.edit; st.edit = null; setReply(); var er = await sb.from('messages').update({ body: text, edited_at: new Date().toISOString() }).eq('id', e.id); if (er.error) C.toast(C.err(er.error), 'bad'); else { e.body = text; e.edited_at = new Date().toISOString(); renderMsgs(); } return; }
      var tmp = { id: 'tmp-' + Date.now(), conversation_id: st.active, sender_id: C.uid, body: text || null, media_url: mediaUrl || null, media_type: mediaType || 'none', media_name: mediaName || null, reply_to: st.reply ? st.reply.id : null, created_at: new Date().toISOString(), _tmp: 1 }; st.reply = null; setReply(); st.msgs.push(tmp); renderMsgs(true);
      var r = await sb.from('messages').insert(tmp && { conversation_id: tmp.conversation_id, sender_id: tmp.sender_id, body: tmp.body, media_url: tmp.media_url, media_type: tmp.media_type, media_name: tmp.media_name, reply_to: tmp.reply_to }).select('*').single();
      if (r.error) { st.msgs = st.msgs.filter(function (x) { return x !== tmp; }); renderMsgs(); return C.toast(C.err(r.error), 'bad'); }
      Object.assign(tmp, r.data); tmp._tmp = 0; renderMsgs(true); var cv = findConv(st.active); if (cv) { cv.last_body = tmp.body; cv.last_media = tmp.media_url; cv.last_at = tmp.created_at; cv.last_sender = tmp.sender_id; } renderList();
    }
    async function voice() {
      if (!st.canSend || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return C.toast('ضبط ویس روی این مرورگر فعال نیست.', 'bad');
      var button = $('.voice-btn', thread), stream, rec, chunks = [];
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' }); } catch (e) { try { rec = new MediaRecorder(stream); } catch (_) { if (stream) stream.getTracks().forEach(function(t){t.stop();}); return C.toast('ضبط ویس ممکن نیست.', 'bad'); } }
      st.recorder = rec; button.classList.add('recording'); button.innerHTML = '■'; C.toast('در حال ضبط ویس… برای توقف دوباره روی دکمه بزن.');
      rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async function () { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); button.classList.remove('recording'); button.innerHTML = C.icon('volume', { size: 22 }); st.recorder = null; var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); if (blob.size > 8 * 1024 * 1024) return C.toast('ویس خیلی بزرگ است.', 'bad'); try { var up = await C.upload('chat', new File([blob], 'voice.webm', { type: blob.type })); await send('', up.url, 'audio', 'voice.webm'); } catch (e) { C.toast(C.err(e), 'bad'); } };
      rec.start();
      setTimeout(function () { if (rec && rec.state === 'recording') rec.stop(); }, 120000);
      button.onclick = function () { if (rec.state === 'recording') rec.stop(); };
    }
    function permissionButtons(member) {
      if (!member || !st.canAdmins || member.role === 'owner') return '';
      var p = Object.assign({send_messages:false,delete_messages:false,pin_messages:false,invite_members:false,manage_members:false,manage_admins:false,edit_info:false,view_members:true,manage_theme:false}, member.permissions || {});
      var labels = {send_messages:'ارسال پیام',delete_messages:'حذف پیام',pin_messages:'سنجاق',invite_members:'دعوت اعضا',manage_members:'مدیریت اعضا',manage_admins:'مدیریت مدیران',edit_info:'تغییر اطلاعات',view_members:'دیدن اعضا',manage_theme:'تم'};
      return '<div class="perm-grid">' + Object.keys(labels).map(function(k){return '<label class="check"><input type="checkbox" data-p="'+k+'"'+(p[k]?' checked':'')+'><span>'+labels[k]+'</span></label>';}).join('') + '</div><button class="btn primary" id="savePerm">ذخیره دسترسی‌ها</button><button class="btn danger" id="demote">تبدیل به عضو</button>';
    }
    function memberAdmin(member, parent) {
      var m = C.modal({ wide:true, title:'دسترسی @'+esc(member.username), body:permissionButtons(member), actions:[{label:'بستن',onClick:function(a){a.close();}}]});
      $('#savePerm',m.el).onclick=async function(){var pp={};C.$$('input[data-p]',m.el).forEach(function(x){pp[x.getAttribute('data-p')]=x.checked;});var r=await sb.rpc('set_member_permissions',{p_conv:st.active,p_user:member.user_id,p_permissions:pp});if(r.error)return C.toast(C.err(r.error),'bad');m.close();parent.close();C.toast('دسترسی‌ها ذخیره شد');await openConv(st.active);};
      $('#demote',m.el).onclick=async function(){var r=await sb.rpc('set_member_role',{p_conv:st.active,p_user:member.user_id,p_role:'member',p_permissions:{send_messages:true}});if(r.error)return C.toast(C.err(r.error),'bad');m.close();parent.close();await openConv(st.active);};
    }
    async function addMember(c,parent) {
      var m=C.modal({title:'افزودن عضو',body:'<input class="input" id="addq" placeholder="username"><div id="addr" class="ulist"></div>',actions:[{label:'بستن',onClick:function(a){a.close();}}]});var q=$('#addq',m.el),out=$('#addr',m.el);q.addEventListener('input',C.debounce(async function(){var us=await findUsers(q.value);out.innerHTML=us.filter(function(u){return !st.members.some(function(x){return x.user_id===u.id;});}).map(function(u){return '<button class="uitem" data-u="'+u.id+'">'+C.avatar(u,40)+'<span><b>'+esc(C.name(u))+'</b><small>@'+esc(u.username)+'</small></span></button>';}).join('');},250));m.el.addEventListener('click',async function(e){var b=e.target.closest('[data-u]');if(!b)return;var r=await sb.rpc('add_group_members',{p_conv:c.conv_id,p_members:[b.getAttribute('data-u')]});if(r.error)return C.toast(C.err(r.error),'bad');m.close();parent.close();await C.refreshBadges();openConv(c.conv_id);});
    }
    async function addChannelAdmin(c,parent) {
      var m=C.modal({title:'افزودن مدیر کانال',body:'<p class="muted">کاربر را انتخاب کن، سپس مجوزهای مدیر از داخل پنل دسترسی قابل تنظیم است.</p><input class="input" id="cadq" placeholder="username"><div id="cadr" class="ulist"></div>',actions:[{label:'بستن',onClick:function(a){a.close();}}]});
      var q=$('#cadq',m.el),out=$('#cadr',m.el);
      q.addEventListener('input',C.debounce(async function(){var us=await findUsers(q.value);out.innerHTML=us.map(function(u){return '<button class="uitem" data-cad="'+u.id+'">'+C.avatar(u,40)+'<span><b>'+esc(C.name(u))+'</b><small>@'+esc(u.username)+'</small></span></button>';}).join('') || (q.value.trim().length>1?'<p class="chat-none">کاربری پیدا نشد.</p>':'');},250));
      m.el.addEventListener('click',async function(e){var b=e.target.closest('[data-cad]');if(!b)return;var r=await sb.rpc('add_channel_admin',{p_conv:c.conv_id,p_user:b.getAttribute('data-cad'),p_permissions:{send_messages:true,delete_messages:false,pin_messages:false,invite_members:false,manage_members:false,manage_admins:false,edit_info:false,view_members:true,manage_theme:false}});if(r.error||!(r.data&&r.data.ok))return C.toast(C.err(r.error||'admin_add_failed'),'bad');m.close();parent.close();C.toast('مدیر اضافه شد');await C.refreshBadges();openConv(c.conv_id);});
    }
    async function info() {
      var c=findConv(st.active); if(!c)return; var members=st.members;
      var body='<div class="chat-info"><div class="info-head">'+convAvatar(c,80)+'<div><h2>'+esc(chatName(c))+'</h2>'+(c.username?'<a class="auxy-link ltr" href="#/r/'+esc(c.username)+'">@'+esc(c.username)+'</a>':'')+'<p>'+esc(c.description||'')+'</p><small>'+esc(c.kind==='channel'?'کانال': 'گروه')+' · '+C.fa(c.member_count||members.length||0)+' نفر</small></div></div><div class="channel-links">'+(c.username?'<button class="btn glass" data-x="pub">کپی لینک عمومی</button>':'')+(c.invite_token?'<button class="btn glass" data-x="inv">کپی لینک دعوت</button>':'')+(c.kind==='group'&&st.canManage?'<button class="btn glass" data-x="add">افزودن عضو</button>':'')+(c.kind==='channel'&&st.canAdmins?'<button class="btn glass" data-x="addAdmin">افزودن مدیر</button>':'')+((st.canManage||st.canAdmins)?'<button class="btn glass" data-x="theme">شخصی‌سازی</button>':'')+'</div>';
      if(st.canView) body+='<h3>اعضا · '+C.fa(members.length)+'</h3><div class="ulist">'+members.map(function(x){return '<div class="member-item"><a class="uitem" href="#/u/'+esc(x.username)+'">'+C.avatar({username:x.username,display_name:x.display_name,avatar_url:x.avatar_url},40)+'<span><b>'+esc(x.display_name||x.username||'کاربر')+(x.role==='owner'?'<span class="verified"> ✓</span>':'')+'</b><small>@'+esc(x.username||'')+' · '+esc(x.role==='owner'?'مالک':x.role==='admin'?'مدیر':'عضو')+'</small></span></a>'+((st.canAdmins&&x.role!=='owner')?'<button class="btn ghost mini" data-admin="'+x.user_id+'">دسترسی</button>':'')+'</div>';}).join('')+'</div>';
      if(c.kind==='channel'&&!st.canView) body+='<p class="muted">فهرست اعضای این کانال فقط برای مالک و مدیران مجاز قابل مشاهده است.</p>';
      body+='</div>';
      var m=C.modal({wide:true,title:chatName(c),body:body,actions:[{label:c.kind==='group'?'ترک گروه':'خروج از کانال',kind:'danger',onClick:async function(a){if(c.kind==='group'&&members.some(function(x){return x.user_id===C.uid&&x.role==='owner';}))return C.toast('مالک گروه نمی‌تواند بدون انتقال مالکیت خارج شود.','bad');if(!(await C.confirm({title:'خروج',text:'از این گفتگو خارج شوی؟',ok:'خروج',danger:true})))return;var r=await sb.rpc('leave_conversation',{p_conv:c.conv_id});if(r.error)return C.toast(C.err(r.error),'bad');a.close();await C.refreshBadges();C.go('/chat');}},{label:'بستن',onClick:function(a){a.close();}}]});
      m.el.addEventListener('click',function(e){var x=e.target.closest('[data-x]'),ad=e.target.closest('[data-admin]');if(x){var a=x.getAttribute('data-x');if(a==='pub')C.copy(C.publicUrl(c.username));if(a==='inv')C.copy(location.origin+'/invite/'+(c.kind==='channel'?'channel':'group')+'/'+c.invite_token);if(a==='theme')theme(c,m);if(a==='add')addMember(c,m);if(a==='addAdmin')addChannelAdmin(c,m);}if(ad){var mm=members.filter(function(v){return v.user_id===ad.getAttribute('data-admin');})[0];if(mm)memberAdmin(mm,m);}});
    }
    function theme(c,parent){var m=C.modal({title:'شخصی‌سازی '+esc(chatName(c)),body:'<label class="field"><span>رنگ حباب</span><input class="input ltr" id="tca" value="'+esc((c.theme&&c.theme.accent)||'')+'" placeholder="#4f8cff"></label><label class="field"><span>پس‌زمینه</span><input class="input ltr" id="tcb" value="'+esc((c.theme&&c.theme.background)||'')+'" placeholder="linear-gradient(120deg,#111,#222)"></label>',actions:[{label:'انصراف',onClick:function(a){a.close();}},{label:'ذخیره',kind:'primary',onClick:async function(a){var theme={accent:$('#tca',m.el).value.trim(),background:$('#tcb',m.el).value.trim()};var r=await sb.rpc('set_conversation_theme',{p_conv:c.conv_id,p_theme:theme});if(r.error)return C.toast(C.err(r.error),'bad');c.theme=theme;applyTheme(c);a.close();parent.close();C.toast('تم ذخیره شد');}}]});}
    async function openConv(id) {
      st.active=id; C.chatState.active=id; st.msgs=[];st.members=[];st.reply=null;st.edit=null;st.more=false;st.dead=false; var c=findConv(id); root.classList.add('thread-open'); renderList(); if(!c){await C.refreshBadges();c=findConv(id);} if(!c){thread.innerHTML=C.empty('chat','گفتگو پیدا نشد');return;}
      thread.innerHTML='<header class="th-h"><a class="icon-btn th-back" href="#/chat" aria-label="بازگشت">'+C.icon('chevR',{size:24})+'</a>'+convAvatar(c,42)+'<div class="th-t"><b class="th-name"></b><small class="th-sub"></small></div>'+((c.kind==='group'||c.kind==='channel')?'<button class="icon-btn" data-a="info" aria-label="اطلاعات">'+C.icon('info',{size:22})+'</button>':'')+'</header><div class="msgs"><span class="spin"></span></div><div class="reply-bar" hidden></div>'+(c.kind==='system'?'<div class="channel-readonly">پیام‌های Auxy رسمی و فقط خواندنی هستند.</div>':'<form class="composer">'+(true?'<button type="button" class="icon-btn" data-a="emoji" aria-label="ایموجی">'+C.icon('smile',{size:24})+'</button>':'')+(true?'<button type="button" class="icon-btn" data-a="img" aria-label="تصویر">'+C.icon('image',{size:24})+'</button>':'')+(true?'<button type="button" class="icon-btn voice-btn" data-a="voice" aria-label="ویس">'+C.icon('volume',{size:22})+'</button>':'')+'<input type="file" id="cf" hidden accept="image/jpeg,image/png,image/webp,image/gif"><textarea maxlength="4000" rows="1" placeholder="پیام…"></textarea><button class="btn primary send" disabled>'+C.icon('send',{size:20})+'</button></form><div class="emoji" hidden></div>');
      var me=await loadMeta(c); if(!st.canSend&&c.kind==='channel')$('.composer',thread)?.remove(); if(!st.canSend&&c.kind==='direct')$('.composer',thread)?.remove(); if(!st.canSend&&c.kind==='group'){} applyTheme(c); renderHead();
      if(!st.canSend&&c.kind!=='system'){var ro=document.createElement('div');ro.className='channel-readonly';ro.textContent=c.kind==='channel'?'این کانال فقط برای مالک و مدیرانی که دسترسی «ارسال پیام» دارند قابل انتشار است.':'';if(ro.textContent)thread.appendChild(ro);}
      var r=await sb.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).limit(60); if(st.active!==id)return; st.msgs=(r.data||[]).reverse();st.more=(r.data||[]).length===60;await C.hydrate(st.msgs,'sender_id');renderMsgs(true);markRead();if(st.canSend)typing();
      var ta=$('textarea',thread), sendBtn=$('.send',thread); if(ta){ta.addEventListener('input',function(){var max=Math.min(4000,Number(c.message_limit||4000));if(ta.value.length>max)ta.value=ta.value.slice(0,max);ta.style.height='auto';ta.style.height=Math.min(140,ta.scrollHeight)+'px';sendBtn.disabled=!ta.value.trim();if(st.tch)st.tch.send({type:'broadcast',event:'t',payload:{u:C.uid}});});ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&C.settings.enterSend!==false&&matchMedia('(hover:hover)').matches){e.preventDefault();$('.composer',thread).requestSubmit();}});$('.composer',thread).addEventListener('submit',function(e){e.preventDefault();var t=ta.value.trim();if(t)send(t);});if(matchMedia('(hover:hover)').matches)ta.focus();}
    }
    root.addEventListener('click',function(e){var b=e.target.closest('[data-a]');if(!b)return;var a=b.getAttribute('data-a');if(a==='new')userPicker({title:'چت جدید',pick:newDirect});else if(a==='group')userPicker({title:'گروه جدید',group:true,done:newGroup});else if(a==='channel'){var p=C.pop(b,'<button data-x="create">'+C.icon('plus',{size:18})+'ساخت کانال</button><button data-x="find">'+C.icon('search',{size:18})+'پیدا کردن کانال</button>');p.addEventListener('click',function(e){var x=e.target.closest('[data-x]');if(!x)return;x.getAttribute('data-x')==='create'?newChannel():channelSearch();});}});
    thread.addEventListener('click',async function(e){var b=e.target.closest('[data-a]'),img=e.target.closest('.msg-img'),link=e.target.closest('.auxy-external');if(link){e.preventDefault();var lu=link.getAttribute('data-link');if(C.settings.inAppBrowser!==false) C.go('/browser?url='+encodeURIComponent(lu)); else window.open(lu,'_blank','noopener,noreferrer');return;}if(img){C.modal({cls:'lightbox',foot:false,title:'',body:'<img src="'+esc(img.src)+'" class="lb" alt="">'});return;}if(!b)return;var a=b.getAttribute('data-a');if(a==='emoji'){var ep=$('.emoji',thread);ep.hidden=!ep.hidden;if(!ep.innerHTML)ep.innerHTML=EMOJI.map(function(x){return '<button type="button" data-e="'+esc(x)+'"><span class="tg-emoji">'+esc(x)+'</span></button>';}).join('');}else if(a==='img')$('#cf',thread)?.click();else if(a==='voice'){if(st.recorder&&st.recorder.state==='recording')st.recorder.stop();else voice();}else if(a==='cancel'){st.reply=null;st.edit=null;setReply();}else if(a==='older'){var first=st.msgs[0];if(!first)return;var r=await sb.from('messages').select('*').eq('conversation_id',st.active).lt('created_at',first.created_at).order('created_at',{ascending:false}).limit(60);var rows=(r.data||[]).reverse();st.more=rows.length===60;await C.hydrate(rows,'sender_id');st.msgs=rows.concat(st.msgs);renderMsgs();}else if(a==='info'){info();}else if(a==='m'){var id=b.closest('.msg').getAttribute('data-id'),msg=st.msgs.filter(function(x){return x.id===id;})[0];if(!msg)return;var mine=msg.sender_id===C.uid;var pop=C.pop(b,'<button data-x="rep">↩ پاسخ</button><button data-x="save">★ ذخیره</button>'+(msg.body?'<button data-x="copy">کپی</button>':'')+(mine&&msg.body?'<button data-x="edit">ویرایش</button>':'')+(mine?'<button data-x="del">حذف</button>':'')+'<button data-x="flag">⚑ گزارش</button>');pop.addEventListener('click',async function(ev){var x=ev.target.closest('[data-x]');if(!x)return;var z=x.getAttribute('data-x');if(z==='rep'){st.reply=msg;st.edit=null;setReply();$('textarea',thread)?.focus();}else if(z==='copy')C.copy(msg.body);else if(z==='flag')C.report('message',msg.id);else if(z==='save'){var rr=await sb.rpc('save_message',{p_message:msg.id});if(rr.error)return C.toast(C.err(rr.error),'bad');msg._saved=true;C.toast('به پیام‌های ذخیره‌شده اضافه شد');renderMsgs();}else if(z==='edit'){st.edit=msg;st.reply=null;setReply();var ta=$('textarea',thread);ta.value=msg.body;ta.dispatchEvent(new Event('input'));ta.focus();}else if(z==='del'){if(!(await C.confirm({title:'حذف پیام',text:'پیام حذف شود؟',ok:'حذف',danger:true})))return;var rr=await sb.from('messages').update({deleted_at:new Date().toISOString(),body:''}).eq('id',msg.id);if(rr.error)return C.toast(C.err(rr.error),'bad');msg.deleted_at=new Date().toISOString();msg.body='';renderMsgs();}});}});
    thread.addEventListener('click',function(e){var b=e.target.closest('[data-e]');if(!b)return;var ta=$('textarea',thread);if(ta){ta.value+=b.getAttribute('data-e');ta.dispatchEvent(new Event('input'));ta.focus();}});
    thread.addEventListener('change',async function(e){if(e.target.id!=='cf')return;var f=e.target.files[0];e.target.value='';if(!f)return;try{var up=await C.upload('chat',await C.compress(f,1280,.82));await send('',up.url,'image',f.name);}catch(er){C.toast(C.err(er),'bad');}});
    C.on('badges',renderList);
    var offMsg=C.on('message',function(m){if(st.dead)return;if(m.conversation_id===st.active&&!st.msgs.some(function(x){return x.id===m.id;})){C.hydrate([m],'sender_id').then(function(){st.msgs.push(m);renderMsgs();if(document.hasFocus())markRead();});}if(m.conversation_id!==st.active&&m.sender_id!==C.uid)renderList();});
    var offPres=C.on('presence',function(){renderList();renderHead();});
    var focus=function(){if(st.active&&document.hasFocus())markRead();};window.addEventListener('focus',focus);
    $('.chat-search input',el).addEventListener('input',function(e){st.q=e.target.value.trim().toLowerCase();renderList();});
    renderList(); if(ctx.params.id)openConv(ctx.params.id);else thread.innerHTML=C.empty('chat','یک گفتگو را انتخاب کن','از بالا چت، گروه یا کانال جدید بساز.');
    currentCleanup=function(){st.dead=true;offMsg();offPres();window.removeEventListener('focus',focus);if(st.tch)sb.removeChannel(st.tch);if(st.recorder&&st.recorder.state==='recording')st.recorder.stop();currentCleanup=null;};
    return currentCleanup;
  }
})();
