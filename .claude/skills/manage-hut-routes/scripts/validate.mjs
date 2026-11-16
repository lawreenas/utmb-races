#!/usr/bin/env node
// Validate data/huts.json (the "Hut to Hut" route list).
// Usage: node validate.mjs [repo-root]
// Exits 1 on errors. Warnings (stale data, missing figures) don't fail the run.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const root = process.argv[2] || execSync('git rev-parse --show-toplevel').toString().trim();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const geo = {};
vm.runInNewContext(`${read('geo.js')}; out.continentOf = continentOf;`, { out: geo });
const data = JSON.parse(read('data/huts.json'));

const DIFFICULTIES = ['moderate', 'challenging', 'demanding'];
const TERRAIN = ['mountain', 'highAltitude', 'glacier', 'singleTrack', 'hikingTrail', 'woods', 'hill', 'coastalPath', 'beach', 'road'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STALE_DAYS = 365;

const errors = [];
const warnings = [];
const today = new Date(); today.setHours(0, 0, 0, 0);
const isNum = (v) => typeof v === 'number' && v >= 0;

if (!Array.isArray(data.routes)) errors.push('top level: "routes" must be an array');
if (!ISO.test(String(data.updatedAt || ''))) errors.push('top level: "updatedAt" must be YYYY-MM-DD');

const ids = new Set();
for (const [i, r] of (data.routes || []).entries()) {
  const at = `routes[${i}] ${r.id || '(no id)'}`;
  const err = (m) => errors.push(`${at}: ${m}`);
  const warn = (m) => warnings.push(`${at}: ${m}`);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id || '')) err('id must be a kebab-case slug');
  if (ids.has(r.id)) err('duplicate id');
  ids.add(r.id);
  if (!r.name) err('name is required');
  if (!r.region) warn('region is missing');

  if (!Array.isArray(r.countries) || !r.countries.length) err('countries must be a non-empty array');
  else r.countries.forEach((c) => { if (geo.continentOf(c) === 'Other') err(`country "${c}" isn't in geo.js`); });
  if (!r.start) warn('start is missing');

  for (const k of ['distance', 'elevationGain', 'highestPoint']) {
    if (r[k] != null && !isNum(r[k])) err(`${k} must be a non-negative number or null`);
    if (r[k] == null) warn(`${k} is missing`);
  }
  if (r.days != null && !(Array.isArray(r.days) && r.days.length === 2 && r.days.every(isNum) && r.days[0] <= r.days[1])) {
    err('days must be [min, max]');
  }
  if (!Array.isArray(r.season) || r.season.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) err('season must be an array of month numbers 1–12');
  else if (!r.season.length) warn('season is empty');

  if (r.difficulty != null && !DIFFICULTIES.includes(r.difficulty)) err(`difficulty must be one of ${DIFFICULTIES.join(', ')}`);
  if (typeof r.done !== 'boolean') err('done must be true or false');
  if (r.link != null && !/^https:\/\//.test(r.link)) err('link must be an https URL');
  if (!r.link) warn('link is missing');
  (r.terrain || []).forEach((t) => { if (!TERRAIN.includes(t)) err(`unknown terrain "${t}"`); });

  if (!ISO.test(r.lastChecked || '')) err('lastChecked must be YYYY-MM-DD');
  else if ((today - new Date(`${r.lastChecked}T00:00`)) / 864e5 > STALE_DAYS) warn(`lastChecked ${r.lastChecked} is over a year old`);
  if (!Array.isArray(r.sources) || !r.sources.length) warn('no sources listed');
}

warnings.forEach((w) => console.log(`warn   ${w}`));
errors.forEach((e) => console.log(`error  ${e}`));
const done = (data.routes || []).filter((r) => r.done).length;
console.log(`\n${(data.routes || []).length} routes (${done} done) · ${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
