# IEtracker

MCCI Island Exchange flip tracker (live listings, featured flips, market data).

## Local dev

1. Copy `.env.example` to `.env`
2. Put your [MCCI API key](https://api.mccisland.net/docs) in `.env`:

```
VITE_MCCI_API_KEY=your_key_here
```

3. Use **Node.js 24+** (`node -v` to check). Then run:

```
npm install
npm run dev
```

## GitHub Pages

Yes, you can host here. The site is static; the API key is injected **at build time** in GitHub Actions.

### Setup (one time)

1. On GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `VITE_MCCI_API_KEY`
   - Value: your MCCI API key (same as local `.env`)

2. **Settings → Pages → Build and deployment**
   - Source: **GitHub Actions** (not "Deploy from a branch")
   - If it was set to `main` / root, the site will be a **blank page** because GitHub serves the raw repo `index.html` (dev `/src/main.jsx`) instead of the Vite build.

3. Push to `main` (or run the "Deploy to GitHub Pages" workflow manually).  
   Wait for the **Deploy to GitHub Pages** workflow to finish (green check on the Actions tab).  
   Site URL: https://mikechen04.github.io/IEtracker/

### Blank page?

Open the live site, View Source. If you see `src="/src/main.jsx"`, Pages is not using the Actions build. Switch source to **GitHub Actions**, re-run the workflow, then hard-refresh (Ctrl+F5). A correct deploy shows `src="/IEtracker/assets/....js"`.

### Important about the API key

- Anything in `VITE_*` is **embedded in the JavaScript** anyone can download from GitHub Pages. It is not secret in production.
- Use a personal API key you are okay exposing in a public client, or accept that visitors could reuse it.
- Never commit `.env` to git (already in `.gitignore`).

### If live API calls fail (CORS / NetworkError)

Local dev uses a Vite proxy. **GitHub Pages cannot call the MCCI API directly.** The browser blocks it.

Fix: follow [`workers/README.md`](workers/README.md). Add these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_WORKERS_SUBDOMAIN` (your `*.workers.dev` subdomain name)
- `VITE_MCCI_API_KEY`

Re-run **Deploy to GitHub Pages**. Or set `VITE_MCCI_PROXY_URL` manually if you deployed the worker yourself.

Sheet price history still works without the API.
