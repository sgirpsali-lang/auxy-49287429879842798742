/* Auxy web: studio (publisher only) — add/edit movies, manage ads */
(function () {
  'use strict';
  var A = window.AUXY, C = A.core, sb = A.client, esc = C.esc, $ = C.$;
  A.mod.studio = { open: open };
  var MAT = A.MATURITY || { all: 'همه‌سنین', '7': '+۷', '13': '+۱۳', '16': '+۱۶', '18': '+۱۸' };

  function guard(el) {
    if (!C.isPublisher()) { el.innerHTML = C.empty('lock', 'دسترسی ندارید', 'این بخش فقط برای ناشران Auxy است.', '<a class="btn primary" href="#/">بازگشت</a>'); return false; }
    return true;
  }

  async function open(ctx) {
    var el = ctx.el; if (!guard(el)) return;
    var tab = 'movies';
    el.innerHTML = '<div class="studio"><nav class="set-nav"><a href="#" data-t="movies" class="on">' + C.icon('film', { size: 19 }) + '<span>فیلم‌ها</span></a><a href="#" data-t="series">' + C.icon('video', { size: 19 }) + '<span>سریال‌ها</span></a>' +
      (C.isOwner() ? '<a href="#" data-t="ads">' + C.icon('sparkle', { size: 19 }) + '<span>تبلیغ‌ها</span></a>' : '') + '</nav><div class="set-body"></div></div>';
    var body = $('.set-body', el), nav = $('.set-nav', el);
    nav.addEventListener('click', function (e) { var a = e.target.closest('[data-t]'); if (!a) return; e.preventDefault(); tab = a.getAttribute('data-t'); C.$$('a', nav).forEach(function (x) { x.classList.toggle('on', x === a); }); paint(); });
    function paint() { tab === 'movies' ? movies() : tab === 'series' ? series() : ads(); }
    if (ctx.query.get('edit')) { await movies(); editMovie(ctx.query.get('edit')); } else paint();

    /* ---------- movies ---------- */
    async function movies() {
      body.innerHTML = '<div class="studio-h"><h1 class="page-h">فیلم‌ها</h1><button class="btn primary" id="add">' + C.icon('plus', { size: 18 }) + 'افزودن فیلم</button></div><div id="mlist"><div class="sk sk-rows"></div></div>';
      $('#add', body).addEventListener('click', function () { editMovie(); });
      var r = await sb.from('movies').select('*').order('created_at', { ascending: false });
      var rows = r.data || [];
      $('#mlist', body).innerHTML = rows.length ? '<div class="table"><div class="tr th"><span>پوستر</span><span>عنوان</span><span>وضعیت</span><span>بازدید</span><span>لایک</span><span></span></div>' +
        rows.map(function (m) { return '<div class="tr" data-id="' + m.id + '"><span class="tposter">' + (m.poster_url ? '<img src="' + esc(m.poster_url) + '" alt="">' : '<i>' + esc(m.title.charAt(0)) + '</i>') + '</span>' +
          '<span class="ttitle"><b>' + esc(m.title) + '</b><small>' + (m.year || '') + '</small></span><span>' + (m.published ? '<em class="tag ok">منتشرشده</em>' : '<em class="tag draft">پیش‌نویس</em>') + (m.featured ? ' <em class="tag feat">ویژه</em>' : '') + '</span>' +
          '<span>' + C.compact(m.views) + '</span><span>' + C.compact(m.likes_count) + '</span><span class="tacts"><button class="icon-btn" data-a="edit" aria-label="ویرایش">' + C.icon('edit', { size: 18 }) + '</button><a class="icon-btn" href="#/movie/' + m.id + '" aria-label="مشاهده">' + C.icon('play', { size: 18 }) + '</a><button class="icon-btn" data-a="del" aria-label="حذف">' + C.icon('trash', { size: 18 }) + '</button></span></div>'; }).join('') + '</div>'
        : C.empty('film', 'هنوز فیلمی اضافه نکرده‌ای', '', '<button class="btn primary" id="add2">افزودن اولین فیلم</button>');
      var add2 = $('#add2', body); if (add2) add2.addEventListener('click', function () { editMovie(); });
      $('#mlist', body).addEventListener('click', async function (e) {
        var b = e.target.closest('[data-a]'); if (!b) return; var id = b.closest('.tr').getAttribute('data-id'), a = b.getAttribute('data-a');
        if (a === 'edit') editMovie(id);
        else if (a === 'del' && await C.confirm({ title: 'حذف فیلم', text: 'این فیلم برای همیشه حذف شود؟', ok: 'حذف', danger: true })) {
          var d = await sb.from('movies').delete().eq('id', id); if (d.error) return C.toast(C.err(d.error), 'bad');
          if (A.mod.browse) A.mod.browse.invalidate(); C.toast('فیلم حذف شد'); movies();
        }
      });
    }

    function upField(id, label, cur, accept) {
      return '<label class="field"><span>' + label + '</span><div class="up-row"><input class="input ltr" id="' + id + '" placeholder="آدرس https:// یا آپلود کن" value="' + esc(cur || '') + '">' +
        '<button type="button" class="btn glass" data-up="' + id + '">آپلود</button><input type="file" id="f_' + id + '" accept="' + accept + '" hidden></div><div class="prog" id="p_' + id + '" hidden><i></i><span></span></div></label>';
    }
    async function editMovie(id) {
      var m = id ? (await sb.from('movies').select('*').eq('id', id).single()).data : { title: '', description: '', year: new Date().getFullYear(), duration_minutes: '', genres: [], maturity: 'all', poster_url: '', backdrop_url: '', video_url: '', featured: false, published: true };
      if (id && !m) return C.toast('فیلم پیدا نشد', 'bad');
      var mm = C.modal({
        title: id ? 'ویرایش فیلم' : 'فیلم جدید', wide: true,
        body: '<label class="field"><span>عنوان</span><input class="input" id="ti" maxlength="200" value="' + esc(m.title) + '"></label>' +
          '<label class="field"><span>توضیح</span><textarea class="input" id="de" rows="3" maxlength="4000">' + esc(m.description || '') + '</textarea></label>' +
          '<div class="row2"><label class="field"><span>سال</span><input class="input ltr" id="yr" type="number" min="1888" max="2100" value="' + esc(m.year || '') + '"></label>' +
          '<label class="field"><span>مدت (دقیقه)</span><input class="input ltr" id="du" type="number" min="0" max="2000" value="' + esc(m.duration_minutes || '') + '"></label></div>' +
          '<div class="row2"><label class="field"><span>ژانرها (با ویرگول)</span><input class="input" id="ge" value="' + esc((m.genres || []).join('، ')) + '" placeholder="درام، هیجانی"></label>' +
          '<label class="field"><span>رده‌ی سنی</span><select class="input" id="ma">' + Object.keys(MAT).map(function (k) { return '<option value="' + k + '"' + (m.maturity === k ? ' selected' : '') + '>' + MAT[k] + '</option>'; }).join('') + '</select></label></div>' +
          upField('po', 'پوستر (عمودی)', m.poster_url, 'image/jpeg,image/png,image/webp') + upField('bd', 'تصویر پس‌زمینه (افقی، اختیاری)', m.backdrop_url, 'image/jpeg,image/png,image/webp') + upField('vu', 'فایل ویدیو (mp4/webm یا لینک m3u8)', m.video_url, 'video/mp4,video/webm,video/x-matroska') +
          '<div class="row2"><label class="check"><input type="checkbox" id="pub"' + (m.published ? ' checked' : '') + '><span>منتشر شود</span></label><label class="check"><input type="checkbox" id="fe"' + (m.featured ? ' checked' : '') + '><span>ویژه (نمایش در بالای صفحه)</span></label></div>' +
          '<div class="form-err" id="me" hidden></div>',
        actions: [{ label: 'انصراف', onClick: function (a) { a.close(); } }, { label: id ? 'ذخیره' : 'افزودن فیلم', kind: 'primary', onClick: save }]
      });
      var box = mm.el;
      ['po', 'bd', 'vu'].forEach(function (id2) {
        $('[data-up="' + id2 + '"]', box).addEventListener('click', function () { $('#f_' + id2, box).click(); });
        $('#f_' + id2, box).addEventListener('change', async function (e) {
          var f = e.target.files[0]; if (!f) return; var bar = $('#p_' + id2 + ' i', box), lab = $('#p_' + id2 + ' span', box); $('#p_' + id2, box).hidden = false;
          try {
            var up = /^image\//.test(f.type) ? await C.compress(f, id2 === 'po' ? 900 : 1600, .85) : f;
            var res = await C.upload('movies', up, { onProgress: function (p) { bar.style.width = (p * 100) + '%'; lab.textContent = C.fa(Math.round(p * 100)) + '٪'; } });
            $('#' + id2, box).value = res.url; C.toast('آپلود شد');
          } catch (er) { C.toast(C.err(er), 'bad'); } finally { $('#p_' + id2, box).hidden = true; bar.style.width = '0'; }
        });
      });
      async function save(a, btn) {
        var er = $('#me', box); er.hidden = true;
        var title = $('#ti', box).value.trim(), vu = $('#vu', box).value.trim();
        if (!title) { er.textContent = 'عنوان را بنویس.'; er.hidden = false; return; }
        if (!vu) { er.textContent = 'فایل یا لینک ویدیو را مشخص کن.'; er.hidden = false; return; }
        var row = {
          title: title, description: $('#de', box).value.trim() || null, year: Number($('#yr', box).value) || null, duration_minutes: Number($('#du', box).value) || null,
          genres: $('#ge', box).value.split(/[,،]/).map(function (s) { return s.trim(); }).filter(Boolean), maturity: $('#ma', box).value,
          poster_url: $('#po', box).value.trim() || null, backdrop_url: $('#bd', box).value.trim() || null, video_url: vu, video_kind: /\.m3u8(\?|$)/i.test(vu) ? 'hls' : 'url',
          published: $('#pub', box).checked, featured: $('#fe', box).checked
        };
        btn.disabled = true;
        var r = id ? await sb.from('movies').update(row).eq('id', id) : await sb.from('movies').insert(Object.assign({ created_by: C.uid }, row));
        btn.disabled = false;
        if (r.error) { er.textContent = C.err(r.error); er.hidden = false; return; }
        C.toast(id ? 'فیلم به‌روز شد' : 'فیلم اضافه شد'); if (A.mod.browse) A.mod.browse.invalidate(); a.close(); movies();
      }
    }

    /* ---------- ads (owner) ---------- */
    async function series() {
      if (!C.isPublisher()) return;
      body.innerHTML='<h1 class="page-h">سریال‌ها</h1><button class="btn primary" id="newSeries">+ سریال جدید</button><div id="sl" class="cards" style="margin-top:14px"></div>';
      async function load(){var r=await sb.from('series').select('*').order('created_at',{ascending:false});$('#sl',body).innerHTML=(r.data||[]).map(function(s){return '<div class="card studio-series"><div><b>'+esc(s.title)+'</b><small>'+esc(s.year||'')+' · '+esc((s.genres||[]).join('، '))+'</small></div><div class="row"><button class="btn glass mini" data-manage="'+s.id+'">فصل‌ها و قسمت‌ها</button></div></div>';}).join('')||C.empty('film','سریالی ثبت نشده');}
      $('#newSeries',body).onclick=function(){var m=C.modal({wide:true,title:'سریال جدید',body:'<label class="field"><span>عنوان</span><input class="input" id="stt"></label><label class="field"><span>سال</span><input class="input" id="sty" type="number"></label><label class="field"><span>ژانرها</span><input class="input" id="stg" placeholder="درام، اکشن"></label><label class="field"><span>پوستر</span><input class="input ltr" id="spu"></label><label class="field"><span>بک‌گراند</span><input class="input ltr" id="sbu"></label><label class="field"><span>توضیحات</span><textarea class="input" id="std" rows="3"></textarea></label>',actions:[{label:'انصراف',onClick:a=>a.close()},{label:'ساخت',kind:'primary',onClick:async a=>{var r=await sb.rpc('create_series',{p_title:$('#stt',m.el).value.trim(),p_description:$('#std',m.el).value.trim()||null,p_year:Number($('#sty',m.el).value)||null,p_genres:$('#stg',m.el).value.split(',').map(x=>x.trim()).filter(Boolean),p_maturity:'all',p_poster_url:$('#spu',m.el).value.trim()||null,p_backdrop_url:$('#sbu',m.el).value.trim()||null,p_featured:false,p_published:true});if(r.error)return C.toast(C.err(r.error),'bad');a.close();load();}}]});};
      body.addEventListener('click',async function(e){var b=e.target.closest('[data-manage]');if(!b)return;var id=b.getAttribute('data-manage'),sr=await sb.from('seasons').select('*').eq('series_id',id).order('season_number');var html='<div class="season-admin">'+(sr.data||[]).map(function(se){return '<div class="scard"><b>فصل '+C.fa(se.season_number)+'</b><div id="ep_'+se.id+'" class="cards"></div><button class="btn glass mini" data-ep="'+se.id+'">افزودن قسمت</button></div>';}).join('')+'</div><button class="btn primary" data-season="'+id+'">افزودن فصل</button>';var m=C.modal({wide:true,title:'مدیریت سریال',body:html,actions:[{label:'بستن',onClick:a=>a.close()}]});async function loadEps(){for(var se of (sr.data||[])){var er=await sb.from('episodes').select('*').eq('season_id',se.id).order('episode_number');var box=$('#ep_'+se.id,m.el);if(box)box.innerHTML=(er.data||[]).map(e=>'<div class="episode-admin"><b>قسمت '+C.fa(e.episode_number)+' · '+esc(e.title)+'</b><small class="ltr">'+esc(e.video_url||'')+'</small></div>').join('')||'<span class="muted">قسمتی ندارد.</span>';}}loadEps();m.el.addEventListener('click',async function(ev){var bs=ev.target.closest('[data-season]');if(bs){var n=(sr.data||[]).length+1;var rr=await sb.rpc('create_season',{p_series:id,p_number:n,p_title:'فصل '+n});if(rr.error)C.toast(C.err(rr.error),'bad');else{m.close();series();}}var be=ev.target.closest('[data-ep]');if(be){var sid=be.getAttribute('data-ep');var mm=C.modal({title:'قسمت جدید',body:'<label class="field"><span>شماره قسمت</span><input class="input" id="en" type="number"></label><label class="field"><span>عنوان</span><input class="input" id="et"></label><label class="field"><span>ویدیو URL</span><input class="input ltr" id="ev"></label><label class="field"><span>توضیحات</span><textarea class="input" id="ed"></textarea></label>',actions:[{label:'انصراف',onClick:a=>a.close()},{label:'ساخت',kind:'primary',onClick:async a=>{var rr=await sb.rpc('create_episode',{p_season:sid,p_number:Number($('#en',mm.el).value),p_title:$('#et',mm.el).value.trim(),p_description:$('#ed',mm.el).value.trim()||null,p_duration:0,p_poster_url:null,p_video_url:$('#ev',mm.el).value.trim(),p_video_kind:'url',p_published:true});if(rr.error)return C.toast(C.err(rr.error),'bad');mm.close();loadEps();}}]});}});});
    }
    async function ads() {
      if (!C.isOwner()) return;
      body.innerHTML = '<div class="studio-h"><h1 class="page-h">تبلیغ‌ها</h1><button class="btn primary" id="add">' + C.icon('plus', { size: 18 }) + 'تبلیغ جدید</button></div><div id="alist"><div class="sk sk-rows"></div></div>';
      $('#add', body).addEventListener('click', function () { editAd(); });
      var r = await sb.from('ads').select('*').order('created_at', { ascending: false }), rows = r.data || [];
      $('#alist', body).innerHTML = rows.length ? '<div class="table"><div class="tr th"><span>نوع</span><span>عنوان</span><span>مدت</span><span>وضعیت</span><span></span></div>' +
        rows.map(function (ad) { return '<div class="tr" data-id="' + ad.id + '"><span>' + (ad.kind === 'video' ? 'ویدیو' : 'تصویر') + '</span><span><b>' + esc(ad.title) + '</b></span><span>' + C.fa(ad.duration_seconds) + ' ثانیه' + (ad.skip_after_seconds != null ? ' · رد بعد از ' + C.fa(ad.skip_after_seconds) + 'ث' : '') + '</span>' +
          '<span>' + (ad.active ? '<em class="tag ok">فعال</em>' : '<em class="tag draft">غیرفعال</em>') + '</span><span class="tacts"><button class="icon-btn" data-a="edit" aria-label="ویرایش">' + C.icon('edit', { size: 18 }) + '</button><button class="icon-btn" data-a="del" aria-label="حذف">' + C.icon('trash', { size: 18 }) + '</button></span></div>'; }).join('') + '</div>'
        : C.empty('sparkle', 'هنوز تبلیغی نساخته‌ای', 'قبل از هر فیلم، یکی از این تبلیغ‌ها نشان داده می‌شود.');
      $('#alist', body).addEventListener('click', async function (e) {
        var b = e.target.closest('[data-a]'); if (!b) return; var id = b.closest('.tr').getAttribute('data-id'), a = b.getAttribute('data-a');
        if (a === 'edit') editAd(id);
        else if (a === 'del' && await C.confirm({ title: 'حذف تبلیغ', text: 'این تبلیغ حذف شود؟', ok: 'حذف', danger: true })) { await sb.from('ads').delete().eq('id', id); ads(); }
      });
    }
    async function editAd(id) {
      var ad = id ? (await sb.from('ads').select('*').eq('id', id).single()).data : { title: '', kind: 'video', media_url: '', link_url: '', duration_seconds: 15, skip_after_seconds: 5, active: true };
      var mm = C.modal({
        title: id ? 'ویرایش تبلیغ' : 'تبلیغ جدید',
        body: '<label class="field"><span>عنوان (داخلی)</span><input class="input" id="ti" maxlength="120" value="' + esc(ad.title) + '"></label>' +
          '<label class="field"><span>نوع</span><select class="input" id="ki"><option value="video"' + (ad.kind === 'video' ? ' selected' : '') + '>ویدیو</option><option value="image"' + (ad.kind === 'image' ? ' selected' : '') + '>تصویر</option></select></label>' +
          upField('mu', 'فایل تبلیغ', ad.media_url, 'image/jpeg,image/png,image/webp,video/mp4,video/webm') +
          '<label class="field"><span>لینک مقصد (اختیاری)</span><input class="input ltr" id="lu" value="' + esc(ad.link_url || '') + '" placeholder="https://"></label>' +
          '<div class="row2"><label class="field"><span>مدت کل (ثانیه، برای تصویر)</span><input class="input ltr" id="ds" type="number" min="3" max="60" value="' + esc(ad.duration_seconds) + '"></label>' +
          '<label class="field"><span>رد کردن بعد از (ثانیه، خالی=غیرقابل‌رد)</span><input class="input ltr" id="sk" type="number" min="0" max="60" value="' + esc(ad.skip_after_seconds == null ? '' : ad.skip_after_seconds) + '"></label></div>' +
          '<label class="check"><input type="checkbox" id="ac"' + (ad.active ? ' checked' : '') + '><span>فعال</span></label><div class="form-err" id="ae" hidden></div>',
        actions: [{ label: 'انصراف', onClick: function (a) { a.close(); } }, { label: id ? 'ذخیره' : 'افزودن', kind: 'primary', onClick: save }]
      });
      var box = mm.el;
      $('[data-up="mu"]', box).addEventListener('click', function () { $('#f_mu', box).click(); });
      $('#f_mu', box).addEventListener('change', async function (e) {
        var f = e.target.files[0]; if (!f) return; var bar = $('#p_mu i', box), lab = $('#p_mu span', box); $('#p_mu', box).hidden = false;
        try { var up = /^image\//.test(f.type) ? await C.compress(f, 1280, .85) : f; var res = await C.upload('movies', up, { onProgress: function (p) { bar.style.width = (p * 100) + '%'; lab.textContent = C.fa(Math.round(p * 100)) + '٪'; } }); $('#mu', box).value = res.url; C.toast('آپلود شد'); }
        catch (er) { C.toast(C.err(er), 'bad'); } finally { $('#p_mu', box).hidden = true; bar.style.width = '0'; }
      });
      async function save(a, btn) {
        var er = $('#ae', box); er.hidden = true;
        var title = $('#ti', box).value.trim(), mu = $('#mu', box).value.trim();
        if (!title || !mu) { er.textContent = 'عنوان و فایل تبلیغ لازم است.'; er.hidden = false; return; }
        var skVal = $('#sk', box).value.trim();
        var row = { title: title, kind: $('#ki', box).value, media_url: mu, link_url: $('#lu', box).value.trim() || null, duration_seconds: Number($('#ds', box).value) || 5, skip_after_seconds: skVal === '' ? null : Number(skVal), active: $('#ac', box).checked };
        btn.disabled = true; var r = id ? await sb.from('ads').update(row).eq('id', id) : await sb.from('ads').insert(row); btn.disabled = false;
        if (r.error) { er.textContent = C.err(r.error); er.hidden = false; return; }
        C.toast('ذخیره شد'); a.close(); ads();
      }
    }
  }
})();
