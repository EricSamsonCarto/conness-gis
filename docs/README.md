# Conness GIS — documentation site

The documentation site, built with [zensical](https://zensical.org/) (the Material-for-MkDocs successor)

- Markdown sources live in `docs/` (yes, `docs/docs/` — zensical's `docs_dir`).
- Site config is `zensical.toml`.
- The homepage is its own page, outside the docs theme: `overrides/home.html`, styled by `docs/assets/home/home.css` (the editor's colors and fonts) and `home.js` (its legal pop-ups). `docs/index.md` only points at the template.

## Develop

Serve with live reload at <http://localhost:8000>:

```bash
cd docs
source .venv/bin/activate
zensical serve
```

Build the static site into `site/`:

```bash
zensical build
```

> Run these from the `docs/` directory (the one containing `zensical.toml`). If
> you didn't activate the venv, prefix commands with the venv python, e.g.
> `.venv\Scripts\python.exe -m zensical serve`.

## Layout override

`docs/stylesheets/extra.css` keeps the full desktop layout (nav sidebar and
table of contents) down to 850px (`MIN_WIDTH` in the script), instead of
zensical's in-between layouts. It's
generated from the installed theme by `scripts/breakpoints.py`, so after
upgrading zensical (pinned in `requirements.txt`), re-run it:

```bash
.venv/bin/python scripts/breakpoints.py
```

It stops with an error if the new theme's rules need a look first.

## Deploy (Cloudflare Pages)

The docs are hosted on Cloudflare Pages, which builds them on its own servers
from the repo. In the Pages project settings:

| Setting | Value |
|---|---|
| Root directory | `docs` |
| Build command | `pip install -r requirements.txt && zensical build` |
| Build output directory | `site` |
| Env var | `PYTHON_VERSION = 3.12` (Pages defaults to Node; zensical is Python) |

Set **Build watch paths** to `docs/*` so commits that don't touch `docs/` don't
trigger a rebuild. Python deps are pinned in [`requirements.txt`](requirements.txt).
