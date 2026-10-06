# Crewed

Race-day plan for mountain ultrarunners, their crew and pacers. Offline-first PWA.

Baseline: byte-identical rebuild of the RRR100 2026 app (v93). The original lives
untouched in `willfogler-dot/run-rabbit-run` as the reference.

```
src/shell.html   markup with <!--CSS--> <!--DATA--> <!--APP--> markers
src/style.css    styles
src/data.js      race data (to be moved into a swappable race file)
src/app.js       logic
build.py         inlines src/ into index.html
```

```bash
python3 build.py [--race rrr100] [--out-dir DIR]   # writes index.html, sw.js, manifest.webmanifest, icons
# race content lives in src/race/<race>/ (race.js, partials/, icons/); src/*.template.* are filled from it
```
