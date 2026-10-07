/* ════════════ RACE DEFAULTS ════════════
   Appended after every race file at build time. A race file states what is
   true of that race and may leave everything else out; this fills the gaps so
   the app never has to ask whether something is defined. Nothing here is
   race-specific. The contract is docs/RACE-FILE.md. */
var SUPA       = typeof SUPA       === 'undefined' ? { url:'', key:'', db:'' } : SUPA;
var PROFILE    = typeof PROFILE    === 'undefined' ? [] : PROFILE;
var ROUTE      = typeof ROUTE      === 'undefined' ? [] : ROUTE;
var SECTIONS   = typeof SECTIONS   === 'undefined' ? [] : SECTIONS;
var ANALYSIS   = typeof ANALYSIS   === 'undefined' ? [] : ANALYSIS;
var CREW       = typeof CREW       === 'undefined' ? [] : CREW;
var DRIVES     = typeof DRIVES     === 'undefined' ? {} : DRIVES;
var PACERS     = typeof PACERS     === 'undefined' ? [] : PACERS;
var MANDATORY  = typeof MANDATORY  === 'undefined' ? [] : MANDATORY;
var GEAR       = typeof GEAR       === 'undefined' ? null : GEAR;
var FUELPLAN   = typeof FUELPLAN   === 'undefined' ? [] : FUELPLAN;
var NA_PER_CAP = typeof NA_PER_CAP === 'undefined' ? 215 : NA_PER_CAP;
var TOBUY      = typeof TOBUY      === 'undefined' ? [] : TOBUY;
var DROPBAGS   = typeof DROPBAGS   === 'undefined' ? [] : DROPBAGS;
var CARRIES    = typeof CARRIES    === 'undefined' ? [] : CARRIES;
var RULES      = typeof RULES      === 'undefined' ? [] : RULES;
var MANUAL_TOC = typeof MANUAL_TOC === 'undefined' ? [] : MANUAL_TOC;
var QUESTIONS  = typeof QUESTIONS  === 'undefined' ? [] : QUESTIONS;
var EVENTS     = typeof EVENTS     === 'undefined' ? [] : EVENTS;
var AIDX       = typeof AIDX       === 'undefined' ? [] : AIDX;
(function(){
  var R=RACE, L=STATIONS.length-1, i;
  /* identity and labels, derived from the start time when not written out */
  R.short=R.short||R.name; R.place=R.place||''; R.manualFile=R.manualFile||''; R.manualPages=R.manualPages||'';
  R.runner=R.runner||{}; R.runner.name=R.runner.name||'Runner'; R.runner.division=R.runner.division||''; R.runner.bibRange=R.runner.bibRange||'';
  var t0=new Date(R.startISO), tz={ timeZone:R.tz };
  function f(o){ var k; for(k in tz) o[k]=tz[k]; return new Intl.DateTimeFormat('en-US',o); }
  function lc(s){ return s.replace(' AM',' am').replace(' PM',' pm'); }
  var clock=lc(f({ hour:'numeric', minute:'2-digit' }).format(t0)), wd=f({ weekday:'long' }).format(t0);
  var end=new Date(t0.getTime()+R.limit*60000), hrs=R.limit/60;
  R.year=R.year||+f({ year:'numeric' }).format(t0);
  R.monthYear=R.monthYear||f({ month:'long', year:'numeric' }).format(t0);
  R.dates=R.dates||f({ day:'numeric', month:'long', year:'numeric' }).format(t0);
  R.startShort=R.startShort||clock+' '+wd;
  R.startLabel=R.startLabel||clock+' '+wd+' '+f({ day:'numeric', month:'long', year:'numeric' }).format(t0);
  R.limitLabel=R.limitLabel||(hrs%1?hrs.toFixed(1):hrs)+'-hour limit';
  R.finishBy=R.finishBy||lc(f({ hour:'numeric', minute:'2-digit' }).format(end))+' '+f({ weekday:'short' }).format(end);
  R.startSpot=R.startSpot||STATIONS[0].name;
  R.sun=R.sun||{ rise:'6:30 am', set:'7:30 pm', dark:'8:00 pm' };
  /* minutes of the race that fall in the dark, as [from,to] on the race clock */
  if(!R.dark){
    var pc=function(s){ var m=/(\d+):(\d+)\s*(am|pm)/i.exec(s||''); return m?((+m[1])%12+(/pm/i.test(m[3])?12:0))*60+(+m[2]):null; };
    var rise=pc(R.sun.rise)||390, dk=pc(R.sun.dark)||1200, hm=new Intl.DateTimeFormat('en-GB',{ timeZone:R.tz, hour:'2-digit', minute:'2-digit', hour12:false });
    var out=[], open=null;
    for(i=0;i<=R.limit;i+=5){ var p=hm.format(new Date(t0.getTime()+i*60000)).split(':'), d=((+p[0])%24)*60+(+p[1]), night=d>=dk||d<rise;
      if(night && open==null) open=i; if(!night && open!=null){ out.push([open,i]); open=null; } }
    if(open!=null) out.push([open,R.limit]);
    R.dark=out;
  }
  R.mapQuery=R.mapQuery||{}; R.noMap=R.noMap||{}; R.noMapStop=R.noMapStop||{}; R.driveKeys=R.driveKeys||[];
  var C=R.copy=R.copy||{};
  ['footer','rulesLine','cutoffsNote','helpSignal','helpRules','briefRules','fieldNotes','gearIntro','bagsIntro','summitSkipped','weatherIntro','weatherNotes',
   'elevIntro','elevNotes','questionsIntro','pacerBlocksIntro','bibNote','dropOnly'].forEach(function(k){ if(C[k]==null) C[k]=''; });
  if(!C.helpSignal) C.helpSignal='Once it has opened on your phone it keeps working with no signal. Anything you write syncs by itself when you get signal back.';
  if(!C.dropOnly) C.dropOnly='Drop off and leave. There is no parking here.';
  if(!C.questionsIntro) C.questionsIntro='<div class="card"><p class="sec" style="margin-bottom:10px">Your own open questions for the race directors.</p>';
  C.lens=C.lens||{}; ['crewLegend','crewNote','bagLegend','bagNote'].forEach(function(k){ if(C.lens[k]==null) C.lens[k]=''; });
  if(!C.lens.crewLegend) C.lens.crewLegend='<span><i class="k crew"></i>Crew can reach the runner</span><span><i class="k nocrew"></i>No crew</span>';
  if(!C.lens.bagLegend) C.lens.bagLegend='<span><i class="k bag"></i>Drop bag</span><span><i class="k nocrew"></i>Carry everything</span>';
  C.follow=C.follow||{ intro:'', links:[], note:'' }; C.follow.links=C.follow.links||[];
  /* stations */
  STATIONS.forEach(function(s){ ['gain','bag','crew','pacer'].forEach(function(k){ if(s[k]==null) s[k]=0; }); if(s.cut===undefined) s.cut=null; });
  /* one section per leg when the race has not written its own */
  if(!SECTIONS.length) for(i=1;i<=L;i++){ var a=STATIONS[i-1], b=STATIONS[i], mi=+(b.mi-a.mi).toFixed(1);
    SECTIONS.push({ n:i, from:a.mi, to:b.mi, effort:'', ec:'', gain:b.gain||0, title:a.name.replace(/\s+—.*$/,'')+' to '+b.name.replace(/\s+—.*$/,''),
      sub:mi+' miles'+(b.gain?' · about '+b.gain.toLocaleString('en-US')+' feet up':''), body:'' }); }
  /* a crew stop at every station a crew can reach, when none are written */
  if(!CREW.length){ var n=0; STATIONS.forEach(function(s){ if(s.crew) CREW.push({ n:++n, where:s.name.replace(/\s+—.*$/,''), mi:s.mi, drive:0, what:'', body:s.note||'' }); }); }
  CREW.forEach(function(c){ if(c.what==null) c.what=''; if(c.body==null) c.body=''; });
  while(AIDX.length<STATIONS.length) AIDX.push({});
  while(FUELPLAN.length<L) FUELPLAN.push({ aid:'', seg:'', ac:0, sc:0, caps:0, water:0, caf:0, note:'' });
  /* the same neutral starter list for every race; a race adds only what it makes mandatory */
  if(!GEAR) GEAR=[
    { name:'Running kit', items:[['Trail shoes',''],['Spare shoes',''],['Socks, several pairs',''],['Headlamp and a backup light',''],['Spare batteries',''],
      ['Rain jacket',''],['Warm layer',''],['Gloves',''],['Sunglasses',''],['Poles',''],['Pack or vest',''],['Bottles or bladders',''],['Cup',''],['Hat or beanie','']] },
    { name:'With the crew', items:[['Sunscreen',''],['Lip balm',''],['Anti-chafe',''],['Camp chair',''],['Phone and watch chargers',''],['Electrolytes or salt',''],
      ['Wipes',''],['First aid kit',''],['Blister kit','']] },
    { name:'Food', items:[['Gels or chews',''],['Drink mix',''],['Something salty',''],['Something sweet',''],['Real food for crew stops','']] }
  ];
})();
