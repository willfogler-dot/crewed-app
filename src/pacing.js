/* ═══════════════ pacing model ═══════════════
   A race manual gives distances, climb and cutoffs. It does not give a runner
   a plan. This turns those into arrival times for any goal finish time.

   Effort-miles: each leg counts as its distance plus its climb divided by
   `climbFt` (feet of climb that cost about one extra mile of effort). The legs
   are then stretched by a fade that grows linearly with how far into the race
   they are, and the whole thing is scaled so the final station lands exactly on
   the goal. No aid-station dwell is modelled; it is absorbed by the scaling.

   Defaults were fitted to the hand-built Run Rabbit Run 100 goal splits:
   RMS error 18 min, worst 36 min over 29h 38m. That is in-sample (two
   parameters, one race), so expect worse on a course that is not a big-climb
   mountain hundred. A race can override both in RACE.pacing, and any station
   that already carries a hand-built time for a plan keeps it. */
var PACING_DEFAULT = { climbFt: 300, fade: 1.05 };

/* cumulative minutes at each station (index-aligned, first is 0) */
function paceModel(stations, goalMin, opt){
  var o = opt || {};
  var k = o.climbFt > 0 ? o.climbFt : PACING_DEFAULT.climbFt;
  var fade = o.fade != null ? o.fade : PACING_DEFAULT.fade;
  var total = stations[stations.length-1].mi - stations[0].mi;
  var raw = [], cum = 0, sum = 0, i;
  for(i = 1; i < stations.length; i++){
    var mi = stations[i].mi - stations[i-1].mi;
    var w = (mi + (stations[i].gain || 0) / k) * (1 + fade * ((cum + mi / 2) / total));
    cum += mi; raw.push(w); sum += w;
  }
  var out = [0], t = 0;
  raw.forEach(function(r){ t += r / sum * goalMin; out.push(Math.round(t)); });
  return out;
}

/* Fill in s[plan.k] for every plan that gives a target `min`, unless the
   station already has a hand-built value for it. Returns the plan keys filled. */
function fillPlans(stations, plans, opt){
  var filled = [];
  plans.forEach(function(p){
    if(!(p.min > 0)) return;
    var have = stations.some(function(s, i){ return i > 0 && typeof s[p.k] === 'number' && s[p.k] > 0; });
    if(have) return;
    var m = paceModel(stations, p.min, opt);
    stations.forEach(function(s, i){ s[p.k] = m[i]; });
    filled.push(p.k);
  });
  return filled;
}
