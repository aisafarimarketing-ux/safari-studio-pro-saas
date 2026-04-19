# Safari Studio PDF Service

Tiny Express + Playwright sidecar that renders a public proposal page to a magazine-quality PDF. Deploy as a **separate Railway service** (the main app is too lean for Chromium).

## Deploy on Railway

1. **New service** → "Deploy from Repo" → point at this repo's `pdf-service/` directory.
2. Railway detects the `Dockerfile` and builds it. Chromium and all system libs are baked into the base image, so the build is one step.
3. Set env vars:
   - `PDF_SHARED_SECRET` — any random 32+ char string. Must match the same env var on the main Next.js service.
4. After deploy, copy the public service URL (e.g. `https://pdf-service.up.railway.app`).
5. On the **main Next.js service**, set:
   - `PDF_RENDER_URL=https://pdf-service.up.railway.app`
   - `PDF_SHARED_SECRET=<same as above>`

## Test locally

```bash
cd pdf-service
npm install
PDF_SHARED_SECRET=devsecret PORT=4000 npm start

curl -X POST http://localhost:4000/pdf \
  -H "Authorization: Bearer devsecret" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","filename":"test.pdf"}' \
  --output test.pdf
```

## API

```
POST /pdf
Authorization: Bearer <PDF_SHARED_SECRET>
Content-Type: application/json

{ "url": "https://...", "filename": "proposal.pdf" }
```

Returns the rendered PDF bytes. Errors return JSON with `{ error }` and a non-200 status.
