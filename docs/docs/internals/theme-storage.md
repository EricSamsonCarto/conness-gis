---
icon: lucide/database
---

# Theme & Storage

Three small core modules that a lot depends on: `theme/theme.ts` (colors to CSS variables), `theme/uiVars.ts` (UI sizes to CSS variables) and `storageKey.ts` (per-app localStorage keys). The user side of theming is on the [Theme](../configuration/theme.md) page.

## Theme: `core/theme/theme.ts` + `core/theme/themes.ts`

### `applyTheme(settings.theme)`

Reads the project's `theme.json` (`{ preset, colors, widgetTitleColor }`) and writes each color token to a `--color-<token>` CSS variable on `:root`. A token's value is a Tailwind color name (`"indigo-700"`), written as that palette color's variable (`var(--color-indigo-700)`). Tailwind classes (`bg-primary`, `bg-panelBg`) and plain `var(--color-*)` CSS both read the current value.

The colors merge as `{ ...DEFAULT_COLORS, ...THEMES[preset].colors, ...theme.colors }`: kit default ← preset ← user override, so nothing is required.

- **`DEFAULT_COLORS`** (`theme.ts`) is the `conness` preset; it isn't repeated in `THEMES`.
- **`THEMES`** (`themes.ts`) holds every other preset as `{ mode, colors }`, each a complete palette, not a partial patch. `themes.ts` never imports `theme.ts`: an early version did, and the circular import could leave `DEFAULT_COLORS` undefined at load.

Two special values keep tokens linked:

- A token whose value is another token's name (`"primary"`, `"surface"`, `"panelBg"`, `"text"`) points at that token's variable. `"save": "primary"` follows whatever `primary` is, and the `dark` preset's `topBarBg: 'panelBg'` makes the bar match the panels.
- `'primaryDarker'` becomes `color-mix(in srgb, var(--color-primary) 85%, black)`: a hover shade about 15% darker than `primary`, whatever `primary` is. Action and save hovers use it.

`applyTheme` also writes the preset's mode to `<html data-theme="light|dark">` and to `color-scheme`. Plain CSS uses `data-theme` for anything a token can't reach: in dark mode, measure's dropdown arrow (a data URI) switches to a light one. `color-scheme` makes the browser's own controls (scrollbars, `<select>` menus) dark with no extra work. Because this keys off `mode` and not the preset's name, any new dark preset gets it automatically.

The map's buttons have their own switch, `<html data-map-controls="light|dark">`, for black or white icons. `applyTheme` sets it from `mapControlIcons`, or, when that's unset, from the button color: it reads `mapControlBg` (else `panelBg`) as rgb with `resolvedThemeColor` and picks white icons on a dark one. In `index.css`, `--map-control-bg` is `var(--color-mapControlBg, var(--color-panelBg))`, and `--map-control-fg` is `#333` or `#ccc`. Those are exactly what MapLibre's own `#333` icon images come out as, plain or under `filter: invert(1) hue-rotate(180deg)` on dark buttons, so the floating widgets' icons (`--floating-icon-color`) always match them. The border and hover colors blend the two.

`applyTheme` runs in `main.tsx` before the first React render, so colors never flash on load (`applyUiVars`, below, does the same for sizes). That's also before the boot `try/catch` exists, so it never throws; an unknown preset quietly falls back to `conness` there. The real error comes a moment later from `validateThemeConfig`, which `AppShell.tsx` calls with the other [config checks](architecture.md#config-validation).

To add a token, update four places: `themeColorsSchema` (`core/schema/theme.ts`, with a description and default), `DEFAULT_COLORS`, every preset in `THEMES`, and the `@theme` block in `index.css`. `@theme` supplies the values for the first paint and makes Tailwind generate the class; a token missing from `@theme` has no `bg-<token>` class.

To add a preset, add one complete `{ mode, colors }` entry to `THEMES` and its name to `themeNameSchema` in `core/schema/theme.ts`. The boot check builds its list of valid names from `THEMES`. Keep `primary`, `danger`, `success`, `save`, `actionActive` and any colored `topBarBg` dark enough for white text.

### Why map paint is different

MapLibre layer paint can't read CSS variables, so tokens don't reach the map itself. Draw and Measure's shape colors and their amber hover highlight are fixed hex values on purpose: they're map content, they need many distinct colors, and they must read on any basemap. When a map color should follow the theme, read the token's computed value at runtime instead of using `var()`. The coordinates widget does this for its marker (`getComputedStyle(document.documentElement).getPropertyValue('--color-primary')`).

