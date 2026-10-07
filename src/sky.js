  /* ════════════ SKY ════════════
     A hundred miles is measured in light: a morning start, a sunset, a whole
     night, a second sunrise. So the top of every screen is the sky as it is at
     this moment of the race, and the land under it is the course itself: the
     elevation profile, range behind range, with the runner as a headlamp on
     the near ridge and the aid stations as lights along it.

     The sky is continuous. Eleven moments of the day are keyed to this race's
     own sunrise and sunset and everything between is interpolated, so the
     colour is right for 6:40 am and not just for "morning".
     Built once per element and then only repainted. */
  function parseClock(s){ var m=/(\d+):(\d+)\s*(am|pm)/i.exec(s||''); if(!m) return null;
    return ((+m[1])%12+(/pm/i.test(m[3])?12:0))*60+(+m[2]); }
  var SUNR=parseClock(RACE.sun&&RACE.sun.rise)||390, SUNS=parseClock(RACE.sun&&RACE.sun.set)||1170;
  var fHM=new Intl.DateTimeFormat('en-GB',{timeZone:RACE.tz,hour:'2-digit',minute:'2-digit',hour12:false});
  function dayMin(m){ var p=fHM.format(new Date(START+m*MIN)).split(':'); return ((+p[0])%24)*60+(+p[1]); }
  /* minute of day, then: zenith, upper sky, lower sky, horizon, near ridge */
  var SKY_KEYS=[
    [SUNR-75, '070B26','111848','262A68','3D3878','060919'],
    [SUNR-45, '0D1440','232A6C','4A3F8C','8A5596','0B0F2C'],
    [SUNR-18, '202B6E','4B4390','BE6190','FFA27C','15143C'],
    [SUNR+12, '3B55A6','8F78B8','F29590','FFCB92','2A2A62'],
    [SUNR+70, '5C9CDE','9AC6EE','D3E5F3','FBEBD3','35558A'],
    [(SUNR+SUNS)/2, '74B6EC','A6D2F5','D6EBF8','EAF5FA','41659A'],
    [SUNS-95, '6AAAE4','A2CCEF','E2E4E4','FFE5BC','3B5A90'],
    [SUNS-38, '4763B6','9B7ABA','F39C80','FFC57E','2F2C66'],
    [SUNS+4,  '292E74','6B4792','DA5C7E','FF9C60','1A1744'],
    [SUNS+34, '121A4E','2B2C72','6A4A8E','B8627F','0C1032'],
    [SUNS+75, '070B26','111848','262A68','3D3878','060919']
  ];
  function hx(h){ return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  function mixc(a,b,f){ return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f]; }
  function rgb(c){ return 'rgb('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+')'; }
  function skyAt(m){
    var d=dayMin(m), K=SKY_KEYS, n=K.length, a=K[n-1], b=K[0], f=0, i;
    if(d>=K[0][0] && d<K[n-1][0]){
      for(i=1;i<n;i++) if(d<K[i][0]){ a=K[i-1]; b=K[i]; f=(d-a[0])/(b[0]-a[0]); break; }
    }
    var c=[1,2,3,4,5].map(function(j){ return mixc(hx(a[j]),hx(b[j]),f); });
    var up=d>=SUNR-4&&d<=SUNS+4, p;
    if(up) p=(d-SUNR)/(SUNS-SUNR);
    else { var len=1440-(SUNS-SUNR), since=d>SUNS?d-SUNS:d+1440-SUNS; p=since/len; }
    /* how much night there is: stars, moon, lamp beam and station lights all follow it */
    var night = d<SUNR ? Math.max(0,Math.min(1,(SUNR-22-d)/50)) : Math.max(0,Math.min(1,(d-SUNS-18)/50));
    var lum=(0.2126*c[1][0]+0.7152*c[1][1]+0.0722*c[1][2])/255;
    return { c:c, sun:up, p:Math.max(0,Math.min(1,p)), night:night, light:lum>0.6 };
  }
  var SKYG=null;
  function skyGeom(){
    if(SKYG) return SKYG;
    var lo=1e9, hi=-1e9, i; for(i=0;i<PROFILE.length;i++){ lo=Math.min(lo,PROFILE[i][1]); hi=Math.max(hi,PROFILE[i][1]); }
    var W=1000, H=300, top=92, base=236, stepN=Math.max(1,Math.floor(PROFILE.length/420)), pts=[];
    function X(mi){ return mi/COURSE_MI*W; }
    function Y(ft){ return base-(ft-lo)/(hi-lo)*(base-top); }
    for(i=0;i<PROFILE.length;i+=stepN) pts.push([X(PROFILE[i][0]), Y(PROFILE[i][1])]);
    var lp=PROFILE[PROFILE.length-1]; pts.push([X(lp[0]), Y(lp[1])]);
    function path(P){ return 'M'+P.map(function(p){ return p[0].toFixed(1)+' '+p[1].toFixed(1); }).join('L'); }
    function close(d){ return d+'L'+W+' '+H+'L0 '+H+'Z'; }
    var line=path(pts), n=pts.length;
    /* the ranges behind are the same course, seen from further off: once
       started a third of the way round, once from the far side */
    var cut=Math.floor(n*0.37), r2=[], r3;
    for(i=0;i<n;i++){ var q=pts[(i+cut)%n]; r2.push([i/(n-1)*W, 44+(q[1]-top)*0.74]); }
    r3=pts.map(function(p){ return [W-p[0], 12+(p[1]-top)*0.52]; }).reverse();
    SKYG={ W:W, H:H, top:top, X:X, Y:Y, line:line, area:close(line), r2:close(path(r2)), r3:close(path(r3)) };
    return SKYG;
  }
  function skyBuild(el){
    if(!el || el.__sky) return; el.__sky=1;
    var g=skyGeom(), id=el.id;
    el.innerHTML='<i class="sky-bg"></i><i class="sky-stars"></i><b class="sky-disc"></b><div class="sky-in"></div>'+
      '<div class="sky-ridge"><svg viewBox="0 0 '+g.W+' '+g.H+'" preserveAspectRatio="none" aria-hidden="true"><defs>'+
      '<linearGradient id="'+id+'G" gradientUnits="userSpaceOnUse" x1="0" y1="'+g.top+'" x2="0" y2="'+g.H+'">'+
      '<stop offset="0" style="stop-color:var(--rk)"/><stop offset=".42" style="stop-color:var(--rk);stop-opacity:.92"/>'+
      '<stop offset="1" style="stop-color:var(--rk);stop-opacity:0"/></linearGradient>'+
      '<clipPath id="'+id+'D"><rect x="0" y="0" width="0" height="'+g.H+'"/></clipPath>'+
      '<clipPath id="'+id+'B"><rect x="0" y="0" width="0" height="'+g.H+'"/></clipPath></defs>'+
      '<path class="r3" d="'+g.r3+'"/><path class="r2" d="'+g.r2+'"/>'+
      '<path class="gnd" d="'+g.area+'"/><path class="mtn" d="'+g.area+'" fill="url(#'+id+'G)"/><path class="rim" d="'+g.line+'"/>'+
      '<path class="band" d="'+g.line+'" clip-path="url(#'+id+'B)"/><path class="done" d="'+g.line+'" clip-path="url(#'+id+'D)"/></svg>'+
      '<div class="sky-lights"></div><span class="sky-beam" hidden></span>'+
      '<span class="sky-pin" hidden><em></em></span><span class="sky-lamp" hidden></span></div>';
  }
  var SKY_STILL = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* put the lamp, its beam and the lit trail at a mile */
  function skyPlace(el, mi, P){
    var g=skyGeom(), lamp=el.querySelector('.sky-lamp'), beam=el.querySelector('.sky-beam'), ridge=el.querySelector('.sky-ridge');
    el.querySelector('#'+el.id+'D rect').setAttribute('width', g.X(mi).toFixed(1));
    var show=P.state!=='done';
    lamp.hidden=!show; beam.hidden=!(show && P.state==='moving');
    if(!show) return;
    var x=(mi/COURSE_MI*100).toFixed(2)+'%', y=(g.Y(elevAt(mi))/g.H*100).toFixed(2)+'%';
    lamp.style.left=x; lamp.style.top=y; beam.style.left=x; beam.style.top=y;
    if(!beam.hidden){
      var w=ridge.clientWidth||390, h=ridge.clientHeight||190, m2=Math.min(COURSE_MI, mi+0.7);
      var ang=Math.atan2((g.Y(elevAt(m2))-g.Y(elevAt(mi)))/g.H*h, (m2-mi)/COURSE_MI*w)*180/Math.PI;
      beam.style.transform='rotate('+Math.max(-50,Math.min(50,ang)).toFixed(1)+'deg)';
    }
  }
  function skyPaint(el, m, parts, intro){
    if(!el) return; skyBuild(el);
    var g=skyGeom(), s=skyAt(m), st=el.style, c=s.c;
    ['--k1','--k2','--k3','--k4','--rk'].forEach(function(k,i){ st.setProperty(k, rgb(c[i])); });
    st.setProperty('--r2', rgb(mixc(c[4],c[2],0.46))); st.setProperty('--r3', rgb(mixc(c[4],c[3],0.72)));
    st.setProperty('--night', s.night.toFixed(2));
    st.setProperty('--s', Math.sin(Math.PI*s.p).toFixed(3)); st.setProperty('--x', (84+9*s.p).toFixed(1)+'%');
    var cls='sky'+(el.dataset.mini?' mini':'')+(s.sun?' sun':' moon')+(s.light?' light':'');
    if(el.className!==cls) el.className=cls;
    var ink=s.light?'#14204A':'#FFFFFF';
    if(document.body.style.getPropertyValue('--sky-ink')!==ink){ document.body.style.setProperty('--sky-ink',ink); document.body.dataset.sky=s.light?'day':'dark'; }
    var inn=el.querySelector('.sky-in'), html=parts&&parts.sky||'';
    if(el.__t!==html){ el.__t=html; inn.innerHTML=html; }

    var P=parts&&parts.pos, t=parts&&parts.t, pin=el.querySelector('.sky-pin'), lights=el.querySelector('.sky-lights');
    var rb=el.querySelector('#'+el.id+'B rect'), has=P && P.pos!=null && P.state!=='pre';
    /* the aid stations, as lights along the ridge: brighter where a crew can be, dim once passed */
    var sig=P ? STATIONS.map(function(_,i){ return stopPassed(i)?1:0; }).join('') : '';
    if(lights.__s!==sig){ lights.__s=sig;
      lights.innerHTML = P ? STATIONS.map(function(sx,i){
        return '<i class="'+(sx.crew?'c':'')+(sig.charAt(i)==='1'?' p':'')+'" style="left:'+(sx.mi/COURSE_MI*100).toFixed(2)+'%;top:'+
          (g.Y(elevAt(Math.min(sx.mi,COURSE_MI-0.05)))/g.H*100).toFixed(2)+'%"></i>'; }).join('') : ''; }
    if(has && P.a!=null && P.b-P.a>0.3){ rb.setAttribute('x', g.X(P.a).toFixed(1)); rb.setAttribute('width', (g.X(P.b)-g.X(P.a)).toFixed(1)); }
    else rb.setAttribute('width', 0);
    pin.hidden=!t;
    if(t){ var ts=STATIONS[t.si], f=ts.mi/COURSE_MI;
      pin.style.left=(Math.max(1.5,Math.min(98.5,f*100))).toFixed(2)+'%'; pin.style.top=(g.Y(elevAt(Math.min(ts.mi,COURSE_MI-0.05)))/g.H*100).toFixed(2)+'%';
      pin.className='sky-pin'+(f>0.66?' r':'');
      var nm=shortName(ts); if(pin.firstChild.textContent!==nm) pin.firstChild.textContent=nm; }
    if(!has){ el.querySelector('#'+el.id+'D rect').setAttribute('width',0); el.querySelector('.sky-lamp').hidden=true; el.querySelector('.sky-beam').hidden=true; return; }
    /* The one staged moment: on arriving at a screen the lamp runs the course
       so far, start to here, and the trail lights up behind it. */
    cancelAnimationFrame(el.__raf||0);
    if(intro && !SKY_STILL && P.pos>1){
      var t0=null, dur=Math.min(1500, 500+P.pos*10);
      var step=function(ts2){ if(t0==null) t0=ts2; var k=Math.min(1,(ts2-t0)/dur), e=1-Math.pow(1-k,3);
        skyPlace(el, P.pos*e, P); if(k<1) el.__raf=requestAnimationFrame(step); };
      el.__raf=requestAnimationFrame(step);
    } else skyPlace(el, P.pos, P);
  }
  /* ── the same sky, shorter, behind the title of every other screen ── */
  function topSkyFit(intro){
    var sky=document.getElementById('topSky'); if(!sky) return;
    var v=document.querySelector('.view.on'), ph=null;
    if(v && v.id!=='n-now'){ ph=v.querySelector('.phead'); if(ph && ph.getBoundingClientRect().top+(window.scrollY||0)>170) ph=null; }
    var on=!!ph && !document.getElementById('gate').classList.contains('on');
    document.body.classList.toggle('insky', on);
    sky.hidden=!on;
    if(!on) return;
    sky.style.height=Math.round(ph.getBoundingClientRect().bottom+(window.scrollY||0))+'px';
    skyPaint(sky, now(), { pos:posInfo(), t:null }, intro);
  }
  window.addEventListener('scroll', function(){
    if(SKY_STILL) return;
    var y=Math.min(window.scrollY||0, 500);
    document.documentElement.style.setProperty('--py', y.toFixed(0));
  }, {passive:true});
