#!/usr/bin/env python3
"""2025 RRR100 Tortoise results workbook -> cleaned elapsed-minute matrix (JSON).

usage: parse_results.py results.xlsm out.json

Elapsed times in the workbook are Excel times of day: a value past 24h is stored as a datetime on
1900-01-01 with the clock part only, so 25:09 appears as 1:09. Some cells are mis-keyed (21:39 for
11:39). We unwrap by cell type, then drop the fewest cells that make each runner's row strictly
increasing (longest increasing subsequence). Dropped cells become missing, never "repaired".
Names are NOT written out; the output is bib-free and anonymous.
"""
import sys, json, datetime as dt
import openpyxl

MILES = [5.4, 17.7, 24.3, 30.1, 34.3, 44.5, 51.2, 63.9, 70.8, 76.6, 80.8, 89.0, 95.8, 101.8]
FIRST = 6   # column index of the first checkpoint

def to_min(v):
    if isinstance(v, dt.datetime):
        # past 24h: a datetime on 1900-01-01 holding the clock part. Any other date is a placeholder (e.g. 3 Feb 22:59 in
        # the finish column of dropped runners), not a time.
        return v.hour * 60 + v.minute + v.second / 60 + 1440 if v.date() == dt.date(1900, 1, 1) else None
    if isinstance(v, dt.time): return v.hour * 60 + v.minute + v.second / 60
    return None

def lis_keep(vals):
    """indices of a longest strictly increasing subsequence of the non-missing values"""
    idx = [i for i, v in enumerate(vals) if v is not None]
    n = len(idx); best = [1] * n; prev = [-1] * n
    for a in range(n):
        for b in range(a):
            if vals[idx[b]] < vals[idx[a]] and best[b] + 1 > best[a]: best[a], prev[a] = best[b] + 1, b
    if not n: return set()
    k = max(range(n), key=lambda i: best[i]); keep = set()
    while k != -1: keep.add(idx[k]); k = prev[k]
    return keep

def main():
    wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
    out, dropped_cells, status_counts = [], 0, {}
    for r in list(wb['Tortoise'].iter_rows(values_only=True))[6:]:
        if r[2] is None: continue
        raw = [to_min(r[FIRST + i]) for i in range(len(MILES))]
        keep = lis_keep(raw)
        clean = [raw[i] if i in keep else None for i in range(len(MILES))]
        dropped_cells += sum(1 for i in range(len(MILES)) if raw[i] is not None and i not in keep)
        place = r[1]
        finished = isinstance(place, int) and clean[-1] is not None
        status = 'finished' if finished else str(place).lower()
        status_counts[status] = status_counts.get(status, 0) + 1
        out.append({'t': [None if x is None else round(x, 2) for x in clean], 'finished': finished, 'status': status,
                    'gender': r[4]})
    json.dump({'miles': MILES, 'runners': out}, open(sys.argv[2], 'w'))
    fin = [x for x in out if x['finished']]
    print('runners', len(out), 'finished', len(fin), 'status', status_counts, 'cells dropped by LIS', dropped_cells)
    if fin: 
        ft = sorted(x['t'][-1] for x in fin)
        print('finish h: min %.1f median %.1f max %.1f' % (ft[0]/60, ft[len(ft)//2]/60, ft[-1]/60))

if __name__ == '__main__':
    main()
