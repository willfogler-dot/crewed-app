#!/usr/bin/env python3
"""Render an app build across tabs/sizes/themes/clock times and dump DOM to JSON.
usage: snap.py BUILD.html OUT.json"""
import sys, json
from playwright.sync_api import sync_playwright
build, out = sys.argv[1], sys.argv[2]
SIZES = {'phone': (390, 844), 'ipad': (820, 1180)}
CLOCKS = {'pre': '2026-09-17T12:00:00-06:00', 'mid': '2026-09-18T20:00:00-06:00'}
TABS = ['Race', 'Course', 'Aid', 'Schedule', 'Profile']
DUMP = "(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('script,style').forEach(e=>e.remove());return c.innerHTML})()"
DEEP = [('fullmap','Course','#fmOpen'), ('acc1','Course','.acc-hd@0'), ('acc5','Course','.acc-hd@4'), ('acc12','Course','.acc-hd@11'),
        ('planner','Profile','text=Race day planner'), ('pacerplan','Profile','text=Pacer plan'), ('distclimb','Profile','text=Distance and climb'),
        ('rules','Profile','text=Rules that end your race'), ('rotation','Profile','text=Crew rotation'), ('dropbags','Profile','#profileHub .item@2'),
        ('crewpacers','Profile','text=Crew and pacers'), ('weather','Profile','text=Weather and light'),
        ('dropbags2','Profile','#profileHub .item@2'), ('gear','Profile','#profileHub .item@1'), ('carries','Profile','#profileHub .item@3'), ('prewrap','Profile','#profileHub .item@4'),
        ('manual','Profile','#profileHub .item@12'),
        ('lens_crew','Course','text=Crew access'), ('lens_pacer','Course','text=Pacers'),
        ('aid_fish','Aid','#aidList .item@2'), ('aid_summit','Aid','#aidList .item@4'), ('aid_dry','Aid','#aidList .item@6'), ('aid_finish','Aid','#aidList .item@16'), ('howworks','Profile','text=How this works'), ('askrd','Profile','text=Ask the RDs on Thursday')]
SEED = ("try{localStorage.setItem('rrr.people',JSON.stringify([{id:'c1',name:'Test Crew',role:'crew',stops:[2,6,10,14]},{id:'p1',name:'Test Pacer',role:'pacer'}]));"
        "localStorage.setItem('rrr.atomwho',JSON.stringify({0:'p1',1:'p1'}));}catch(e){}")
res, errs = {}, []
with sync_playwright() as p:
    b = p.chromium.launch()
    for sz, (w, h) in SIZES.items():
      for theme in ('light', 'dark'):
        for ck, t in CLOCKS.items():
            c = b.new_context(viewport={'width': w, 'height': h}, color_scheme=theme)
            c.add_init_script("try{localStorage.setItem('rrr.theme','%s')}catch(e){}" % theme)
            pg = c.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
            pg.on('console', lambda m: errs.append(m.text[:150]) if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load' not in m.text else None)
            pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
            pg.clock.set_fixed_time(t)
            pg.goto('file://' + build + '?runner'); pg.wait_for_timeout(900)
            try: pg.get_by_text('Running it').click(); pg.wait_for_timeout(700)
            except Exception: pass
            for tab in TABS:
                try:
                    pg.get_by_role('button', name=tab, exact=True).first.click(); pg.wait_for_timeout(450)
                    res['%s|%s|%s|%s' % (sz, theme, ck, tab)] = pg.evaluate("(()=>{const c=document.body.cloneNode(true);c.querySelectorAll(\"script,style\").forEach(e=>e.remove());return c.innerHTML})()")
                except Exception as e:
                    res['%s|%s|%s|%s' % (sz, theme, ck, tab)] = 'ERR ' + str(e)[:80]
            for name, tab, sel in (DEEP if (theme == 'light' and ck == 'mid') else []):
                try:
                    c2 = b.new_context(viewport={'width': w, 'height': h}, color_scheme=theme)
                    c2.add_init_script("try{localStorage.setItem('rrr.theme','%s')}catch(e){}" % theme)
                    pg2 = c2.new_page(); pg2.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
                    pg2.clock.set_fixed_time(t)
                    pg2.goto('file://' + build + '?runner'); pg2.wait_for_timeout(700)
                    try: pg2.get_by_text('Running it').click(timeout=4000); pg2.wait_for_timeout(500)
                    except Exception: pass
                    pg2.get_by_role('button', name=tab, exact=True).first.click(timeout=6000); pg2.wait_for_timeout(400)
                    if sel.startswith('text='): pg2.get_by_text(sel[5:]).first.click(timeout=6000)
                    elif '@' in sel: s, n = sel.split('@'); pg2.locator(s).nth(int(n)).click(timeout=6000)
                    else: pg2.locator(sel).first.click(timeout=6000)
                    pg2.wait_for_timeout(700)
                    res['%s|%s|%s|%s' % (sz, theme, ck, name)] = pg2.evaluate(DUMP)
                    c2.close()
                except Exception as e:
                    res['%s|%s|%s|%s' % (sz, theme, ck, name)] = 'ERR ' + str(e)[:80]
            if theme == 'light' and ck == 'mid':
                for pname, label in (('crew', 'Test Crew'), ('pacer', 'Test Pacer')):
                    try:
                        c3 = b.new_context(viewport={'width': w, 'height': h}, color_scheme=theme)
                        c3.add_init_script(SEED)
                        pg3 = c3.new_page(); pg3.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
                        pg3.clock.set_fixed_time(t)
                        pg3.goto('file://' + build + '?runner'); pg3.wait_for_timeout(700)
                        pg3.get_by_text(label).first.click(timeout=6000); pg3.wait_for_timeout(700)
                        for tab in ['Crew', 'Race', 'Course', 'Aid', 'Schedule', 'Profile']:
                            pg3.get_by_role('button', name=tab, exact=True).first.click(timeout=6000); pg3.wait_for_timeout(450)
                            res['%s|%s|%s|%s' % (sz, pname, ck, tab)] = pg3.evaluate(DUMP)
                        c3.close()
                    except Exception as e:
                        res['%s|%s|%s|persona' % (sz, pname, ck)] = 'ERR ' + str(e)[:80]
            c.close()
    b.close()
json.dump({'dom': res, 'errors': sorted(set(errs))}, open(out, 'w'))
print('scenarios', len(res), '| errors', sorted(set(errs))[:5])
