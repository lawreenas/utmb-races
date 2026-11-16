(() => {
  const DATA_URL = 'data/huts.json';
  const LIKES_KEY = 'utmb-races:likes:v1'; // shared with the race pages; route ids are prefixed "hut-"

  const DIFFICULTY = { moderate: 'Moderate', challenging: 'Challenging', demanding: 'Demanding' };
  const PROGRESS = { todo: 'To do', done: 'Done' };
  const LENGTH = { short: 'Short (≤4 days)', week: 'Week (5–9)', long: 'Long (10+)' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const $ = (id) => document.getElementById(id);

  let routes = [];
  let checked = null;
  const likes = loadLikes();
  const filters = defaultFilters();
  let sort = { key: 'name', dir: 1 };

  function defaultFilters() {
    return {
      q: '', country: '', progress: [], length: [], difficulty: [], month: [], terrain: [],
      daysMin: '', daysMax: '', distMin: '', distMax: '', elevMin: '', elevMax: '', liked: false,
    };
  }

  // ---------- data ----------

  function loadLikes() {
    try { return new Set(JSON.parse(localStorage.getItem(LIKES_KEY)) || []); } catch { return new Set(); }
  }

  function toggleLike(id) {
    if (likes.has(id)) likes.delete(id); else likes.add(id);
    try { localStorage.setItem(LIKES_KEY, JSON.stringify([...likes])); } catch { /* storage unavailable */ }
  }

  // Length category from the shortest typical itinerary.
  function lengthOf(days) {
    if (!days) return null;
    if (days[0] <= 4) return 'short';
    if (days[0] <= 9) return 'week';
    return 'long';
  }

  function normalize(list) {
    return list.map((r) => ({
      ...r,
      likeId: `hut-${r.id}`,
      progress: r.done ? 'done' : 'todo',
      length: lengthOf(r.days),
      season: r.season || [],
      seasonStart: (r.season || [])[0] ?? null,
      daysRange: r.days || null,
      days: r.days ? r.days[0] : null, // sort key: shortest typical itinerary
      terrain: r.terrain || [],
      search: [r.name, r.region, ...(r.countries || []), r.start, r.end].join(' ').toLowerCase(),
    }));
  }

  async function init() {
    readURL();
    bindUI();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      const data = await res.json();
      checked = data.updatedAt;
      routes = normalize(data.routes);
      buildFilterOptions();
      render();
    } catch {
      $('meta').textContent = 'Could not load the route list.';
    }
  }

  // ---------- filters ----------

  const counts = (key) => routes.reduce((m, r) => {
    [].concat(r[key]).forEach((v) => { if (v != null && v !== '') m[v] = (m[v] || 0) + 1; });
    return m;
  }, {});

  function buildChips(el, key, values, label = (v) => v, countKey = key) {
    const c = counts(countKey);
    el.innerHTML = values.filter((v) => c[v]).map((v) => `
      <button type="button" class="chip" data-key="${key}" data-value="${esc(v)}"
        aria-pressed="${filters[key].includes(String(v))}">${esc(label(v))}<span class="n">${c[v]}</span></button>`).join('');
  }

  function buildFilterOptions() {
    buildChips($('f-progress'), 'progress', Object.keys(PROGRESS), (v) => PROGRESS[v]);
    buildChips($('f-length'), 'length', Object.keys(LENGTH), (v) => LENGTH[v]);
    buildChips($('f-difficulty'), 'difficulty', Object.keys(DIFFICULTY), (v) => DIFFICULTY[v]);
    buildChips($('f-month'), 'month', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], (m) => MONTHS[m - 1], 'season');
    buildChips($('f-terrain'), 'terrain', [...new Set(routes.flatMap((r) => r.terrain))].sort(), humanize);
    const countries = [...new Set(routes.flatMap((r) => r.countries || []))].sort();
    if (filters.country && !countries.includes(filters.country)) filters.country = '';
    $('country').innerHTML = '<option value="">All countries</option>' +
      countries.map((c) => `<option ${c === filters.country ? 'selected' : ''}>${esc(c)}</option>`).join('');
  }

  function matches(r) {
    const f = filters;
    const num = (v) => (v === '' ? null : Number(v));
    const inRange = (v, min, max) => (min == null || (v != null && v >= min)) && (max == null || (v != null && v <= max));
    const [dMin, dMax] = r.daysRange || [null, null];

    if (f.liked && !likes.has(r.likeId)) return false;
    if (f.q && !f.q.toLowerCase().split(/\s+/).every((w) => r.search.includes(w))) return false;
    if (f.country && !(r.countries || []).includes(f.country)) return false;
    if (f.progress.length && !f.progress.includes(r.progress)) return false;
    if (f.length.length && !f.length.includes(r.length)) return false;
    if (f.difficulty.length && !f.difficulty.includes(r.difficulty)) return false;
    if (f.month.length && !f.month.some((m) => r.season.includes(Number(m)))) return false;
    if (f.terrain.length && !f.terrain.some((t) => r.terrain.includes(t))) return false;
    // A route fits the days filter if its typical range overlaps it.
    if (num(f.daysMin) != null && (dMax == null || dMax < num(f.daysMin))) return false;
    if (num(f.daysMax) != null && (dMin == null || dMin > num(f.daysMax))) return false;
    if (!inRange(r.distance, num(f.distMin), num(f.distMax))) return false;
    if (!inRange(r.elevationGain, num(f.elevMin), num(f.elevMax))) return false;
    return true;
  }

  function compare(a, b) {
    const k = sort.key;
    let x = a[k], y = b[k];
    if (k === 'liked') { x = likes.has(a.likeId) ? 0 : 1; y = likes.has(b.likeId) ? 0 : 1; }
    if (k === 'countries') { x = (x || []).join(', '); y = (y || []).join(', '); }
    if (k === 'difficulty') { x = Object.keys(DIFFICULTY).indexOf(x); y = Object.keys(DIFFICULTY).indexOf(y); }
    if (x == null || x === '' || x === -1) return 1; // empty values last
    if (y == null || y === '' || y === -1) return -1;
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return (c || a.name.localeCompare(b.name)) * sort.dir;
  }

  // ---------- rendering ----------

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const humanize = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  const fmtNum = (v, unit) => (v == null ? '' : `${Number(v).toLocaleString('en')} ${unit}`);
  const fmtDays = (d) => (!d ? '' : d[0] === d[1] ? `${d[0]}` : `${d[0]}–${d[1]}`);

  // Season months → "Jun–Sep"; handles wrap-around such as [11, 12, 1].
  function fmtSeason(months) {
    if (!months.length) return '';
    const set = new Set(months);
    let start = months.find((m) => !set.has(m === 1 ? 12 : m - 1)) ?? months[0];
    let end = start;
    while (set.has(end === 12 ? 1 : end + 1) && (end === 12 ? 1 : end + 1) !== start) end = end === 12 ? 1 : end + 1;
    return start === end ? MONTHS[start - 1] : `${MONTHS[start - 1]}–${MONTHS[end - 1]}`;
  }

  function mapLink(place, country) {
    const label = [place, country].filter(Boolean).join(', ');
    if (!label) return '';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
    return `<a class="map" href="${url}" target="_blank" rel="noopener" title="Open in Google Maps">${esc(place || country)}</a>`;
  }

  function render() {
    const list = routes.filter(matches).sort(compare);

    $('rows').innerHTML = list.map((r) => {
      const liked = likes.has(r.likeId);
      const country = (r.countries || [])[0];
      const loop = r.start && r.start === r.end;
      return `
      <tr class="route">
        <td class="like"><button type="button" class="heart" data-id="${esc(r.likeId)}" aria-pressed="${liked}"
          aria-label="${liked ? 'Unlike' : 'Like'} ${esc(r.name)}">${liked ? '♥' : '♡'}</button></td>
        <td class="race">
          ${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}
          ${r.length === 'short' ? '<span class="badge b-short">Short</span>' : ''}
          ${r.done ? '<span class="badge b-done">Done</span>' : ''}
          <div class="sub">${esc(r.region)}</div>
        </td>
        <td class="loc">${esc((r.countries || []).join(', '))}
          <div class="sub">${mapLink(r.start, country)}${loop ? ' (loop)' : r.end ? ` → ${mapLink(r.end, (r.countries || []).at(-1))}` : ''}</div></td>
        <td class="num days">${fmtDays(r.daysRange)}</td>
        <td class="num">${fmtNum(r.distance, 'km')}</td>
        <td class="num">${fmtNum(r.elevationGain, 'm D+')}</td>
        <td class="num high" title="${esc(r.highestPointName || '')}">${fmtNum(r.highestPoint, 'm')}</td>
        <td class="cat season" title="${esc(r.seasonNote || '')}">${fmtSeason(r.season)}</td>
        <td class="status">
          ${r.difficulty ? `<span class="badge d-${esc(r.difficulty)}">${esc(DIFFICULTY[r.difficulty])}</span>` : ''}
        </td>
      </tr>
      <tr class="detail">
        <td></td>
        <td colspan="8">
          ${[
            r.accommodation && `<span><b>Sleep</b> ${esc(r.accommodation)}</span>`,
            r.seasonNote && `<span><b>Season</b> ${esc(r.seasonNote)}</span>`,
            r.booking && `<span><b>Booking</b> ${esc(r.booking)}</span>`,
            r.difficultyNote && `<span><b>Notes</b> ${esc(r.difficultyNote)}</span>`,
          ].filter(Boolean).join('')}
        </td>
      </tr>`;
    }).join('');

    const likedCount = routes.filter((r) => likes.has(r.likeId)).length;
    $('liked-n').textContent = likedCount || '';
    $('liked').setAttribute('aria-pressed', filters.liked);
    $('empty').textContent = filters.liked && !likedCount
      ? 'No liked routes yet — tap ♡ on a route to save it.'
      : 'No routes match these filters.';
    $('empty').hidden = list.length > 0 || !routes.length;
    const done = routes.filter((r) => r.done).length;
    $('count').textContent = routes.length ? `${list.length} of ${routes.length} routes · ${done} done` : '';
    const [y, m, d] = String(checked || '').split('-').map(Number);
    $('meta').textContent = checked ? `Last checked ${new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';

    document.querySelectorAll('th[data-sort]').forEach((th) => {
      if (th.dataset.sort === sort.key) th.setAttribute('aria-sort', sort.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    writeURL();
  }

  // ---------- URL state ----------

  const LIST_KEYS = ['progress', 'length', 'difficulty', 'month', 'terrain'];
  const TEXT_KEYS = ['q', 'country', 'daysMin', 'daysMax', 'distMin', 'distMax', 'elevMin', 'elevMax'];

  function readURL() {
    const p = new URLSearchParams(location.search);
    TEXT_KEYS.forEach((k) => { if (p.has(k)) filters[k] = p.get(k); });
    LIST_KEYS.forEach((k) => { if (p.get(k)) filters[k] = p.get(k).split(','); });
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
    if (filters.liked) p.set('liked', '1');
    if (sort.key !== 'name' || sort.dir !== 1) p.set('sort', `${sort.key}:${sort.dir > 0 ? 'asc' : 'desc'}`);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function syncInputs() {
    TEXT_KEYS.forEach((k) => { $(k).value = filters[k]; });
  }

  function bindUI() {
    syncInputs();
    TEXT_KEYS.forEach((k) => $(k).addEventListener('input', (e) => { filters[k] = e.target.value.trim(); render(); }));
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
