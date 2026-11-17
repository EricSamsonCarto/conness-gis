---
icon: lucide/badge
---

# Branding

The `branding` block in your project's `settings.json` sets your app's title, description, logo, and the name its saved data is stored under. Colors are in your project's `theme.json`; see [Theme](theme.md).

!!! tip "In the editor"
    These are under **Branding**: Title, Description, Logo, Favicon, and Storage ID (`appId`) under Advanced. The Logo and Favicon pickers list the images in your project's `public/` and upload new ones into it.

```json
"branding": { "title": "My App", "appId": "my-app", "logo": "/logo.svg" }
```

## Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | App name, shown in the top bar and as the browser tab's title. The build also writes it into the page's HTML, so search engines and link previews see it without running the app |
| `description` | `string` | none | One or two sentences about the app. The build uses it for the page's meta description, the `og:description` that link previews show, and the build's [`llms.txt`](../editor/build.md#robots-and-llms). It updates live in the editor's Preview Pane |
| `logo` | `string` | none | Path to a logo shown in the top bar. Put the file in your project's `public/` and reference it, e.g. `/logo.svg`. The Conness editor's Logo picker lists `public/`'s images and uploads into it |
| `favicon` | `string` | `/favicon.svg` | The browser tab icon. Put the file in your project's `public/` and point at it, e.g. `/favicon.png`; `.svg`, `.png` and `.ico` all work. The editor's Favicon picker lists `public/`'s images and uploads into it, like Logo's |
| `appId` | `string` | slug of `title` | Prefix for every localStorage key the app writes (bookmarks, saved drawings, the info modal's "don't show again"). Give each app its own `appId` when several are served from one domain, so their saved data stays separate |

## Logo & favicon

The demo uses an SVG of the ⛰️ emoji for both the top-bar logo (`public/logo.svg` in the demo project) and the favicon (`public/favicon.svg`); new projects start with the same two files. To use your own, put an image in your project's `public/` and point `branding.logo` (or `branding.favicon`) at it. The theme doesn't recolor the logo, so pick one that reads on your top bar. Set its size with [`ui.topBar.logoSize`](ui-layout.md#top-bar-uitopbar) and `mobileLogoSize`. A new favicon shows in the editor's Preview Pane right away. The editor's **Reset all** keeps the logo but puts the favicon back to the starter's.

The top bar nudges the logo up by 8% of its height, because the default emoji logo sits low in its image. A custom logo that's already centered in its file may sit slightly high. If this is the case, add a little transparent space at the top of the image or trim some from the bottom. The logo, title and ⓘ button are evenly spaced: 12px apart on desktop, 8px on mobile.

## Made with Conness GIS

Every app credits Conness GIS in two quiet places, never on the map or in your branding:

- **The map's credits** (the ⓘ button): "Made with Conness GIS" sits with the other credits. It's always there. See [Map Controls](map-controls.md#attribution).
- **The info modal's bottom bar**: a small link at the right. Turn it off with [`ui.info.watermark`](ui-layout.md#info-modal-uiinfo): `"info": { "watermark": false }`.

