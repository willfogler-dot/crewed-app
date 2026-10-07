  /* ════════════ DEMO ════════════
     A race is live for two days a year. The rest of the time the Now screen
     would have nothing to show, so ?demo (and any build with no backend once
     its race is over) replays a run: behind early, strong late, which is the
     shape that breaks naive trackers. Sightings are generated up to the
     scrubbed time, mats as arrivals and crew stops as departures. Nothing in
     demo is written to the phone or the network. */
  var DEMO=null;
  var DEMO_DELAY=[[0,0],[5.4,8],[17.7,30],[30.1,58],[34.3,62],[44.5,95],[51.2,110],[63.9,103],[70.8,85],[80.8,50],[89,20],[95.8,2],[1e3,-6]];
  var DEMO_DWELL={ 2:4, 4:9, 6:6, 7:18, 10:14, 11:5, 13:10 };
  function demoTruth(){
    return STATIONS.map(function(s,i){
      var d=0; for(var k=1;k<DEMO_DELAY.length;k++) if(s.mi<=DEMO_DELAY[k][0]){
        var a=DEMO_DELAY[k-1], b=DEMO_DELAY[k], f=(s.mi-a[0])/(Math.min(b[0],COURSE_MI)-a[0]||1); d=a[1]+f*(b[1]-a[1]); break; }
      var arr=Math.round((s.goal!=null?s.goal:planBase(i,'goal'))+d);
      return { arr:arr, out:arr+(DEMO_DWELL[i]||(s.crew?4:1)) };
    });
  }
  function demoApply(){
    var sp={}, L=STATIONS.length-1;
    DEMO.truth.forEach(function(t,i){
      if(i===0) return;
      var mat=KNOT[i]!=null || !PM, crew=!!STATIONS[i].crew, o={};
      if(mat && t.arr<=DEMO.t){ o.in=t.arr; o.src='kandu'; }
      if(crew && i<L && t.out<=DEMO.t){ o.out=t.out; if(o.in==null) o.src='crew'; }
      if(o.in!=null||o.out!=null) sp[i]=o;
    });
    for(var k in DEMO.manual){ if(DEMO.manual[k]) sp[k]=DEMO.manual[k]; else delete sp[k]; }
    S.splits=sp;
  }
  function demoKeep(i){ DEMO.manual[i]=S.splits[i]?JSON.parse(JSON.stringify(S.splits[i])):null; }
  function demoSet(t){
    DEMO.t=Math.max(-60, Math.min(t, DEMO.end));
    demoApply(); NOW_HTML=null; render(); demoPaint();
  }
  function demoPaint(){
    var lab=document.getElementById('demoT'), r=document.getElementById('demoR');
    if(lab) lab.textContent=clkDay(DEMO.t)+' · '+(DEMO.t<0?'before the start':hm(DEMO.t)+' elapsed');
    if(r && +r.value!==Math.round(DEMO.t)) r.value=Math.round(DEMO.t);
    var pl=document.getElementById('demoPlay'); if(pl) pl.textContent=DEMO.timer?'Pause':'Play';
  }
  function demoInit(){
    var q=location.search||'', force=/[?&]demo\b/.test(q), off=/[?&]live\b/.test(q);
    var stale=!(SUPA&&SUPA.url) && (Date.now()-START)/MIN > RACE.limit+120;
    if(off || !(force||stale)) return;
    var m=/[?&]demo=([\d.]+)/.exec(q);
    DEMO={ on:true, t:m?+m[1]*60:13.2*60, manual:{}, timer:null };
    DEMO.truth=demoTruth(); DEMO.end=DEMO.truth[STATIONS.length-1].arr+20;
    document.body.classList.add('demo');
    var bar=document.getElementById('demoBar');
    if(bar){
      bar.innerHTML='<div class="demo-in"><div class="demo-h"><span class="lbl">Demo · drag through race day</span><button id="demoPlay">Play</button></div>'+
        '<input type="range" id="demoR" min="-60" max="'+DEMO.end+'" step="1" value="'+DEMO.t+'" aria-label="Race time">'+
        '<div class="demo-t num" id="demoT"></div></div>';
      document.getElementById('demoR').oninput=function(){ DEMO.manual={}; demoSet(+this.value); };
      document.getElementById('demoPlay').onclick=function(){
        if(DEMO.timer){ clearInterval(DEMO.timer); DEMO.timer=null; }
        else DEMO.timer=setInterval(function(){ if(DEMO.t>=DEMO.end){ clearInterval(DEMO.timer); DEMO.timer=null; } demoSet(DEMO.t+3); }, 120);
        demoPaint();
      };
    }
    /* the stand-in team gets pacer legs, so a pacer's Now has something to say */
    if(HAS_PACERS && !Object.keys(S.atomWho||{}).length && S.people.some(function(p){ return p.id==='d3'; }))
      S.atomWho={0:'d3',1:'d3',2:'d4',3:'d4'};
    demoApply(); demoPaint();
  }
