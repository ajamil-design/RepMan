const API_BASE = '/api';

const state = {
  reviews: [],
  filters: { source: '', sentiment: '', status: '', search: '' },
};

// ---------- Data fetching ----------

async function fetchReviews() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const res = await fetch(`${API_BASE}/reviews?${params.toString()}`);
  state.reviews = await res.json();
  renderReviews();
  populateSourceFilterOptions();
}

async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  const stats = await res.json();
  renderStats(stats);
  renderCharts(stats);
}

async function createReview(payload) {
  const res = await fetch(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create review');
  return res.json();
}

async function updateReview(id, payload) {
  const res = await fetch(`${API_BASE}/reviews/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update review');
  return res.json();
}

async function deleteReview(id) {
  const res = await fetch(`${API_BASE}/reviews/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete review');
}

// ---------- Stats rendering ----------

function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.total ?? '–';
  document.getElementById('statAvgRating').textContent = stats.avgRating != null ? stats.avgRating.toFixed(1) : '–';
  const needsResponse = (stats.byStatus.find(s => s.status === 'needs_response') || {}).count || 0;
  const negative = (stats.bySentiment.find(s => s.sentiment === 'negative') || {}).count || 0;
  document.getElementById('statNeedsResponse').textContent = needsResponse;
  document.getElementById('statNegative').textContent = negative;
}

// ---------- SVG chart rendering (no external libraries) ----------

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function emptyMessage(container, text) {
  container.innerHTML = `<div class="chart-empty">${text}</div>`;
}

function renderRatingTrendChart(container, ratingTrend) {
  container.innerHTML = '';
  const points = ratingTrend.filter(p => p.avgRating != null);
  if (points.length === 0) {
    emptyMessage(container, 'No rated mentions yet');
    return;
  }

  const width = 320, height = 160, padding = 24;
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height: '160' });

  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const yFor = (val) => height - padding - ((val - 0) / 5) * (height - padding * 2);
  const xFor = (i) => padding + i * xStep;

  // axis line
  svg.appendChild(el('line', { x1: padding, y1: height - padding, x2: width - padding, y2: height - padding, stroke: '#e2e5ea' }));

  let path = '';
  points.forEach((p, i) => {
    const x = xFor(i), y = yFor(p.avgRating);
    path += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
  });
  svg.appendChild(el('path', { d: path.trim(), fill: 'none', stroke: '#3b5bdb', 'stroke-width': '2' }));

  points.forEach((p, i) => {
    const x = xFor(i), y = yFor(p.avgRating);
    const circle = el('circle', { cx: x, cy: y, r: 3, fill: '#3b5bdb' });
    const title = el('title', {});
    title.textContent = `${p.date}: ${p.avgRating}`;
    circle.appendChild(title);
    svg.appendChild(circle);
  });

  container.appendChild(svg);
}

function renderSourceChart(container, bySource) {
  container.innerHTML = '';
  if (!bySource || bySource.length === 0) {
    emptyMessage(container, 'No mentions yet');
    return;
  }

  const width = 320, barHeight = 22, gap = 10, padding = 8;
  const max = Math.max(...bySource.map(s => s.count), 1);
  const height = bySource.length * (barHeight + gap) + padding;
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height: String(height) });

  const labelWidth = 80;
  const barAreaWidth = width - labelWidth - padding * 2;

  bySource.forEach((s, i) => {
    const y = padding + i * (barHeight + gap);
    const barWidth = (s.count / max) * barAreaWidth;

    const label = el('text', { x: 0, y: y + barHeight / 2 + 4, 'font-size': '11', fill: '#6b7280' });
    label.textContent = s.source.length > 11 ? s.source.slice(0, 10) + '…' : s.source;
    svg.appendChild(label);

    svg.appendChild(el('rect', {
      x: labelWidth, y, width: Math.max(barWidth, 2), height: barHeight,
      fill: '#3b5bdb', rx: 4,
    }));

    const countLabel = el('text', { x: labelWidth + barWidth + 6, y: y + barHeight / 2 + 4, 'font-size': '11', fill: '#1f2430' });
    countLabel.textContent = s.count;
    svg.appendChild(countLabel);
  });

  container.appendChild(svg);
}

function renderSentimentChart(container, bySentiment) {
  container.innerHTML = '';
  if (!bySentiment || bySentiment.length === 0) {
    emptyMessage(container, 'No mentions yet');
    return;
  }

  const colors = { positive: '#2f9e44', neutral: '#f0a500', negative: '#e03131' };
  const order = ['positive', 'neutral', 'negative'];
  const rows = order
    .map(key => bySentiment.find(s => s.sentiment === key))
    .filter(Boolean);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) {
    emptyMessage(container, 'No mentions yet');
    return;
  }

  const size = 140, radius = 55, cx = size / 2, cy = size / 2;
  const svg = el('svg', { viewBox: `0 0 ${size + 120} ${size}`, width: '100%', height: String(size) });

  let startAngle = -90;
  rows.forEach(r => {
    const fraction = r.count / total;
    const angle = fraction * 360;
    const endAngle = startAngle + angle;

    if (fraction >= 0.999) {
      // single full circle
      svg.appendChild(el('circle', { cx, cy, r: radius, fill: colors[r.sentiment] }));
    } else {
      const largeArc = angle > 180 ? 1 : 0;
      const startRad = (Math.PI / 180) * startAngle;
      const endRad = (Math.PI / 180) * endAngle;
      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      const path = `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`;
      svg.appendChild(el('path', { d: path, fill: colors[r.sentiment] }));
    }
    startAngle = endAngle;
  });

  // legend
  rows.forEach((r, i) => {
    const legendY = 16 + i * 20;
    svg.appendChild(el('rect', { x: size + 10, y: legendY, width: 10, height: 10, fill: colors[r.sentiment] }));
    const text = el('text', { x: size + 26, y: legendY + 9, 'font-size': '11', fill: '#1f2430' });
    text.textContent = `${r.sentiment} (${r.count})`;
    svg.appendChild(text);
  });

  container.appendChild(svg);
}

function renderCharts(stats) {
  renderRatingTrendChart(document.getElementById('ratingTrendChart'), stats.ratingTrend);
  renderSourceChart(document.getElementById('sourceChart'), stats.bySource);
  renderSentimentChart(document.getElementById('sentimentChart'), stats.bySentiment);
}

// ---------- Review list rendering ----------

function populateSourceFilterOptions() {
  const select = document.getElementById('sourceFilter');
  const current = select.value;
  const sources = Array.from(new Set(state.reviews.map(r => r.source))).sort();
  select.innerHTML =
