/**
 * UTMB Races – shared cache backend.
 *
 * Bind this script to a Google Sheet (Extensions → Apps Script) and deploy it
 * as a Web app (Execute as: Me, Who has access: Anyone). See README.md.
 *
 *   GET <exec-url>                 → cached race data from the sheet
 *   GET <exec-url>?action=refresh  → fetch fresh data from UTMB, store it, return it
 */

const SHEET_NAME = 'races';
const PAGE_SIZE = 300;
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // throttle refreshes shared by everyone

const COLUMNS = [
  'id', 'startDate', 'name', 'startLocation', 'status', 'distance',
  'elevationGain', 'runningStones', 'category', 'link', 'playgrounds',
];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'get';
  try {
    const data = action === 'refresh' ? refresh_() : readCache_();
    return json_(data);
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

/** Can also be run manually from the editor or on a time-driven trigger. */
function refreshRaces() {
  return refresh_(true);
}

function refresh_(force) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    const props = PropertiesService.getScriptProperties();
    const last = Number(props.getProperty('updatedAt') || 0);
    if (!force && Date.now() - last < MIN_REFRESH_INTERVAL_MS) {
      const cached = readCache_();
      cached.throttled = true;
      return cached;
    }

    const races = fetchUTMBRaces_();
    writeCache_(races);
    props.setProperty('updatedAt', String(Date.now()));
    return { updatedAt: new Date().toISOString(), source: 'utmb', races: races };
  } finally {
    lock.releaseLock();
  }
}

function fetchUTMBRaces_() {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = 'https://api.utmb.world/search/races?lang=en&limit=' + PAGE_SIZE + '&offset=' + offset;
    const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      throw new Error('UTMB API responded with ' + res.getResponseCode());
    }
    const page = JSON.parse(res.getContentText()).races || [];
    page.forEach(function (race) { all.push(slim_(race)); });
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

function slim_(race) {
  const stats = {};
  ((race.details && race.details.statsUp) || []).forEach(function (s) { stats[s.name] = s.value; });
  return {
    id: race.id,
    startDate: race.startDate,
    name: race.name,
    startLocation: race.startLocation,
    status: race.raceStatus ? race.raceStatus.status : null,
    distance: stats.distance != null ? stats.distance : null,
    elevationGain: stats.elevationGain != null ? stats.elevationGain : null,
    runningStones: stats.runningStones != null ? stats.runningStones : null,
    category: stats.categoryWorldSeries || null,
    link: race.slug || race.raceLink || null,
    playgrounds: race.playgrounds || [],
  };
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function writeCache_(races) {
  const sheet = sheet_();
  const rows = races.map(function (r) {
    return COLUMNS.map(function (c) {
      const v = r[c];
      if (c === 'playgrounds') return (v || []).join(',');
      return v == null ? '' : v;
    });
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
  if (rows.length) {
    // Plain-text format keeps values like "13th November 2026" from being turned into dates.
    sheet.getRange(2, 1, rows.length, COLUMNS.length).setNumberFormat('@').setValues(rows);
  }
  sheet.setFrozenRows(1);
}

function readCache_() {
  const sheet = sheet_();
  const values = sheet.getDataRange().getValues();
  const header = values.shift() || [];
  const numeric = { id: 1, distance: 1, elevationGain: 1, runningStones: 1 };
  const races = values
    .filter(function (row) { return row[0] !== ''; })
    .map(function (row) {
      const r = {};
      header.forEach(function (c, i) {
        let v = row[i];
        if (c === 'playgrounds') v = v ? String(v).split(',') : [];
        else if (v === '') v = null;
        else if (numeric[c]) v = Number(v);
        else v = String(v);
        r[c] = v;
      });
      return r;
    });
  const updatedAt = Number(PropertiesService.getScriptProperties().getProperty('updatedAt') || 0);
  return {
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
    source: 'sheet',
    races: races,
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
