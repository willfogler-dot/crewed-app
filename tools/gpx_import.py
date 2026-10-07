#!/usr/bin/env python3
"""GPX + station list -> ROUTE, PROFILE and STATIONS for a race file, plus a validation report.

usage: gpx_import.py --gpx course.gpx --stations stations.json --out DIR [--manual-miles 101.8] [--manual-gain 20391]

stations.json is a list in race order (a station visited twice appears twice):
  [{"name": "Start", "mi": 0}, {"name": "Crossover", "mi": 1.8, "lat": 39.373, "lon": -104.887}, ...]
`mi` is the MANUAL mileage (what the signs and the timing company use). lat/lon are optional;
without them a station is placed by scaling the manual mile onto the track. Any extra keys
(crew, bag, pacer, cut, ...) are passed through untouched.

Writes DIR/geo.js (ROUTE, PROFILE, STATIONS) and DIR/import-report.md. The report is the
point: it says where the GPX and the manual disagree so a human decides, not the script.
"""
import argparse, json, math, re, sys
import xml.etree.ElementTree as ET
import numpy as np

M_PER_MI, FT_PER_M = 1609.344, 3.28084

def read_gpx(path):
    root = ET.parse(path).getroot()
    ns = {'g': root.tag.split('}')[0][1:]} if root.tag.startswith('{') else {}
    q = (lambda t: 'g:' + t) if ns else (lambda t: t)
    pts = []
    for p in root.iter(('{%s}trkpt' % ns['g']) if ns else 'trkpt'):
        e = p.find(q('ele'), ns)
        pts.append((float(p.get('lat')), float(p.get('lon')), float(e.text) if e is not None else np.nan))
    wpts = []
    for w in root.iter(('{%s}wpt' % ns['g']) if ns else 'wpt'):
        n, d = w.find(q('name'), ns), w.find(q('desc'), ns)
        wpts.append({'name': n.text if n is not None else '', 'desc': (d.text or '') if d is not None else '',
                     'lat': float(w.get('lat')), 'lon': float(w.get('lon'))})
    return np.array(pts, dtype=float), wpts

