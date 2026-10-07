  /* ════════════ EXPORT ════════════
     The whole plan as one Excel workbook: a sheet per job, each laid out to
     print landscape on one page width with its header repeated. Built on the
     phone from what is on the phone, so it works with no signal and always
     matches what the app shows. */
  function exportSheets(){
    var L=STATIONS.length-1, goals=PLANS.filter(function(p){ return !p.cutoff; }), sel=PLANS.filter(function(p){ return p.k===S.plan; })[0]||PLANS[0];
    function h(a){ return a.map(function(v){ return { v:v, s:'head' }; }); }
    function head(title, sub, n){ var t=[{ v:title, s:'title' }], s2=[{ v:sub, s:'sub' }]; for(var i=1;i<n;i++){ t.push(null); s2.push(null); } return [t,s2]; }
    function yes(v){ return v?'Yes':''; }
    var who=RUNNER+(S.bib?', bib '+S.bib:''), stamp=RACE.name+' · '+RACE.dates;
    var sheets=[];

    /* 1. overview */
    var o=head(RACE.name+' — race plan', who+' · '+RACE.startLabel+' · '+RACE.place, 4);
    o.push([{ v:'The race', s:'group' },null,null,null]);
    [['Start',RACE.startLabel],['Time limit',RACE.limitLabel+', finish by '+RACE.finishBy],['Distance',COURSE_MI_TXT+' miles'],['Climb',COURSE_CLIMB_TXT+' ft'],
     ['Sunrise / sunset',(RACE.sun?RACE.sun.rise+' / '+RACE.sun.set:'')],['Plan in use',sel.name+', finish '+clkDay(planFinish(sel.k))+' ('+dur(planFinish(sel.k))+')']]
      .forEach(function(r){ o.push([{ v:r[0], s:'bold' }, r[1], null, null]); });
    o.push([{ v:'Goals', s:'group' },null,null,null]); o.push(h(['Goal','Finish time','Finishes at','Average pace']));
    PLANS.forEach(function(p){ var m=planFinish(p.k); o.push([{ v:p.name, s:'bold' }, dur(m), clkDay(m), pace(COURSE_MI,m)+' /mi']); });
    o.push([{ v:'The team', s:'group' },null,null,null]); o.push(h(['Name','Role','Phone','Where']));
    if(!S.people.length) o.push([{ v:'Nobody added yet', s:'muted' },null,null,null]);
    sortedPeople().forEach(function(p){ var rl=roleLabel(p).split(' · '); o.push([{ v:p.name, s:'bold' }, rl[0], p.phone||'', rl.slice(1).join(', ')]); });
    o.push([{ v:'Rules that end the race', s:'group' },null,null,null]);
    RULES.forEach(function(r){ o.push([{ v:r[0], s:'warn' }, r[1], null, null]); });
    var om=['A1:D1','A2:D2']; o.forEach(function(r,i){ if(r[0]&&r[0].s==='group') om.push('A'+(i+1)+':D'+(i+1)); if(r[0]&&r[0].s==='warn') om.push('B'+(i+1)+':D'+(i+1)); if(i>2&&i<9) om.push('B'+(i+1)+':D'+(i+1)); });
    sheets.push({ name:'Overview', cols:[30,26,24,44], rows:o, merges:om, portrait:true });

    /* 2. pacing */
    var pc=['#','Aid station','Mile','Leg mi','Climb ft'].concat(goals.map(function(g){ return g.name; })).concat(['Elapsed','Leg time','Leg pace','Cutoff','Spare','Crew','Pacer swap','Drop bag']);
    var p=head('Pacing plan', who+' · clock times for each goal; elapsed, leg and spare are on the '+sel.name, pc.length); p.push(h(pc));
    STATIONS.forEach(function(s,i){
      var m=planMins(i), pm=i?planMins(i-1):0, leg=i?s.mi-STATIONS[i-1].mi:0;
      p.push([{ v:i, s:'muted' }, { v:shortName(s), s:'bold' }, { v:+s.mi.toFixed(1), s:'num' }, i?{ v:+leg.toFixed(1), s:'num' }:'', i?{ v:s.gain||0, s:'num' }:'']
        .concat(goals.map(function(g){ return i?clk(planMins(i,g.k)):clk(0); }))
        .concat([i?dur(m):'', i?dur(m-pm):'', (i&&leg>0)?pace(leg,m-pm):'', s.cut!=null?{ v:clkDay(s.cut), s:'warn' }:'', s.cut!=null?dur(s.cut-m):'', yes(s.crew), yes(s.pacer&&HAS_PACERS), yes(s.bag)]));
    });
    sheets.push({ name:'Pacing', cols:[4,24,7,7,9].concat(goals.map(function(){ return 11; })).concat([10,9,9,14,9,7,10,9]), rows:p, merges:['A1:'+String.fromCharCode(64+pc.length)+'1','A2:'+String.fromCharCode(64+pc.length)+'2'], freeze:3, heads:3 });

    /* 3. crew stops */
    var cc=['Stop','Where','Mile','Runner arrives','Drive','Leave by','Who','Bring','Crew note','Runner note','How to get there'];
    var c=head('Crew stops', who+' · arrival times on the '+sel.name+' · '+(RACE.copy.rulesLine||''), cc.length); c.push(h(cc));
    visibleCrew().filter(function(x){ return !x.rest; }).forEach(function(x,k){
      var i=idxOf(x.mi), d=driveFor(x), w=responsibleAt(x).map(function(q){ return q.name; }).join(', ');
      c.push([{ v:k+1, s:'big' }, { v:x.where+(x.opt?' (optional)':''), s:'bold' }, { v:+x.mi.toFixed(1), s:'num' }, { v:clkDay(crewArrive(x)), s:'bold' }, driveMins(x)?driveShort(x):'', leaveBy(x)||'',
        w, i>=0?gearList(i).join('\n'):'', i>=0?aidField(i,'crew'):'', i>=0?aidField(i,'runner'):'',
        NOMAP[x.where]?{ v:'DO NOT USE A MAP APP. '+NOMAP[x.where]+(d.d?'\n'+d.d:''), s:'warn' }:((d.t?d.t+'. ':'')+(d.d||''))]);
    });
    sheets.push({ name:'Crew stops', cols:[6,24,7,14,9,14,16,22,26,26,48], rows:c, merges:['A1:K1','A2:K2'], freeze:3, heads:3 });

    /* 4. aid stations */
    var ac=['Mile','Aid station','Arrive','Cutoff','Crew','Bag','With','At the stop','On the way','Carbs g','Salt caps','Water L','Caffeine mg','Runner note','Crew note'];
    var a=head('Aid stations', who+' · every check-in, with the fuel plan and both notes', ac.length); a.push(h(ac));
    STATIONS.forEach(function(s,i){
      var f=i?fuelFor(i):{ aid:'', seg:'', ac:0, sc:0, caps:0, water:0, caf:0 }, wp=HAS_PACERS?whoIsWith(s.mi):null;
      a.push([{ v:+s.mi.toFixed(1), s:'num' }, { v:shortName(s), s:'bold' }, clkDay(planMins(i)), s.cut!=null?{ v:clk(s.cut), s:'warn' }:'', yes(s.crew), yes(s.bag), wp?wp.name:'',
        f.aid, f.seg, (f.ac+f.sc)||'', f.caps||'', f.water||'', f.caf||'', aidField(i,'runner'), aidField(i,'crew')]);
    });
    sheets.push({ name:'Aid stations', cols:[7,22,14,10,6,6,12,22,22,8,8,8,10,30,30], rows:a, merges:['A1:O1','A2:O2'], freeze:3, heads:3 });

    /* 5. pacers */
    if(HAS_PACERS){
      var lc=['Pacer','From','To','Miles','Climb ft','Starts about','Ends about','Allow','Notes'];
      var l=head('Pacer legs', who+' · pacers may only join or leave at the swap points', lc.length); l.push(h(lc));
      pacerLegs().forEach(function(g){ var per=g.who?personById(g.who):null, nv=legNarrative(g);
        l.push([{ v:per?per.name:'Nobody yet', s:per?'bold':'muted' }, shortName(g.from), shortName(g.to), { v:+g.mi.toFixed(1), s:'num' }, { v:g.gain, s:'num' }, clkDay(T(g.from)), clkDay(T(g.to)), dur(g.mins), nv.get||'']); });
      sheets.push({ name:'Pacers', cols:[18,20,20,8,9,14,14,10,60], rows:l, merges:['A1:I1','A2:I2'], freeze:3, heads:3 });
    }

    /* 6. gear */
    var g2=head('Gear checklist', who+' · tick the box when it is packed', 3); g2.push(h(['Packed','Item','Note']));
    g2.push([{ v:'Mandatory gear', s:'group' },null,null]);
    MANDATORY.forEach(function(t,i){ g2.push([{ v:S.checks['mg'+i]?'☑':'☐', s:'check' }, { v:t, s:'bold' }, 'Checked by the race']); });
    GEAR.forEach(function(gr,gi){ var its=gearItemsFor(gi); if(!its.length) return;
      g2.push([{ v:gr.name, s:'group' },null,null]);
      its.forEach(function(it){ g2.push([{ v:S.checks[it.key]?'☑':'☐', s:'check' }, it.name, it.note||'']); }); });
    var gm=['A1:C1','A2:C2']; g2.forEach(function(r,i){ if(r[0]&&r[0].s==='group') gm.push('A'+(i+1)+':C'+(i+1)); });
    sheets.push({ name:'Gear', cols:[9,44,40], rows:g2, merges:gm, freeze:3, heads:3, portrait:true });

    /* 7. drop bags */
    if(DROPBAGS.length){
      var b=head('Drop bags', who, 3); b.push(h(['Packed','Item','When']));
      DROPBAGS.forEach(function(bag,bi){
        b.push([{ v:bag.name+' · '+bag.tag, s:'group' },null,null]);
        if(bag.warn) b.push([null, { v:bag.warn, s:'muted' }, null]);
        (bag.lists||[]).forEach(function(li,lk){ li.items.forEach(function(t,ii){ b.push([{ v:S.checks['db'+bi+'_'+lk+'_'+ii]?'☑':'☐', s:'check' }, t, li.h]); }); }); });
      var bm=['A1:C1','A2:C2']; b.forEach(function(r,i){ if(r[0]&&r[0].s==='group') bm.push('A'+(i+1)+':C'+(i+1)); if(r[0]==null) bm.push('B'+(i+1)+':C'+(i+1)); });
      sheets.push({ name:'Drop bags', cols:[9,52,32], rows:b, merges:bm, freeze:3, heads:3, portrait:true });
    }

    /* 8. schedule */
    var sc=head('Schedule', stamp, 4); sc.push(h(['Day','Time','What','Detail']));
    allEvents().forEach(function(e){ var ms=tzMs(e.iso); sc.push([fFull.format(new Date(ms)), { v:tOf(ms), s:'bold' }, { v:e.t, s:e.key?'warn':'bold' }, e.d||'']); });
    sheets.push({ name:'Schedule', cols:[26,11,40,60], rows:sc, merges:['A1:D1','A2:D2'], freeze:3, heads:3 });
    return sheets;
  }
  function exportXlsx(){
    var bytes, name=(RACE.short||'race')+'-race-plan.xlsx';
    try{ bytes=xlsxBuild(exportSheets(), RACE.name+' race plan'); }
    catch(e){ toast('The export could not be built. Nothing was changed.'); return; }
    var type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', blob=new Blob([bytes],{ type:type });
    /* a phone hands the file to Files, Mail or AirDrop; a computer just downloads it */
    try{
      var file=new File([blob], name, { type:type });
      if(navigator.canShare && navigator.canShare({ files:[file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)){
        navigator.share({ files:[file], title:RACE.name+' race plan' }).catch(function(){}); return; }
    }catch(e){}
    var url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 4000);
    toast('Saved '+name);
  }
