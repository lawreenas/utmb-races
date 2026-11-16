---
name: manage-hut-routes
description: Add, update, remove or mark as done multi-day hut-to-hut routes in the utmb-races app (data/huts.json, shown on huts.html). Use when asked to add a trek or fastpacking route, mark a route as completed, fix route figures or booking info, or re-check the Hut to Hut list.
---

# Manage the Hut to Hut route list

`huts.html` (rendered by `huts.js`) lists well-known multi-day routes in Europe where you sleep in mountain huts or refuges. The data lives in `data/huts.json` and is maintained by hand. Routes don't have editions, so the facts are fairly stable. What changes is **booking practice** and **hut opening seasons**, and the user's **done** list.

## What belongs on the list
- Established, named multi-day routes (2+ days; short 3–4 day loops are welcome) with huts, refuges or village guesthouses along the way. The routes the user has done are a good guide to the style: Alta Via 2, Peaks of the Balkans, GR221, GR11.
- Europe only. Countries must exist in `geo.js`; add a new one there under the right continent.
- One entry per route. Mention common variants in `difficultyNote` or `booking` instead of adding duplicates.

## Record format

```json
{
  "id": "tour-du-mont-blanc",
  "name": "Tour du Mont Blanc",
  "region": "Mont Blanc massif",
  "countries": ["France", "Italy", "Switzerland"],
  "start": "Les Houches",
  "end": "Les Houches",
  "distance": 170,
  "elevationGain": 10000,
  "highestPoint": 2665,
  "highestPointName": "Fenêtre d'Arpette",
  "days": [7, 11],
  "season": [6, 7, 8, 9],
  "seasonNote": "Huts open mid-Jun to mid-Sep",
  "accommodation": "Mountain huts, gîtes and hotels",
  "difficulty": "moderate",
  "difficultyNote": "Well-marked; long days; a few ladders",
  "booking": "Huts book out; reserve from Jan",
  "link": "https://www.autourdumontblanc.com/",
  "terrain": ["mountain", "hikingTrail", "singleTrack"],
  "done": false,
  "lastChecked": "2026-11-16",
  "sources": ["https://www.autourdumontblanc.com/"]
}
```

| Field | Rules |
|---|---|
| `id` | A kebab-case slug, which must stay stable: likes are stored as `hut-<id>`. |
| `countries` | Ordered along the route, so the first is the start country and the last the end country. These feed the map links. |
| `start`, `end` | Place names. For a loop, set `end` to the same value as `start`; it shows as "(loop)". |
| `distance`, `elevationGain`, `highestPoint` | km, total m of ascent and m. Use the official figures; `null` if unknown. Put the pass or peak in `highestPointName`. |
| `days` | `[min, max]` typical stages for hikers. This also sets the **Length** category (computed in `huts.js` → `lengthOf`): **Short** when min ≤ 4, **Week** when min is 5–9, **Long** when min is 10+. Short routes get a badge. Don't store the category. |
| `season` | The months the huts are open or the route is in condition, as an array of 1–12 in order. Wrap-around such as `[11, 12, 1]` is fine. |
| `difficulty` | One of `moderate`, `challenging`, `demanding`. Explain why in `difficultyNote` (exposure, via ferrata, navigation, snow). |
| `done` | `true` for routes the user has completed. Only change it when the user says so. |
| `lastChecked`, `sources` | When the record was verified (`YYYY-MM-DD`), and 1–3 URLs, official first. |

## Workflows

- **Add a route:**
  1. Research the official or tourism-board site first, then reputable guide sites.
  2. Fill every field. Use `null` instead of guessing.
  3. Keep the file sorted by `name` and set the top-level `updatedAt` to today.
- **Mark as done:** set `"done": true` on the route. If the route isn't on the list yet, add it first.
- **Re-check:** verify the booking notes and hut seasons, which change most often, then update `lastChecked`.
- **Remove:** delete the record and say why in the commit message.

## Validate and preview

```sh
node .claude/skills/manage-hut-routes/scripts/validate.mjs
python3 -m http.server 8000   # then open http://localhost:8000/huts.html
```
- **Errors** (exit 1): a bad id, an unknown country, wrong `days` or `season` shapes, an invalid difficulty or terrain value, a non-boolean `done`, a missing `lastChecked`, or a duplicate id.
- **Warnings**: missing figures, links or sources, and `lastChecked` older than a year.

Commit with a message like `Hut routes: add X` or `Hut routes: mark X done`. Push only if the user asks.
