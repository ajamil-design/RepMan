// Reputation Manager — backend + static file server.
// Built with zero external dependencies (Node.js core `http` module only).
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, '..', 'client');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(PUBLIC_DIR, filePath);

  // Prevent path traversal outside client dir
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // SPA fallback to index.html for unknown routes
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexContent) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexContent);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function handleApi(req, res, urlObj) {
  const { pathname, searchParams } = urlObj;
  const method = req.method;

  // GET /api/reviews
  if (method === 'GET' && pathname === '/api/reviews') {
    const filters = {
      source: searchParams.get('source') || undefined,
      sentiment: searchParams.get('sentiment') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    };
    return sendJSON(res, 200, db.getAll(filters));
  }

  // GET /api/reviews/:id
  const reviewIdMatch = pathname.match(/^\/api\/reviews\/(\d+)$/);
  if (method === 'GET' && reviewIdMatch) {
    const row = db.getById(reviewIdMatch[1]);
    if (!row) return sendJSON(res, 404, { error: 'Not found' });
    return sendJSON(res, 200, row);
  }

  // POST /api/reviews
  if (method === 'POST' && pathname === '/api/reviews') {
    const body = await readBody(req);
    const { source, author, rating, sentiment, content, status, response, date } = body;
    if (!source || !content || !date) {
      return sendJSON(res, 400, { error: 'source, content, and date are required' });
    }
    const row = db.insert({ source, author, rating, sentiment, content, status, response, date });
    return sendJSON(res, 201, row);
  }

  // PATCH /api/reviews/:id
  if (method === 'PATCH' && reviewIdMatch) {
    const existing = db.getById(reviewIdMatch[1]);
    if (!existing) return sendJSON(res, 404, { error: 'Not found' });
    const body = await readBody(req);
    const fields = ['source', 'author', 'rating', 'sentiment', 'content', 'status', 'response', 'date'];
    const updates = {};
    for (const field of fields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (Object.keys(updates).length === 0) return sendJSON(res, 400, { error: 'No fields to update' });
    const row = db.update(reviewIdMatch[1], updates);
    return sendJSON(res, 200, row);
  }

  // DELETE /api/reviews/:id
  if (method === 'DELETE' && reviewIdMatch) {
    const ok = db.remove(reviewIdMatch[1]);
    if (!ok) return sendJSON(res, 404, { error: 'Not found' });
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    return res.end();
  }

  // GET /api/stats
  if (method === 'GET' && pathname === '/api/stats') {
    return sendJSON(res, 200, db.stats());
  }

  if (method === 'GET' && pathname === '/api/health') {
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (urlObj.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, urlObj);
    } catch (err) {
      console.error(err);
      sendJSON(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  serveStatic(req, res, urlObj.pathname);
});

server.listen(PORT, () => {
  console.log(`Reputation Manager running at http://localhost:${PORT}`);
});