### Widget launcher icons

`shell/WidgetIcon.tsx` draws each widget's SVG as a CSS `mask-image` filled with `background-color`. Masks only use the image's transparency, so the file's own color doesn't matter and one file works on every surface and preset. Two details are commented in the code:

- The URL is quoted: `url("${src}")`. Vite inlines SVGs under 4 KB as data URIs and swaps `"` for `'`. Single quotes aren't allowed in an unquoted CSS `url()`, and the browser silently drops the mask.
- The span is `display: block`. An inline box sits on the text baseline and leaves room for descenders, which pushes the icon off-center in a button that isn't a flex container.

### MapLibre's control icons

MapLibre draws its own control icons as dark SVG data-URI backgrounds from `maplibre-gl.css`, with no color hook. For white icons (`data-map-controls="dark"`), `index.css` flips them with `filter: invert(1) hue-rotate(180deg)` on the icon span, not the button. On a cold load Safari has been seen leaving those filtered icons blank, so `repaintInvertedIcons` (`shell/mapControls.ts`) decodes each icon's image after the controls are added and forces one repaint. The bug was seen again after that change, so it's still open in the bug list; the fallback is to draw these icons with `mask-image`, like the widgets'.

## UI variables: `core/theme/uiVars.ts`

`applyUiVars(ui, isMobile)` turns `settings.ui` sizes into CSS variables, and holds their defaults. Settings stay in px at the default 16px root font; `rem(px)` in the same module writes them as rem, so they scale with the browser's font-size setting. The top bars use it for their height and logo size too. Each `iconSize` setting is the icon's size, and the button size is worked out from it:

- `--floating-control-size`: the icon ÷ 0.75. Sizes the floating widget buttons and MapLibre's built-in controls, whose icons are drawn at 75% of the button.
- `--top-bar-icon-size` and `--top-bar-button-size`: the icon, and twice the icon.
- `--side-rail-icon-size`: the side rail icon. `SidePanel.tsx` adds fixed padding around it for the button.
- `--text-small`, `--text-medium`, `--text-large`, `--text-title`, `--text-button`, `--text-dialogButton`: from `ui.textSizes` (`DEFAULT_TEXT_SIZES`), read by Tailwind's `text-*` classes of the same names.
- `--text-popupHeader`, `--text-popupTitle`, `--text-popupBody`: from `ui.popups.headerSize` / `titleSize` / `bodySize`.
- `--widget-button-cursor`: from `ui.buttonCursor`.
- `--top-bar-shadow-height` / `--top-bar-shadow-opacity`: the shadow under the top bar. `strength` (0 to 1, clamped) scales both, and the height is 0 when the shadow is off.
- `--side-rail-shadow-width` / `--side-rail-shadow-opacity`: the same for the shadow beside the side rail (`ui.layout.sideRailShadow`).

Floating and top-bar sizes switch to their `mobileIconSize` in the mobile layout (below 500 px wide), so `AppShell` calls `applyUiVars` again when `isMobile` changes. `index.css` sets fallback values for some of these variables, used before boot. They match the defaults in `theme/uiVars.ts`, so change both together.

## Storage: `core/storageKey.ts`

Every localStorage key the app writes goes through one helper, so the prefix can't drift between modules and one setting controls it.

```ts
storageKey(kind, suffix?)  →  `mak:<appId>:<kind>[:<suffix>]`
```

`<appId>` is `branding.appId` if set, otherwise a slug of `branding.title`. Used by:

| Consumer | Key |
|---|---|
| Bookmarks | `storageKey('bookmarks')`, through `useSavedItems` |
| Drawing sets | `storageKey('drawings')`, through `useSavedItems` |
| Info-dismiss | `storageKey('info-dismissed', <content-hash>)` |

The info-dismiss key ends with a hash of `info.md`'s content. Editing the file changes the key, so returning users see the modal again even if they chose "don't show again".

This matters when several apps built on the kit share one domain, like several demos on one Pages site: each `appId` keeps its own saved data.

Two helpers in the same module read and write JSON under these keys: `loadStored(kind, fallback)` returns `fallback` when the key is missing, the value is corrupt, or storage is blocked (private browsing), and `saveStored(kind, value)` returns `false` when storage is full or blocked, so the value only lives in memory for the session. `@/ui/useSavedItems`, behind Bookmarks and Draw's Saved Drawings, uses both. It builds every change from what's stored rather than from its own copy, so two open tabs don't overwrite each other's saves, and it exposes `saveFailed` so the widget can warn the user.
