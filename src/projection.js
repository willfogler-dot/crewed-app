// Live ETA engine. Pure functions, no DOM. Model comes from tools/projection/fit_model.py (RACE.projModel).
// Knots: index 0 = start, then one per timing mat. Elapsed times are minutes; null/undefined = no read.
// project(model, elapsed, target) -> {lo, mid, hi, from} absolute elapsed minutes at knot `target`, or null.
function projFeats(m, e, a){
  var ok=[]; for(var k=0;k<=a;k++) if(e[k]!=null && !isNaN(e[k])) ok.push(k);
  if(ok.indexOf(a)<0) return null;
  var f1=a>0?Math.log(e[a]/m[a]):0, p=ok.length>=2?ok[ok.length-2]:null, pp=ok.length>=3?ok[ok.length-3]:null;
  var f2=p!=null?Math.log((e[a]-e[p])/(m[a]-m[p])):0;
  var f3=pp!=null?Math.log((e[p]-e[pp])/(m[p]-m[pp])):0;
  return [f1,f2,f3];
}
function project(model, e, target){
  var a=-1; for(var k=Math.min(target-1,e.length-1);k>=1;k--) if(e[k]!=null && !isNaN(e[k])){a=k;break;}
  if(a<1) return null;
  var mod=model.models[a+','+target], m=model.ref; if(!mod) return null;
  var f=projFeats(m,e,a); if(!f) return null;
  var z=mod.b0; for(var i=0;i<3;i++) if(mod.sd[i]>1e-6) z+=(f[i]-mod.mu[i])/mod.sd[i]*mod.w[i];   /* a feature with no spread carries no weight */
  var span=m[target]-m[a], base=e[a];
  return {lo:base+span*Math.exp(z+mod.q[0]), mid:base+span*Math.exp(z+mod.q[1]), hi:base+span*Math.exp(z+mod.q[2]), from:a};
}
if(typeof module!=='undefined') module.exports={project:project,projFeats:projFeats};
