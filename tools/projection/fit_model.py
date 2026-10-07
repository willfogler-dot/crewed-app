#!/usr/bin/env python3
"""Fit and cross-validate the leg-ratio projection model on cleaned splits (output of parse_results.py).

usage: fit_model.py tortoise.json [--out model.json]

Idea. A runner's pace is not a number, it is a ratio to the field that drifts. For any origin knot `a`
(the last mat read) and target knot `b`, the model predicts

    y = log( (e_b - e_a) / (m_b - m_a) )        # remaining time vs. what the median finisher took on that stretch

from what the runner has done so far (cumulative ratio, last two leg ratios). Fitted per (a, b) pair with
ridge, so 'behind early, strong late' is learned from the field rather than assumed away. Intervals are
empirical residual quantiles of y. Baselines are the three methods a naive tracker would use.
"""
import json, sys, argparse
import numpy as np

SKIP_MILES = {76.6}          # no timing mat at Billy's inbound
Q = (0.1, 0.5, 0.9)

def load(path):
    d = json.load(open(path))
    miles = [0.0] + [m for m in d['miles'] if m not in SKIP_MILES]
    keep = [i for i, m in enumerate(d['miles']) if m not in SKIP_MILES]
    T = np.full((len(d['runners']), len(miles)), np.nan)
    for r, run in enumerate(d['runners']):
        T[r, 0] = 0.0
        for j, i in enumerate(keep):
            if run['t'][i] is not None: T[r, j + 1] = run['t'][i]
    fin = np.array([r['finished'] for r in d['runners']])
    return np.array(miles), T, fin

def reference(T, fin):
    return np.array([0.0] + [np.nanmedian(T[fin, k]) for k in range(1, T.shape[1])])

def feats(e, m, a):
    """features at origin a for one runner (e = elapsed row). Missing legs are skipped to the previous read."""
    ok = [k for k in range(a + 1) if not np.isnan(e[k])]
    if a not in ok: return None
    f1 = np.log(e[a] / m[a]) if a > 0 else 0.0
    p = ok[-2] if len(ok) >= 2 else None
    f2 = np.log((e[a] - e[p]) / (m[a] - m[p])) if p is not None else 0.0
    pp = ok[-3] if len(ok) >= 3 else None
    f3 = np.log((e[p] - e[pp]) / (m[p] - m[pp])) if pp is not None else 0.0
    return np.array([f1, f2, f3])

def build(T, m, a, b, idx):
    X, y, rows = [], [], []
    for r in idx:
        if np.isnan(T[r, a]) or np.isnan(T[r, b]): continue
        f = feats(T[r], m, a)
        if f is None: continue
        X.append(f); y.append(np.log((T[r, b] - T[r, a]) / (m[b] - m[a]))); rows.append(r)
    return np.array(X), np.array(y), rows

def ridge(X, y, lam):
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = (X - mu) / sd
    A = Z.T @ Z + lam * np.eye(Z.shape[1])
    w = np.linalg.solve(A, Z.T @ (y - y.mean()))
    return {'mu': mu, 'sd': sd, 'w': w, 'b0': y.mean()}

def predict(mod, f):
    return mod['b0'] + ((f - mod['mu']) / mod['sd']) @ mod['w']

