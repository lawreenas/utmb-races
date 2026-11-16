#!/usr/bin/env node
// Validate data/europe-races.json (the curated "Iconic Europe" list).
// Usage: node validate.mjs [repo-root]
// Exits 1 on errors. Warnings (stale or past data, possible UTMB overlap) don't fail the run.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const root = process.argv[2] || execSync('git rev-parse --show-toplevel').toString().trim();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const geo = {};
vm.runInNewContext(`${read('geo.js')}; out.continentOf = continentOf;`, { out: geo });

const data = JSON.parse(read('data/europe-races.json'));
const utmbEvents = JSON.parse(read('data/races.json')).races.map((r) => String(r.name).split(' - ')[0]);

const STATUSES = ['registration_open', 'available_soon', 'lottery', 'registration_sold_out', 'registration_closed', 'unknown'];
const ENTRIES = ['first-come', 'lottery', 'qualification', 'invitation', 'mixed'];
const TERRAIN = ['mountain', 'highAltitude', 'glacier', 'singleTrack', 'hikingTrail', 'woods', 'hill', 'coastalPath', 'beach', 'road', 'nightTime', 'dayTime', 'jungle'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STALE_DAYS = 60;

const errors = [];
const warnings = [];
const today = new Date(); today.setHours(0, 0, 0, 0);
const daysAgo = (iso) => Math.floor((today - new Date(`${iso}T00:00`)) / 864e5);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/by utmb.*$/, '').replace(/[^a-z0-9]+/g, ' ').trim();

if (!Array.isArray(data.races)) errors.push('top level: "races" must be an array');
if (!data.updatedAt || !ISO.test(String(data.updatedAt).slice(0, 10))) errors.push('top level: "updatedAt" must be an ISO date');

const ids = new Set();
for (const [i, r] of (data.races || []).entries()) {
  const at = `races[${i}] ${r.id || '(no id)'}`;
  const err = (m) => errors.push(`${at}: ${m}`);
  const warn = (m) => warnings.push(`${at}: ${m}`);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id || '')) err('id must be a kebab-case slug');
  if (ids.has(r.id)) err('duplicate id');
  ids.add(r.id);

  if (!r.event) err('event is required');
  if (r.startDate != null && !ISO.test(r.startDate)) err('startDate must be YYYY-MM-DD or null');
  if (r.startDate == null && !r.dateNote) err('dateNote is required when startDate is null');
  if (r.startDate && new Date(`${r.startDate}T00:00`) < today) warn(`startDate ${r.startDate} is in the past — roll over to the next edition`);

  const parts = String(r.startLocation || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) err('startLocation must be "Place, Country"');
  else if (geo.continentOf(parts.at(-1)) !== 'Europe') err(`country "${parts.at(-1)}" isn't mapped to Europe in geo.js`);

  for (const k of ['distance', 'elevationGain']) {
    if (r[k] != null && (typeof r[k] !== 'number' || r[k] < 0)) err(`${k} must be a non-negative number or null`);
  }
  if (r.distance == null) warn('distance is missing');

  if (!STATUSES.includes(r.status)) err(`status must be one of ${STATUSES.join(', ')}`);
  if (r.entry != null && !ENTRIES.includes(r.entry)) err(`entry must be one of ${ENTRIES.join(', ')}`);
  if (!/^https:\/\//.test(r.link || '')) err('link must be an https URL');
  (r.terrain || []).forEach((t) => { if (!TERRAIN.includes(t)) err(`unknown terrain "${t}"`); });

  if (!ISO.test(r.lastChecked || '')) err('lastChecked must be YYYY-MM-DD');
  else if (daysAgo(r.lastChecked) > STALE_DAYS) warn(`lastChecked ${r.lastChecked} is older than ${STALE_DAYS} days`);
  if (!Array.isArray(r.sources) || !r.sources.length) warn('no sources listed');

  const ev = norm(r.event || '');
  const hit = utmbEvents.find((u) => { const n = norm(u); return n && ev && (n.includes(ev) || ev.includes(n)); });
  if (hit) warn(`looks like UTMB World Series event "${hit}" — it doesn't belong on this list`);
}

warnings.forEach((w) => console.log(`warn   ${w}`));
errors.forEach((e) => console.log(`error  ${e}`));
console.log(`\n${(data.races || []).length} races · ${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
