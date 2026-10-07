  /* ════════════ FLY ════════════
     The course preview, in 3D. The clock, the transport bar, the scrubber and
     the speeds are the preview's own (PV); this module only replaces what the
     camera sees: real terrain with imagery draped over it, a chase camera that
     follows the trail's heading, and an orbit at every aid station.

     Engine: MapLibre GL JS (BSD-3), vendored and loaded only when 3D is first
     opened, so the app itself carries no extra weight. Terrain is the open
     Terrarium elevation tiles on AWS (no key, no cost); imagery is whichever
     basemap the flat map is already using. Needs a connection and WebGL; with
     neither, the flat preview carries on exactly as before. */
  var FLY={ on:false, ready:false, easing:false, map:null, me:null, marks:[], mi:0, brg:0, cz:13.6, cp:62, zoom:14.1, pitch:64,
            tProg:0, tNear:0, tSky:0 };
  var FLY_DEM='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  var FLY_SKY={ night:{ c:['#080C2A','#131A4C','#2A2B6A'], night:1 }, dawn:{ c:['#232C6C','#C2648F','#FFB58A'], night:0.35 },
                day:{ c:['#8FC6F1','#B4DAF6','#EAF4F8'], night:0 }, dusk:{ c:['#262A6A','#D25B7E','#FF9E66'], night:0.35 } };
  var FLY_EXAG=1.25;                 /* vertical exaggeration: enough to read relief on a phone, not enough to lie */
  function flyCan(){ try{ var c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; } }
  function flyLib(cb){
    if(window.maplibregl) return cb(true);
    var s=document.createElement('script'); s.src='maplibre-gl.js';
    s.onload=function(){ cb(!!window.maplibregl); }; s.onerror=function(){ cb(false); };
    document.head.appendChild(s);
  }
  function flyLL(mi){ var p=routeLerp(Math.max(0,Math.min(COURSE_MI,mi))); return [p[1],p[0]]; }
  /* which way the trail is going, taken over most of a mile so switchbacks do not whip the camera */
  function flyBearing(mi){
    var a=routeLerp(Math.max(0,mi-0.25)), b=routeLerp(Math.min(COURSE_MI,mi+0.75));
    var dy=b[0]-a[0], dx=(b[1]-a[1])*Math.cos(a[0]*Math.PI/180);
    if(Math.abs(dx)+Math.abs(dy)<1e-7) return FLY.brg;
    return Math.atan2(dx,dy)*180/Math.PI;
  }
  function flyPad(){
    var c=document.getElementById('fmCockpit'), h=document.getElementById('fly3d');
    var b=(c&&h)?Math.max(0, h.getBoundingClientRect().bottom-c.getBoundingClientRect().top):120;
    var H=h?h.clientHeight:600;
    /* the runner sits a little below the middle of what is visible, so most of the frame is trail still to come */
    return { top:Math.round(H*0.30), bottom:Math.min(b+10, H*0.5), left:0, right:0 };
  }
  function flyInteract(on){
    if(!FLY.map) return;
    ['dragPan','dragRotate','scrollZoom','touchZoomRotate','touchPitch','doubleClickZoom','keyboard'].forEach(function(h){
      try{ FLY.map[h][on?'enable':'disable'](); }catch(e){} });
  }
  function flyFail(msg){ flyClose(); toast(msg); }
  function flyToggle(){ if(FLY.on) flyClose(); else flyOpen(); }
  function flyOpen(){
    var full=document.getElementById('mapFull'); if(!full||FLY.on) return;
    if(navigator.onLine===false){ toast('3D needs a connection. The flat preview works with no signal.'); return; }
    if(!flyCan()){ toast('This device cannot draw 3D, so the flat preview stays.'); return; }
    FLY.on=true; FLY.ready=false; FLY.easing=false;
    full.classList.add('fly','flyload');
    var host=document.createElement('div'); host.id='fly3d'; host.className='fm-canvas';
    full.insertBefore(host, full.querySelector('.fm-cockpit'));
    var cred=document.createElement('div'); cred.className='fly-credit'; cred.id='flyCredit'; full.appendChild(cred);
    var ck=document.getElementById('fmCockpit'), g=skyGeom();
    if(ck){ var pr=document.createElement('div'); pr.id='flyProf'; pr.className='fly-prof';
      pr.innerHTML='<svg viewBox="0 40 '+g.W+' 210" preserveAspectRatio="none"><clipPath id="flyPc"><rect x="0" y="0" width="0" height="300"/></clipPath>'+
        '<path class="a" d="'+g.area+'"/><path class="d" d="'+g.area+'" clip-path="url(#flyPc)"/></svg><i id="flyPx"></i>'+
        '<b id="flyRead"></b>';
      ck.insertBefore(pr, ck.firstChild); }
    var b3=document.getElementById('fm3d'); if(b3) b3.classList.add('on');
    flyLib(function(ok){
      if(!FLY.on) return;
      if(!ok) return flyFail('3D could not load. Check the connection and try again.');
      flyBuild(host);
    });
  }
  function flyBuild(host){
    var base=(BASES[MAPV.base]&&BASES[MAPV.base].url)?BASES[MAPV.base]:BASES.satellite;
    var cred=document.getElementById('flyCredit');
    if(cred) cred.textContent='Imagery: '+base.credit+'. Terrain: Mapzen, AWS Open Data.';
    var mi=PV.on?PV.mi:(MAPV.step>0?STATIONS[MAPV.step].mi:0);
    FLY.mi=mi; FLY.brg=flyBearing(mi); FLY.cz=FLY.zoom; FLY.cp=FLY.pitch;
    var map;
    try{
      map=new maplibregl.Map({ container:host, attributionControl:false, maxPitch:80, fadeDuration:120,
        center:flyLL(mi), zoom:FLY.zoom, pitch:FLY.pitch, bearing:FLY.brg,
        style:{ version:8,
          sources:{ base:{ type:'raster', tiles:[base.url], tileSize:256, maxzoom:Math.min(base.max||17,17) },
                    dem:{ type:'raster-dem', tiles:[FLY_DEM], encoding:'terrarium', tileSize:256, maxzoom:14 } },
          layers:[ { id:'bg', type:'background', paint:{ 'background-color':'#1C2434' } },
                   { id:'base', type:'raster', source:'base' } ] } });
    }catch(e){ return flyFail('3D could not start on this device.'); }
    FLY.map=map;
    map.on('load', function(){
      if(!FLY.on) return;
      try{ map.setTerrain({ source:'dem', exaggeration:FLY_EXAG }); }catch(e){}
      map.addSource('route', { type:'geojson', lineMetrics:true,
        data:{ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates:ROUTE.map(function(r){ return [r[2],r[1]]; }) } } });
      map.addLayer({ id:'rt-case', type:'line', source:'route', layout:{ 'line-cap':'round','line-join':'round' },
        paint:{ 'line-color':'rgba(8,12,36,.55)', 'line-width':['interpolate',['linear'],['zoom'],10,4,15,9] } });
      map.addLayer({ id:'rt', type:'line', source:'route', layout:{ 'line-cap':'round','line-join':'round' },
        paint:{ 'line-width':['interpolate',['linear'],['zoom'],10,2,15,4.5], 'line-gradient':flyGrad(mi) } });
      FLY.marks=STATIONS.map(function(s,i){
        var el=document.createElement('div'); el.className='fly-st'+(s.crew?' c':'');
        el.innerHTML='<b>'+esc(shortName(s))+'<s>mile '+s.mi.toFixed(1)+'</s></b><i></i>';
        var ll=flyLL(Math.min(s.mi,COURSE_MI-0.01));
        return { i:i, el:el, m:new maplibregl.Marker({ element:el, anchor:'bottom' }).setLngLat(ll).addTo(map) };
      });
      var me=document.createElement('div'); me.className='fly-me';
      FLY.me=new maplibregl.Marker({ element:me, anchor:'center' }).setLngLat(flyLL(mi)).addTo(map);
      FLY.ready=true;
      document.getElementById('mapFull').classList.remove('flyload');
      flyPaintAux(0,true);
      if(PV.on){ flyInteract(false); flyCam(true); } else flyOverview(0);
    });
    map.on('error', function(){ /* a missing tile is not worth a message; the terrain simply stays flat there */ });
  }
  /* The camera's height comes from the course file, not from whichever terrain
     tile happens to have arrived. Left to itself the engine reads the ground
     height under the camera from the tiles, gets zero while one is still
     loading, and drops the camera inside the mountain for a few frames. We
     already know the elevation at every mile, so we tell it. (Two private
     fields of the vendored, version-pinned engine.) */
  function flyGround(mi){
    var map=FLY.map; if(!map||!map.terrain) return;
    map._elevationFreeze=true;
    map.transform.elevation=elevAt(mi)*0.3048*FLY_EXAG;
  }
  function flyFree(){ if(FLY.map) FLY.map._elevationFreeze=false; }
  function flyGrad(mi){
    var f=Math.max(0.0005, Math.min(0.9995, mi/COURSE_MI));
    return ['step',['line-progress'],'#FFC53D',f,'rgba(255,255,255,.92)'];
  }
  /* establishing shot: the whole course, tilted */
  function flyOverview(ms){
    if(!FLY.ready) return;
    var a=[1e9,1e9], b=[-1e9,-1e9];
    ROUTE.forEach(function(r){ a[0]=Math.min(a[0],r[2]); a[1]=Math.min(a[1],r[1]); b[0]=Math.max(b[0],r[2]); b[1]=Math.max(b[1],r[1]); });
    var p=flyPad(); p.top=70; p.left=30; p.right=30;
    flyInteract(true); flyFree();
    FLY.map.fitBounds([a,b], { pitch:52, bearing:-18, padding:p, duration:ms==null?1400:ms });
  }
  /* things that do not need sixty updates a second */
  function flyPaintAux(dt, force){
    var map=FLY.map, mi=FLY.mi, t=performance.now();
    if(force || t-FLY.tProg>110){ FLY.tProg=t;
      try{ map.setPaintProperty('rt','line-gradient',flyGrad(mi)); }catch(e){}
      var r=document.querySelector('#flyPc rect'), x=document.getElementById('flyPx'), rd=document.getElementById('flyRead');
      if(r) r.setAttribute('width',(mi/COURSE_MI*1000).toFixed(1));
      if(x) x.style.left=(mi/COURSE_MI*100).toFixed(2)+'%';
      if(rd){ var txt=ft(elevAt(mi))+' ft'; if(rd.textContent!==txt) rd.textContent=txt; }
    }
    if(force || t-FLY.tNear>240){ FLY.tNear=t;
      var hold=PV.on&&PV.hold>0&&PV.at>0;
      FLY.marks.forEach(function(k){ var d=STATIONS[k.i].mi-mi;
        k.el.classList.toggle('near', (hold&&k.i===PV.at) || (d>-0.15 && d<1.6));
        k.el.classList.toggle('past', d<-0.15); });
    }
    if(force || t-FLY.tSky>900){ FLY.tSky=t;
      /* the sky and the light follow the hour the runner is due at this mile */
      var s=FLY_SKY[skyAt(minsAtMile(mi)).ph]||FLY_SKY.day, h=document.getElementById('fly3d');
      if(FLY.sky!==s){ FLY.sky=s;
        if(h) h.style.background='linear-gradient(180deg,'+s.c[0]+' 0,'+s.c[1]+' 30%,'+s.c[2]+' 62%)';
        try{ map.setPaintProperty('base','raster-brightness-max', 1-0.42*s.night);
             map.setPaintProperty('base','raster-saturation', -0.35*s.night); }catch(e){}
        try{ if(map.setSky) map.setSky({ 'sky-color':s.c[1], 'horizon-color':s.c[2], 'fog-color':s.c[2],
             'sky-horizon-blend':0.6, 'horizon-fog-blend':0.6, 'fog-ground-blend':0.35 }); }catch(e){}
      }
    }
  }
  /* hard: cut (or glide, if the camera is somewhere else entirely) to the chase position at PV.mi */
  function flyCam(hard){
    if(!FLY.ready) return;
    var map=FLY.map, mi=PV.mi; FLY.mi=mi;
    var z=FLY.zoom-Math.log(PV.speed||1)/Math.LN2*0.55, br=flyBearing(mi), c=flyLL(mi);
    FLY.me.setLngLat(c); flyPaintAux(0,true);
    if(!hard) return;
    flyInteract(false);
    var far=map.getZoom()<z-1.2 || Math.abs(map.getCenter().lng-c[0])+Math.abs(map.getCenter().lat-c[1])>0.02;
    FLY.brg=br; FLY.cz=z; FLY.cp=FLY.pitch;
    if(far){
      FLY.easing=true; flyFree();
      map.once('moveend', function(){ FLY.easing=false; });
      map.flyTo({ center:c, zoom:z, pitch:FLY.pitch, bearing:br, padding:flyPad(), duration:1900, essential:true });
      setTimeout(function(){ FLY.easing=false; }, 2600);      /* never let a dropped event strand the clock */
    } else { flyGround(mi); map.jumpTo({ center:c, zoom:z, pitch:FLY.pitch, bearing:br, padding:flyPad() }); }
  }
  /* every frame while the preview is playing */
  function flyFrame(dt){
    if(!FLY.ready || FLY.easing) return;
    var map=FLY.map, mi=PV.mi, hold=PV.hold>0&&PV.at>0; FLY.mi=mi;
    if(hold) FLY.brg+=dt*0.011;                                   /* a slow orbit while stopped at an aid station */
    else { var d=((flyBearing(mi)-FLY.brg+540)%360)-180; FLY.brg+=d*(1-Math.exp(-dt/750)); }
    var zt=(hold?FLY.zoom+0.3:FLY.zoom-Math.log(PV.speed||1)/Math.LN2*0.55), pt=hold?55:FLY.pitch, k=1-Math.exp(-dt/650);
    FLY.cz+=(zt-FLY.cz)*k; FLY.cp+=(pt-FLY.cp)*k;
    var c=flyLL(mi);
    flyGround(mi);
    map.jumpTo({ center:c, bearing:FLY.brg, pitch:FLY.cp, zoom:FLY.cz, padding:flyPad() });
    FLY.me.setLngLat(c);
    flyPaintAux(dt,false);
  }
  /* not playing: go and look at a mile */
  function flyGo(mi){
    if(!FLY.ready) return; FLY.mi=mi;
    FLY.me.setLngLat(flyLL(mi)); flyPaintAux(0,true);
    FLY.brg=flyBearing(mi); flyFree();
    FLY.map.easeTo({ center:flyLL(mi), zoom:FLY.zoom+0.2, pitch:58, bearing:FLY.brg, padding:flyPad(), duration:1100 });
  }
  function flyZoom(dz){
    FLY.zoom=Math.max(11.5, Math.min(15.6, FLY.zoom+dz));
    if(FLY.ready && !PV.on) FLY.map.easeTo({ zoom:FLY.map.getZoom()+dz, duration:300 });
  }
  function flyClose(){
    var full=document.getElementById('mapFull');
    if(FLY.map){ try{ FLY.map.remove(); }catch(e){} }
    FLY.map=null; FLY.me=null; FLY.marks=[]; FLY.sky=null; FLY.on=false; FLY.ready=false; FLY.easing=false;
    ['fly3d','flyCredit','flyProf'].forEach(function(id){ var e=document.getElementById(id); if(e&&e.parentNode) e.parentNode.removeChild(e); });
    if(full) full.classList.remove('fly','flyload');
    var b3=document.getElementById('fm3d'); if(b3) b3.classList.remove('on');
  }
