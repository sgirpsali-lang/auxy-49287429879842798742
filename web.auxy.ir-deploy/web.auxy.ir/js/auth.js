/* Auxy Web Main — native Supabase password authentication.
   Username is only the public login identifier. Supabase Auth stores/verifies
   the real password; public SQL never receives or verifies passwords. */
(function(){
  'use strict';

  var SUPABASE_URL='https://realtoiyrtvjfohovoda.supabase.co';
  var SUPABASE_KEY='sb_publishable_Y44ggVO5LY98YbNIGp2L-Q_HIUm7GCS';
  var LOGIN_PATH='/login/';
  var HOME_PATH='/home/';
  var A=window.AUXY=Object.assign(window.AUXY||{},{
    LOGIN_PATH:LOGIN_PATH,
    HOME_PATH:HOME_PATH,
    SUPABASE_URL:SUPABASE_URL,
    SUPABASE_KEY:SUPABASE_KEY,
    VERSION:'MAIN'
  });

  if(!window.supabase || typeof window.supabase.createClient!=='function'){
    A.client=null;
    A.authReady=false;
    A.authLoadError=new Error('supabase_library_unavailable');
    A.whenReady=function(){return Promise.reject(A.authLoadError);};
    return;
  }

  A.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{
      flowType:'implicit',
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      storageKey:'auxy-auth'
    },
    global:{headers:{'x-client-info':'auxy-web-main'}}
  });
  A.authReady=true;
  A.whenReady=function(){return Promise.resolve(A.client);};

  function cleanUsername(v){return String(v==null?'':v).trim().replace(/^@+/,'').toLowerCase();}
  function cleanEmail(v){return String(v==null?'':v).trim().toLowerCase();}
  function normalizeError(e){
    if(!e) return new Error('auth_error');
    if(e instanceof Error) return e;
    var x=new Error(e.message||e.error_description||e.msg||'auth_error');
    Object.keys(e).forEach(function(k){try{x[k]=e[k];}catch(_){}});
    return x;
  }
  function authError(e){
    var x=normalizeError(e), m=String(x.message||'').toLowerCase();
    if(m.indexOf('invalid login credentials')>-1 || m.indexOf('invalid credentials')>-1) x.code='invalid_credentials';
    if(m.indexOf('email not confirmed')>-1) x.code='email_not_confirmed';
    if(m.indexOf('user already registered')>-1 || m.indexOf('already registered')>-1) x.code='email_already_registered';
    if(m.indexOf('password should be at least')>-1) x.code='password_too_short';
    return x;
  }

  A.getSession=async function(){
    if(!A.client) return null;
    var r=await A.client.auth.getSession();
    if(r.error) throw authError(r.error);
    return r.data && r.data.session ? r.data.session : null;
  };
  A.getUser=async function(){
    if(!A.client) return null;
    var r=await A.client.auth.getUser();
    if(r.error) throw authError(r.error);
    return r.data && r.data.user ? r.data.user : null;
  };

  A.resolveUsername=async function(username){
    if(!A.client) throw new Error('supabase_library_unavailable');
    var u=cleanUsername(username);
    if(!u) {var e=new Error('username_required');e.code='username_required';throw e;}
    var r=await A.client.rpc('resolve_username_login',{p_username:u});
    if(r.error) throw authError(r.error);
    var row=Array.isArray(r.data)?r.data[0]:r.data;
    if(!row || !row.email){var nf=new Error('username_not_found');nf.code='username_not_found';throw nf;}
    return {email:row.email,hasPassword:row.has_password!==false};
  };

  A.syncAuthPassword=async function(){
    try{
      var r=await A.client.rpc('sync_auth_password');
      if(r.error) throw r.error;
      return r.data;
    }catch(e){
      /* Keep login usable against a database that has not received the
         optional sync function yet. Core will still call ensure_profile. */
      console.warn('[Auxy] sync_auth_password:',e);
      return null;
    }
  };

  A.ensureReadyProfile=async function(){
    if(!A.client) throw new Error('supabase_library_unavailable');
    var last=null;
    for(var i=0;i<3;i++){
      try{
        var en=await A.client.rpc('ensure_profile');
        if(en.error) throw en.error;
        await A.syncAuthPassword();
        var s=await A.getSession();
        if(!s) throw new Error('session_missing');
        var p=await A.client.from('profiles').select('id,username,is_banned').eq('id',s.user.id).maybeSingle();
        if(p.error) throw p.error;
        if(!p.data) throw new Error('profile_missing');
        if(p.data.is_banned){
          var be=new Error('account_banned');be.code='account_banned';throw be;
        }
        if(p.data.username){
          var f=await A.client.rpc('finish_onboarding');
          if(f.error && !['no_username','no_password'].includes(f.error.message)) throw f.error;
        }
        return p.data;
      }catch(e){
        last=e;
        if(e && (e.status===401 || e.code==='PGRST301')){
          try{await A.client.auth.refreshSession();}catch(_){ }
        }
        await new Promise(function(r){setTimeout(r,250*(i+1));});
      }
    }
    throw authError(last||new Error('profile_not_ready'));
  };

  A.signInWithUsername=async function(username,password){
    var u=cleanUsername(username), p=String(password==null?'':password);
    if(!u){var e1=new Error('username_required');e1.code='username_required';throw e1;}
    if(!p){var e2=new Error('password_required');e2.code='password_required';throw e2;}
    var resolved=await A.resolveUsername(u);
    var r=await A.client.auth.signInWithPassword({email:resolved.email,password:p});
    if(r.error) throw authError(r.error);
    try{await A.client.rpc('ensure_auxy_welcome');}catch(_){}
    try{await A.ensureReadyProfile();}catch(e){
      await A.client.auth.signOut({scope:'local'}).catch(function(){});
      throw e;
    }
    return r.data;
  };

  A.register=async function(username,password,email,displayName){
    var u=cleanUsername(username), em=cleanEmail(email), p=String(password==null?'':password);
    if(!u){var e1=new Error('username_required');e1.code='username_required';throw e1;}
    if(!em){var e2=new Error('email_required');e2.code='email_required';throw e2;}
    if(p.length<8){var e3=new Error('password_too_short');e3.code='password_too_short';throw e3;}
    var chk=await A.client.rpc('check_username',{p_username:u});
    if(chk.error) throw authError(chk.error);
    if(!chk.data || chk.data.ok===false){var e4=new Error((chk.data&&chk.data.code)||'username_taken');e4.code=(chk.data&&chk.data.code)||'username_taken';throw e4;}

    var s=await A.client.auth.signUp({
      email:em,
      password:p,
      options:{data:{username:u,display_name:String(displayName||u).trim()||u}}
    });
    if(s.error) throw authError(s.error);

    if(s.data && s.data.session){
      try{
        var c=await A.client.rpc('claim_username',{p_username:u});
        if(c.error) throw c.error;
      }catch(e){
        await A.client.auth.signOut().catch(function(){});
        throw authError(e);
      }
      await A.syncAuthPassword();
      await A.client.rpc('finish_onboarding').catch(function(){});
      await A.client.rpc('ensure_auxy_welcome').catch(function(){});
    }
    return s.data;
  };

  A.sendRecoveryCode=async function(email){
    var em=cleanEmail(email);
    if(!em){var e=new Error('email_required');e.code='email_required';throw e;}
    var r=await A.client.auth.signInWithOtp({
      email:em,
      options:{shouldCreateUser:false}
    });
    if(r.error) throw authError(r.error);
    return true;
  };

  A.verifyRecoveryCode=async function(email,token,newPassword){
    var em=cleanEmail(email), t=String(token||'').trim(), p=String(newPassword||'');
    if(!/^\d{6}$/.test(t)){var e1=new Error('invalid_otp');e1.code='invalid_otp';throw e1;}
    if(p.length<8){var e2=new Error('password_too_short');e2.code='password_too_short';throw e2;}
    var v=await A.client.auth.verifyOtp({email:em,token:t,type:'email'});
    if(v.error) throw authError(v.error);
    var u=await A.client.auth.updateUser({password:p});
    if(u.error) throw authError(u.error);
    await A.syncAuthPassword();
    if(u.data && u.data.user){
      var f=await A.client.rpc('finish_onboarding');
      if(f.error && f.error.message!=='no_username') throw f.error;
    }
    return u.data;
  };

  A.verifyPassword=async function(password){
    var s=await A.getSession();
    if(!s || !s.user || !s.user.email){var e=new Error('session_missing');e.code='session_missing';throw e;}
    var r=await A.client.auth.signInWithPassword({email:s.user.email,password:String(password||'')});
    if(r.error) throw authError(r.error);
    await A.syncAuthPassword();
    return {ok:true};
  };

  A.changePassword=async function(oldPassword,newPassword){
    await A.verifyPassword(oldPassword);
    var r=await A.client.auth.updateUser({password:String(newPassword||'')});
    if(r.error) throw authError(r.error);
    await A.syncAuthPassword();
    return r.data;
  };

  A.signOut=function(){
    var done=function(){window.location.replace(LOGIN_PATH);};
    if(!A.client){done();return Promise.resolve();}
    return A.client.auth.signOut({scope:'local'}).then(done,done);
  };
  A.signOutEverywhere=function(){
    var done=function(){window.location.replace(LOGIN_PATH);};
    if(!A.client){done();return Promise.resolve();}
    return A.client.auth.signOut({scope:'global'}).then(done,done);
  };
  A.guard=function(){
    return A.getSession().then(function(session){
      if(!session){window.location.replace(LOGIN_PATH);return null;}
      A.client.auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT') window.location.replace(LOGIN_PATH);});
      document.documentElement.style.visibility='visible';
      return session;
    });
  };

  window.addEventListener('unhandledrejection',function(e){
    if(e.reason && e.reason.code==='AuthSessionMissingError') e.preventDefault();
  });
})();
