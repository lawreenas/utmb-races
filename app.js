(() => {
  // <body data-page="utmb"> (default) or "europe": curated non-UTMB races, no UTMB refresh/cache.
  const PAGE = document.body.dataset.page || 'utmb';
  const IS_UTMB = PAGE === 'utmb';
  const API_URL = (IS_UTMB && window.UTMB_CONFIG && window.UTMB_CONFIG.API_URL) || '';
  const SNAPSHOT_URL = IS_UTMB ? 'data/races.json' : 'data/europe-races.json';
  const UTMB_URL = 'https://api.utmb.world/search/races?lang=en&limit=300';
  const LS_KEY = 'utmb-races:cache:v1';
  const LIKES_KEY = 'utmb-races:likes:v1';

  const STATUS = {
    registration_open: 'Open',
    available_soon: 'Opens soon',
    lottery: 'Lottery',
    registration_sold_out: 'Sold out',
    registration_closed: 'Closed',
    unknown: 'Unknown',
  };
  const CATEGORY_ORDER = ['20k', '50k', '100k', '100m'];
  const ENTRY = { 'first-come': 'First come', lottery: 'Lottery', qualification: 'Qualification', invitation: 'Invitation', mixed: 'Mixed' };
  const CONTINENT_ORDER = ['Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania', 'Other'];
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december'];

  const $ = (id) => document.getElementById(id);

  let races = [];
  let dataInfo = null;
  const likes = loadLikes();
  const filters = defaultFilters();
  let sort = { key: 'date', dir: 1 };

  function defaultFilters() {
    return {
      q: '', country: '', status: [], continent: [], category: [], terrain: [], entry: [], series: [],
      dateFrom: '', dateTo: '', distMin: '', distMax: '', elevMin: '', elevMax: '', stonesMin: '',
      past: false, liked: false,
    };
  }

  // ---------- data ----------

  // Accepts either our slim record or a raw UTMB API race.
  function slim(r) {
    if (!r.details) return r;
    const stats = Object.fromEntries((r.details.statsUp || []).map((s) => [s.name, s.value]));
    return {
      id: r.id,
      startDate: r.startDate,
      name: r.name,
      startLocation: r.startLocation,
      status: r.raceStatus ? r.raceStatus.status : null,
      distance: stats.distance ?? null,
      elevationGain: stats.elevationGain ?? null,
      runningStones: stats.runningStones ?? null,
      category: stats.categoryWorldSeries || null,
      link: r.slug || r.raceLink || null,
      playgrounds: r.playgrounds || [],
    };
  }

  // "13th November 2026" or "2026-11-13" → Date (local midnight)
  function parseDate(s) {
    if (!s) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const m = /^(\d{1,2})\w*\s+([a-z]+)\s+(\d{4})$/i.exec(String(s || '').trim());
    if (m) {
      const month = MONTHS.indexOf(m[2].toLowerCase());
      if (month >= 0) return new Date(Number(m[3]), month, Number(m[1]));
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // UTMB-style World Series category from distance, for races that don't have one.
  function categoryFromDistance(km) {
    if (km == null) return '';
    if (km < 35) return '20k';
    if (km < 75) return '50k';
    if (km < 140) return '100k';
    return '100m';
  }

  function cleanLocation(loc) {
    return loc && loc !== 'undefined' && !String(loc).startsWith('undefined') ? String(loc) : '';
  }

  function normalize(list) {
    const out = list.map(slim).map((r) => {
      // Curated races carry event/race separately; UTMB races encode them as "Event - Race".
      const [event, ...rest] = r.event ? [r.event, r.race || ''] : String(r.name || '').split(' - ');
      r = { ...r, name: r.name || [event, ...rest].filter(Boolean).join(' - ') };
      const location = cleanLocation(r.startLocation) || EVENT_LOCATION_FALLBACK[event] || '';
      const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
      return {
        ...r,
        event,
        race: rest.join(' - '),
        date: parseDate(r.startDate),
        country: parts.length ? parts[parts.length - 1] : '',
        place: parts.slice(0, -1).join(', '),
        status: r.status || 'unknown',
        category: r.category ? String(r.category).toLowerCase() : categoryFromDistance(r.distance),
        playgrounds: Array.isArray(r.playgrounds) ? r.playgrounds : (r.terrain || []),
        series: r.series || '',
        entry: r.entry || '',
      };
    });

    // Races missing a location inherit it from another race of the same event.
    const byEvent = {};
    out.forEach((r) => { if (r.country && !byEvent[r.event]) byEvent[r.event] = r; });
    out.forEach((r) => {
      if (!r.country && byEvent[r.event]) {
        r.country = byEvent[r.event].country;
        r.place = byEvent[r.event].place;
      }
      r.country = r.country || 'Unknown';
      r.continent = continentOf(r.country);
      r.search = [r.event, r.race, r.place, r.country, r.continent, r.series].join(' ').toLowerCase();
    });
    return out;
  }

  function loadLocal() {
    if (!IS_UTMB) return null;
    try {
      const v = JSON.parse(localStorage.getItem(LS_KEY));
      return v && Array.isArray(v.races) ? v : null;
    } catch { return null; }
  }

  function saveLocal(data) {
    if (!IS_UTMB) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
  }

  function loadLikes() {
    try { return new Set(JSON.parse(localStorage.getItem(LIKES_KEY)) || []); } catch { return new Set(); }
  }

  function toggleLike(id) {
    if (likes.has(id)) likes.delete(id); else likes.add(id);
    try { localStorage.setItem(LIKES_KEY, JSON.stringify([...likes])); } catch { /* storage unavailable */ }
  }

  async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  function setData(data, origin) {
    dataInfo = { updatedAt: data.updatedAt, origin };
    races = normalize(data.races);
    buildFilterOptions();
    render();
  }

  const newer = (a, b) => (!b || (a && Date.parse(a.updatedAt || 0) >= Date.parse(b.updatedAt || 0)) ? a : b);

  async function init() {
    readURL();
    bindUI();

    const local = loadLocal();
    if (local) setData(local, 'local');

    let remote = null;
    let origin = 'snapshot';
    if (API_URL) {
      try {
        remote = await getJSON(API_URL);
        origin = 'shared';
        if (!remote.races.length) remote = null; // sheet not populated yet
      } catch (e) {
        toast(`Shared cache unavailable (${e.message}). Using fallback data.`);
      }
    }
    if (!remote) {
      try { remote = await getJSON(SNAPSHOT_URL); origin = 'snapshot'; } catch { /* offline */ }
    }

    const best = newer(remote, local);
    if (best && best !== local) {
      saveLocal(best);
      setData(best, origin);
    } else if (!best) {
      $('meta').textContent = IS_UTMB ? 'No data yet — press Refresh.' : 'Could not load the race list.';
    }
  }

  async function refresh() {
    const btn = $('refresh');
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    try {
      let data;
      if (API_URL) {
        data = await getJSON(`${API_URL}?action=refresh`);
        if (data.throttled) toast('Data was refreshed less than 5 minutes ago — showing the shared cache.');
        else toast(`Updated ${data.races.length} races from UTMB.`);
        setData(data, 'shared');
      } else {
        // Only works if UTMB allows cross-origin requests from this site.
        const raw = await getJSON(UTMB_URL);
        data = { updatedAt: new Date().toISOString(), source: 'utmb', races: raw.races.map(slim) };
        toast(`Updated ${data.races.length} races from UTMB (stored in this browser only).`);
        setData(data, 'local');
      }
      saveLocal(data);
    } catch (e) {
      toast(API_URL
        ? `Refresh failed: ${e.message}`
        : 'Refresh failed: the browser cannot call UTMB directly. Set up the shared cache (see README).');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Refresh from UTMB';
    }
  }

  // ---------- filters ----------

  const counts = (key) => races.reduce((m, r) => {
    [].concat(r[key]).forEach((v) => { if (v) m[v] = (m[v] || 0) + 1; });
    return m;
  }, {});

  function buildChips(el, key, values, label = (v) => v) {
    if (!el) return; // filter group not on this page
    const c = counts(key === 'terrain' ? 'playgrounds' : key);
    el.innerHTML = values.filter((v) => c[v]).map((v) => `
      <button type="button" class="chip" data-key="${key}" data-value="${esc(v)}"
        aria-pressed="${filters[key].includes(v)}">${esc(label(v))}<span class="n">${c[v]}</span></button>`).join('');
  }

  function buildFilterOptions() {
    const by = (order) => (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b);
    const uniq = (key) => [...new Set(races.flatMap((r) => [].concat(r[key])).filter(Boolean))];

    buildChips($('f-status'), 'status', uniq('status').sort(by(Object.keys(STATUS))), (v) => STATUS[v] || v);
    buildChips($('f-continent'), 'continent', uniq('continent').sort(by(CONTINENT_ORDER)));
    buildChips($('f-category'), 'category', uniq('category').sort(by(CATEGORY_ORDER)), (v) => v.toUpperCase());
    buildChips($('f-terrain'), 'terrain', uniq('playgrounds').sort(), humanize);
    buildChips($('f-entry'), 'entry', uniq('entry').sort(by(Object.keys(ENTRY))), (v) => ENTRY[v] || v);
    buildChips($('f-series'), 'series', uniq('series').sort());
    buildCountries();
  }

  function buildCountries() {
    const pool = filters.continent.length ? races.filter((r) => filters.continent.includes(r.continent)) : races;
    const countries = [...new Set(pool.map((r) => r.country))].sort();
    if (filters.country && !countries.includes(filters.country)) filters.country = '';
    $('country').innerHTML = '<option value="">All countries</option>' +
      countries.map((c) => `<option ${c === filters.country ? 'selected' : ''}>${esc(c)}</option>`).join('');
  }

  function matches(r) {
    const f = filters;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const num = (v) => (v === '' ? null : Number(v));
    const inRange = (v, min, max) => (min == null || (v != null && v >= min)) && (max == null || (v != null && v <= max));

    if (f.liked && !likes.has(String(r.id))) return false;
    if (!f.past && r.date && r.date < today) return false;
    if (f.q && !f.q.toLowerCase().split(/\s+/).every((w) => r.search.includes(w))) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.status.length && !f.status.includes(r.status)) return false;
    if (f.continent.length && !f.continent.includes(r.continent)) return false;
    if (f.category.length && !f.category.includes(r.category)) return false;
    if (f.terrain.length && !f.terrain.some((t) => r.playgrounds.includes(t))) return false;
    if (f.entry.length && !f.entry.includes(r.entry)) return false;
    if (f.series.length && !f.series.includes(r.series)) return false;
    if (f.dateFrom && (!r.date || r.date < new Date(`${f.dateFrom}T00:00`))) return false;
    if (f.dateTo && (!r.date || r.date > new Date(`${f.dateTo}T00:00`))) return false;
    if (!inRange(r.distance, num(f.distMin), num(f.distMax))) return false;
    if (!inRange(r.elevationGain, num(f.elevMin), num(f.elevMax))) return false;
    if (!inRange(r.runningStones, num(f.stonesMin), null)) return false;
    return true;
  }

  function compare(a, b) {
    const k = sort.key;
    let x = a[k], y = b[k];
    if (k === 'liked') { x = likes.has(String(a.id)) ? 0 : 1; y = likes.has(String(b.id)) ? 0 : 1; }
    if (k === 'date') { x = x ? x.getTime() : null; y = y ? y.getTime() : null; }
    if (k === 'category') { x = CATEGORY_ORDER.indexOf(x); y = CATEGORY_ORDER.indexOf(y); }
    if (k === 'status') { x = Object.keys(STATUS).indexOf(x); y = Object.keys(STATUS).indexOf(y); }
    if (x == null || x === '' || x === -1) return 1; // empty values last
    if (y == null || y === '' || y === -1) return -1;
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return (c || (a.date - b.date) || a.name.localeCompare(b.name)) * sort.dir;
  }

  // ---------- rendering ----------

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const humanize = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  const fmtNum = (v, unit) => (v == null ? '' : `${Number(v).toLocaleString('en')} ${unit}`);
  const fmtDate = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  function render() {
    const list = races.filter(matches).sort(compare);

    $('rows').innerHTML = list.map((r) => {
      const liked = likes.has(String(r.id));
      return `
      <tr>
        <td class="like"><button type="button" class="heart" data-id="${esc(r.id)}" aria-pressed="${liked}"
          aria-label="${liked ? 'Unlike' : 'Like'} ${esc(r.race || r.event)}">${liked ? '♥' : '♡'}</button></td>
        <td class="date">${r.date ? fmtDate(r.date) : 'TBA'}${r.dateNote ? `<div class="sub">${esc(r.dateNote)}</div>` : ''}</td>
        <td class="race">
          ${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.race || r.event)}</a>` : esc(r.race || r.event)}
          <div class="sub">${esc([r.race ? r.event : '', r.series].filter(Boolean).join(' · '))}</div>
        </td>
        <td class="loc">${esc(r.place || r.country)}${r.place ? `, ${esc(r.country)}` : ''}<div class="sub">${esc(r.continent)}</div></td>
        <td class="num">${fmtNum(r.distance, 'km')}</td>
        <td class="num">${fmtNum(r.elevationGain, 'm D+')}</td>
        <td class="cat">${esc(r.category.toUpperCase())}</td>
        <td class="num stones">${r.runningStones ?? ''}</td>
        <td class="status"><span class="badge s-${esc(r.status)}">${esc(STATUS[r.status] || r.status)}</span>${r.statusNote ? `<div class="sub">${esc(r.statusNote)}</div>` : ''}</td>
      </tr>`;
    }).join('');

    const likedCount = races.filter((r) => likes.has(String(r.id))).length;
    $('liked-n').textContent = likedCount || '';
    $('liked').setAttribute('aria-pressed', filters.liked);

    $('empty').textContent = filters.liked && !likedCount
      ? 'No liked races yet — tap ♡ on a race to save it.'
      : 'No races match these filters.';
    $('empty').hidden = list.length > 0 || !races.length;
    $('count').textContent = races.length ? `${list.length} of ${races.length} races` : '';

    document.querySelectorAll('th[data-sort]').forEach((th) => {
      if (th.dataset.sort === sort.key) th.setAttribute('aria-sort', sort.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });

    if (dataInfo) {
      const when = !dataInfo.updatedAt ? 'unknown time'
        : IS_UTMB ? new Date(dataInfo.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
        : fmtDate(parseDate(String(dataInfo.updatedAt).slice(0, 10)));
      const src = IS_UTMB
        ? { shared: 'shared cache', local: 'this browser', snapshot: 'bundled snapshot' }[dataInfo.origin]
        : 'curated list';
      $('meta').textContent = IS_UTMB ? `Data from ${when} · ${src}` : `Last checked ${when} · ${src}`;
    }
    writeURL();
  }

  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  // ---------- URL state (filters are shareable links) ----------

  const LIST_KEYS = ['status', 'continent', 'category', 'terrain', 'entry', 'series'];
  const TEXT_KEYS = ['q', 'country', 'dateFrom', 'dateTo', 'distMin', 'distMax', 'elevMin', 'elevMax', 'stonesMin'];

  function readURL() {
    const p = new URLSearchParams(location.search);
    TEXT_KEYS.forEach((k) => { if (p.has(k)) filters[k] = p.get(k); });
    LIST_KEYS.forEach((k) => { if (p.get(k)) filters[k] = p.get(k).split(','); });
    filters.past = p.get('past') === '1';
    filters.liked = p.get('liked') === '1';
    if (p.get('sort')) {
      const [key, dir] = p.get('sort').split(':');
      sort = { key, dir: dir === 'desc' ? -1 : 1 };
    }
  }

  function writeURL() {
    const p = new URLSearchParams();
    TEXT_KEYS.forEach((k) => { if (filters[k]) p.set(k, filters[k]); });
    LIST_KEYS.forEach((k) => { if (filters[k].length) p.set(k, filters[k].join(',')); });
    if (filters.past) p.set('past', '1');
    if (filters.liked) p.set('liked', '1');
    if (sort.key !== 'date' || sort.dir !== 1) p.set('sort', `${sort.key}:${sort.dir > 0 ? 'asc' : 'desc'}`);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function syncInputs() {
    TEXT_KEYS.forEach((k) => { if ($(k)) $(k).value = filters[k]; });
    $('past').checked = filters.past;
  }

  function bindUI() {
    syncInputs();
    if ($('refresh')) $('refresh').addEventListener('click', refresh);

    TEXT_KEYS.forEach((k) => $(k) && $(k).addEventListener('input', (e) => { filters[k] = e.target.value.trim(); render(); }));
    $('past').addEventListener('change', (e) => { filters.past = e.target.checked; render(); });
    $('liked').addEventListener('click', () => { filters.liked = !filters.liked; render(); });

    $('rows').addEventListener('click', (e) => {
      const heart = e.target.closest('.heart');
      if (!heart) return;
      toggleLike(heart.dataset.id);
      render();
    });

    document.querySelector('.filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const { key, value } = chip.dataset;
      const list = filters[key];
      const i = list.indexOf(value);
      if (i >= 0) list.splice(i, 1); else list.push(value);
      chip.setAttribute('aria-pressed', i < 0);
      if (key === 'continent') buildCountries();
      render();
    });

    $('reset').addEventListener('click', () => {
      Object.assign(filters, defaultFilters());
      syncInputs();
      buildFilterOptions();
      render();
    });

    document.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      sort = { key, dir: sort.key === key ? -sort.dir : 1 };
      render();
    });
  }

  init();
})();