def fit(T, fin, train, lam=8.0):
    m = reference(T[train], fin[train])
    n = T.shape[1]; models = {}
    for a in range(n - 1):
        for b in range(a + 1, n):
            X, y, _ = build(T, m, a, b, train)
            if len(y) < 25: continue
            mod = ridge(X, y, lam); res = y - np.array([predict(mod, x) for x in X])
            mod['q'] = np.quantile(res, Q); mod['n'] = len(y)
            models[(a, b)] = mod
    return m, models

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('data'); ap.add_argument('--out'); ap.add_argument('--lam', type=float, default=8.0)
    a = ap.parse_args()
    miles, T, fin = load(a.data)
    finishers = np.where(fin)[0]            # train and score on finishers; DNF behaviour is a separate question
    rng = np.random.default_rng(7); perm = rng.permutation(finishers); folds = np.array_split(perm, 10)
    n = T.shape[1]
    rec = []                                 # (a, b, method, err_min, rel_err, in80)
    for k, test in enumerate(folds):
        train = np.concatenate([f for j, f in enumerate(folds) if j != k])
        m, models = fit(T, fin, train, a.lam)
        for aa in range(1, n - 1):                       # origin must be a real mat read
            for b in range(aa + 1, n):
                if (aa, b) not in models: continue
                mod = models[(aa, b)]
                for r in test:
                    if np.isnan(T[r, aa]) or np.isnan(T[r, b]): continue
                    f = feats(T[r], m, aa)
                    if f is None: continue
                    base = T[r, aa]; span = m[b] - m[aa]; actual = T[r, b]
                    preds = {'model': base + span * np.exp(predict(mod, f) + mod['q'][1]),
                             'field pace (delay persists)': base + span,
                             'pace ratio so far': base + span * np.exp(f[0]),
                             'last leg ratio': base + span * np.exp(f[1])}
                    lo = base + span * np.exp(predict(mod, f) + mod['q'][0]); hi = base + span * np.exp(predict(mod, f) + mod['q'][2])
                    for name, p in preds.items():
                        rec.append((aa, b, name, p - actual, abs(p - actual) / (actual - base), lo <= actual <= hi if name == 'model' else None))
    names = ['model', 'field pace (delay persists)', 'pace ratio so far', 'last leg ratio']
    def show(title, sel):
        print('\n' + title)
        print('%-30s %10s %10s %10s' % ('method', 'MAE min', 'median AE', 'MAE % of remaining'))
        for nme in names:
            v = [(abs(x[3]), x[4]) for x in rec if x[2] == nme and sel(x)]
            if v: print('%-30s %10.1f %10.1f %9.1f%%' % (nme, np.mean([x[0] for x in v]), np.median([x[0] for x in v]), 100 * np.mean([x[1] for x in v])))
        cov = [x[5] for x in rec if x[2] == 'model' and sel(x) and x[5] is not None]
        print('80%% interval coverage: %.1f%%  (n=%d)' % (100 * np.mean(cov), len(cov)))
    show('Next mat read (1 ahead)', lambda x: x[1] == x[0] + 1)
    show('Two ahead', lambda x: x[1] == x[0] + 2)
    show('Finish, from origins in the first half (mat 1-6)', lambda x: x[1] == n - 1 and x[0] <= 6)
    show('Finish, from origins in the second half (mat 7-12)', lambda x: x[1] == n - 1 and x[0] >= 7)
    show('Every (origin, target) pair', lambda x: True)

    # fit on everyone and report what the data say about mean reversion
    m, models = fit(T, fin, finishers, a.lam)
    print('\nreference (field median elapsed, hours):', ' '.join('%.2f' % (x / 60) for x in m))
    print('coefficient on cumulative-ratio feature, origin -> finish (negative = runners who are behind recover):')
    for aa in range(1, n - 1):
        mod = models.get((aa, n - 1))
        if mod: print('  mat %2d (%.1f mi): w_cum=%+.3f  w_last=%+.3f  w_prev=%+.3f   resid q10/q50/q90 = %+.3f %+.3f %+.3f  n=%d' % (aa, miles[aa], mod['w'][0] / mod['sd'][0], mod['w'][1] / mod['sd'][1], mod['w'][2] / mod['sd'][2], *mod['q'], mod['n']))
    if a.out:
        out = {'miles': miles.tolist(), 'ref': m.tolist(), 'models': {}}
        for (aa, b), mod in models.items():
            out['models']['%d,%d' % (aa, b)] = {'mu': mod['mu'].round(5).tolist(), 'sd': mod['sd'].round(5).tolist(), 'w': mod['w'].round(5).tolist(), 'b0': round(float(mod['b0']), 5), 'q': [round(float(x), 5) for x in mod['q']], 'n': mod['n']}
        json.dump(out, open(a.out, 'w')); print('wrote', a.out)

if __name__ == '__main__':
    main()
