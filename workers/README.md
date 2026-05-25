# MCCI API proxy (fixes CORS on GitHub Pages)

GitHub Pages cannot call `api.mccisland.net` from the browser. This Worker forwards requests and adds CORS headers.

## GitHub Actions setup (recommended)

Add these **Actions secrets** on the IEtracker repo (**Settings → Secrets and variables → Actions**):

| Secret name | Required? | Where to get it |
|-------------|-----------|-----------------|
| `CLOUDFLARE_API_TOKEN` | **Yes** | Cloudflare → Profile → API Tokens → **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | **Yes** (or auto if token works) | See below (no domain required) |
| `VITE_MCCI_API_KEY` | **Yes** | Your [MCCI API key](https://api.mccisland.net/docs) |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Optional | Only if deploy log does not show a URL. Your `*.workers.dev` name (e.g. `mikechen` from `ie-mcci-proxy.mikechen.workers.dev`) |
| `VITE_MCCI_PROXY_URL` | Optional | Full worker URL if you deployed manually |

### Find Account ID without a domain

You do **not** need to add a website to Cloudflare.

**Option 1 (easiest):** Install wrangler locally, then run:

```
npm install -g wrangler
wrangler login
wrangler whoami
```

Copy the **Account ID** from the table it prints (32 character hex).

**Option 2:** Cloudflare dashboard → **Workers & Pages** → look at the URL or account section on the right. The account ID is also under **Manage Account** → **Account ID** on some layouts.

**Option 3:** When you first open **Workers & Pages**, Cloudflare may ask you to pick a `workers.dev` subdomain (example: `mikechen`). That is only for the free worker URL, not a real domain.

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
