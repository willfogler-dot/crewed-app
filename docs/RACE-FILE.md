# The race file

One race, one year, one folder: `src/race/<name>/`. The app code never changes between races.
Start by copying `src/race/_template/`, which is the smallest race that builds.

```
src/race/<name>/
  race.js                  required   the facts of the race (this document)
  projection-model.json    optional   live-ETA model fitted from a past year's results
  partials/*.html          optional   long race-specific prose (crew rules, pacer notes)
  icons/*.png              optional   overrides the shared icons in src/icons/
```

```bash
python3 tools/check_race.py <name>                       # must report 0 errors
python3 build.py --race <name> --out-dir site/<name>     # index.html, sw.js, manifest, icons
```

Anything a race file leaves out is filled in by `src/race-defaults.js`. A race states what is true of that
race and nothing else. Nothing personal to a runner belongs here: no names, notes, fuel or shopping lists.

## Required

| Name | What it is |
|---|---|
| `RACE.name` | Shown everywhere. |
| `RACE.key` | Lowercase letters and digits. Prefixes storage and the offline cache, so it must be unique per race and year. |
| `RACE.startISO` | Start time with its UTC offset, e.g. `2027-06-05T06:00:00-06:00`. |
| `RACE.tz` | IANA time zone, e.g. `America/Denver`. Every clock in the app is shown in this zone. |
| `RACE.limit` | Minutes from the start to the final cutoff. |
| `PLANS` | The goals a runner picks between. Each is `{ k, name, min }` where `min` is a finish in minutes; the pacing model fills every station. Exactly one has `cutoff:true`. A plan may instead carry hand-built minutes on every station under its key. |
| `STATIONS` | Every check-in in order: `{ mi, name, elev, gain, bag, crew, pacer, cut, note }`. `mi` is the race's published mileage, first one 0. `gain` is feet climbed on the leg into the station. `crew`: 0 none, 1 yes, 2 on foot only, 3 drop-off only. `pacer:1` where a pacer may join or leave. `cut` is minutes from the start, or null. |
| `PROFILE` | `[mile, feet]` every tenth of a mile. From `tools/gpx_import.py`. |
| `ROUTE` | `[mile, lat, lon]` for the map line. From `tools/gpx_import.py`. |

## Strongly recommended

| Name | What it is | If left out |
|---|---|---|
| `RACE.short`, `RACE.place` | Header name and location. | Name is reused; place is blank. |
| `RACE.sun` | `{ rise, set, dark }` as `"6:51 am"`. Drives the sky, "in the dark" and the weather screen. | Generic times. |
| `RULES` | `[rule, detail]` pairs: what ends a race. | Empty screen. |
| `EVENTS` | `{ iso, t, d, key }`, `iso` in race-local time with no offset. | Empty schedule. |
| `CREW` | The stops a crew drives to: `{ n, where, mi, drive, opt, off, rest, body }`. `n` is a stable id. `drive` is minutes. `off:1` hides a stop by default. | One stop per crew-accessible station, no directions. |
| `DRIVES` | Keyed by a stop's `where`: `{ t, d, warn }` driving directions. | No directions shown. |
| `RACE.mapQuery` / `RACE.noMap` | Keyed by `where`: a safe map-app destination, or the reason a map app must not be used. | No directions button. |

## Optional content

| Name | What it is |
|---|---|
| `SECTIONS` | Written course sections, each from one station mile to another. Default: one plain section per leg. |
| `AIDX` | One entry per station: `{ ll:[lat,lon], has, desc }`. |
| `PACERS` | Written-up pacer legs between `pacer:1` stations. |
| `MANDATORY` | Gear the race checks. |
| `DROPBAGS`, `CARRIES` | Drop-bag advice and long stretches without water. Their screens are hidden when empty. |
| `ANALYSIS` + `partials/field-history.html` | Past-results table. |
| `MANUAL_TOC`, `RACE.manualFile`, `RACE.manualPages` | The manual as a PDF beside the build, and a guide to it. |
| `RACE.copy.*` | Race-specific sentences: `footer`, `rulesLine`, `cutoffsNote`, `helpRules`, `briefRules`, `weatherIntro`, `weatherNotes`, `elevIntro`, `elevNotes`, `bibNote`, `dropOnly`, `gearIntro`, `bagsIntro`, `pacerBlocksIntro`, `fieldNotes`, `lens`, `follow`. |
| `RACE.measured` | `{ mi, up, down }` from the course file, when it differs from the published figures. |
| `RACE.runner.division`, `RACE.runner.bibRange` | Shown on the runner's card. |
| `RACE.pacing` | `{ climbFt, fade }` to tune the pacing model for this course. |
| `RACE.dwell` | Typical minutes stopped, by station index, for the ETA engine. |
| `RACE.demoPeople` | A stand-in team for a demo build with no backend. |
| `SUPA` | `{ url, key, db }` for the shared plan and the timing feed. Blank runs local-only. |
| `GEAR` | Replaces the neutral starter gear list. Rarely needed. |

## Who writes what

| Layer | Written by | Lives in |
|---|---|---|
| Course geometry | `tools/gpx_import.py` from the race's GPX | `STATIONS` (mi, elev, gain), `PROFILE`, `ROUTE` |
| Race facts | Us, from the manual; the race director signs off | everything else in `race.js` |
| ETA model | `tools/projection/fit_model.py` from a past year's splits | `projection-model.json` |
| The runner's plan | The runner or crew chief, in the app | the phone and the shared plan, never the race file |
