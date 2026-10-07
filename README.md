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

## Importing a new race's course

```bash
python3 tools/gpx_import.py --gpx course.gpx --stations stations.json --out out/ \
        --manual-miles 31.2 --manual-gain 3325
```

`stations.json` lists the aid stations in race order with the manual's mileage (and any lat/lon, otherwise CalTopo
waypoints with matching names are used). It writes `out/geo.js` (STATIONS, PROFILE, ROUTE) and `out/import-report.md`.
Read the report's "Needs a human" section before using the output. Ascent is smoothed over 60 m with no extra
threshold; on Rock Hawk that gave 3,342 ft against the race's advertised 3,325 ft, and station gains landed within
25 ft of hand measurements. The report also shows the raw and strict figures so the method range is visible.
