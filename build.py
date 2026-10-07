#!/usr/bin/env python3
"""Build one race into a deployable folder.

  python3 build.py [--race NAME] [--out-dir DIR]

Reads  src/shell.html, src/style.css, src/app.js, src/sw.template.js, src/manifest.template.json
       src/race/NAME/{race.js, partials/*.html, icons/*.png}
Writes DIR/{index.html, sw.js, manifest.webmanifest, icon-*.png}   (default DIR = repo root)
"""
import sys, pathlib, json, subprocess, html, re, hashlib, shutil
R = pathlib.Path(__file__).parent
def arg(flag, default):
    return sys.argv[sys.argv.index(flag)+1] if flag in sys.argv else default
RACE = arg('--race', 'rrr100')
OUT = pathlib.Path(arg('--out-dir', str(R)))
RACE_DIR = R/'src'/'race'/RACE
def rd(path): return (R/'src'/path).read_text(encoding='utf8')

WORDS = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve',
         'Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty']
def race_meta(race_file):
    """Evaluate the race file with node; return RACE plus a few counts derived from the data."""
    js = ("const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);"
          "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.__r={race:RACE,stations:STATIONS.length,stops:CREW.length};',c);"
          "console.log(JSON.stringify(c.__r))")
    m = json.loads(subprocess.check_output(['node', '-e', js, str(race_file)]))
    meta = dict(m['race'])
    meta['counts'] = {'stops': WORDS[m['stops']], 'checkins': WORDS[m['stations']]}
    return meta
META = race_meta(RACE_DIR/'race.js')

def fill(text, extra=None):
    ctx = dict(META, **(extra or {}))
    def sub(m):
        v = ctx
        for part in m.group(1).split('.'):
            assert isinstance(v, dict) and part in v, 'unknown token {{%s}}' % m.group(1)
            v = v[part]
        return html.escape(str(v), quote=False)
    return re.sub(r'\{\{([\w.]+)\}\}', sub, text)
def partial(m):
    f = RACE_DIR/'partials'/('%s.html' % m.group(1))
    assert f.exists(), 'race "%s" is missing partial %s' % (RACE, f.name)
    return fill(f.read_text(encoding='utf8'))

page = fill(rd('shell.html'))
page = re.sub(r'<!--@([\w-]+)-->', partial, page)
# Modules that live inside the app's closure are spliced in at /*@modules*/; pure ones are prepended.
MODULES = ['eta.js', 'sky.js', 'now.js', 'know.js', 'demo.js', 'fly.js']
app = rd('app.js')
assert app.count('/*@modules*/') == 1, 'app.js needs exactly one /*@modules*/ marker'
app = app.replace('/*@modules*/', '\n'.join(rd(m) for m in MODULES))
data = (RACE_DIR/'race.js').read_text(encoding='utf8')
pm = RACE_DIR/'projection-model.json'            # optional: fitted by tools/projection/fit_model.py
if pm.exists():
    json.loads(pm.read_text())
    data += '\nRACE.projModel = ' + pm.read_text().strip() + ';\n'
css = rd('style.css') + '\n' + rd('fonts.css') + '\n' + rd('survey.css')
assert css.count('{') == css.count('}'), 'unbalanced braces in the stylesheet'
for marker, text in (('<!--CSS-->', css), ('<!--DATA-->', data), ('<!--APP-->', rd('pacing.js') + '\n' + rd('projection.js') + '\n' + app)):
    assert page.count(marker) == 1, marker
    page = page.replace(marker, text)
assert '{{' not in page.replace('{{runner}}', ''), 'unresolved token left in page'

OUT.mkdir(parents=True, exist_ok=True)
(OUT/'index.html').write_text(page, encoding='utf8', newline='')
h = hashlib.sha1(page.encode('utf8')).hexdigest()[:8]
(OUT/'sw.js').write_text(fill(rd('sw.template.js'), {'buildHash': h}), encoding='utf8', newline='')
manifest = fill(rd('manifest.template.json'))
json.loads(manifest)                                  # must stay valid JSON
(OUT/'manifest.webmanifest').write_text(manifest, encoding='utf8', newline='')
for f in (RACE_DIR/'icons').glob('*.png'):
    shutil.copy(f, OUT/f.name)
shutil.copy(R/'vendor'/'maplibre-gl.js', OUT/'maplibre-gl.js')      # 3D preview engine, fetched only when 3D is opened
print('built %s -> %s  (%d chars, cache %s-shell-%s)' % (RACE, OUT/'index.html', len(page), META['key'], h))