def hav(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371008.8 * np.arcsin(np.sqrt(a))

def clean(pts):
    """Drop GPS dropout artifacts: exactly-zero elevation next to real elevation, and repeated points."""
    n0, notes = len(pts), []
    ele = pts[:, 2]
    if np.isnan(ele).any():
        raise SystemExit('GPX has trackpoints without elevation; cannot build a profile from it.')
    bad = np.zeros(len(pts), bool)
    for i in range(len(pts)):
        if ele[i] == 0:
            nb = [ele[j] for j in (i - 1, i + 1) if 0 <= j < len(pts) and ele[j] != 0]
            if nb and abs(nb[0]) > 50: bad[i] = True
    pts = pts[~bad]; notes.append('%d zero-elevation dropout points removed' % bad.sum())
    d = hav(pts[:-1, 0], pts[:-1, 1], pts[1:, 0], pts[1:, 1])
    keep = np.concatenate([[True], d > 0.05])
    notes.append('%d repeated points removed' % (~keep).sum())
    return pts[keep], notes, n0

def smooth_ele(dist_m, ele_m, win_m=60):
    """Distance-windowed mean (not point-windowed: point density varies with speed)."""
    cs = np.concatenate([[0], np.cumsum(ele_m)])
    lo = np.searchsorted(dist_m, dist_m - win_m / 2, 'left')
    hi = np.searchsorted(dist_m, dist_m + win_m / 2, 'right')
    return (cs[hi] - cs[lo]) / (hi - lo)

def ascent_descent(ele_ft, thresh=0.0):
    """Sum of climbs. thresh>0 adds hysteresis: a move only counts once it exceeds `thresh` ft from the last turning
    point, which discards real small rollers. Default is none; the smoothing window does the noise control."""
    if thresh <= 0:
        dd = np.diff(ele_ft); return float(dd[dd > 0].sum()), float(-dd[dd < 0].sum())
    up = down = 0.0; ref = ele_ft[0]; direction = 0
    for e in ele_ft[1:]:
        if direction >= 0 and e - ref >= thresh: up += e - ref; ref = e; direction = 1
        elif direction <= 0 and ref - e >= thresh: down += ref - e; ref = e; direction = -1
        elif direction == 1 and e > ref: up += e - ref; ref = e
        elif direction == -1 and e < ref: down += ref - e; ref = e
        elif direction == 0 and abs(e - ref) < thresh: pass
        elif direction == 1 and ref - e >= thresh: direction = -1; ref = e
        elif direction == -1 and e - ref >= thresh: direction = 1; ref = e
    return up, down

def dp_simplify(xy, tol):
    n = len(xy); keep = np.zeros(n, bool); keep[0] = keep[-1] = True; stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1: continue
        p, s, e = xy[a + 1:b], xy[a], xy[b]
        v = e - s; L = math.hypot(*v)
        d = np.hypot(*(p - s).T) if L == 0 else np.abs(v[0] * (p[:, 1] - s[1]) - v[1] * (p[:, 0] - s[0])) / L
        i = int(np.argmax(d))
        if d[i] > tol: keep[a + 1 + i] = True; stack += [(a, a + 1 + i), (a + 1 + i, b)]
    return np.where(keep)[0]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gpx', required=True); ap.add_argument('--stations', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--manual-miles', type=float); ap.add_argument('--manual-gain', type=float)
    a = ap.parse_args()
    import os; os.makedirs(a.out, exist_ok=True)

    raw, wpts = read_gpx(a.gpx)
    pts, notes, n0 = clean(raw)
    seg = hav(pts[:-1, 0], pts[:-1, 1], pts[1:, 0], pts[1:, 1])
    dist = np.concatenate([[0], np.cumsum(seg)])                  # metres along the track
    ele_ft = smooth_ele(dist, pts[:, 2]) * FT_PER_M
    gpx_mi = dist[-1] / M_PER_MI
    up, down = ascent_descent(ele_ft)
    raw_up = ascent_descent(pts[:, 2] * FT_PER_M)[0]
    strict_up = ascent_descent(ele_ft, 10.0)[0]

    stations = json.load(open(a.stations))
    man_total = a.manual_miles or stations[-1]['mi']
    scale = gpx_mi / man_total                                     # track miles per manual mile
    wmap = {}
    norm = lambda n: re.sub(r'\s*(aid|aid station|station)$', '', n.strip().lower())
    for w in wpts: wmap.setdefault(norm(w['name']), w)

    # anchor every station on the track, in order
    anchors, prev_m, flags = [], 0.0, []
    for k, s in enumerate(stations):
        exp_m = s['mi'] * scale * M_PER_MI
        lat, lon = s.get('lat'), s.get('lon')
        if lat is None:
            w = wmap.get(norm(s['name']))
            if w: lat, lon = w['lat'], w['lon']
        if k == 0: m, snap = 0.0, 0.0
        elif k == len(stations) - 1: m, snap = dist[-1], 0.0
        elif lat is None:
            m, snap = exp_m, None
        else:
            d = hav(pts[:, 0], pts[:, 1], lat, lon)
            ok = (dist >= prev_m + 30) & (np.abs(dist - exp_m) <= max(0.15 * dist[-1] / len(stations) * 4, 2000))
            if not ok.any(): ok = dist >= prev_m + 30
            idx = np.where(ok)[0]; j = idx[int(np.argmin(d[idx]))]
            m, snap = dist[j], float(d[j])
            if snap > 150: flags.append('%s (manual mile %.1f): nearest track point is %.0f m away - check the coordinates' % (s['name'], s['mi'], snap))
        m = max(m, prev_m); prev_m = m
        anchors.append({'m': m, 'snap': snap, 'coords': lat is not None})

    # piecewise-linear map from track metres to manual miles
    tm = np.array([x['m'] for x in anchors]); mm = np.array([s['mi'] for s in stations], float)
    for i in range(1, len(tm)):                                    # np.interp needs strictly increasing x
        if tm[i] <= tm[i - 1]: tm[i] = tm[i - 1] + 1
    man_mi = np.interp(dist, tm, mm)

    # PROFILE every 0.05 manual mile
    grid = np.arange(0, man_total + 1e-9, 0.05)
    prof = np.interp(grid, man_mi, ele_ft)
    # ROUTE, simplified at 3.5 m
    lat0 = np.radians(pts[:, 0].mean())
    xy = np.column_stack([(pts[:, 1] - pts[0, 1]) * np.cos(lat0) * 111320, (pts[:, 0] - pts[0, 0]) * 110540])
    keep = dp_simplify(xy, 3.5)

    out_st, rep_rows = [], []
    for k, s in enumerate(stations):
        j = int(np.searchsorted(dist, anchors[k]['m']))
        j = min(j, len(dist) - 1)
        p0 = int(np.searchsorted(dist, anchors[k - 1]['m'])) if k else 0
        gain = ascent_descent(ele_ft[p0:j + 1])[0] if k else 0
        e = dict(s); e.pop('lat', None); e.pop('lon', None)
        e.update({'elev': int(round(ele_ft[j])), 'gain': int(round(gain / 25.0) * 25)})
        out_st.append(e)
        rep_rows.append((s['name'], s['mi'], anchors[k]['m'] / M_PER_MI, anchors[k]['snap'], e['elev'], e['gain'], anchors[k]['coords']))

    with open(os.path.join(a.out, 'geo.js'), 'w') as f:
        f.write('/* generated by tools/gpx_import.py - review import-report.md before using */\n')
        f.write('var STATIONS = [\n' + ',\n'.join('  ' + json.dumps(e, separators=(',', ':')) for e in out_st) + '\n];\n\n')
        f.write('var PROFILE = [\n  ' + ',\n  '.join(','.join('[%g,%d]' % (g, round(p)) for g, p in zip(grid[i:i + 8], prof[i:i + 8])) for i in range(0, len(grid), 8)) + '\n];\n\n')
        f.write('var ROUTE = [\n  ' + ',\n  '.join(','.join('[%g,%.5f,%.5f]' % (man_mi[j], pts[j, 0], pts[j, 1]) for j in keep[i:i + 3]) for i in range(0, len(keep), 3)) + '\n];\n')

    # report
    L = ['# GPX import report', '',
         '| | GPX (cleaned) | Manual |', '|---|---|---|',
         '| Distance | %.2f mi | %s |' % (gpx_mi, ('%.1f mi' % a.manual_miles) if a.manual_miles else '%.1f mi (last station)' % man_total),
         '| Ascent | %s ft | %s |' % (format(int(round(up)), ','), (format(int(a.manual_gain), ',') + ' ft') if a.manual_gain else 'not given'),
         '| Ascent, other methods | raw %s / strict %s ft | |' % (format(int(round(raw_up)), ','), format(int(round(strict_up)), ',')),
         '| Descent | %s ft | |' % format(int(round(down)), ','), '',
         'Cleaning: ' + '; '.join(notes) + ' (of %d raw points). Route simplified to %d points at 3.5 m tolerance.' % (n0, len(keep)), '']
    drift = (scale - 1) * 100
    if abs(drift) > 3: flags.append('Course distance differs from the manual by %.1f%%. Station miles use the MANUAL numbers; terrain between stations is stretched by that factor.' % drift)
    if a.manual_miles and abs(drift) <= 3: L.append('Distance agrees with the manual to %.1f%%.' % abs(drift)); L.append('')
    if a.manual_gain:
        gd = (up - a.manual_gain) / a.manual_gain * 100
        if abs(gd) > 5: flags.append('Ascent differs from the manual by %+.0f%% (GPX %s ft vs %s ft). Decide which to publish.' % (gd, format(int(up), ','), format(int(a.manual_gain), ',')))
    net = ele_ft[-1] - ele_ft[0]
    if abs(up - down) < 5 and abs(net) > 50 and up > 1000: flags.append('Ascent and descent are identical to within 5 ft even though the course finishes %.0f ft %s where it starts. A real track never closes that exactly; the source may be a spreadsheet, not a measurement.' % (abs(net), 'higher' if net > 0 else 'lower'))
    nocoord = [r[0] + ' (mi %.1f)' % r[1] for r in rep_rows[1:-1] if not r[6]]
    if nocoord: flags.append('%d stations had no coordinates and were placed by scaling the manual mile: %s. Their elevation and gain are approximate.' % (len(nocoord), ', '.join(nocoord[:6]) + ('...' if len(nocoord) > 6 else '')))
    L += ['## Needs a human', ''] + (['- ' + f for f in flags] if flags else ['Nothing flagged.']) + ['', '## Stations', '',
          '| # | Station | Manual mi | Track mi | Snap | Elev ft | Gain into ft |', '|---|---|---|---|---|---|---|']
    for i, r in enumerate(rep_rows):
        L.append('| %d | %s | %.1f | %.2f | %s | %s | %s |' % (i, r[0], r[1], r[2], ('%.0f m' % r[3]) if r[3] is not None else 'scaled', format(r[4], ','), format(r[5], ',')))
    open(os.path.join(a.out, 'import-report.md'), 'w').write('\n'.join(L) + '\n')
    print('gpx %.2f mi  ascent %d  descent %d  flags %d  route pts %d  profile pts %d' % (gpx_mi, up, down, len(flags), len(keep), len(grid)))

if __name__ == '__main__':
    main()
