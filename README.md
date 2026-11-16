# UTMB Races

A minimal static web app (GitHub Pages) that lists upcoming **UTMB World Series** races and their registration availability. A second page, **Iconic Europe**, lists famous European trail races that aren't part of the UTMB World Series.

Live: https://lawreenas.github.io/utmb-races/ · [Iconic Europe](https://lawreenas.github.io/utmb-races/europe.html) · [Hut to Hut](https://lawreenas.github.io/utmb-races/huts.html)

## Features

### Race list
- All races from the UTMB API (`api.utmb.world/search/races`), upcoming only by default.
- Columns: date, race name (links to the official race page), event, location (place, country), continent, distance (km), elevation gain (m D+), World Series category (20K / 50K / 100K / 100M), Running Stones and availability.
- **Availability** badges:
  | Badge | UTMB status |
  |---|---|
  | Open | `registration_open` |
  | Opens soon | `available_soon` |
  | Sold out | `registration_sold_out` |
  | Closed | `registration_closed` |
  | Unknown | no status returned |
- Sortable by any column (click a header; click again to reverse).
- Click a location to open it in Google Maps (new tab).
- **Likes**: tap ♡ on a race to like it, and tap again to unlike. The **♥ Liked** button shows only liked races and how many there are. Sorting by the ♥ column puts liked races first. Likes are saved in your browser (localStorage, by UTMB race id), so they're personal and stay through data refreshes, but they don't sync between devices or browsers.
- Responsive: a table on desktop, cards on phones. Follows the system light/dark theme.

### Filters
All filters combine (AND). Within one chip group, the selected values combine as OR. Each chip shows how many races it matches.
- **Search**: free text across race name, event, place, country and continent (every word must match).
- **Availability**: Open, Opens soon, Sold out, Closed or Unknown.
- **Continent**: Europe, Asia, North America, South America, Africa or Oceania.
- **Country**: a dropdown, narrowed to the selected continents.
- **Category**: 20K, 50K, 100K or 100M.
- **More filters**:
  - date range (from / to)
  - distance range (km)
  - elevation gain range (m)
  - minimum Running Stones
  - terrain (UTMB "playgrounds", such as mountain, glacier, jungle or night time)
  - "Include past races"
- **Liked**: show only the races you liked.
- **Reset** clears all filters.
- Filters and sort order are kept in the URL, so you can bookmark or share a filtered view.

### Continents
The country is the last part of UTMB's `startLocation` (for example `"Mui Wo, Hong Kong, China"` → China). `geo.js` maps each country to a continent. Transcontinental countries go by where the races are held (for example Türkiye → Asia). If UTMB returns no location for a race, the app uses the location of another race in the same event, or a manual entry in `EVENT_LOCATION_FALLBACK` in `geo.js`. Countries that aren't in the map appear as **Other**. To fix one, add it to `geo.js`.

### Iconic Europe page (`europe.html`)
A hand-curated list of classic European races outside the UTMB World Series, for example Tor des Géants, Sierre-Zinal, Zegama, Marathon du Mont-Blanc, Lakeland 100, the Spine Race, Dragon's Back and MIUT.
- It has the same table, likes, search, sorting and URL-shareable filters as the UTMB page.
- **Availability** adds a **Lottery** badge. Each badge has a short note underneath with the key dates, such as when a lottery opens or when a race sold out.
- If a date isn't announced yet, the race shows **TBA** with a note (e.g. "Expected late Aug 2027"). These races are always listed.
- Extra filters: **Entry** (first come, lottery, qualification, mixed) and **Series** (Golden Trail World Series, Skyrunner World Series, World Trail Majors, …).
- **Category** (20K/50K/100K/100M) is derived from distance (<35, <75, <140, ≥140 km). Running Stones and continent don't apply, so they're hidden.
- Data: `data/europe-races.json`, researched by hand from official race sites. The header shows the "Last checked" date. There's no live API and no Refresh button. Statuses change around opening and lottery dates, so always check the official site (each race name links to it).

