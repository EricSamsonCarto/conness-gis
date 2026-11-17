---
icon: lucide/cloud
---

# Hosting on Cloudflare

You can host any app you build with Conness GIS on [Cloudflare Pages](https://pages.cloudflare.com/) for free. Pages will connect to your GitHub repository and then build the app itself and redeploy every time you push, so you never upload files by hand. This assumes you have added your local downloaded version of Conness GIS as a personal repository, as is recommended in [Quick Start](https://www.conness-gis.com/getting-started/quick-start/#put-it-on-github). You can also unzip the build files into an empty repository and deploy from there, or add the build file to an existing website. The below will discuss the former option.

- Your project lives in your own GitHub repository, with its folder under `app/projects/` committed, data files in `layers/` included.
- `npm run build <project>` works on your machine and the result looks right in `npm run preview <project>`.
- You have a free Cloudflare account.

## Create your first pages site

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**, and pick your repository.
2. Give the project a name and pick your production branch (usually `main`).
3. Fill in the build settings, in the order Cloudflare asks for them:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build <project>` |
| Build output directory | `dist/<project>` |
| Path (root directory) | `app` |
| Environment variables | `NODE_VERSION` = `26` |

**Save and Deploy**. When it finishes, open the `.pages.dev` address it gives you.

Conness GIS needs Node 24 or newer and targets Node 26, the Active LTS, so set `NODE_VERSION` to `26`. You don't need an install step in the build command, because Cloudflare installs your packages itself before it runs the build. If your project reads keys with `$env:` (see [API Keys & Security](api-keys.md)), add each `VITE_` secret name and its value here too. Your `.env` file shouldn't ever be committed, so Cloudflare's build can't see it.

## Only build when the app changes

By default, every push to the repository rebuilds the app, even one that only touches the docs or a README. This would be annoying if you just made a small change to your repo. I like to add this to avoid this situation. Under the project's **Settings → Build → Build watch paths**:

- **Include paths**: `app/*`
- **Exclude paths**: `app/projects/_*`, so local builds, backups and trash never trigger a deploy

Now whenever you save your changes in the editor, commit and push to the repo, Cloudflare rebuilds and has a new version live about a minute later.

- One file can be at most 25 MiB. A larger layer needs to be hosted somewhere else (for example [PMTiles from your own storage](../configuration/adding-layers.md#pmtiles), or a free [GitHub Pages site](hosting-pmtiles-on-github-pages.md)) and loaded by URL.

## Turn off preview builds and make them private

Pages builds every branch you push, Dependabot's included, and each of those builds is a public copy of your app at its own `*.pages.dev` address. Unless you review branches that way, turn it off. In the settings, project **Settings → Build → Branch control**, and set **Preview branch** to **None**.

Even if you turn off preview builds, I recommend making them private. In the project's settings, close to the bottom, turn on the access policy for preview deployments, so only members of your Cloudflare account can open them.

## Send visitors to your own domain

Add your domain under the project's **Custom domains** tab. The app is still served at its `.pages.dev` address too, and every deploy to `main` keeps its own permanent URL (`<hash>.<project>.pages.dev`). That's how **Rollback** works, but it also means old versions of your app stay online. You can delete old ones from **Deployments → ⋯**, or redirect all of them to your domain:

1. Go to the account's **Rules → Bulk Redirects** (not a single domain's rules) and create a redirect list.
2. Add a redirect from `<project>.pages.dev` to `https://<your domain>`, with status **301** and **Include subdomains**, **Preserve path suffix** and **Preserve query string** turned on. Include subdomains is what catches every `<hash>.` URL.
3. Create a Bulk Redirect rule that uses the list, and deploy it.

Rollback in the dashboard still works after this. To check, open the bare `.pages.dev` address, an old `<hash>.` address and a link with a path and a query string, and each one should land on your domain. `redirect_to_custom_domains.py` ([below](#optional-set-it-up-with-a-script)) does this for every project with a custom domain.

## Optional: set it up with a script

If you'd rather not click through the dashboard, [cloudflare-automations](https://github.com/EricSamsonCarto/cloudflare-automations) has two Python scripts that do everything on this page through Cloudflare's API.

| Script | What it does |
|---|---|
| `src/deploy_pages.py` | Creates a new Pages project from your GitHub repository with the build settings and watch paths above. It attaches your domain and `www`, adds their DNS records, and redirects the project's `pages.dev` address to your domain. It also turns off preview builds and puts preview URLs behind Cloudflare Access for the emails you list. |
| `src/redirect_to_custom_domains.py` | Redirects the `pages.dev` address, preview URLs and `www` of every Pages project with a custom domain to that domain (a 301), and turns off their preview builds. Use it for projects you set up by hand. |

The scripts only add what's missing and never delete or replace anything. Your domain has to be on Cloudflare already, in the same account.

1. Clone the repository and install its packages with `pip install -r requirements.txt`.
2. Create a `.env` file at the repository's root with your `CF_ACCOUNT_ID` and `CF_API_TOKEN`. Its README says where to find both and which permissions the token needs.
3. Open the script and set the variables at the top. For `deploy_pages.py` that's your GitHub repository (`REPO`), the Pages project name (`PROJECT`), your domain (`DOMAIN`), the folder under `app/projects/` to build (`APP_PROJECT`), and who can open previews (`PREVIEW_ACCESS_EMAILS`).
4. Run it, for example `python src/deploy_pages.py`. With `APPLY = False` it only prints what it would change.
5. If that looks right, set `APPLY = True` and run it again.
