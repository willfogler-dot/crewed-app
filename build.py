#!/usr/bin/env python3
"""Inline src/ into index.html. Usage: python3 build.py [--out PATH]"""
import sys, pathlib
R = pathlib.Path(__file__).parent
def rd(n): return (R/'src'/n).read_text(encoding='utf8')
out = rd('shell.html')
for marker, name in (('<!--CSS-->','style.css'),('<!--DATA-->','data.js'),('<!--APP-->','app.js')):
    assert out.count(marker) == 1, marker
    out = out.replace(marker, rd(name))
dest = pathlib.Path(sys.argv[sys.argv.index('--out')+1]) if '--out' in sys.argv else R/'index.html'
dest.write_text(out, encoding='utf8', newline='')
print('built', dest, len(out), 'bytes')
