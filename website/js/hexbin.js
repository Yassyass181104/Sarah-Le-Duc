/* ── hexbin.js — V3: Popularity vs Quality Density Map ─────── */

async function initHexbin() {
  const [imdbData, netflixData] = await Promise.all([
    window.loadData('imdb'),
    window.loadData('netflix'),
  ]);

  const datasetSel = document.getElementById('hx-dataset-select');
  const decadeSel  = document.getElementById('hx-decade-select');
  const genreSel   = document.getElementById('hx-genre-select');

  function activeDataset() {
    return datasetSel.value === 'imdb' ? imdbData : netflixData;
  }

  function populateFilters(data) {
    const decades = [...new Set(data.map(d => d.decade))].sort();
    window.populateSelect('hx-decade-select', decades.map(String));
    const genres = [...new Set(data.map(d => d.genre))].filter(g => g !== 'Unknown');
    window.populateSelect('hx-genre-select', genres);
  }

  populateFilters(imdbData);

  // ── layout ───────────────────────────────────────────────────
  const container = document.getElementById('hexbin-container');
  const W  = Math.max(container.clientWidth || 800, 500);
  const H  = 480;
  const ML = 70, MR = 30, MT = 20, MB = 55;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const svg = d3.select('#hexbin-container')
    .append('svg').attr('width', W).attr('height', H);

  // Gradient for the density legend
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', 'hex-legend-grad');
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#1a1d27');
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#e50914');

  const g    = svg.append('g').attr('transform', `translate(${ML},${MT})`);
  const hexG = g.append('g').attr('class', 'hexbins');
  const gemG = g.append('g').attr('class', 'gems');

  // Axes
  const xAxisG = svg.append('g').attr('class', 'axis')
    .attr('transform', `translate(${ML},${H - MB})`);
  const yAxisG = svg.append('g').attr('class', 'axis')
    .attr('transform', `translate(${ML},${MT})`);

  svg.append('text').attr('class', 'axis-label')
    .attr('x', ML + plotW / 2).attr('y', H - 10)
    .attr('text-anchor', 'middle').text('IMDb Rating');

  svg.append('text').attr('class', 'axis-label')
    .attr('transform', `rotate(-90)`)
    .attr('x', -(MT + plotH / 2)).attr('y', 14)
    .attr('text-anchor', 'middle').text('Vote Count (log)');

  // ── scales ───────────────────────────────────────────────────
  const x = d3.scaleLinear().domain([5.5, 9.5]).range([0, plotW]);
  const y = d3.scaleLog().domain([1e3, 3e6]).range([plotH, 0]).clamp(true);

  xAxisG.call(d3.axisBottom(x).ticks(8));
  yAxisG.call(d3.axisLeft(y).ticks(6, '~s'));

  // ── hexbin generator ─────────────────────────────────────────
  const hexbin = d3.hexbin()
    .x(d => x(d.imdb))
    .y(d => y(Math.max(d.votes, 1)))
    .radius(18)
    .extent([[0, 0], [plotW, plotH]]);

  const colorScale = d3.scaleSequential(d3.interpolateYlOrRd);

  // ── legend ───────────────────────────────────────────────────
  const legendG = svg.append('g')
    .attr('transform', `translate(${ML + plotW - 135},${MT + 10})`);

  legendG.append('text').attr('y', -4).attr('font-size', 9)
    .attr('fill', 'var(--text-muted)').text('Density (movies / bin)');
  legendG.append('rect').attr('width', 120).attr('height', 8)
    .attr('fill', 'url(#hex-legend-grad)').attr('rx', 2);
  legendG.append('text').attr('y', 20).attr('font-size', 9)
    .attr('fill', 'var(--text-muted)').text('Low');
  legendG.append('text').attr('x', 120).attr('y', 20).attr('text-anchor', 'end')
    .attr('font-size', 9).attr('fill', 'var(--text-muted)').text('High');

  // Gem legend entry
  legendG.append('circle').attr('cx', 0).attr('cy', 36)
    .attr('r', 5).attr('fill', '#f5c518').attr('stroke', '#fff').attr('stroke-width', 1);
  legendG.append('text').attr('x', 10).attr('y', 40)
    .attr('font-size', 9).attr('fill', 'var(--text-muted)')
    .text('Hidden gem (rating ≥ 8, votes < 100k)');

  // ── render ───────────────────────────────────────────────────
  function render() {
    let data   = activeDataset();
    const decade = decadeSel.value;
    const genre  = genreSel.value;

    if (decade !== 'all') data = data.filter(d => d.decade === +decade);
    if (genre  !== 'all') data = data.filter(d => d.genre  === genre);

    const valid = data.filter(d => d.imdb && d.votes > 0);
    const bins  = hexbin(valid);
    const maxLen = d3.max(bins, b => b.length) || 1;
    colorScale.domain([0, maxLen]);

    // Update legend gradient stops
    grad.select('stop:first-child').attr('stop-color', colorScale(0));
    grad.select('stop:last-child').attr('stop-color', colorScale(maxLen));

    // Hexbin cells
    const cells = hexG.selectAll('.hex')
      .data(bins, d => `${d.x.toFixed(0)}_${d.y.toFixed(0)}`);

    const enterCells = cells.enter().append('path')
      .attr('class', 'hex')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('d', hexbin.hexagon())
      .attr('stroke', 'var(--bg)').attr('stroke-width', 0.5)
      .attr('opacity', 0);

    enterCells
      .on('mouseover', (event, d) => {
        const avgRating = d3.mean(d, m => m.imdb).toFixed(2);
        const avgVotes  = Math.round(d3.mean(d, m => m.votes));
        window.showTooltip(
          `<strong>${d.length} movie${d.length > 1 ? 's' : ''}</strong>
           Avg rating: ${avgRating}<br>
           Avg votes: ${d3.format(',')(avgVotes)}`,
          event
        );
      })
      .on('mousemove', e => window.moveTooltip(e))
      .on('mouseleave', window.hideTooltip);

    enterCells.merge(cells)
      .transition().duration(500)
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('d', hexbin.hexagon())
      .attr('fill', d => colorScale(d.length))
      .attr('opacity', 0.88);

    cells.exit().transition().duration(300).attr('opacity', 0).remove();

    // Hidden gems: high rating, low vote count
    const gems = valid.filter(d => d.imdb >= 8.0 && d.votes < 100_000);

    const gemDots = gemG.selectAll('.gem').data(gems, d => d.title);

    gemDots.enter().append('circle')
      .attr('class', 'gem')
      .attr('r', 5)
      .attr('fill', '#f5c518')
      .attr('stroke', 'var(--bg)').attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .on('mouseover', (event, d) => {
        window.showTooltip(
          `<strong>★ ${d.title} (${d.year})</strong>
           Genre: ${d.genre}<br>
           IMDb: ${d.imdb}<br>
           Votes: ${d3.format(',')(d.votes)}`,
          event
        );
      })
      .on('mousemove', e => window.moveTooltip(e))
      .on('mouseleave', window.hideTooltip)
      .merge(gemDots)
      .transition().duration(400)
      .attr('cx', d => x(d.imdb))
      .attr('cy', d => y(Math.max(d.votes, 1)))
      .attr('opacity', 0.9);

    gemDots.exit().transition().duration(300).attr('opacity', 0).remove();
  }

  // ── controls ─────────────────────────────────────────────────
  datasetSel.addEventListener('change', () => {
    populateFilters(activeDataset());
    render();
  });
  decadeSel.addEventListener('change', render);
  genreSel.addEventListener('change', render);

  render();
}
