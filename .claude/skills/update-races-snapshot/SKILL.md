---
name: update-races-snapshot
description: Refresh the bundled UTMB race snapshot (data/races.json) in the utmb-races app from the UTMB API. Use when asked to update, refresh or regenerate data/races.json, the race snapshot or the fallback race data.
---

# Update data/races.json

`data/races.json` is the bundled fallback snapshot the app loads when the shared Google Sheet cache isn't configured or is empty (see README → "Data and caching"). The site never updates it. It only changes through a commit.

## Steps

1. Run the update script from the repo root:
   ```sh
   bash .claude/skills/update-races-snapshot/scripts/update.sh
   ```
   It pages through `https://api.utmb.world/search/races` (300 per page), converts each race to the slim format and overwrites `data/races.json`. If UTMB returns no races, it exits non-zero and leaves the file untouched. It requires `curl` and `jq`.

2. Sanity-check the result:
   ```sh
   jq '.races | length' data/races.json                       # expect roughly 300; a big drop means something is wrong
   jq -r '[.races[].status] | group_by(.) | map("\(.[0] // "null") \(length)")[]' data/races.json
   git diff --stat data/races.json
   ```

3. Check for countries missing from the continent map. They show up as **Other** in the app:
   ```sh
   node -e 'const fs=require("fs");eval(fs.readFileSync("geo.js","utf8")+";globalThis.c=continentOf");
     const d=JSON.parse(fs.readFileSync("data/races.json"));
     console.log([...new Set(d.races.map(r=>(r.startLocation||"").split(", ").pop()))].filter(x=>c(x)==="Other"))'
   ```
   `undefined` is expected for races without a location. For the event-level fallback, see `EVENT_LOCATION_FALLBACK` in `geo.js`. Add any real country to `CONTINENTS` in `geo.js`, and add a new event without a location to `EVENT_LOCATION_FALLBACK`.

4. Optionally preview it: `python3 -m http.server 8000`, open http://localhost:8000, and check that the header says "bundled snapshot" with today's date. If the browser has newer data in localStorage, that copy wins. Clear `utmb-races:cache:v1` to see the snapshot.

5. Commit `data/races.json` (and `geo.js` if you changed it) with a message like `Update race snapshot (N races)`. Push only if the user asks.

## Format

```json
{
  "updatedAt": "2026-11-16T19:09:54Z",
  "source": "snapshot",
  "races": [
    {
      "id": 1673,
      "startDate": "13th November 2026",
      "name": "TransLantau by UTMB - TransLantau100",
      "startLocation": "Mui Wo River Silver Garden, Hong Kong, China",
      "status": "registration_open",
      "distance": 104,
      "elevationGain": 4500,
      "runningStones": 3,
      "category": "100k",
      "link": "https://translantau.utmb.world/races/tl100",
      "playgrounds": ["hikingTrail", "coastalPath"]
    }
  ]
}
```

The same shape is produced by `slim_()` in `apps-script/Code.gs` and `slim()` in `app.js`. If you add or rename a field, change all three places and the jq filter in `scripts/update.sh`. Keep `id` stable, because likes are stored by race id.