### Hut to Hut page (`huts.html`)
Well-known multi-day routes in Europe where you sleep in huts, refuges or village guesthouses. Examples: TMB, Walker's Haute Route, Alta Via 1 and 2, GR20, HRP, Carros de Foc, Kungsleden, Laugavegur and the High Scardus Trail.
- Columns: route (links to the official or tourism page), region, countries, start → end (both link to Google Maps), typical days, distance, D+, high point (hover for its name), season and difficulty (Moderate / Challenging / Demanding).
- Each route has a detail line with where you sleep, season notes, booking advice and route notes.
- Routes you've completed carry a **Done** badge, set by `done: true` in the data.
- **Length** category, derived from the minimum typical days: **Short** (≤4 days, with a badge), **Week** (5–9) or **Long** (10+). Filter by it to find weekend-plus trips such as Coronallacs, Cavalls del Vent, Giro del Monviso or Tour du Vignemale.
- Filters:
  - **Progress**: to do or done.
  - **Length**: short, week or long.
  - **Difficulty**.
  - **In season**: months; a route matches if any selected month is in its season.
  - Country and search.
  - **More filters**: days range (matches when the route's typical range overlaps), distance, elevation and terrain.
- Likes, sorting and shareable URL filters work as on the other pages. Likes are stored as `hut-<id>`.
- Data: `data/huts.json`, curated by hand. Figures vary between sources and route variants, so official figures are used where they exist. A blank cell means no reliable figure was found.

### Data and caching
When the page loads, it shows the newest data it can find, in this order:
1. **localStorage**: the last data this browser saw, shown instantly.
2. **Shared cache**: a Google Sheet behind an Apps Script web app, shared by all users. Only used if `API_URL` is set in `config.js`.
3. **Bundled snapshot**: `data/races.json` in this repo. Used when the shared cache isn't configured or is empty.

The header shows when the data was fetched and where it came from.

**Refresh from UTMB** calls the Apps Script, which fetches every race from UTMB (with pagination), writes them to the sheet and returns them. Everyone who opens the app afterwards gets the new data. Refreshes are throttled to one every 5 minutes for everyone. A refresh inside that window just returns the cached data.

Without a shared cache, Refresh tries to call UTMB directly from the browser. This currently fails because UTMB doesn't allow cross-origin requests, so the app tells you to set up the shared cache.

## Shared cache setup (Google Sheets + Apps Script)

1. Create a new Google Sheet, for example "UTMB Races cache".
2. Open **Extensions → Apps Script**, replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs), and save.
3. Optional: run `refreshRaces` once from the editor. This grants permissions and fills the sheet.
4. Click **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the web app URL (`https://script.google.com/macros/s/…/exec`) into `config.js`:
   ```js
   window.UTMB_CONFIG = { API_URL: 'https://script.google.com/macros/s/…/exec' };
   ```
6. Commit and push.

Optional: to refresh automatically, add a time-driven trigger (**Triggers → Add trigger**) that runs `refreshRaces`, for example daily.

The race data is stored in the `races` tab, one race per row. The web app supports two calls:
- `GET <url>`: returns the cached races as JSON.
- `GET <url>?action=refresh`: fetches fresh data from UTMB, stores it and returns it.

After you change `Code.gs`, publish a new version: **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same URL.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page markup |
| `style.css` | Styles (light and dark, responsive) |
| `app.js` | Data loading, caching, normalization, filters, sorting, rendering |
| `geo.js` | Country → continent map and location fallbacks |
| `config.js` | Shared cache URL |
| `data/races.json` | Bundled fallback snapshot (UTMB) |
| `europe.html` | Iconic Europe page (`<body data-page="europe">`; same `app.js`) |
| `data/europe-races.json` | Curated non-UTMB European races |
| `huts.html`, `huts.js` | Hut to Hut page and its logic |
| `data/huts.json` | Curated hut-to-hut routes |
| `apps-script/Code.gs` | Google Apps Script backend (shared cache and UTMB proxy) |

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

No build step and no dependencies.

## Claude Code skills

The repo includes project skills in `.claude/skills/`:
- **update-races-snapshot**: regenerates `data/races.json` from the UTMB API (`scripts/update.sh`).
- **manage-hut-routes**: adds, updates, removes and marks routes done in `data/huts.json`. It includes a validator (`scripts/validate.mjs`).
- **manage-europe-races**: adds, updates, re-checks or removes races in `data/europe-races.json`. It covers the record format, how to roll a race over to its next edition, and a validator (`scripts/validate.mjs`) that checks the schema and flags past dates, stale data and overlap with UTMB events.
