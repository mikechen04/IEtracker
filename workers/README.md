# MCCI API proxy (fixes CORS on GitHub Pages)

GitHub Pages cannot call `api.mccisland.net` directly from the browser. This Worker forwards requests and adds CORS headers.

## One-time setup (~5 min)

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (needs a free Cloudflare account):

   ```
   npm install -g wrangler
   wrangler login
   ```

2. From this folder (`workers/`):

   ```
   cd workers
   wrangler deploy
   wrangler secret put MCCI_API_KEY
   ```

   Paste your MCCI API key when prompted.

3. Copy the deploy URL (looks like `https://ie-mcci-proxy.<your-subdomain>.workers.dev`).

4. On GitHub repo **IEtracker** → **Settings → Secrets → Actions** → add:

   - Name: `VITE_MCCI_PROXY_URL`
   - Value: your worker URL (no trailing slash)

5. Re-run **Deploy to GitHub Pages** (Actions tab), then hard-refresh the site.

The API key stays on Cloudflare; it is not baked into the public JS bundle when you use the proxy.
