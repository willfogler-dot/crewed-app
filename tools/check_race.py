#!/usr/bin/env python3
"""Check a race file against the contract in docs/RACE-FILE.md.

  python3 tools/check_race.py NAME        (reads src/race/NAME/race.js)

Errors stop a race from shipping. Warnings are things a person should look at.
"""
import sys, json, subprocess, pathlib, re
R = pathlib.Path(__file__).resolve().parent.parent
name = sys.argv[1] if len(sys.argv) > 1 else 'rrr100'
race = R/'src'/'race'/name/'race.js'
assert race.exists(), 'no such race: %s' % race
js = r"""
const vm=require('vm'),fs=require('fs');const c={Intl:Intl,Date:Date};vm.createContext(c);
const names=["SUPA","RACE","PLANS","STATIONS","PROFILE","ROUTE","SECTIONS","CREW","DRIVES","PACERS","EVENTS","RULES","FUELPLAN","AIDX","DROPBAGS","MANDATORY"];
vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.__d={};'+names.map(k=>'try{this.__d.'+k+'='+k+'}catch(e){}').join(';'),c);
console.log(JSON.stringify(c.__d));
"""
d = json.loads(subprocess.check_output(['node', '-e', js, str(race)]))
err, warn = [], []
def E(m): err.append(m)
def W(m): warn.append(m)

for k in ('RACE', 'PLANS', 'STATIONS', 'PROFILE', 'ROUTE'):
    if k not in d: E('%s is missing (required)' % k)
if err: print('\n'.join('ERROR  ' + e for e in err)); sys.exit(1)
RACE, PLANS, ST, PROFILE, ROUTE = d['RACE'], d['PLANS'], d['STATIONS'], d['PROFILE'], d['ROUTE']

# RACE
for k in ('name', 'key', 'startISO', 'tz', 'limit'):
    if not RACE.get(k): E('RACE.%s is required' % k)
if RACE.get('key') and not re.fullmatch(r'[a-z0-9]+', RACE['key']): E('RACE.key must be lowercase letters and digits only (it prefixes storage and cache names)')
if RACE.get('startISO') and not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d', RACE['startISO']): E('RACE.startISO must look like 2027-06-05T06:00:00-06:00')
if not RACE.get('sun'): W('RACE.sun is missing; sunrise, sunset and "in the dark" will use generic times')
elif not all(re.fullmatch(r'\d{1,2}:\d\d (am|pm)', RACE['sun'].get(k, '')) for k in ('rise', 'set', 'dark')): E('RACE.sun.rise / set / dark must look like "6:51 am"')

# STATIONS
if len(ST) < 2: E('STATIONS needs at least a start and a finish')
if ST and ST[0]['mi'] != 0: E('the first station must be at mile 0')
for a, b in zip(ST, ST[1:]):
    if not b['mi'] > a['mi']: E('station miles must increase: %s (%s) then %s (%s)' % (a['name'], a['mi'], b['name'], b['mi']))
cuts = [(s['name'], s['cut']) for s in ST if s.get('cut') is not None]
for (n1, c1), (n2, c2) in zip(cuts, cuts[1:]):
    if c2 < c1: E('cutoffs go backwards: %s (%s) then %s (%s)' % (n1, c1, n2, c2))
if ST and ST[-1].get('cut') is not None and RACE.get('limit') and ST[-1]['cut'] != RACE['limit']: W('finish cutoff (%s) differs from RACE.limit (%s)' % (ST[-1]['cut'], RACE['limit']))
if ST and ST[-1].get('cut') is None: W('the finish has no cutoff')
for s in ST:
    if not s.get('name'): E('a station at mile %s has no name' % s.get('mi'))
    if s.get('crew') not in (None, 0, 1, 2, 3): E('%s: crew must be 0, 1, 2 or 3' % s['name'])
swaps = [s for s in ST if s.get('pacer')]
if len(swaps) == 1: E('only one station has pacer:1; a pacer needs somewhere to join and somewhere to leave')

