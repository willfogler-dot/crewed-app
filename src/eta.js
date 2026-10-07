  /* ════════════ LIVE ETA ════════════
     One function decides every forecast clock in the app: smartProject().
     It returns, per station, {min, lo, hi, src} where lo..hi is the 80% range.

     Three sources of knowledge, in order of trust:
       1. what has been seen      a mat read or a crew tap. Fact.
       2. the fitted field model  RACE.projModel, from tools/projection. Knows how
                                  runners who were this far off the field at this mat
                                  actually went on to run the rest. Optional per race.
       3. the runner's own plan   the only thing that knows who this runner is before
                                  the course has said much.

     Early on the model explains little (R² 0.17 at the first RRR mat) so the plan
     carries the forecast; from mile 18 it explains about two thirds and takes over.
     The blend weight is the model's own cross-validated R², not a hand-set dial.
     With no model for a race, the plan is stretched by HALF the delay so far, which
     is what the 2025 field says a delay is worth, with a flat ±band. */
  var PM = RACE.projModel || null;
  var KNOT = {};                       /* station index -> model knot index */
  if(PM) PM.miles.forEach(function(m,k){
    STATIONS.forEach(function(s,i){ if(Math.abs(s.mi-m)<0.06 && KNOT[i]==null) KNOT[i]=k; });
  });
  var REVERT = 0.5;                    /* share of a delay that persists, with no model */
  var BAND = [0.90, 1.14];             /* fallback 80% range on remaining time */

  /* Mats record arrivals; the crew mostly tap departures. The model runs
     arrival to arrival, so a lone departure is walked back by a typical stop. */
  function dwellGuess(i){
    var s=STATIONS[i]; if(RACE.dwell && RACE.dwell[i]!=null) return RACE.dwell[i];
    return s.major?10:(s.crew?5:2);
  }
  function arrOf(i){
    var sp=S.splits[i]; if(!sp) return null;
    if(sp.in!=null) return sp.in;
    return sp.out!=null ? Math.max(0, sp.out-dwellGuess(i)) : null;
  }
  /* the latest moment the runner was actually seen at station i */
  function seenAt(i){ var sp=S.splits[i]; if(!sp) return null;
    return sp.out!=null?sp.out:(sp.in!=null?sp.in:null); }

  function smartProject(out, last){
    var n=STATIONS.length, i;
    var P=STATIONS.map(function(s){ return planT(s); });
    var res=out.map(function(o){ return {min:o.min, lo:null, hi:null, src:o.src}; });
    if(last<1) return res;                                   /* nothing seen: the plan stands */

    var aL=arrOf(last), pL=P[last];
    var ratio = pL>0 ? aL/pL : 1;
    var keep = Math.pow(ratio, REVERT);                      /* plan-side stretch from here */

    /* model anchor: the last station that is also a mat and has a time */
    var e=null, anchor=-1;
    if(PM){
      e=PM.miles.map(function(){ return null; }); e[0]=0;
      for(i=1;i<=last;i++){ var a=arrOf(i); if(a!=null && KNOT[i]!=null && a>0){ e[KNOT[i]]=a; anchor=i; } }
    }
    var mdl={};                                              /* station index -> {lo,mid,hi,w} */
    if(anchor>0){
      var base=e[KNOT[anchor]];
      for(i=anchor+1;i<n;i++){
        if(KNOT[i]==null) continue;
        var p=project(PM, e.slice(0,KNOT[anchor]+1), KNOT[i]); if(!p) continue;
        var mm=PM.models[p.from+','+KNOT[i]], w=mm&&mm.r2!=null?mm.r2:0.5;
        /* the runner's plan for the same stretch, with half the delay carried */
        var planRem=(P[i]-P[anchor])*Math.pow(base/P[anchor], REVERT);
        var mRem=p.mid-base;
        var rem=Math.exp(w*Math.log(Math.max(1,mRem))+(1-w)*Math.log(Math.max(1,planRem)));
        mdl[i]={ mid:base+rem, lo:base+rem*(p.lo-base)/mRem, hi:base+rem*(p.hi-base)/mRem };
      }
    }
    /* fill every station after the last one seen */
    var prevK=anchor>0?anchor:last, prevV=anchor>0?{lo:e[KNOT[anchor]],mid:e[KNOT[anchor]],hi:e[KNOT[anchor]]}:{lo:aL,mid:aL,hi:aL};
    function generic(j){
      var rem=(P[j]-pL)*keep;
      return { mid:aL+rem, lo:aL+rem*BAND[0], hi:aL+rem*BAND[1] };
    }
    var F=[];
    for(i=0;i<n;i++) F[i]=null;
    if(anchor>0){
      /* knots straight from the model, everything between them by plan fraction */
      var ks=[anchor]; for(i=anchor+1;i<n;i++) if(mdl[i]) ks.push(i);
      var val={}; val[anchor]=prevV; ks.slice(1).forEach(function(k){ val[k]=mdl[k]; });
      for(var q=1;q<ks.length;q++){
        var k1=ks[q-1], k2=ks[q], span=P[k2]-P[k1];
        for(i=k1+1;i<=k2;i++){
          var f=span>0?(P[i]-P[k1])/span:1;
          F[i]={ lo:val[k1].lo+f*(val[k2].lo-val[k1].lo), mid:val[k1].mid+f*(val[k2].mid-val[k1].mid),
                 hi:val[k1].hi+f*(val[k2].hi-val[k1].hi) };
        }
      }
      var lastK=ks[ks.length-1];
      for(i=lastK+1;i<n;i++){ var g=generic(i), gk=generic(lastK)||g;       /* past the model's last mat */
        F[i]={ lo:val[lastK].lo+(g.lo-gk.lo), mid:val[lastK].mid+(g.mid-gk.mid), hi:val[lastK].hi+(g.hi-gk.hi) }; }
    } else {
      for(i=last+1;i<n;i++) F[i]=generic(i);
    }
    /* Something seen after the model's anchor (a crew tap at a station with no
       mat, or a departure later than the walk-back assumed) moves everything
       ahead by the difference, and narrows nothing. */
    var seen=seenAt(last);
    var shift = 0;
    if(anchor>0 && last>anchor && F[last] && aL!=null) shift = aL-F[last].mid;
    var floor = seen!=null?seen:aL;
    for(i=last+1;i<n;i++){
      var v=F[i]; if(!v) continue;
      var lo=v.lo+shift, mid=v.mid+shift, hi=v.hi+shift;
      /* nobody arrives before they were last seen plus the fastest plausible leg */
      var minRun=(P[i]-P[last])*0.6;
      lo=Math.max(lo, floor+minRun); mid=Math.max(mid, lo); hi=Math.max(hi, mid);
      if(!isFinite(mid)||!isFinite(lo)||!isFinite(hi)) continue;          /* never let a bad number reach a clock */
      res[i]={ min:mid, lo:lo, hi:hi, src:'proj' };
    }
    return res;
  }
  /* Range for a station, or null when it is fact or still just the plan. */
  function etaOf(i){
    var p=PROJ&&PROJ[i]; if(!p) return {min:planT(STATIONS[i]), lo:null, hi:null, src:'plan'};
    return p;
  }
  function clkRange(p){
    if(!p||p.lo==null) return '';
    var a=clk(p.lo), b=clk(p.hi), am=a.slice(-2), bm=b.slice(-2);
    return (am===bm?a.slice(0,-3):a)+' – '+b;
  }
  /* Where on the course, as a range: the same clock read against the fast and
     slow edges of the forecast. */
  function mileAtSeries(m, key){
    var L=STATIONS.length-1;
    function t(i){ var p=PROJ[i]; return key&&p[key]!=null?p[key]:p.min; }
    if(m<=0) return 0; if(m>=t(L)) return STATIONS[L].mi;
    for(var i=1;i<=L;i++) if(m<=t(i)){
      var a=t(i-1), b=t(i), f=b>a?(m-a)/(b-a):0;
      return STATIONS[i-1].mi+f*(STATIONS[i].mi-STATIONS[i-1].mi); }
    return STATIONS[L].mi;
  }
