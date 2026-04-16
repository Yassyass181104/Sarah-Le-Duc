/* ── main.js — tab switching + shared data store ────────── */

// ── Tab switching ────────────────────────────────────────
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
    // Lazy-render visualizations on first visit
    if (target === 'dumbbell'  && !window._dbRendered)  { initDumbbell();  window._dbRendered  = true; }
    if (target === 'barchart'  && !window._bcRendered)  { initBarChart();  window._bcRendered  = true; }
    if (target === 'hexbin'    && !window._hxRendered)  { initHexbin();    window._hxRendered  = true; }
  });
});

// ── Shared tooltip ───────────────────────────────────────
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
document.body.appendChild(tooltip);

window.showTooltip = (html, event) => {
  tooltip.innerHTML = html;
  tooltip.classList.add('visible');
  moveTooltip(event);
};
window.moveTooltip = (event) => {
  const x = event.clientX + 14;
  const y = event.clientY - 10;
  const w = tooltip.offsetWidth;
  const h = tooltip.offsetHeight;
  tooltip.style.left = (x + w > window.innerWidth  ? x - w - 28 : x) + 'px';
  tooltip.style.top  = (y + h > window.innerHeight ? y - h      : y) + 'px';
};
window.hideTooltip = () => tooltip.classList.remove('visible');

// ── Data paths (relative to website/ folder) ─────────────
const DATA = {
  imdb:    './resources/imdb_top_1000_cleaned.csv',
  netflix: './resources/netflix_cleaned.csv',
};

// ── Shared data cache ────────────────────────────────────
window._data = {};

window.loadData = async (key) => {
  if (window._data[key]) return window._data[key];

  const raw = await d3.csv(DATA[key]);

  if (key === 'imdb') {
    window._data[key] = raw
      .filter(d => d.IMDB_Rating && d.Meta_score && d.Released_Year && d.Main_Genre)
      .map(d => ({
        title:      d.Series_Title.trim(),
        year:       +d.Released_Year,
        decade:     Math.floor(+d.Released_Year / 10) * 10,
        genre:      d.Main_Genre.trim(),
        imdb:       +d.IMDB_Rating,
        meta:       +d.Meta_score / 10,   // normalize to 0–10
        meta_raw:   +d.Meta_score,
        votes:      +d.No_of_Votes,
        director:   d.Director,
      }));
  } else {
    // Netflix — filter to MOVIE type only
    window._data[key] = raw
      .filter(d => d.type === 'MOVIE' && d.imdb_score && d.imdb_votes && d.release_year)
      .map(d => ({
        title:  d.title.trim(),
        year:   +d.release_year,
        decade: Math.floor(+d.release_year / 10) * 10,
        genre:  (d.genre || 'Unknown').split(',')[0].trim(),
        imdb:   +d.imdb_score,
        votes:  +d.imdb_votes,
      }));
  }
  return window._data[key];
};

// ── Populate a <select> with unique sorted values ─────────
window.populateSelect = (selectId, values, includeAll = 'all') => {
  const sel = document.getElementById(selectId);
  const current = sel.value;
  // keep first "all" option if present
  while (sel.options.length > 1) sel.remove(1);
  values.sort().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
};