# PLANS
keys = [p.get('k') for p in PLANS]
if len(set(keys)) != len(keys): E('PLANS keys must be unique')
if sum(1 for p in PLANS if p.get('cutoff')) != 1: W('exactly one plan should be marked cutoff:true')
for p in PLANS:
    built = all(s.get(p['k']) is not None for s in ST)
    if not built and not p.get('min'): E('plan "%s" has neither hand-built splits on every station nor a `min` finish time' % p.get('k'))
    if built:
        v = [s[p['k']] for s in ST]
        if v[0] != 0 or any(b <= a for a, b in zip(v, v[1:])): E('plan "%s": splits must start at 0 and increase' % p['k'])
    if p.get('min') and RACE.get('limit') and p['min'] > RACE['limit']: E('plan "%s" finishes after the limit' % p['k'])

# geometry
total = ST[-1]['mi'] if ST else 0
if len(PROFILE) < 20: E('PROFILE is too short; run tools/gpx_import.py')
elif abs(PROFILE[-1][0] - total) > 0.6: E('PROFILE ends at mile %s but the finish is at %s' % (PROFILE[-1][0], total))
if len(ROUTE) < 20: E('ROUTE is too short; run tools/gpx_import.py')
elif abs(ROUTE[-1][0] - total) > 0.6: E('ROUTE ends at mile %s but the finish is at %s' % (ROUTE[-1][0], total))
for nm, arr in (('PROFILE', PROFILE), ('ROUTE', ROUTE)):
    if any(b[0] < a[0] for a, b in zip(arr, arr[1:])): E('%s miles must not go backwards' % nm)

# optional content that must line up when present
miles = {s['mi'] for s in ST}
for c in d.get('CREW', []):
    if c.get('mi') is not None and c['mi'] not in miles: E('CREW stop "%s" is at mile %s, which is not a station' % (c.get('where'), c['mi']))
    if c.get('mi') is not None and next(s for s in ST if s['mi'] == c['mi']).get('crew', 0) == 0 if c.get('mi') in miles else False: W('CREW stop "%s" is at a station marked crew:0' % c.get('where'))
ns = [c.get('n') for c in d.get('CREW', [])]
if len(set(ns)) != len(ns): E('CREW n values must be unique (they are what a person\'s stop list refers to)')
for sec in d.get('SECTIONS', []):
    if sec.get('from') not in miles or sec.get('to') not in miles: E('SECTION "%s" does not start and end at stations' % sec.get('title'))
for p in d.get('PACERS', []):
    if p.get('from') not in {s['mi'] for s in swaps} or p.get('to') not in {s['mi'] for s in swaps}: E('PACERS leg "%s" does not start and end at pacer:1 stations' % p.get('title'))
for e in d.get('EVENTS', []):
    if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d', e.get('iso', '')): E('EVENTS: "%s" needs iso like 2027-06-05T06:00 (race time zone, no offset)' % e.get('t'))
if d.get('FUELPLAN') and len(d['FUELPLAN']) > len(ST) - 1: E('FUELPLAN has more legs than the course')
if d.get('AIDX') and len(d['AIDX']) > len(ST): E('AIDX has more entries than there are stations')
if not d.get('RULES'): W('no RULES; the "rules that end the race" screen will be empty')
if not d.get('EVENTS'): W('no EVENTS; the schedule will be empty')
if not any(s.get('crew') for s in ST): W('no station is crew-accessible')
pm = race.parent/'projection-model.json'
if pm.exists():
    m = json.loads(pm.read_text()); miss = [x for x in m['miles'] if not any(abs(s['mi'] - x) < 0.06 for s in ST)]
    if miss: E('projection-model.json has mats at miles %s that are not stations' % miss)
else: W('no projection-model.json; live ETAs use the plan-based fallback (fine for a first year)')

for w in warn: print('warn   ' + w)
for e in err: print('ERROR  ' + e)
print('%s: %d error(s), %d warning(s), %d stations, %.1f miles' % (name, len(err), len(warn), len(ST), total))
sys.exit(1 if err else 0)
