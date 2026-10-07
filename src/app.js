
/* ════════════ APP ════════════ */
(function () {
  'use strict';

  /* Course facts derived from the race data, never typed in. */
  var RUNNER = RACE.runner.name;       /* default runner for this build */
  var KEY = RACE.key + '.';           /* storage prefix, per race */
  fillPlans(STATIONS, PLANS, RACE.pacing);
  var PACELINE = RACE.paceLine || PLANS.map(function(p){ return [p.name, p.k]; });
  var COURSE_MI = STATIONS[STATIONS.length-1].mi;
  var COURSE_CLIMB = STATIONS.reduce(function(t,s){ return t+(s.gain||0); },0);
  var COURSE_MI_TXT = COURSE_MI.toFixed(1);
  var COURSE_CLIMB_TXT = COURSE_CLIMB.toLocaleString('en-US');
  /* Pacers may join or leave only at stations flagged pacer:1; the finish is the last. */
  var SWAPS = STATIONS.filter(function(s){ return s.pacer; }).map(function(s){ return s.mi; });
  var PACER_FROM = SWAPS[0];
  var HAS_PACERS = SWAPS.length > 0;
  var NUMW = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
  function numw(n){ var w = NUMW[n] || String(n); return w.charAt(0).toUpperCase()+w.slice(1); }
  document.body.classList.toggle('nopacers', !HAS_PACERS);
  var START = new Date(RACE.startISO).getTime(), MIN = 60000;
  var S = { mode:null, plan:'goal', proj:'pace', theme:'light', gps:false, atomWho:{}, checks:{}, custom:[], people:[], notes:{}, splits:{}, aidOv:{}, secOv:{}, driveOv:{}, bib:'', me:null, hidePast:false, gearAdd:{}, gearRemoved:{}, gearOverride:{}, paceOv:{}, fuelOv:{} };

  /* Where a map link is safe, and where it is not: from the race file. */
  var MAPQ = RACE.mapQuery;
  var NOMAP = {};
  Object.keys(RACE.noMap).forEach(function(k){ NOMAP[k] = RACE.noMap[k].replace(/\{runner\}/g, RUNNER); });

  var mem = {};
  function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); return v; }
    catch(e){ if(v===undefined) return mem[k]==null?null:mem[k]; mem[k]=v; return v; } }
  function jget(k,d){ try{ return JSON.parse(ls(k))||d; }catch(e){ return d; } }
  function save(){ ls(KEY+'mode',S.mode); ls(KEY+'plan',S.plan); ls(KEY+'me',S.me||'');
    ls(KEY+'checks',JSON.stringify(S.checks)); ls(KEY+'custom',JSON.stringify(S.custom));
    ls(KEY+'people',JSON.stringify(S.people)); ls(KEY+'notes',JSON.stringify(S.notes));
    ls(KEY+'secov',JSON.stringify(S.secOv||{}));
    ls(KEY+'driveov',JSON.stringify(S.driveOv||{}));
    if(!(DEMO&&DEMO.on)) ls(KEY+'splits',JSON.stringify(S.splits)); ls(KEY+'aidov',JSON.stringify(S.aidOv));
    ls(KEY+'bib',S.bib||''); ls(KEY+'theme',S.theme); ls(KEY+'proj',S.proj);
    ls(KEY+'gps',S.gps?'1':''); ls(KEY+'atomwho',JSON.stringify(S.atomWho||{}));
    ls(KEY+'gearadd',JSON.stringify(S.gearAdd||{})); ls(KEY+'gearrm',JSON.stringify(S.gearRemoved||{}));
    ls(KEY+'gearov',JSON.stringify(S.gearOverride||{}));
    ls(KEY+'paceov',JSON.stringify(S.paceOv||{}));
    ls(KEY+'fuelov',JSON.stringify(S.fuelOv||{})); }

  var fT = new Intl.DateTimeFormat('en-US',{timeZone:RACE.tz,hour:'numeric',minute:'2-digit'});
  var fD = new Intl.DateTimeFormat('en-US',{timeZone:RACE.tz,weekday:'short'});
  var fFull = new Intl.DateTimeFormat('en-US',{timeZone:RACE.tz,weekday:'long',month:'long',day:'numeric'});
  /* 'YYYY-MM-DDTHH:MM' as a clock time in the race's own time zone -> ms.
     Two passes, so a time just after a daylight-saving change still lands right. */
  var fZ = new Intl.DateTimeFormat('en-CA',{timeZone:RACE.tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  function tzOffset(ms){ var g={}; fZ.formatToParts(new Date(ms)).forEach(function(p){ g[p.type]=p.value; });
    return Date.UTC(+g.year,+g.month-1,+g.day,(+g.hour)%24,+g.minute,+g.second)-Math.floor(ms/1000)*1000; }
  function tzMs(s){ var m=/(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(s); if(!m) return NaN;
    var w=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]), t=w-tzOffset(w); return w-tzOffset(t); }
  function tOf(ms){ return fT.format(new Date(ms)).replace(' AM',' am').replace(' PM',' pm'); }
  function clk(m){ return (m==null||!isFinite(m))?'—':tOf(START+m*MIN); }
  /* day on its own, so a stat tile can show "1:03 pm" big with "arrive by
     Fri" underneath rather than wrapping "1:03 pm Fri" onto two lines and
     stretching every tile in the row to match */
  function dyOf(m){ return (m==null||!isFinite(m))?'':fD.format(new Date(START+m*MIN)); }
  function clkDay(m){ return (m==null||!isFinite(m))?'—':tOf(START+m*MIN)+' '+fD.format(new Date(START+m*MIN)); }
  /* the same value with the weekday demoted to its own line, for the stat
     chips, where "11:13 am Fri" on one line does not fit a third of a card */
  function clkDay2(m){ return (m==null||!isFinite(m))?'—':
    tOf(START+m*MIN)+'<small>'+fD.format(new Date(START+m*MIN))+'</small>'; }
  function dur(m){ if(m==null||!isFinite(m)) return '—';
    var neg=m<0; m=Math.abs(Math.round(m));
    var h=Math.floor(m/60), mm=m%60;
    return (neg?'−':'')+(h?h+'h ':'')+(h?String(mm).padStart(2,'0')+'m':mm+'m'); }
  function hm(m){ m=Math.round(m); return Math.floor(m/60)+':'+String(m%60).padStart(2,'0'); }
  /* Two paces matter at a checkpoint: what the last leg cost you, and what
     your running average is through that point. The second is the one that
     tells you whether the plan is still alive. */
  function legPace(i){ var L=legInto(i); return L&&L.mi>0 ? pace(L.mi,L.mins) : null; }
  function cumPace(i){ var s=STATIONS[i]; return s.mi>0 ? pace(s.mi, T(s)) : null; }
  function pace(mi,mins){ var p=mins/mi; return Math.floor(p)+':'+String(Math.round(p%1*60)).padStart(2,'0'); }
  function now(){ return (DEMO&&DEMO.on) ? DEMO.t : (Date.now()-START)/MIN; }
  /* Your own splits, layered over the built-in plan. Stored per plan key so
     editing your goal never touches the Cutoff or 2025-field reference
     columns, which are official data and must stay as published.
     planT() is the one place every clock in the app resolves through, so an
     override here reaches arrival times, cutoff margins, crew ETAs, the
     printable brief and the race-day projection without touching any of them. */
  function paceOvFor(k){ return (S.paceOv&&S.paceOv[k||S.plan])||null; }
  function planT(s){
    if(!s) return 0;
    var ov=paceOvFor(), i=s.__i;
    if(ov && i!=null){ var v=ov[i]; if(v!=null && isFinite(v)) return +v; }
    return s[S.plan];
  }
  /* the built-in value, ignoring any override -- what "reset" goes back to */
  function planBase(i,k){ return STATIONS[i][k||S.plan]; }
  function planMins(i,k){
    var ov=paceOvFor(k);
    if(ov){ var v=ov[i]; if(v!=null && isFinite(v)) return +v; }
    return planBase(i,k);
  }
  function planFinish(k){ return planMins(STATIONS.length-1,k); }
  function paceEdited(k){
    var ov=paceOvFor(k); if(!ov) return false;
    for(var i in ov) if(ov[i]!=null && isFinite(ov[i])) return true;
    return false;
  }
  /* Write a whole set of arrival minutes for the current plan. Always stored
     as absolute minutes from the gun so nothing has to be recomputed later. */
  function setPaceFor(k, mins){
    S.paceOv=S.paceOv||{};
    var o={};
    for(var i=1;i<STATIONS.length;i++){
      var v=mins[i];
      if(v!=null && isFinite(v)) o[i]=Math.max(0,Math.round(v));
    }
    S.paceOv[k]=o;
    save(); markDirty(); render();
  }
  /* The three goals are edited together on one screen, so they reset together
     too. Cutoff is published data and is never touched either way. */
  var GOALKS=PLANS.filter(function(p){return !p.cutoff;}).map(function(p){return p.k;});
  function resetGoals(){
    if(S.paceOv) GOALKS.forEach(function(k){ delete S.paceOv[k]; });
    save(); markDirty(); render();
  }
  function goalsEdited(){ return GOALKS.some(function(k){ return paceEdited(k); }); }
  /* current arrival minutes for every station, override-aware */
  function paceNow(k){
    return STATIONS.map(function(_,i){ return i===0?0:planMins(i,k); });
  }
  /* T() is the projection actually shown everywhere. With no logged splits it is
     the selected plan. Once the crew logs a station it becomes: observed time so
     far, plus the remaining plan stretched by the pace ratio observed to date. */
  var PROJ=null;
  function splitOf(i){ return S.splits[i]||null; }
  function splitVal(i){ var sp=splitOf(i); if(!sp) return null;
    return sp.out!=null?sp.out:(sp.in!=null?sp.in:null); }
  function lastSplitIdx(){ var last=-1;
    for(var i=0;i<STATIONS.length;i++) if(splitVal(i)!=null) last=i;
    return last; }
  function reproject(){
    var out=STATIONS.map(function(s){ return {min:planT(s), src:'plan'}; }), last=-1;
    STATIONS.forEach(function(s,i){
      var v=splitVal(i);
      if(v!=null){ out[i]={min:v, src:'log'}; last=i; }
    });
    if(last>0){
      var pL=planT(STATIONS[last]), aL=out[last].min;
      /* Past is fact, future is forecast. Two ways to forecast:
         'pace' scales the remaining plan by the pace actually run so far —
         if you are six percent down at mile 70 you will be six percent down
         at the finish. 'goal' keeps the plan's own segment durations and just
         shifts everything by the gap, i.e. assumes you hold goal pace from
         here. 'pace' is the honest one late in a hundred; 'goal' is the
         optimistic one. Selectable, defaults to 'pace'. */
      var r = (S.proj==='goal') ? 1 : (pL>0?aL/pL:1);
      var shift = (S.proj==='goal') ? (aL-pL) : 0;
      for(var j=last+1;j<STATIONS.length;j++)
        out[j]={min: (S.proj==='goal') ? planT(STATIONS[j])+shift
                                       : aL+(planT(STATIONS[j])-pL)*r, src:'proj'};
    }
    /* 'smart' is the default: the fitted model, blended with the plan (src/eta.js) */
    if(S.proj!=='pace' && S.proj!=='goal') out=smartProject(out,last);
    PROJ=out;
  }
  function T(s){ var i=s&&s.__i; return (PROJ&&i!=null)?PROJ[i].min:planT(s); }
  function anySplits(){ return lastSplitIdx()>=0; }
  function isRaceDay(){ var n=now(); return n>=-30 && n<=RACE.limit+120; }
  function raceClock(){
    var n=now();
    if(n<0) return {t:'\u2014', s:'starts '+clk(0)};
    var h=Math.floor(n/60), m=Math.floor(n%60), s=Math.floor((n*60)%60);
    return {t:h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'), s:'elapsed'};
  }
  function applyTheme(){
    var dark = S.theme==='dark' ||
      (S.theme==='auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    var m=document.querySelector('meta[name=theme-color]');
    if(m) m.setAttribute('content', dark?'#0B1317':'#E9EDEE');
  }
  function paintClock(){
    var el=document.getElementById('navClock'); if(!el) return;
    if(!isRaceDay()){ el.style.display='none'; return; }
    el.style.display='';
    var c=raceClock();
    el.innerHTML='<span class="rc-dot"></span><span class="num">'+c.t+'</span>';
  }

  /* ── logging ── */
  function setSplit(i,field,mins){
    var sp=S.splits[i]||{}; 
    if(mins==null) delete sp[field]; else sp[field]=Math.round(mins);
    if(sp.in==null&&sp.out==null) delete S.splits[i]; else S.splits[i]=sp;
    if(DEMO&&DEMO.on) demoKeep(i);
    save(); reproject(); pushSplit(i);
  }
  function logSheet(i){
    var s=STATIONS[i], sp=splitOf(i)||{};
    function fieldRow(f,label){
      var v=sp[f];
      return '<div class="logrow"><div class="mid"><div class="nm">'+label+'</div>'+
        '<div class="dt">'+(v!=null?clkDay(v)+' \u00b7 '+dur(v)+' elapsed':'not logged')+'</div></div>'+
        (v!=null
          ? '<button class="btn tint sm" data-clear="'+f+'" style="width:auto;padding:0 14px">Clear</button>'
          : '<button class="btn sm" data-now="'+f+'" style="width:auto;padding:0 16px">Now</button>')+
        '</div>';
    }
    var d=new Date(START+(sp.out!=null?sp.out:sp.in!=null?sp.in:T(s))*MIN);
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:RACE.tz,year:'numeric',month:'2-digit',
      day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
    var g={}; parts.forEach(function(p){g[p.type]=p.value;});
    sheet('Log '+s.name,
      '<div class="cap" style="margin:-8px 0 12px">Mile '+s.mi.toFixed(1)+
      (s.cut!=null?' \u00b7 cutoff '+clkDay(s.cut):' \u00b7 no cutoff')+'</div>'+
      '<div class="list" style="margin-bottom:14px">'+fieldRow('in','Arrived')+fieldRow('out','Left')+'</div>'+
      '<div class="fld"><label>Or set a time by hand</label><div class="two">'+
      '<input type="date" id="lgD" value="'+g.year+'-'+g.month+'-'+g.day+'">'+
      '<input type="time" id="lgT" value="'+((g.hour==='24'?'00':g.hour)+':'+g.minute)+'"></div></div>'+
      '<div class="btn-row"><button class="btn tint sm" id="setIn">Set arrival</button>'+
      '<button class="btn tint sm" id="setOut">Set departure</button></div>'+
      '<p class="cap" style="margin-top:12px">Departure is what the cutoffs measure \u2014 you must <i>leave</i> before the cutoff, not arrive. Logging a time re-times every station after it.</p>');
    function done(){ closeSheet(); render(); }
    shEl.querySelectorAll('[data-now]').forEach(function(b){
      b.onclick=function(){ setSplit(i,b.dataset.now,now()); done(); }; });
    shEl.querySelectorAll('[data-clear]').forEach(function(b){
      b.onclick=function(){ setSplit(i,b.dataset.clear,null); done(); }; });
    function manual(f){
      var dd=document.getElementById('lgD').value, tt=document.getElementById('lgT').value;
      if(!dd||!tt) return;
      setSplit(i,f,(tzMs(dd+'T'+tt)-START)/MIN); done();
    }
    document.getElementById('setIn').onclick=function(){ manual('in'); };
    document.getElementById('setOut').onclick=function(){ manual('out'); };
  }
  /* One primary button whose label follows the state of the station. */
  function logButtons(i,tone){
    var sp=splitOf(i)||{}, t=tone||'';
    var out='';
    if(sp.in==null){
      out+='<button class="btn '+t+'" data-log="'+i+':in">'+RUNNER+' arrived</button>';
    } else if(sp.out==null){
      out+='<div class="logged"><b>Arrived '+clk(sp.in)+'</b> \u00b7 '+dur(sp.in)+' elapsed</div>'+
        '<button class="btn '+t+'" data-log="'+i+':out">'+RUNNER+' left</button>';
    } else {
      out+='<div class="logged"><b>In '+clk(sp.in)+' \u00b7 out '+clk(sp.out)+'</b> \u00b7 '+
        dur(sp.out-sp.in)+' in the station</div>';
    }
    out+='<button class="btn ghost sm" data-fix="'+i+'">'+(sp.in==null?'Log a different time':'Fix these times')+'</button>';
    return '<div class="logbox">'+out+'</div>';
  }

  /* Six aid stations are not crew stops, and the crew has a long rest
     block mid-race. Without this there is no way to record "a volunteer
     radioed that he came through Long Lake" if the timing feed is down. */
  function logAnySheet(){
    var rows=STATIONS.map(function(s,i){
      var sp=splitOf(i), state = !sp ? 'not logged'
        : sp.out!=null ? ('in '+clk(sp.in)+' \u00b7 out '+clk(sp.out))
        : ('arrived '+clk(sp.in));
      return '<button class="item" data-any="'+i+'"><div class="lead num">'+
        (sp&&sp.out!=null?'\u2713':s.mi.toFixed(0))+'</div>'+
        '<div class="mid"><div class="nm">'+s.name+'</div>'+
        '<div class="dt">mile '+s.mi.toFixed(1)+' \u00b7 '+state+'</div></div>'+
        '<div class="rt"><div class="a num">'+clk(T(s))+'</div><div class="b">expected</div></div>'+
        CHEV+'</button>';
    }).join('');
    sheet('Log any aid station',
      '<p class="sec" style="margin-bottom:12px">For stations the crew does not visit, or when someone passes word along. Departure is the one the cutoffs measure.</p>'+
      '<div class="list">'+rows+'</div>');
    shEl.querySelectorAll('[data-any]').forEach(function(b){
      b.onclick=function(){ logSheet(+b.dataset.any); };
    });
  }

  function bindLog(){
    document.querySelectorAll('[data-log]').forEach(function(b){
      b.onclick=function(){
        var p=b.dataset.log.split(':');
        if(!isRaceDay()){ logSheet(+p[0]); return; }   // no timestamping 45 days early
        setSplit(+p[0],p[1],now()); render();
      };
    });
    document.querySelectorAll('[data-fix]').forEach(function(b){
      b.onclick=function(){ logSheet(+b.dataset.fix); };
    });
    document.querySelectorAll('[data-logany]').forEach(function(b){
      b.onclick=logAnySheet;
    });
  }
  function idxOf(mi){ for(var i=0;i<STATIONS.length;i++) if(STATIONS[i].mi===mi) return i; return -1; }
  function st(mi){ var i=idxOf(mi); return i<0?null:STATIONS[i]; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];}); }
  var CHEV = '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

  function elevAt(mi){ for(var i=1;i<PROFILE.length;i++) if(mi<=PROFILE[i][0]){
      var a=PROFILE[i-1],b=PROFILE[i],f=b[0]>a[0]?(mi-a[0])/(b[0]-a[0]):0; return a[1]+f*(b[1]-a[1]); }
    return PROFILE[PROFILE.length-1][1]; }
  function minsAtMile(mi){ for(var i=1;i<STATIONS.length;i++) if(mi<=STATIONS[i].mi){
      var a=STATIONS[i-1],b=STATIONS[i],f=(mi-a.mi)/(b.mi-a.mi); return T(a)+f*(T(b)-T(a)); }
    return T(STATIONS[STATIONS.length-1]); }
  function mileAt(m){ if(m<=0) return 0; var L=STATIONS.length-1;
    if(m>=T(STATIONS[L])) return STATIONS[L].mi;
    for(var i=1;i<=L;i++) if(m<=T(STATIONS[i])){
      var a=T(STATIONS[i-1]),b=T(STATIONS[i]),f=b>a?(m-a)/(b-a):0;
      return STATIONS[i-1].mi+f*(STATIONS[i].mi-STATIONS[i-1].mi); }
    return STATIONS[L].mi; }
  function secFor(mi){ for(var i=0;i<SECTIONS.length;i++) if(mi>=SECTIONS[i].from&&mi<=SECTIONS[i].to) return SECTIONS[i];
    return SECTIONS[SECTIONS.length-1]; }
  function secMins(s){ return T(st(s.to))-T(st(s.from)); }

  /* ── tabs ── */
  var IC = {
    next:'<path d="M12 21.5s7-6 7-11.5a7 7 0 10-14 0c0 5.5 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.6"/>',
    stops:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.6"/><circle cx="4.5" cy="12" r="1.6"/><circle cx="4.5" cy="18" r="1.6"/>',
    sched:'<rect x="3" y="5" width="18" height="16" rx="3.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.6M12 7.6v.6"/>',
    race:'<path d="M3 17l5-7 4 4 4-8 5 11"/>',
    course:'<path d="M2 19l6-13 4.5 8.5L15.5 9 22 19z"/>',
    team:'<circle cx="9" cy="8" r="3.2"/><circle cx="17.5" cy="9.5" r="2.3"/><path d="M2.5 19.5c0-3.4 2.9-5.3 6.5-5.3s6.5 1.9 6.5 5.3M17.5 14.2c2.3 0 4 1.5 4 3.8"/>',
    kit:'<rect x="3" y="8" width="18" height="12.5" rx="3"/><path d="M8.5 8V5.8A3.5 3.5 0 0115.5 5.8V8M9.5 13.5h5"/>',
    leg:'<circle cx="14" cy="4.6" r="2"/><path d="M9.5 21l2.3-6.6L9 11l1-4 3.6 1 2.4 2.6M13.8 14.4L16.4 21M6 10.4l3-2"/>',
    aid:'<path d="M12 21.5s7-6 7-11.5a7 7 0 10-14 0c0 5.5 7 11.5 7 11.5z"/><path d="M12 7.4v5.2M9.4 10h5.2"/>',
    now:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
    know:'<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5zM4 20.5A2.5 2.5 0 006.5 21H20M8.5 7.5h7M8.5 11h5"/>'
  };
  /* Filled counterparts for the five tabs. Knocked-out details are stroked in
     the card colour so they read as holes in a solid shape. */
  var ICF = {
    race:'<path d="M3 16.2l5-7 4 4 4-8 5 11" fill="none" stroke="currentColor" '+
         'stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>'+
         '<rect x="2.3" y="19.4" width="19.4" height="2.1" rx="1.05"/>',
    course:'<path d="M2 19l6-13 4.5 8.5L15.5 9 22 19z"/>',
    aid:'<path d="M12 21.5s7-6 7-11.5a7 7 0 10-14 0c0 5.5 7 11.5 7 11.5z"/>'+
        '<path d="M12 7v6M9 10h6" fill="none" stroke="var(--card)" stroke-width="2.1" stroke-linecap="round"/>',
    sched:'<rect x="3" y="6.4" width="18" height="14.6" rx="3.5"/>'+
        '<path d="M8 3.2v4M16 3.2v4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>'+
        '<path d="M3.4 11.6h17.2" fill="none" stroke="var(--card)" stroke-width="1.7"/>',
    stops:'<rect x="8" y="4.6" width="13" height="2.6" rx="1.3"/>'+
        '<rect x="8" y="10.7" width="13" height="2.6" rx="1.3"/>'+
        '<rect x="8" y="16.8" width="13" height="2.6" rx="1.3"/>'+
        '<circle cx="4.2" cy="5.9" r="1.9"/><circle cx="4.2" cy="12" r="1.9"/>'+
        '<circle cx="4.2" cy="18.1" r="1.9"/>',
    team:'<circle cx="9" cy="7.8" r="3.4"/>'+
        '<path d="M2.6 19.8c0-3.6 2.9-5.7 6.4-5.7s6.4 2.1 6.4 5.7z"/>'+
        '<circle cx="17.6" cy="9.6" r="2.4"/>'+
        '<path d="M16.6 13.9c.35-.06.68-.09 1-.09 2.3 0 3.9 1.5 3.9 3.9h-3.2c0-1.5-.6-2.8-1.7-3.8z"/>'
  };
  var TABS = {
    crew:[['c-next','Next stop','next'],['c-stops','All stops','stops'],['x-course','Course','course'],['x-sched','Schedule','sched'],['c-info','Info','info']],
    pacer:[['p-leg','My leg','leg'],['x-course','Course','course'],['x-sched','Schedule','sched'],['p-info','Rules','info']],
    runner:[['r-race','Race','race'],['r-course','Course','course'],['r-aid','Aid','aid'],['x-sched','Schedule','sched'],['r-profile','Profile','team']]
  };
  /* Everyone gets the same five. Crew and pacers get a sixth in front of
     them, which is the only structural difference between the two views. */
  function tabsFor(){
    /* Crew and pacers watch, plan and look things up: three tabs. The runner
       builds the plan and keeps the five they had. */
    return [['n-now','Now','now'],['r-crew','Plan','stops'],['r-course','Course','course'],['r-aid','Aid','aid'],['k-know','Know','know']];
  }
  function buildTabs(){
    document.getElementById('tabs').innerHTML = tabsFor().map(function(t,i){
      return '<button class="tab'+(i?'':' on')+'" data-v="'+t[0]+'">'+
        '<span class="ic"><svg class="ic-o" viewBox="0 0 24 24">'+IC[t[2]]+'</svg>'+
        (ICF[t[2]]?'<svg class="ic-f" viewBox="0 0 24 24">'+ICF[t[2]]+'</svg>':'')+'</span>'+
        '<span>'+t[1]+'</span></button>';
    }).join('');
    document.querySelectorAll('.tab').forEach(function(b){
      b.onclick = function(){
        if(b.classList.contains('on') && !detailKey && !SUBV){ window.scrollTo({top:0,behavior:'smooth'}); return; }
        if(detailKey||SUBV){ detailKey=null; SUBV=null; setNav(false); }
        DET_RET=b.dataset.v;
        var tabs=[].slice.call(document.querySelectorAll('.tab'));
        var from=tabs.findIndex(function(x){return x.classList.contains('on');});
        var to=tabs.indexOf(b);
        tabs.forEach(function(x){x.classList.remove('on');});
        b.classList.add('on');
        var leaving=document.querySelector('.view.on');
        if(leaving) TABY[leaving.id]=window.scrollY||window.pageYOffset||0;
        swapView(b.dataset.v, (from>=0 && to<from) ? 'en-l' : 'en-r');
        window.scrollTo(0, TABY[b.dataset.v]||0);
        if (b.dataset.v==='r-race') drawProfile('profile');
        if (b.dataset.v==='x-course') renderCourse();
        if (b.dataset.v==='r-course') renderMap();
        if (b.dataset.v==='r-profile') renderProfile();
        if (b.dataset.v==='n-now'){ NOW_HTML=null; renderNow(); }
        if (b.dataset.v==='k-know') renderKnow();
      };
    });
    document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on');});
    document.getElementById(tabsFor()[0][0]).classList.add('on');
    document.body.classList.toggle('on-now', tabsFor()[0][0]==='n-now');
  }
  /* Everyone gets the same app now; the only thing identity changes is the
     job card at the top of the race screen. S.mode is kept at 'runner' so
     the handful of places that still read it keep working. */
  function startApp(){
    S.mode='runner'; save();
    NAVT = RACE.short;   /* crew see their own name beside it, so the short one fits */
    setNav(false);
    document.getElementById('foot').innerHTML =
      RACE.copy.footer;
    buildTabs(); render();
  }

  /* ── profile ── */
  var PG = {}; var PROF_ID='profile';
  function drawProfile(id){
    var svg=document.getElementById(id||PROF_ID);
    if(!svg) return;
    PROF_ID=svg.id;
    var C={ green:cv('--green','#1B5340'), red:cv('--red','#8E2F1D'), ink:cv('--text','#13201A'),
            dim:cv('--text-3','#879289'), hair:cv('--hair','rgba(22,34,27,.085)'),
            card:cv('--card','#fff'), night:cv('--night','#DFE3E4'), gold:cv('--gold-solid','#B5801E') };
    var W=Math.max(300, svg.parentNode.clientWidth||360), H=W<500?188:224;
    var pl=38,pr=12,pt=14,pb=22,iw=W-pl-pr,ih=H-pt-pb,LO=6600,HI=10700,MX=COURSE_MI;
    var X=function(m){return pl+m/MX*iw;}, Y=function(f){return pt+ih-(f-LO)/(HI-LO)*ih;};
    PG={W:W,pl:pl,iw:iw,MX:MX,X:X,Y:Y};
    svg.setAttribute('viewBox','0 0 '+W+' '+H); svg.setAttribute('width',W); svg.setAttribute('height',H);
    var o=[],area='M'+X(0)+','+Y(LO);
    PROFILE.forEach(function(p){ area+='L'+X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1); });
    area+='L'+X(MX)+','+Y(LO)+'Z';
    o.push('<defs><clipPath id="pc"><path d="'+area+'"/></clipPath>'+
      '<linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0" stop-color="'+C.green+'" stop-opacity=".22"/>'+
      '<stop offset="1" stop-color="'+C.green+'" stop-opacity=".03"/></linearGradient></defs>');
    RACE.dark.forEach(function(d){ var a=mileAt(d[0]),b=mileAt(d[1]);
      if(b>a) o.push('<rect x="'+X(a).toFixed(1)+'" y="'+pt+'" width="'+(X(b)-X(a)).toFixed(1)+'" height="'+ih+'" fill="'+C.night+'"/>'); });
    for(var f=7000;f<=10500;f+=1000){
      o.push('<line x1="'+pl+'" y1="'+Y(f).toFixed(1)+'" x2="'+(W-pr)+'" y2="'+Y(f).toFixed(1)+'" stroke="'+C.hair+'"/>');
      o.push('<text x="'+(pl-6)+'" y="'+(Y(f)+4).toFixed(1)+'" fill="'+C.dim+'" font-size="11" text-anchor="end" font-family="'+FF+'">'+(f/1000)+'k</text>');
    }
    o.push('<g clip-path="url(#pc)"><rect x="'+pl+'" y="'+pt+'" width="'+iw+'" height="'+ih+'" fill="url(#pg)"/></g>');
    o.push('<path d="'+PROFILE.map(function(p,i){return (i?'L':'M')+X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1);}).join('')+
      '" fill="none" stroke="'+C.green+'" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>');
    STATIONS.forEach(function(s,si){
      var c=stationColour(s), x=X(s.mi), y=Y(s.elev);
      var sp=splitOf(si), gone=sp&&sp.out!=null;
      o.push('<line x1="'+x.toFixed(1)+'" y1="'+y.toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="'+(pt+ih)+
        '" stroke="'+c+'" stroke-width="1" opacity="'+(s.crew?'.35':'.16')+'"/>');
      o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(s.crew?5.4:3.6)+
        '" fill="'+C.card+'"/>');
      o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(s.crew?4:2.6)+
        '" fill="'+(gone?C.green:c)+'"/>');
      if(gone) o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="7.5" fill="none" stroke="'+C.green+'" stroke-width="1.4" opacity=".55"/>');
    });
    var nm=now();
    if(nm>0&&nm<RACE.limit+120){
      var L=livePos(), pm = L.state==='station' ? L.station.mi : (L.mi!=null?L.mi:mileAt(nm));
      var nx = L.next ? L.next.mi : pm;
      if(nx>pm) o.push('<rect x="'+X(pm).toFixed(1)+'" y="'+pt+'" width="'+(X(nx)-X(pm)).toFixed(1)+
        '" height="'+ih+'" fill="'+C.red+'" opacity=".07"/>');
      o.push('<line x1="'+X(pm).toFixed(1)+'" y1="'+pt+'" x2="'+X(pm).toFixed(1)+'" y2="'+(pt+ih)+
        '" stroke="'+C.red+'" stroke-width="2"/>');
      o.push('<circle cx="'+X(pm).toFixed(1)+'" cy="'+Y(elevAt(pm)).toFixed(1)+'" r="9" fill="'+C.red+'" opacity=".18"/>');
      o.push('<circle cx="'+X(pm).toFixed(1)+'" cy="'+Y(elevAt(pm)).toFixed(1)+'" r="5.5" fill="'+C.red+
        '" stroke="'+C.card+'" stroke-width="2.2"/>');
      var lx=Math.min(Math.max(X(pm),pl+26),W-pr-26);
      o.push('<text x="'+lx.toFixed(1)+'" y="'+(pt+9)+'" fill="'+C.red+'" font-size="11" font-weight="700" '+
        'font-family="'+FF+'" text-anchor="middle">'+pm.toFixed(1)+' mi</text>');
    }
    o.push('<line id="cur" x1="-9" y1="'+pt+'" x2="-9" y2="'+(pt+ih)+'" stroke="'+C.ink+'" stroke-width="1.5"/>');
    o.push('<circle id="curd" cx="-9" cy="0" r="6" fill="'+C.ink+'" stroke="'+C.card+'" stroke-width="2"/>');
    [0,25,50,75,100].forEach(function(m){
      o.push('<text x="'+X(m).toFixed(1)+'" y="'+(H-6)+'" fill="'+C.dim+'" font-size="11" font-family="'+FF+'" text-anchor="'+
        (m===0?'start':m===100?'end':'middle')+'">'+m+(m===100?' mi':'')+'</text>'); });
    svg.innerHTML=o.join('');
    var lg=document.getElementById(svg.id==='profile'?'profLegend':'profLegendC');
    if(lg) lg.innerHTML=profileLegend();
  }
  var FF = "-apple-system,system-ui,Segoe UI,Roboto,sans-serif";
  /* The chart is drawn in JS, so it has to read the palette rather than
     hardcode it — otherwise dark mode leaves a white box on a dark page. */
  function cv(n,fallback){
    var v=getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return v||fallback;
  }
  /* Marker colour says who can reach you there, which is the thing you actually
     scan the profile for. Gold = crew and a pacer swap, green = crew only,
     blue = drop bag but no crew, grey = you are on your own. */
  function stationColour(s){
    if(s.pacer&&s.crew) return cv('--gold-solid','#B5801E');
    if(s.crew) return cv('--green','#1B5340');
    if(s.bag) return '#3E6E8E';
    return cv('--text-3','#879289');
  }
  function profileLegend(){
    var used={}; STATIONS.forEach(function(s){ used[stationColour(s)]=1; });
    var items=[[cv('--gold-solid','#B5801E'),'Crew + pacer swap'],[cv('--green','#1B5340'),'Crew'],
               ['#3E6E8E','Drop bag only'],[cv('--text-3','#879289'),'No crew']]
              .filter(function(it){ return used[it[0]]; });
    items.push([cv('--night','#DFE3E4'),'Darkness']);
    return '<div class="plegend">'+items.map(function(it){
      return '<span><i style="background:'+it[0]+';box-shadow:inset 0 0 0 1px var(--hair-2)"></i>'+it[1]+'</span>';
    }).join('')+'</div>';
  }
  function resetReadout(){
    var ro=document.getElementById(PROF_ID==='profile'?'readout':'readoutC');
    if(ro) ro.innerHTML='<span><span style="font-size:17px;font-weight:650;letter-spacing:-.02em">The course</span>'+
      '<span style="display:block;font-size:13px;opacity:.72;margin-top:1px">Drag to read any point</span></span>'+
      '<span style="font-size:13px;opacity:.82;text-align:right;line-height:1.45">'+
      '<b class="num" style="font-size:15px;font-weight:650">'+COURSE_MI_TXT+' mi</b><br>'+COURSE_CLIMB_TXT+' ft of climb</span>';
  }
  function profileAt(cx){
    var svg=document.getElementById(PROF_ID); if(!svg) return null;
    var r=svg.getBoundingClientRect();
    var mi=((cx-r.left)/r.width*PG.W-PG.pl)/PG.iw*PG.MX; mi=Math.max(0,Math.min(PG.MX,mi));
    var sec=secFor(mi), cur=svg.querySelector('#cur'), cd=svg.querySelector('#curd');
    if(cur){ cur.setAttribute('x1',PG.X(mi)); cur.setAttribute('x2',PG.X(mi)); }
    if(cd){ cd.setAttribute('cx',PG.X(mi)); cd.setAttribute('cy',PG.Y(elevAt(mi))); }
    var ro=document.getElementById(PROF_ID==='profile'?'readout':'readoutC');
    if(ro) ro.innerHTML=
      '<span style="min-width:0"><span class="num" style="font-size:19px;font-weight:700;letter-spacing:-.03em">Mile '+mi.toFixed(1)+'</span>'+
      '<span style="display:block;font-size:13px;opacity:.72;margin-top:1px">'+sec.title+'</span></span>'+
      '<span style="font-size:13px;opacity:.86;text-align:right;line-height:1.45;flex:0 0 auto">'+
      '<b class="num" style="font-size:15px;font-weight:650">'+ft(cumGain(mi))+' ft</b> climbed<br>'+
      'at <span class="num">'+ft(Math.round(elevAt(mi)/10)*10)+' ft</span> · '+clkDay(minsAtMile(mi))+'</span>';
    return sec;
  }
  function initProfile(id){
    var svg=document.getElementById(id); if(!svg) return;
    var active=false, moved=false, last=null, timer=null;
    svg.addEventListener('pointerdown',function(e){ active=true;moved=false;clearTimeout(timer);last=profileAt(e.clientX);
      if(svg.setPointerCapture) try{svg.setPointerCapture(e.pointerId);}catch(x){} e.preventDefault(); });
    svg.addEventListener('pointermove',function(e){ if(!active)return; moved=true; last=profileAt(e.clientX); e.preventDefault(); });
    ['pointerup','pointercancel'].forEach(function(t){ svg.addEventListener(t,function(){
      if(!active)return; active=false;
      if(last&&!moved){ openSection(last); resetReadout(); } else timer=setTimeout(resetReadout,5000); }); });
  }


  /* ── live position ──────────────────────────────────────────
     Mileage between stations is interpolated on the projection, which is
     itself anchored to the last real logged time. So the marker is fact up
     to the last checkpoint and forecast beyond it. */
  function livePos(){
    var nm=now();
    if(nm<0) return { state:'pre' };
    var last=lastSplitIdx(), sp=last>=0?splitOf(last):null;
    if(last===STATIONS.length-1) return { state:'done', at:splitVal(last) };
    if(nm>RACE.limit+120) return { state:'over' };

    /* Sitting in an aid station: arrived, not yet left. */
    /* A mat can say he arrived and nothing can say he left, so an arrival
       only means "in the station" for as long as a stop there plausibly lasts. */
    if(sp && sp.in!=null && sp.out==null && (nm-sp.in) <= (STATIONS[last].crew?45:Math.max(6,dwellGuess(last)*3))){
      var here=STATIONS[last], nxt=STATIONS[last+1];
      return { state:'station', station:here, idx:last, since:nm-sp.in,
               next:nxt, nextIdx:last+1, toGo:nxt.mi-here.mi, eta:T(nxt) };
    }
    if(gpsFresh()){
      var gm=GPS.last.mi, gi=0;
      for(var q=0;q<STATIONS.length;q++){ if(STATIONS[q].mi>gm){ gi=q; break; } gi=q; }
      var gn=STATIONS[Math.min(gi,STATIONS.length-1)];
      return { state:'moving', mi:gm, next:gn, nextIdx:gi, toGo:Math.max(0,gn.mi-gm),
               eta:T(gn), lastIdx:last, tracked:true, gps:true };
    }
    var mi=mileAt(nm), i=0;
    for(var k=0;k<STATIONS.length;k++){ if(STATIONS[k].mi>mi){ i=k; break; } i=k; }
    var n=STATIONS[Math.min(i,STATIONS.length-1)];
    return { state:'moving', mi:mi, next:n, nextIdx:i, toGo:Math.max(0,n.mi-mi), eta:T(n),
             lastIdx:last, tracked:last>=0 };
  }
  function deltaVsPlan(){
    var i=lastSplitIdx(); if(i<1) return null;
    return splitVal(i)-planT(STATIONS[i]);
  }
  /* The panel the crew actually stares at. */
  function livePanel(opts){
    var L=livePos(), o=opts||{};
    if(L.state==='pre'){
      if(!o.always) return '';
      return '<div class="card"><div class="cap">Not started</div>'+
        '<h3 style="margin-top:3px">Gun at '+clkDay(0)+'</h3></div>';
    }
    if(L.state==='done')
      return '<div class="card tint"><div class="cap">Finished</div>'+
        '<h3 style="margin:3px 0 0">'+dur(L.at)+' \u00b7 '+clkDay(L.at)+'</h3></div>';
    if(L.state==='over') return '';

    var d=deltaVsPlan(), chip='';
    if(d!=null) chip='<span class="pill '+(d>30?'gold':d<-6?'':'grey')+'">'+
      (Math.abs(d)<6?'on plan':(d>0?dur(d)+' behind':dur(-d)+' ahead'))+'</span>';
    var srcNote = (function(){
      var i=lastSplitIdx(); if(i<0) return 'no checkpoints yet \u00b7 showing the plan';
      var sp=splitOf(i);
      return (sp.src==='kandu'?'from the timing feed':'logged by the crew')+' at '+STATIONS[i].name;
    })();

    var head, sub;
    if(L.state==='station'){
      head='At '+L.station.name;
      sub='mile '+L.station.mi.toFixed(1)+' \u00b7 in the station '+dur(L.since);
    } else {
      head='Mile '+L.mi.toFixed(1);
      sub= L.tracked ? 'estimated from the last checkpoint' : 'estimated from the plan';
    }
    return '<div class="card live">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'+
      '<div><div class="cap">Where '+esc(RUNNER)+' is</div><h3 style="font-size:21px;margin-top:2px">'+head+'</h3>'+
      '<div class="cap" style="margin-top:2px">'+sub+'</div></div>'+chip+'</div>'+
      '<div class="stats"><div><div class="k">Next</div><div class="v">'+L.next.name.replace(' \u2014 Ski Basin','')+'</div></div>'+
      '<div><div class="k">To go</div><div class="v num">'+L.toGo.toFixed(1)+' mi</div></div>'+
      '<div><div class="k">Expected</div><div class="v num">'+clk(L.eta)+'</div></div></div>'+
      '<div class="cap" style="margin-top:10px">'+srcNote+'</div></div>';
  }

  /* ── runner ── */
  function renderPlanPicker(){
    /* The runner has one of these on the Race tab and the crew have another
       on theirs. Both are painted from the same state and bound to the same
       handler, so they cannot drift apart. */
    var pks=document.querySelectorAll('.planpicker');
    if(!pks.length) return;
    var fin=STATIONS[STATIONS.length-1];
    var html = PLANS.map(function(p){
      var mins=planFinish(p.k);
      var pp = (mins!=null) ? pace(fin.mi,mins)+'/mi' : '';
      /* hm() for an edited plan too -- dur() prints "29h 35m" next to a
         neighbour printing "30:11", which reads as two different measures */
      return '<button'+(p.k===S.plan?' class="on"':'')+' data-plan="'+p.k+'">'+p.name+
        '<small>'+hm(mins)+(pp?'<i>'+pp+'</i>':'')+'</small></button>';
    }).join('');
    /* Same rule as the crew list: the background refresh must not re-create
       these buttons every twenty seconds just to write the same thing. */
    var cls='seg planpicker' + (isRaceDay()?' compact':'');
    var touched=false;
    pks.forEach(function(pk){
      if(pk.className===cls && pk.__html===html) return;
      pk.className=cls; pk.__html=html; pk.innerHTML=html; touched=true;
    });
    if(!touched) return;
    document.querySelectorAll('[data-plan]').forEach(function(b){
      b.onclick=function(){ S.plan=b.dataset.plan; save(); markDirty(); render(); flashTimes(); };
    });
  }
  /* Changing the goal moves every clock in the app at once. Without a cue
     that is a screen full of numbers that silently became different numbers,
     so the ones that moved lift into place. Quiet, and only on the numbers. */
  function flashTimes(){
    document.querySelectorAll('.stopc-hd .eta b, .stopc-facts b, .goalRow .g b, '+
      '.planAt b, .hero .under, .hero .stats .v').forEach(function(e){
      e.classList.remove('tflash'); void e.offsetWidth; e.classList.add('tflash');
    });
  }
  function renderRace(){
    var nm=now(), hero=document.getElementById('raceHero');
    var fin=T(STATIONS[STATIONS.length-1]);
    var planName=PLANS.filter(function(p){return p.k===S.plan;})[0].name;
    if(nm<0){
      var s=Math.floor(-nm*60), d=Math.floor(s/86400), h=Math.floor(s%86400/3600), mm=Math.floor(s%3600/60);
      hero.innerHTML='<div class="hero"><div class="eyebrow">Until the gun</div>'+
        '<div class="display num'+(d>0?' sm':'')+'">'+(d>0?d+' days '+h+'h '+mm+'m':
          String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0')+':'+String(s%60).padStart(2,'0'))+'</div>'+
        '<div class="under">9:00 am Friday 18 September · 36 hours on the clock</div>'+
        '<div class="stats"><div><div class="k">Distance</div><div class="v num">'+COURSE_MI_TXT+' mi</div></div>'+
        '<div><div class="k">Climb</div><div class="v num">'+COURSE_CLIMB_TXT+' ft</div></div>'+
        '<div><div class="k">'+planName+'</div><div class="v num">'+dur(fin)+'</div></div></div></div>';
    } else if(nm>RACE.limit+60){
      hero.innerHTML='<div class="hero"><div class="eyebrow">Race complete</div><div class="display num">36:00</div></div>';
    } else {
      var lsi=lastSplitIdx(), chip='';
      if(lsi>=0){
        var dl=splitVal(lsi)-planT(STATIONS[lsi]);
        chip='<div class="pill" style="background:rgba(255,255,255,.16);color:#fff">'+
          (Math.abs(dl)<6?'on plan':(dl>0?dur(dl)+' behind plan':dur(-dl)+' ahead of plan'))+'</div>';
      }
      hero.innerHTML='<div class="hero">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">'+
        '<div class="eyebrow">Elapsed</div>'+chip+'</div>'+
        '<div class="display num">'+dur(nm)+'</div>'+
        '<div class="stats"><div><div class="k">'+(lsi>=0?'Last logged':'Should be at')+'</div>'+
        '<div class="v num">'+(lsi>=0?STATIONS[lsi].mi.toFixed(1):mileAt(nm).toFixed(1))+' mi</div></div>'+
        '<div><div class="k">Still to run</div><div class="v num">'+
        (COURSE_MI-(lsi>=0?STATIONS[lsi].mi:mileAt(nm))).toFixed(1)+' mi</div></div>'+
        '<div><div class="k">Time left</div><div class="v num">'+dur(RACE.limit-nm)+'</div></div></div></div>';
    }
    var i=0; for(var k=0;k<STATIONS.length;k++){ if(T(STATIONS[k])>nm){i=k;break;} i=k; }
    if(nm<0) i=1;
    var s2=STATIONS[i], buf=s2.cut!=null?s2.cut-T(s2):null;
    document.getElementById('nextStop').innerHTML=livePanel()+'<div class="card">'+
      '<div class="cap" style="margin-bottom:3px">'+(nm<0?'First aid station':'Next aid station')+'</div>'+
      '<h3 style="font-size:20px">'+s2.name+' <span class="num" style="color:var(--text-3);font-weight:500">· mile '+s2.mi.toFixed(1)+'</span></h3>'+
      '<div class="pills" style="margin-top:9px">'+(s2.bag?'<span class="pill">Drop bag</span>':'')+
      (s2.crew?'<span class="pill">Crew</span>':'')+(s2.pacer?'<span class="pill gold">Pacer swap</span>':'')+
      (!s2.bag&&!s2.crew&&!s2.pacer?'<span class="pill grey">On your own</span>':'')+'</div>'+
      (s2.note?'<p class="sec" style="margin-top:11px">'+s2.note+'</p>':'')+
      '<div class="stats"><div><div class="k">Planned</div><div class="v num">'+clkDay2(T(s2))+'</div></div>'+
      '<div><div class="k">Cutoff</div><div class="v num" style="color:'+(s2.cut!=null?'var(--red)':'var(--text-3)')+'">'+
      (s2.cut!=null?clkDay2(s2.cut):'none')+'</div></div>'+
      '<div><div class="k">Spare</div><div class="v num">'+(buf==null?'—':dur(buf))+'</div></div></div>'+
      stopNotesHTML(s2.__i)+'</div>';
    var bw=document.getElementById('buffersWrap');
    if(bw) bw.style.display=(isRaceDay()||anySplits())?'':'none';
    document.getElementById('buffers').innerHTML = STATIONS.filter(function(x){return x.cut!=null;}).map(function(x){
      var b=x.cut-T(x);
      return '<div class="item"><div class="lead num">'+x.mi.toFixed(0)+'</div><div class="mid">'+
        '<div class="nm">'+x.name+'</div><div class="dt">cutoff '+clkDay(x.cut)+'</div></div>'+
        '<div class="rt"><div class="a" style="color:'+(b<0?'var(--red)':b<180?'var(--gold)':'var(--green)')+'">'+dur(b)+'</div>'+
        '<div class="b">'+(b<0?'past cutoff':'to spare')+'</div></div></div>';
    }).join('');
    var h='<thead><tr><th>Aid station</th><th>Mi</th><th>'+esc(planName)+'</th><th>Elapsed</th>'+
      '<th>Segment</th><th>Leg pace</th><th>Avg pace</th><th>Cutoff</th></tr></thead><tbody>';
    STATIONS.forEach(function(x){
      var lg=splitVal(x.__i)!=null;
      h+='<tr'+(lg?' style="background:var(--green-tint)"':x.major?' style="background:var(--surface-2)"':'')+
        '><td>'+x.name+(lg?' \u2713':'')+'</td><td>'+x.mi.toFixed(1)+'</td>'+
        '<td><b>'+clk(T(x))+'</b></td>'+
        '<td style="color:var(--text-2)">'+(x.__i>0?dur(T(x)):'\u2014')+'</td>'+
        '<td style="color:var(--text-2)">'+(function(){ var L=x.__i>0&&legInto(x.__i); return L?dur(L.mins):'\u2014'; })()+'</td>'+
        '<td>'+(x.__i>0?legPace(x.__i):'\u2014')+'</td><td>'+
        (x.__i>0?cumPace(x.__i):'\u2014')+'</td>'+
        '<td style="color:'+(x.cut!=null?'var(--red)':'var(--text-3)')+'">'+(x.cut!=null?clk(x.cut):'—')+'</td></tr>';
    });
    document.getElementById('asTable').innerHTML=h+'</tbody>';
  }
  function metrics(s){
    var d=s.to-s.from, mins=secMins(s), b=st(s.to);
    return '<div class="metrics"><div><div class="k">Allow</div><div class="v num">'+dur(mins)+'</div></div>'+
      '<div><div class="k">Average pace</div><div class="v num">'+pace(d,mins)+'</div></div>'+
      '<div><div class="k">Arrive by</div><div class="v num">'+clk(b?T(b):0)+'</div></div></div>';
  }
  function accFor(s){
    var pc = s.ec==='gold'?'gold':s.ec==='brick'?'red':'';
    return '<div class="acc"><button class="acc-hd" aria-expanded="false"><span class="acc-num">'+s.n+'</span>'+
      '<span class="acc-t"><span class="t">'+s.title+(noteAny('sec',s.n)?' <span class="ndot"></span>':'')+
      '</span><span class="s">'+s.sub+'</span></span>'+CHEV+'</button>'+
      '<div class="acc-bd"><div class="acc-in"><div class="pills" style="margin-bottom:13px"><span class="pill '+pc+'">'+s.effort+'</span>'+
      '<span class="pill grey">'+(s.to-s.from).toFixed(1)+' miles</span>'+
      (s.gain?'<span class="pill grey">'+s.gain.toLocaleString()+' ft up</span>':'')+'</div>'+
      metrics(s)+noteUnitHTML('sec',s.n)+s.body+'</div></div></div>';
  }
  function bindAcc(sel){
    document.querySelectorAll(sel+' .acc-hd').forEach(function(b){
      b.onclick=function(){
        var open=b.parentNode.classList.toggle('open');
        b.setAttribute('aria-expanded', open?'true':'false');
      };
    });
  }
  function renderSections(){
    renderMap();
    document.getElementById('sections').innerHTML=SECTIONS.map(accFor).join(''); bindAcc('#sections');
    var h='<thead><tr><th>Section</th><th>Mi</th><th>Average</th><th>Fastest</th><th>Slowest</th><th>Pace</th></tr></thead><tbody>';
    ANALYSIS.forEach(function(a){
      h+='<tr'+(a.hi?' style="background:var(--gold-tint)"':'')+'><td>'+a.seg+'</td><td>'+a.mi.toFixed(1)+'</td>'+
        '<td><b>'+hm(a.avg)+'</b></td><td>'+(a.fast?hm(a.fast):'—')+'</td><td>'+(a.slow?hm(a.slow):'—')+'</td><td>'+a.pace+'</td></tr>';
    });
    document.getElementById('anTable').innerHTML=h+'</tbody>';
    document.getElementById('anNotes').innerHTML=RACE.copy.fieldNotes;
  }
  /* ── team helpers ── */
  function peopleFor(r){
    if(r==='crew') return S.people.filter(function(p){return p.role==='crew'||p.role==='chief';});
    return S.people.filter(function(p){return p.role===r;});
  }
  function roleLabel(p){
    if(p.role==='chief') return 'Crew chief';
    if(p.role==='pacer'){
      var mine=legsForPerson(p.id);
      if(!mine.length) return 'Pacer \u00b7 not yet assigned';
      return 'Pacer \u00b7 '+mine.map(function(L){ return L.from.name+'\u2192'+L.to.name; }).join(', ');
    }
    return 'Crew \u00b7 '+((p.stops&&p.stops.length)?'stops '+p.stops.join(', '):'all stops');
  }
  function sortedPeople(){
    var rank={chief:0,crew:1,pacer:2};
    return S.people.slice().sort(function(x,y){
      var d=(rank[x.role]==null?3:rank[x.role])-(rank[y.role]==null?3:rank[y.role]);
      return d || x.name.localeCompare(y.name);
    });
  }
  function crewAt(n){ return peopleFor('crew').filter(function(p){return (p.stops||[]).indexOf(n)>=0;}); }
  function nameList(a){ return a.map(function(p){return esc(p.name);}).join(', '); }
  function initials(n){ return n.trim().split(/\s+/).slice(0,2).map(function(w){return w[0].toUpperCase();}).join(''); }

  function editPerson(id){
    var p=null; for(var i=0;i<S.people.length;i++) if(S.people[i].id===id) p=S.people[i];
    var isP = p ? p.role==='pacer' : false;
    sheet(p?'Edit person':'Add crew or pacer',
      '<div class="fld"><label>Name</label><input id="pName" value="'+(p?esc(p.name):'')+'" placeholder="Jane Smith" autocomplete="name"></div>'+
      '<div class="fld"><label>Phone <span style="font-weight:400;color:var(--text-3)">optional</span></label><input id="pPhone" type="tel" value="'+(p?esc(p.phone):'')+'" autocomplete="tel"></div>'+
      '<div class="fld"><label>What are they doing?</label><select id="pRole">'+
      '<option value="crew"'+((p&&p.role==='crew')||!p?' selected':'')+'>Crew</option>'+
      '<option value="chief"'+(p&&p.role==='chief'?' selected':'')+'>Crew chief</option>'+
      (HAS_PACERS?'<option value="pacer"'+(isP?' selected':'')+'>Pacer</option>':'')+'</select></div>'+
      '<p class="cap" id="legFld" style="margin:-4px 0 4px;display:'+(isP?'block':'none')+'">Which block(s) they run is set on the Pacer plan screen, not here.</p>'+
      '<div class="fld" id="stopFld" style="display:'+(isP?'none':'block')+'"><label>Which stops? Leave all unticked for every stop.</label>'+
      CREW.map(function(c){ var on=p&&p.stops&&p.stops.indexOf(c.n)>=0;
        return '<label class="chk"><input type="checkbox" class="pStop" value="'+c.n+'"'+(on?' checked':'')+'><span>'+c.n+'. '+c.where+'</span></label>';
      }).join('')+'</div>'+
      '<button class="btn" id="pSave">Save</button>'+(p?'<button class="btn danger" id="pDel">Remove '+esc(p.name)+'</button>':''));
    document.getElementById('pRole').onchange=function(){
      var y=this.value==='pacer';
      document.getElementById('legFld').style.display=y?'block':'none';
      document.getElementById('stopFld').style.display=y?'none':'block';
    };
    document.getElementById('pSave').onclick=function(){
      var name=document.getElementById('pName').value.trim(); if(!name) return;
      var role=document.getElementById('pRole').value;
      var rec={id:p?p.id:'p'+Date.now(),name:name,phone:document.getElementById('pPhone').value.trim(),role:role};
      if(role!=='pacer') rec.stops=Array.prototype.slice.call(document.querySelectorAll('.pStop:checked')).map(function(c){return +c.value;});
      if(p) S.people=S.people.map(function(x){return x.id===p.id?rec:x;}); else S.people.push(rec);
      save(); markDirty(); closeSheet(); if(detailKey) refreshDetail(); else render();
    };
    if(p) document.getElementById('pDel').onclick=function(){
      S.people=S.people.filter(function(x){return x.id!==p.id;});
      if(S.me===p.id) S.me=null; save(); markDirty(); closeSheet();
      if(detailKey) refreshDetail(); else render();
    };
  }

  /* ── profile hub ── */
  var RIC = {
    gear:'<path d="M4 8h16v12H4zM9 8V5.6A3 3 0 0115 5.6V8M9.5 13.5h5"/>',
    bag:'<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2"/>',
    water:'<path d="M12 3s6 6.6 6 10.6A6 6 0 016 13.6C6 9.6 12 3 12 3z"/>',
    team:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.2"/><path d="M3 19c0-3.2 2.7-5 6-5s6 1.8 6 5M17 14c2.2 0 4 1.4 4 3.6"/>',
    van:'<path d="M3 16h18M4 16l1-6h11l3 4v2M8 8V6h6v4"/><circle cx="7.5" cy="18.5" r="1.7"/><circle cx="16.5" cy="18.5" r="1.7"/>',
    run:'<circle cx="14" cy="4.6" r="2"/><path d="M9.5 21l2.3-6.6L9 11l1-4 3.6 1 2.4 2.6M13.8 14.4L16.4 21M6 10.4l3-2"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6.8v5.4l3.4 2"/>',
    cloud:'<path d="M7 18h10a4 4 0 000-8 6 6 0 00-11.6 2A3.5 3.5 0 007 18z"/>',
    peak:'<path d="M2 19l6-13 4.5 8.5L15.5 9 22 19z"/>',
    ban:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    ask:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 114.4 1.9c-.9.8-1.9 1.3-1.9 2.6M12 17v.5"/>',
    book:'<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5zM4 20.5A2.5 2.5 0 016.5 18H20v3H6.5"/>',
    cog:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2L5.4 5.4"/>'
  };
  function gearDone(){
    var n=MANDATORY.filter(function(_,i){return S.checks['mg'+i];}).length, tot=MANDATORY.length;
    GEAR.forEach(function(g,gi){
      var items=gearItemsFor(gi);
      tot+=items.length;
      items.forEach(function(it){ if(S.checks[it.key]) n++; });
    });
    return [n,tot];
  }
  function bagDone(){
    var n=0,tot=0;
    DROPBAGS.forEach(function(b,bi){ (b.lists||[]).forEach(function(l,li){
      l.items.forEach(function(_,ii){ tot++; if(S.checks['db'+bi+'_'+li+'_'+ii]) n++; }); }); });
    return [n,tot];
  }
  function noteCount(){ return Object.keys(S.notes).length; }

  var DETAILS = {
    pace:   {t:'Race day planner', b:buildPace},
    gear:   {t:'Gear checklist',   b:buildGear},
    bags:   {t:'Drop bags',        b:buildBags},
    carries:{t:'Long carries',     b:buildCarries},
    brief:  {t:'Pre-race crew plan',b:buildBrief},
    team:   {t:'Crew and pacers',  b:buildTeam},
    rota:   {t:'Crew rotation',    b:buildRota},
    legs:   {t:'Pacer plan',       b:buildPacers},
    weather:{t:'Weather and light',b:buildWeather},
    elev:   {t:'Distance and climb',b:buildElev},
    rules:  {t:'Rules that end your race', b:buildRules},
    qs:     {t:'Ask the RDs',      b:buildQuestions},
    manual: {t:'The manual',       b:buildManual},
    app:    {t:'App and data',     b:buildApp},
    how:    {t:'How this works',   b:buildHow}
  };
  function row(key,icon,cls,title,sub,count){
    return '<button class="item" data-detail="'+key+'"><span class="ico '+(cls||'')+'">'+
      '<svg viewBox="0 0 24 24">'+RIC[icon]+'</svg></span>'+
      '<div class="mid"><div class="nm">'+title+'</div>'+(sub?'<div class="dt">'+sub+'</div>':'')+'</div>'+
      (count?'<span class="count num">'+count+'</span>':'')+CHEV+'</button>';
  }
  function renderProfile(){
    var hub=document.getElementById('profileHub'); if(!hub) return;
    var g=gearDone(), bg=bagDone(), fin=T(STATIONS[STATIONS.length-1]);
    var pc=peopleFor('crew').length, pp=peopleFor('pacer').length, nc=noteCount();
    hub.innerHTML=
      '<div class="phead"><h1>Profile</h1><p class="sec">Your gear, your team, and everything you only look up once.</p></div>'+
      '<div class="idcard"><h2>'+RUNNER+'</h2><div class="u">'+RACE.runner.division+' \u00b7 bib '+RACE.runner.bibRange+' \u00b7 starts '+RACE.startShort+'</div>'+
      '<div class="stats"><div><div class="k">Goal</div><div class="v num">'+dur(fin)+'</div></div>'+
      '<div><div class="k">Gear packed</div><div class="v num">'+g[0]+' of '+g[1]+'</div></div>'+
      '<div><div class="k">Team</div><div class="v num">'+((pc+pp)||'\u2014')+'</div></div></div></div>'+

      '<div class="grp"><div class="grp-t">Race kit</div><div class="list">'+
      row('pace','clock','g','Race day planner','Splits, fuel and who is with you',dur(planFinish()))+
      row('gear','gear','g','Gear checklist','Mandatory five plus your own lists',g[0]+'/'+g[1])+
      row('bags','bag','','Drop bags','Two bags, four visits',bg[0]+'/'+bg[1])+
      row('carries','water','','Long carries','Where there is no water')+
      '</div></div>'+

      '<div class="grp"><div class="grp-t">Team</div><div class="list">'+
      row('brief','book','g','Pre-race crew plan','One printable sheet for everyone')+
      row('team','team','',HAS_PACERS?'Crew and pacers':'Crew','Add people and share the links',(pc+pp)||'')+
      row('rota','van','','Crew rotation',numw(CREW.length)+' stops, when to leave',String(CREW.length))+
      (HAS_PACERS?row('legs','run','','Pacer plan',numw(Math.max(SWAPS.length-1,0))+' legal blocks, who runs each',
          String(pacerLegs().filter(function(l){return l.who;}).length)||''):'')+
      '</div></div>'+

      '<div class="grp"><div class="grp-t">Reference</div><div class="list">'+
      row('weather','cloud','','Weather and light','Sunrise, sunset, what to expect')+
      row('elev','peak','','Distance and climb','Measured from the course file')+
      row('rules','ban','r','Rules that end your race','Nine of them',String(RULES.length))+
      row('qs','ask','','Ask the RDs on Thursday','Seven open questions',String(QUESTIONS.length))+
      row('manual','book','','The manual','What is in the 20 pages')+
      row('how','ask','g','How this works','Seven things, for anyone new to the app')+
      '</div></div>'+

      '<div class="grp"><div class="grp-t">App</div><div class="list">'+
      row('app','cog','','App and data','Sync, location, offline, reset', nc?nc+' notes':'')+
      '</div></div>';
    hub.querySelectorAll('[data-detail]').forEach(function(b){
      b.onclick=function(){ openDetail(b.dataset.detail); };
    });
  }

  /* One place decides how a screen change looks. Callers say where they are
     going and, for tabs, which way along the bar; nobody else touches .on.
     Re-adding the animation class needs a reflow between the remove and the
     add or the browser coalesces them and nothing plays. */
  function swapView(toId, dir){
    var to=document.getElementById(toId); if(!to) return;
    document.body.classList.toggle('on-now', toId==='n-now');
    document.querySelectorAll('.view').forEach(function(x){
      if(x!==to) x.classList.remove('on','en-push','en-pop','en-r','en-l');
    });
    to.classList.remove('en-push','en-pop','en-r','en-l');
    to.classList.add('on');
    void to.offsetWidth;
    if(dir) to.classList.add(dir);
  }

  /* ── detail sub-views ── */
  var detailKey=null;
  var NAVT=RACE.name;
  function openDetail(k,noPush,keepScroll){
    var d=DETAILS[k]; if(!d) return;
    detailKey=k;
    document.getElementById('detailBody').innerHTML='<div class="phead"><h1>'+d.t+'</h1></div>'+d.b();
    if(!noPush) DETAILY=window.scrollY||window.pageYOffset||0;
    swapView('r-detail','en-push');
    setNav(true, d.t);
    if(!keepScroll) window.scrollTo(0,0);
    bindChecks(); bindDetail(k);
    if(!noPush){ try{ history.pushState({detail:k},''); }catch(e){} }
  }
  function closeDetail(){
    detailKey=null; PLANEDIT=false;
    swapView(DET_RET||'r-profile','en-pop');
    if(SUBV) navBack('Know', SUBT[SUBV]); else setNav(false);
    renderProfile(); if(DET_RET==='n-now'){ NOW_HTML=null; renderNow(); }
    window.scrollTo(0, DETAILY||0);
  }
  function refreshDetail(){
    if(!detailKey) return;
    /* adding or removing an item has to rebuild the screen, but it should
       not throw you back to the top of it */
    var y=window.scrollY||window.pageYOffset||0;
    openDetail(detailKey,true,true);
    window.scrollTo(0,y);
  }
  function setNav(inDetail,title){
    var el=document.querySelector('.nav-in'); if(!el) return;
    if(inDetail){
      el.innerHTML='<button class="back" id="dBack"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'+(DET_RET==='k-know'?'Know':'Back')+'</button>'+
        '<span class="t dt-ttl">'+esc(title)+'</span>';
      document.getElementById('dBack').onclick=function(){ history.back(); };
      if(window.navScroll) window.navScroll();
    } else {
      el.innerHTML='<div class="who"><span class="dot"></span><span class="t" id="navT">'+esc(NAVT)+'</span></div>'+
        '<span class="rclock" id="navClock" style="display:none"></span>'+
        '<button class="sw" id="switchBtn">'+(S.me?'<i>'+esc(initials(whoAmI()))+'</i>'+esc(whoAmI()):'Switch')+'</button>';
      document.getElementById('switchBtn').onclick=openGate;
      paintClock();
    }
  }

  /* Gear lists start from GEAR's built-in content but every item is fully
     editable on the device: renamed, given a different note, removed, or
     added new. None of that touches GEAR itself -- it's layered on top in
     S.gearOverride (renamed/re-noted default items), S.gearRemoved (default
     items hidden), and S.gearAdd (items the user added), all keyed so the
     existing checked-state keys ('g'+gi+'_'+ii) survive untouched. */
  function gearKey(gi,ii){ return 'g'+gi+'_'+ii; }
  function gearItemsFor(gi){
    var base=GEAR[gi].items.map(function(it,ii){
      var key=gearKey(gi,ii); if(S.gearRemoved[key]) return null;
      var ov=S.gearOverride[key];
      return { key:key, name:(ov&&ov.name!=null)?ov.name:it[0], note:(ov&&ov.note!=null)?ov.note:(it[1]||''), custom:false };
    }).filter(Boolean);
    var extra=(S.gearAdd[gi]||[]).map(function(it){
      return { key:'gc'+gi+'_'+it.id, name:it.name, note:it.note||'', custom:true };
    });
    return base.concat(extra);
  }
  function gitemRow(gi,it){
    return '<div class="gitem"><label class="chk"><input type="checkbox" data-k="'+it.key+'"'+(S.checks[it.key]?' checked':'')+
      '><span>'+esc(it.name)+(it.note?'<em>'+esc(it.note)+'</em>':'')+'</span></label>'+
      '<div class="gitem-acts"><button class="gitem-edit" data-gedit="'+gi+'|'+it.key+'" aria-label="Edit '+esc(it.name)+'">'+
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>'+
      '<button class="gitem-rm" data-grm="'+gi+'|'+it.key+'" aria-label="Remove '+esc(it.name)+'">×</button></div></div>';
  }
  /* Reference blocks you read once and then want out of the way. Native
     <details> so keyboard and screen readers work for free. Open state is
     remembered for the session so a re-render (adding an item) does not
     slam an expanded fold shut under you. */
  var GEAROPEN={mand:false,buy:false};
  function foldHTML(key,cls,title,pill,body){
    return '<details class="fold '+(cls||'')+'" data-fold="'+key+'"'+(GEAROPEN[key]?' open':'')+'>'+
      '<summary><span class="fold-t">'+title+'</span>'+(pill||'')+
      '<span class="fold-chev"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span></summary>'+
      '<div class="fold-bd">'+body+'</div></details>';
  }
  function buildGear(){
    var mandN=MANDATORY.filter(function(_,i){return S.checks['mg'+i];}).length;
    var out=foldHTML('mand','gold','Mandatory gear',
        '<span class="pill gold num" id="mgCount">'+mandN+' of 5</span>',
        RACE.copy.gearIntro+
        '<div style="margin-top:4px">'+MANDATORY.map(function(t,i){
          return '<label class="chk"><input type="checkbox" data-k="mg'+i+'"'+(S.checks['mg'+i]?' checked':'')+'><span>'+t+'</span></label>';
        }).join('')+'</div>')+
      (TOBUY.length?foldHTML('buy','alert','Still to buy',
        '<span class="pill red num">'+TOBUY.length+'</span>',
        '<div class="pills">'+TOBUY.map(function(t){return '<span class="pill red">'+esc(t)+'</span>';}).join('')+'</div>'):'')+
      '<div class="grid2">';
    GEAR.forEach(function(g,gi){
      var items=gearItemsFor(gi);
      var done=items.filter(function(it){return S.checks[it.key];}).length;
      out+='<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:2px">'+
        '<h3>'+g.name+'</h3><span class="pill '+(items.length&&done===items.length?'':'grey')+' num" data-gcount="'+gi+'">'+done+' of '+items.length+'</span></div>'+
        items.map(function(it){ return gitemRow(gi,it); }).join('')+
        '<button class="btn tint sm gitem-add" data-gadd="'+gi+'" style="margin-top:12px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add item</button>'+
        '</div>';
    });
    return out+'</div>';
  }
  function openGearAdd(gi){
    sheet('Add item',
      '<div class="fld"><label>Item</label><input id="giName" placeholder="e.g. Extra buff"></div>'+
      '<div class="fld"><label>Note <span style="font-weight:400;color:var(--text-3)">optional</span></label><input id="giNote" placeholder="e.g. buy before Thursday"></div>'+
      '<button class="btn" id="giSave">Add</button>');
    document.getElementById('giName').focus();
    document.getElementById('giSave').onclick=function(){
      var name=document.getElementById('giName').value.trim(); if(!name) return;
      var note=document.getElementById('giNote').value.trim();
      S.gearAdd[gi]=S.gearAdd[gi]||[];
      S.gearAdd[gi].push({id:'i'+Date.now(),name:name,note:note});
      save(); closeSheet(); refreshDetail();
    };
  }
  function gearItemLookup(gi,key){
    if(key.indexOf('gc'+gi+'_')===0){
      var id=key.slice(('gc'+gi+'_').length);
      var rec=(S.gearAdd[gi]||[]).filter(function(x){return x.id===id;})[0];
      return { custom:true, id:id, name:rec?rec.name:'', note:rec?rec.note:'' };
    }
    var ov=S.gearOverride[key], ii=+key.slice(('g'+gi+'_').length);
    var base=GEAR[gi].items[ii]||['',''];
    return { custom:false, name:(ov&&ov.name!=null)?ov.name:base[0], note:(ov&&ov.note!=null)?ov.note:(base[1]||'') };
  }
  function openGearEdit(gi,key){
    var cur=gearItemLookup(gi,key);
    sheet('Edit item',
      '<div class="fld"><label>Item</label><input id="giName" value="'+esc(cur.name)+'"></div>'+
      '<div class="fld"><label>Note <span style="font-weight:400;color:var(--text-3)">optional</span></label><input id="giNote" value="'+esc(cur.note||'')+'"></div>'+
      '<button class="btn" id="giSave">Save</button>');
    document.getElementById('giSave').onclick=function(){
      var name=document.getElementById('giName').value.trim(); if(!name) return;
      var note=document.getElementById('giNote').value.trim();
      if(cur.custom){
        (S.gearAdd[gi]||[]).forEach(function(x){ if(x.id===cur.id){ x.name=name; x.note=note; } });
      } else {
        S.gearOverride[key]={name:name,note:note};
      }
      save(); closeSheet(); refreshDetail();
    };
  }
  function removeGearItem(gi,key){
    if(key.indexOf('gc'+gi+'_')===0){
      var id=key.slice(('gc'+gi+'_').length);
      S.gearAdd[gi]=(S.gearAdd[gi]||[]).filter(function(x){return x.id!==id;});
    } else {
      S.gearRemoved[key]=true;
    }
    delete S.checks[key]; save(); refreshDetail();
  }
  /* Nothing in the app let him change his own pacing, so a plan built weeks
     ago could not absorb what he learned actually running the course. Two
     ways to change it, because there are two kinds of wrong: the whole plan
     is a bit off (stretch it), or one leg is wrong and the rest still holds
     (change that leg and shift the rest). */
  function parseHM(str){
    if(str==null) return null;
    str=String(str).trim(); if(!str) return null;
    var m=/^(\d+):([0-5]?\d)$/.exec(str);
    if(m) return (+m[1])*60 + (+m[2]);
    if(/^\d+(\.\d+)?$/.test(str)) return Math.round(parseFloat(str));   // bare minutes
    return null;
  }
  /* ═══════════════ RACE DAY PLANNER ═══════════════
     The screen he actually stands at an aid station and reads. Splits,
     fuel and the crew/pacer plan for every leg in one place, read-only by
     default so nothing gets nudged with a thumb, and printable.

     Fuel and notes layer over FUELPLAN the same way splits layer over the
     station table: defaults in data.js, edits in S.fuelOv, and the whole
     lot rides in the shared plan so the crew see what he plans to eat at
     their station. */
  var PLANEDIT = false;
  function fuelBase(i){ return FUELPLAN[i-1] || {aid:'',seg:'',ac:0,sc:0,caps:0,water:0,caf:0,note:''}; }
  function fuelFor(i){
    var b=fuelBase(i), o=(S.fuelOv&&S.fuelOv[i])||{}, r={};
    ['aid','seg','note'].forEach(function(k){ r[k]=(o[k]!=null?o[k]:b[k])||''; });
    ['ac','sc','caps','water','caf'].forEach(function(k){
      var v=(o[k]!=null?o[k]:b[k]); r[k]=isFinite(v)?+v:0;
    });
    return r;
  }
  function setFuel(i, patch){
    S.fuelOv=S.fuelOv||{};
    var cur=S.fuelOv[i]||{};
    for(var k in patch) cur[k]=patch[k];
    S.fuelOv[i]=cur;
    save(); markDirty(); render();
  }
  function fuelEdited(){
    var o=S.fuelOv||{};
    for(var k in o){ for(var f in o[k]) return true; }
    return false;
  }
  function resetFuel(){ S.fuelOv={}; save(); markDirty(); render(); }
  function fuelTotals(){
    var mins=paceNow(), t={ac:0,sc:0,caps:0,water:0,caf:0,mins:mins[STATIONS.length-1]};
    for(var i=1;i<STATIONS.length;i++){
      var f=fuelFor(i);
      t.ac+=f.ac; t.sc+=f.sc; t.caps+=f.caps; t.water+=f.water; t.caf+=f.caf;
    }
    var h=t.mins/60;
    t.carbs=t.ac+t.sc;
    t.carbsHr = h>0 ? t.carbs/h : 0;
    t.naHr    = h>0 ? t.caps*NA_PER_CAP/h : 0;
    t.waterHr = h>0 ? t.water/h : 0;
    return t;
  }
  function num1(n){ return (Math.round(n*10)/10).toFixed(1); }

  /* Who is at a check-in and who is running into it. This used to be a free
     text field in FUELPLAN, which meant it said whatever was typed there a
     year ago -- "Pacer 1 pacing" long after the legs had been reassigned. Both
     answers already exist in the plan, so read them rather than retype them. */
  function crewAtStation(i){
    var out=[], seen={};
    function add(p){ if(p && !seen[p.id]){ seen[p.id]=1; out.push(p); } }
    aidWho(i).forEach(function(id){ add(personById(id)); });
    CREW.forEach(function(c){
      if(c.mi!=null && idxOf(c.mi)===i && !stopHidden(c.n)) crewAt(c.n).forEach(add);
    });
    return out;
  }
  function pacerInto(i){
    var legs=pacerLegs();
    for(var j=0;j<legs.length;j++){
      var L=legs[j];
      if(!L.who || L.from.__i==null || L.to.__i==null) continue;
      if(L.from.__i < i && i <= L.to.__i) return personById(L.who);
    }
    return null;
  }
  function planWhoText(i){
    var cw=crewAtStation(i).map(function(p){ return p.name; });
    var pc=pacerInto(i);
    var out=[];
    if(cw.length) out.push(cw.join(', '));
    if(pc) out.push(pc.name+' pacing');
    return out.join(' \u00b7 ');
  }
  function planWhoHTML(i){
    var cw=crewAtStation(i), pc=pacerInto(i);
    if(!cw.length && !pc) return '';
    return '<div class="planWho">'+
      (cw.length?'<div><span>Crew</span><div class="pchips">'+
        cw.map(function(p){ return personChip(p); }).join('')+'</div></div>':'')+
      (pc?'<div><span>Pacer</span><div class="pchips">'+personChip(pc)+'</div></div>':'')+
    '</div>';
  }

  function buildPace(){
    var fin=STATIONS[STATIONS.length-1];
    var mins=paceNow(), finMins=mins[STATIONS.length-1];
    /* every goal's splits, computed once -- each leg card shows all three so
       the plan can be read and edited without switching screens */
    var GM={}; GOALKS.forEach(function(k){ GM[k]=paceNow(k); });
    var GNAME={}; PLANS.forEach(function(p){ GNAME[p.k]=p.name; });
    var T=fuelTotals(), ed=PLANEDIT;
    var busts=0;
    for(var q=1;q<STATIONS.length;q++)
      if(STATIONS[q].cut!=null && mins[q]>STATIONS[q].cut) busts++;

    var out='<div class="card no-print">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:2px">'+
        '<h3>Race day</h3>'+
        '<span class="pill'+(ed?' gold':' grey')+'">'+(ed?'Editing ':'')+
        PLANS.filter(function(p){return p.k===S.plan;})[0].name+'</span></div>'+
      '<p class="sec">Your splits, your fuel and who is with you, leg by leg. This is the page to open at an aid station. Everything here is on your crew and pacers’ phones too.</p>'+
      '<div class="metrics" style="margin-top:12px">'+
        '<div><div class="k">Finish</div><div class="v num">'+dur(finMins)+'</div></div>'+
        '<div><div class="k">Average</div><div class="v num">'+pace(fin.mi,finMins)+'/mi</div></div>'+
        '<div><div class="k">Margin</div><div class="v num" style="color:'+
          (RACE.limit-finMins<0?'var(--red)':'var(--text)')+'">'+dur(RACE.limit-finMins)+'</div></div>'+
      '</div>'+
      '<div class="metrics" style="margin-top:8px">'+
        '<div><div class="k">Carbs</div><div class="v num">'+(T.carbs?Math.round(T.carbsHr)+' g/hr':'\u2014')+'</div></div>'+
        '<div><div class="k">Sodium</div><div class="v num">'+(T.caps?Math.round(T.naHr)+' mg/hr':'\u2014')+'</div></div>'+
        '<div><div class="k">Water</div><div class="v num">'+(T.water?num1(T.water)+' L':'\u2014')+'</div></div>'+
      '</div>'+
      (busts?'<div class="callout w" style="margin-top:12px"><b>'+busts+
        (busts===1?' stop is':' stops are')+' past the cutoff.</b> Marked in red below.</div>':'')+
      '<div class="btn-row" style="margin-top:14px">'+
        '<button class="btn'+(ed?'':' tint')+'" id="planEdit">'+(ed?'Done editing':'Edit the plan')+'</button>'+
        '<button class="btn tint" id="planPrint">Print / save as PDF</button>'+
      '</div>'+
      (ed?'<div class="fld" style="margin-top:14px"><label>Target finish</label>'+
        '<div class="goalFins">'+PLANS.filter(function(p){ return GOALKS.indexOf(p.k)>=0; })
          .map(function(p){
            return '<label class="gf'+(p.k===S.plan?' on':'')+'"><span>'+p.name+'</span>'+
              '<input type="text" inputmode="numeric" data-gfin="'+p.k+'" value="'+
              hm(planFinish(p.k))+'" placeholder="29:35"></label>'; }).join('')+'</div>'+
        '<p class="cap" style="margin:9px 0 0">Change a finish and every leg of that goal '+
        'stretches to match. Fuel is shared by all three \u2014 it does not change with the pace. '+
        'Cutoff is published data and is never edited.</p></div>':'')+
      ((ed&&(goalsEdited()||fuelEdited()))?'<button class="btn ghost sm" id="planReset" style="margin-top:12px">Reset all three goals and the fuel plan</button>':'')+
    '</div>';

    /* one card per check-in: when you arrive, what you do there, what you
       carry out, and who is with you */
    out+='<div class="no-print">';
    for(var i=1;i<STATIONS.length;i++){
      var A=STATIONS[i-1], B=STATIONS[i], f=fuelFor(i);
      var legm=mins[i]-mins[i-1], d=+(B.mi-A.mi).toFixed(1);
      var cut=B.cut, late=(cut!=null && mins[i]>cut), tight=(cut!=null && !late && (cut-mins[i])<180);
      var carbs=f.ac+f.sc, hrs=legm/60;
      out+='<div class="planCard'+(late?' bad':(tight?' tight':''))+'">'+
        '<div class="planHd">'+
          '<div class="planNo">'+i+'</div>'+
          '<div class="planTo"><b>'+esc(B.name)+'</b>'+
            '<span>'+d.toFixed(1)+' mi from '+esc(A.name)+' · '+ft(B.gain||0)+' ft up</span></div>'+
          '<div class="planAt"><b>'+clk(mins[i])+'</b><span>'+dyOf(mins[i])+'</span></div>'+
        '</div>'+
        '<div class="goalRow'+(ed?' ed':'')+'">'+GOALKS.map(function(k){
          var gm=GM[k], gl=gm[i]-gm[i-1];
          return '<div class="g'+(k===S.plan?' on':'')+'"><span>'+GNAME[k]+'</span>'+
            (ed
              ? '<input type="text" inputmode="numeric" data-leg="'+i+'" data-lplan="'+k+
                '" value="'+hm(gl)+'">'
              : '<b>'+hm(gl)+'</b>')+
            '<s>'+clk(gm[i])+'</s></div>'; }).join('')+'</div>'+
        planWhoHTML(i)+
        '<div class="planChips">'+
          '<span>'+pace(d,legm)+'/mi</span>'+
          '<span>'+dur(mins[i])+' in</span>'+
          (cut!=null?'<span class="'+(late?'no':(tight?'warn':'ok'))+'">'+
            (late?'past cutoff '+clk(cut):dur(cut-mins[i])+' spare')+'</span>':'')+
          (B.bag?'<span class="ok">Drop bag</span>':'')+
        '</div>';
      if(ed){
        out+='<div class="planEditGrid">'+
          '<label class="wide">At the aid station<input type="text" data-fx="aid" data-fi="'+i+'" value="'+esc(f.aid)+'"></label>'+
          '<label class="wide">During the segment<input type="text" data-fx="seg" data-fi="'+i+'" value="'+esc(f.seg)+'"></label>'+
          '<label>Aid carbs g<input type="text" inputmode="numeric" data-fx="ac" data-fi="'+i+'" value="'+f.ac+'"></label>'+
          '<label>Segment carbs g<input type="text" inputmode="numeric" data-fx="sc" data-fi="'+i+'" value="'+f.sc+'"></label>'+
          '<label>Salt caps<input type="text" inputmode="numeric" data-fx="caps" data-fi="'+i+'" value="'+f.caps+'"></label>'+
          '<label>Water L<input type="text" inputmode="decimal" data-fx="water" data-fi="'+i+'" value="'+f.water+'"></label>'+
          '<label>Caffeine mg<input type="text" inputmode="numeric" data-fx="caf" data-fi="'+i+'" value="'+f.caf+'"></label>'+
        '</div>';
      } else {
        out+='<div class="planFuel">'+
          '<div><span>At the stop</span><b>'+esc(f.aid||'—')+'</b></div>'+
          '<div><span>On the way</span><b>'+esc(f.seg||'—')+'</b></div>'+
        '</div>'+
        (carbs||f.caps||f.water||f.caf ? '<div class="planChips fuel">'+
          '<span>'+carbs+' g carbs'+(hrs>0?' · '+Math.round(carbs/hrs)+'/hr':'')+'</span>'+
          '<span>'+f.caps+' salt cap'+(f.caps===1?'':'s')+'</span>'+
          '<span>'+num1(f.water)+' L</span>'+
          (f.caf?'<span>'+f.caf+' mg caffeine</span>':'')+
        '</div>' : '');
      }
      out+='</div>';
    }
    out+='</div>';
    return out + plannerPrintHTML();
  }

  /* The printed sheet is its own rendering, not the screen squeezed down:
     one table, the numbers he needs at a stop, and nothing interactive. */
  function plannerPrintHTML(){
    var mins=paceNow(), T=fuelTotals(), fin=STATIONS[STATIONS.length-1];
    var h='<div class="brief plan-print"><div class="bhead">'+
      '<h2>'+esc(RACE.name)+' — race day plan</h2>'+
      '<div class="bsub">'+RUNNER+' · '+RACE.runner.division+' · '+RACE.startLabel+' · '+RACE.limitLabel+'</div></div>'+
      '<div class="bmeta">'+
        '<div><span>Finish</span><b>'+dur(mins[STATIONS.length-1])+'</b></div>'+
        '<div><span>Average</span><b>'+pace(fin.mi,mins[STATIONS.length-1])+'/mi</b></div>'+
        '<div><span>Carbs</span><b>'+Math.round(T.carbsHr)+' g/hr</b></div>'+
        '<div><span>Sodium</span><b>'+Math.round(T.naHr)+' mg/hr</b></div>'+
        '<div><span>Water</span><b>'+num1(T.water)+' L</b></div>'+
        '<div><span>Caffeine</span><b>'+T.caf+' mg</b></div>'+
      '</div>'+
      '<table class="btable"><thead><tr><th>#</th><th>Aid station</th><th>Mi</th>'+
      '<th>Leg</th><th>Arrive</th><th>Cutoff</th><th>Spare</th>'+
      '<th>At the stop</th><th>On the way</th><th>Carbs</th><th>Caps</th><th>Water</th><th>Crew / pacer</th></tr></thead><tbody>';
    for(var i=1;i<STATIONS.length;i++){
      var A=STATIONS[i-1], B=STATIONS[i], f=fuelFor(i);
      var legm=mins[i]-mins[i-1], cut=B.cut;
      var late=(cut!=null && mins[i]>cut);
      h+='<tr'+(B.crew?' class="key"':'')+'><td>'+i+'</td><td><b>'+esc(B.name)+'</b></td>'+
        '<td>'+B.mi.toFixed(1)+'</td><td>'+hm(legm)+'</td>'+
        '<td><b>'+clkDay(mins[i])+'</b></td>'+
        '<td>'+(cut!=null?clkDay(cut):'—')+'</td>'+
        '<td'+(late?' style="color:#8E2F1D;font-weight:700"':'')+'>'+(cut!=null?(late?'past':dur(cut-mins[i])):'—')+'</td>'+
        '<td>'+esc(f.aid||'—')+'</td><td>'+esc(f.seg||'—')+'</td>'+
        '<td>'+(f.ac+f.sc)+' g</td><td>'+f.caps+'</td><td>'+num1(f.water)+'</td>'+
        '<td>'+esc(planWhoText(i))+'</td></tr>';
    }
    h+='</tbody></table>'+
      '<div class="brule">'+RACE.copy.rulesLine+RACE.copy.cutoffsNote+'</div></div>';
    return h;
  }

  function bindPace(){
    var root=shEl0();
    var eb=root.querySelector('#planEdit');
    if(eb) eb.onclick=function(){ PLANEDIT=!PLANEDIT; refreshDetail(); };
    var pb=root.querySelector('#planPrint');
    if(pb) pb.onclick=function(){ window.print(); };
    /* switching here switches the app's selected plan too, so what you edit
       and what the crew are looking at can never drift apart */
    root.querySelectorAll('[data-gfin]').forEach(function(inp){
      inp.onchange=function(){
        var k=inp.dataset.gfin, want=parseHM(inp.value), mins=paceNow(k);
        var cur=mins[STATIONS.length-1];
        if(want==null || want<=0 || !cur){ inp.value=hm(cur); return; }
        var r=want/cur;
        setPaceFor(k, mins.map(function(m){ return m*r; })); refreshDetail();
      };
    });
    var rst=root.querySelector('#planReset');
    if(rst) rst.onclick=function(){ resetGoals(); resetFuel(); refreshDetail(); };
    root.querySelectorAll('[data-leg]').forEach(function(inp){
      inp.onchange=function(){
        var i=+inp.dataset.leg, k=inp.dataset.lplan||S.plan;
        var v=parseHM(inp.value), mins=paceNow(k);
        if(v==null || v<0){ inp.value=hm(mins[i]-mins[i-1]); return; }
        /* shift, do not rescale: the legs after this one were not the ones
           that were wrong, so their durations should survive unchanged */
        var delta=(mins[i-1]+v)-mins[i];
        for(var j=i;j<mins.length;j++) mins[j]+=delta;
        setPaceFor(k, mins); refreshDetail();
      };
    });
    root.querySelectorAll('[data-fx]').forEach(function(inp){
      inp.onchange=function(){
        var i=+inp.dataset.fi, k=inp.dataset.fx, raw=inp.value, patch={};
        if(k==='aid'||k==='seg'||k==='note'){ patch[k]=raw.trim(); }
        else {
          var v=parseFloat(raw);
          if(!isFinite(v)||v<0){ inp.value=fuelFor(i)[k]; return; }
          patch[k]= k==='water' ? Math.round(v*10)/10 : Math.round(v);
        }
        setFuel(i, patch); refreshDetail();
      };
    });
  }
  function buildBags(){
    var out=RACE.copy.bagsIntro;
    DROPBAGS.forEach(function(b,bi){
      out+='<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:2px">'+
        '<h3>'+b.name+'</h3><span class="pill grey num">'+b.tag+'</span></div>';
      if(b.warn) out+='<div class="callout '+(b.crewOnly?'w':'n')+'">'+b.warn+'</div>';
      (b.lists||[]).forEach(function(l,li){
        out+='<h4 style="font-size:14.5px;font-weight:650;color:var(--green-ink);margin:16px 0 2px">'+l.h+'</h4>'+
          l.items.map(function(it,ii){ var k='db'+bi+'_'+li+'_'+ii;
            return '<label class="chk"><input type="checkbox" data-k="'+k+'"'+(S.checks[k]?' checked':'')+'><span>'+it+'</span></label>'; }).join('');
      });
      out+='</div>';
    });
    return out;
  }
  function buildCarries(){
    return '<p class="sec" style="margin-bottom:12px">Four stretches where you carry everything you will drink.</p><div class="list">'+
      CARRIES.map(function(c){
        return '<div class="item" style="align-items:flex-start"><div class="mid"><div class="nm">'+c.seg+'</div>'+
          '<div class="dt">'+c.note+'</div></div><div class="rt"><div class="a" style="color:'+(c.hi?'var(--red)':'var(--green)')+'">'+c.d+'</div></div></div>';
      }).join('')+'</div>';
  }
  function buildTeam(){
    var pc=peopleFor('crew').length, pp=peopleFor('pacer').length;
    return '<p class="sec" style="margin-bottom:14px">'+
      (S.people.length? pc+' on the crew, '+pp+' pacing. Their names show on the right stop and the right leg.'
        :'Add everyone, then send them a link. Their names show on the right stop and the right leg.')+'</p>'+
      '<button class="btn" id="addPerson"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add crew or pacer</button>'+
      '<div class="btn-row"><button class="btn tint sm" id="shareTeam">Crew link</button>'+
      '<button class="btn tint sm" id="copyCrewLink">Pacer link</button></div>'+
      (!S.people.length
        ? '<div class="card"><div class="empty">Nobody added yet.</div></div>'
        : '<div class="list">'+sortedPeople().map(function(p){
            return '<button class="item" data-person="'+p.id+'"><div class="lead'+(p.role==='chief'?' chief':'')+'">'+
              esc(initials(p.name))+'</div>'+
              '<div class="mid"><div class="nm">'+esc(p.name)+
              (p.role==='chief'?' <span class="pill nowpill">Chief</span>':'')+'</div>'+
              '<div class="dt">'+roleLabel(p)+(p.phone?' \u00b7 '+esc(p.phone):'')+'</div></div>'+CHEV+'</button>';
          }).join('')+'</div>')+
      '<div class="callout n">Share links carry the team list and your schedule additions. Your private notes are never included.</div>';
  }
  function buildRota(){
    return '<div class="grid2">'+CREW.map(function(c){
      var lv=leaveBy(c), who=crewAt(c.n);
      return '<div class="card'+(c.key?' gold':'')+'">'+
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px">'+
        '<h3>'+c.n+'. '+c.where+'</h3>'+(c.mi!=null?'<span class="pill grey num">mile '+c.mi.toFixed(1)+'</span>':'')+'</div>'+
        (who.length?'<div class="pills" style="margin-bottom:9px">'+who.map(function(p){return '<span class="pill">'+esc(p.name)+'</span>';}).join('')+'</div>':'')+
        '<p class="sec">'+c.body+'</p>'+
        (lv?'<div class="callout n" style="margin-bottom:0"><b>Leave by '+lv+'</b></div>':'')+'</div>';
    }).join('')+'</div>'+
    RACE.copy.summitSkipped;
  }
  function buildWeather(){
    return '<div class="card"><p class="sec">The 18 September average in town is a high of 71\u00b0F and a low of 42\u00b0F. It is much colder up high \u2014 expect below freezing at 10,300 feet overnight.</p>'+
      '<div class="metrics"><div><div class="k">Sunrise</div><div class="v num">'+RACE.sun.rise+'</div></div>'+
      '<div><div class="k">Sunset</div><div class="v num">'+RACE.sun.set+'</div></div>'+
      '<div><div class="k">Dark by</div><div class="v num">'+RACE.sun.dark+'</div></div></div>'+
      RACE.copy.weatherNotes;
  }
  function buildElev(){
    return '<div class="card"><h3>Measured from the course GPX</h3>'+
      '<p class="sec">Every distance, elevation and climb figure in this app now comes from the official CalTopo course file \u2014 90,692 track points, snapped to the nine aid station waypoints to within ten metres.</p>'+
      '<div class="metrics"><div><div class="k">Distance</div><div class="v num">101.2 mi</div></div>'+
      '<div><div class="k">Ascent</div><div class="v num">17,850 ft</div></div>'+
      '<div><div class="k">Descent</div><div class="v num">17,825 ft</div></div></div>'+
      RACE.copy.elevNotes;
  }
  function buildRules(){
    return '<div class="list">'+RULES.map(function(r){
      return '<div class="item" style="align-items:flex-start"><div class="mid"><div class="nm">'+r[0]+'</div><div class="dt">'+r[1]+'</div></div></div>';
    }).join('')+'</div>';
  }
  function buildQuestions(){
    return RACE.copy.questionsIntro+
      '<ol style="margin:0;padding-left:20px;line-height:1.5">'+
      QUESTIONS.map(function(q){return '<li style="margin-bottom:9px" class="sec">'+q+'</li>';}).join('')+'</ol></div>';
  }
  function buildManual(){
    return '<div class="list">'+MANUAL_TOC.map(function(m){
      return '<div class="item" style="align-items:flex-start"><div class="mid"><div class="nm">'+m[0]+'</div><div class="dt">'+m[1]+'</div></div></div>';
    }).join('')+'</div>'+
    '<a class="btn" href="'+RACE.manualFile+'" target="_blank" rel="noopener">Open the full manual</a>'+
    '<button class="btn tint" id="cacheManual2">Save for offline \u00b7 8 MB</button>'+
    '<p class="cap" id="cacheMsg2" style="margin-top:9px;text-align:center"></p>';
  }

  function buildPacers(){
    var A=atoms(), legs=pacerLegs(), pp=peopleFor('pacer');
    var night=isNight;
    var out='<div class="card gold"><h3>The five legal blocks</h3>'+
      RACE.copy.pacerBlocksIntro;

    out+='<div class="shead"><h2>Assign the blocks</h2><span class="note">'+A.length+' blocks</span></div>';
    out+=A.map(function(at){
      var w=atomWho(at.n), p=w?personById(w):null;
      return '<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'+
        '<div><h3>'+at.from.name+' \u2192 '+at.to.name+'</h3>'+
        '<div class="cap">mile '+at.from.mi.toFixed(1)+' to '+at.to.mi.toFixed(1)+'</div></div>'+
        '<span class="pill '+(at.mi>15?'red':at.mi<6?'grey':'')+'">'+at.mi+' mi</span></div>'+
        '<div class="metrics" style="margin-top:12px"><div><div class="k">Climb</div><div class="v num">'+ft(at.gain)+' ft</div></div>'+
        '<div><div class="k">Expect</div><div class="v num">'+dur(at.mins)+'</div></div>'+
        '<div><div class="k">Window</div><div class="v num">'+clk(T(at.from))+'\u2013'+clk(T(at.to))+'</div></div></div>'+
        '<div class="pills" style="margin-bottom:10px">'+
          (night(T(at.from))||night(T(at.to))?'<span class="pill gold">In the dark</span>':'<span class="pill grey">Daylight</span>')+
          '<span class="pill grey">'+pace(at.mi,at.mins)+'/mi</span>'+
          (at.gain/at.mi>250?'<span class="pill red">Steep \u2014 '+Math.round(at.gain/at.mi)+' ft/mi</span>':'')+
        '</div>'+
        '<div class="fld" style="margin:0"><label>Who runs it</label><select data-atom="'+at.n+'">'+
        '<option value="">Nobody yet</option>'+
        pp.map(function(x){ return '<option value="'+x.id+'"'+(w===x.id?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+
        '</select></div>'+
        (p?'':'<p class="cap" style="margin-top:8px">'+(pp.length?'Unassigned.':'Add pacers on the Crew and pacers screen first.')+'</p>')+
        '</div>';
    }).join('');

    out+='<div class="shead"><h2>What that adds up to</h2></div>';
    out+=legs.map(function(L,i){
      var p=L.who?personById(L.who):null;
      return '<div class="card'+(L.mi>15?' alert':'')+'">'+
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'+
        '<div><h3>'+(p?esc(p.name):'Nobody assigned')+'</h3>'+
        '<div class="cap">'+L.from.name+' \u2192 '+L.to.name+'</div></div>'+
        '<span class="pill '+(L.mi>15?'red':'')+'">'+L.mi.toFixed(1)+' mi</span></div>'+
        '<div class="metrics" style="margin:12px 0 0"><div><div class="k">Climb</div><div class="v num">'+ft(L.gain)+' ft</div></div>'+
        '<div><div class="k">On the go</div><div class="v num">'+dur(L.mins)+'</div></div>'+
        '<div><div class="k">Pace</div><div class="v num">'+pace(L.mi,L.mins)+'/mi</div></div></div>'+
        (L.mi>15?'<div class="callout w" style="margin-bottom:0">Long for a pacer who is not racing it. Split it if you can \u2014 but check the legal swap points first.</div>':'')+
        '</div>';
    }).join('');
    return out;
  }

  function buildApp(){
    var nc=noteCount();
    return '<div class="card"><h3>Export</h3>'+
      '<p class="sec">The whole plan as one Excel workbook: pacing, crew stops, aid stations and fuel, pacer legs, gear, drop bags and the schedule. Each sheet prints landscape with its header repeated.</p>'+
      '<button class="btn sm" id="exportX" style="margin-top:12px">Export to Excel</button></div>'+
      '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">'+
      '<h3>Shared plan</h3><span class="pill grey" data-sync>\u2014</span></div>'+
      '<p class="sec">The team list, aid station notes and race-day splits are shared with everyone on the plan. Gear ticks and which person this phone is stay on this device.</p>'+
      '<button class="btn tint sm" id="syncNow" style="margin-top:12px">Sync now</button>'+
      '<p class="cap" id="syncErr" style="margin-top:9px"></p></div>'+

      '<div class="card"><h3>Race number</h3>'+
      '<p class="sec">Bibs are assigned after entries close on 7 September. Once this is set, the app can read your checkpoint times from the official timing feed \u2014 arrivals only, since mats cannot record a departure.</p>'+
      '<div class="fld" style="margin-bottom:10px"><label>Bib</label>'+
      '<input id="bibIn" inputmode="numeric" value="'+esc(S.bib||'')+'" placeholder="e.g. 512"></div>'+
      '<div class="btn-row" style="margin-bottom:0"><button class="btn tint sm" id="bibSave">Save bib</button>'+
      '<button class="btn tint sm" id="bibTest">Test the feed</button></div>'+
      '<p class="cap" id="bibMsg" style="margin-top:10px"></p></div>'+

      '<div class="card"><h3>Appearance</h3>'+
      '<p class="sec">Light is the default — easier to read outdoors and for anyone who needs reading glasses.</p>'+
      '<div class="seg" style="margin:12px 0 0">'+
      [['light','Light'],['dark','Dark'],['auto','Match device']].map(function(t){
        return '<button'+(S.theme===t[0]?' class="on"':'')+' data-theme="'+t[0]+'">'+t[1]+'</button>';
      }).join('')+'</div></div>'+

      '<div class="card"><h3>Projecting ahead</h3>'+
      '<p class="sec">Times already logged are always the real ones. This only changes how the stations <i>ahead</i> are estimated once the runner is off plan.</p>'+
      '<div class="seg" style="margin:12px 0 10px">'+
      [['smart','Smart'],['pace','Current pace'],['goal','Goal pace']].map(function(t){
        return '<button'+(S.proj===t[0]?' class="on"':'')+' data-proj="'+t[0]+'">'+t[1]+'</button>';
      }).join('')+'</div>'+
      '<p class="cap">'+(S.proj==='smart' ? 'Learned from how the field actually ran this course: a delay only half carries, and the estimate comes with an honest range. Recommended.' : S.proj==='pace'
        ? 'If the runner is six percent down at mile 70, everything ahead is six percent slower. The honest one late in a hundred.'
        : 'Assumes the runner holds goal pace from here, so the current gap simply carries to the finish. The optimistic one.')+'</p></div>'+

      '<div class="card"><h3>Share my location</h3>'+
      '<p class="sec">Adds a third source alongside the timing mats and the crew. It only works with the app open and a signal, so treat it as filling gaps rather than as the tracker.</p>'+
      '<div class="seg" style="margin:12px 0 10px">'+
      [['off','Off'],['on','Share']].map(function(t){
        var on=(t[0]==='on')===!!S.gps;
        return '<button'+(on?' class="on"':'')+' data-gps="'+t[0]+'">'+t[1]+'</button>';
      }).join('')+'</div>'+
      '<p class="cap gpsline">'+(GPS.last?('Last fix: mile '+GPS.last.mi.toFixed(1)+' \u00b7 '+
        Math.round(gpsAge())+' min ago'):'No fix yet.')+'</p></div>'+

      '<div class="card"><h3>Offline map</h3>'+
      '<p class="sec">Saves the satellite tiles along the course so the map still has imagery with no signal. About 15 MB. Do it on wifi.</p>'+
      '<button class="btn tint sm" id="saveTiles" style="margin-top:12px">Save the map for offline</button>'+
      '<p class="cap" id="tileMsg" style="margin-top:9px"></p></div>'+

      '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">'+
      '<h3>Offline</h3><span class="pill grey" id="swState">checking</span></div>'+
      '<p class="sec">Add this page to your home screen and it runs full screen with no signal. Open it once on wifi so the cache fills.</p></div>'+

      '<div class="card"><h3>This device</h3>'+
      '<div class="metrics"><div><div class="k">Notes</div><div class="v num">'+nc+'</div></div>'+
      '<div><div class="k">People</div><div class="v num">'+S.people.length+'</div></div>'+
      '<div><div class="k">Splits</div><div class="v num">'+Object.keys(S.splits).length+'</div></div></div>'+
      '<button class="btn ghost sm" id="resetAll" style="margin-top:14px">Clear this device</button>'+
      '<p class="cap" style="margin-top:9px">Clears local copies only. Anything already shared stays on the plan and comes back on the next sync.</p></div>';
  }
  function bindChecks(){
    document.querySelectorAll('input[type=checkbox][data-k]').forEach(function(cb){
      /* repaint the counts in place. This used to call refreshDetail(),
         which rebuilds the whole screen and sends you back to the top of
         the page on every single tick. */
      cb.onchange=function(){ S.checks[cb.dataset.k]=cb.checked; save(); paintCheckCounts(); };
    });
    paintCheckCounts();
  }
  function paintCheckCounts(){
    var n=MANDATORY.filter(function(_,i){return S.checks['mg'+i];}).length;
    var el=document.getElementById('mgCount');
    if(el){ el.textContent=n+' of 5'; el.className='pill '+(n===5?'':'gold')+' num'; }
    document.querySelectorAll('[data-gcount]').forEach(function(pill){
      var gi=+pill.dataset.gcount, items=gearItemsFor(gi);
      var done=items.filter(function(it){return S.checks[it.key];}).length;
      pill.textContent=done+' of '+items.length;
      pill.className='pill '+(items.length&&done===items.length?'':'grey')+' num';
    });
  }
  function shEl0(){ return document.getElementById('detailBody')||document; }
  function bindDetail(k){
    if(k==='pace') bindPace();
    if(k==='gear'){
      shEl0().querySelectorAll('[data-fold]').forEach(function(d){
        d.ontoggle=function(){ GEAROPEN[d.dataset.fold]=d.open; };
      });
      shEl0().querySelectorAll('[data-gadd]').forEach(function(b){
        b.onclick=function(){ openGearAdd(+b.dataset.gadd); };
      });
      shEl0().querySelectorAll('[data-gedit]').forEach(function(b){
        b.onclick=function(){ var p=b.dataset.gedit.split('|'); openGearEdit(+p[0],p[1]); };
      });
      shEl0().querySelectorAll('[data-grm]').forEach(function(b){
        b.onclick=function(){ var p=b.dataset.grm.split('|'); removeGearItem(+p[0],p[1]); };
      });
    }
    if(k==='team'){
      document.getElementById('addPerson').onclick=function(){ editPerson(null); };
      document.getElementById('shareTeam').onclick=doShareCrew;
      document.getElementById('copyCrewLink').onclick=doSharePacer;
      document.querySelectorAll('[data-person]').forEach(function(b){ b.onclick=function(){ editPerson(b.dataset.person); }; });
    }
    if(k==='brief'){
      document.getElementById('printBrief').onclick=function(){ window.print(); };
      document.getElementById('briefPlan').onclick=function(){
        sheet('Which schedule?','<p class="sec">The printed sheet uses whichever schedule you pick here.</p>'+
          PLANS.map(function(p){ return '<button class="btn '+(p.k===S.plan?'':'tint')+'" data-bp="'+p.k+'">'+
            p.name+' · '+hm(planFinish(p.k))+'</button>'; }).join(''));
        shEl.querySelectorAll('[data-bp]').forEach(function(b){
          b.onclick=function(){ S.plan=b.dataset.bp; save(); reproject(); closeSheet(); refreshDetail(); }; });
      };
    }
    if(k==='legs'){
      shEl0().querySelectorAll('[data-atom]').forEach(function(sel){
        sel.onchange=function(){ setAtomWho(+sel.dataset.atom, sel.value||null); refreshDetail(); };
      });
    }
    if(k==='manual') cacheManual('cacheManual2','cacheMsg2');
    if(k==='app'){
      swBadge(); paintSync();
      shEl0().querySelectorAll('[data-gps]').forEach(function(b){
        b.onclick=function(){
          S.gps=(b.dataset.gps==='on'); save();
          if(S.gps) gpsStart(); else gpsStop();
          refreshDetail();
        };
      });
      var st=document.getElementById('saveTiles');
      if(st) st.onclick=function(){ saveTiles('satellite', st, document.getElementById('tileMsg')); };
      shEl0().querySelectorAll('[data-theme]').forEach(function(b){
        b.onclick=function(){ S.theme=b.dataset.theme; save(); applyTheme(); refreshDetail();
          if(S.mode==='runner') drawProfile('profile'); }; });
      shEl0().querySelectorAll('[data-proj]').forEach(function(b){
        b.onclick=function(){ S.proj=b.dataset.proj; save(); markDirty(); reproject(); refreshDetail(); }; });
      var ex=document.getElementById('exportX'); if(ex) ex.onclick=exportXlsx;
      document.getElementById('syncNow').onclick=function(){
        syncNow(true).then(function(){
          var e=document.getElementById('syncErr');
          if(e) e.textContent = SB.err ? ('Last error: '+SB.err) : '';
          refreshDetail();
        });
      };
      document.getElementById('bibSave').onclick=function(){
        S.bib=document.getElementById('bibIn').value.replace(/\D/g,'').slice(0,5);
        save(); markDirty();
        document.getElementById('bibMsg').textContent = S.bib ? 'Saved bib '+S.bib+'.' : 'Bib cleared.';
      };
      document.getElementById('bibTest').onclick=function(){
        var m=document.getElementById('bibMsg');
        var bib=document.getElementById('bibIn').value.replace(/\D/g,'');
        if(!bib){ m.textContent='Enter a bib first.'; return; }
        m.textContent='Asking the timing feed\u2026';
        fetch(sbUrl('/functions/v1/runner?bib='+bib+'&db='+encodeURIComponent(SUPA.db)),{headers:sbHead()})
          .then(function(r){return r.json();})
          .then(function(j){
            if(!j) { m.textContent='No answer from the feed.'; return; }
            if(!j.ok){ m.textContent='Feed says: '+(j.error||'no data')+'. This is expected before race day.'; return; }
            var n=Object.keys(j.arrivals||{}).length;
            m.textContent = n ? (j.name||'Runner')+' \u2014 '+n+' checkpoints found.'
                              : 'Feed reachable, no checkpoints yet for that bib.';
          })
          .catch(function(e){ m.textContent='Could not reach the feed: '+e.message; });
      };
      document.getElementById('resetAll').onclick=function(){
        sheet('Clear everything?','<p class="sec">This wipes your gear ticks, notes, team list and schedule additions from this phone. The race plan itself stays.</p>'+
          '<button class="btn danger" id="rYes" style="margin-top:8px">Yes, clear it all</button>'+
          '<button class="btn tint" id="rNo">Keep it</button>');
        document.getElementById('rYes').onclick=function(){
          S.checks={}; S.notes={}; S.secOv={}; S.driveOv={}; S.people=[]; S.custom=[]; S.splits={}; S.aidOv={}; S.me=null;
          S.gearAdd={}; S.gearRemoved={}; S.gearOverride={}; S.paceOv={}; S.fuelOv={};
          save(); reproject(); closeSheet(); closeDetail(); };
        document.getElementById('rNo').onclick=closeSheet;
      };
    }
  }
  function swBadge(){
    var e=document.getElementById('swState'); if(!e) return;
    if(location.protocol==='file:'){ e.textContent='preview only'; e.className='pill grey'; }
    else if(SWOK===true){ e.textContent='works offline'; e.className='pill'; }
    else if(SWOK===false){ e.textContent='online only'; e.className='pill red'; }
  }
  var SWOK=null;

  /* ── crew ── */
  function crewArrive(c){ return c.mi==null?null:T(STATIONS[idxOf(c.mi)]); }
  function driveFor(c){ return DRIVES[c.where]||{t:'',d:''}; }
  function leaveMins(c){ var d=driveMins(c); if(!d||c.mi==null) return null;
    var i=idxOf(c.mi); if(i<0) return null;
    return T(STATIONS[i])-d-(d>=120?30:20); }
  function leaveBy(c){ var m=leaveMins(c); return m==null?null:clkDay(m); }
  /* How long it takes the crew to get there. Shipped as an estimate, but
     Fish Creek is a four-mile hike and Summit is a mountain pass -- only the
     people driving it know the real number, so they own it. */
  function driveMins(c){
    var o=(S.driveOv||{})[c.n];
    return (o!=null && isFinite(o)) ? +o : (c.drive||0);
  }
  function setDrive(n, mins){
    S.driveOv=S.driveOv||{};
    if(mins==null || !isFinite(mins) || mins<=0) delete S.driveOv[n];
    else S.driveOv[n]=Math.round(mins);
    save(); markDirty();
  }
  function driveShort(c){
    var d=driveMins(c);
    if(!d) return c.mi==null?'—':'not set';
    return d>=120 ? hm(d) : d+' min';
  }
  function crewStopAt(i){
    for(var k=0;k<CREW.length;k++)
      if(CREW[k].mi!=null && idxOf(CREW[k].mi)===i) return CREW[k];
    return null;
  }
  function mapBtn(where,tone){
    if(MAPQ[where]) return '<a class="btn '+(tone||'')+'" style="text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+
      encodeURIComponent(MAPQ[where])+'"><svg viewBox="0 0 24 24"><path d="M12 21.5s7-6 7-11.5a7 7 0 10-14 0c0 5.5 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.6"/></svg>Directions</a>';
    if(NOMAP[where]) return '<div class="callout w" style="margin:0"><b>Do not use a map app.</b> '+NOMAP[where]+'</div>';
    return '';
  }
  /* A stop becomes "next" when it is time to LEAVE for it, not when the runner arrives.
     The rest block has no mile, so it sits just ahead of the following real stop. */
  function pickTime(i){
    var c=CREW[i];
    if(c.mi!=null){ var l=leaveMins(c); return l!=null?l:crewArrive(c); }
    for(var j=i+1;j<CREW.length;j++) if(CREW[j].mi!=null){
      var n=leaveMins(CREW[j]); return (n!=null?n:crewArrive(CREW[j]))-1; }
    return null;
  }
  /* "Stop 4 of 7", counted over the stops this team is actually driving to */
  function stopOf(c){ var v=visibleCrew().filter(function(x){ return !x.rest; }), k=v.indexOf(c);
    return k<0 ? 'Optional stop' : 'Stop '+(k+1)+' of '+v.length; }
  function crewPick(){
    var p=crewPickRaw();
    /* never point the hero at a stop nobody is driving to */
    while(p<CREW.length-1 && stopHidden(CREW[p].n)) p++;
    while(p>0 && stopHidden(CREW[p].n)) p--;
    return p;
  }
  function crewPickRaw(){
    var nm=now();
    if(anySplits()){
      var last=lastSplitIdx(), lsp=splitOf(last);
      for(var i=0;i<CREW.length;i++){
        var c=CREW[i]; if(c.mi==null) continue;      // rest block drops out once logging starts
        var si=idxOf(c.mi);
        if(si<last) continue;                         // already behind him
        if(si===last && lsp && lsp.out!=null) continue;  // he has left this one
        return i;
      }
      return CREW.length-1;
    }
    var pick=CREW.length-1;
    for(var j=0;j<CREW.length;j++){ var t=pickTime(j); if(t==null||t>nm){pick=j;break;} }
    return nm<0?0:pick;
  }
  function renderCrew(){
    var nm=now(), pick=crewPick();
    var c=CREW[pick], a=crewArrive(c), lm=leaveMins(c), dr=driveFor(c), who=crewAt(c.n);
    var cd='';
    var lsi=lastSplitIdx();
    if(lsi>=0){
      var delta=splitVal(lsi)-planT(STATIONS[lsi]);
      var word=Math.abs(delta)<6?'on plan':(delta>0?dur(delta)+' behind':dur(-delta)+' ahead');
      cd='<div class="pill" style="background:rgba(255,255,255,'+(delta>60?'.26':'.16')+');color:#fff">'+word+'</div>';
    }
    else if(lm!=null){
      var left=lm-nm, txt;
      if(left<=0) txt='Leave now';
      else if(left<=720) txt='Leave in '+dur(left);
      else txt='Leave '+clkDay(lm);
      cd='<div class="pill" style="background:rgba(255,255,255,'+(left<=60?'.26':'.16')+');color:#fff">'+txt+'</div>';
    }
    document.getElementById('c-next').innerHTML=
      '<div class="phead"><h1>Where to be next</h1><p class="sec">This changes on its own as the race goes on.</p></div>'+
      '<div class="hero"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px">'+
      '<div class="eyebrow">'+(c.rest?'Right now':stopOf(c))+'</div>'+cd+'</div>'+
      '<h2>'+c.where+'</h2>'+
      (a!=null?'<div class="display num">'+clk(a)+'</div><div class="under">'+fFull.format(new Date(START+a*MIN))+' — when '+RUNNER+' should arrive</div>':'')+
      (lm!=null?'<div class="stats"><div><div class="k">Leave town</div><div class="v num">'+clk(lm)+'</div></div>'+
        '<div><div class="k">Drive</div><div class="v num">'+driveShort(c)+'</div></div>'+
        '<div><div class="k">Mile</div><div class="v num">'+(c.mi!=null?c.mi.toFixed(1):'—')+'</div></div></div>':'')+
      (who.length?'<div class="pills" style="margin-top:14px">'+who.map(function(p){return '<span class="pill">'+esc(p.name)+'</span>';}).join('')+'</div>':'')+
      '</div>'+
      livePanel()+
      '<div class="dots">'+CREW.map(function(_,ix){
        return '<i class="'+(ix===pick?'on':ix<pick?'past':'')+'"></i>'; }).join('')+'</div>'+
      (c.mi!=null?logButtons(idxOf(c.mi)):'')+
      '<button class="btn '+(c.mi!=null?'ghost sm':'tint')+'" data-logany style="margin-bottom:10px">Log a different aid station</button>'+
      mapBtn(c.where, c.mi!=null?'tint':'')+
      '<div class="card"><h3>What to have ready</h3><p class="sec">'+c.what+'</p></div>'+
      '<div class="card"><h3>What happens here</h3><p class="sec">'+c.body+'</p>'+
      (c.pacer?'<div class="callout g" style="margin-bottom:0"><b>'+c.pacer+'.</b>'+
        (c.mi!=null&&whoIsWith(c.mi+0.01)?' '+esc(whoIsWith(c.mi+0.01).name)+' starts from here.':'')+'</div>':'')+'</div>'+
      (dr.d?'<div class="card"><h3>How to get there</h3>'+(dr.t?'<p class="cap" style="margin:-4px 0 8px">'+dr.t+'</p>':'')+
        '<p class="sec">'+dr.d+'</p>'+(dr.warn?'<div class="callout w" style="margin-bottom:0"><b>'+dr.warn+'</b></div>':'')+'</div>':'')+
      '<button class="btn tint" id="seeAll">See all nine stops</button>';
    bindLog();
    var sa=document.getElementById('seeAll');
    if(sa) sa.onclick=function(){ document.querySelector('.tab[data-v="c-stops"]').click(); };

    document.getElementById('crewStops').innerHTML='<div class="list">'+CREW.map(function(x,ix){
      var t=crewArrive(x), w=crewAt(x.n);
      void t;
      var sp=x.mi!=null?splitOf(idxOf(x.mi)):null, gone=!!(sp&&sp.out!=null);
      return '<button class="item'+(gone||ix<pick?' done':'')+(ix===pick?' current':'')+'" data-c="'+ix+'">'+
        '<div class="lead num">'+(gone?'\u2713':x.n)+'</div>'+
        '<div class="mid"><div class="nm">'+x.where+'</div><div class="dt">'+
        (x.rest?'Nothing to do':(x.mi!=null?'Mile '+x.mi.toFixed(1):''))+(x.opt?' · optional':'')+
        (w.length?' · '+nameList(w):'')+'</div></div>'+
        '<div class="rt">'+(t!=null?'<div class="a num"'+(gone?' style="color:var(--green)"':'')+'>'+clk(t)+'</div>'+
        '<div class="b">'+(gone?'logged':fD.format(new Date(START+t*MIN)))+'</div>':'')+'</div>'+
        CHEV+'</button>';
    }).join('')+'</div>';
    document.querySelectorAll('[data-c]').forEach(function(b){ b.onclick=function(){ openCrewStop(CREW[+b.dataset.c]); }; });

    var fc=document.getElementById('followCrew'); if(fc) fc.innerHTML=followCard();
    var fp=document.getElementById('followPacer'); if(fp) fp.innerHTML=followCard();
    var ct=document.getElementById('crewTeam');
    if(ct) ct.innerHTML = S.people.length
      ? '<div class="list">'+S.people.map(function(p){
          var role=p.role==='pacer'?roleLabel(p):'Crew';
          return '<div class="item"><div class="lead">'+esc(initials(p.name))+'</div>'+
            '<div class="mid"><div class="nm">'+esc(p.name)+'</div><div class="dt">'+role+'</div></div>'+
            (p.phone?'<a class="rt" href="tel:'+esc(p.phone)+'"><span class="a" style="color:var(--green)">Call</span></a>':'')+'</div>';
        }).join('')+'</div>'
      : '<div class="card"><div class="empty">No team list yet.<br>'+RUNNER+' can add everyone and re-share the link.</div></div>';
  }
  function openCrewStop(c){
    var a=crewArrive(c), lv=leaveBy(c), dr=driveFor(c), who=crewAt(c.n);
    sheet(c.where,
      '<div class="cap" style="margin:-6px 0 10px">'+stopOf(c)+(c.mi!=null?' · mile '+c.mi.toFixed(1):'')+'</div>'+
      (a!=null?'<div class="card tint" style="margin-bottom:12px"><div class="cap">'+RUNNER+' should arrive</div>'+
        '<div class="num" style="font-size:32px;font-weight:700;letter-spacing:-.03em;margin-top:2px">'+clk(a)+'</div>'+
        '<div class="cap">'+fFull.format(new Date(START+a*MIN))+'</div>'+
        (lv?'<div style="margin-top:10px"><span class="pill">Leave by '+lv+'</span></div>':'')+'</div>':'')+
      (who.length?'<div class="pills" style="margin-bottom:12px">'+who.map(function(p){return '<span class="pill">'+esc(p.name)+'</span>';}).join('')+'</div>':'')+
      mapBtn(c.where)+
      (c.mi!=null?notesHTML('aid', idxOf(c.mi)):'')+
      '<h4 style="font-size:15px;font-weight:650;color:var(--green-ink);margin:16px 0 5px">What happens here</h4><p class="sec">'+c.body+'</p>'+
      (c.pacer?'<div class="callout g"><b>'+c.pacer+'.</b></div>':'')+
      (dr.d?'<h4 style="font-size:15px;font-weight:650;color:var(--green-ink);margin:16px 0 5px">How to get there</h4><p class="sec">'+dr.d+'</p>'+
        (dr.warn?'<div class="callout w"><b>'+dr.warn+'</b></div>':''):'')+
      (c.mi!=null?logButtons(idxOf(c.mi)):''));
    bindLog();
  }


  /* ── who am I, and what is my job ──────────────────────────────
     One interface, one link. What differs between people is a single
     card at the top of the race screen, and it is driven by the person
     you said you were -- which lives in the shared plan, so the runner can
     change someone's job from his own phone and their screen follows. */
  var ME_RUNNER='runner';
  function meIsRunner(){ return S.me===ME_RUNNER; }
  function mePerson(){
    if(!S.me||meIsRunner()) return null;
    for(var i=0;i<S.people.length;i++) if(S.people[i].id===S.me) return S.people[i];
    return null;
  }

  /* The crew's next stop, as a card rather than a whole screen. Same
     source of truth as the old crew view: crewPick() decides which of the
     nine is next, and it advances on its own as splits get logged. */
  /* One card per stop, swiped sideways. It lands on whichever stop the plan
     says is next -- the start line before the gun, then forward on its own as
     splits come in -- but the crew can push it along to look ahead.

     Everything that changes with the clock (the countdown pill, which dot is
     lit, the notes under the strip) is painted afterwards rather than built
     into the markup. If it were in the string, the twenty-second refresh
     would see different markup every time and rebuild the whole list. */
  function heroSlideHTML(c, k, n){
    var a=crewArrive(c);
    var meta=[];
    if(c.mi!=null) meta.push('Mile '+c.mi.toFixed(1));
    meta.push(driveShort(c)+' to get there');
    return '<div class="heroslide"><div class="hero">'+
      '<div class="hero-top">'+
        '<div class="hero-id">'+
          '<div class="eyebrow">'+(c.rest?'Right now':'Stop '+(k+1)+' of '+n)+'</div>'+
          '<h2>'+c.where+'</h2>'+
        '</div>'+
        (a!=null?'<div class="heroclock">'+
          '<em data-heropill>Arrives</em>'+
          '<span><b class="num">'+clk(a)+'</b><s>'+dyOf(a)+'</s></span></div>':'')+
      '</div>'+
      '<div class="herometa">'+meta.join(' \u00b7 ')+'</div>'+
      whoLineHTML(c, true, true)+
      (function(){
        var body=notesHTML('aid', c.mi!=null?idxOf(c.mi):-1, true);
        return body ? '<div class="hero-extra">'+body+'</div>' : '';
      })()+
      '</div></div>';
  }
  function crewJobHTML(){
    var vis=visibleCrew(), n=vis.length;
    return '<div class="herostrip" id="heroStrip">'+
      vis.map(function(c,k){ return heroSlideHTML(c,k,n); }).join('')+'</div>'+
      '<div class="herodots" id="heroDots">'+
      vis.map(function(){ return '<i></i>'; }).join('')+'</div>';
  }

  /* Which card is showing. Null means "follow the plan"; once the crew swipe
     it themselves that choice sticks, until the race moves on to a new stop. */
  var HERO_AT=null, HERO_PICK=null;
  /* offsets are measured from the first card, not from the strip, so the
     strip's own left padding does not become a permanent 16px scroll */
  function heroLeft(strip,k){
    var kid=strip.children[k], first=strip.children[0];
    return (kid&&first) ? kid.offsetLeft-first.offsetLeft : 0;
  }
  function heroIndex(strip){
    var best=0, bd=1e9;
    for(var k=0;k<strip.children.length;k++){
      var d=Math.abs(heroLeft(strip,k)-strip.scrollLeft);
      if(d<bd){ bd=d; best=k; }
    }
    return best;
  }
  function paintHeroAt(strip){
    var vis=visibleCrew(), c=vis[HERO_AT]; if(!c) return;
    /* the countdown, on the card that is showing */
    for(var k=0;k<strip.children.length;k++){
      var slot=strip.children[k].querySelector('[data-heropill]');
      if(!slot) continue;
      var aa=crewArrive(vis[k]), txt='Arrives', soon=false;
      if(aa!=null){
        var left=aa-now();
        if(left>0 && left<=720){ txt='Arrives in '+dur(left); soon=left<=60; }
        else if(left<=0) txt='Arrived';
      }
      if(slot.textContent!==txt) slot.textContent=txt;
      slot.classList.toggle('soon', soon);
    }
    var dots=document.getElementById('heroDots');
    if(dots) for(var d=0;d<dots.children.length;d++)
      dots.children[d].classList.toggle('on', d===HERO_AT);
  }
  /* "Leave at 6:12" was a number the app invented and the crew disliked.
     This is the same arithmetic run the other way and left to them: if you
     set off now, this is when you get there. Only during the race, because
     before it the answer is a date, not a time. */
  function paintEtas(root){
    var live=isRaceDay();
    (root||document).querySelectorAll('[data-eta]').forEach(function(el){
      var mins=+el.dataset.eta;
      var txt = (live && mins>0) ? 'there '+clk(now()+mins) : '';
      if(el.textContent!==txt) el.textContent=txt;
    });
  }
  function paintHero(root){
    var strip=(root||document).querySelector('#heroStrip'); if(!strip) return;
    var vis=visibleCrew(), pick=vis.indexOf(CREW[crewPick()]);
    if(pick<0) pick=0;
    if(HERO_PICK!==pick){ HERO_PICK=pick; HERO_AT=pick; }   /* the race moved on */
    if(HERO_AT==null || HERO_AT>=vis.length) HERO_AT=pick;
    if(strip.children[HERO_AT]){
      var target=heroLeft(strip,HERO_AT);
      if(Math.abs(strip.scrollLeft-target)>4) strip.scrollLeft=target;
    }
    paintHeroAt(strip);
    if(!strip.__b){
      strip.__b=1;
      var t=null;
      strip.addEventListener('scroll', function(){
        clearTimeout(t);
        t=setTimeout(function(){
          var k=heroIndex(strip);
          if(k!==HERO_AT){ HERO_AT=k; paintHeroAt(strip); }
        }, 90);
      }, {passive:true});
    }
  }

  /* Rest and Summit Lake are off by default -- no aid is run at either -- but
     they are hidden, not deleted, so a change of plan is a checkbox. */
  var STOPS_OFF_DEFAULT = {}; CREW.forEach(function(c){ if(c.rest||c.off) STOPS_OFF_DEFAULT[c.n]=1; });   /* from the race file */
  function stopHidden(n){
    return S.stopsOff ? !!S.stopsOff[n] : !!STOPS_OFF_DEFAULT[n];
  }
  function visibleCrew(){ return CREW.filter(function(c){ return !stopHidden(c.n); }); }

  /* Which of the nine the crew actually drive to. Shared, so one change on
     the runner's phone reaches every phone. */
  function editStops(){
    sheet('Which stops show',
      '<p class="sec" style="margin-bottom:12px">Untick a stop the crew is not driving to. '+
      'It disappears from everyone’s list; the aid station itself is untouched.</p>'+
      CREW.map(function(c){
        return '<label class="chk"><input type="checkbox" class="stopOn" value="'+c.n+'"'+
          (stopHidden(c.n)?'':' checked')+'><span>'+c.n+'. '+c.where+
          '<em>'+(c.mi!=null?'mile '+c.mi.toFixed(1):'no location')+'</em></span></label>';
      }).join('')+
      '<button class="btn" id="stopsSave" style="margin-top:16px">Save</button>');
    document.getElementById('stopsSave').onclick=function(){
      var off={};
      shEl.querySelectorAll('.stopOn').forEach(function(c){ if(!c.checked) off[c.value]=1; });
      S.stopsOff=off; save(); markDirty(); closeSheet(); render();
    };
  }

  /* Who is on aid at a stop. Two lists could answer this -- the person's own
     `stops`, and the station's `who` -- so both are read and merged rather
     than trusting whichever one happened to get filled in. */
  function responsibleAt(c){
    var out=[], seen={};
    function add(p){ if(p && !seen[p.id]){ seen[p.id]=1; out.push(p); } }
    crewAt(c.n).forEach(add);
    var i = c.mi!=null ? idxOf(c.mi) : -1;
    if(i>=0) aidWho(i).forEach(function(id){
      add(S.people.filter(function(x){ return x.id===id; })[0]); });
    return out;
  }
  /* One hue each, no duplicates. Ordered by id -- which is a creation
     timestamp -- so a person added tonight takes the next free colour and
     everybody already on the team keeps the one they learned. */
  function personHue(id){
    var ids=(S.people||[]).map(function(p){ return p.id; }).sort();
    var k=ids.indexOf(id);
    return (k<0 ? 0 : k) % 10;
  }
  var RUN_SVG='<svg class="prole" viewBox="0 0 24 24"><circle cx="14" cy="4.6" r="2"/>'+
    '<path d="M9.5 21l2.3-6.6L9 11l1-4 3.6 1 2.4 2.6M13.8 14.4L16.4 21M6 10.4l3-2"/></svg>';
  /* A chip says who. If it is a pacer it also says so -- a runner mark
     instead of the colour dot, and what they are doing at this stop. A name’s
     name on an aid station with no other clue reads as "Crew 1 is crewing",
     which is the opposite of true. */
  function personChip(p, me, tag){
    /* the name as an attribute as well as text: a pacer chip's text carries a
       role word, so text is no longer a reliable way to say who this is */
    return '<span class="pchip pc'+personHue(p.id)+(me?' me':'')+(tag?' pacer':'')+
      '" data-p="'+esc(p.name)+'">'+
      (tag?RUN_SVG:'')+esc(p.name)+(tag?'<i>'+tag+'</i>':'')+'</span>';
  }
  /* Who is pacing, and what changes hands here. Derived from the leg
     assignments, never typed. */
  function pacerEnds(i){
    var L=pacerLegs().filter(function(L){ return L.who && L.to.__i===i; })[0];
    return L?personById(L.who):null;
  }
  function pacerStarts(i){
    var L=pacerLegs().filter(function(L){ return L.who && L.from.__i===i; })[0];
    return L?personById(L.who):null;
  }
  function pacerChipsAt(i, mine){
    if(i==null || i<0) return [];
    var a=pacerEnds(i), b=pacerStarts(i), out=[], seen={};
    function add(p,tag){
      if(!p || seen[p.id]) return;
      seen[p.id]=1;
      out.push(personChip(p, !!(mine&&p.id===mine.id), tag));
    }
    /* short words: these chips live in a 184px column on a phone, and a chip
       cannot wrap inside itself */
    if(a && b && a.id===b.id){ add(a,'pacing'); return out; }
    add(a,'finishes');
    add(b,'joins');
    if(!out.length){ var t=pacerInto(i); if(t) add(t,'pacing'); }
    return out;
  }
  /* Spans, not divs: this renders inside the stop header's <span>, and a
     block element in there is invalid nesting browsers only tolerate. */
  function whoLineHTML(c, dark, bare){
    var w=responsibleAt(c), mine=mePerson();
    var i = c.mi!=null ? idxOf(c.mi) : -1;
    var pac = pacerChipsAt(i, mine);
    var crew = w.length
      ? w.map(function(p){ return personChip(p, !!(mine&&p.id===mine.id)); }).join('')
      : (pac.length ? '' : '<span class="pchip none">Not assigned</span>');
    return '<span class="whoLine'+(dark?' on-dark':'')+(bare?' bare':'')+'">'+
      (bare?'':'<span class="lbl">Who is here</span>')+
      '<span class="pchips">'+crew+pac.join('')+'</span></span>';
  }
  /* Both channels, wherever a stop is shown. */
  /* Every note in the app is one of two channels hanging off one thing --
     an aid station or a course section. Same two labels, same two colours,
     same editor, wherever it is read. Anything else means somebody types
     into a field that another screen never looks at. */
  function noteVal(scope,id,k){
    if(scope==='sec'){
      var o=(S.secOv&&S.secOv[id])||{};
      return typeof o[k]==='string' ? o[k] : '';
    }
    return aidField(id,k);
  }
  function setNoteVal(scope,id,patch){
    if(scope!=='sec') return setAidOv(id,patch);
    S.secOv=S.secOv||{};
    var o=S.secOv[id]||{};
    for(var k in patch){ if(patch[k]==null||patch[k]==='') delete o[k]; else o[k]=patch[k]; }
    if(!Object.keys(o).length) delete S.secOv[id]; else S.secOv[id]=o;
    save(); markDirty();
  }
  /* Notes are prose; this is a packing list. A comma-separated sentence is
     unreadable at 2am with a head torch -- you cannot run your finger down
     it. Stored as one item per line, drawn as a column you tick off.
     The ticks are per phone, like every other checklist here: two people
     loading two cars each want their own. */
  function gearList(i){
    if(i==null || i<0) return [];
    var v=aidField(i,'gear');
    return String(v||'').split('\n').map(function(x){ return x.trim(); })
      .filter(function(x){ return !!x; });
  }
  function gearListHTML(i, inline){
    var g=gearList(i); if(!g.length) return '';
    if(inline) return '<div class="gearbox run"><span class="lbl">Bring</span>'+
      '<p>'+g.map(esc).join(' \u00b7 ')+'</p></div>';
    return '<div class="gearbox"><span class="lbl">Bring</span><ul>'+
      g.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('')+'</ul></div>';
  }
  function noteAny(scope,id){
    return AID_FIELDS.some(function(f){ return noteVal(scope,id,f.k); });
  }
  /* Read-only. Draws nothing at all when both channels are empty -- a summary
     view with no note should be silent, not show an empty slot. */
  function notesHTML(scope,id,inline){
    if(id==null || (scope!=='sec' && id<0)) return '';
    return AID_FIELDS.map(function(f){
      var v=noteVal(scope,id,f.k); if(!v) return '';
      return '<div class="snote '+f.who+'"><span>'+f.label+'</span>'+
        esc(v).replace(/\n/g,'<br>')+'</div>';
    }).join('') + (scope==='sec' ? '' : gearListHTML(id, inline));
  }
  /* notes plus the one button that edits them, as a single unit -- so a
     reader never has to work out which of several boxes is the live one */
  function noteUnitHTML(scope,id,label){
    if(id==null || (scope!=='sec' && id<0)) return '';
    return '<div class="noteunit">'+notesHTML(scope,id)+
      '<div class="stopc-act solo"><button class="penbtn" data-editnote="'+scope+':'+id+'">'+
      PEN_SVG+'<span>'+(label||(noteAny(scope,id)?'Edit notes':'Add a note'))+'</span></button></div></div>';
  }
  function stopNotesHTML(i){ return notesHTML('aid', i); }
  /* A compact directions affordance for a list row. */
  function mapGoLink(where){
    if(!MAPQ[where]) return '';
    return '<a class="golink" target="_blank" rel="noopener" href="'+
      'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(MAPQ[where])+'">'+
      '<svg viewBox="0 0 24 24"><path d="M12 21.5s7-6 7-11.5a7 7 0 10-14 0c0 5.5 7 11.5 7 11.5z"/>'+
      '<circle cx="12" cy="10" r="2.6"/></svg>Directions</a>';
  }
  function mapWarnHTML(where){
    if(!NOMAP[where]) return '';
    return '<div class="nogo"><b>Do not use a map app.</b> '+NOMAP[where]+'</div>';
  }
  var PEN_SVG = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/>'+
    '<path d="M14.5 5.5l4 4"/></svg>';
  var TICK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 13l4.5 4.5L19 7"/></svg>';
  function hasNotes(i){
    if(i==null || i<0) return false;
    return AID_FIELDS.some(function(f){ return aidField(i,f.k); });
  }
  /* A labelled button, not a bare glyph. Crew who have never opened the app
     should not have to guess what a pencil in a grey bar does. */
  function penBtnHTML(i, any){
    if(i==null || i<0) return '';
    return '<button class="penbtn" data-editnote="aid:'+i+'">'+PEN_SVG+
      '<span>'+(any?'Edit notes':'Add a note')+'</span></button>';
  }
  /* The row of things you can actually do at this stop. It is only drawn if
     there is something in it -- an empty tinted bar reads as a broken card,
     which is exactly what the crew saw at Fish Creek Falls. */
  function stopActHTML(where, i){
    var go=mapGoLink(where), pen='';
    if(i!=null && i>=0) pen='<button class="penbtn" data-editnote="aid:'+i+'">'+PEN_SVG+
      '<span>Edit this stop</span></button>';
    if(!go && !pen) return '';
    return '<div class="stopc-act">'+go+pen+'</div>';
  }

  /* Every stop, in order, each answering the only three questions a crew
     member has: when does he get here, what do I need out, how do I drive
     to it. Yours are marked; the others are still listed, because on the
     night people cover for each other. */
  function isMineStop(c, mine){
    if(!mine) return false;
    return responsibleAt(c).some(function(p){ return p.id===mine.id; });
  }
  /* A view preference, not part of the plan -- it lives on this phone only
     and is deliberately not synced, because two people filtering each
     other's screens on race night would be a bug, not a feature. */
  var MINEONLY = ls(KEY+'mineonly'); MINEONLY = (MINEONLY==null||MINEONLY==='') ? 1 : +MINEONLY;   /* your own stops first; All is one tap away */

  function stopsListHTML(){
    var pick=crewPick(), mine=mePerson(), vis=visibleCrew();
    var minen = vis.filter(function(c){ return isMineStop(c, mine); }).length;
    var only = (MINEONLY && minen) ? 1 : 0;
    var rows = only ? vis.filter(function(c){ return isMineStop(c, mine); }) : vis;
    return '<div class="shead"><h2>Crew Aid Stations</h2>'+
      (minen
        ? '<div class="seg mini sfilter">'+
          '<button data-sfilter="0"'+(only?'':' class="on"')+'>All '+vis.length+'</button>'+
          '<button data-sfilter="1"'+(only?' class="on"':'')+'>Mine '+minen+'</button>'+
          '</div>'
        : '')+
      (meIsRunner()?'<button class="linkbtn" id="editStops">Edit</button>':'')+'</div>'+
      '<ol class="stoplist">'+
      rows.map(function(c, ri){
        var ix=CREW.indexOf(c), seq=vis.indexOf(c)+1;
        var a=crewArrive(c), lm=leaveMins(c), si=(c.mi!=null?idxOf(c.mi):-1);
        var yours = isMineStop(c, mine);
        var state = ix<pick ? ' done' : ix===pick ? ' now' : '';
        var facts=[];
        if(c.mi!=null) facts.push(['Mile', c.mi.toFixed(1), '']);
        facts.push(['Travel time', driveShort(c),
          driveMins(c) ? '<span data-eta="'+driveMins(c)+'"></span>' : '']);
        return '<li class="stopc'+state+(yours?' yours':'')+
          (only||ri===rows.length-1?' nolink':'')+'">'+
          '<span class="rail"><i class="dot">'+
            (ix<pick ? TICK_SVG : (c.rest?'—':seq))+'</i></span>'+
          '<div class="stopc-in">'+
            '<button class="stopc-hd" data-c="'+ix+'">'+
              '<span class="w">'+c.where+(c.opt?'<i class="opt">optional</i>':'')+'</span>'+
              (a!=null?'<span class="eta"><b>'+clk(a)+'</b><s>'+
                fD.format(new Date(START+a*MIN))+'</s></span>':'')+
              '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'+
            '</button>'+
            '<div class="stopc-who">'+whoLineHTML(c, false, true)+'</div>'+
            (facts.length
              ? '<div class="stopc-facts">'+facts.map(function(f){
                  return '<div><span>'+f[0]+'</span><b>'+f[1]+'</b>'+(f[2]||'')+'</div>'; }).join('')+'</div>'
              : '')+
            stopNotesHTML(si)+
            mapWarnHTML(c.where)+
            stopActHTML(c.where, si)+
          '</div>'+
        '</li>';
      }).join('')+
      '</ol>';
  }

  /* A pacer is only pacing for a few hours of a thirty-hour day. The rest of
     the time they are in a car with the crew, so they get both cards. */
  function pacerJobHTML(p){
    var mine=legsForPerson(p.id);
    if(!mine.length) return '';
    var all=pacerLegs().filter(function(L){ return !!L.who; });
    var done=lastSplitIdx();
    var rows=mine.map(function(L){
      var nar=legNarrative(L), li=all.indexOf(L);
      var past = done>=0 && L.to.__i!=null && done>=L.to.__i;
      var live = done>=0 && L.from.__i!=null && done>=L.from.__i && !past;
      return '<button class="legcard'+(past?' done':'')+(live?' current':'')+'" data-myleg="'+li+'">'+
        '<span class="legcard-hd">'+
          '<span class="nm">'+nar.title+'</span>'+
          (live?'<span class="pill nowpill">running now</span>':
            past?'<span class="pill grey">done</span>':'')+
          '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'+
        '</span>'+
        '<span class="legcard-f">'+
          '<span><b>'+L.mi.toFixed(1)+'</b><em>miles</em></span>'+
          '<span><b>'+dur(T(L.to)-T(L.from))+'</b><em>on your feet</em></span>'+
          '<span><b>'+clk(T(L.from))+'</b><em>starts '+dyOf(T(L.from))+'</em></span>'+
        '</span></button>';
    }).join('');
    return '<div class="shead"><h2>Your '+(mine.length>1?'legs':'leg')+'</h2>'+
      '<span class="note">'+mine.reduce(function(t,L){return t+L.mi;},0).toFixed(1)+' mi total</span></div>'+
      '<div class="leglist">'+rows+'</div>';
  }

  /* Written for somebody who has never opened this before and is reading it
     in a car park at 2am. Seven things, in the order they will need them. */
  var HOWTO = [
    ['Pick your name once',
     'Everything you see is filtered to you. Tapped the wrong name? Switch, top right.'],
    ['The Plan tab is your list',
     'Every stop you drive to, in order, with the time '+RUNNER+' should get there and what to have ready.'],
    ['The times are a prediction, not a promise',
     'A Goal, B Goal and C Goal are the paces the plan can assume. Tap one and every time in the app moves with it. If the runner falls behind, tap a slower goal.'],
    ['Tap a stop for the rest',
     'Directions, where to park, what happens at that station, and the pacer swap if there is one.'],
    ['Notes are the same two everywhere',
     RUNNER+'\u2019s note and a Crew note. Anyone on the crew can write the Crew note, from the button underneath. Everyone sees both, on every screen that shows that stop.'],
    ['It works with no signal',
     RACE.copy.helpSignal],
    ['Three rules that end the race',
     RACE.copy.helpRules]
  ];
  /* The runner wrote this app; nobody else on the team has ever opened it. The
     first thing on their first screen says so, and goes away when they say
     it can. A modal that opens itself would sit on top of whatever they do
     next and swallow their back button. */
  function howCardHTML(){
    if(meIsRunner() || ls(KEY+'helpseen')) return '';
    return '<div class="howcard"><div><b>First time here?</b>'+
      '<span>Two minutes on how this works, then you are set for race day. '+
      'It stays under Know if you want it later.</span></div>'+
      '<div class="howcard-a"><button class="btn sm" id="howRead">Read it</button>'+
      '<button class="btn ghost sm" id="howSkip">Not now</button></div></div>';
  }
  function buildHow(){
    return '<p class="sec" style="margin-bottom:16px">Two minutes. You will not need it twice.</p>'+
      '<div class="card"><ol class="howlist">'+HOWTO.map(function(h){
        return '<li><b>'+h[0]+'</b><span>'+h[1]+'</span></li>'; }).join('')+'</ol></div>';
  }
  /* The background refresh rebuilt this list every twenty seconds, which
     re-created every card and replayed their entrance animation -- the crew
     saw the page blink at them. Build the markup, and only touch the DOM if
     it actually says something different. */
  var MYJOB_HTML=null;
  function renderMyJob(){
    var el=document.getElementById('myJob'); if(!el) return;
    var p=mePerson();
    if(!S.me){ el.innerHTML=''; MYJOB_HTML=null; return; }  /* nobody chosen yet */
    /* one plan for everyone; a crew member or pacer can narrow it to their own stops */
    var head='<div class="phead"><h1>The plan</h1><p class="sec">'+(p?esc(p.name)+', '+esc(roleLabel(p)).replace(/ \u00b7 /g,', ')+'. ':'')+'Every stop in order, with what to bring and how to get there.</p></div>';
    var html = head + howCardHTML() +
      (p && p.role==='pacer' ? pacerJobHTML(p) : '') +
      '<div class="shead tight"><h2>Goal Times</h2></div>'+
      '<div class="seg planpicker"></div>' +
      stopsListHTML();
    if(html===MYJOB_HTML){ paintHero(el); paintEtas(el); return; }  /* leave it alone */
    MYJOB_HTML=html;
    el.innerHTML = html;
    paintHero(el); paintEtas(el);
    el.querySelectorAll('[data-myleg]').forEach(function(b){
      var all=pacerLegs().filter(function(L){ return !!L.who; });
      b.onclick=function(){ openLeg(all[+b.dataset.myleg]); };
    });
    el.querySelectorAll('[data-detail]').forEach(function(b){
      b.onclick=function(){ openDetail(b.dataset.detail); };
    });
    el.querySelectorAll('[data-c]').forEach(function(b){
      b.onclick=function(){ openCrewStop(CREW[+b.dataset.c]); };
    });
    el.querySelectorAll('[data-sfilter]').forEach(function(b){
      b.onclick=function(){ MINEONLY=+b.dataset.sfilter; ls(KEY+'mineonly',String(MINEONLY)); NOW_HTML=null; renderMyJob(); renderNow(); };
    });
    renderPlanPicker();
    var es=el.querySelector('#editStops');
    if(es) es.onclick=editStops;
    var hr=el.querySelector('#howRead');
    if(hr) hr.onclick=function(){ ls(KEY+'helpseen','1'); renderMyJob(); openDetail('how'); };
    var hs=el.querySelector('#howSkip');
    if(hs) hs.onclick=function(){ ls(KEY+'helpseen','1'); renderMyJob(); };
  }

  /* ── the gate: who are you ── */
  function renderGate(){
    var el=document.getElementById('gatePicks'); if(!el) return;
    skyPaint(document.getElementById('gateSky'), now(), null);
    function pick(id,name,sub,ico,hue){
      return '<button class="pick" data-me="'+id+'">'+
        '<span class="ico'+(hue!=null?' pc'+hue:'')+'">'+(ico||'<b style="font-size:14px;font-weight:700">'+esc(initials(name))+'</b>')+'</span>'+
        '<span class="tx"><b>'+esc(name)+'</b><span>'+esc(sub)+'</span></span>'+
        '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>';
    }
    var team=sortedPeople().map(function(p){
      return pick(p.id, p.name, roleLabel(p),
        '<b class="pc'+personHue(p.id)+'" style="font-size:14px;font-weight:800;'+
        'color:color-mix(in srgb, var(--pc) 82%, #0A130F)">'+esc(initials(p.name))+'</b>',
        personHue(p.id));
    }).join('');
    el.innerHTML =
      pick(ME_RUNNER,RUNNER,'Running it','<svg viewBox="0 0 24 24"><path d="M3 17l5-7 4 4 4-8 5 11"/></svg>') +
      (team || '<p class="cap" style="margin:10px 2px">The team list has not reached this phone yet. '+
               (SUPA&&SUPA.url?'It arrives with the first sync — give it a moment, or ask '+RUNNER+' to re-share the link.':'Add your crew and pacers in Profile.')+'</p>');
    el.querySelectorAll('[data-me]').forEach(function(b){
      b.onclick=function(){ setMe(b.dataset.me); };
    });
  }
  /* the gate's sky ends wherever the race name does, plus room for the ridge */
  function gateFit(){
    var sky=document.getElementById('gateSky'), sec=document.querySelector('#gate .sec'); if(!sky||!sec) return;
    sky.style.height=(sec.offsetTop+sec.offsetHeight+168)+'px';
  }
  function setMe(id){
    S.me=id; save();
    document.getElementById('gate').classList.remove('on'); syncScrollLock();
    startApp();
  }
  function openGate(){
    renderGate();
    document.getElementById('gate').classList.add('on');
    gateFit();
    window.scrollTo(0,0); syncScrollLock();
  }

  /* ── pacer ── */
  function myPacer(){ if(!S.me) return null;
    for(var i=0;i<S.people.length;i++) if(S.people[i].id===S.me&&S.people[i].role==='pacer') return S.people[i];
    return null; }
  /* Which SECTIONS a leg [from.mi, to.mi] actually crosses -- computed from
     the leg's own miles rather than a fixed list, since a custom leg from
     the Pacer plan tab can span any combination of the five legal blocks. */
  function sectionsForLeg(L){
    return SECTIONS.filter(function(s){ return s.from<L.to.mi && s.to>L.from.mi; });
  }
  function renderPacer(){
    var fp=document.getElementById('followPacer'); if(fp) fp.innerHTML=followCard();
    var me=myPacer(), pacers=peopleFor('pacer'), el=document.getElementById('p-leg');
    var allLegs=pacerLegs().filter(function(L){ return !!L.who; });
    if(!me){
      el.innerHTML='<div class="phead"><h1>Which leg are you on?</h1><p class="sec">'+
        (pacers.length?'Tap your name.':'Nobody has been added yet. Assign blocks on the Pacer plan screen, or ask '+RUNNER+' to re-share the link.')+'</p></div>'+
        (pacers.length?'<div class="list">'+pacers.map(function(p){
          var mine=legsForPerson(p.id);
          var dt=mine.length?mine.map(function(L){return L.mi.toFixed(1)+' mi';}).join(' + '):'Not yet assigned';
          return '<button class="item" data-me="'+p.id+'"><div class="lead">'+esc(initials(p.name))+'</div>'+
            '<div class="mid"><div class="nm">'+esc(p.name)+'</div><div class="dt">'+dt+'</div></div>'+CHEV+'</button>';
        }).join('')+'</div><div class="shead"><h2>Or read a leg</h2></div>':'')+
        '<div class="list">'+allLegs.map(function(L,li){
          var nar=legNarrative(L);
          return '<button class="item" data-leg="'+li+'"><div class="lead num">'+(li+1)+'</div>'+
            '<div class="mid"><div class="nm">'+nar.title+'</div><div class="dt">'+L.mi.toFixed(1)+' mi · '+clk(T(L.from))+' to '+clk(T(L.to))+'</div></div>'+CHEV+'</button>';
        }).join('')+(allLegs.length?'':'<p class="cap">No blocks assigned yet — set who runs what on the Pacer plan screen.</p>')+'</div>';
      document.querySelectorAll('[data-me]').forEach(function(b){ b.onclick=function(){ S.me=b.dataset.me; save(); render(); window.scrollTo(0,0); }; });
      document.querySelectorAll('[data-leg]').forEach(function(b){ b.onclick=function(){ openLeg(allLegs[+b.dataset.leg]); }; });
      document.getElementById('pacerSections').innerHTML=SECTIONS.map(accFor).join(''); bindAcc('#pacerSections');
      return;
    }
    var mine=legsForPerson(me.id);
    if(!mine.length){
      el.innerHTML='<div class="phead"><h1>'+esc(me.name)+'</h1>'+
        '<p class="sec">Not assigned to a block yet — set it on the Pacer plan screen.</p></div>'+
        '<button class="btn tint" id="notMe">I\'m someone else</button>';
      document.getElementById('notMe').onclick=function(){ S.me=null; save(); render(); window.scrollTo(0,0); };
      document.getElementById('pacerSections').innerHTML=SECTIONS.map(accFor).join(''); bindAcc('#pacerSections');
      return;
    }
    var lg=mine[0], nar=legNarrative(lg);
    var a=lg.from, b=lg.to, on=T(a), off=T(b), nm=now();
    var status = nm<on ? 'You are on in '+dur(on-nm) : (nm<off ? 'You should be out there now' : 'Your leg is done');
    el.innerHTML=
      '<div class="phead"><h1>'+esc(me.name)+(mine.length>1?' · '+mine.length+' blocks':'')+'</h1><p class="sec">'+status+'</p></div>'+
      '<div class="hero"><div class="eyebrow">Get on at</div><h2>'+a.name+'</h2>'+
      '<div class="display num">'+clk(on)+'</div>'+
      '<div class="under">'+fFull.format(new Date(START+on*MIN))+' · mile '+a.mi.toFixed(1)+'</div>'+
      '<div class="stats"><div><div class="k">Get off at</div><div class="v num">'+b.mi.toFixed(1)+' mi</div></div>'+
      '<div><div class="k">Around</div><div class="v num">'+clkDay(off)+'</div></div>'+
      '<div><div class="k">Expect</div><div class="v num">'+dur(off-on)+'</div></div></div></div>'+
      '<div class="card"><h3>'+nar.dist+' — what it is</h3><p class="sec">'+nar.body+'</p></div>'+
      '<div class="card gold"><h3>Getting there and back</h3><p class="sec">'+nar.get+'</p></div>'+
      (mine.length>1?'<div class="card"><h3>Your other blocks</h3>'+
        mine.slice(1).map(function(L){ var n2=legNarrative(L);
          return '<p class="sec">'+n2.title+' — '+L.mi.toFixed(1)+' mi, on at '+clkDay(T(L.from))+'</p>'; }).join('')+'</div>':'')+
      '<div class="card" style="padding-bottom:6px"><h3 style="margin-bottom:4px">Cutoffs on your leg</h3>'+
      STATIONS.filter(function(x){return x.mi>=a.mi&&x.mi<=b.mi&&x.cut!=null;}).map(function(x){
        return '<div class="chk" style="padding:12px 0"><div style="flex:1;min-width:0"><div class="nm" style="font-size:16px;font-weight:600">'+x.name+
          '</div><div class="cap">planned '+clkDay(T(x))+'</div></div>'+
          '<div style="text-align:right"><div class="num" style="font-weight:650;color:var(--red)">'+clk(x.cut)+'</div>'+
          '<div class="cap">cutoff</div></div></div>';
      }).join('')+'</div>'+
      '<button class="btn tint" id="notMe">I\'m someone else</button>';
    document.getElementById('notMe').onclick=function(){ S.me=null; save(); render(); window.scrollTo(0,0); };
    var covered=sectionsForLeg(lg);
    document.getElementById('pacerSections').innerHTML=
      '<div class="card gold"><p class="sec"><b>Your leg covers '+(covered.length===1?'section '+covered[0].n:'sections '+covered.map(function(s){return s.n;}).join(', '))+'.</b> The rest of the course is below if you want it.</p></div>'+
      covered.map(accFor).join('')+'<div class="shead"><h2>The rest of the course</h2></div>'+
      SECTIONS.filter(function(s){return covered.indexOf(s)<0;}).map(accFor).join('');
    bindAcc('#pacerSections');
  }
  function openLeg(lg){
    if(!lg) return;
    var nar=legNarrative(lg), a=lg.from, b=lg.to;
    sheet(nar.title,
      '<div class="metrics" style="margin-top:4px"><div><div class="k">On at</div><div class="v num">'+clkDay(T(a))+'</div></div>'+
      '<div><div class="k">Off at</div><div class="v num">'+clkDay(T(b))+'</div></div>'+
      '<div><div class="k">Expect</div><div class="v num">'+dur(T(b)-T(a))+'</div></div></div>'+
      '<p class="sec">'+nar.body+'</p>'+
      '<h4 style="font-size:15px;font-weight:650;color:var(--green-ink);margin:16px 0 5px">Getting there and back</h4><p class="sec">'+nar.get+'</p>'+
      (nar.need?'<h4 style="font-size:15px;font-weight:650;color:var(--green-ink);margin:16px 0 5px">Who you need</h4><p class="sec">'+nar.need+'</p>':''));
  }

  /* ── schedule ── */
  function allEvents(){ return EVENTS.concat(S.custom).slice().sort(function(a,b){return a.iso<b.iso?-1:1;}); }
  function renderSched(){
    var out='', day='', todayISO=new Date().toISOString().slice(0,10), nowISO=new Date().toISOString().slice(0,16), open=false;
    allEvents().forEach(function(e){
      var d=e.iso.slice(0,10);
      if(S.hidePast&&d<todayISO) return;
      if(d!==day){ day=d; if(open) out+='</div>'; out+='<div class="day">'+fFull.format(new Date(tzMs(e.iso)))+'</div><div class="card">'; open=true; }
      out+='<div class="ev'+(e.key?' key':'')+(e.iso<nowISO?' past':'')+'">'+
        '<div class="tm num">'+tOf(new Date(tzMs(e.iso)))+'</div>'+
        '<div class="bd"><div class="t">'+esc(e.t)+'</div>'+(e.d?'<div class="d">'+esc(e.d)+'</div>':'')+'</div>'+
        (e.id?'<button class="edit" data-ev="'+e.id+'">Edit</button>':'')+'</div>';
    });
    if(open) out+='</div>';
    document.getElementById('schedList').innerHTML=out||'<div class="card"><div class="empty">Nothing left to show.</div></div>';
    document.getElementById('hidePast').textContent=S.hidePast?'Show all days':'Hide past days';
    document.querySelectorAll('[data-ev]').forEach(function(b){ b.onclick=function(){ editEvent(b.dataset.ev); }; });
  }
  function editEvent(id){
    var e=null; for(var i=0;i<S.custom.length;i++) if(S.custom[i].id===id) e=S.custom[i];
    var iso=e?e.iso:'2026-09-17T15:00';
    sheet(e?'Edit item':'Add to the schedule',
      '<div class="fld"><label>What is it?</label><input id="evT" value="'+(e?esc(e.t):'')+'" placeholder="Airbnb check-in"></div>'+
      '<div class="fld two"><div><label>Day</label><input type="date" id="evD" value="'+iso.slice(0,10)+'"></div>'+
      '<div><label>Time</label><input type="time" id="evH" value="'+iso.slice(11,16)+'"></div></div>'+
      '<div class="fld"><label>Notes <span style="font-weight:400;color:var(--text-3)">optional</span></label>'+
      '<textarea id="evN" placeholder="Address, door code, who to call">'+(e?esc(e.d):'')+'</textarea></div>'+
      '<button class="btn" id="evSave">Save</button>'+(e?'<button class="btn danger" id="evDel">Delete this</button>':''));
    document.getElementById('evSave').onclick=function(){
      var t=document.getElementById('evT').value.trim(), d=document.getElementById('evD').value, h=document.getElementById('evH').value;
      if(!t||!d||!h) return;
      var rec={id:e?e.id:'c'+Date.now(),iso:d+'T'+h,t:t,d:document.getElementById('evN').value.trim()};
      if(e) S.custom=S.custom.map(function(x){return x.id===e.id?rec:x;}); else S.custom.push(rec);
      save(); markDirty(); closeSheet(); renderSched();
    };
    if(e) document.getElementById('evDel').onclick=function(){
      S.custom=S.custom.filter(function(x){return x.id!==e.id;}); save(); markDirty(); closeSheet(); renderSched(); };
  }

  /* ── sheet ── */
  var modal=document.getElementById('modal'), shEl=document.getElementById('sheet');

  /* ── scroll position: remembered per tab, pinned under overlays ──
     No counter. A counter that gets out of balance leaves the page
     permanently unscrollable, which is a far worse bug than the one being
     fixed, so this derives what it should be from the overlays themselves
     and is safe to call as often as you like. */
  var LOCKY=0, TABY={}, DETAILY=0;
  /* the browser restores its own recorded offset on a back navigation, and it
     does so after popstate runs -- which silently undid every position this
     app tried to restore. The app owns scroll position now. */
  try{ if('scrollRestoration' in history) history.scrollRestoration='manual'; }catch(e){}
  function syncScrollLock(){
    var g=document.getElementById('gate'), f=document.getElementById('mapFull');
    var want = modal.classList.contains('on') ||
               (g && g.classList.contains('on')) ||
               (f && f.classList.contains('on'));
    var have = document.body.classList.contains('locked');
    if(!!want === have) return;
    if(want){
      LOCKY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = (-LOCKY)+'px';
      document.body.classList.add('locked');
    } else {
      document.body.classList.remove('locked');
      document.body.style.top = '';
      window.scrollTo(0, LOCKY);
    }
  }
  function sheet(title, html){
    shEl.innerHTML='<div class="sh-top"><div class="grip"></div>'+
      '<button class="sh-x" id="shX"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
      (title?'<h2 style="margin:2px 0 12px;padding-right:38px">'+esc(title)+'</h2>':'')+html;
    shEl.scrollTop=0; modal.classList.add('on'); syncScrollLock();
    document.getElementById('shX').onclick=closeSheet;
  }
  function closeSheet(){ modal.classList.remove('on'); syncScrollLock(); }

  /* Drag the sheet down by its header to dismiss. Only the header, which can
     carry touch-action:none -- starting a drag inside the scrolling body
     means competing with the scroller for the same gesture. */
  (function sheetDrag(){
    var sy=0, dy=0, on=false, id=null;
    function end(){
      if(!on) return;
      on=false; shEl.classList.remove('dragging'); shEl.style.transform='';
      if(dy>90) closeSheet();
    }
    shEl.addEventListener('pointerdown', function(e){
      var t=e.target;
      if(!t.closest || !t.closest('.sh-top')) return;
      if(t.closest('button,a,input,textarea,select')) return;
      on=true; id=e.pointerId; sy=e.clientY; dy=0;
      shEl.classList.add('dragging');
      shEl.setPointerCapture && shEl.setPointerCapture(e.pointerId);
    });
    shEl.addEventListener('pointermove', function(e){
      if(!on || e.pointerId!==id) return;
      dy=Math.max(0, e.clientY-sy);
      /* a little resistance past halfway, the way a real sheet feels */
      var shown = dy<160 ? dy : 160+(dy-160)*0.4;
      shEl.style.transform='translateY('+shown+'px)';
    });
    shEl.addEventListener('pointerup', end);
    shEl.addEventListener('pointercancel', end);
  })();

  /* Left-edge swipe to go back. Safari gives you this in a tab and takes it
     away in a home-screen app, which is the one place it is missed. */
  (function edgeBack(){
    var sx=0, sy=0, armed=false;
    document.addEventListener('touchstart', function(e){
      armed=false;
      if(!detailKey || e.touches.length!==1) return;
      var t=e.touches[0];
      if(t.clientX>26) return;
      armed=true; sx=t.clientX; sy=t.clientY;
    }, {passive:true});
    document.addEventListener('touchmove', function(e){
      if(!armed || !e.touches.length) return;
      var t=e.touches[0];
      if(t.clientX-sx>60 && Math.abs(t.clientY-sy)<40){ armed=false; history.back(); }
    }, {passive:true});
    document.addEventListener('touchend', function(){ armed=false; }, {passive:true});
  })();
  modal.onclick=function(e){ if(e.target===modal) closeSheet(); };
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape') return;
    var fm=document.getElementById('mapFull');
    if(fm&&fm.classList.contains('on')) fullMapClose(); else closeSheet();
  });
  function openSection(s){
    var pc = s.ec==='gold'?'gold':s.ec==='brick'?'red':'';
    sheet(s.title,
      '<div class="cap" style="margin:-8px 0 10px">Section '+s.n+' of 12 · '+s.sub+'</div>'+
      '<div class="pills" style="margin-bottom:13px"><span class="pill '+pc+'">'+s.effort+'</span>'+
      '<span class="pill grey">'+(s.to-s.from).toFixed(1)+' miles</span>'+
      (s.gain?'<span class="pill grey">'+s.gain.toLocaleString()+' ft up</span>':'')+
      '<span class="pill grey">'+ft(cumGain(s.to))+' ft by the end</span></div>'+
      metrics(s)+
      noteUnitHTML('sec',s.n)+
      s.body);
  }


  /* ── cumulative climb ──
     Segment gross-gain figures come from the tracker. Within a segment the
     gain is spread across the positive deltas of the drawn profile, so the
     curve is monotonic and consistent with the station totals. */
  function cumGain(mi){
    var total=0;
    for(var i=1;i<STATIONS.length;i++){
      var a=STATIONS[i-1], b=STATIONS[i];
      if(mi>=b.mi){ total+=b.gain||0; continue; }
      var up=0, upTo=0;
      for(var j=1;j<PROFILE.length;j++){
        var p0=PROFILE[j-1], p1=PROFILE[j];
        if(p1[0]<=a.mi||p0[0]>=b.mi) continue;
        var d=Math.max(0,p1[1]-p0[1]); up+=d;
        if(p1[0]<=mi) upTo+=d;
        else if(p0[0]<mi&&p1[0]>p0[0]) upTo+=d*((mi-p0[0])/(p1[0]-p0[0]));
      }
      total += up>0 ? (b.gain||0)*(upTo/up) : (b.gain||0)*((mi-a.mi)/(b.mi-a.mi));
      break;
    }
    return Math.round(total);
  }
  function ft(n){ return Math.round(n).toLocaleString(); }

  
/* ── notes ── */


  /* ═══════════════ COURSE MAP ═══════════════
     Drawn as vector from the GPX, not tiles — a tile map is useless on
     Buffalo Pass with no signal, and this is the one thing they will want
     up there. Equirectangular with a cos(lat) correction, which is fine
     over eleven miles. */
  /* ═══════════════ COURSE MAP ═══════════════
     Vector route from the GPX with optional tile basemaps. Pannable and
     zoomable; tiles are an online extra and the route still draws without
     them, which is the state that matters on Buffalo Pass.

     Three jobs: read the course, plan crew and pacers against it, and play
     the whole thing back on a screen at the pre-race meeting. */
  var MAPV = { lens:'aid', step:-1, base:'satellite', view:null, play:false, timer:null, t:0, dwell:7000 };

  var BASES = {
    satellite: { label:'Satellite',
                 url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                 credit:'Esri, Maxar, Earthstar Geographics', dark:true, max:19 },
    imgtopo:   { label:'Hybrid',
                 url:'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
                 credit:'USGS The National Map', dark:true, max:16 },
    trails:    { label:'Terrain',
                 url:'https://tile.opentopomap.org/{z}/{x}/{y}.png',
                 credit:'OpenTopoMap, OpenStreetMap contributors (CC-BY-SA)', max:15 },
    none:      { label:'Plain', url:null }
  };

  /* unit Web Mercator: 0..1 across the world, so zoom is just a scale factor */
  function mx(lon){ return (lon+180)/360; }
  function my(lat){
    var s=Math.max(-0.9999,Math.min(0.9999,Math.sin(lat*Math.PI/180)));
    return 0.5-Math.log((1+s)/(1-s))/(4*Math.PI);
  }
  function ilon(x){ return x*360-180; }
  function ilat(y){ var t=Math.exp((0.5-y)*4*Math.PI); return Math.asin((t-1)/(t+1))*180/Math.PI; }

  function boundsOf(pts){
    var src=(pts&&pts.length>3)?pts:ROUTE, x0=1,x1=0,y0=1,y1=0;
    src.forEach(function(p){
      var x=mx(p[2]), y=my(p[1]);
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    });
    return {x0:x0,x1:x1,y0:y0,y1:y1};
  }
  /* biasFrac: fraction of H that a bottom sheet covers on phones, where the
     sheet overlays the canvas instead of sitting beside it. Without this the
     "whole course" fit centres the route in the full canvas height and most
     of it lands under the sheet, invisible until you pan — the map opened
     to what looked like a blank screen. Fitting against the visible slice
     and shifting the centre up so the route lands there instead. */
  function fitView(W,H,pad,pts,biasFrac){
    var b=boundsOf(pts);
    var dx=Math.max(1e-9,b.x1-b.x0), dy=Math.max(1e-9,b.y1-b.y0);
    var Hv=biasFrac?Math.max(60,H*(1-biasFrac)):H;
    var z=Math.max(1,Math.min(17,Math.log2(Math.min((W-pad*2)/dx,(Hv-pad*2)/dy)/256)));
    var midY=(b.y0+b.y1)/2, lat=ilat(midY);
    if(biasFrac && Hv<H){
      var n=256*Math.pow(2,z);
      lat=ilat(midY + (H-Hv)/(2*n));
    }
    return { lat:lat, lon:ilon((b.x0+b.x1)/2), z:z };
  }
  function projector(W,H,v){
    var n=256*Math.pow(2,v.z);
    var ox=W/2-mx(v.lon)*n, oy=H/2-my(v.lat)*n;
    return { z:v.z, n:n, ox:ox, oy:oy,
      X:function(lon){ return mx(lon)*n+ox; },
      Y:function(lat){ return my(lat)*n+oy; },
      lonAt:function(px){ return ilon((px-ox)/n); },
      latAt:function(py){ return ilat((py-oy)/n); },
      mPerPx:156543.03392*Math.cos(v.lat*Math.PI/180)/Math.pow(2,v.z) };
  }
  function tilesForBox(P,x0px,y0px,x1px,y1px,base,dzAdj){
    var b=BASES[base]||{}; if(!b.url) return [];
    var cap=b.max||17;
    var tz=Math.min(cap, Math.max(0, Math.round(P.z)+1-(dzAdj||0)));
    var size=P.n/Math.pow(2,tz), max=Math.pow(2,tz), out=[];
    var t0x=Math.floor((x0px-P.ox)/size), t1x=Math.floor((x1px-P.ox)/size);
    var t0y=Math.floor((y0px-P.oy)/size), t1y=Math.floor((y1px-P.oy)/size);
    if((t1x-t0x+1)*(t1y-t0y+1)>320) return tilesForBox(P,x0px,y0px,x1px,y1px,base,(dzAdj||0)+1);
    for(var x=t0x;x<=t1x;x++) for(var y=t0y;y<=t1y;y++){
      if(x<0||y<0||x>=max||y>=max) continue;
      out.push({x:x,y:y,z:tz,size:size,left:x*size+P.ox,top:y*size+P.oy});
    }
    return out;
  }
  function tileURL(base,z,x,y){
    var b=BASES[base]; if(!b||!b.url) return null;
    return b.url.replace('{z}',z).replace('{x}',x).replace('{y}',y);
  }
  /* Reconcile the tile layer against the DOM instead of tearing it down and
     rebuilding it on every pan, zoom and preview recentre. A tile keyed by
     z/x/y that is already on screen keeps its <img> element — and its
     already-decoded bitmap — and just gets repositioned; only tiles that
     scrolled out of the overscan area are removed. That is what stopped
     panning and the preview follow-cam flashing blank on every redraw. */
  function paintTiles(container,tiles,base,ox,oy){
    if(container.dataset.base!==base){ container.innerHTML=''; container.dataset.base=base; }
    var existing={};
    Array.prototype.forEach.call(container.children,function(img){ existing[img.dataset.tk]=img; });
    var want={};
    tiles.forEach(function(t){
      var k=t.z+'/'+t.x+'/'+t.y; want[k]=1;
      var img=existing[k];
      if(!img){
        img=document.createElement('img');
        img.dataset.tk=k; img.decoding='async';
        img.style.position='absolute'; img.style.opacity='0'; img.style.transition='opacity .2s ease';
        img.onload=function(){ img.style.opacity='1'; };
        img.onerror=function(){ img.style.visibility='hidden'; };
        img.src=tileURL(base,t.z,t.x,t.y);
        container.appendChild(img);
        existing[k]=img;
      }
      img.style.left=(t.left+ox).toFixed(2)+'px'; img.style.top=(t.top+oy).toFixed(2)+'px';
      img.style.width=t.size.toFixed(2)+'px'; img.style.height=t.size.toFixed(2)+'px';
    });
    Object.keys(existing).forEach(function(k){ if(!want[k]){ container.removeChild(existing[k]); } });
  }
  function routeSlice(a,b){ return ROUTE.filter(function(p){ return p[0]>=a-0.06 && p[0]<=b+0.06; }); }
  /* Quadratic-bezier smoothing: each original GPX point becomes a control
     point and the curve passes through the midpoints between consecutive
     points. One pass, no matrix solve, and it never moves the line more
     than half a segment (route points sit ~0.12 mi apart) off the actual
     GPX — it just rounds off the faceted look raw polylines get on tight
     switchbacks like the Grouse and Fish Creek Falls climbs. */
  function smoothD(px){
    if(px.length<2) return '';
    if(px.length===2) return 'M'+px[0][0].toFixed(1)+','+px[0][1].toFixed(1)+'L'+px[1][0].toFixed(1)+','+px[1][1].toFixed(1);
    var d='M'+px[0][0].toFixed(1)+','+px[0][1].toFixed(1);
    for(var i=1;i<px.length-1;i++){
      var xc=(px[i][0]+px[i+1][0])/2, yc=(px[i][1]+px[i+1][1])/2;
      d+='Q'+px[i][0].toFixed(1)+','+px[i][1].toFixed(1)+' '+xc.toFixed(1)+','+yc.toFixed(1);
    }
    var last=px[px.length-1];
    d+='L'+last[0].toFixed(1)+','+last[1].toFixed(1);
    return d;
  }
  function projPts(pts,X,Y){ return pts.map(function(p){ return [X(p[2]),Y(p[1])]; }); }
  function pathOf(pts,P){
    if(!pts.length) return '';
    return smoothD(projPts(pts,P.X,P.Y));
  }
  /* ROUTE points sit about 0.12 mi apart; snapping to the nearest one makes
     the dot tick along in visible steps. Interpolate instead. */
  function routeLerp(mi){
    if(mi<=ROUTE[0][0]) return [ROUTE[0][1],ROUTE[0][2]];
    for(var i=1;i<ROUTE.length;i++){
      if(mi<=ROUTE[i][0]){
        var a=ROUTE[i-1], b=ROUTE[i];
        var f=(b[0]>a[0])?(mi-a[0])/(b[0]-a[0]):0;
        return [ a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f ];
      }
    }
    var L=ROUTE[ROUTE.length-1]; return [L[1],L[2]];
  }
  function routeAt(mi){
    var best=9, pt=null;
    ROUTE.forEach(function(p){ var d=Math.abs(p[0]-mi); if(d<best){best=d;pt=p;} });
    return pt;
  }

  function legInto(i){
    if(i<=0) return null;
    var A=STATIONS[i-1], B=STATIONS[i], sec=null;
    for(var k=0;k<SECTIONS.length;k++) if(B.mi>SECTIONS[k].from && B.mi<=SECTIONS[k].to) sec=SECTIONS[k];
    return { from:A, to:B, mi:+(B.mi-A.mi).toFixed(1), gain:B.gain||0, mins:T(B)-T(A), sec:sec };
  }
  /* The leg ahead of a station -- what's coming, not how you got here.
     Mirrors legInto but looks forward one stop. The finish has none. */
  function legOutOf(i){
    if(i<0 || i>=STATIONS.length-1) return null;
    var A=STATIONS[i], B=STATIONS[i+1], sec=null;
    for(var k=0;k<SECTIONS.length;k++) if(B.mi>SECTIONS[k].from && B.mi<=SECTIONS[k].to) sec=SECTIONS[k];
    return { from:A, to:B, mi:+(B.mi-A.mi).toFixed(1), gain:B.gain||0, mins:T(B)-T(A), sec:sec };
  }
  /* Which pacer leg covers a mile, so the planner can name who is with him. */
  function crewStopFor(mi){
    for(var c=0;c<CREW.length;c++) if(CREW[c].mi===mi) return CREW[c];
    return null;
  }

  function drawMap(hostId){
    var host=document.getElementById(hostId||'mapHost'); if(!host) return;
    var full=(host.id==='mapHostF');
    var W=Math.max(300, host.clientWidth||360);
    var H=full ? Math.max(220, host.clientHeight||420) : (W<500?340:420);
    if(!full) host.style.height=H+'px';

    /* full screen frames the selected leg; inline keeps the whole course */
    /* No auto-zoom on selection: the highlight tells you which leg it is and
       the wider view keeps you oriented. Zoom stays under your control. */
    var sheetBias = (full && typeof window!=='undefined' && window.innerWidth<820) ? 0.5 : 0;
    var v=MAPV.view || fitView(W,H,full?34:16,null,sheetBias);
    if(full) MAPV.fitZ=fitView(W,H,34,null,sheetBias).z;
    var P=projector(W,H,v);
    MAPV.P=P; MAPV.W=W; MAPV.H=H; MAPV.host=host.id;

    /* Overscan: draw a canvas bigger than the viewport in every direction so
       the preview can translate a long way before anything is re-rendered.
       Re-rendering is what made it jump, and refetching tiles is what left
       blank patches. */
    var OX = full ? Math.round(W*0.75) : 0, OY = full ? Math.round(H*0.75) : 0;
    MAPV.OX=OX; MAPV.OY=OY;
    var b=BASES[MAPV.base], onDark=!!b.dark;
    var tiles=tilesForBox(P,-OX,-OY,W+OX,H+OY,MAPV.base);

    var C={ green:cv('--green','#1B5340'), gold:cv('--gold-solid','#B5801E'), red:cv('--red','#8E2F1D'),
            dim:cv('--text-3','#879289'), card:cv('--card','#fff'), ink:cv('--text','#13201A'),
            trail:cv('--trail','#FFFFFF'), trailPreview:cv('--trail-preview','#C1432E') };
    var halo=onDark?'rgba(0,0,0,.55)':'rgba(255,255,255,.85)';
    /* Browsing: a plain white line reads against every basemap without a
       colour of its own competing with the terrain. Previewing: the route
       switches to a distinct warm colour -- the same family as the live
       position dot below -- so it's obvious at a glance that this is the
       walkthrough, not the static course map. Because the line itself is
       now sometimes white, the halo has to be dark instead of the old
       always-white halo, or a white line on a white halo would vanish. */
    var trailHalo='rgba(20,26,22,.55)';
    var step=MAPV.step, seg=null;
    if(PV.on){
      /* the highlight follows the runner: the leg being run right now, not
         the one just finished */
      seg=[ PV.at>=0 ? STATIONS[PV.at].mi : 0,
            (PV.at+1<STATIONS.length) ? STATIONS[PV.at+1].mi : COURSE_MI ];
    } else if(step>=0 && step<STATIONS.length-1){
      seg=[STATIONS[step].mi, STATIONS[step+1].mi];   // browse: the leg ahead
    } else if(step===STATIONS.length-1){
      seg=[STATIONS[step-1].mi, STATIONS[step].mi];   // finish has no ahead
    }
    var o=[];

    o.push('<path d="'+pathOf(ROUTE,P)+'" fill="none" stroke="'+trailHalo+'" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round" opacity="'+(focus?'.6':'1')+'"/>');

    /* One continuous route line, browsing or previewing alike -- matches
       Rock Hawk exactly: no separate "ground covered" tone during preview.
       That was tried there and pulled (it only repaints at station
       boundaries, so it visibly lagged the dot) -- same reasoning applies
       here, so it isn't reintroduced. The whole route drops to 28% whenever
       a leg is highlighted; the highlighted leg gets its own halo+gold pass
       below, in both modes. Preview swaps the line to its own colour so the
       two modes are never visually ambiguous. */
    o.push('<path d="'+pathOf(ROUTE,P)+'" fill="none" stroke="'+(PV.on?C.trailPreview:C.trail)+'" stroke-opacity="'+(seg?'.28':'.95')+
      '" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>');

    if(seg) o.push('<path d="'+pathOf(routeSlice(seg[0],seg[1]),P)+'" fill="none" stroke="'+trailHalo+
      '" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>');
    if(seg) o.push('<path d="'+pathOf(routeSlice(seg[0],seg[1]),P)+'" fill="none" stroke="'+C.gold+
      '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>');
    /* pacer coverage sits on top of everything, including a selected leg,
       because when that lens is on it is the thing being read */
    if(MAPV.lens==='pacer'){
      var PAL=['#1B5340','#8A5A0B','#3E6E8E','#6B4E8E','#2E7A5E'];
      o.push('<path d="'+pathOf(ROUTE,P)+'" fill="none" stroke="'+halo+
        '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>');
      o.push('<path d="'+pathOf(routeSlice(0,PACER_FROM),P)+'" fill="none" stroke="'+C.red+
        '" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 9"/>');
      pacerLegs().forEach(function(L,li){
        o.push('<path d="'+pathOf(routeSlice(L.from.mi,L.to.mi),P)+'" fill="none" stroke="'+
          (L.who?PAL[li%PAL.length]:C.dim)+'" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"'+
          (L.who?'':' stroke-dasharray="10 7"')+'/>');
      });
    }

    /* Every leg of the line is a tap target: click the trail between two
       stations and the panel opens that leg. Selecting station i is the
       right target because its panel leads with "the leg ahead", which is
       exactly this stretch. Drawn after the decorative paths so nothing
       painted on top can swallow the click, but before the station markers
       so a tap near a station still belongs to the station. */
    for(var li=0; li<STATIONS.length-1; li++){
      var hs=routeSlice(STATIONS[li].mi, STATIONS[li+1].mi);
      if(!hs || hs.length<2) continue;
      o.push('<path class="mseg" data-mseg="'+li+'" d="'+pathOf(hs,P)+'" fill="none" '+
        'stroke="transparent" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" '+
        'pointer-events="stroke"><title>'+esc(STATIONS[li].name)+' → '+
        esc(STATIONS[li+1].name)+'</title></path>');
    }

    /* Eight aid stations are visited twice at the same spot, so drawing one
       marker per STATIONS entry stamped every label twice — that was the
       ghosting over satellite. Group by place, draw once, label once. */
    var places={};
    STATIONS.forEach(function(s,i){
      var pt=routeAt(s.mi); if(!pt) return;
      var key=s.name;
      if(!places[key]) places[key]={ name:s.name, pt:pt, idx:[], mis:[] };
      places[key].idx.push(i); places[key].mis.push(s.mi);
    });
    var labels=[];
    Object.keys(places).forEach(function(key){
      var g=places[key], s=STATIONS[g.idx[0]];
      var x=P.X(g.pt[2]), y=P.Y(g.pt[1]);
      if(x<-40||x>W+40||y<-40||y>H+40) return;
      var anyCrew=g.idx.some(function(i){return !!STATIONS[i].crew;});
      var anyPacer=g.idx.some(function(i){return !!STATIONS[i].pacer;});
      var anyBag=g.idx.some(function(i){return !!STATIONS[i].bag;});
      var big = MAPV.lens==='crew' ? anyCrew : MAPV.lens==='pacer' ? anyPacer : !!s.major;
      var col = MAPV.lens==='crew' ? (anyCrew?C.green:C.dim)
              : MAPV.lens==='pacer' ? (anyPacer?C.gold:C.dim) : stationColour(s);
      var on = g.idx.indexOf(step)>=0;
      var r = on?9:(big?7:4);
      if(!big && MAPV.lens!=='aid' && !on){
        o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3.5" fill="'+col+'" opacity=".5" stroke="'+halo+'" stroke-width="2"/>');
      } else {
        o.push('<ellipse cx="'+x.toFixed(1)+'" cy="'+(y+r*0.55).toFixed(1)+'" rx="'+(r*0.85).toFixed(1)+'" ry="'+(r*0.32).toFixed(1)+'" fill="rgba(0,0,0,.22)"/>');
        o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(r+3)+'" fill="'+halo+'"/>');
        o.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r+'" fill="'+col+'"'+
          (on?' stroke="'+C.ink+'" stroke-width="2"':'')+'/>');
        if(g.idx.length>1) o.push('<circle cx="'+(x+r+2).toFixed(1)+'" cy="'+(y-r-1).toFixed(1)+
          '" r="6" fill="'+C.card+'" stroke="'+col+'" stroke-width="1.6"/>'+
          '<text x="'+(x+r+2).toFixed(1)+'" y="'+(y-r+2.4).toFixed(1)+'" font-size="8.5" font-weight="750" '+
          'text-anchor="middle" font-family="'+FF+'" fill="'+col+'">2</text>');
      }
      if(on) o.push('<circle class="pv-pulse" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="17" fill="none" stroke="'+C.gold+'" stroke-width="2" opacity=".7"/>');
      if(big||on) labels.push([x,y,g.name.replace(' \u2014 Ski Basin','').replace(' Hall',''),col]);
      /* tapping cycles through the visits to this place */
      var nextIdx = on ? g.idx[(g.idx.indexOf(step)+1)%g.idx.length] : g.idx[0];
      o.push('<circle data-mst="'+nextIdx+'" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="18" fill="transparent" style="cursor:pointer"/>');
    });
    labels.forEach(function(L){
      var tx=Math.min(Math.max(L[0],34),W-34);
      o.push('<text x="'+tx.toFixed(1)+'" y="'+(L[1]-18).toFixed(1)+'" font-size="11.5" font-weight="700" '+
        'text-anchor="middle" font-family="'+FF+'" stroke="'+halo+'" stroke-width="2.6" paint-order="stroke" fill="'+
        (onDark?'#fff':C.ink)+'">'+esc(L[2])+'</text>');
    });

    /* the runner: a travelling dot during playback, live position otherwise */
    var mark=null;
    if(PV.on){ mark=PV.mi; }
    else {
      var nm=now();
      if(nm>0&&nm<RACE.limit+120){
        var L=livePos(); mark=L.state==='station'?L.station.mi:(L.mi!=null?L.mi:mileAt(nm));
      }
    }
    if(mark!=null){
      var mp=routeLerp(mark);
      if(mp){
        var mkx=P.X(mp[1]), mky=P.Y(mp[0]);
        /* heading: bearing between a point a little behind and a little
           ahead on the route, in screen space, so it rotates correctly
           under any projection. */
        var ahd=routeLerp(Math.min(COURSE_MI,mark+0.15)), bhd=routeLerp(Math.max(0,mark-0.15));
        var heading=0;
        if(ahd&&bhd) heading=Math.atan2(P.Y(ahd[0])-P.Y(bhd[0]), P.X(ahd[1])-P.X(bhd[1]))*180/Math.PI;
        o.push('<circle id="pvHalo" class="pv-pulse" cx="'+mkx.toFixed(2)+'" cy="'+mky.toFixed(2)+'" r="16" fill="'+C.red+'" opacity=".22"/>');
        o.push('<g id="pvHead" transform="translate('+mkx.toFixed(2)+','+mky.toFixed(2)+') rotate('+heading.toFixed(1)+')">'+
          '<path d="M14,0 L3,-6 L3,6 Z" fill="'+C.red+'" opacity=".85" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></g>');
        o.push('<circle id="pvDot" cx="'+mkx.toFixed(2)+'" cy="'+mky.toFixed(2)+'" r="7.5" fill="'+C.red+
          '" stroke="#fff" stroke-width="3"/>');
      }
    }

    var mile=1609.344/P.mPerPx;
    /* on the wide/standing-panel layout the floating scrubber bar sits over
       the bottom of the canvas, not below it like on a phone — H-16 would
       land the scale bar half-hidden behind it. */
    var scaleY = full ? (H-92) : (H-16);
    if(mile>18 && mile<W*0.8)
      o.push('<g><line x1="14" y1="'+scaleY+'" x2="'+(14+mile).toFixed(1)+'" y2="'+scaleY+'" stroke="'+
        (onDark?'#fff':C.ink)+'" stroke-width="3" stroke-linecap="round" opacity=".8"/>'+
        '<text x="'+(18+mile).toFixed(1)+'" y="'+(scaleY-4)+'" font-size="11" font-family="'+FF+'" stroke="'+halo+
        '" stroke-width="2.4" paint-order="stroke" fill="'+(onDark?'#fff':C.ink)+'">1 mile</text></g>');

    var CW=W+OX*2, CH=H+OY*2;
    var world=host.querySelector('.mapworld');
    if(!world){
      host.innerHTML='<div class="mapworld"><div class="tiles" style="position:absolute;inset:0"></div>'+
        '<svg class="mapsvg" style="position:absolute;left:0;top:0"></svg></div>';
      world=host.querySelector('.mapworld');
    }
    world.style.left=(-OX)+'px'; world.style.top=(-OY)+'px'; world.style.width=CW+'px'; world.style.height=CH+'px';
    paintTiles(world.querySelector('.tiles'), tiles, MAPV.base, OX, OY);
    var svgEl=world.querySelector('.mapsvg');
    svgEl.setAttribute('viewBox',(-OX)+' '+(-OY)+' '+CW+' '+CH);
    svgEl.setAttribute('width',CW); svgEl.setAttribute('height',CH);
    svgEl.innerHTML=o.join('');
    bindMapGestures(host, full);
  }

  /* Drag to pan, wheel or pinch to zoom. During a drag the layers are simply
     translated and only committed on release, which keeps it smooth without
     re-rendering 838 points per frame. */
  function bindMapGestures(host, full){
    /* Wire each host ONCE. drawMap() calls this on every repaint, and it used
       to rebuild the gesture closure each time -- so a repaint between
       pointerdown and pointerup (which the preview does constantly, animating
       the dot) swapped in fresh handlers with start=null and the tap was
       swallowed. The handlers outlive repaints now; .mapworld is looked up
       live instead of captured, since a repaint can replace that node. */
    if(host.__gestWired) return;
    host.__gestWired=true;
    var pts={}, start=null, moved=false, base=null, pinch=null;
    function shift(dx,dy,sc){
      var t='translate3d('+dx+'px,'+dy+'px,0)'+(sc?' scale('+sc+')':'');
      var world=host.querySelector('.mapworld');
      if(world) world.style.transform=t;
    }
    function commit(dx,dy,dz){
      var P=MAPV.P, n=P.n;
      /* While previewing, the camera belongs to the dot. Panning is ignored
         and a zoom re-frames on the runner, so a stray drag can never leave
         the projector and the follow maths disagreeing about where he is. */
      if(PV.on){ shift(0,0); if(dz) pvZoom(dz); return; }
      var cx=(MAPV.W/2-P.ox-dx)/n, cy=(MAPV.H/2-P.oy-dy)/n;
      var v={ lat:ilat(cy), lon:ilon(cx), z:Math.max(1,Math.min(17,P.z+(dz||0))) };
      MAPV.view=v; shift(0,0);
      drawMap(host.id);
      if(full){ fullMapHud(); fullMapSheet(); }
    }
    host.onpointerdown=function(e){
      /* stop the browser starting a text selection that then sweeps the
         whole page blue as the finger moves. preventDefault also stops focus
         moving, so blur anything focused by hand or a note keeps the preview
         frozen after you tap back onto the map. */
      e.preventDefault();
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.body.classList.add('mapdrag');
      if(window.getSelection) try{ window.getSelection().removeAllRanges(); }catch(x){}
      pts[e.pointerId]=[e.clientX,e.clientY];
      if(Object.keys(pts).length===2){
        var k=Object.keys(pts), a=pts[k[0]], b2=pts[k[1]];
        pinch={ d:Math.hypot(a[0]-b2[0],a[1]-b2[1]) };
      } else { start=[e.clientX,e.clientY]; moved=false; }
      host.setPointerCapture&&host.setPointerCapture(e.pointerId);
    };
    host.onpointermove=function(e){
      if(!(e.pointerId in pts)) return;
      pts[e.pointerId]=[e.clientX,e.clientY];
      var ids=Object.keys(pts);
      if(ids.length===2&&pinch){
        var a=pts[ids[0]], b2=pts[ids[1]];
        var d=Math.hypot(a[0]-b2[0],a[1]-b2[1]);
        pinch.scale=d/pinch.d; shift(0,0,pinch.scale); moved=true; return;
      }
      if(!start) return;
      var dx=e.clientX-start[0], dy=e.clientY-start[1];
      if(Math.abs(dx)>5||Math.abs(dy)>5) moved=true;
      if(!PV.on) shift(dx,dy);
    };
    /* Selecting by coordinate rather than by a listener on the shape.
       host.setPointerCapture() retargets every later pointer event -- and the
       click the browser derives from them -- to the host, so click handlers
       bound to the individual circles and paths never fire for real mouse or
       touch input. They only ever fired for synthetic dispatch, which is why
       "tap a station on the map" quietly did nothing. Hit-test the stack at
       the tap point instead: station markers sit above the leg paths, so a
       tap near a station still resolves to the station. */
    function mapPick(cx, cy, host, full){
      var stack = document.elementsFromPoint
        ? document.elementsFromPoint(cx, cy)
        : [document.elementFromPoint(cx, cy)];
      var st=null, segs=[];
      for(var i=0;i<stack.length;i++){
        var el=stack[i];
        if(!el || !el.getAttribute || !host.contains(el)) continue;
        if(st===null && el.hasAttribute('data-mst')) st=+el.getAttribute('data-mst');
        if(el.hasAttribute('data-mseg')){
          var v=+el.getAttribute('data-mseg');
          if(isFinite(v) && segs.indexOf(v)<0) segs.push(v);
        }
      }
      /* Most of this course is run twice, so a point on the line can belong
         to two legs -- out and back over the same trail. Repeated taps cycle
         through them, exactly as tapping a station cycles its two visits,
         rather than silently always picking whichever was painted last. */
      segs.sort(function(x,y){ return x-y; });
      var pick = null;
      if(st!==null) pick = st;
      else if(segs.length) pick = segs[(segs.indexOf(MAPV.step)+1) % segs.length];
      if(pick===null || !isFinite(pick)) return;
      if(PV.on) pvStop();   // a deliberate pick ends the walkthrough
      MAPV.step=pick;
      if(full){ showStation(MAPV.step); } else { MAPV.view=null; renderMap(); }
    }
    function up(e,tap){
      document.body.classList.remove('mapdrag');
      delete pts[e.pointerId];
      var ids=Object.keys(pts);
      if(pinch&&ids.length<2){
        var dz=pinch.scale?Math.log2(pinch.scale):0;
        pinch=null; start=null;
        if(dz) { commit(0,0,dz); return; }
      }
      if(start&&moved){ commit(e.clientX-start[0], e.clientY-start[1], 0); }
      else if(start && !moved && tap && !pinch){ mapPick(e.clientX, e.clientY, host, full); }
      start=null;
    }
    host.onpointerup=function(e){ up(e,true); };
    host.onpointercancel=function(e){ up(e,false); };
    host.onwheel=function(e){
      e.preventDefault();
      commit(0,0, e.deltaY>0 ? -0.45 : 0.45);
    };
  }
  function coverageStrip(){
    function seg(a,b,cls,title){
      var l=(a/COURSE_MI*100).toFixed(2), w=((b-a)/COURSE_MI*100).toFixed(2);
      return '<i class="'+cls+'" style="left:'+l+'%;width:'+w+'%" title="'+title+'"></i>';
    }
    var body='', legend='', note='';
    if(MAPV.lens==='pacer'){
      body=seg(0,PACER_FROM,'solo','Solo')+seg(PACER_FROM,COURSE_MI,'paced','Paced');
      legend='<span><i class="k solo"></i>Alone \u2014 '+PACER_FROM+' mi</span><span><i class="k paced"></i>Pacer allowed \u2014 '+(COURSE_MI-PACER_FROM).toFixed(1)+' mi</span>';
      note='Pacers cannot join until '+STATIONS[idxOf(PACER_FROM)].name+' at mile '+PACER_FROM+'. Swaps are only at the '+['zero','one','two','three','four','five','six','seven','eight','nine','ten'][SWAPS.length-1]+' gold marks.';
    } else if(MAPV.lens==='crew'){
      body=seg(0,COURSE_MI,'nocrew','No crew');
      STATIONS.forEach(function(s){ if(s.crew) body+=seg(Math.max(0,s.mi-1),Math.min(COURSE_MI,s.mi+1),'crew',s.name); });
      legend=RACE.copy.lens.crewLegend;
      note=RACE.copy.lens.crewNote;
    } else {
      body=seg(0,COURSE_MI,'nocrew','Course');
      STATIONS.forEach(function(s){ if(s.bag) body+=seg(Math.max(0,s.mi-.9),Math.min(COURSE_MI,s.mi+.9),'bag',s.name); });
      legend=RACE.copy.lens.bagLegend;
      note=RACE.copy.lens.bagNote;
    }
    var ticks=STATIONS.filter(function(s){return s.major;}).map(function(s){
      return '<b style="left:'+(s.mi/COURSE_MI*100).toFixed(2)+'%">'+s.mi.toFixed(0)+'</b>';
    }).join('');
    var pos='', nm=now();
    if(nm>0&&nm<RACE.limit+120){
      var L=livePos(), pm=L.state==='station'?L.station.mi:(L.mi!=null?L.mi:mileAt(nm));
      pos='<u style="left:'+(pm/COURSE_MI*100).toFixed(2)+'%"></u>';
    }
    return '<div class="card"><h3>'+(MAPV.lens==='pacer'?'Pacer coverage':MAPV.lens==='crew'?'Crew access':'Drop bags')+
      '</h3><p class="sec" style="margin-bottom:14px">'+note+'</p>'+
      '<div class="strip">'+body+pos+'</div><div class="stripx">'+ticks+'</div>'+
      '<div class="striplg">'+legend+'</div></div>';
  }

  /* ── pacer segments ──────────────────────────────────────────
     A pacer may only join or leave at five points, so every possible
     pacer leg is a run of consecutive atoms between them. Four of the
     five are 7–13 miles; the last is 21 with no legal swap inside it,
     which is the fact the whole plan has to be built around. */
  /* SWAPS and PACER_FROM are derived at the top of this file from STATIONS[].pacer */
  function atoms(){
    var out=[];
    for(var k=1;k<SWAPS.length;k++){
      var ai=idxOf(SWAPS[k-1]), bi=idxOf(SWAPS[k]);
      var A=STATIONS[ai], B=STATIONS[bi], gain=0;
      for(var j=ai+1;j<=bi;j++) gain+=STATIONS[j].gain||0;
      out.push({ n:k-1, from:A, to:B, ai:ai, bi:bi,
                 mi:+(B.mi-A.mi).toFixed(1), gain:gain, mins:T(B)-T(A) });
    }
    return out;
  }
  function atomWho(n){ return (S.atomWho||{})[n]||null; }
  function setAtomWho(n,id){
    S.atomWho=S.atomWho||{};
    if(id) S.atomWho[n]=id; else delete S.atomWho[n];
    save(); markDirty();
  }
  function personById(id){ for(var i=0;i<S.people.length;i++) if(S.people[i].id===id) return S.people[i]; return null; }
  /* consecutive atoms with the same person collapse into one leg */
  function pacerLegs(){
    var A=atoms(), out=[], cur=null;
    A.forEach(function(a){
      var w=atomWho(a.n);
      if(cur && cur.who===w && w){ cur.to=a.to; cur.mi=+(cur.mi+a.mi).toFixed(1);
        cur.gain+=a.gain; cur.mins+=a.mins; cur.atoms.push(a); }
      else { if(cur) out.push(cur);
        cur={ who:w, from:a.from, to:a.to, mi:a.mi, gain:a.gain, mins:a.mins, atoms:[a] }; }
    });
    if(cur) out.push(cur);
    return out;
  }
  function legsForPerson(id){ return pacerLegs().filter(function(L){ return L.who===id; }); }
  /* A custom leg someone builds in the Pacer plan tab won't always match one
     of the three spans the runner already wrote up in detail -- fall back to a
     plain, honest description built from the leg's own numbers rather than
     leaving it blank. */
  function legNarrative(L){
    var known=PACERS.filter(function(p){
      return Math.abs(p.from-L.from.mi)<0.01 && Math.abs(p.to-L.to.mi)<0.01;
    })[0];
    if(known) return known;
    var night=isNight;
    var dark=night(T(L.from))||night(T(L.to));
    var toName=L.to.mi>=COURSE_MI?'the finish':L.to.name;
    return {
      n:null, from:L.from.mi, to:L.to.mi, dist:L.mi.toFixed(1)+' miles',
      title:L.from.name+' to '+toName,
      body:L.mi.toFixed(1)+' miles from '+L.from.name+' to '+toName+', '+ft(L.gain)+
        ' ft of climbing, expect around '+dur(L.mins)+(dark?' — some or all of it in the dark':' in daylight')+'.',
      get:'See the Crew and pacers screen for directions to '+L.from.name+' and to '+toName+'.',
      need:L.mi>15?'Someone comfortable being out there a long time without a break — this leg runs long.':''
    };
  }
  function legAtMile(mi){
    var L=pacerLegs();
    for(var i=0;i<L.length;i++) if(mi>L[i].from.mi && mi<=L[i].to.mi) return L[i];
    return null;
  }
  function whoIsWith(mi){
    if(mi<PACER_FROM) return null;
    var L=legAtMile(mi);
    /* exactly on a swap point: name whoever takes over from here */
    if(!L){
      var legs=pacerLegs();
      for(var i=0;i<legs.length;i++) if(Math.abs(legs[i].from.mi-mi)<0.01) L=legs[i];
    }
    if(!L||!L.who) return null;
    return personById(L.who);
  }

  /* ── the game plan for a station: what the crew actually does ── */
  function stationPlan(i){
    var s=STATIONS[i], cs=crewStopFor(s.mi);
    return { station:s, crew:cs?crewAt(cs.n):[], any:aidHasAny(i),
             bag:!!s.bag, pacerSwap:!!s.pacer, cutoff:s.cut };
  }


  /* ── the timeline ────────────────────────────────────────────
     One horizontal axis for the whole race: drag it to move, tap a dot to
     jump to that aid station. Doubles as the progress bar during preview,
     which is why it replaced two separate controls. */
  function timelineHTML(mi, opts){
    var o=opts||{};
    var pct=Math.max(0,Math.min(100, mi/COURSE_MI*100));
    var dots=STATIONS.map(function(s,i){
      var sp=splitOf(i), gone=sp&&sp.out!=null;
      var cls='tld'+(s.crew?' crew':'')+(s.pacer?' pac':'')+(gone?' done':'')+
              (Math.abs(s.mi-mi)<0.15?' here':'');
      return '<button class="'+cls+'" data-tl="'+i+'" style="left:'+(s.mi/COURSE_MI*100).toFixed(2)+'%" '+
        'title="'+esc(s.name)+' \u00b7 mile '+s.mi.toFixed(1)+'"></button>';
    }).join('');
    var labs=STATIONS.filter(function(s){return s.major&&s.mi>0&&s.mi<COURSE_MI;}).map(function(s){
      return '<b style="left:'+(s.mi/COURSE_MI*100).toFixed(2)+'%">'+s.mi.toFixed(0)+'</b>';
    }).join('');
    /* night bands, so you can see at a glance what happens in the dark */
    var bands=RACE.dark.map(function(d){
      var a0=mileAt(d[0]), b0=mileAt(d[1]);
      if(b0<=a0) return '';
      return '<i class="night" style="left:'+(a0/COURSE_MI*100).toFixed(2)+'%;width:'+
        ((b0-a0)/COURSE_MI*100).toFixed(2)+'%"></i>';
    }).join('');
    return '<div class="tl'+(o.live?' live':'')+'">'+
      '<div class="tltrack" id="tlTrack">'+bands+
        '<i class="fill" id="tlFill" style="width:'+pct.toFixed(2)+'%"></i>'+
        dots+
        '<span class="thumb" id="tlThumb" style="left:'+pct.toFixed(2)+'%"></span>'+
      '</div>'+
      '<div class="tlx">'+labs+'<b class="s" style="left:0">0</b><b class="e" style="left:100%">'+Math.round(COURSE_MI)+'</b></div>'+
    '</div>';
  }
  function bindTimeline(root, onMile, onStation){
    var track=root.querySelector('#tlTrack'); if(!track) return;
    var dragging=false;
    function miFrom(clientX){
      var r=track.getBoundingClientRect();
      return Math.max(0, Math.min(COURSE_MI, (clientX-r.left)/r.width*COURSE_MI));
    }
    /* A drag may well start on top of a dot, so never swallow pointerdown.
       Decide between "tapped a station" and "scrubbed" on release. */
    var startX=0, moved=false, hitDot=null;
    track.addEventListener('pointerdown',function(e){
      dragging=true; moved=false; startX=e.clientX;
      hitDot=(e.target.dataset && e.target.dataset.tl!==undefined) ? +e.target.dataset.tl : null;
      track.setPointerCapture&&track.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    track.addEventListener('pointermove',function(e){
      if(!dragging) return;
      if(Math.abs(e.clientX-startX)>4) moved=true;
      if(moved) onMile(miFrom(e.clientX), false);
      e.preventDefault();
    });
    ['pointerup','pointercancel'].forEach(function(t){
      track.addEventListener(t,function(e){
        if(!dragging) return; dragging=false;
        if(!moved && hitDot!=null) onStation(hitDot);
        else if(moved) onMile(miFrom(e.clientX), true);
        else onMile(miFrom(e.clientX), true);
      });
    });
  }
  function timelineMove(mi){
    var f=document.getElementById('tlFill'), t=document.getElementById('tlThumb');
    var pct=Math.max(0,Math.min(100, mi/COURSE_MI*100)).toFixed(2)+'%';
    if(f) f.style.width=pct;
    if(t) t.style.left=pct;
  }


  /* The full section write-up, rendered into the side panel so the detail is
     one glance away rather than behind a tap. Notes are editable in place. */
  /* typing in a note shouldn't have the preview run off underneath you */

  function sectionPanel(sec){
    var t=secTerrain(sec), mins=secMins(sec), d=sec.to-sec.from;
    return '<div class="secblock">'+
      '<div class="pills" style="margin-bottom:10px">'+
        '<span class="pill '+(sec.ec==='gold'?'gold':sec.ec==='brick'?'red':'')+'">'+sec.effort+'</span>'+
        '<span class="pill grey">'+d.toFixed(1)+' miles</span>'+
        '<span class="pill grey">'+ft(sec.gain)+' ft up</span>'+
      '</div>'+
      '<div class="fm-grid three">'+
        '<div><b>'+dur(mins)+'</b><span>allow</span></div>'+
        '<div><b>'+pace(d,mins)+'</b><span>average pace</span></div>'+
        '<div><b>'+clk(T(st(sec.to)))+'</b><span>arrive by</span></div>'+
      '</div>'+
      terrainBlock(t,'This section')+
      notesHTML('sec',sec.n)+
      '<div class="secbody">'+sec.body+'</div>'+
    '</div>';
  }
  function stationPanelDetail(i){
    var x=AIDX[i]||{};
    return '<div class="secblock">'+
      (x.desc?'<div class="secbody"><p>'+x.desc+'</p></div>':'')+
      notesHTML('aid',i)+
    '</div>';
  }

  /* ═══════════════ FULL SCREEN PLANNER ═══════════════ */
  function fullMapOpen(){
    var el=document.getElementById('mapFull');
    el.innerHTML=
      '<div class="fm-canvas" id="mapHostF"></div>'+
      /* label and transport are ONE stacked unit. They used to be two
         separately positioned elements whose bottom offsets were hand-tuned
         calc() sums -- and at the standing-panel size those sums overlapped,
         so the label sat on top of the bar. A flex column with a gap cannot
         overlap by construction. */
      '<div class="fm-cockpit" id="fmCockpit">'+
        '<div class="fm-now" id="fmNow"></div>'+
        '<div class="fmbar" id="fmBar"></div>'+
      '</div>'+
      '<div class="fm-hud">'+
        '<button class="hud-btn hud-close" id="fmClose" aria-label="Close">'+
          '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
        '<div class="hud-right">'+
          '<button class="hud-btn hud-3d" id="fm3d" aria-label="3D fly-through">3D</button>'+
          '<button class="hud-btn" id="fmLayers" aria-label="Layers">'+
            '<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg></button>'+
          '<button class="hud-btn" id="fmIn" aria-label="Zoom in"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>'+
          '<button class="hud-btn" id="fmOut" aria-label="Zoom out"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>'+
          '<button class="hud-btn" id="fmFit" aria-label="Whole course">'+
            '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>'+
        '</div>'+
        '<div class="hud-lens" id="fmLens"></div>'+
      '</div>'+
      '<div class="fm-sheet" id="fmSheet"></div>';
    document.body.classList.add('noscroll');
    el.classList.add('on');
    syncScrollLock();
    MAPV.view=null; PV.on=false;
    fullMapPaint();
    document.getElementById('fmClose').onclick=fullMapClose;
    document.getElementById('fmFit').onclick=function(){ pvStop(); MAPV.view=null; fullMapPaint(); if(FLY.on) flyOverview(); };
    document.getElementById('fm3d').onclick=flyToggle;
    document.getElementById('fmIn').onclick=function(){ zoomBy(0.6); };
    document.getElementById('fmOut').onclick=function(){ zoomBy(-0.6); };
    document.getElementById('fmLayers').onclick=layersSheet;
    try{ history.pushState({fullmap:1},''); }catch(e){}
  }
  function zoomBy(dz){
    if(FLY.on){ flyZoom(dz); return; }
    if(PV.on){ pvZoom(dz); return; }
    var P=MAPV.P; if(!P) return;
    MAPV.view={ lat:P.latAt(MAPV.H/2), lon:P.lonAt(MAPV.W/2), z:Math.max(1,Math.min(17,P.z+dz)) };
    drawMap('mapHostF');
  }
  /* zoom while previewing: keep the runner centred and re-anchor the follow */
  function pvZoom(dz){
    PV.zoom=Math.max(11.5, Math.min(16, (PV.zoom||(MAPV.P?MAPV.P.z:13))+dz));
    pvRecenter(false);
  }

  /* The scrubber floats over the map rather than living in the panel, so it
     reads as a control for the map and stays put while the panel changes. */
  /* The cockpit used to be one row holding a two-line label, a scrubber and
     four buttons at once \u2014 everything competing for the same 60px strip.
     Split in two instead: a small floating "now" pill that just names where
     you are, and a control bar below it that is only ever controls \u2014 a
     transport cluster (prev / play / next, one visual unit, play the only
     one that reads as "primary"), the scrubber filling what's left, and
     speed only while it's actually relevant. */
  function fmBarPaint(){
    var now=document.getElementById('fmNow'), bar=document.getElementById('fmBar'); if(!bar) return;
    var live=PV.on;
    var mi = live ? PV.mi : (MAPV.step>=0 ? STATIONS[MAPV.step].mi : 0);
    var s  = MAPV.step>=0 ? STATIONS[MAPV.step] : null;

    var eyebrow, title;
    if(live){
      eyebrow='Previewing \u00b7 '+clkDay(minsAtMile(PV.mi))+' \u00b7 '+dur(minsAtMile(PV.mi))+' in';
      title = (PV.hold>0 && PV.at>0) ? STATIONS[PV.at].name : secFor(PV.mi).title;
    } else if(s){
      eyebrow='Check-in '+MAPV.step+' of '+(STATIONS.length-1)+' \u00b7 mile '+s.mi.toFixed(1)+' \u00b7 '+dur(T(s))+' in';
      title=s.name;
    } else {
      eyebrow=COURSE_MI_TXT+' miles \u00b7 '+COURSE_CLIMB_TXT+' ft';
      title='The whole course';
    }
    if(now) now.innerHTML='<span>'+esc(eyebrow)+'</span><b>'+esc(title)+'</b>';

    bar.innerHTML=
      '<div class="transport">'+
        '<button class="navarrow" id="barPrev" aria-label="Previous stop">'+
          '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>'+
        '<button class="playtoggle'+(live?' on':'')+'" id="barPlay" aria-label="'+(live?'Pause':'Preview')+'">'+
          (live?'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>'
               :'<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>')+'</button>'+
        '<button class="navarrow" id="barNext" aria-label="Next stop">'+
          '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>'+
      '</div>'+
      '<div class="bartrack">'+timelineHTML(mi,{live:live})+'</div>'+
      (live?'<div class="speeds">'+[1,2,5].map(function(x){
        return '<button class="spd'+(PV.speed===x?' on':'')+'" data-spd="'+x+'">'+x+'\u00d7</button>';
      }).join('')+'</div>':'');

    document.getElementById('barPrev').onclick=function(){ barStep(-1); };
    document.getElementById('barNext').onclick=function(){ barStep(1); };
    document.getElementById('barPlay').onclick=function(){
      if(PV.on) pvStop(); else pvStart(MAPV.step>0?STATIONS[MAPV.step-1].mi:0);
    };
    bar.querySelectorAll('[data-spd]').forEach(function(b){
      b.onclick=function(){ PV.speed=+b.dataset.spd; fmBarPaint(); };
    });
    bindTimeline(bar, function(m,done){
      timelineMove(m);
      var lab=now&&now.querySelector('b');
      if(lab) lab.textContent='Mile '+m.toFixed(1)+' \u00b7 '+clkDay(minsAtMile(m));
      if(done){
        if(PV.on){ PV.mi=m; PV.hold=0; PV.at=-1;
          for(var i=0;i<STATIONS.length;i++) if(STATIONS[i].mi<=m+0.001) PV.at=i;
          pvRecenter(false); pvSheetUpdate(true); fmBarPaint();
        } else pvStart(m);
      }
    }, function(i){
      if(PV.on){ PV.at=i; PV.mi=STATIONS[i].mi; PV.hold=PV_HOLD/Math.sqrt(PV.speed);
        MAPV.step=i; pvRecenter(false); pvSheetUpdate(true); fmBarPaint(); }
      else { MAPV.step=i; showStation(i); }
    });
  }
  function barStep(dir){
    if(PV.on){ pvJump(dir); fmBarPaint(); return; }
    var n=MAPV.step+dir;
    MAPV.step = n<-1 ? STATIONS.length-1 : (n>STATIONS.length-1 ? -1 : n);
    showStation(MAPV.step);
  }
  /* ── 4. stepping highlights; it only moves the camera if the station is
     off screen, and never changes the zoom the user has chosen. ── */
  function showStation(i){
    if(FLY.on && i>=0) flyGo(STATIONS[i].mi);
    if(i>=0 && MAPV.P){
      var pt=routeAt(STATIONS[i].mi);
      if(pt){
        var x=MAPV.P.X(pt[2]), y=MAPV.P.Y(pt[1]);
        var m=70;
        /* on a phone the bottom sheet covers the lower half of the canvas —
           a station that is technically on-screen but under the sheet still
           needs a pan, or tapping through the list would silently scroll
           the detail panel over stations you can no longer see. */
        var sheetBias=(typeof window!=='undefined' && window.innerWidth<820) ? 0.5 : 0;
        var visBottom=MAPV.H*(1-sheetBias);
        if(x<m||x>MAPV.W-m||y<m||y>visBottom-m){
          var zz=MAPV.P.z, lat=pt[1];
          if(sheetBias){ var nn=256*Math.pow(2,zz); lat=ilat(my(pt[1])+(MAPV.H-visBottom)/(2*nn)); }
          MAPV.view={ lat:lat, lon:pt[2], z:zz };   // pan only, same zoom
        }
      }
    }
    drawMap('mapHostF'); fullMapSheet(); fmBarPaint();
  }

  function fullMapPaint(){ drawMap('mapHostF'); fullMapHud(); fullMapSheet(); fmBarPaint(); }

  function fullMapHud(){
    var el=document.getElementById('fmLens'); if(!el) return;
    el.innerHTML=[['aid','Aid'],['crew','Crew'],['pacer','Pacers']].filter(function(l){return HAS_PACERS||l[0]!=='pacer';}).map(function(l){
      return '<button class="lenspill'+(MAPV.lens===l[0]?' on':'')+'" data-flens="'+l[0]+'">'+l[1]+'</button>';
    }).join('');
    el.querySelectorAll('[data-flens]').forEach(function(b){
      b.onclick=function(){ MAPV.lens=b.dataset.flens; drawMap('mapHostF'); fullMapHud(); fullMapSheet(); };
    });
  }
  function layersSheet(){
    sheet('Map layers',
      '<div class="cap" style="margin:-8px 0 10px">Basemap</div>'+
      '<div class="baselist">'+Object.keys(BASES).map(function(k){
        var b=BASES[k];
        return '<button class="baseopt'+(MAPV.base===k?' on':'')+'" data-lbase="'+k+'">'+
          '<span class="sw sw-'+k+'"></span><span class="bl">'+b.label+
          (b.credit?'<em>'+b.credit.split(',')[0]+'</em>':'<em>No imagery, works offline</em>')+'</span></button>';
      }).join('')+'</div>'+
      '<div class="cap" style="margin:18px 0 10px">What to highlight</div>'+
      '<div class="baselist">'+[['aid','Aid stations','Every check-in, coloured by access'],
        ['crew','Crew access','Only the places a crew can reach'],
        ['pacer','Pacer coverage','Where the runner is alone, and who is alongside']].map(function(l){
        return '<button class="baseopt'+(MAPV.lens===l[0]?' on':'')+'" data-llens="'+l[0]+'">'+
          '<span class="bl">'+l[1]+'<em>'+l[2]+'</em></span></button>';
      }).join('')+'</div>');
    shEl.querySelectorAll('[data-lbase]').forEach(function(b){
      b.onclick=function(){ MAPV.base=b.dataset.lbase; ls(KEY+'base',MAPV.base); closeSheet(); fullMapPaint(); };
    });
    shEl.querySelectorAll('[data-llens]').forEach(function(b){
      b.onclick=function(){ MAPV.lens=b.dataset.llens; closeSheet(); fullMapPaint(); };
    });
  }

  /* ── bottom sheet: browse or preview ─────────────────────────── */
  function fullMapSheet(){
    var box=document.getElementById('fmSheet'); if(!box) return;
    box.innerHTML = PV.on ? pvSheetHTML() : browseSheetHTML();
    if(PV.on) pvBind(box); else browseBind(box);
    box.querySelectorAll('[data-pedit]').forEach(function(b){
      b.onclick=function(){ editAid(+b.dataset.pedit); };
    });
  }
  /* The single renderer for "everything about station i" -- used both when
     browsing with the arrows and when the preview pauses at a stop, so the
     two can never quietly drift apart into two different descriptions of
     the same place. */
  function stationSheetHTML(i){
    var s=STATIONS[i];
    var P=stationPlan(i), with_=whoIsWith(s.mi), leg=legInto(i);
    var ahead=legOutOf(i), tAhead=legTerrainOut(i);
    var aheadHTML;
    if(ahead){
      var Pn=stationPlan(i+1), withN=whoIsWith(ahead.to.mi);
      aheadHTML='<div class="fm-sec lead">'+
        '<div class="fm-sechead"><span>The leg ahead</span><b>To '+esc(ahead.to.name)+'</b></div>'+
        '<div class="fm-grid">'+
          '<div><b>'+ahead.mi+'</b><span>miles</span></div>'+
          '<div><b>'+dur(ahead.mins)+'</b><span>allow</span></div>'+
          '<div><b>'+(ahead.mi>0?(pace(ahead.mi,ahead.mins)||'\u2014'):'\u2014')+'</b><span>leg pace</span></div>'+
          '<div><b>'+clk(T(ahead.to))+'</b><span>arrive by '+dyOf(T(ahead.to))+'</span></div></div>'+
        terrainBlock(tAhead, 'To '+ahead.to.name)+
        '<div class="fm-facts">'+
          (Pn.crew.length?'<span class="ok">Crew: '+nameList(Pn.crew)+'</span>':'<span class="no">No crew there</span>')+
          (Pn.bag?'<span class="ok">Drop bag</span>':'')+
          (Pn.pacerSwap?'<span class="ok">Pacer swap</span>':'')+
          (withN?'<span class="ok">With '+esc(withN.name)+'</span>':'')+
          (ahead.to.cut!=null?'<span class="warn">Cutoff '+clkDay(ahead.to.cut)+'</span>':'')+
        '</div></div>';
    } else {
      aheadHTML='<div class="fm-sec lead">'+
        '<div class="fm-sechead"><span>From here</span><b>Finished</b></div>'+
        '<div class="fm-grid">'+
          '<div><b>'+s.mi.toFixed(1)+'</b><span>total miles</span></div>'+
          '<div><b>'+dur(T(s))+'</b><span>total time</span></div>'+
          '<div><b>'+(cumPace(i)||'\u2014')+'</b><span>average pace</span></div>'+
          '<div><b>'+clk(T(s))+'</b><span>finish '+dyOf(T(s))+'</span></div></div></div>';
    }
    return '<div class="fm-grab"></div>'+
      '<div class="fm-head"><div style="min-width:0"><div class="fm-eye">Check-in '+i+' of '+(STATIONS.length-1)+' \u00b7 mile '+s.mi.toFixed(1)+'</div>'+
      '<div class="fm-nm">'+esc(s.name)+
        (ahead?'<i class="fm-arrow">\u2192</i><em>'+esc(ahead.to.name)+'</em>':'')+'</div>'+
      '<div class="fm-sub">'+clkDay(T(s))+' \u00b7 <b>'+dur(T(s))+'</b> into the race'+
        (isNight(T(s))?' \u00b7 in the dark':'')+'</div>'+
      (s.cut!=null?'<div class="fm-sub">Must leave by '+clkDay(s.cut)+'</div>':'')+'</div>'+
      '</div>'+
      /* what is coming next leads: when you are planning, the next leg is
         the thing you are deciding about. Where you stand comes second. */
      aheadHTML+
      '<div class="fm-sec">'+
      '<div class="fm-sechead"><span>At this stop</span>'+
        (leg?'<b>From the start</b>':'<b>The start</b>')+'</div>'+
      /* the race so far, not the leg just finished: standing at a stop, what
         you want is where you are in the whole race. The leg you just ran is
         behind you and the leg ahead has its own block above. */
      (leg?'<div class="fm-grid">'+
        '<div><b>'+s.mi.toFixed(1)+'</b><span>miles in</span></div>'+
        '<div><b>'+dur(T(s))+'</b><span>elapsed</span></div>'+
        '<div><b>'+(cumPace(i)||'\u2014')+'</b><span>average pace</span></div>'+
        '<div><b>'+ft(cumGain(s.mi))+'</b><span>ft climbed</span></div></div>'+
        terrainBlock(terrainFromStart(i), 'From the start')
       :'')+
      '<div class="fm-facts">'+
        (P.crew.length?'<span class="ok">Crew: '+nameList(P.crew)+'</span>':'<span class="no">No crew</span>')+
        (P.pacerSwap?'<span class="ok">Pacer swap</span>':'')+
        (P.bag?'<span class="ok">Drop bag</span>':'')+
        (with_?'<span class="ok">With '+esc(with_.name)+'</span>':(s.mi>=PACER_FROM?'<span class="no">No pacer assigned</span>':'<span class="no">Solo</span>'))+
        (s.cut!=null?'<span class="'+((s.cut-T(s))<180?'warn':'')+'">'+dur(s.cut-T(s))+' of margin</span>':'')+
      '</div></div>'+
      stationPanelDetail(i)+

      '<div class="fm-acts"><button class="fa" id="fmOpenAid">Full aid station details</button></div>';
  }
  function browseSheetHTML(){
    var i=MAPV.step;
    if(i<0 || !STATIONS[i]){
      /* nothing selected: on the wide/standing-panel layout the sheet is the
         full height of the screen, and three lines of text left aligned at
         the top of an empty column reads as broken, not calm — especially
         projected. .fm-empty lets that one state centre itself instead. */
      return '<div class="fm-grab"></div>'+
        '<div class="fm-empty"><div class="fm-head"><div><div class="fm-nm">The whole course</div>'+
        '<div class="fm-sub">'+COURSE_MI_TXT+' miles · '+COURSE_CLIMB_TXT+' ft · 7 crew stops · 5 pacer swaps</div></div>'+
        '</div>'+
        '<div class="fm-facts"><span>Tap a station on the map, or step through with the arrows</span></div>'+
        '</div>';
    }
    return stationSheetHTML(i);
  }
  function bindAidEdit(box){
  }
  function browseBind(box){
    bindAidEdit(box);
    box.querySelectorAll('[data-fgo]').forEach(function(b){
      b.onclick=function(){ barStep(b.dataset.fgo==='next'?1:-1); };
    });
    var fo=document.getElementById('fmOpenAid'); if(fo) fo.onclick=function(){ openAid(MAPV.step); };
    bindTimeline(box, function(mi,done){
      timelineMove(mi);
      var lab=box.querySelector('.tlnow');
      if(lab) lab.textContent='Mile '+mi.toFixed(1)+' · '+clkDay(minsAtMile(mi));
      if(done) pvStart(mi);
    }, function(i){ MAPV.step=i; showStation(i); });
  }

  /* ── preview: a dot that actually runs the course ────────────── */
  var PV = { on:false, mi:0, speed:1, raf:null, last:0, hold:0, at:-1, baseP:null, zoom:0 };
  /* Rock Hawk shipped at 0.30 and it was still "far too fast to talk over
     during a crew briefing" -- dropped to 0.115 there. RRR100 had drifted
     even faster than that (0.42). This is a walkthrough speed, not meant to
     literally simulate race pace: 2x/5x exist for skipping ahead. */
  var PV_MPS = 0.115;     /* miles of course per real second at 1x */
  var PV_HOLD = 3600;     /* pause at each aid station, ms at 1x */

  function pvStart(fromMi){
    PV.on=true; PV.mi=Math.max(0,fromMi||0); PV.hold=0; PV.last=0; PV.zoom=0;
    PV.at=-1;
    for(var i=0;i<STATIONS.length;i++) if(STATIONS[i].mi<=PV.mi+0.001) PV.at=i;
    MAPV.step=-1;
    document.getElementById('mapFull').classList.add('previewing');
    pvRecenter(true);
    fullMapHud(); fullMapSheet(); fmBarPaint();
    cancelAnimationFrame(PV.raf);
    PV.raf=requestAnimationFrame(pvFrame);
  }
  function pvStop(){
    PV.on=false; cancelAnimationFrame(PV.raf); PV.raf=null;
    var el=document.getElementById('mapFull');
    if(el){ el.classList.remove('previewing');
      var h=document.getElementById('mapHostF');
      if(h){ var t=h.querySelector('.tiles'), s=h.querySelector('.mapsvg');
        if(t) t.style.transform=''; if(s) s.style.transform=''; } }
    if(el&&el.classList.contains('on')){ fullMapSheet(); fmBarPaint(); }
    if(FLY.on){ flyInteract(true); flyFree(); }      /* paused: the terrain is yours to drag and turn */
  }
  /* full re-render centred on the dot, at a zoom that shows the terrain */
  function pvRecenter(hard){
    var pt=routeLerp(PV.mi); if(!pt) return;
    if(FLY.on){ flyCam(hard); return; }             /* 3D owns the camera; the flat map stays as it was underneath */
    if(hard||!PV.zoom) PV.zoom=Math.max(12.4, Math.min(14.2, (MAPV.fitZ||11)+2.4));
    MAPV.view={ lat:pt[0], lon:pt[1], z:PV.zoom };
    drawMap('mapHostF');
    PV.baseP=MAPV.P;                    /* always re-anchor after a redraw */
    var host=document.getElementById('mapHostF');
    var world=host&&host.querySelector('.mapworld');
    if(world) world.style.transform='translate3d(0px,0px,0)';
  }
  function pvFrame(ts){
    if(!PV.on) return;
    if(!PV.last) PV.last=ts;
    var dt=Math.min(120, ts-PV.last); PV.last=ts;

    if(PV.frozen || (FLY.on && FLY.easing)){ PV.raf=requestAnimationFrame(pvFrame); return; }
    if(PV.hold>0){ PV.hold-=dt; }
    else {
      PV.mi += (dt/1000)*PV_MPS*PV.speed;
      /* pause on arrival at each aid station */
      for(var i=Math.max(1,PV.at+1);i<STATIONS.length;i++){
        if(STATIONS[i].mi<=PV.mi && i>PV.at){
          PV.mi=STATIONS[i].mi; PV.at=i; PV.hold=PV_HOLD/Math.sqrt(PV.speed);
          MAPV.step=i; pvRecenter(false); pvSheetUpdate(true); break;
        }
      }
      if(PV.mi>=COURSE_MI){ PV.mi=COURSE_MI; pvSheetUpdate(true); pvStop(); return; }
    }

    var pt=routeLerp(PV.mi);
    if(FLY.on) flyFrame(dt);
    else if(pt && PV.baseP){
      var P=PV.baseP, x=P.X(pt[1]), y=P.Y(pt[0]);
      var dx=MAPV.W/2-x, dy=MAPV.H/2-y;
      var host=document.getElementById('mapHostF');
      /* only re-render when the world layer is about to run out of canvas.
         0.85 rather than 0.72: the tile layer now survives a redraw (see
         paintTiles), so a recentre is cheap, but every one still means an
         SVG rebuild and it is worth avoiding when the extra overscan margin
         already covers it. */
      if(Math.abs(dx)>(MAPV.OX||0)*0.85||Math.abs(dy)>(MAPV.OY||0)*0.85){ pvRecenter(false); }
      else if(host){
        var world=host.querySelector('.mapworld');
        if(world) world.style.transform='translate3d('+dx.toFixed(2)+'px,'+dy.toFixed(2)+'px,0)';
        var d1=host.querySelector('#pvDot'), d2=host.querySelector('#pvHalo'), d3=host.querySelector('#pvHead');
        if(d1){ d1.setAttribute('cx',x.toFixed(2)); d1.setAttribute('cy',y.toFixed(2)); }
        if(d2){ d2.setAttribute('cx',x.toFixed(2)); d2.setAttribute('cy',y.toFixed(2)); }
        if(d3){
          var ahd2=routeLerp(Math.min(COURSE_MI,PV.mi+0.15)), bhd2=routeLerp(Math.max(0,PV.mi-0.15));
          if(ahd2&&bhd2){
            var heading2=Math.atan2(P.Y(ahd2[0])-P.Y(bhd2[0]), P.X(ahd2[1])-P.X(bhd2[1]))*180/Math.PI;
            d3.setAttribute('transform','translate('+x.toFixed(2)+','+y.toFixed(2)+') rotate('+heading2.toFixed(1)+')');
          }
        }
      }
    }
    pvSheetUpdate(false); fmBarLive();
    PV.raf=requestAnimationFrame(pvFrame);
  }

  function pvSheetHTML(){
    var atSt = PV.hold>0 && PV.at>0;
    var body;
    if(atSt){
      /* same renderer browsing uses -- paused-in-preview and tapped-in-browse
         are never allowed to describe the same station two different ways */
      return stationSheetHTML(PV.at);
    } else {
      var sec=secFor(PV.mi), nx=null;
      for(var k=0;k<STATIONS.length;k++) if(STATIONS[k].mi>PV.mi){ nx=STATIONS[k]; break; }
      var w=whoIsWith(PV.mi);
      body='<div class="fm-eye">Mile '+PV.mi.toFixed(1)+' \u00b7 '+ft(elevAt(PV.mi))+' ft</div>'+
        '<div class="fm-nm">'+sec.title+'</div>'+
        '<div class="fm-sub">'+sec.sub+'</div>'+
        '<div class="fm-facts">'+
          '<span>'+ft(cumGain(PV.mi))+' ft climbed so far</span>'+
          (nx?'<span>'+(nx.mi-PV.mi).toFixed(1)+' mi to '+nx.name+'</span>':'')+
          (isNight(minsAtMile(PV.mi))?'<span class="warn">In the dark</span>':'')+
          (w?'<span class="ok">With '+esc(w.name)+'</span>':(PV.mi>=PACER_FROM?'<span class="no">No pacer assigned</span>':'<span class="no">Running solo</span>'))+
        '</div>'+
        sectionPanel(sec);
    }
    return '<div class="fm-grab"></div>'+
      '<div class="fm-head"><div style="min-width:0">'+body+'</div></div>';
  }
  function fmBarLive(){
    timelineMove(PV.mi);
    var now=document.getElementById('fmNow'); if(!now) return;
    var eb=now.querySelector('span'), tb=now.querySelector('b');
    if(eb) eb.textContent=(FLY.on?'Mile '+PV.mi.toFixed(1):'Previewing')+' \u00b7 '+clkDay(minsAtMile(PV.mi))+' \u00b7 '+dur(minsAtMile(PV.mi))+' in';
    var want=(PV.hold>0&&PV.at>0)?STATIONS[PV.at].name:secFor(PV.mi).title;
    if(tb&&tb.textContent!==want) tb.textContent=want;
  }
  function pvSheetUpdate(full){
    var box=document.getElementById('fmSheet'); if(!box) return;
    /* rebuild when the state changes: entering or leaving a station, or
       crossing into a new section. Otherwise just nudge the mile and bar. */
    var sn=secFor(PV.mi).n;
    if(full||PV.holdShown!==(PV.hold>0)||PV.secN!==sn){
      PV.holdShown=(PV.hold>0); PV.secN=sn;
      box.innerHTML=pvSheetHTML(); pvBind(box);
      box.querySelectorAll('[data-pedit]').forEach(function(b){
        b.onclick=function(){ editAid(+b.dataset.pedit); };
      });
      return;
    }
    timelineMove(PV.mi);
    var lab=box.querySelector('.tlnow');
    if(lab) lab.textContent=clkDay(minsAtMile(PV.mi))+' \u00b7 '+dur(minsAtMile(PV.mi))+' elapsed';
    var eye=box.querySelector('.fm-eye');
    if(eye && PV.hold<=0) eye.textContent='Mile '+PV.mi.toFixed(1)+' \u00b7 '+ft(elevAt(PV.mi))+' ft';
  }
  function pvBind(box){
    bindAidEdit(box);
    var fo=box.querySelector('#fmOpenAid');
    if(fo) fo.onclick=function(){ openAid(PV.at); };
    box.querySelectorAll('[data-spd]').forEach(function(b){
      b.onclick=function(){ PV.speed=+b.dataset.spd; pvSheetUpdate(true); };
    });
    bindTimeline(box, function(mi,done){
      PV.mi=mi; PV.hold=0; PV.at=-1;
      for(var i=0;i<STATIONS.length;i++) if(STATIONS[i].mi<=PV.mi+0.001) PV.at=i;
      timelineMove(mi);
      var lab=box.querySelector('.tlnow');
      if(lab) lab.textContent='Mile '+mi.toFixed(1)+' · '+clkDay(minsAtMile(mi));
      if(done){ pvRecenter(false); pvSheetUpdate(true); }
    }, function(i){
      PV.at=i; PV.mi=STATIONS[i].mi; PV.hold=PV_HOLD/Math.sqrt(PV.speed);
      MAPV.step=i; pvRecenter(false); pvSheetUpdate(true);
    });
  }
  function pvJump(dir){
    var i=PV.at+dir;
    i=Math.max(0,Math.min(STATIONS.length-1,i));
    PV.at=i; PV.mi=STATIONS[i].mi; PV.hold=PV_HOLD/Math.sqrt(PV.speed);
    MAPV.step=i; pvRecenter(false); pvSheetUpdate(true);
  }

  function fullMapClose(){
    pvStop(); flyClose();
    document.getElementById('mapFull').classList.remove('on');
    document.body.classList.remove('noscroll');
    syncScrollLock();
    MAPV.view=null;
    renderMap();
  }

  function renderMap(){
    var el=document.getElementById('mapBody'); if(!el) return;
    var i=MAPV.step, s=i>=0?STATIONS[i]:null, leg=legInto(i);
    var b=BASES[MAPV.base];

    var panel;
    if(!s){
      panel='<div class="card"><h3>Walk the course</h3>'+
        '<p class="sec">Tap any point on the map, or use the arrows, to step through the seventeen check-ins one at a time \u2014 what the leg into each one is like, who is allowed there, and what time you should reach it.</p>'+
        '<div class="metrics" style="margin-bottom:0"><div><div class="k">Distance</div><div class="v num">'+COURSE_MI_TXT+' mi</div></div>'+
        '<div><div class="k">Climb</div><div class="v num">'+COURSE_CLIMB_TXT+' ft</div></div>'+
        '<div><div class="k">Crew stops</div><div class="v num">7</div></div></div></div>';
    } else {
      var who=[];
      who.push(s.crew?'<span class="pill">'+(s.crew===2?'Crew on foot only':s.crew===3?'Crew, drop-off only':'Crew')+'</span>'
                     :'<span class="pill grey">No crew</span>');
      if(HAS_PACERS) who.push(s.pacer?'<span class="pill gold">Pacer swap</span>':'<span class="pill grey">No pacer swap</span>');
      who.push(s.bag?'<span class="pill">Drop bag</span>':'<span class="pill grey">No drop bag</span>');
      var paced=s.mi>=PACER_FROM;
      var names=crewAt((function(){ for(var c=0;c<CREW.length;c++) if(CREW[c].mi===s.mi) return CREW[c].n; return -1; })());
      panel='<div class="card">'+
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'+
        '<div><div class="cap">Check-in '+i+' of '+(STATIONS.length-1)+'</div>'+
        '<h3 style="font-size:21px;margin-top:2px">'+s.name+'</h3>'+
        '<div class="cap">mile '+s.mi.toFixed(1)+' \u00b7 '+ft(s.elev)+' ft \u00b7 '+ft(cumGain(s.mi))+' ft climbed</div></div>'+
        '<span class="pill '+(paced?'':'red')+'">'+(paced?'Paced':'Solo')+'</span></div>'+
        '<div class="pills" style="margin:12px 0">'+who.join('')+'</div>'+
        (names.length?'<div class="callout g"><b>Crewing here.</b> '+nameList(names)+'</div>':'')+
        (leg?'<h4 style="font-size:15px;font-weight:650;color:var(--green-ink);margin:16px 0 6px">The leg in from '+leg.from.name+'</h4>'+
          '<div class="metrics"><div><div class="k">Distance</div><div class="v num">'+leg.mi+' mi</div></div>'+
          '<div><div class="k">Climb</div><div class="v num">'+ft(leg.gain)+' ft</div></div>'+
          '<div><div class="k">Allow</div><div class="v num">'+dur(leg.mins)+'</div></div></div>'+
          '<div class="metrics"><div><div class="k">Leg pace</div><div class="v num">'+(legPace(i)||'\u2014')+'/mi</div></div>'+
          '<div><div class="k">Average so far</div><div class="v num">'+(cumPace(i)||'\u2014')+'/mi</div></div>'+
          '<div><div class="k">Elapsed</div><div class="v num">'+dur(T(s))+'</div></div></div>'+
          (leg.sec?'<div class="pills" style="margin-bottom:10px"><span class="pill '+
            (leg.sec.ec==='gold'?'gold':leg.sec.ec==='brick'?'red':'')+'">'+leg.sec.effort+'</span>'+
            '<span class="pill grey">Section '+leg.sec.n+'</span></div>':''):'')+
        '<div class="metrics" style="margin-bottom:0"><div><div class="k">Planned</div><div class="v num">'+clkDay(T(s))+'</div></div>'+
        '<div><div class="k">Cutoff</div><div class="v num" style="color:'+(s.cut!=null?'var(--red)':'var(--text-3)')+'">'+
          (s.cut!=null?clkDay(s.cut):'none')+'</div></div>'+
        '<div><div class="k">Spare</div><div class="v num">'+(s.cut!=null?dur(s.cut-T(s)):'\u2014')+'</div></div></div>'+
        notesHTML('aid',i)+
        '<button class="btn tint sm" data-openaid="'+i+'" style="margin-top:14px">Open this aid station</button></div>';
    }

    el.innerHTML=
      '<div class="seg" style="margin-bottom:8px">'+
        [['aid','Aid stations'],['crew','Crew access'],['pacer','Pacers']].filter(function(l){return HAS_PACERS||l[0]!=='pacer';}).map(function(l){
          return '<button'+(MAPV.lens===l[0]?' class="on"':'')+' data-lens="'+l[0]+'">'+l[1]+'</button>';
        }).join('')+'</div>'+
      '<div class="seg" style="margin-bottom:12px">'+
        Object.keys(BASES).map(function(k){
          return '<button'+(MAPV.base===k?' class="on"':'')+' data-base="'+k+'">'+BASES[k].label+'</button>';
        }).join('')+'</div>'+
      '<div class="card" style="padding:0;overflow:hidden">'+
        '<div class="maphold"><div id="mapHost" class="maphost"></div>'+
        '<button class="mapexpand" id="fmOpen" aria-label="Full screen">'+
        '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div>'+
        '<div class="mapbar">'+
          '<button class="mstep" data-go="prev" aria-label="Previous">\u2039</button>'+
          '<div class="mlabel">'+(s?s.name+' \u00b7 mile '+s.mi.toFixed(1):'Whole course')+'</div>'+
          '<button class="mstep" data-go="next" aria-label="Next">\u203a</button>'+
        '</div>'+

        (b.credit?'<div class="mapcredit">Imagery \u00a9 '+b.credit+'</div>':'')+
      '</div>'+
      coverageStrip()+
      panel;

    drawMap();
    el.querySelectorAll('[data-lens]').forEach(function(x){ x.onclick=function(){ MAPV.lens=x.dataset.lens; renderMap(); }; });
    el.querySelectorAll('[data-base]').forEach(function(x){ x.onclick=function(){ MAPV.base=x.dataset.base; ls(KEY+'base',MAPV.base); renderMap(); }; });
    el.querySelectorAll('[data-go]').forEach(function(x){
      x.onclick=function(){
        var n=MAPV.step+(x.dataset.go==='next'?1:-1);
        MAPV.step = n<-1 ? STATIONS.length-1 : (n>STATIONS.length-1 ? -1 : n);
        renderMap();
      };
    });
    var fo=document.getElementById('fmOpen'); if(fo) fo.onclick=fullMapOpen;
    var oa=el.querySelector('[data-openaid]');
    if(oa) oa.onclick=function(){ openAid(+oa.dataset.openaid); };
  }



  /* Save the map for the course corridor only \u2014 tiles within about a
     kilometre of the line. Caching the whole bounding box would be four times
     the download for terrain nobody will look at. */
  function tilesNearRoute(base,zooms){
    var b=BASES[base]; if(!b||!b.url) return [];
    var want={}, out=[];
    zooms.forEach(function(z){
      if(b.max && z>b.max) return;
      var n=Math.pow(2,z);
      ROUTE.forEach(function(p){
        var tx=Math.floor(mx(p[2])*n), ty=Math.floor(my(p[1])*n);
        for(var dx=-1;dx<=1;dx++) for(var dy=-1;dy<=1;dy++){
          var x=tx+dx, y=ty+dy;
          if(x<0||y<0||x>=n||y>=n) continue;
          var k=z+'/'+x+'/'+y;
          if(want[k]) continue; want[k]=1;
          out.push(tileURL(base,z,x,y));
        }
      });
    });
    return out;
  }
  function saveTiles(base,btn,msg){
    var urls=tilesNearRoute(base,[11,12,13,14]);
    if(!('caches' in window)){ msg.textContent='This browser cannot store map tiles.'; return; }
    msg.textContent='Downloading '+urls.length+' tiles\u2026';
    var done=0, fail=0;
    caches.open('rrr-tiles-v1').then(function(cache){
      var i=0;
      function next(){
        if(i>=urls.length){
          msg.textContent = fail>urls.length*0.3
            ? 'Saved '+done+' tiles, '+fail+' failed. Try again on better wifi.'
            : 'Saved. '+done+' tiles ready offline.';
          if(btn) btn.disabled=false;
          return;
        }
        var batch=urls.slice(i,i+12); i+=12;
        Promise.all(batch.map(function(u){
          return cache.add(u).then(function(){done++;}).catch(function(){fail++;});
        })).then(function(){
          msg.textContent='Downloading\u2026 '+done+' of '+urls.length;
          setTimeout(next,40);
        });
      }
      if(btn) btn.disabled=true;
      next();
    });
  }

  /* ── location ────────────────────────────────────────────────
     Three independent sources for where he is, none reliable alone:
     timing mats (arrival only, 17-mile blind spot), crew logging (needs a
     human), and this. GPS is the only continuous one but it needs the phone
     awake with signal, so it fills gaps rather than replacing anything. */
  var GPS = { watch:null, last:null };
  function gpsOn(){ return S.gps===true; }
  function nearestMile(lat,lon){
    var best=1e9, mi=null, k=Math.cos(lat*Math.PI/180);
    for(var i=0;i<ROUTE.length;i++){
      var dy=(ROUTE[i][1]-lat)*111320, dx=(ROUTE[i][2]-lon)*111320*k;
      var d=dx*dx+dy*dy;
      if(d<best){ best=d; mi=ROUTE[i][0]; }
    }
    return { mi:mi, offM:Math.sqrt(best) };
  }
  function gpsStart(){
    if(!navigator.geolocation){ sbStatus(SB.status,'no geolocation'); return; }
    gpsStop();
    GPS.watch=navigator.geolocation.watchPosition(function(pos){
      var la=pos.coords.latitude, lo=pos.coords.longitude;
      var n=nearestMile(la,lo);
      GPS.last={ lat:la, lon:lo, mi:n.mi, off:n.offM, acc:pos.coords.accuracy, at:Date.now() };
      ls(KEY+'gpslast', JSON.stringify(GPS.last));
      pushGPS();
      if(S.mode==='runner'||S.mode==='crew') { paintGPS(); }
    }, function(){ /* denied or unavailable: stay silent, the app is unaffected */ },
    { enableHighAccuracy:true, maximumAge:15000, timeout:20000 });
  }
  function gpsStop(){
    if(GPS.watch!=null && navigator.geolocation) navigator.geolocation.clearWatch(GPS.watch);
    GPS.watch=null;
  }
  /* Broadcast so the crew sees him move. Writes to a `live` table; if that
     table does not exist yet the request 404s and everything else carries on. */
  var lastPush=0;
  function pushGPS(){
    if(!GPS.last || Date.now()-lastPush < 45000) return;
    lastPush=Date.now();
    fetch(sbUrl('/rest/v1/live'), {
      method:'POST',
      headers:sbHead({ 'Prefer':'resolution=merge-duplicates,return=minimal' }),
      body:JSON.stringify({ id:'runner', lat:GPS.last.lat, lon:GPS.last.lon,
                            mi:GPS.last.mi, at:new Date().toISOString() })
    }).catch(function(){});
  }
  function pullGPS(){
    return fetch(sbUrl('/rest/v1/live?id=eq.runner&select=*'), { headers:sbHead() })
      .then(function(r){ return r.ok?r.json():[]; })
      .then(function(rows){
        var r=rows&&rows[0]; if(!r) return false;
        var at=new Date(r.at).getTime();
        if(GPS.last && GPS.last.at>=at) return false;
        GPS.last={ lat:+r.lat, lon:+r.lon, mi:+r.mi, at:at, remote:true };
        return true;
      }).catch(function(){ return false; });
  }
  function gpsAge(){ return GPS.last ? (Date.now()-GPS.last.at)/60000 : null; }
  function gpsFresh(){ var a=gpsAge(); return a!=null && a<25; }
  function paintGPS(){
    if(S.mode==='runner') drawProfile('profile');
    var host=document.getElementById('mapHostF')||document.getElementById('mapHost');
    if(host) drawMap(host.id);
    var el=document.querySelector('.gpsline');
    if(el&&GPS.last) el.textContent='GPS: mile '+GPS.last.mi.toFixed(1)+
      ' \u00b7 '+Math.round(gpsAge())+' min ago'+(GPS.last.off>120?' \u00b7 '+Math.round(GPS.last.off)+' m off course':'');
  }


  /* ── terrain arithmetic ──
     Gross climb comes from the GPX. Descent is derived, so up minus down
     always reconciles with the net change between the two stations rather
     than being a second independent guess. */
  function terrain(fromMi,toMi,gain){
    var eA=elevAt(fromMi), eB=elevAt(toMi), d=Math.max(0.01,toMi-fromMi);
    var net=eB-eA, up=gain||0, down=Math.max(0,up-net);
    return { d:d, eA:Math.round(eA), eB:Math.round(eB), net:net, up:up, down:down,
             upPerMi:up/d, upGrade:up/(d*5280)*100, share:up/COURSE_CLIMB*100 };
  }
  function legTerrainOut(i){
    if(i<0 || i>=STATIONS.length-1) return null;
    return terrain(STATIONS[i].mi, STATIONS[i+1].mi, STATIONS[i+1].gain||0);
  }
  /* Everything climbed and descended from the gun to this stop, for the
     "at this stop" block -- where you stand in the race, not the last leg. */
  function terrainFromStart(i){
    if(i<=0) return null;
    var g=0;
    for(var k=1;k<=i;k++) g+=STATIONS[k].gain||0;
    return terrain(0, STATIONS[i].mi, g);
  }
  function secTerrain(sec){
    var g=0;
    STATIONS.forEach(function(s){ if(s.mi>sec.from && s.mi<=sec.to) g+=s.gain||0; });
    return terrain(sec.from, sec.to, g);
  }
  /* dark = after this race's 'dark by' time and before its sunrise, read off the race clock */
  function isNight(mins){ var d=dayMin(mins), dk=parseClock(RACE.sun&&RACE.sun.dark)||SUNS+25; return d>=dk||d<SUNR; }
  function terrainBlock(t,label){
    if(!t) return '';
    var upness = t.net>250 ? 'up' : t.net<-250 ? 'down' : 'flat';
    var word = upness==='up' ? 'Net climb' : upness==='down' ? 'Net descent' : 'Rolling, no net change';
    var big=Math.max(t.up,t.down,1);
    return '<div class="terr '+upness+'">'+
      '<div class="terrhead"><span>'+(label||'The leg in')+'</span>'+
        '<b>'+word+(upness==='flat'?'':' '+ft(Math.abs(t.net))+' ft')+'</b></div>'+
      '<div class="terrbars">'+
        '<div class="tb up"><i style="width:'+(t.up/big*100).toFixed(0)+'%"></i>'+
          '<span>\u2191 '+ft(t.up)+' ft up</span></div>'+
        '<div class="tb dn"><i style="width:'+(t.down/big*100).toFixed(0)+'%"></i>'+
          '<span>\u2193 '+ft(t.down)+' ft down</span></div>'+
      '</div>'+
      '<div class="terrrow">'+
        '<span><b>'+t.eA.toLocaleString()+'</b> \u2192 <b>'+t.eB.toLocaleString()+'</b> ft</span>'+
        '<span><b>'+ft(t.upPerMi)+'</b> ft per mile</span>'+
        '<span><b>'+t.upGrade.toFixed(1)+'%</b> average grade</span>'+
        '<span><b>'+t.share.toFixed(1)+'%</b> of all the climbing</span>'+
      '</div></div>';
  }

  /* ── the leg into a station, drawn ──────────────────────────
     Two small vector panels: the shape of the ground you cover, and the
     climb you do getting there. Both use a fixed viewBox and scale to
     whatever width they land in, so they work in a sheet of any size. */
  function legProfileSVG(i){
    var A=STATIONS[i-1], B=STATIONS[i];
    var pts=PROFILE.filter(function(p){ return p[0]>=A.mi-0.05 && p[0]<=B.mi+0.05; });
    if(pts.length<2) pts=[[A.mi,A.elev],[B.mi,B.elev]];
    var W=320,H=118, pl=6,pr=6,pt=12,pb=16;
    var lo=1e9,hi=-1e9;
    pts.forEach(function(p){ if(p[1]<lo)lo=p[1]; if(p[1]>hi)hi=p[1]; });
    var pad=Math.max(60,(hi-lo)*0.12); lo-=pad; hi+=pad;
    var X=function(m){ return pl+(m-A.mi)/Math.max(0.01,B.mi-A.mi)*(W-pl-pr); };
    var Y=function(e){ return pt+(H-pt-pb)-(e-lo)/Math.max(1,hi-lo)*(H-pt-pb); };
    var line=pts.map(function(p,k){ return (k?'L':'M')+X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1); }).join('');
    /* line already starts with M; splice its points in after an explicit L */
    var area='M'+X(A.mi).toFixed(1)+','+(H-pb)+'L'+line.slice(1)+'L'+X(B.mi).toFixed(1)+','+(H-pb)+'Z';
    return '<svg class="legsvg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
      '<path d="'+area+'" fill="var(--green)" opacity=".13"/>'+
      '<path d="'+line+'" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<circle cx="'+X(A.mi).toFixed(1)+'" cy="'+Y(A.elev).toFixed(1)+'" r="4" fill="var(--card)" stroke="var(--text-3)" stroke-width="2"/>'+
      '<circle cx="'+X(B.mi).toFixed(1)+'" cy="'+Y(B.elev).toFixed(1)+'" r="5" fill="'+stationColour(B)+'" stroke="var(--card)" stroke-width="2"/>'+
      '</svg>';
  }
  function legMapSVG(i){
    var A=STATIONS[i-1], B=STATIONS[i];
    var pts=routeSlice(A.mi,B.mi);
    if(pts.length<2) return '';
    var W=320,H=118,pad=14;
    var x0=1,x1=0,y0=1,y1=0;
    pts.forEach(function(p){ var X=mx(p[2]),Y=my(p[1]);
      if(X<x0)x0=X; if(X>x1)x1=X; if(Y<y0)y0=Y; if(Y>y1)y1=Y; });
    var dx=Math.max(1e-9,x1-x0), dy=Math.max(1e-9,y1-y0);
    var s=Math.min((W-pad*2)/dx,(H-pad*2)/dy);
    var ox=(W-dx*s)/2-x0*s, oy=(H-dy*s)/2-y0*s;
    var PX=function(lon){ return mx(lon)*s+ox; }, PY=function(lat){ return my(lat)*s+oy; };
    var d=smoothD(projPts(pts,PX,PY));
    var a0=pts[0], b0=pts[pts.length-1];
    return '<svg class="legsvg" viewBox="0 0 '+W+' '+H+'">'+
      '<path d="'+d+'" fill="none" stroke="var(--hair-2)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<path d="'+d+'" fill="none" stroke="var(--green)" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<circle cx="'+PX(a0[2]).toFixed(1)+'" cy="'+PY(a0[1]).toFixed(1)+'" r="4.5" fill="var(--card)" stroke="var(--text-3)" stroke-width="2"/>'+
      '<circle cx="'+PX(b0[2]).toFixed(1)+'" cy="'+PY(b0[1]).toFixed(1)+'" r="5.5" fill="'+stationColour(B)+'" stroke="var(--card)" stroke-width="2.2"/>'+
      '</svg>';
  }
  /* Rendered after the sheet exists so it can measure its own width; tiles
     need real pixels, unlike the pure-SVG profile beside it. */
  function drawLegMap(i){
    var host=document.getElementById('legMap'); if(!host||i<=0) return;
    var A=STATIONS[i-1], B=STATIONS[i];
    var pts=routeSlice(A.mi,B.mi); if(pts.length<2) return;
    var W=Math.max(120, host.clientWidth||300), H=118;
    var x0=1,x1=0,y0=1,y1=0;
    pts.forEach(function(p){ var X=mx(p[2]),Y=my(p[1]);
      if(X<x0)x0=X; if(X>x1)x1=X; if(Y<y0)y0=Y; if(Y>y1)y1=Y; });
    var dx=Math.max(1e-9,x1-x0), dy=Math.max(1e-9,y1-y0), pad=16;
    var z=Math.log2(Math.min((W-pad*2)/dx,(H-pad*2)/dy)/256);
    z=Math.max(1,Math.min(16,z));
    var v={ lat:ilat((y0+y1)/2), lon:ilon((x0+x1)/2), z:z };
    var P=projector(W,H,v);
    var base=BASES[MAPV.base]&&BASES[MAPV.base].url ? MAPV.base : 'satellite';
    var tiles=tilesForBox(P,0,0,W,H,base).map(function(t){
      return '<img src="'+tileURL(base,t.z,t.x,t.y)+'" decoding="async" style="position:absolute;left:'+
        t.left.toFixed(2)+'px;top:'+t.top.toFixed(2)+'px;width:'+t.size.toFixed(2)+'px;height:'+
        t.size.toFixed(2)+'px" onerror="this.style.visibility=\'hidden\'">';
    }).join('');
    var d=pathOf(pts,P);
    var a0=pts[0], b0=pts[pts.length-1];
    host.innerHTML='<div class="tiles" style="position:absolute;inset:0">'+tiles+'</div>'+
      '<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="position:absolute;left:0;top:0">'+
      '<path d="'+d+'" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<path d="'+d+'" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<circle cx="'+P.X(a0[2]).toFixed(1)+'" cy="'+P.Y(a0[1]).toFixed(1)+'" r="5" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="2"/>'+
      '<circle cx="'+P.X(b0[2]).toFixed(1)+'" cy="'+P.Y(b0[1]).toFixed(1)+'" r="6" fill="'+stationColour(B)+'" stroke="#fff" stroke-width="2.4"/>'+
      '</svg>';
  }
  function legCard(i){
    if(i<=0) return '<div class="legcard"><div class="legtop"><b>The start line</b>'+
      '<span>'+RACE.startSpot+', '+RACE.startShort+'</span></div></div>';
    var A=STATIONS[i-1], B=STATIONS[i], L=legInto(i);
    var net=B.elev-A.elev, loss=Math.max(0,(B.gain||0)-net);
    var sec=L.sec;
    return '<div class="legcard">'+
      '<div class="legtop"><b>'+A.name+' \u2192 '+B.name+'</b>'+
        '<span>'+A.mi.toFixed(1)+' to '+B.mi.toFixed(1)+' \u00b7 leg '+i+' of '+(STATIONS.length-1)+'</span></div>'+
      '<div class="legpanes">'+
        '<figure><div class="legmap" id="legMap"></div><figcaption>The ground</figcaption></figure>'+
        '<figure>'+legProfileSVG(i)+'<figcaption>'+ft(A.elev)+' \u2192 '+ft(B.elev)+' ft</figcaption></figure>'+
      '</div>'+
      '<div class="leggrid">'+
        '<div><b>'+L.mi+'</b><span>miles</span></div>'+
        '<div><b>'+ft(B.gain||0)+'</b><span>ft up</span></div>'+
        '<div><b>'+ft(loss)+'</b><span>ft down</span></div>'+
        '<div><b>'+(legPace(i)||'\u2014')+'</b><span>goal pace</span></div>'+
      '</div>'+
      '<div class="leggrid">'+
        '<div><b>'+dur(L.mins)+'</b><span>allow</span></div>'+
        '<div><b>'+clk(T(A))+'</b><span>leave</span></div>'+
        '<div><b>'+clk(T(B))+'</b><span>arrive</span></div>'+
        '<div><b>'+dur(T(STATIONS[i]))+'</b><span>elapsed</span></div>'+
      '</div>'+
      (sec?'<button class="legsec" data-legsec="'+sec.n+'">'+
        '<span class="pill '+(sec.ec==='gold'?'gold':sec.ec==='brick'?'red':'')+'">'+sec.effort+'</span>'+
        '<span class="lt">'+sec.title+'</span>'+CHEV+'</button>':'')+
      '</div>';
  }

  /* ── aid stations ── */
  function aidMapBtn(i){
    var s=STATIONS[i], x=AIDX[i]; if(!x||!x.ll) return '';
    var q=x.ll[0].toFixed(5)+','+x.ll[1].toFixed(5);
    var warn = NOMAP[RACE.noMapStop[s.name]||''];
    return (warn?'<div class="callout w"><b>Do not drive to this one.</b> '+warn+'</div>':'')+
      '<a class="btn '+(warn?'ghost':'')+'" style="text-decoration:none" target="_blank" rel="noopener" '+
      'href="https://www.google.com/maps/search/?api=1&query='+q+'">'+
      '<svg viewBox="0 0 24 24"><path d="M12 21.5s7-6 7-11.5a7 7 0 10-14 0c0 5.5 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.6"/></svg>'+
      (warn?'Show on the map':'Open in Maps')+'</a>'+
      '<button class="btn tint sm" data-copy="'+q+'" style="margin-bottom:10px">Copy '+q+'</button>';
  }
  function aidOv(i){ return (S.aidOv&&S.aidOv[i])||{}; }
  /* Game plan, what's here and notes are three separate things and each one
     starts empty. Nothing is pre-filled: stock copy in an editable field reads
     as something you already wrote and cannot be cleared. */
  var AID_FIELDS = [
    { k:'runner', who:'runner', label:RUNNER+'\u2019s note',
      hint:RUNNER+' writes this: what they want here, and the plan for the stop.' },
    { k:'crew',   who:'crew',   label:'Crew note',
      hint:'Anyone on the crew can write this. Food, kit, who is doing what.' }
  ];
  /* The runner owns their own note and can edit either; the crew edit theirs. Two
     people writing one field at 3am is how a plan gets lost. */
  function mayEdit(f){ return meIsRunner() || f.who==='crew'; }
  function aidField(i,k){ var o=aidOv(i); return (o&&typeof o[k]==='string')?o[k]:''; }
  function aidWho(i){ var o=aidOv(i); return o.who||[]; }
  function setAidOv(i,patch){
    S.aidOv=S.aidOv||{};
    var o=S.aidOv[i]||{};
    for(var k in patch){ if(patch[k]===null||patch[k]==='') delete o[k]; else o[k]=patch[k]; }
    if(!Object.keys(o).length) delete S.aidOv[i]; else S.aidOv[i]=o;
    save(); markDirty();
  }
  function aidHasAny(i){
    return AID_FIELDS.some(function(f){ return aidField(i,f.k); });
  }
  /* After an edit, repaint whichever surface is actually on screen. */
  function afterAidEdit(){
    MYJOB_HTML=null;                             /* the list itself changed */
    var fm=document.getElementById('mapFull');
    if(fm && fm.classList.contains('on')){ fullMapSheet(); fmBarPaint(); drawMap('mapHostF'); }
    else render();
  }
  function noteFieldsHTML(scope,id){
    return AID_FIELDS.filter(mayEdit).map(function(f){
      return '<div class="fld"><label>'+f.label+'</label>'+
        '<textarea id="af_'+f.k+'" placeholder="'+f.hint+'">'+esc(noteVal(scope,id,f.k))+'</textarea></div>';
    }).join('');
  }
  function noteFieldsRead(){
    var patch={};
    AID_FIELDS.filter(mayEdit).forEach(function(f){
      var el=document.getElementById('af_'+f.k);
      if(el) patch[f.k]=el.value.trim();
    });
    return patch;
  }
  /* A course section's notes, in the same sheet as a station's. */
  function editSec(n){
    var s=SECTIONS.filter(function(x){ return x.n===n; })[0];
    sheet('Notes \u00b7 '+(s?s.title:'Section '+n),
      (s?'<div class="cap" style="margin:-8px 0 12px">Section '+n+' of 12 \u00b7 '+
        s.from.toFixed(1)+'\u2013'+s.to.toFixed(1)+' mi</div>':'')+
      noteFieldsHTML('sec',n)+
      '<button class="btn" id="aSave">Save</button>'+
      (noteAny('sec',n)?'<button class="btn danger" id="aClear">Clear these notes</button>':''));
    document.getElementById('aSave').onclick=function(){
      setNoteVal('sec',n,noteFieldsRead()); closeSheet(); afterAidEdit();
    };
    var cl=document.getElementById('aClear');
    if(cl) cl.onclick=function(){
      var patch={};
      AID_FIELDS.filter(mayEdit).forEach(function(f){ patch[f.k]=null; });
      setNoteVal('sec',n,patch); closeSheet(); afterAidEdit();
    };
  }
  /* One place decides which editor a note button opens. */
  function openNoteEditor(tok){
    var p=String(tok).split(':');
    if(p[0]==='sec') editSec(+p[1]); else editAid(+p[1]);
  }
  /* Delegated once, at the document, so a note button works the same whether
     it was drawn into a tab, a bottom sheet or the map's side panel. Wiring
     it per render is how one surface ends up with a dead button. */
  document.addEventListener('click', function(e){
    var b=e.target.closest && e.target.closest('[data-editnote]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    openNoteEditor(b.dataset.editnote);
  }, true);

  /* One row per thing. Enter adds the next one, so a list can be typed
     without ever reaching for the mouse. */
  function gearRowHTML(v){
    return '<div class="gerow"><input type="text" class="gitm" value="'+esc(v||'')+
      '" placeholder="Add something"><button type="button" class="germ" '+
      'aria-label="Remove">\u00d7</button></div>';
  }
  function bindGearEditor(){
    var box=document.getElementById('gedit'); if(!box) return;
    function addRow(after){
      var d=document.createElement('div');
      d.innerHTML=gearRowHTML('');
      var row=d.firstChild;
      if(after && after.nextSibling) box.insertBefore(row, after.nextSibling);
      else box.appendChild(row);
      wire(row);
      row.querySelector('.gitm').focus();
    }
    function wire(row){
      row.querySelector('.germ').onclick=function(){
        row.parentNode.removeChild(row);
        if(!box.children.length) addRow();
      };
      row.querySelector('.gitm').onkeydown=function(e){
        if(e.key==='Enter'){ e.preventDefault(); addRow(row); }
        else if(e.key==='Backspace' && !this.value && box.children.length>1){
          e.preventDefault();
          var prev=row.previousSibling;
          row.parentNode.removeChild(row);
          if(prev) prev.querySelector('.gitm').focus();
        }
      };
    }
    Array.prototype.forEach.call(box.children, wire);
    var add=document.getElementById('gadd');
    if(add) add.onclick=function(){ addRow(); };
  }
  function gearEditorRead(){
    var box=document.getElementById('gedit'); if(!box) return null;
    return Array.prototype.slice.call(box.querySelectorAll('.gitm'))
      .map(function(el){ return el.value.trim(); })
      .filter(function(v){ return !!v; }).join('\n');
  }

  function editAid(i){
    var s=STATIONS[i], who=aidWho(i), cst=crewStopAt(i);
    sheet('Edit '+s.name,
      '<div class="cap" style="margin:-8px 0 12px">Mile '+s.mi.toFixed(1)+' \u00b7 '+clkDay(T(s))+
        ' \u00b7 '+dur(T(s))+' into the race</div>'+
      (cst
        ? '<div class="fld"><label>How long to get there</label>'+
          '<input id="afDrive" type="text" inputmode="numeric" value="'+
          (driveMins(cst)||'')+'" placeholder="minutes">'+
          '<p class="cap" style="margin:7px 0 0">Minutes, door to door. '+
          (NOMAP[cst.where]?'This one is on foot or by bike — allow for the walk.'
            :'Change it once you know the real drive.')+'</p></div>'
        : '')+
      '<div class="fld"><label>Who is crewing here'+
        (S.people.length?'<button class="linkbtn" id="whoAll">'+
          (who.length>=S.people.length?'Clear':'Everyone')+'</button>':'')+'</label>'+
      (S.people.length
        ? '<div class="whopick">'+sortedPeople().map(function(p){
            var on=who.indexOf(p.id)>=0;
            return '<label class="wpick pc'+personHue(p.id)+(on?' on':'')+'" title="'+esc(roleLabel(p))+'">'+
              '<input type="checkbox" class="aWho" value="'+p.id+'"'+(on?' checked':'')+'>'+
              '<span>'+esc(p.name)+'</span>'+
              (p.role==='pacer'?'<i>pacer</i>':'')+'</label>';
          }).join('')+'</div>'
        : '<p class="cap">Nobody on the team yet \u2014 add people on the Profile tab first.</p>')+'</div>'+
      noteFieldsHTML('aid',i)+
      '<div class="fld"><label>Bring</label>'+
        '<div class="gedit" id="gedit">'+
        (gearList(i).concat(['']).map(gearRowHTML).join(''))+'</div>'+
        '<button type="button" class="btn ghost sm" id="gadd" style="margin-top:9px">'+
        '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add item</button></div>'+
      '<button class="btn" id="aSave">Save</button>'+
      (aidHasAny(i)||who.length?'<button class="btn danger" id="aClear">Clear everything for this stop</button>':''));
    bindGearEditor();
    shEl.querySelectorAll('.wpick input').forEach(function(c){
      c.onchange=function(){ c.parentNode.classList.toggle('on', c.checked); paintWhoAll(); };
    });
    function paintWhoAll(){
      var b=document.getElementById('whoAll'); if(!b) return;
      var n=shEl.querySelectorAll('.aWho:checked').length;
      b.textContent = n>=S.people.length ? 'Clear' : 'Everyone';
    }
    var wa=document.getElementById('whoAll');
    if(wa) wa.onclick=function(){
      var all = shEl.querySelectorAll('.aWho:checked').length < S.people.length;
      shEl.querySelectorAll('.aWho').forEach(function(c){
        c.checked=all; c.parentNode.classList.toggle('on', all); });
      paintWhoAll();
    };
    document.getElementById('aSave').onclick=function(){
      var sel=Array.prototype.slice.call(shEl.querySelectorAll('.aWho:checked')).map(function(c){return c.value;});
      var patch=noteFieldsRead();
      var gv=gearEditorRead();
      if(gv!=null) patch.gear=gv;
      patch.who = sel.length?sel:null;
      var dv=document.getElementById('afDrive');
      if(cst && dv) setDrive(cst.n, dv.value.trim()===''?null:parseFloat(dv.value));
      setAidOv(i,patch);
      closeSheet(); afterAidEdit();
    };
    var cl=document.getElementById('aClear');
    if(cl) cl.onclick=function(){
      var patch={};
      AID_FIELDS.filter(mayEdit).forEach(function(f){ patch[f.k]=null; });
      patch.gear=null;
      /* only the runner clears the shared assignment and the pre-reshape keys */
      if(meIsRunner()){ patch.who=null; patch.plan=null; patch.has=null; patch.notes=null; }
      setAidOv(i,patch);
      closeSheet(); afterAidEdit();
    };
  }

  /* The shared course view for crew and pacers: where he is, the map, the
     profile, every aid station, then the section write-ups. */
  function renderCourse(){
    var el=document.getElementById('courseBody'); if(!el) return;
    el.innerHTML =
      livePanel({always:true})+
      '<div class="shead"><h2>Course map</h2><span class="note">tap to step through</span></div>'+
      '<div id="mapBody"></div>'+
      '<div class="card" style="padding:0;overflow:hidden">'+
        '<div id="readoutC" style="background:linear-gradient(158deg,var(--hero-hi),var(--hero-lo));color:#fff;'+
        'padding:12px 16px;display:flex;align-items:baseline;justify-content:space-between;gap:10px;min-height:50px"></div>'+
        '<svg id="profileC" style="display:block;width:100%;touch-action:none"></svg>'+
        '<div id="profLegendC"></div>'+
        '<div style="padding:10px 16px 12px;border-top:1px solid var(--hair);background:var(--sunken)" class="cap">'+
        'Drag along the profile to read the course. Tap to open that section. The grey band is the hours run in the dark.</div>'+
      '</div>'+
      '<div class="shead"><h2>Aid stations</h2><span class="note">17 check-ins</span></div>'+
      '<div class="list">'+STATIONS.map(function(s,i){
        var sp=splitOf(i), gone=sp&&sp.out!=null;
        var tags=[]; if(s.crew) tags.push('Crew'); if(s.pacer) tags.push('Pacer'); if(s.bag) tags.push('Bag');
        return '<div class="item'+(gone?' done':'')+'"><div class="lead num">'+(gone?'\u2713':s.mi.toFixed(0))+'</div>'+
          '<div class="mid"><div class="nm">'+s.name+'</div><div class="dt">mile '+s.mi.toFixed(1)+
          ' \u00b7 '+dur(T(s))+' in'+(tags.length?' \u00b7 '+tags.join(', '):'')+'</div></div>'+
          '<div class="rt"><div class="a num"'+(gone?' style="color:var(--green-ink)"':'')+'>'+clk(T(s))+'</div>'+
          '<div class="b">'+(gone?'logged':fD.format(new Date(START+T(s)*MIN)))+'</div></div></div>';
      }).join('')+'</div>'+
      '<div class="shead"><h2>Section by section</h2></div>'+
      '<div id="courseSecs"></div>';
    document.getElementById('courseSecs').innerHTML=SECTIONS.map(accFor).join('');
    bindAcc('#courseSecs');
    renderMap();
    initProfile('profileC');
    drawProfile('profileC'); resetReadout();
  }
  function renderAid(){
    var el=document.getElementById('aidList'); if(!el) return;
    var here=lastSplitIdx();
    var atStation = here>=0 && splitOf(here) && splitOf(here).out==null;
    el.innerHTML='<div class="list">'+STATIONS.map(function(s,i){
      var tags='';
      if(s.crew) tags+='<i class="tg c" title="Crew"></i>';
      if(s.pacer) tags+='<i class="tg p" title="Pacer swap"></i>';
      if(s.bag) tags+='<i class="tg b" title="Drop bag"></i>';
      var sp=splitOf(i), gone=sp&&sp.out!=null;
      var cur=(i===here&&atStation)||(here>=0&&!atStation&&i===here+1);
      var miss=s.cut!=null&&T(s)>s.cut;
      return '<button class="item'+(gone?' done':'')+(cur?' current':'')+'" data-aid="'+i+'">'+
        '<div class="lead num">'+(gone?'\u2713':s.mi.toFixed(0))+'</div>'+
        '<div class="mid"><div class="nm">'+s.name+
        (cur?' <span class="pill nowpill">'+(atStation?'here now':'next')+'</span>':'')+
        (aidHasAny(i)?' <span class="ndot" title="You have written something here"></span>':'')+
        (tags?' <span class="tgs">'+tags+'</span>':'')+'</div>'+
        '<div class="dt">'+s.mi.toFixed(1)+' mi'+
        (i>0?' · '+dur(T(s))+' in':'')+'</div></div>'+
        '<div class="rt"><div class="a num" style="color:'+(gone?'var(--green)':miss?'var(--red)':'inherit')+'">'+clk(T(s))+'</div>'+
        '<div class="b">'+(gone?'logged':miss?'misses cutoff':fD.format(new Date(START+T(s)*MIN)))+'</div></div>'+
        CHEV+'</button>';
    }).join('')+'</div>';
    el.querySelectorAll('[data-aid]').forEach(function(b){ b.onclick=function(){ openAid(+b.dataset.aid); }; });
  }
  function openAid(i){
    var s=STATIONS[i], x=AIDX[i]||{}, buf=s.cut!=null?s.cut-T(s):null;
    var who=[];
    who.push(s.crew?'<span class="pill">Crew allowed</span>':'<span class="pill grey">No crew</span>');
    if(HAS_PACERS) who.push(s.pacer?'<span class="pill gold">Pacer swap</span>':'<span class="pill grey">No pacer swap</span>');
    who.push(s.bag?'<span class="pill">Drop bag</span>':'<span class="pill grey">No drop bag</span>');
    sheet(s.name,
      '<div class="cap" style="margin:-8px 0 12px">Mile '+s.mi.toFixed(1)+' · '+ft(s.elev)+' ft · '+
        ft(cumGain(s.mi))+' ft climbed · <b>'+dur(T(s))+'</b> into the race</div>'+
      '<div class="metrics two'+((isRaceDay()||anySplits())?' three':'')+'" style="margin-top:0">'+
      '<div><div class="k">Planned arrival</div><div class="v num">'+clkDay(T(s))+'</div></div>'+
      '<div><div class="k">Must leave by</div><div class="v num" style="color:'+(s.cut!=null?'var(--red)':'var(--text-3)')+'">'+
        (s.cut!=null?clkDay(s.cut):'no cutoff')+'</div></div>'+
      ((isRaceDay()||anySplits())
        ? '<div><div class="k">Spare</div><div class="v num" style="color:'+(buf!=null&&buf<0?'var(--red)':'inherit')+'">'+(buf==null?'\u2014':dur(buf))+'</div></div>'
        : '')+'</div>'+
      legCard(i)+
      '<div class="paceline"><span>If you run…</span>'+
      PACELINE.map(function(l){ return '<b>'+l[0]+'</b> '+clk(s[l[1]]); }).join('')+'</div>'+
      '<div class="pills" style="margin-bottom:13px">'+who.join('')+'</div>'+
      logButtons(i,'tint')+
      (x.desc?'<p class="sec">'+x.desc+'</p>':'')+
      (crewAtStation(i).length
        ? '<div class="whoLine"><span class="lbl">On aid</span><span class="pchips">'+
          crewAtStation(i).map(function(q){ return personChip(q); }).join('')+'</span></div>'
        : '')+
      noteUnitHTML('aid', i, 'Edit notes and who is crewing')+
      (s.crew?'<div class="callout g"><b>Crew.</b> '+(s.crew===2?'On foot or by bicycle only — a vehicle here risks disqualification.'
        :s.crew===3?'Drop off and leave. There is no parking and the sheriff tickets and tows.'
        :'Vehicles and parking are fine here.')+'</div>':'')+
      aidMapBtn(i));
    drawLegMap(i);
    bindCopy(); bindLog();
    shEl.querySelectorAll('[data-legsec]').forEach(function(b){
      b.onclick=function(){ var n=+b.dataset.legsec;
        var s=SECTIONS.filter(function(x){return x.n===n;})[0];
        if(s) openSection(s); };
    });
  }
  function bindCopy(){
    document.querySelectorAll('[data-copy]').forEach(function(b){
      b.onclick=function(){
        var v=b.dataset.copy;
        if(navigator.clipboard) navigator.clipboard.writeText(v).catch(function(){});
        var old=b.textContent; b.textContent='Copied'; setTimeout(function(){b.textContent=old;},1200);
      };
    });
  }

  function followCard(){
    var F = RACE.copy.follow;
    return '<div class="card"><h3>Follow the race</h3>'+
      '<p class="sec">'+F.intro+'</p>'+
      F.links.map(function(l,n){
        return '<a class="btn tint" style="text-decoration:none'+(n===0?';margin-top:10px':'')+'" target="_blank" rel="noopener" href="'+l.url+'">'+l.label+'</a>';
      }).join('')+
      '<div class="callout n" style="margin-bottom:0">'+F.note+'</div></div>';
  }


  /* ── printable pre-race brief ──────────────────────────────────
     One source of truth: this is generated from the same data the app
     runs on, so it cannot drift from the plan. Print styles turn it
     into a paper handout, one per crew member. */
  function whoAt(n){ var w=crewAt(n); return w.length?nameList(w):'\u2014'; }
  function briefHTML(){
    var fin=T(STATIONS[STATIONS.length-1]);
    var pn=PLANS.filter(function(p){return p.k===S.plan;})[0].name;
    var h='';
    h+='<div class="brief">';
    h+='<div class="bhead"><div><h2>'+RACE.name+' \u2014 crew &amp; pacer plan</h2>'+
       '<p>'+RUNNER+' \u00b7 '+RACE.runner.division+' \u00b7 starts '+RACE.startLabel+' \u00b7 '+RACE.place+'</p></div>'+
       '<div class="bmeta"><b>'+pn+' '+dur(fin)+'</b><span>'+RACE.limitLabel+' \u00b7 finish by '+RACE.finishBy+'</span></div></div>';

    h+='<div class="brule"><h3>Three things that disqualify '+RUNNER+'</h3><ol>'+
       RACE.copy.briefRules+'</div>';

    h+='<h3 class="bsec">Crew rotation</h3><table class="btable"><thead><tr>'+
       '<th>#</th><th>Where</th><th>Mile</th><th>'+RUNNER+' arrives</th><th>Leave town by</th><th>Drive</th><th>Who</th><th>What to have ready</th></tr></thead><tbody>';
    CREW.forEach(function(c){
      var t=crewArrive(c), lv=leaveMins(c);
      h+='<tr'+(c.key?' class="key"':'')+'><td>'+c.n+'</td><td><b>'+c.where+'</b></td>'+
        '<td>'+(c.mi!=null?c.mi.toFixed(1):'\u2014')+'</td>'+
        '<td>'+(t!=null?clkDay(t):'\u2014')+'</td>'+
        '<td>'+(lv!=null?clkDay(lv):'\u2014')+'</td>'+
        '<td>'+driveShort(c)+'</td><td>'+whoAt(c.n)+'</td><td>'+
        esc(c.mi!=null?(noteVal('aid',idxOf(c.mi),'crew')||c.what):c.what)+'</td></tr>';
    });
    h+='</tbody></table>';

    h+='<h3 class="bsec">Pacer legs</h3><table class="btable"><thead><tr>'+
       '<th>Leg</th><th>Who</th><th>On at</th><th>Off at</th><th>Miles</th><th>Expect</th><th>Getting there and back</th></tr></thead><tbody>';
    pacerLegs().forEach(function(L,li){
      var nar=legNarrative(L), who=L.who?personById(L.who):null;
      h+='<tr><td>'+(li+1)+'</td><td><b>'+(who?esc(who.name):'\u2014')+'</b></td>'+
        '<td>'+L.from.name+'<br>'+clkDay(T(L.from))+'</td><td>'+L.to.name+'<br>'+clkDay(T(L.to))+'</td>'+
        '<td>'+L.mi.toFixed(1)+'</td><td>'+dur(L.mins)+'</td><td>'+nar.get+'</td></tr>';
    });
    h+='</tbody></table>';

    h+='<h3 class="bsec">Every aid station</h3><table class="btable tight"><thead><tr>'+
       '<th>Mile</th><th>Aid station</th><th>Planned</th><th>Cutoff</th><th>Crew</th>'+(HAS_PACERS?'<th>Pacer</th>':'')+'<th>Drop bag</th></tr></thead><tbody>';
    STATIONS.forEach(function(s){
      h+='<tr'+(s.crew?' class="key"':'')+'><td>'+s.mi.toFixed(1)+'</td><td><b>'+s.name+'</b></td>'+
        '<td>'+clkDay(T(s))+'</td><td>'+(s.cut!=null?clkDay(s.cut):'\u2014')+'</td>'+
        '<td>'+(s.crew===2?'foot/bike':s.crew===3?'drop only':s.crew?'yes':'\u2014')+'</td>'+
        (HAS_PACERS?'<td>'+(s.pacer?'swap':'\u2014')+'</td>':'')+'<td>'+(s.bag?'yes':'\u2014')+'</td></tr>';
    });
    h+='</tbody></table>';

    h+='<h3 class="bsec">Driving</h3><div class="bcols">';
    RACE.driveKeys.forEach(function(k){
      var d=DRIVES[k]; if(!d) return;
      h+='<div class="bcard"><h4>'+k+' <span>'+d.t+'</span></h4><p>'+d.d+'</p>'+
        (d.warn?'<p class="bwarn">'+d.warn+'</p>':'')+'</div>';
    });
    h+='</div>';

    h+='<h3 class="bsec">Weekend schedule</h3><table class="btable tight"><tbody>';
    EVENTS.filter(function(e){return e.iso>'2026-09-16';}).forEach(function(e){
      h+='<tr'+(e.key?' class="key"':'')+'><td style="white-space:nowrap">'+
        fD.format(new Date(tzMs(e.iso)))+' '+tOf(new Date(tzMs(e.iso)))+'</td>'+
        '<td><b>'+esc(e.t)+'</b>'+(e.d?'<br><span class="bdim">'+esc(e.d)+'</span>':'')+'</td></tr>';
    });
    S.custom.forEach(function(e){
      h+='<tr><td style="white-space:nowrap">'+fD.format(new Date(tzMs(e.iso)))+' '+
        tOf(new Date(tzMs(e.iso)))+'</td><td><b>'+esc(e.t)+'</b>'+
        (e.d?'<br><span class="bdim">'+esc(e.d)+'</span>':'')+'</td></tr>';
    });
    h+='</tbody></table>';

    h+='<h3 class="bsec">The team</h3><table class="btable tight"><tbody>';
    if(S.people.length) sortedPeople().forEach(function(p){
      h+='<tr'+(p.role==='chief'?' class="key"':'')+'><td><b>'+esc(p.name)+'</b></td><td>'+
        roleLabel(p).replace(' \u00b7 ',', ')+'</td><td>'+esc(p.phone||'')+'</td></tr>';
    });
    else h+='<tr><td colspan="3" class="bdim">Nobody added yet \u2014 add the team on the Profile tab and reprint.</td></tr>';
    h+='</tbody></table>';

    h+='<div class="bfoot">Times shown on the <b>'+pn+'</b> schedule ('+dur(fin)+'). '+
       'If '+RUNNER+' is running behind, every time here shifts later by roughly the same amount. '+
       'Cutoffs are fixed and are the times the runner must <i>leave</i> by. '+
       'Generated from the race plan app \u00b7 official times from the 2026 Runner\u2019s Manual v1.1.</div>';
    h+='</div>';
    return h;
  }
  function buildBrief(){
    return '<p class="sec no-print" style="margin-bottom:12px">Everything a crew member needs on one sheet, built from the plan so it cannot drift. Print one each.</p>'+
      '<div class="btn-row"><button class="btn" id="printBrief">Print / save as PDF</button>'+
      '<button class="btn tint" id="briefPlan">Change schedule</button></div>'+
      '<div id="briefBody">'+briefHTML()+'</div>';
  }


  /* ═══════════════ SYNC ═══════════════
     localStorage stays the source of truth for rendering, so the app
     works identically with no signal. Supabase is a layer on top:
     push what changed, pull what others changed. Every write hits
     local first and the network second, so a failed request can
     never lose data. */
  var SB = { status:'idle', last:0, stamp:null, dirty:false, timer:null, poll:null, err:null };

  /* What lives in the shared plan. Gear ticks and "who am I on this
     phone" stay local — ten people toggling one packing list is chaos,
     and identity is per-device by definition. */
  function sharedOut(){
    return { people:S.people, aidOv:S.aidOv, secOv:S.secOv, driveOv:S.driveOv, notes:S.notes, custom:S.custom, atomWho:S.atomWho,
             bib:S.bib||'', plan:S.plan, paceOv:S.paceOv||{}, fuelOv:S.fuelOv||{} };
  }
  function sharedIn(o){
    if(!o||typeof o!=='object') return false;
    if(Array.isArray(o.people)) S.people=o.people;
    if(o.aidOv&&typeof o.aidOv==='object') S.aidOv=o.aidOv;
    if(o.notes&&typeof o.notes==='object') S.notes=o.notes;
    if(o.secOv&&typeof o.secOv==='object') S.secOv=o.secOv;
    if(o.driveOv&&typeof o.driveOv==='object') S.driveOv=o.driveOv;
    if(Array.isArray(o.custom)) S.custom=o.custom;
    if(typeof o.bib==='string') S.bib=o.bib;
    if(o.atomWho&&typeof o.atomWho==='object') S.atomWho=o.atomWho;
    if(o.plan&&PLANS.some(function(p){return p.k===o.plan;})) S.plan=o.plan;
    if(o.paceOv&&typeof o.paceOv==='object') S.paceOv=o.paceOv;
    if(o.fuelOv&&typeof o.fuelOv==='object') S.fuelOv=o.fuelOv;
    return true;
  }
  function whoAmI(){
    var p=S.people.filter(function(x){return x.id===S.me;})[0];
    if(p) return p.name;
    return meIsRunner() ? RUNNER : 'someone';
  }
  function sbHead(extra){
    var h={ 'apikey':SUPA.key, 'Authorization':'Bearer '+SUPA.key, 'Content-Type':'application/json' };
    for(var k in (extra||{})) h[k]=extra[k];
    return h;
  }
  function sbUrl(p){ return SUPA.url.replace(/\/+$/,'')+p; }
  function sbStatus(s,e){ SB.status=s; SB.err=e||null; paintSync(); }

  function markDirty(){
    SB.dirty=true; paintSync();
    clearTimeout(SB.timer);
    SB.timer=setTimeout(function(){ syncNow(); }, 1500);   // debounce typing
  }

  function pullPlan(){
    return fetch(sbUrl('/rest/v1/plan?id=eq.current&select=data,updated_at'), { headers:sbHead() })
      .then(function(r){ if(!r.ok) throw new Error('plan '+r.status); return r.json(); })
      .then(function(rows){
        var row=rows&&rows[0]; if(!row) return false;
        if(row.updated_at===SB.stamp) return false;      // nothing new
        SB.stamp=row.updated_at;
        var changed=sharedIn(row.data);
        /* a phone opening the link for the first time has no team list until
           this lands, so the name picker has to be redrawn when it does */
        if(document.getElementById('gate').classList.contains('on')) renderGate();
        return changed;
      });
  }
  function pushPlan(){
    return fetch(sbUrl('/rest/v1/plan?id=eq.current'), {
      method:'PATCH',
      headers:sbHead({ 'Prefer':'return=representation' }),
      body:JSON.stringify({ data:sharedOut(), updated_by:whoAmI() })
    }).then(function(r){ if(!r.ok) throw new Error('push '+r.status); return r.json(); })
      .then(function(rows){ if(rows&&rows[0]) SB.stamp=rows[0].updated_at; return true; });
  }
  function pullSplits(){
    return fetch(sbUrl('/rest/v1/splits?select=*'), { headers:sbHead() })
      .then(function(r){ if(!r.ok) throw new Error('splits '+r.status); return r.json(); })
      .then(function(rows){
        /* MERGE, never replace. A device can hold a split logged in a dead
           zone that the server has not seen yet; a bare assignment here would
           delete it the moment signal came back. Remote wins per station,
           local-only stations survive and get pushed. */
        var remote={};
        (rows||[]).forEach(function(r){
          var o={};
          if(r.arrived_min!=null) o.in=+r.arrived_min;
          if(r.left_min!=null) o.out=+r.left_min;
          if(r.source) o.src=r.source;
          if(o.in!=null||o.out!=null) remote[r.station]=o;
        });
        var merged={}, k;
        for(k in S.splits) merged[k]=S.splits[k];
        for(k in remote) merged[k]=remote[k];
        var unsent=Object.keys(S.splits).filter(function(x){ return !(x in remote); });
        var changed=JSON.stringify(merged)!==JSON.stringify(S.splits);
        S.splits=merged; ls(KEY+'splits',JSON.stringify(S.splits));
        unsent.forEach(pushSplit);
        return changed;
      });
  }
  /* Splits upsert one row at a time so two people logging different
     stations at the same moment cannot overwrite each other. */
  function pushSplit(i){
    if((DEMO&&DEMO.on) || !(SUPA&&SUPA.url)) return Promise.resolve(false);
    var sp=S.splits[i];
    var req = sp
      ? fetch(sbUrl('/rest/v1/splits'), {
          method:'POST',
          headers:sbHead({ 'Prefer':'resolution=merge-duplicates,return=minimal' }),
          body:JSON.stringify({ station:+i, arrived_min:sp.in==null?null:sp.in,
                                left_min:sp.out==null?null:sp.out,
                                source:sp.src||'crew', updated_by:whoAmI() }) })
      : fetch(sbUrl('/rest/v1/splits?station=eq.'+(+i)), { method:'DELETE', headers:sbHead() });
    return req.then(function(r){ if(!r.ok) throw new Error('split '+r.status); return true; })
      .catch(function(e){ sbStatus('error', e.message); });
  }

  function syncNow(manual){
    if(SB.status==='syncing') return Promise.resolve();
    if(!navigator.onLine){ sbStatus('offline'); return Promise.resolve(); }
    sbStatus('syncing');
    var job = SB.dirty ? pushPlan().then(function(){ SB.dirty=false; return true; }) : pullPlan();
    return job
      .then(function(changed){ return pullSplits().then(function(c2){ return changed||c2; }); })
      .then(function(changed){
        SB.last=Date.now(); sbStatus('ok');
        save();
        if(changed||manual){ reproject(); render(); }
      })
      .catch(function(e){ sbStatus(navigator.onLine?'error':'offline', e.message); });
  }

  function paintSync(){
    document.querySelectorAll('[data-sync]').forEach(function(el){
      var t,c;
      if(SB.status==='syncing'){ t='Syncing\u2026'; c='grey'; }
      else if(SB.status==='offline'){ t='Offline'; c='grey'; }
      else if(SB.status==='error'){ t='Sync failed'; c='red'; }
      else if(SB.dirty){ t='Unsaved'; c='gold'; }
      else if(SB.last){
        var m=Math.round((Date.now()-SB.last)/60000);
        t = m<1?'Synced just now':(m<60?'Synced '+m+'m ago':'Synced '+Math.round(m/60)+'h ago');
        c='';
      } else { t='Not synced'; c='grey'; }
      el.textContent=t; el.className='pill '+c;
    });
  }

  /* Kandu, via the edge function. Arrivals only — mats cannot record
     a departure, and the cutoffs are enforced on departure. */
  function pullKandu(){
    if(!S.bib) return Promise.resolve(false);
    return fetch(sbUrl('/functions/v1/runner?bib='+encodeURIComponent(S.bib)+'&db='+encodeURIComponent(SUPA.db)),
                 { headers:sbHead() })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(!j||!j.ok||!j.arrivals) return false;
        var touched=[];
        Object.keys(j.arrivals).forEach(function(k){
          var i=+k, mins=j.arrivals[k], sp=S.splits[i];
          if(sp&&sp.in!=null) return;                    // crew already logged it
          S.splits[i]=Object.assign({}, sp||{}, { in:mins, src:'kandu' });
          touched.push(i);
        });
        if(!touched.length) return false;
        ls(KEY+'splits',JSON.stringify(S.splits));
        touched.forEach(pushSplit);
        return true;
      })
      .catch(function(){ return false; });
  }

  function startSync(){
    if(!SUPA||!SUPA.url||SUPA.url.indexOf('http')!==0) return;
    syncNow();
    clearInterval(SB.poll);
    SB.poll=setInterval(function(){
      syncNow();
      if(isRaceDay()){
        pullKandu().then(function(c){ if(c){ reproject(); render(); } });
        if(!gpsOn()) pullGPS().then(function(c){ if(c) paintGPS(); });
      }
    }, isRaceDay()? 45000 : 300000);
    window.addEventListener('online', function(){ sbStatus('idle'); syncNow(); });
    window.addEventListener('offline', function(){ sbStatus('offline'); });
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) syncNow(); });
  }

  /* ── sharing ── */
  function makeLink(mode){
    var code=btoa(unescape(encodeURIComponent(JSON.stringify({e:S.custom,p:S.people}))));
    return location.origin+location.pathname+'?'+mode+'#add='+code;
  }
  function shareIt(mode,title,body){
    var url=makeLink(mode);
    if(navigator.share){ navigator.share({title:title,url:url}).catch(function(){}); return; }
    if(navigator.clipboard) navigator.clipboard.writeText(url).catch(function(){});
    sheet(title,'<p class="sec">'+body+'</p>'+
      '<div class="fld"><textarea readonly style="min-height:120px;font-size:14px">'+esc(url)+'</textarea></div>'+
      '<p class="cap">Copied to your clipboard, if the browser allowed it.</p>');
  }
  function checkIncoming(){
    var m=location.hash.match(/add=([^&]+)/); if(!m) return;
    var inc; try{ inc=JSON.parse(decodeURIComponent(escape(atob(m[1])))); }catch(e){ return; }
    if(!inc) return;
    var ev=(inc.e||[]).filter(function(x){return !S.custom.some(function(y){return y.id===x.id;});});
    var pp=(inc.p||[]).filter(function(x){return !S.people.some(function(y){return y.id===x.id;});});
    var clean=function(){ history.replaceState(null,'',location.pathname+location.search);
      document.getElementById('shareBanner').innerHTML=''; };
    if(!ev.length&&!pp.length){ clean(); return; }
    var bits=[];
    if(pp.length) bits.push(pp.length+' '+(pp.length>1?'people':'person'));
    if(ev.length) bits.push(ev.length+' schedule '+(ev.length>1?'items':'item'));
    document.getElementById('shareBanner').innerHTML=
      '<div class="banner"><p><b>'+RUNNER+' shared '+bits.join(' and ')+' with you.</b></p>'+
      '<div class="btn-row" style="margin:10px 0 0"><button class="btn sm" id="mergeYes">Add them</button>'+
      '<button class="btn ghost sm" id="mergeNo">No thanks</button></div></div>';
    document.getElementById('mergeYes').onclick=function(){
      S.custom=S.custom.concat(ev); S.people=S.people.concat(pp); save(); clean(); render(); };
    document.getElementById('mergeNo').onclick=clean;
  }

  function doShareCrew(){
    if(!S.people.length){ sheet('Nobody added yet','<p class="sec">Add your crew and pacers first, then this makes a link that puts the whole team list on their phones.</p>'); return; }
    shareIt('crew','Crew link','Everyone gets the team list and your schedule additions, and lands straight in the crew view.');
  }
  function doSharePacer(){
    shareIt('pacer','Pacer link','Send this to your pacers. It opens straight into the pacer view where they pick their name and see only their leg.');
  }
  function cacheManual(btnId,msgId){
    var b=document.getElementById(btnId); if(!b) return;
    b.onclick=function(){
      var m=document.getElementById(msgId);
      if(!('caches' in window)){ m.textContent='This browser cannot save it. Open the app from the web link rather than a downloaded file.'; return; }
      m.textContent='Downloading, this takes a moment…';
      caches.open(RACE.key+'-docs-v1').then(function(c){return c.add(RACE.manualFile);})
        .then(function(){ m.textContent='Saved. It will open with no signal.'; })
        .catch(function(){ m.textContent='That did not work. Check your connection and try again.'; });
    };
  }

