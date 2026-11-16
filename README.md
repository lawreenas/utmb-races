# UTMB Races

A minimal static web app (GitHub Pages) that lists upcoming **UTMB World Series** races and their registration availability.

Live: https://lawreenas.github.io/utmb-races/

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
| `data/races.json` | Bundled fallback snapshot |
| `apps-script/Code.gs` | Google Apps Script backend (shared cache and UTMB proxy) |

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

No build step and no dependencies.
