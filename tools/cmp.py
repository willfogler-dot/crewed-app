#!/usr/bin/env python3
import sys, json, difflib
a, b = (json.load(open(f)) for f in sys.argv[1:3])
bad = 0
for k in a['dom']:
    x, y = a['dom'][k], b['dom'].get(k)
    if x != y:
        bad += 1
        if bad <= 3:
            i = next(i for i in range(min(len(x), len(y))) if x[i] != y[i]) if y else 0
            print('DIFF', k, '\n  old:', x[max(0,i-60):i+90].replace('\n',' '), '\n  new:', (y or '')[max(0,i-60):i+90].replace('\n',' '))
print('%d/%d scenarios identical' % (len(a['dom']) - bad, len(a['dom'])), '| new errors:', [e for e in b['errors'] if e not in a['errors']])
sys.exit(1 if bad else 0)