/*@modules*/
  function render(){
    reproject();
    document.body.classList.toggle('raceday', isRaceDay());
    paintClock();
    renderPlanPicker(); drawProfile(); resetReadout();
    renderMyJob(); renderRace(); renderSections(); renderAid(); renderProfile();
    renderSched(); renderNow(); renderKnow();
  }

  /* ── boot ── */
  S.checks=jget(KEY+'checks',{}); S.custom=jget(KEY+'custom',[]); S.people=jget(KEY+'people',null);
  if(!Array.isArray(S.people)) S.people=(!(SUPA&&SUPA.url)&&RACE.demoPeople)?RACE.demoPeople.filter(function(p){ return HAS_PACERS||p.role!=='pacer'; }).map(function(p){ return JSON.parse(JSON.stringify(p)); }):[];
  S.gearAdd=jget(KEY+'gearadd',{}); S.gearRemoved=jget(KEY+'gearrm',{}); S.gearOverride=jget(KEY+'gearov',{});
  S.paceOv=jget(KEY+'paceov',{}); S.fuelOv=jget(KEY+'fuelov',{});
  S.notes=jget(KEY+'notes',{}); S.splits=jget(KEY+'splits',{}); S.aidOv=jget(KEY+'aidov',{});
  S.secOv=jget(KEY+'secov',{}); S.driveOv=jget(KEY+'driveov',{});
  /* section notes used to be a single unlabelled box called "Your notes",
     written only by the runner. Move them into the runner channel so there is one
     note model in the app; the originals stay put. */
  (function(){
    var moved=false;
    Object.keys(S.notes||{}).forEach(function(k){
      var m=/^sec(\d+)$/.exec(k); if(!m) return;
      var n=m[1];
      if(S.secOv[n] && typeof S.secOv[n].runner==='string') return;
      if(!String(S.notes[k]||'').trim()) return;
      S.secOv[n]=S.secOv[n]||{}; S.secOv[n].runner=S.notes[k]; moved=true;
    });
    if(moved) ls(KEY+'secov',JSON.stringify(S.secOv));
  })();
  /* earlier builds kept one note per station under notes['aid<N>']; move it
     into the new three-field shape so nothing written so far is lost */
  (function(){
    var moved=false;
    Object.keys(S.notes||{}).forEach(function(k){
      var m=/^aid(\d+)$/.exec(k); if(!m) return;
      S.aidOv[m[1]]=S.aidOv[m[1]]||{};
      if(!S.aidOv[m[1]].notes) S.aidOv[m[1]].notes=S.notes[k];
      delete S.notes[k]; moved=true;
    });
    /* Three fields become one runner channel. The old keys are deliberately
       left where they are: this is a reshape, and a reshape that deletes the
       only copy of someone's race plan is not one worth making. */
    Object.keys(S.aidOv||{}).forEach(function(i){
      var o=S.aidOv[i]; if(!o || typeof o.runner==='string') return;
      var parts=['plan','has','notes'].map(function(k){ return o[k]; })
        .filter(function(v){ return typeof v==='string' && v.trim(); });
      if(parts.length){ o.runner=parts.join('\n'); moved=true; }
    });
    if(moved){ ls(KEY+'notes',JSON.stringify(S.notes)); ls(KEY+'aidov',JSON.stringify(S.aidOv)); }
  })();
  /* "Bring" was a third note channel: real content, shown like a note, and
     editable by nobody. It is what the crew brings and does, which is the
     crew note's job, so it moves there once and becomes editable. Seeded only
     into an empty channel, and only once -- clearing a note must not bring
     the old text back on the next load. */
  if(!ls(KEY+'bringmoved')){
    var bmoved=false;
    CREW.forEach(function(c){
      if(c.mi==null || !c.what) return;
      var i=idxOf(c.mi); if(i<0) return;
      S.aidOv[i]=S.aidOv[i]||{};
      if(typeof S.aidOv[i].crew!=='string' || !S.aidOv[i].crew.trim()){
        S.aidOv[i].crew=c.what; bmoved=true;
      }
    });
    ls(KEY+'bringmoved','1');
    if(bmoved) ls(KEY+'aidov',JSON.stringify(S.aidOv));
  }
  /* Last build put the old "Bring" sentence into the crew note. Half of them
     are comma lists -- "Warm layer, hot drink, real food, the night kit" --
     which is a packing list written sideways. Split those into the gear list
     and leave the prose ones where they are. Only touches a crew note that
     is still word-for-word the shipped text, so an edited one is never lost. */
  if(!ls(KEY+'gearsplit')){
    var gmoved=false;
    CREW.forEach(function(c){
      if(c.mi==null || !c.what || c.what.indexOf(',')<0) return;
      var i=idxOf(c.mi); if(i<0) return;
      var o=S.aidOv[i]; if(!o) return;
      if(o.crew!==c.what) return;                 /* somebody has edited it */
      if(typeof o.gear==='string' && o.gear.trim()) return;
      o.gear = c.what.replace(/\.\s*$/,'').split(',')
        .map(function(x){ return x.trim().replace(/^and\s+/i,''); })
        .filter(Boolean)
        .map(function(x){ return x.charAt(0).toUpperCase()+x.slice(1); })
        .join('\n');
      delete o.crew;
      gmoved=true;
    });
    ls(KEY+'gearsplit','1');
    if(gmoved) ls(KEY+'aidov',JSON.stringify(S.aidOv));
  }
  S.bib=ls(KEY+'bib')||''; MAPV.base=ls(KEY+'base')||'satellite';
  if(!BASES[MAPV.base]) MAPV.base='satellite'; S.theme=ls(KEY+'theme')||'light'; S.proj=ls(KEY+'proj')||'smart'; S.gps=ls(KEY+'gps')==='1'; S.atomWho=jget(KEY+'atomwho',{});
  try{ GPS.last=JSON.parse(ls(KEY+'gpslast')||'null'); }catch(e){}
  STATIONS.forEach(function(s,i){ s.__i=i; });
  S.plan=ls(KEY+'plan')||'goal'; S.me=ls(KEY+'me')||null; if(S.me==='will') S.me='runner';   /* id from before this was a template */
  /* ?crew and ?pacer are still accepted so links already sent keep working.
     They no longer pick an interface -- there is only one. */
  S.mode='runner';
  document.getElementById('addEvent').onclick=function(){ editEvent(null); };
  document.getElementById('shareSched').onclick=function(){
    if(!S.custom.length&&!S.people.length){ sheet('Nothing to share yet','<p class="sec">Add a schedule item or a team member first.</p>'); return; }
    shareIt('crew','Share the plan','Send this to the crew. Opening it adds your schedule items and team list, and puts them straight into the crew view.');
  };

  document.getElementById('hidePast').onclick=function(){ S.hidePast=!S.hidePast; renderSched(); };
  cacheManual('cacheManual','cacheMsg'); cacheManual('cacheManual3','cacheMsg3');
  initProfile('profile'); initProfile('profileC');

  var nav=document.getElementById('nav');
  /* Two thresholds, not one. The hairline appears as soon as anything moves;
     the title only slides in once the H1 it duplicates is actually gone. */
  window.navScroll=function navScroll(){
    var y=window.scrollY||window.pageYOffset||0;
    nav.classList.toggle('stuck', y>4);
    /* several .phead h1 exist at once, one per page, and all but the visible
       one are display:none with a zero rect. Take the one that is on screen. */
    var h1=null, hs=document.querySelectorAll('.phead h1');
    for(var q=0;q<hs.length;q++){ if(hs[q].offsetParent){ h1=hs[q]; break; } }
    nav.classList.toggle('titled', !!h1 && h1.getBoundingClientRect().bottom < 44);
  };
  window.addEventListener('scroll',window.navScroll,{passive:true});

  /* iOS ignores user-scalable=no, but it does honour a cancelled gesture
     event, and this is the only thing that actually stops a pinch from
     zooming the whole interface on an iPhone. */
  /* five tab icons floating on top of the keyboard is the most webby thing a
     phone screen can do. The bar drops away while a field has focus. */
  document.addEventListener('focusin', function(e){
    var t=e.target&&e.target.tagName;
    if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT') document.body.classList.add('kbd');
  });
  document.addEventListener('focusout', function(){ document.body.classList.remove('kbd'); });

  ['gesturestart','gesturechange','gestureend'].forEach(function(ev){
    document.addEventListener(ev, function(e){ e.preventDefault(); }, {passive:false});
  });

  if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){
    navigator.serviceWorker.register('sw.js').then(function(){ SWOK=true; swBadge(); })
      .catch(function(){ SWOK=false; swBadge(); });
  } else { SWOK=false; swBadge(); }

  var rt; window.addEventListener('resize',function(){ clearTimeout(rt);
    rt=setTimeout(function(){ drawProfile(); },160); });

  applyTheme();
  demoInit();
  if(S.gps) gpsStart();
  if(S.me) startApp(); else openGate();
  startSync();
  setInterval(paintSync, 30000);
  window.addEventListener('popstate', function(){
    var fm=document.getElementById('mapFull');
    if(fm&&fm.classList.contains('on')){ fullMapClose(); return; }
    if(modal.classList.contains('on')){ closeSheet(); return; }
    if(detailKey){ closeDetail(); return; }
    if(SUBV) popSub();
  });
  checkIncoming();
  setInterval(paintClock,1000);
  setInterval(function(){ renderMyJob(); renderRace(); renderNow(); }, 20000);
  setInterval(function(){ paintEtas(); }, 30000);
})();
