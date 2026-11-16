---
name: manage-europe-races
description: Add, update, remove or re-check races in the curated "Iconic Europe" list (data/europe-races.json, shown on europe.html) of the utmb-races app. Use when asked to add a race, refresh dates or registration statuses, roll races over to their next edition, or clean up the non-UTMB European race list.
---

# Manage the Iconic Europe race list

`europe.html` shows iconic European trail races that are **not** in the UTMB World Series. There is no API for these races. The list lives in `data/europe-races.json` and is maintained by hand from official race websites. `app.js` renders it with the same table, filters and likes as the UTMB page (`<body data-page="europe">`).

## What belongs on the list
- A well-known trail, sky or mountain race held in Europe, by `geo.js` → continent `Europe`.
- **Not** a UTMB World Series event. Check the event against `data/races.json`; the validator warns about likely matches. Events change hands. If a race joins UTMB ("X by UTMB"), remove it from this list.
- One entry per race distance. Add only an event's iconic distance(s), not every course.

## Record format

```json
{
  "id": "tor-des-geants-330",
  "event": "Tor des Géants",
  "race": "TOR330",
  "startDate": "2027-09-12",
  "dateNote": null,
  "startLocation": "Courmayeur, Italy",
  "distance": 330,
  "elevationGain": 24000,
  "status": "lottery",
  "statusNote": "Lottery Feb 2027",
  "entry": "lottery",
  "series": null,
  "link": "https://www.torxtrail.com/",
  "terrain": ["mountain", "highAltitude", "nightTime"],
  "lastChecked": "2026-11-16",
  "sources": ["https://www.torxtrail.com/"]
}
```

| Field | Rules |
|---|---|
| `id` | A kebab-case slug, which must stay stable: **likes are stored by id**, so renaming it loses users' likes. |
| `event`, `race` | `race` is the distance or race name shown as the main label. It can be empty when the event is a single race. |
| `startDate` | The next edition as `YYYY-MM-DD`, or `null` if it isn't announced. Then `dateNote` is required (e.g. `"Expected early Sep 2027"`). Never invent a date. |
| `startLocation` | `"Place, Country"`. Use the country spelling `geo.js` uses (e.g. `United Kingdom`). |
| `distance`, `elevationGain` | km and m D+ from the official course, as numbers. Use `null` if unknown. |
| `status` | One of `registration_open`, `available_soon`, `lottery`, `registration_sold_out`, `registration_closed`, `unknown`. This is the status **as of `lastChecked`**. |
| `statusNote` | Short, with dates: `"Lottery 1–15 Feb 2027"`, `"Opens 10 Dec 2026"`, `"Sold out; waitlist"`. |
| `entry` | One of `first-come`, `lottery`, `qualification`, `invitation`, `mixed`. |
| `series` | For example `Golden Trail Series` or `Skyrunner World Series`, or `null` if the race is independent. |
| `terrain` | Same vocabulary as UTMB `playgrounds`: `mountain`, `highAltitude`, `glacier`, `singleTrack`, `hikingTrail`, `woods`, `hill`, `coastalPath`, `beach`, `road`, `nightTime`, `dayTime`. |
| `lastChecked` | The date you verified the record (`YYYY-MM-DD`). |
| `sources` | 1–3 URLs you actually used. Official site first. |

The category chip (20K/50K/100K/100M) is derived from `distance` in `app.js` (`categoryFromDistance`). Don't store it.

## Workflows

### Add a race
1. Confirm it isn't a UTMB event: `jq -r '.races[].name|split(" - ")[0]' data/races.json | sort -u | grep -i <name>`.
2. Research the next edition on the **official site**: date, start place, distance, D+, how entry works and the current registration state. Use news or calendars only to fill gaps, and say so in `sources`.
3. Add the record. Keep the file sorted by `startDate` (nulls last), and set the top-level `updatedAt` to today.
4. If the country is new, add it to `CONTINENTS.Europe` in `geo.js`.
5. Validate (see below) and preview.

### Re-check statuses and dates (routine refresh)
Registration states change quickly around opening, lottery and sell-out dates. For every race, or for those the validator flags:
- Re-verify `status`, `statusNote` and `startDate` on the official site, then set `lastChecked` to today.
- **Roll over** races whose `startDate` has passed. Set the next edition's date if it's announced; otherwise set `startDate: null` and use `dateNote`. Reset `status` (usually `available_soon` or `unknown`).
- If the facts are uncertain, prefer `unknown` or a `null` date with a note over a guess.

### Remove a race
Delete the record if the race joined UTMB, was discontinued or isn't iconic any more. Mention in the commit message why it was removed.

## Validate and preview

```sh
node .claude/skills/manage-europe-races/scripts/validate.mjs
```
- **Errors** (exit 1) are schema problems: a bad id, date format, status or entry value, a country not mapped to Europe, a missing link or `lastChecked`, or a duplicate id. Fix them before committing.
- **Warnings** are dates in the past, `lastChecked` older than 60 days, missing sources or distances, and names that look like a UTMB event. Resolve them or consciously accept them.

To preview: `python3 -m http.server 8000`, then open http://localhost:8000/europe.html.

Commit with a message like `Europe races: add X, update statuses`. Push only if the user asks.
