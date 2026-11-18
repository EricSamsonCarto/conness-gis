---
icon: lucide/key-round
---

# API Keys & Security

Some services need an API key: a paid geocoder like MapTiler (`widgets.search.geocoder.apiKey`), a basemap style URL with `?key=…`, or an Esri layer URL with `&token=…`. Before you ship one, know what a static web app can and can't protect.

## Two separate problems

**1. Committing a key to git.** If you type a key into `settings.json` and push it, it stays in your repository's history for anyone who can see the repo. This one has a fix, put the key in a `.env` file in `app/`, which git already ignores, and point to it from the JSON with `$env:`.

```bash
# app/.env  (never committed)
VITE_MAPTILER_KEY=your-key-here
```

```json
"widgets": {
  "search": { "geocoder": { "provider": "maptiler", "apiKey": "$env:VITE_MAPTILER_KEY" } }
}
```

`$env:NAME` works in any string in any of the project's JSON files, also inside a longer one, like a style URL: `"https://api.maptiler.com/maps/streets/style.json?key=$env:VITE_MAPTILER_KEY"`. The name must start with `VITE_`. It's filled in whenever the project's files are read: by The Preview Pane in the editor, `npm run dev` and the build. The editor's sidebar shows the `$env:` reference itself, never the key. A name that isn't set in `.env` is reported with the other [config problems](../getting-started/concepts.md#checking-your-files). Restart `npm start` or `npm run dev` after editing `.env`.

**2. Every visitor can see the key.** `.env` doesn't help here. Conness GIS builds a static site with no server, so Vite writes every `VITE_…` value into the JavaScript it ships. Anyone using your deployed app can find the key in the browser's network tab or the page source. A static app can't hide a value from its own visitors.

## Protecting a key

- **Restrict it to your domain.** Almost every provider (MapTiler, Mapbox, Esri, Google) lets you limit a key to specific websites in its dashboard (an HTTP referrer restriction). The browser tells the provider which site each request came from, so your key copied into someone else's website won't work. But that header is easy to fake outside a browser (a `curl` command or a small script), so someone set on it can still use your key and run up your quota. It stops casual copying, which is the usual risk with a map key, but it isn't real protection on its own.
- **Cap the damage.** Set a usage limit or a billing alert in the provider's dashboard. And use a separate key for each site, so you can turn one off without breaking the others.
- **Keep truly secret keys out of the browser.** The best solution is to enver have the key publicly available. If a key can't be limited to a domain, is tied to billing you can't cap, or allows writing data, it must never reach the browser. The only fix is to send those requests through a small server or edge function that adds the key. Conness GIS doesn't include one.

### Sending requests through your own server

A proxy is a small piece of code on a server you control, such as a Cloudflare Worker, a Netlify or Vercel function, or an AWS Lambda behind a URL. It holds the key as a secret in the platform's settings (never in your app's files), takes the request from the browser, adds the key, forwards it to the provider and returns the answer. The app then calls the proxy's URL instead of the provider's, with no key in it:

- **Geocoding:** set `widgets.search.geocoder.endpoint` to the proxy's URL.
- **Basemaps and tiles:** use the proxy's URL as the basemap `style` or the layer `url`. A style JSON also lists tile and sprite URLs, so the proxy rewrites those to point back at itself.
- **Esri services:** use the proxy's URL as the layer `url`, and let the proxy add the `token`.

The proxy should only forward to the provider you expect (not any URL it's given), and should limit requests, for example by checking the `Origin` header and adding a rate limit, so it doesn't become a free open door to your key.

## The build warning

At the end of every build (the editor's **Build** or `npm run build`), a script scans the built project in `app/dist/<project>/` for anything that looks like a key: URL parameters such as `?key=`, `&token=`, `&api_key=` and `&access_token=`, and settings like `apiKey: "…"`. If it finds one, it says where and repeats the advice above; in the editor, it's in the Build dialog's log.

It skips code that only looks like a key, such as template placeholders (`${…}`) and property paths (`options.token`). Each warning shows about 40 characters around the key, with the key masked (and any other key in that text), and where it came from: `from your config: projects/demo/settings.json:42` when the value is in the project's `settings.json`, `layers.json`, `basemaps.json` or `theme.json`, or in a `.env` file in `app/` (where a `$env:` value comes from), otherwise "not in your config files; probably a dependency's code". Keys from your config are listed first.

It only warns; the build still succeeds, because many keys, like a domain-restricted MapTiler key, are meant to be public. Use it as a reminder to check that each listed key is restricted. The script is `app/scripts/check-keys.mjs`.

!!! warning "Your keys, your responsibility"
    Conness GIS doesn't manage or secure API keys. Protecting any key you deploy, and paying for any misuse, is up to you and your provider's settings.

## Dependency alerts

Dependabot watches the kit's dependencies and opens a pull request when one needs an update. CI runs the checks on each one before I merge it, and the fix reaches you with the next release.

`npm ci` and `npm audit` will often list a few vulnerabilities anyway. Most are in dev tools like Vite, ESLint and TypeScript, which run on your machine while you build and never reach the people using your map. To check only what ships to the browser, run this in `app/`:

```bash
npm audit --omit=dev
```

That should find 0. If it doesn't, check the [Releases](../getting-started/releases.md) page for a newer one, or create an issue to let us know.

Sometimes an advisory has no fix yet. For example, as of November 2026 that's picomatch, which comes in through Vite and typescript-eslint. npm's only suggestion is then `npm audit fix --force`, which swaps in an older major version of Vite (6, here) and breaks the kit.
