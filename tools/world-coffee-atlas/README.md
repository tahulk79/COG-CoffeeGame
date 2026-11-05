# World Coffee Atlas Live v0.1
Local-only research prototype. No deployment, no repository changes, no live data ingestion.

## Run
Requires Node 20+.
```bash
npm install
npm run dev
```
Open http://localhost:3000

## API
- GET /api/regions: illustrative region data
- GET /api/rankings: empty until source-verified scores are ingested
- GET /api/health: service status

## Data integrity
Region coordinates and agronomic summaries are approximate, not verified farm measurements. No SCA score is assigned to an entire region. Production PostgreSQL/PostGIS schema is in db/schema.sql but is not connected to this prototype. Future ingestion requires licensing, source provenance, and QA. The current map is an equirectangular coordinate diagram, not a basemap.

## Next steps
Integrate verified COE/Best of Panama results, attach source URLs and timestamps, migrate JSON to PostgreSQL, build geographic map tiles and scheduled collectors, add authentication and rate limits for game API.

## Chạy cùng game tại godbean.com/data
Bản này đặt trong repo COG, xuất tĩnh (`next.config.mjs`: `output: 'export'`, `basePath: '/data'`).
```bash
npm ci
npm run export   # build rồi chép out/ sang ../../public/data
```
Game build (`vite build`) mang `public/data` theo, deploy xong có ở `/data/`. API thành file JSON tĩnh: `/data/api/regions`, `/data/api/rankings`, `/data/api/health`.
