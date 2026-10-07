  /* ════════════ NOW ════════════
     The one screen a crew member or pacer needs on race day. Top to bottom it
     answers, in the order they get asked in a car park at 2 am:
       where do I need to be, and when     the stop, the ETA and its honest range
       can I trust that                    what was last seen, how long ago, by whom
       where is the runner right now       the course strip, with the range drawn on it
       what happens after this             the stops that follow
     and it is where a sighting gets logged, with one tap, stamped at the tap. */
  var NOW_HTML=null;
  var OFFM = +new Intl.DateTimeFormat('en-US',{timeZone:RACE.tz,minute:'numeric'}).format(new Date(START));
  var NI = {
    pin:'<path d="M12 21.5s7-6 7-11.5a7 7 0 10-14 0c0 5.5 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.6"/>',
    send:'<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="18" r="1.3"/>'
  };
  function nico(k){ return '<svg viewBox="0 0 24 24">'+NI[k]+'</svg>'; }
  function shortName(s){ return s.name.replace(/\s+—.*$/,''); }
  /* "2:14" and "am" apart, so the figure can be set large and the suffix small */
  function clkParts(m){ var t=clk(m), sp=t.lastIndexOf(' '); return sp<0?[t,'']:[t.slice(0,sp), t.slice(sp+1)]; }
  function bigClock(m){ var p=clkParts(m); return '<b class="num">'+p[0]+'</b><i>'+p[1]+'</i>'; }

  /* Has the runner already gone through station si? Logged sightings decide it
     when there are any; with none, the plan and the clock have to. */
  function stopPassed(si){
    var L=STATIONS.length-1, last=lastSplitIdx();
    if(last>=0){
      if(si<last) return true;
      if(si>last) return false;
      var sp=splitOf(last);
      return si===L ? true : !!(sp && sp.out!=null);
    }
    return now() > T(STATIONS[si]) + (si===0?5:40);
  }
  function myStops(){
    var me=mePerson(), vis=visibleCrew().filter(function(c){ return c.mi!=null && idxOf(c.mi)>=0; });
    var mine=vis.filter(function(c){ return isMineStop(c, me); });
    return mine.length?mine:vis;
  }
  /* What this person is waiting for: a crew stop, or the end of a pacer's leg. */
  function nowTarget(){
    var me=mePerson(), k;
    if(me && me.role==='pacer'){
      var legs=legsForPerson(me.id);
      for(k=0;k<legs.length;k++){
        var fi=idxOf(legs[k].from.mi), ti=idxOf(legs[k].to.mi);
        if(!stopPassed(fi)) return { kind:'pstart', si:fi, leg:legs[k], c:crewStopAt(fi) };
        if(!stopPassed(ti)) return { kind:'pend', si:ti, leg:legs[k], c:crewStopAt(ti) };
      }
    }
    var st=myStops();
    for(k=0;k<st.length;k++){
      var si=idxOf(st[k].mi);
      if(!stopPassed(si)) return { kind:'crew', si:si, c:st[k], k:k, n:st.length };
    }
    return null;
  }
  function laterStops(t){
    var out=[], st=myStops();
    st.forEach(function(c){ var si=idxOf(c.mi); if(t && si>t.si) out.push({ si:si, c:c }); });
    var L=STATIONS.length-1;
    if(t && t.si<L && !out.some(function(o){ return o.si===L; })) out.push({ si:L, c:crewStopAt(L) });
    return out;
  }

  /* ── the range, drawn ── */
  function rangeBar(p, drive, edge){
    if(p.lo==null) return '';
    var nm=now(), go=drive?edge-drive:null;
    var a=Math.min(nm, go!=null?go:nm, edge, p.lo), b=Math.max(p.hi, nm);
    var pad=Math.max(6,(b-a)*0.07); a-=pad; b+=pad;
    function x(m){ return ((m-a)/(b-a)*100).toFixed(2)+'%'; }
    function w(m1,m2){ return (Math.max(0,m2-m1)/(b-a)*100).toFixed(2)+'%'; }
    var span=b-a, step=span>600?180:span>300?120:span>100?60:span>40?30:15, ticks='';
    for(var m=Math.ceil((a+OFFM)/step)*step-OFFM; m<b; m+=step){
      if(m<a+span*0.03 || m>b-span*0.03) continue;
      ticks+='<i style="left:'+x(m)+'"><s>'+clk(m).replace(':00','')+'</s></i>';
    }
    return '<div class="nw-range" aria-hidden="true"><div class="nw-track">'+
      (go!=null && go<edge ? '<div class="nw-drive" style="left:'+x(go)+';width:'+w(go,edge)+'"></div>' : '')+
      '<div class="nw-band" style="left:'+x(p.lo)+';width:'+w(p.lo,p.hi)+'"></div>'+
      '<div class="nw-mid" style="left:'+x(p.min)+'"></div>'+
      '<div class="nw-pin" style="left:'+x(nm)+'"><s>now</s></div>'+
      '</div><div class="nw-ticks">'+ticks+'</div></div>';
  }

  /* ── log buttons for the station the hero is about ── */
  function nowLogHTML(si){
    var sp=splitOf(si)||{}, L=STATIONS.length-1, name=esc(RUNNER);
    if(si===0 || now()<0) return '';
    if(sp.in==null && sp.out==null){
      /* the big buttons appear when the runner could plausibly walk in; before
         that they are a mis-tap waiting to happen, and Checkpoints has the door */
      var p=etaOf(si), open=(p.lo!=null?p.lo-0.5*(p.min-p.lo):p.min)-40;
      if(now()<open) return '';
      return '<div class="nw-log"><button class="btn" data-nlog="'+si+':in">'+nico('check')+name+' is here</button>'+
        (si<L?'<button class="btn tint" data-nlog="'+si+':out">'+name+' left</button>':'')+'</div>';
    }
    if(sp.out==null && si<L){
      return '<div class="nw-logged">'+nico('check')+'<span>Arrived <b class="num">'+clk(sp.in)+'</b> · in the station '+dur(Math.max(0,now()-sp.in))+'</span></div>'+
        '<div class="nw-log"><button class="btn" data-nlog="'+si+':out">'+name+' left</button></div>';
    }
    return '';
  }

  function heroHTML(t){
    var s=STATIONS[t.si], c=t.c, p=etaOf(t.si), nm=now(), L=STATIONS.length-1;
    var drive=c?driveMins(c):0, sp=splitOf(t.si)||{}, here=sp.in!=null;
    var eyebrow = t.kind==='pstart' ? 'You start pacing here'
                : t.kind==='pend'   ? 'Your leg ends here'
                : t.si===L ? 'The finish' : 'Your next stop · '+(t.k+1)+' of '+t.n;
    var place = c ? c.where : shortName(s);
    var left=p.min-nm, sub;
    if(here) sub=esc(RUNNER)+' is in the station';
    else if(p.src==='plan') sub='On the plan · no checkpoints yet';
    else if(left>=0) sub=esc(RUNNER)+' expected in <b>'+dur(left)+'</b>';
    else if(p.hi!=null && nm<=p.hi) sub='Due any minute · still inside the range';
    else sub='<b>'+dur(-left)+' past</b> the expected time';

    /* The number the crew act on is the early edge, not the middle, and a
       missed runner costs far more than ten minutes of waiting. So "be in
       place by" sits half a band earlier than the range itself: on the one
       race this was checked against, the runner beat the plain early edge at
       four of twelve mats and beat this one at one. */
    var edge=p.lo!=null ? p.lo-0.5*(p.min-p.lo) : p.min-10;
    var go='';
    if(!here && drive && nm>=-720){
      var hand=edge-nm-drive;
      var cls=hand>30?'calm':hand>=0?'soon':'late';
      var head=hand>30?dur(hand)+' in hand':hand>=0?'Time to go':'Go now';
      var body=hand>=0
        ? 'Leave now and you are there <b class="num">'+clk(nm+drive)+'</b>. Be in place by <b class="num">'+clk(edge)+'</b>, in case '+esc(RUNNER)+' is early.'
        : 'It is a '+driveShort(c)+' drive, and '+esc(RUNNER)+' could be in from <b class="num">'+clk(edge)+'</b>.';
      go='<div class="nw-go '+cls+'"><b>'+head+'</b><span>'+body+'</span></div>';
    }
    var facts='';
    if(p.lo!=null) facts+='<div class="wide"><span class="lbl">Likely between</span><b class="num">'+clkRange(p)+'</b></div>';
    else facts+='<div><span class="lbl">Plan</span><b class="num">'+clk(planT(s))+'</b></div>';
    if(c && driveMins(c)) facts+='<div><span class="lbl">Drive</span><b class="num">'+driveShort(c)+'</b></div>';
    if(t.leg) facts+='<div><span class="lbl">Your leg</span><b class="num">'+t.leg.mi.toFixed(1)+' mi</b></div>';
    if(s.cut!=null && !t.leg) facts+='<div><span class="lbl">Cutoff</span><b class="num">'+clk(s.cut)+'</b></div>';

    var acts='';
    if(c && MAPQ[c.where]) acts+='<a class="btn tint sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+
      encodeURIComponent(MAPQ[c.where])+'">'+nico('pin')+'Directions</a>';
    if(c) acts+='<button class="btn tint sm" data-nstop="'+c.n+'">'+nico('list')+'What to bring</button>';
    var warn = c && NOMAP[c.where] ? '<div class="nw-warn"><b>Do not use a map app.</b> '+NOMAP[c.where]+'</div>' : '';

    return '<section class="nw-hero'+(here?' here':'')+'">'+
      '<div class="lbl-row"><span class="lbl">'+eyebrow+'</span><span class="lbl">Mile '+s.mi.toFixed(1)+'</span></div>'+
      '<h1 class="nw-place">'+esc(place)+'</h1>'+
      '<div class="nw-eta">'+bigClock(here?sp.in:p.min)+'<span>'+dyOf(here?sp.in:p.min)+'</span></div>'+
      '<p class="nw-sub">'+sub+'</p>'+
      (here?'':rangeBar(p, drive, edge))+
      '<div class="nw-facts">'+facts+'</div>'+
      (here?'':go)+ warn +
      nowLogHTML(t.si)+
      (acts?'<div class="nw-acts">'+acts+'</div>':'')+
      '</section>';
  }

  /* mats cannot record a departure, so a departure is always a person */
  function srcWord(sp){ return sp.out!=null ? 'crew tap' : (sp.src==='kandu'?'timing mat':'crew tap'); }
  /* ── last seen ── */
  function seenHTML(){
    var i=lastSplitIdx(), nm=now();
    if(i<0) return '<section class="nw-seen none"><div class="lbl-row"><span class="lbl">Last seen</span></div>'+
      '<p class="nw-seen-t">Nothing logged yet.</p><p class="nw-seen-s">Times below are '+esc(RUNNER)+'’s plan until the first checkpoint comes in.</p></section>';
    var sp=splitOf(i), s=STATIONS[i], out=sp.out!=null, at=out?sp.out:sp.in, ago=nm-at;
    var d=splitVal(i)-planT(s);
    var delta=Math.abs(d)<6?'<em class="ok">on plan</em>':d>0?'<em class="behind">'+dur(d)+' behind plan</em>':'<em class="ok">'+dur(-d)+' ahead of plan</em>';
    var src=srcWord(sp);
    var stale=ago>150;
    return '<section class="nw-seen'+(stale?' stale':'')+'">'+
      '<div class="lbl-row"><span class="lbl"><i class="nw-dot"></i>Last seen</span><span class="lbl">'+(ago<1?'just now':dur(ago)+' ago')+'</span></div>'+
      '<p class="nw-seen-t">'+(out?'Left':'Reached')+' <b>'+esc(shortName(s))+'</b> at <b class="num">'+clk(at)+'</b></p>'+
      '<p class="nw-seen-s">Mile '+s.mi.toFixed(1)+' · '+src+' · '+delta+'</p>'+
      '</section>';
  }

  /* ── the course strip ── */
  var STRIP=null;
  function stripGeom(){
    if(STRIP) return STRIP;
    var lo=1e9, hi=-1e9, i; for(i=0;i<PROFILE.length;i++){ lo=Math.min(lo,PROFILE[i][1]); hi=Math.max(hi,PROFILE[i][1]); }
    var W=1000, H=132, top=16, base=112, stepN=Math.max(1,Math.floor(PROFILE.length/420)), pts=[];
    function X(mi){ return mi/COURSE_MI*W; }
    function Y(ft){ return base-(ft-lo)/(hi-lo)*(base-top); }
    for(i=0;i<PROFILE.length;i+=stepN) pts.push([X(PROFILE[i][0]), Y(PROFILE[i][1])]);
    var lastP=PROFILE[PROFILE.length-1]; pts.push([X(lastP[0]), Y(lastP[1])]);
    var line='M'+pts.map(function(p){ return p[0].toFixed(1)+' '+p[1].toFixed(1); }).join('L');
    STRIP={ W:W, H:H, base:base, X:X, Y:Y, line:line, area:line+'L'+W+' '+base+'L0 '+base+'Z' };
    return STRIP;
  }
  function stripHTML(t){
    var g=stripGeom(), L=livePos(), nm=now(), last=lastSplitIdx();
    var pos=null, bandA=null, bandB=null;
    if(L.state==='station'){ pos=L.station.mi; }
    else if(L.state==='moving'){
      pos=L.mi;
      if(!L.gps && PROJ && last>=0){
        bandA=Math.max(STATIONS[last].mi, mileAtSeries(nm,'hi')); bandB=Math.max(bandA, mileAtSeries(nm,'lo'));
        pos=Math.min(Math.max(pos,bandA),bandB);
      }
    } else if(L.state==='done'){ pos=COURSE_MI; }
    var dark=(RACE.dark||[]).map(function(d){
      var a=mileAt(d[0]), b=mileAt(d[1]); return b>a?'<rect class="dk" x="'+g.X(a).toFixed(1)+'" y="0" width="'+(g.X(b)-g.X(a)).toFixed(1)+'" height="'+g.base+'"/>':''; }).join('');
    var ticks=STATIONS.map(function(s,i){
      var x=g.X(s.mi).toFixed(1), mine=t&&i===t.si;
      return '<line class="tk'+(s.crew?' cw':'')+(stopPassed(i)?' pd':'')+'" x1="'+x+'" x2="'+x+'" y1="'+g.base+'" y2="'+(g.base+(s.crew?12:7))+'"/>'+
        (mine?'<line class="tg" x1="'+x+'" x2="'+x+'" y1="6" y2="'+g.base+'"/>':'');
    }).join('');
    var done = pos!=null ? '<clipPath id="nwDone"><rect x="0" y="0" width="'+g.X(pos).toFixed(1)+'" height="'+g.H+'"/></clipPath>'+
      '<path class="dn" d="'+g.area+'" clip-path="url(#nwDone)"/>' : '';
    var band = bandA!=null && bandB-bandA>0.3 ? '<rect class="bd" x="'+g.X(bandA).toFixed(1)+'" y="0" width="'+(g.X(bandB)-g.X(bandA)).toFixed(1)+'" height="'+g.base+'"/>' : '';
    var dot = pos!=null && L.state!=='done' ? '<span class="nw-me" style="left:'+(pos/COURSE_MI*100).toFixed(2)+'%;top:'+(g.Y(elevAt(pos))/g.H*100).toFixed(2)+'%"></span>' : '';
    var flag = t ? '<span class="nw-flag'+(STATIONS[t.si].mi/COURSE_MI>0.72?' r':'')+'" style="left:'+(STATIONS[t.si].mi/COURSE_MI*100).toFixed(2)+'%">'+esc(shortName(STATIONS[t.si]))+'</span>' : '';

    var head, sub;
    if(L.state==='pre'){ head='At the start'; sub=COURSE_MI_TXT+' miles · '+COURSE_CLIMB_TXT+' ft of climb'; }
    else if(L.state==='done'){ head='Finished'; sub=dur(L.at)+' · '+clkDay(L.at); }
    else if(L.state==='station'){ head='In '+esc(shortName(L.station)); sub='Mile '+L.station.mi.toFixed(1)+' · '+dur(L.since)+' in the station'; }
    else if(L.state==='moving'){
      var prev=STATIONS[Math.max(0,L.nextIdx-1)];
      head = bandA!=null && bandB-bandA>=1.5 ? 'Mile '+Math.floor(bandA)+'–'+Math.ceil(bandB) : 'About mile '+pos.toFixed(L.gps?1:0);
      sub = esc(shortName(prev))+' → '+esc(shortName(L.next))+' · '+(L.gps?'from the phone’s GPS':last>=0?'estimated from the last checkpoint':'estimated from the plan');
    } else { head='Race over'; sub=''; }
    var axis=''; for(var m=0;m<=COURSE_MI;m+=25) axis+='<i style="left:'+(m/COURSE_MI*100).toFixed(1)+'%">'+m+'</i>';
    return '<section class="nw-pos"><div class="lbl-row"><span class="lbl">Where '+esc(RUNNER)+' is</span><span class="lbl">'+(L.state==='moving'&&!L.gps?'estimate':'')+'</span></div>'+
      '<p class="nw-pos-h">'+head+'</p><p class="nw-pos-s">'+sub+'</p>'+
      '<div class="nw-strip"><svg viewBox="0 0 '+g.W+' '+g.H+'" preserveAspectRatio="none">'+dark+
      '<path class="ar" d="'+g.area+'"/>'+done+band+
      '<path class="ln" d="'+g.line+'"/><line class="bl" x1="0" x2="'+g.W+'" y1="'+g.base+'" y2="'+g.base+'"/>'+ticks+'</svg>'+flag+dot+
      '<div class="nw-axis">'+axis+'</div></div></section>';
  }

  /* ── what follows ── */
  function afterHTML(t){
    var rows=laterStops(t); if(!rows.length) return '';
    return '<section class="nw-after"><div class="lbl-row rule"><span class="lbl">After that</span><span class="lbl">expected · range</span></div>'+
      rows.map(function(r){
        var s=STATIONS[r.si], p=etaOf(r.si), name=r.c?r.c.where:shortName(s);
        return '<button class="nw-row" '+(r.c?'data-nstop="'+r.c.n+'"':'data-naid="'+r.si+'"')+'>'+
          '<span class="post num">'+s.mi.toFixed(0)+'</span>'+
          '<span class="mid"><b>'+esc(name)+'</b><s>'+(r.c&&driveMins(r.c)?driveShort(r.c)+' drive':'mile '+s.mi.toFixed(1))+
            (s.cut!=null?' · cutoff '+clk(s.cut):'')+'</s></span>'+
          '<span class="rt"><b class="num">'+clk(p.min)+'</b><s class="num">'+(p.lo!=null?clkRange(p):dyOf(p.min))+'</s></span></button>';
      }).join('')+'</section>';
  }

  /* ── recent checkpoints, and the door to logging anything else ── */
  function feedHTML(){
    var rows=[]; STATIONS.forEach(function(s,i){ var sp=splitOf(i); if(sp) rows.push([i,sp]); });
    rows=rows.slice(-3).reverse();
    var live=now()>=0;
    if(!rows.length && !live) return '';
    return '<section class="nw-feed"><div class="lbl-row rule"><span class="lbl">Checkpoints</span><span class="lbl">'+(rows.length?'latest first':'')+'</span></div>'+
      rows.map(function(r){
        var s=STATIONS[r[0]], sp=r[1], d=splitVal(r[0])-planT(s);
        return '<button class="nw-cp" data-fix="'+r[0]+'"><span class="num t">'+clk(sp.out!=null?sp.out:sp.in)+'</span>'+
          '<span class="mid"><b>'+(sp.out!=null?'Left ':'Reached ')+esc(shortName(s))+'</b><s>mile '+s.mi.toFixed(1)+' · '+srcWord(sp)+'</s></span>'+
          '<span class="dv num '+(d>5?'behind':'ok')+'">'+(Math.abs(d)<1?'±0':(d>0?'+':'−')+hm(Math.abs(d)))+'</span></button>';
      }).join('')+
      '<div class="nw-acts"><button class="btn tint sm" data-logany>'+nico('plus')+'Log another station</button>'+
      '<button class="btn tint sm" id="nwSend">'+nico('send')+'Send an update</button></div></section>';
  }

  /* ── before the gun ── */
  function preHTML(t){
    var nm=-now(), d=Math.floor(nm/1440), h=Math.floor((nm%1440)/60), m=Math.floor(nm%60);
    var big = d>0 ? '<b class="num">'+d+'</b><i>d</i> <b class="num">'+h+'</b><i>h</i>' : '<b class="num">'+h+'</b><i>h</i> <b class="num">'+String(m).padStart(2,'0')+'</b><i>m</i>';
    var me=mePerson(), n=myStops().length, s=t?STATIONS[t.si]:null;
    function step(k,title,sub){ return '<button class="nw-row" data-nprep="'+k+'"><span class="post sm">'+(ls(KEY+'prep_'+k)?nico('check'):'')+'</span>'+
      '<span class="mid"><b>'+title+'</b><s>'+sub+'</s></span>'+CHEV+'</button>'; }
    return '<section class="nw-hero pre"><div class="lbl-row"><span class="lbl">Until the start</span><span class="lbl">'+esc(RACE.startShort)+'</span></div>'+
      '<h1 class="nw-place">'+esc(RACE.name)+'</h1>'+
      '<div class="nw-eta count">'+big+'</div>'+
      '<p class="nw-sub">'+esc(RACE.place)+' · '+COURSE_MI_TXT+' miles · '+esc(RACE.limitLabel||'')+'</p>'+
      (t&&s?'<div class="nw-facts"><div><span class="lbl">Your first stop</span><b>'+esc(t.c?t.c.where:shortName(s))+'</b></div>'+
        '<div><span class="lbl">'+esc(RUNNER)+' due</span><b class="num">'+clkDay(T(s))+'</b></div></div>':'')+
      '</section>'+
      '<section class="nw-after"><div class="lbl-row rule"><span class="lbl">Before race day</span><span class="lbl">four things</span></div>'+
      step('stops','Read your '+(me&&me.role==='pacer'?'leg':n+' stops'),'Where to be, what to bring, how to get there')+
      step('rules','Learn the rules that end the race','Short, and not negotiable')+
      step('how','Two minutes on how this works','Logging, ranges, and what syncs')+
      step('offline','Make it work with no signal','Add to your home screen and save the manual')+
      '</section>';
  }

  /* ── compose ── */
  function nowHTML(){
    var L=livePos(), t=nowTarget();
    if(L.state==='pre') return preHTML(t)+stripHTML(t);
    if(L.state==='done')
      return '<section class="nw-hero done"><div class="lbl-row"><span class="lbl">Finished</span><span class="lbl">'+COURSE_MI_TXT+' miles</span></div>'+
        '<h1 class="nw-place">'+esc(RUNNER)+' is done.</h1><div class="nw-eta">'+'<b class="num">'+hm(L.at)+'</b><i>hrs</i></div>'+
        '<p class="nw-sub">Crossed the line at '+clkDay(L.at)+'</p></section>'+stripHTML(null)+feedHTML();
    if(L.state==='over' || !t)
      return seenHTML()+'<section class="nw-hero done"><div class="lbl-row"><span class="lbl">Nothing left for you</span></div>'+
        '<h1 class="nw-place">Your stops are done.</h1><p class="nw-sub">Thank you. The finish is at '+esc(RACE.startSpot||RACE.place)+'.</p></section>'+stripHTML(null)+feedHTML();
    return heroHTML(t)+seenHTML()+stripHTML(t)+afterHTML(t)+feedHTML();
  }

  function toast(msg, undo){
    var el=document.getElementById('toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.innerHTML='<span>'+msg+'</span>'+(undo?'<button>Undo</button>':'');
    el.classList.add('on');
    if(undo) el.querySelector('button').onclick=function(){ undo(); el.classList.remove('on'); };
    clearTimeout(toast.t); toast.t=setTimeout(function(){ el.classList.remove('on'); }, 6000);
  }

  function updateText(){
    var i=lastSplitIdx(), t=nowTarget(), L=STATIONS.length-1, parts=[];
    if(i>=0){ var sp=splitOf(i), out=sp.out!=null;
      parts.push(RUNNER+' '+(out?'left':'reached')+' '+shortName(STATIONS[i])+' (mile '+STATIONS[i].mi.toFixed(1)+') at '+clk(out?sp.out:sp.in)+'.'); }
    else parts.push(RUNNER+': no checkpoints logged yet.');
    if(t){ var p=etaOf(t.si);
      parts.push('Next for crew: '+(t.c?t.c.where:shortName(STATIONS[t.si]))+' about '+clk(p.min)+(p.lo!=null?', likely '+clkRange(p).replace(/ /g,' '):'')+'.'); }
    if(!t || t.si!==L){ var f=etaOf(L); parts.push('Finish about '+clkDay(f.min)+(f.lo!=null?' ('+clkRange(f).replace(/ /g,' ')+')':'')+'.'); }
    return parts.join(' ');
  }
  function sendSheet(){
    var txt=updateText();
    sheet('Send an update',
      '<p class="sec" style="margin-bottom:12px">For the group chat, or anyone not on the app. Edit it if you like.</p>'+
      '<div class="fld"><textarea id="upTxt" rows="5">'+esc(txt)+'</textarea></div>'+
      '<div class="btn-row">'+(navigator.share?'<button class="btn" id="upShare">Share</button>':'')+
      '<a class="btn'+(navigator.share?' tint':'')+'" id="upSms" href="#">Text message</a>'+
      '<button class="btn tint" id="upCopy">Copy</button></div>');
    var ta=document.getElementById('upTxt'), sms=document.getElementById('upSms');
    function sync(){ sms.href='sms:?&body='+encodeURIComponent(ta.value); } sync(); ta.oninput=sync;
    var sh=document.getElementById('upShare');
    if(sh) sh.onclick=function(){ navigator.share({ text:ta.value }).then(closeSheet).catch(function(){}); };
    document.getElementById('upCopy').onclick=function(){
      var done=function(){ closeSheet(); toast('Copied'); };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, done);
      else { ta.select(); try{ document.execCommand('copy'); }catch(e){} done(); }
    };
  }

  function renderNow(){
    var el=document.getElementById('nowBody'); if(!el) return;
    if(!mePerson()){ if(NOW_HTML!==''){ el.innerHTML=''; NOW_HTML=''; } return; }
    var html=nowHTML();
    if(html===NOW_HTML) return;
    NOW_HTML=html; el.innerHTML=html;
    el.querySelectorAll('[data-nlog]').forEach(function(b){
      b.onclick=function(){
        var p=b.dataset.nlog.split(':'), i=+p[0], f=p[1], before=splitOf(i)?JSON.parse(JSON.stringify(splitOf(i))):null;
        if(!isRaceDay()){ logSheet(i); return; }
        setSplit(i,f,now()); render();
        toast((f==='in'?'Arrival':'Departure')+' logged · '+clk(S.splits[i][f]), function(){
          setSplit(i,f,before&&before[f]!=null?before[f]:null); render(); });
      };
    });
    el.querySelectorAll('[data-nstop]').forEach(function(b){
      b.onclick=function(){ var c=CREW.filter(function(x){ return x.n===+b.dataset.nstop; })[0]; if(c) openCrewStop(c); }; });
    el.querySelectorAll('[data-naid]').forEach(function(b){ b.onclick=function(){ openAid(+b.dataset.naid); }; });
    el.querySelectorAll('[data-fix]').forEach(function(b){ b.onclick=function(){ logSheet(+b.dataset.fix); }; });
    el.querySelectorAll('[data-logany]').forEach(function(b){ b.onclick=logAnySheet; });
    var snd=el.querySelector('#nwSend'); if(snd) snd.onclick=sendSheet;
    el.querySelectorAll('[data-nprep]').forEach(function(b){
      b.onclick=function(){
        var k=b.dataset.nprep; ls(KEY+'prep_'+k,'1'); NOW_HTML=null;
        if(k==='stops'){ var tb=document.querySelector('.tab[data-v="r-crew"]'); if(tb) tb.click(); }
        else if(k==='rules'){ DET_RET='n-now'; openDetail('rules'); }
        else if(k==='how'){ DET_RET='n-now'; openDetail('how'); }
        else { DET_RET='n-now'; openDetail('app'); }
      };
    });
  }
