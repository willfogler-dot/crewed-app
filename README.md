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

## Interface: Ridgeline

`src/survey.css` is the design system, loaded after `style.css`. The one loud thing is the sky (`src/sky.js`):
the top of the Now screen and of the name picker is the sky as it is at that moment of the race (night, dawn,
day, dusk, with the sun or moon where it would be), ending in the course's own elevation profile, with the
runner as a lamp on the ridge. Below the ridge everything is quiet: a mist page, white rounded surfaces,
indigo ink, and one accent the colour of a headlamp. Labels are sentence case. Headings and numerals are
Bricolage Grotesque (SIL OFL), embedded in `src/fonts.css`. Sunrise and sunset come from `RACE.sun`.

Crew and pacers get three tabs:

- **Now** (`src/now.js`): next stop, ETA with its 80% range, when to be in place, one-tap logging, last sighting, course strip.
- **Plan**: every stop in order.
- **Know** (`src/know.js`): rules, course, team, app.

The runner keeps Race / Course / Aid / Schedule / Profile until the setup flow is rebuilt.

## Live ETA

`src/projection.js` is the fitted model (pure), `src/eta.js` blends it with the runner's plan and feeds every
forecast clock through `smartProject()`. A race ships a model as `src/race/<race>/projection-model.json`,
produced by `tools/projection/fit_model.py` from a past year's splits. With no model the app falls back to
the plan with half the delay carried and a flat range.

## Demo

`?demo` (or `?demo=13.2` for hours into the race) replays a run so the Now screen has something to show
outside race weekend. A build with no backend switches to demo by itself once its race is over; `?live` turns it off.
Nothing in demo is saved or synced.

Modules listed in `build.py` (`MODULES`) are spliced into `app.js` at `/*@modules*/`, inside its closure.

## 3D course preview

`src/fly.js` adds a 3D view to the full-screen course map (the **3D** button). It reuses the preview's own
clock, transport bar, scrubber and speeds, and replaces only the camera: real terrain with imagery draped on
it, a chase camera that follows the trail's heading, a slow orbit at each aid station, and a mini elevation
profile that tracks the same mile.

- Engine: MapLibre GL JS 4.7.1 (BSD-3), vendored in `vendor/` and copied to the build as `maplibre-gl.js`.
  It is fetched only when 3D is first opened.
- Terrain: Terrarium elevation tiles from AWS Open Data. No key, no cost. Imagery: whichever basemap the flat map uses.
- Needs a connection and WebGL. Without either, the flat preview carries on unchanged.
- Camera height is pinned to the course file's elevation (`flyGround`) so a late terrain tile cannot drop
  the camera inside the mountain. This touches two private fields of the pinned engine version.

## Template state

The RRR100 race file ships as a clean template: the runner is "Runner", the fuel plan and crew notes are empty,
gear is a neutral starter list, and there are no personal questions or shopping lists. Race facts (course,
stations, rules, drives, drop-bag advice, schedule) stay. Every crew-accessible station is available as a stop;
ones most crews skip are marked `off:1` in `CREW` and can be switched on in the app.

## Excel export

`src/xlsx.js` is a small dependency-free .xlsx writer (styles, widths, merges, frozen headers, print setup).
`src/export.js` builds the workbook from the plan on the phone: Overview, Pacing, Crew stops, Aid stations,
Pacers, Gear, Drop bags, Schedule. Reached from Know and from App and data. Works offline.

## Adding a race

1. Copy `src/race/_template/` to `src/race/<name>/`.
2. Run `tools/gpx_import.py` on the race's GPX for `STATIONS` geometry, `PROFILE` and `ROUTE`.
3. Fill in the facts from the manual. The contract is `docs/RACE-FILE.md`.
4. `python3 tools/check_race.py <name>` until it reports 0 errors.
5. `python3 build.py --race <name> --out-dir <folder>`.

`src/race-defaults.js` fills in everything a race file leaves out. `example/` is the template race, built,
to prove the app runs on the minimum.
