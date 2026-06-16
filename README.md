# Mind OS — PWA

A planning engine that breaks goals into trees of steps, sub-steps, and tasks.
"Never let an idea die because you didn't know the next step."

## What's in this folder

```
index.html         ← entry point (loads React + Babel from CDN, no build step)
app.jsx             ← the entire app (transformed in-browser by Babel)
manifest.json       ← PWA metadata (name, icons, colors)
service-worker.js   ← offline caching
icons/              ← app icons (192px, 512px)
```

No `npm install`, no build step. Babel Standalone transforms the JSX
directly in the browser at load time. This keeps deployment as simple
as uploading static files.

## Deploy to GitHub Pages (same pattern as FinTrack)

1. Create a new GitHub repo, e.g. `mindos`
2. Push all files in this folder to the repo root (or to a `docs/` folder)
3. Go to repo **Settings → Pages**
4. Set source to your branch (e.g. `main`) and folder (`/` or `/docs`)
5. Wait ~1 minute, then visit `https://<your-username>.github.io/mindos/`

```bash
cd mindos-pwa
git init
git add .
git commit -m "Mind OS PWA"
git branch -M main
git remote add origin https://github.com/<your-username>/mindos.git
git push -u origin main
```

Then enable Pages in repo settings pointing at `main` / root.

## Install on your phone

1. Open the GitHub Pages URL in **Chrome** (Android) or **Safari** (iOS)
2. Android: tap **⋮ menu → "Add to Home screen" / "Install app"**
3. iOS: tap **Share → "Add to Home Screen"**
4. Mind OS now opens full-screen from your home screen, works offline
   (after first load), and keeps your data in local storage on-device.

## Important notes

- **Data storage:** Everything is saved in the browser's `localStorage`
  on that specific device/browser. There is no cloud sync. If you clear
  browser data or switch phones, your goals won't carry over automatically.
  (A future version could add export/import or a backend sync.)

- **✦ AI suggestions:** The "Suggest steps" feature calls the Anthropic
  API directly from the browser. This only works inside Claude.ai's
  artifact sandbox, which automatically authenticates the request.
  Outside that environment (i.e. once deployed to GitHub Pages), this
  button will show a message that AI suggestions aren't available there
  — you can still add sub-steps manually, which is the core experience.

  If you want AI suggestions to work in the deployed PWA, you'd need to:
  1. Get your own Anthropic API key from console.anthropic.com
  2. Set up a small backend (e.g. Cloudflare Worker or Vercel function)
     to hold the key securely and proxy requests to the Anthropic API
  3. Point `aiBreak()` in app.jsx at that backend URL instead

- **PIN lock:** Stored in localStorage as `mindos_pin`. This is a basic
  deterrent, not real encryption — anyone with access to browser dev
  tools could read it. Fine for keeping casual eyes off your notes,
  not for sensitive data.

## Updating the app later

Just edit `app.jsx` and re-push to GitHub. Because of the service worker
cache, users may need to close and reopen the app (or hard-refresh) once
to see changes — the service worker checks for updates on each load but
serves the cached version first for speed.
