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
  function skyPaint(el, m, parts){
    if(!el) return; skyBuild(el);
    var g=skyGeom(), s=skyAt(m), cls='sky sky-'+s.ph+(s.sun?' sun':' moon');
    if(el.className!==cls) el.className=cls;
    el.style.setProperty('--s', Math.sin(Math.PI*s.p).toFixed(3));
    el.style.setProperty('--x', (84+9*s.p).toFixed(1)+'%');
    if(document.body.dataset.sky!==s.ph) document.body.dataset.sky=s.ph;
    var inn=el.querySelector('.sky-in'), html=parts&&parts.sky||'';
    if(el.__t!==html){ el.__t=html; inn.innerHTML=html; }
    var P=parts&&parts.pos, t=parts&&parts.t, lamp=el.querySelector('.sky-lamp'), pin=el.querySelector('.sky-pin');
    var rd=el.querySelector('#'+el.id+'D rect'), rb=el.querySelector('#'+el.id+'B rect');
    var has=P && P.pos!=null && P.state!=='pre';
    rd.setAttribute('width', has?g.X(P.pos).toFixed(1):0);
    if(has && P.a!=null && P.b-P.a>0.3){ rb.setAttribute('x', g.X(P.a).toFixed(1)); rb.setAttribute('width', (g.X(P.b)-g.X(P.a)).toFixed(1)); }
    else rb.setAttribute('width', 0);
    lamp.hidden=!(has && P.state!=='done');
    if(!lamp.hidden){ lamp.style.left=(P.pos/COURSE_MI*100).toFixed(2)+'%'; lamp.style.top=(g.Y(elevAt(P.pos))/g.H*100).toFixed(2)+'%'; }
    pin.hidden=!t;
    if(t){ var ts=STATIONS[t.si], f=ts.mi/COURSE_MI;
      pin.style.left=(Math.max(1.5,Math.min(98.5,f*100))).toFixed(2)+'%'; pin.style.top=(g.Y(elevAt(Math.min(ts.mi,COURSE_MI-0.05)))/g.H*100).toFixed(2)+'%';
      pin.className='sky-pin'+(f>0.66?' r':'');
      var nm=shortName(ts); if(pin.firstChild.textContent!==nm) pin.firstChild.textContent=nm; }
  }
