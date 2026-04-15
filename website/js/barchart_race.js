/* ── barchart_race.js — V2: Genre Evolution Over Decades ────── */

async function initBarChart() {
  const [imdbData, netflixData] = await Promise.all([
    window.loadData('imdb'),
    window.loadData('netflix'),
  ]);

  const metricSel  = document.getElementById('bc-metric-select');
  const datasetSel = document.getElementById('bc-dataset-select');
  const playBtn    = document.getElementById('bc-play-btn');
  const slider     = document.getElementById('bc-decade-slider');
  const label      = document.getElementById('bc-decade-label');

  const DECADES = Array.from({ length: 11 }, (_, i) => 1920 + i * 10); // 1920…2020

  let timer           = null;
  let isPlaying       = false;
  let currentDecadeIdx = 0;
  let frames          = {};

  // ── layout ───────────────────────────────────────────────────
  const container = document.getElementById('barchart-container');
  const W  = Math.max(container.clientWidth || 800, 500);
  const H  = 500;
  const ML = 130, MR = 90, MT = 20, MB = 50;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const svg = d3.select('#barchart-container')
    .append('svg').attr('width', W).attr('height', H);

  const barsG  = svg.append('g').attr('transform', `translate(${ML},${MT})`);
  const xAxisG = svg.append('g').attr('class', 'axis')
    .attr('transform', `translate(${ML},${H - MB})`);

  svg.append('text').attr('class', 'axis-label')
    .attr('x', ML + plotW / 2).attr('y', H - 8)
    .attr('text-anchor', 'middle')
    .text('');

  const noDataMsg = svg.append('text')
    .attr('x', ML + plotW / 2).attr('y', MT + plotH / 2)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-muted)')
    .attr('font-size', 14)
    .text('');

  const colorScale = d3.scaleOrdinal()
    .domain(['Drama', 'Comedy', 'Action', 'Crime', 'Adventure',
             'Thriller', 'Animation', 'Horror', 'Sci-Fi', 'Romance',
             'Mystery', 'Biography', 'Western', 'Fantasy', 'History'])
    .range([...d3.schemeTableau10, ...d3.schemePastel1]);

  // ── compute cumulative frames per decade ─────────────────────
  function buildFrames(data, metric) {
    const result = {};
    for (const cutoff of DECADES) {
      const slice = data.filter(d => d.decade <= cutoff && d.genre !== 'Unknown');
      if (!slice.length) { result[cutoff] = []; continue; }
      const byGenre = d3.group(slice, d => d.genre);
      const rows = [];
      for (const [genre, movies] of byGenre) {
        rows.push({
          genre,
          value: metric === 'count'
            ? movies.length
            : d3.mean(movies, m => m.imdb),
        });
      }
      rows.sort((a, b) => b.value - a.value);
      result[cutoff] = rows.slice(0, 10);
    }
    return result;
  }

  // ── render one decade frame ───────────────────────────────────
  function renderFrame(decadeIdx) {
    const decade = DECADES[decadeIdx];
    currentDecadeIdx = decadeIdx;
    label.textContent = `${decade}s`;
    slider.value = decade;

    const metric = metricSel.value;
    const rows   = frames[decade] || [];

    if (rows.length === 0) {
      noDataMsg.text(
        datasetSel.value === 'netflix'
          ? 'Netflix data has no genre information — genre evolution unavailable.'
          : 'No data for this decade.'
      );
      barsG.selectAll('.bar-group').remove();
      xAxisG.selectAll('*').remove();
      return;
    }
    noDataMsg.text('');

    const BAR_H = Math.min(36, (plotH - 20) / rows.length - 6);
    const ROW_H = BAR_H + 8;

    const xMax = d3.max(rows, d => d.value) || 1;
    const x = d3.scaleLinear().domain([0, xMax * 1.1]).range([0, plotW]);

    // X axis
    xAxisG.transition().duration(500)
      .call(d3.axisBottom(x).ticks(5)
        .tickFormat(metric === 'count' ? d3.format('d') : d => d.toFixed(1)));
    xAxisG.select('.domain').remove();
    xAxisG.selectAll('.tick line')
      .attr('stroke', 'var(--border)').attr('stroke-dasharray', '3,3');

    // Bar groups (keyed by genre for smooth transitions)
    const groups = barsG.selectAll('.bar-group').data(rows, d => d.genre);

    const enter = groups.enter().append('g').attr('class', 'bar-group')
      .attr('opacity', 0)
      .attr('transform', (_, i) => `translate(0,${i * ROW_H})`);

    enter.append('rect').attr('class', 'bar-rect')
      .attr('height', BAR_H).attr('rx', 4).attr('width', 0);
    enter.append('text').attr('class', 'bar-label')
      .attr('y', BAR_H / 2 + 4);
    enter.append('text').attr('class', 'bar-value')
      .attr('y', BAR_H / 2 + 4).attr('x', 4);

    const merged = enter.merge(groups);

    merged.transition().duration(600).ease(d3.easeCubicOut)
      .attr('opacity', 1)
      .attr('transform', (_, i) => `translate(0,${i * ROW_H})`);

    merged.select('.bar-rect')
      .transition().duration(600).ease(d3.easeCubicOut)
      .attr('width', d => Math.max(x(d.value), 2))
      .attr('height', BAR_H)
      .attr('fill', d => colorScale(d.genre))
      .attr('opacity', 0.85);

    merged.select('.bar-label')
      .attr('x', -8).attr('text-anchor', 'end')
      .attr('font-size', 12).attr('fill', 'var(--text)')
      .text(d => d.genre);

    merged.select('.bar-value')
      .transition().duration(600)
      .attr('x', d => x(d.value) + 8)
      .attr('font-size', 11).attr('fill', 'var(--text-muted)')
      .text(d => metric === 'count' ? d.value : d.value.toFixed(2));

    groups.exit()
      .transition().duration(400)
      .attr('opacity', 0)
      .attr('transform', `translate(0,${rows.length * ROW_H})`)
      .remove();
  }

  // ── rebuild when dataset or metric changes ────────────────────
  function rebuild() {
    const data   = datasetSel.value === 'imdb' ? imdbData : netflixData;
    const metric = metricSel.value;
    frames = buildFrames(data, metric);
    barsG.selectAll('.bar-group').remove();
    xAxisG.selectAll('*').remove();
    renderFrame(currentDecadeIdx);
  }

  // ── controls ─────────────────────────────────────────────────
  metricSel.addEventListener('change', rebuild);
  datasetSel.addEventListener('change', () => { currentDecadeIdx = 0; rebuild(); });

  slider.addEventListener('input', () => {
    const decade = +slider.value;
    const idx = DECADES.indexOf(decade);
    if (idx >= 0) renderFrame(idx);
  });

  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      clearInterval(timer);
      isPlaying = false;
      playBtn.innerHTML = '&#9654; Play';
      playBtn.classList.remove('paused');
    } else {
      isPlaying = true;
      playBtn.innerHTML = '&#9646;&#9646; Pause';
      playBtn.classList.add('paused');
      if (currentDecadeIdx >= DECADES.length - 1) currentDecadeIdx = 0;

      timer = setInterval(() => {
        currentDecadeIdx++;
        renderFrame(currentDecadeIdx);
        if (currentDecadeIdx >= DECADES.length - 1) {
          clearInterval(timer);
          isPlaying = false;
          playBtn.innerHTML = '&#9654; Play';
          playBtn.classList.remove('paused');
        }
      }, 1200);
    }
  });

  rebuild();
}
