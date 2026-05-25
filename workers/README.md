# MCCI API proxy (fixes CORS on GitHub Pages)

GitHub Pages cannot call `api.mccisland.net` from the browser. This Worker forwards requests and adds CORS headers.

## GitHub Actions setup (recommended)

Add these **Actions secrets** on the IEtracker repo (**Settings → Secrets and variables → Actions**):

| Secret name | Required? | Where to get it |
|-------------|-----------|-----------------|
| `CLOUDFLARE_API_TOKEN` | **Yes** | Cloudflare → Profile → API Tokens → **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | **Yes** (or auto if token works) | Cloudflare dashboard → any site → right sidebar **Account ID** (32 char hex) |
| `VITE_MCCI_API_KEY` | **Yes** | Your [MCCI API key](https://api.mccisland.net/docs) |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Optional | Only if deploy log does not show a URL. Your `*.workers.dev` name (e.g. `mikechen` from `ie-mcci-proxy.mikechen.workers.dev`) |
| `VITE_MCCI_PROXY_URL` | Optional | Full worker URL if you deployed manually |

Then **Actions → Deploy to GitHub Pages → Run workflow**.

The workflow deploys `ie-mcci-proxy` and builds the site with  
`https://ie-mcci-proxy.<your-subdomain>.workers.dev`.

### Optional: set the proxy URL yourself

If you already deployed the worker, you can skip `CLOUDFLARE_WORKERS_SUBDOMAIN` and only set:

- `VITE_MCCI_PROXY_URL` = full worker URL (example: `https://ie-mcci-proxy.mikechen.workers.dev`)

## Manual deploy (Option B)

```
npm install -g wrangler
wrangler login
cd workers
wrangler deploy
wrangler secret put MCCI_API_KEY
```

Copy the `https://ie-mcci-proxy....workers.dev` URL into GitHub secret `VITE_MCCI_PROXY_URL`, then re-run **Deploy to GitHub Pages**.
