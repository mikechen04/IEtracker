# MCCI API proxy (fixes CORS on GitHub Pages)

GitHub Pages cannot call `api.mccisland.net` directly from the browser. This Worker forwards requests and adds CORS headers.

## Option A: GitHub Actions deploys the worker for you

1. Create a free [Cloudflare](https://dash.cloudflare.com) account.
2. Cloudflare dashboard: **My Profile → API Tokens → Create Token** → use the **Edit Cloudflare Workers** template.
3. On GitHub **IEtracker → Settings → Secrets → Actions**, add:
   - `CLOUDFLARE_API_TOKEN` = that token
   - `VITE_MCCI_API_KEY` = your MCCI API key (already needed for local dev)
4. Re-run **Deploy to GitHub Pages**. The workflow deploys the worker and bakes the proxy URL into the site.

## Option B: deploy the worker yourself

1. Install Wrangler and log in:

   ```
   npm install -g wrangler
   wrangler login
   ```

2. From the `workers/` folder:

   ```
   cd workers
   wrangler deploy
   wrangler secret put MCCI_API_KEY
   ```

   Paste your MCCI API key when prompted.

3. Copy the deploy URL (example: `https://ie-mcci-proxy.your-subdomain.workers.dev`).

4. GitHub **Settings → Secrets → Actions** → add:
   - `VITE_MCCI_PROXY_URL` = that URL (no trailing slash)

5. Re-run **Deploy to GitHub Pages**, then hard-refresh the live site.

The API key can stay on Cloudflare instead of in the public JS bundle when you use the proxy.
