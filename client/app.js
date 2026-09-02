const API_BASE = '/api';

const state = {
  reviews: [],
  filters: { source: '', sentiment: '', status: '', search: '' },
};

let ratingTrendChart, sourceChart, sentimentChart;

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

// ---------- Rendering ----------

function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.total ?? '–';
  document.getElementById('statAvgRating').textContent = stats.avgRating != null ? stats.avgRating.toFixed(1) : '–';
  const needsResponse = (stats.byStatus.find(s => s.status === 'needs_response') || {}).count || 0;
  const negative = (stats.bySentiment.find(s => s.sentiment === 'negative') || {}).count || 0;
  document.getElementById('statNeedsResponse').textContent = needsResponse;
  document.getElementById('statNegative').textContent = negative;
}

function renderCharts(stats) {
  const trendLabels = stats.ratingTrend.map(r => r.date);
  const trendData = stats.ratingTrend.map(r => r.avgRating);

  const sourceLabels = stats.bySource.map(s => s.source);
  const sourceData = stats.bySource.map(s => s.count);

  const sentimentOrder = ['positive', 'neutral', 'negative'];
  const sentimentColors = { positive: '#2f9e44', neutral: '#f0a500', negative: '#e03131' };
  const sentimentLabels = [];
  const sentimentData = [];
  const sentimentBg = [];
  sentimentOrder.forEach(key => {
    const found = stats.bySentiment.find(s => s.sentiment === key);
    if (found) {
      sentimentLabels.push(key);
      sentimentData.push(found.count);
      sentimentBg.push(sentimentColors[key]);
    }
  });

  const ctxTrend = document.getElementById('ratingTrendChart');
  const ctxSource = document.getElementById('sourceChart');
  const ctxSentiment = document.getElementById('sentimentChart');

  if (ratingTrendChart) ratingTrendChart.destroy();
  if (sourceChart) sourceChart.destroy();
  if (sentimentChart) sentimentChart.destroy();

  ratingTrendChart = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'Avg rating',
        data: trendData,
        borderColor: '#3b5bdb',
        backgroundColor: 'rgba(59,91,219,0.1)',
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 5, ticks: { stepSize: 1 } } },
    },
  });

  sourceChart = new Chart(ctxSource, {
    type: 'bar',
    data: {
      labels: sourceLabels,
      datasets: [{ label: 'Mentions', data: sourceData, backgroundColor: '#3b5bdb' }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  sentimentChart = new Chart(ctxSentiment, {
    type: 'doughnut',
    data: {
      labels: sentimentLabels,
      datasets: [{ data: sentimentData, backgroundColor: sentimentBg }],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

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

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  state.filters = { source: '', sentiment: '', status: '', search: '' };
  document.getElementById('searchInput').value = '';
  document.getElementById('sourceFilter').value = '';
  document.getElementById('sentimentFilter').value = '';
  document.getElementById('statusFilter').value = '';
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