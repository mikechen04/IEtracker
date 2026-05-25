# IEtracker

MCCI Island Exchange flip tracker (live listings, featured flips, market data).

## Local dev

1. Copy `.env.example` to `.env`
2. Put your [MCCI API key](https://api.mccisland.net/docs) in `.env`:

```
VITE_MCCI_API_KEY=your_key_here
```

3. Run:

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
   - Source: **GitHub Actions**

3. Push to `main` (or run the "Deploy to GitHub Pages" workflow manually).  
   Site URL: https://mikechen04.github.io/IEtracker/

### Important about the API key

- Anything in `VITE_*` is **embedded in the JavaScript** anyone can download from GitHub Pages. It is not secret in production.
- Use a personal API key you are okay exposing in a public client, or accept that visitors could reuse it.
- Never commit `.env` to git (already in `.gitignore`).

### If live API calls fail (CORS)

Local dev uses a Vite proxy. GitHub Pages calls `https://api.mccisland.net` directly from the browser. If you see network/CORS errors, the API may not allow your Pages origin — you would need a small backend proxy (Cloudflare Worker, etc.) instead of pure Pages.

The Google Sheet price history should still work without the API key.
