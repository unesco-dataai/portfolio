# UNESCO Data & AI — Projects Portfolio

[![Deploy to GitHub Pages](https://github.com/unesco-dataai/portfolio/actions/workflows/pages.yml/badge.svg)](https://github.com/unesco-dataai/portfolio/actions/workflows/pages.yml)
[![Sync from GitBook](https://github.com/unesco-dataai/portfolio/actions/workflows/update.yml/badge.svg)](https://github.com/unesco-dataai/portfolio/actions/workflows/update.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Funesco-dataai.github.io%2Fportfolio%2F&label=site)](https://unesco-dataai.github.io/portfolio/)
[![Last commit](https://img.shields.io/github/last-commit/unesco-dataai/portfolio)](https://github.com/unesco-dataai/portfolio/commits/main)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white)](scripts/update_portfolio.py)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

This repo holds the showcase site for the UNESCO Data & AI Services project portfolio. It's live at **https://unesco-dataai.github.io/portfolio/**.

Project content comes from the team's GitBook page,
[Projects Portfolio](https://unesco.gitbook.io/unesco-data-ai/projects-portfolio).
The site's design comes from the Claude Design project *Projects Portfolio v2* and uses the UNESCO Design System.

## How it works

```
GitBook page ──► scripts/update_portfolio.py ──► site/data/projects.json ──► site/ (static) ──► GitHub Pages
  (.md export)        + content/curation.json        + site/assets/projects/*
```

- **`scripts/update_portfolio.py`** fetches the Markdown export of the GitBook page and parses the project table (name, type, link, description, visual). It downloads each visual into `site/assets/projects/`, then writes `site/data/projects.json`. It only needs the standard library.
- **`content/curation.json`** holds the hand-written extras that the GitBook page doesn't have: the headline figure shown per project, the chip labels, and the grouping into capabilities. Its keys are project slugs, which come from the project name, e.g. `her-atlas`. If a slug no longer matches a GitBook project, the script prints a warning.
- **`site/`** is plain HTML, CSS and JavaScript with no build step. `assets/js/app.js` renders the page from `data/projects.json`.

## Updating the content

- **Automatically:** the [Sync from GitBook](.github/workflows/update.yml) workflow runs every Monday at 06:00 UTC. You can also start it by hand from the Actions tab. When the source has changed, it commits the new data and redeploys the site.
- **Locally:**

  ```bash
  python3 scripts/update_portfolio.py             # refresh data + visuals
  python3 scripts/update_portfolio.py --check     # exit 1 if GitBook changed since the last sync
  python3 scripts/update_portfolio.py --no-images # data only
  ```

To add or change a project, edit the table on GitBook, not this repo. If the new project should also get a headline figure or appear under a capability, add it to `content/curation.json`.

## Local preview

```bash
python3 -m http.server 8000 --directory site
# open http://localhost:8000
```

## Deployment

Every push to `main` that touches `site/` triggers [Deploy to GitHub Pages](.github/workflows/pages.yml), which publishes `site/`.
The repo's Pages source must be set to **GitHub Actions** (Settings → Pages).

## Repository layout

```
.
├── .github/workflows/
│   ├── pages.yml            # deploy site/ to GitHub Pages
│   └── update.yml           # weekly GitBook sync
├── content/curation.json    # hand-curated figures, labels, capability groups
├── scripts/update_portfolio.py
└── site/
    ├── index.html
    ├── data/projects.json   # generated — do not edit by hand
    └── assets/
        ├── css/             # tokens.css (UNESCO Design System) + site.css
        ├── js/app.js
        ├── img/             # official UNESCO logo, favicon
        └── projects/        # generated visuals
```

## License

[MIT](LICENSE) © Data & AI – UNESCO Team. The UNESCO name and logo are trademarks of UNESCO and aren't covered by this license.
