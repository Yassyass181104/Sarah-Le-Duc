/* ── dumbbell.js — V1: Audience vs Critics ──────────────── */

async function initDumbbell() {
  const data = await window.loadData('imdb');

  // Populate genre filter
  const genres = [...new Set(data.map(d => d.genre))];
  window.populateSelect('db-genre-select', genres);

  // Wire controls
  ['db-genre-select', 'db-top-select', 'db-sort-select'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderDumbbell);
  });

  renderDumbbell();

  function renderDumbbell() {
    const genre   = document.getElementById('db-genre-select').value;
    const topN    = +document.getElementById('db-top-select').value;
    const sortKey = document.getElementById('db-sort-select').value;

    let filtered = data;
    if (genre !== 'all') filtered = data.filter(d => d.genre === genre);

    // Sort
    filtered = [...filtered].sort((a, b) => {
      const gapA = Math.abs(a.imdb - a.meta);
      const gapB = Math.abs(b.imdb - b.meta);
      if (sortKey === 'gap_desc')  return gapB - gapA;
      if (sortKey === 'gap_asc')   return gapA - gapB;
      if (sortKey === 'imdb_desc') return b.imdb - a.imdb;
      if (sortKey === 'meta_desc') return b.meta - a.meta;
      return gapB - gapA;
    }).slice(0, topN);

    drawDumbbell(filtered);
  }

  function drawDumbbell(movies) {
    const container = document.getElementById('dumbbell-container');
    container.innerHTML = '';

    const rowH  = 22;
    const marginL = 220;
    const marginR = 60;
    const marginT = 30;
    const marginB = 30;
    const width  = Math.max(container.clientWidth || 900, 600);
    const height = movies.length * rowH + marginT + marginB;

    const svg = d3.select('#dumbbell-container')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const plotW = width - marginL - marginR;
    const g = svg.append('g').attr('transform', `translate(${marginL},${marginT})`);

    // X scale (both scores are 0–10)
    const xMin = d3.min(movies, d => Math.min(d.imdb, d.meta)) - 0.3;
    const xMax = d3.max(movies, d => Math.max(d.imdb, d.meta)) + 0.3;
    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, plotW]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height - marginT - marginB})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-(height - marginT - marginB)).tickFormat(''));

    // X axis
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - marginT - marginB})`)
      .call(d3.axisBottom(x).ticks(6));

    // X axis label
    g.append('text')
      .attr('class', 'axis-label')
      .attr('x', plotW / 2)
      .attr('y', height - marginT - marginB + 28)
      .attr('text-anchor', 'middle')
      .text('Score (0–10)');

    // Rows
    const rows = g.selectAll('.dumbbell-row')
      .data(movies)
      .join('g')
      .attr('class', 'dumbbell-row')
      .attr('transform', (d, i) => `translate(0,${i * rowH + rowH / 2})`);

    // Background rect for hover
    rows.append('rect')
      .attr('class', 'db-bg')
      .attr('x', -marginL)
      .attr('y', -rowH / 2)
      .attr('width', width)
      .attr('height', rowH)
      .attr('fill', 'transparent');

    // Connecting line
    rows.append('line')
      .attr('x1', d => x(Math.min(d.imdb, d.meta)))
      .attr('x2', d => x(Math.max(d.imdb, d.meta)))
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', d => Math.abs(d.imdb - d.meta) > 1.5 ? 'var(--gap-hi)' : 'var(--border)')
      .attr('stroke-width', 2)
      .attr('opacity', 0.7);

    // IMDb dot
    rows.append('circle')
      .attr('cx', d => x(d.imdb))
      .attr('r', 5)
      .attr('fill', 'var(--imdb)')
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 1.5);

    // Meta dot
    rows.append('circle')
      .attr('cx', d => x(d.meta))
      .attr('r', 5)
      .attr('fill', 'var(--meta)')
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 1.5);

    // Movie title label (left)
    rows.append('text')
      .attr('x', -8)
      .attr('y', 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .attr('fill', d => Math.abs(d.imdb - d.meta) > 1.5 ? '#fff' : 'var(--text-muted)')
      .text(d => d.title.length > 30 ? d.title.slice(0, 29) + '…' : d.title);

    // Gap label (right)
    rows.append('text')
      .attr('x', plotW + 8)
      .attr('y', 4)
      .attr('font-size', 10)
      .attr('fill', d => Math.abs(d.imdb - d.meta) > 1.5 ? 'var(--gap-hi)' : 'var(--text-muted)')
      .text(d => {
        const gap = (d.imdb - d.meta).toFixed(1);
        return (gap > 0 ? '+' : '') + gap;
      });

    // Tooltip interaction
    rows
      .on('mouseover', (event, d) => {
        const html = `<strong>${d.title} (${d.year})</strong>
          Genre: ${d.genre}<br>
          IMDb score: <span style="color:var(--imdb)">${d.imdb.toFixed(1)}</span><br>
          Metascore: <span style="color:var(--meta)">${d.meta_raw} / 100</span><br>
          Normalized meta: <span style="color:var(--meta)">${d.meta.toFixed(1)}</span><br>
          Gap (IMDb − Meta): <strong>${(d.imdb - d.meta).toFixed(2)}</strong><br>
          Votes: ${d3.format(',')(d.votes)}`;
        window.showTooltip(html, event);
      })
      .on('mousemove', event => window.moveTooltip(event))
      .on('mouseleave', window.hideTooltip);
  }
}
