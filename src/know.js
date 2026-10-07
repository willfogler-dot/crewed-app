  /* ════════════ KNOW ════════════
     Everything a crew member or pacer looks up rather than watches. One list,
     grouped by when it is needed, opening the screens the app already has. */
  var SUBV=null, DET_RET='n-now';
  var SUBT={ 'r-course':'The course', 'r-aid':'Aid stations', 'r-race':'Race overview', 'x-sched':'Schedule' };
  function navBack(label, title){
    var el=document.querySelector('.nav-in'); if(!el) return;
    el.innerHTML='<button class="back" id="dBack"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'+esc(label)+'</button>'+
      '<span class="t dt-ttl">'+esc(title||'')+'</span>';
    document.getElementById('dBack').onclick=function(){ history.back(); };
    if(window.navScroll) window.navScroll();
  }
  function pushView(id){
    SUBV=id; DET_RET=id;
    swapView(id,'en-push'); navBack('Know', SUBT[id]); window.scrollTo(0,0);
    if(id==='r-race') drawProfile('profile');
    if(id==='r-course') renderMap();
    try{ history.pushState({sub:id},''); }catch(e){}
  }
  function popSub(){
    SUBV=null; DET_RET='k-know';
    swapView('k-know','en-pop'); setNav(false); window.scrollTo(0,0);
  }
  function renderKnow(){
    var el=document.getElementById('knowBody'); if(!el) return;
    if(!S.me){ el.innerHTML=''; return; }
    var runner=meIsRunner();
    function r(attr,icon,title,sub,count,cls){
      return '<button class="item" '+attr+'><span class="ico '+(cls||'')+'"><svg viewBox="0 0 24 24">'+RIC[icon]+'</svg></span>'+
        '<div class="mid"><div class="nm">'+title+'</div><div class="dt">'+sub+'</div></div>'+
        (count?'<span class="count num">'+count+'</span>':'')+CHEV+'</button>';
    }
    function d(k,icon,title,sub,count,cls){ return r('data-kdetail="'+k+'"',icon,title,sub,count,cls); }
    function v(id,icon,title,sub,count){ return r('data-kview="'+id+'"',icon,title,sub,count); }
    var html=
      '<div class="phead"><h1>Know</h1><p class="sec">Rules, the course, the people. Everything here works with no signal.</p></div>'+
      (runner ? '<div class="grp"><div class="grp-t">Your race kit</div><div class="list">'+
        d('pace','clock','Race day planner','Splits, fuel and who is with you',dur(planFinish()),'g')+
        d('gear','gear','Gear checklist','Mandatory items plus your own lists',gearDone().join('/'),'g')+
        (DROPBAGS.length?d('bags','bag','Drop bags','What goes in each',bagDone().join('/')):'')+
        (CARRIES.length?d('carries','water','Long carries','Where there is no water'):'')+
        (QUESTIONS.length?d('qs','ask','Questions for the race directors','Open items the manual does not settle',String(QUESTIONS.length)):'')+
      '</div></div>' : '')+
      '<div class="grp"><div class="grp-t">'+(runner?'Rules and crew logistics':'Before you drive anywhere')+'</div><div class="list">'+
        d('rules','ban','Rules that end '+(runner?'your':esc(RUNNER)+'’s')+' race','Read once. They are enforced.',String(RULES.length),'r')+
        d('rota','van','Every stop and the drive to it','Where to park, and the way in',String(visibleCrew().filter(function(c){ return !c.rest; }).length))+
        (HAS_PACERS?d('legs','run','Pacer plan','Who runs which block, and the swap points'):'')+
      '</div></div>'+
      '<div class="grp"><div class="grp-t">The race</div><div class="list">'+
        v('r-race','clock','Goal times and cutoffs','The plan, the profile, room to spare')+
        d('elev','peak','Distance and climb','Measured from the course file')+
        v('x-sched','book','Schedule','Race weekend, lodging, meals')+
        d('weather','cloud','Weather and light','Sunrise, sunset, what to expect')+
      '</div></div>'+
      '<div class="grp"><div class="grp-t">The team</div><div class="list">'+
        d('team','team',HAS_PACERS?'Crew and pacers':'Crew','Who is who, and their numbers',String(S.people.length||''))+
        d('brief','book','Pre-race crew plan','One printable sheet for everyone')+
        r('data-kexport="1"','bag','Export the whole plan to Excel','Pacing, stops, fuel, gear and team, ready to print')+
      '</div></div>'+
      '<div class="grp"><div class="grp-t">This app</div><div class="list">'+
        d('how','ask','How this works','Two minutes, for anyone new')+
        (RACE.manualFile?d('manual','book','The race manual','Saved on this phone for no signal'):'')+
        d('app','cog','App and data','Sync, appearance, offline')+
      '</div></div>';
    if(el.__h===html) return; el.__h=html; el.innerHTML=html;
    el.querySelectorAll('[data-kdetail]').forEach(function(b){
      b.onclick=function(){ DET_RET='k-know'; openDetail(b.dataset.kdetail); }; });
    el.querySelectorAll('[data-kexport]').forEach(function(b){ b.onclick=exportXlsx; });
    el.querySelectorAll('[data-kview]').forEach(function(b){
      b.onclick=function(){ pushView(b.dataset.kview); }; });
  }
