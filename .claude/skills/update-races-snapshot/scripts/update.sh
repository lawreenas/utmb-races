#!/usr/bin/env bash
# Fetch all races from the UTMB API and rewrite data/races.json in the app's slim format.
# Usage: update.sh [repo-root]   (defaults to the current git repo root)
set -euo pipefail

ROOT="${1:-$(git rev-parse --show-toplevel)}"
OUT="$ROOT/data/races.json"
PAGE_SIZE=300
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

offset=0
page=0
while :; do
  curl -fsS "https://api.utmb.world/search/races?lang=en&limit=$PAGE_SIZE&offset=$offset" -o "$TMP/page-$page.json"
  n=$(jq '.races | length' "$TMP/page-$page.json")
  [ "$n" -lt "$PAGE_SIZE" ] && break
  offset=$((offset + PAGE_SIZE)); page=$((page + 1))
done

# Same shape as slim_() in apps-script/Code.gs and slim() in app.js.
jq -s '{
  updatedAt: (now | todateiso8601),
  source: "snapshot",
  races: [ .[].races[] | {
    id, startDate, name, startLocation,
    status: (.raceStatus.status // null),
    distance:      ([.details.statsUp[]? | select(.name == "distance")            | .value][0] // null),
    elevationGain: ([.details.statsUp[]? | select(.name == "elevationGain")       | .value][0] // null),
    runningStones: ([.details.statsUp[]? | select(.name == "runningStones")       | .value][0] // null),
    category:      ([.details.statsUp[]? | select(.name == "categoryWorldSeries") | .value][0] // null),
    link: (.slug // .raceLink),
    playgrounds: (.playgrounds // [])
  } ] | unique_by(.id)
}' "$TMP"/page-*.json > "$TMP/races.json"

count=$(jq '.races | length' "$TMP/races.json")
if [ "$count" -eq 0 ]; then
  echo "UTMB returned 0 races — keeping the existing snapshot." >&2
  exit 1
fi

mv "$TMP/races.json" "$OUT"
echo "Wrote $count races to $OUT"
