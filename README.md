# Reputation Manager

A small full-stack app for tracking online reviews/mentions, flagging negative ones, logging responses, and viewing trends — built for a reputation management workflow.

Zero external dependencies: the backend uses only Node's built-in `http` module, and data is stored in a local JSON file (`server/reviews.json`). No `npm install` required. The frontend is plain HTML/CSS/JS, with charts rendered via Chart.js loaded from a CDN.

## Features

- Dashboard with total mentions, average rating, mentions needing a response, and negative-review count
- Charts: rating trend over time, volume by source, sentiment breakdown
- Review list with filters (source, sentiment, status, free-text search)
- Add new mentions manually (source, author, rating, sentiment, date, content)
- Respond to a mention and mark it responded/resolved
- Delete a mention

## Running it

Requires Node.js (v18+ recommended). No install step needed.

```
cd server
node seed.js      # populates server/reviews.json with sample data (only runs once)
node index.js     # starts the server on http://localhost:4000
```

Open **http://localhost:4000** in your browser — the frontend is served automatically from the same server.

To reset the sample data, delete `server/reviews.json` and run `node seed.js` again.

## Project structure

```
reputation-manager/
  server/
    index.js     # HTTP server: REST API + static file serving
    db.js        # JSON-file data layer (CRUD + stats)
    seed.js       # one-time sample data seeder
    reviews.json  # data file (created on first run)
  client/
    index.html
    styles.css
    app.js        # all frontend logic (fetch calls, rendering, charts)
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/reviews?source=&sentiment=&status=&search=&from=&to=` | List reviews, optionally filtered |
| GET | `/api/reviews/:id` | Get one review |
| POST | `/api/reviews` | Create a review (`source`, `content`, `date` required) |
| PATCH | `/api/reviews/:id` | Update fields (e.g. `status`, `response`) |
| DELETE | `/api/reviews/:id` | Delete a review |
| GET | `/api/stats` | Aggregated stats for the dashboard/charts |

## Extending it

- **Real data sources**: replace manual entry with scheduled pulls from Google Business Profile, Yelp, Trustpilot, etc. APIs — insert results via the same `db.insert()` function used by the seed script.
- **Auth**: if others will use this, add a simple login before exposing it beyond localhost.
- **Bigger data / concurrency**: swap `server/db.js` for a real database (Postgres, SQLite via a prebuilt binary, etc.) if the JSON file becomes a bottleneck — the rest of the app only depends on the exported `getAll/getById/insert/update/remove/stats` functions.
```
