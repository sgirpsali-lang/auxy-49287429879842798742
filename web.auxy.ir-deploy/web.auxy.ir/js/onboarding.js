/* Auxy Web Main — first run onboarding.
   Passwords are already managed by Supabase Auth. The only app-level setup
   step left here is choosing a public username, then marking onboarding done. */
(function(){
  'use strict';
  var A=window.AUXY,C=A.core,S=A.sec,sb=A.client,esc=C.esc,$=C.$;
  A.mod=A.mod||{};
  A.mod.onboarding={run:run};

  function run(){
    return new Promise(function(resolve){
      var me=C.me,p=me.profile;
      var root=C.el('<div class="ob" role="dialog" aria-modal="true" aria-label="ساخت حساب"><div class="ob-bg" aria-hidden="true"></div><div class="ob-card" data-tilt="3"><div class="ob-dots"><i class="on"></i></div><div class="ob-body"></div><button class="ob-out" type="button">خروج از حساب</button></div></div>');
      document.body.appendChild(root);
      var body=$('.ob-body',root);
      $('.ob-out',root).addEventListener('click',function(){A.signOut();});
      if(S&&S.wireEyes)S.wireEyes(root);

      function finish(){
        sb.rpc('finish_onboarding').then(function(r){
          if(r.error)throw r.error;
          root.classList.add('out');
          setTimeout(function(){root.remove();resolve();},400);
        }).catch(function(e){
          var fe=$('#ferr',body);fe.textContent=C.err?C.err(e):'ذخیره انجام نشد.';fe.hidden=false;
          var fin=$('#fin',body);if(fin){fin.disabled=false;fin.textContent='تأیید و ورود به Auxy';}
        });
      }

      function step(){
        var first=String(C.name(p)||'').split(' ')[0];
        body.innerHTML='<div class="ob-mark">'+C.logo()+'</div><h1>سلام'+(first?' '+esc(first):'')+'!</h1>'+
          '<p class="sub">یک نام کاربری برای خودت انتخاب کن. بقیه با همین نام پیدایت می‌کنند.</p>'+ 
          '<label class="field"><span>نام کاربری</span><div class="un-wrap"><b>@</b><input class="input ltr" id="un" maxlength="24" autocomplete="username" autocapitalize="off" spellcheck="false" inputmode="latin" placeholder="username"></div></label>'+ 
          '<div class="un-status" id="uns" aria-live="polite"></div><ul class="rules" id="ur"></ul><div class="chips" id="usug" aria-label="پیشنهاد"></div>'+ 
          '<button class="btn primary block" id="next" disabled>ادامه</button>'+ 
          '<div class="form-err" id="ferr" hidden></div>'+ 
          '<p class="fine">نام کاربری بین ۳ تا ۲۴ نویسه است و فقط حروف انگلیسی، عدد و _ دارد.</p>';
        var un=$('#un',body),uns=$('#uns',body),ur=$('#ur',body),next=$('#next',body),ferr=$('#ferr',body),token=0,okName='';
        function status(cls,txt){uns.className='un-status '+(cls||'');uns.textContent=txt||'';}
        function rules(){var rr=S&&S.usernameRules?S.usernameRules(un.value):[];ur.innerHTML=rr.map(function(r){return '<li class="'+(r.ok?'ok':'')+'">'+C.icon('check',{size:14,sw:2.6})+'<span>'+esc(r.label)+'</span></li>';}).join('');}
        var remote=C.debounce(async function(val,t){
          try{
            var r=await S.checkUsername(val);if(t!==token)return;
            if(r.ok){okName=val;status('ok','آزاد است ✓  @'+val);next.disabled=false;}
            else{okName='';next.disabled=true;status('bad',S.usernameMsg(r.code));}
          }catch(e){if(t===token){okName='';next.disabled=true;status('bad','بررسی نام کاربری انجام نشد.');}}
        },320);
        function check(){
          var v=String(un.value||'').replace(/^@+/,'').toLowerCase();un.value=v;token++;okName='';next.disabled=true;rules();
          if(!v)return status('','');
          var e=S.usernameError(v);if(e)return status('bad',S.usernameMsg(e));
          status('wait','در حال بررسی…');remote(v,token);
        }
        un.addEventListener('input',check);
        un.addEventListener('keydown',function(e){if(e.key==='Enter'&&!next.disabled){e.preventDefault();next.click();}});
        var seeds=[String(me.email||'').split('@')[0],first,'auxyuser'].map(function(x){return String(x||'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,18);}).filter(function(x){return x.length>=3;});
        var sug=[];seeds.forEach(function(x){if(sug.indexOf(x)<0)sug.push(x);var y=x+'_'+Math.floor(10+Math.random()*90);if(sug.indexOf(y)<0)sug.push(y);});
        $('#usug',body).innerHTML=sug.slice(0,4).map(function(x){return '<button type="button" class="chip" data-s="'+esc(x)+'">@'+esc(x)+'</button>';}).join('');
        $('#usug',body).addEventListener('click',function(e){var b=e.target.closest('[data-s]');if(b){un.value=b.getAttribute('data-s');check();un.focus();}});
        next.addEventListener('click',async function(){
          if(!okName)return;
          next.disabled=true;status('wait','در حال ثبت…');ferr.hidden=true;
          try{
            var r=await sb.rpc('claim_username',{p_username:okName});
            if(r.error)throw r.error;
            var d=r.data||{};
            if(!d.ok&&d.code!=='already_set'){status('bad',S.usernameMsg(d.code));next.disabled=false;return;}
            p.username=d.username||okName;
            if(d.role)p.role=d.role;
            C.users[p.id]=p;
            status('ok','نام کاربری ثبت شد ✓');
            finish();
          }catch(e){ferr.textContent=C.err?C.err(e):'ثبت نام کاربری انجام نشد.';ferr.hidden=false;next.disabled=false;status('bad','خطا در ذخیره نام کاربری.');}
        });
        rules();setTimeout(function(){un.focus();},80);
      }
      step();
    });
  }
})();
