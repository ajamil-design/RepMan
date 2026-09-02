const API_BASE = '/api';

const state = {
  reviews: [],
  filters: { source: '', sentiment: '', status: '', search: '', from: '', to: '' },
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
  select.innerHTML = '<option value="">All sources</option>' +
    sources.map(s => `<option value="${s}">${s}</option>`).join('');
  select.value = current;
}

function starString(rating) {
  if (rating == null) return '–';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function renderReviews() {
  const list = document.getElementById('reviewsList');
  if (state.reviews.length === 0) {
    list.innerHTML = '<div class="empty-state">No mentions match these filters.</div>';
    return;
  }

  list.innerHTML = state.reviews.map(r => `
    <div class="review-card" data-id="${r.id}">
      <div class="review-top">
        <div class="review-meta">
          <span class="badge badge-source">${r.source}</span>
          <span class="badge badge-${r.sentiment}">${r.sentiment}</span>
          <span class="badge badge-status-${r.status}">${r.status.replace('_', ' ')}</span>
          <span class="rating-stars">${starString(r.rating)}</span>
          <span class="review-author">${r.date}${r.author ? ' · ' + r.author : ''}</span>
        </div>
        <div class="review-actions">
          <select class="status-select" data-id="${r.id}">
            <option value="needs_response" ${r.status === 'needs_response' ? 'selected' : ''}>Needs response</option>
            <option value="responded" ${r.status === 'responded' ? 'selected' : ''}>Responded</option>
            <option value="resolved" ${r.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
          <button class="btn btn-secondary btn-sm respond-btn" data-id="${r.id}">Respond</button>
          <button class="btn btn-secondary btn-sm delete-btn" data-id="${r.id}">Delete</button>
        </div>
      </div>
      <div class="review-content">${escapeHtml(r.content)}</div>
      ${r.response ? `<div class="review-response"><strong>Response:</strong> ${escapeHtml(r.response)}</div>` : ''}
    </div>
  `).join('');

  list.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      await updateReview(e.target.dataset.id, { status: e.target.value });
      await Promise.all([fetchReviews(), fetchStats()]);
    });
  });

  list.querySelectorAll('.respond-btn').forEach(btn => {
    btn.addEventListener('click', () => openRespondModal(btn.dataset.id));
  });

  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this mention?')) {
        await deleteReview(btn.dataset.id);
        await Promise.all([fetchReviews(), fetchStats()]);
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Modals ----------

const overlay = document.getElementById('modalOverlay');
const modal = document.getElementById('reviewModal');

function closeModal() {
  overlay.classList.remove('open');
  modal.innerHTML = '';
}

function openNewReviewModal() {
  modal.innerHTML = `
    <h2>Add Mention</h2>
    <div class="form-row">
      <label>Source</label>
      <input type="text" id="f_source" placeholder="Google, Yelp, Facebook..." />
    </div>
    <div class="form-row">
      <label>Author</label>
      <input type="text" id="f_author" placeholder="Optional" />
    </div>
    <div class="form-row">
      <label>Rating (1-5)</label>
      <input type="number" id="f_rating" min="1" max="5" />
    </div>
    <div class="form-row">
      <label>Sentiment</label>
      <select id="f_sentiment">
        <option value="positive">Positive</option>
        <option value="neutral" selected>Neutral</option>
        <option value="negative">Negative</option>
      </select>
    </div>
    <div class="form-row">
      <label>Date</label>
      <input type="date" id="f_date" value="${new Date().toISOString().slice(0,10)}" />
    </div>
    <div class="form-row">
      <label>Content</label>
      <textarea id="f_content" placeholder="What did they say?"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="cancelNewBtn">Cancel</button>
      <button class="btn btn-primary" id="saveNewBtn">Save</button>
    </div>
  `;
  overlay.classList.add('open');

  document.getElementById('cancelNewBtn').addEventListener('click', closeModal);
  document.getElementById('saveNewBtn').addEventListener('click', async () => {
    const payload = {
      source: document.getElementById('f_source').value.trim(),
      author: document.getElementById('f_author').value.trim(),
      rating: document.getElementById('f_rating').value ? Number(document.getElementById('f_rating').value) : null,
      sentiment: document.getElementById('f_sentiment').value,
      date: document.getElementById('f_date').value,
      content: document.getElementById('f_content').value.trim(),
    };
    if (!payload.source || !payload.content || !payload.date) {
      alert('Source, content, and date are required.');
      return;
    }
    await createReview(payload);
    closeModal();
    await Promise.all([fetchReviews(), fetchStats()]);
  });
}

function openRespondModal(id) {
  const review = state.reviews.find(r => String(r.id) === String(id));
  if (!review) return;
  modal.innerHTML = `
    <h2>Respond</h2>
    <div class="form-row">
      <label>Original mention</label>
      <div class="review-content">${escapeHtml(review.content)}</div>
    </div>
    <div class="form-row">
      <label>Your response</label>
      <textarea id="f_response">${review.response ? escapeHtml(review.response) : ''}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="cancelRespondBtn">Cancel</button>
      <button class="btn btn-primary" id="saveRespondBtn">Save & Mark Responded</button>
    </div>
  `;
  overlay.classList.add('open');

  document.getElementById('cancelRespondBtn').addEventListener('click', closeModal);
  document.getElementById('saveRespondBtn').addEventListener('click', async () => {
    const response = document.getElementById('f_response').value.trim();
    await updateReview(id, { response, status: 'responded' });
    closeModal();
    await Promise.all([fetchReviews(), fetchStats()]);
  });
}

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

// ---------- Filters ----------

document.getElementById('searchInput').addEventListener('input', debounce((e) => {
  state.filters.search = e.target.value;
  fetchReviews();
}, 300));

document.getElementById('sourceFilter').addEventListener('change', (e) => {
  state.filters.source = e.target.value;
  fetchReviews();
});

document.getElementById('sentimentFilter').addEventListener('change', (e) => {
  state.filters.sentiment = e.target.value;
  fetchReviews();
});

document.getElementById('statusFilter').addEventListener('change', (e) => {
  state.filters.status = e.target.value;
  fetchReviews();
});

document.getElementById('fromFilter').addEventListener('change', (e) => {
  state.filters.from = e.target.value;
  fetchReviews();
});

document.getElementById('toFilter').addEventListener('change', (e) => {
  state.filters.to = e.target.value;
  fetchReviews();
});

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  state.filters = { source: '', sentiment: '', status: '', search: '', from: '', to: '' };
  document.getElementById('searchInput').value = '';
  document.getElementById('sourceFilter').value = '';
  document.getElementById('sentimentFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('fromFilter').value = '';
  document.getElementById('toFilter').value = '';
  fetchReviews();
});

document.getElementById('newReviewBtn').addEventListener('click', openNewReviewModal);

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------- Init ----------

(async function init() {
  await Promise.all([fetchReviews(), fetchStats()]);
})();
