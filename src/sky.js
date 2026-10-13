  /* ════════════ SKY ════════════
     A hundred miles is measured in light: a morning start, a sunset, a whole
     night, a second sunrise. So the top of the screen is the sky as it is at
     this moment of the race, and its lower edge is the course itself, drawn
     from the elevation profile, with the runner as a lamp on the ridge.
     Built once and then only repainted, so the layers can cross-fade. */
  function parseClock(s){ var m=/(\d+):(\d+)\s*(am|pm)/i.exec(s||''); if(!m) return null;
    return ((+m[1])%12+(/pm/i.test(m[3])?12:0))*60+(+m[2]); }
  var SUNR=parseClock(RACE.sun&&RACE.sun.rise)||390, SUNS=parseClock(RACE.sun&&RACE.sun.set)||1170;
  var fHM=new Intl.DateTimeFormat('en-GB',{timeZone:RACE.tz,hour:'2-digit',minute:'2-digit',hour12:false});
  function dayMin(m){ var p=fHM.format(new Date(START+m*MIN)).split(':'); return ((+p[0])%24)*60+(+p[1]); }
  function skyAt(m){
    var d=dayMin(m), ph, up=d>=SUNR&&d<=SUNS, p;
    if(d>=SUNR-50 && d<SUNR+40) ph='dawn'; else if(d>=SUNR+40 && d<SUNS-55) ph='day';
    else if(d>=SUNS-55 && d<SUNS+40) ph='dusk'; else ph='night';
    if(up) p=(d-SUNR)/(SUNS-SUNR);
    else { var len=1440-(SUNS-SUNR), since=d>SUNS?d-SUNS:d+1440-SUNS; p=since/len; }
    return { ph:ph, sun:up, p:Math.max(0,Math.min(1,p)) };
  }
  var SKYG=null;
  function skyGeom(){
    if(SKYG) return SKYG;
    var lo=1e9, hi=-1e9, i; for(i=0;i<PROFILE.length;i++){ lo=Math.min(lo,PROFILE[i][1]); hi=Math.max(hi,PROFILE[i][1]); }
    var W=1000, H=300, top=64, base=232, stepN=Math.max(1,Math.floor(PROFILE.length/420)), pts=[];
    function X(mi){ return mi/COURSE_MI*W; }
    function Y(ft){ return base-(ft-lo)/(hi-lo)*(base-top); }
    for(i=0;i<PROFILE.length;i+=stepN) pts.push([X(PROFILE[i][0]), Y(PROFILE[i][1])]);
    var lp=PROFILE[PROFILE.length-1]; pts.push([X(lp[0]), Y(lp[1])]);
    function path(P){ return 'M'+P.map(function(p){ return p[0].toFixed(1)+' '+p[1].toFixed(1); }).join('L'); }
    var line=path(pts);
    /* a second range behind: the same mountains seen from the other side */
    var far=path(pts.map(function(p){ return [W-p[0], 30+(p[1]-top)*0.62]; }).reverse());
    SKYG={ W:W, H:H, X:X, Y:Y, line:line, area:line+'L'+W+' '+H+'L0 '+H+'Z', far:far+'L'+W+' '+H+'L0 '+H+'Z' };
    return SKYG;
  }
  function skyBuild(el){
    if(!el || el.__sky) return; el.__sky=1;
    var g=skyGeom(), id=el.id;
    el.innerHTML='<i class="sky-l night"></i><i class="sky-l dawn"></i><i class="sky-l day"></i><i class="sky-l dusk"></i>'+
      '<b class="sky-disc"></b><div class="sky-in"></div>'+
      '<div class="sky-ridge"><svg viewBox="0 0 '+g.W+' '+g.H+'" preserveAspectRatio="none" aria-hidden="true">'+
      '<clipPath id="'+id+'D"><rect x="0" y="0" width="0" height="'+g.H+'"/></clipPath>'+
      '<clipPath id="'+id+'B"><rect x="0" y="0" width="0" height="'+g.H+'"/></clipPath>'+
      '<path class="far" d="'+g.far+'"/><path class="gnd" d="'+g.area+'"/><path class="todo" d="'+g.line+'"/>'+
      '<path class="band" d="'+g.line+'" clip-path="url(#'+id+'B)"/><path class="done" d="'+g.line+'" clip-path="url(#'+id+'D)"/></svg>'+
      '<span class="sky-pin" hidden><em></em></span><span class="sky-lamp" hidden></span></div>';
  }
  /* ── Motion ─────────────────────────────────────────────────────────
     One number moves: the mile the sky is showing. The gold trail, the
     lamp and the uncertainty band all read it on the same frame, so the
     lamp climbs and drops with the ridge instead of sliding straight
     through the mountains, and the trail is never ahead of or behind it.
     It is a critically damped spring, so a scrub, a replay tick or a new
     mat read all just move the target and the motion stays continuous.
     The sun and moon ride their arc the same way. First paint draws the
     trail in from the start line, once. */
  var SKY_RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
  function springStep(st, target, dt, resp){
    var w=2*Math.PI/resp, acc=-w*w*(st.x-target)-2*w*st.v;
    st.v+=acc*dt; st.x+=st.v*dt;
    if(Math.abs(st.x-target)<1e-4 && Math.abs(st.v)<1e-3){ st.x=target; st.v=0; return true; }
    return false;
  }
  function skyDraw(el){
    var g=skyGeom(), M=el.__m, T=M.tgt;
    var D=M.mi.x, rd=M.rd, lamp=M.lamp;
    rd.setAttribute('width', T.has ? g.X(Math.max(0,D)).toFixed(1) : 0);
    if(!lamp.hidden){
      var d=Math.max(0,Math.min(COURSE_MI,D));
      lamp.style.left=(d/COURSE_MI*100).toFixed(3)+'%';
      lamp.style.top=(g.Y(elevAt(d))/g.H*100).toFixed(3)+'%';
    }
    var p=M.sun.x;
    el.style.setProperty('--s', Math.sin(Math.PI*Math.max(0,Math.min(1,p))).toFixed(4));
    el.style.setProperty('--x', (84+9*p).toFixed(2)+'%');
  }
  function skyTick(el){
    var M=el.__m; if(M.raf) return;
    var last=0;
    function f(ts){
      var dt=last?Math.min(1/30,(ts-last)/1000):1/60; last=ts;
      var a=springStep(M.mi, M.tgt.pos, dt, M.intro?0.9:0.5);
      var b=springStep(M.sun, M.tgt.p, dt, 0.7);
      skyDraw(el);
      if(a&&b){ M.raf=0; M.intro=false; return; }
      M.raf=requestAnimationFrame(f);
    }
    M.raf=requestAnimationFrame(f);
  }
  /* digits that change roll in; the ones that stay put do not move */
  function skyDigits(el){
    var b=el.querySelector('.sky-eta b'); if(!b) { el.__dg=null; return; }
    var now=b.textContent, prev=el.__dg; el.__dg=now;
    if(prev==null || prev===now || SKY_RM.matches) return;
    var n=now.length, o=prev.length, out='';
    for(var i=0;i<n;i++){ var c=now.charAt(i), j=o-(n-i), pc=j>=0?prev.charAt(j):'';
      out+= c!==pc && /\d/.test(c) ? '<span class="dg">'+c+'</span>' : c; }
    b.innerHTML=out;
  }
  function skyPaint(el, m, parts){
    if(!el) return; skyBuild(el);
    var g=skyGeom(), s=skyAt(m), cls='sky sky-'+s.ph+(s.sun?' sun':' moon');
    if(el.className!==cls) el.className=cls;
    if(document.body.dataset.sky!==s.ph) document.body.dataset.sky=s.ph;
    var inn=el.querySelector('.sky-in'), html=parts&&parts.sky||'';
    if(el.__t!==html){ el.__t=html; inn.innerHTML=html; skyDigits(el); }
    var P=parts&&parts.pos, t=parts&&parts.t, lamp=el.querySelector('.sky-lamp'), pin=el.querySelector('.sky-pin');
    var rb=el.querySelector('#'+el.id+'B rect');
    var has=!!(P && P.pos!=null && P.state!=='pre');
    var pos=has?P.pos:0;

    var M=el.__m, first=!M;
    if(first){
      M=el.__m={ rd:el.querySelector('#'+el.id+'D rect'), lamp:lamp, raf:0,
        mi:{x:(has&&!SKY_RM.matches)?0:pos, v:0}, sun:{x:s.p, v:0}, intro:has, sunOn:s.sun };
    }
    /* sun and moon trade places: a new body rises, it does not slide across */
    if(M.sunOn!==s.sun){ M.sunOn=s.sun; M.sun.x=s.p; M.sun.v=0; }
    M.tgt={ has:has, pos:pos, p:s.p };
    if(has && P.a!=null && P.b-P.a>0.3){ rb.setAttribute('x', g.X(P.a).toFixed(1)); rb.setAttribute('width', (g.X(P.b)-g.X(P.a)).toFixed(1)); }
    else rb.setAttribute('width', 0);
    lamp.hidden=!(has && P.state!=='done');
    if(SKY_RM.matches || !has && !first){ M.mi.x=pos; M.mi.v=0; }
    if(SKY_RM.matches){ M.sun.x=s.p; M.sun.v=0; skyDraw(el); }
    else { skyDraw(el); skyTick(el); }

    pin.hidden=!t;
    if(t){ var ts=STATIONS[t.si], f=ts.mi/COURSE_MI;
      pin.style.left=(Math.max(1.5,Math.min(98.5,f*100))).toFixed(2)+'%'; pin.style.top=(g.Y(elevAt(Math.min(ts.mi,COURSE_MI-0.05)))/g.H*100).toFixed(2)+'%';
      pin.className='sky-pin'+(f>0.66?' r':'');
      var nm=shortName(ts); if(pin.firstChild.textContent!==nm){ pin.firstChild.textContent=nm; if(!first&&!SKY_RM.matches){ pin.classList.remove('pin-in'); void pin.offsetWidth; pin.classList.add('pin-in'); } } }
  }
  /* depth on scroll: the sky falls behind slower than the page, the ridge
     travels with the page. A little, not a ride. */
  (function skyParallax(){
    var pend=false;
    function upd(){ pend=false;
      var el=document.getElementById('nowSky'); if(!el || !document.body.classList.contains('on-now')) return;
      var y=SKY_RM.matches?0:Math.max(0,Math.min(window.scrollY||0, 600));
      el.style.setProperty('--py', (y*0.38).toFixed(1)+'px');
    }
    window.addEventListener('scroll', function(){ if(!pend){ pend=true; requestAnimationFrame(upd); } }, {passive:true});
  })();
