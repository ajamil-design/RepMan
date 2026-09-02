// Lightweight JSON-file-backed data store (no native build dependencies required).
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'reviews.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ nextId: 1, reviews: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getAll(filters = {}) {
  const data = load();
  let rows = data.reviews;

  if (filters.source) rows = rows.filter(r => r.source === filters.source);
  if (filters.sentiment) rows = rows.filter(r => r.sentiment === filters.sentiment);
  if (filters.status) rows = rows.filter(r => r.status === filters.status);
  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(r =>
      (r.content || '').toLowerCase().includes(s) ||
      (r.author || '').toLowerCase().includes(s)
    );
  }
  if (filters.from) rows = rows.filter(r => r.date >= filters.from);
  if (filters.to) rows = rows.filter(r => r.date <= filters.to);

  return rows.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
}

function getById(id) {
  const data = load();
  return data.reviews.find(r => r.id === Number(id));
}

function insert(review) {
  const data = load();
  const row = {
    id: data.nextId,
    source: review.source,
    author: review.author || null,
    rating: review.rating != null ? Number(review.rating) : null,
    sentiment: review.sentiment || 'neutral',
    content: review.content,
    status: review.status || 'needs_response',
    response: review.response || null,
    date: review.date,
    created_at: new Date().toISOString(),
  };
  data.reviews.push(row);
  data.nextId += 1;
  save(data);
  return row;
}

function update(id, fields) {
  const data = load();
  const idx = data.reviews.findIndex(r => r.id === Number(id));
  if (idx === -1) return null;
  data.reviews[idx] = { ...data.reviews[idx], ...fields };
  save(data);
  return data.reviews[idx];
}

function remove(id) {
  const data = load();
  const idx = data.reviews.findIndex(r => r.id === Number(id));
  if (idx === -1) return false;
  data.reviews.splice(idx, 1);
  save(data);
  return true;
}

function stats() {
  const data = load();
  const rows = data.reviews;
  const total = rows.length;
  const ratedRows = rows.filter(r => r.rating != null);
  const avgRating = ratedRows.length
    ? Number((ratedRows.reduce((sum, r) => sum + r.rating, 0) / ratedRows.length).toFixed(2))
    : null;

  const countBy = (key) => {
    const map = {};
    for (const r of rows) {
      const k = r[key];
      map[k] = (map[k] || 0) + 1;
    }
    return Object.entries(map).map(([k, count]) => ({ [key]: k, count }));
  };

  const bySource = countBy('source').sort((a, b) => b.count - a.count);
  const bySentiment = countBy('sentiment');
  const byStatus = countBy('status');

  const trendMap = {};
  for (const r of rows) {
    if (!trendMap[r.date]) trendMap[r.date] = { sum: 0, count: 0 };
    if (r.rating != null) {
      trendMap[r.date].sum += r.rating;
      trendMap[r.date].count += 1;
    }
  }
  const ratingTrend = Object.entries(trendMap)
    .map(([date, { sum, count }]) => ({ date, avgRating: count ? Number((sum / count).toFixed(2)) : null, count }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  return { total, avgRating, bySource, bySentiment, byStatus, ratingTrend };
}

module.exports = { getAll, getById, insert, update, remove, stats };