#!/usr/bin/env python3
"""Refresh the portfolio data from the UNESCO Data & AI GitBook.

Fetches the Markdown export of the "Projects Portfolio" page, parses its
project table, downloads each project's visual, merges the hand-curated
extras from ``content/curation.json`` and writes ``site/data/projects.json``.

Standard library only, so it runs anywhere Python 3.10+ is available:

    python scripts/update_portfolio.py            # update data + images
    python scripts/update_portfolio.py --check    # exit 1 if the source changed
    python scripts/update_portfolio.py --no-images
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

SOURCE_URL = "https://unesco.gitbook.io/unesco-data-ai/projects-portfolio"
ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
DATA_FILE = SITE / "data" / "projects.json"
IMG_DIR = SITE / "assets" / "projects"
CURATION_FILE = ROOT / "content" / "curation.json"
USER_AGENT = "unesco-dataai-portfolio-updater/1.0 (+https://github.com/unesco-dataai/portfolio)"
IMAGE_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}


def fetch(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read(), resp.headers.get_content_type()


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"['\u2019]", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def is_web_url(url: str) -> bool:
    return url.lower().startswith(("https://", "http://"))


def clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    # GitBook drops the space between sentences in some paragraphs ("implementation.Each").
    return re.sub(r"(?<=[a-z])\.(?=[A-Z])", ". ", text)


class Cell:
    """One <td>: plain text, description blocks, anchors and images."""

    def __init__(self) -> None:
        self.text: list[str] = []
        self.blocks: list[dict] = []  # {"p": str} or {"ul": [str]}
        self.links: list[dict] = []
        self.images: list[str] = []
        self._buf: list[str] = []
        self._list: list[str] | None = None
        self._li: list[str] | None = None
        self._anchor: dict | None = None

    def data(self, s: str) -> None:
        self.text.append(s)
        (self._li if self._li is not None else self._buf).append(s)
        if self._anchor is not None:
            self._anchor["label"] += s

    def flush(self) -> None:
        para = clean("".join(self._buf))
        if para:
            self.blocks.append({"p": para})
        self._buf = []


class PortfolioParser(HTMLParser):
    """Collect table rows (as Cells) and the intro text before the table."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[Cell]] = []
        self.intro: list[str] = []
        self._in_table = False
        self._row: list[Cell] | None = None
        self._cell: Cell | None = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self._in_table = True
        elif tag == "tr" and self._in_table:
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = Cell()
        elif self._cell is None:
            return
        elif tag == "a" and a.get("href"):
            self._cell._anchor = {"label": "", "href": a["href"]}
        elif tag == "img" and a.get("src"):
            self._cell.images.append(a["src"])
        elif tag in ("p", "br"):
            self._cell.flush()
        elif tag == "ul":
            self._cell.flush()
            self._cell._list = []
        elif tag == "li" and self._cell._list is not None:
            self._cell._li = []

    def handle_endtag(self, tag):
        c = self._cell
        if tag == "table":
            self._in_table = False
        elif tag in ("td", "th") and c is not None:
            c.flush()
            self._row.append(c)
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None
        elif c is None:
            return
        elif tag == "a" and c._anchor is not None:
            c._anchor["label"] = clean(c._anchor["label"])
            c.links.append(c._anchor)
            c._anchor = None
        elif tag == "p":
            c.flush()
        elif tag == "li" and c._li is not None:
            c._list.append(clean("".join(c._li)))
            c._li = None
        elif tag == "ul" and c._list is not None:
            c.blocks.append({"ul": [i for i in c._list if i]})
            c._list = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.data(data)
        elif not self._in_table and not self.rows:
            self.intro.append(data)


def parse_intro(markdown: str) -> str:
    """The prose between the page title and the table."""
    body = markdown.split("\n# ", 1)[-1].split("\n", 1)[-1]
    body = body.split("<table", 1)[0]
    body = re.sub(r"<[^>]+>", " ", body)
    return clean(body)


def parse_projects(markdown: str) -> list[dict]:
    parser = PortfolioParser()
    parser.feed(markdown)
    rows = [r for r in parser.rows if any("".join(c.text).strip() for c in r)]
    if not rows:
        raise SystemExit("No table rows found — did the GitBook page layout change?")

    # The header is the first data row (GitBook hides the real <th> row).
    header = [clean("".join(c.text)).lower() for c in rows[0]]
    need = ["name", "type", "link", "description", "visual"]
    if not all(h in header for h in need):
        raise SystemExit(f"Unexpected table header {header!r}; expected columns {need}")
    col = {h: header.index(h) for h in need}

    projects = []
    for row in rows[1:]:
        cell = lambda k: row[col[k]] if col[k] < len(row) else Cell()  # noqa: E731
        name = clean("".join(cell("name").text))
        if not name:
            continue
        link = cell("link")
        desc = cell("description")
        hrefs = [l["href"] for l in link.links if is_web_url(l["href"])]
        href = hrefs[0] if hrefs else ""
        projects.append({
            "slug": slugify(name),
            "name": name,
            "type": clean("".join(cell("type").text)) or "Other",
            "url": href,
            "access": "" if href else clean("".join(link.text)),
            "description": desc.blocks,
            "links": [l for l in desc.links if l["label"] and is_web_url(l["href"])],
            "image_src": cell("visual").images[0] if cell("visual").images else "",
        })
    return projects


def download_image(project: dict, previous: dict) -> str:
    """Store the visual under site/assets/projects/<slug>.<ext>; return its site path."""
    src = project.pop("image_src")
    if not src:
        return ""
    try:
        blob, ctype = fetch(src)
        ext = IMAGE_TYPES.get(ctype)
        if not ext:
            raise ValueError(f"unexpected content type {ctype}")
    except Exception as exc:  # keep the last good copy rather than dropping the visual
        print(f"  ! {project['slug']}: image download failed ({exc})", file=sys.stderr)
        return previous.get(project["slug"], {}).get("img", "")
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for stale in IMG_DIR.glob(project["slug"] + ".*"):
        if stale.suffix != ext:
            stale.unlink()
    path = IMG_DIR / f"{project['slug']}{ext}"
    if not path.exists() or path.read_bytes() != blob:
        path.write_bytes(blob)
    return f"assets/projects/{path.name}"


def merge_curation(projects: list[dict], curation: dict) -> None:
    extras = curation.get("projects", {})
    known = {p["slug"] for p in projects}
    for slug in extras:
        if slug not in known:
            print(f"  ! curation.json: '{slug}' no longer in the source table", file=sys.stderr)
    for p in projects:
        extra = extras.get(p["slug"], {})
        for key in ("short", "fig", "links"):
            if key in extra:
                p[key] = extra[key]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true", help="only report whether the source changed (exit 1 if so)")
    ap.add_argument("--no-images", action="store_true", help="skip image downloads (keep current files)")
    args = ap.parse_args()

    raw, _ = fetch(SOURCE_URL + ".md")
    markdown = raw.decode("utf-8")
    projects = parse_projects(markdown)
    curation = json.loads(CURATION_FILE.read_text("utf-8")) if CURATION_FILE.exists() else {}
    previous_doc = json.loads(DATA_FILE.read_text("utf-8")) if DATA_FILE.exists() else {}
    previous = {p["slug"]: p for p in previous_doc.get("projects", [])}

    source_hash = hashlib.sha256(markdown.encode()).hexdigest()
    if args.check:
        changed = source_hash != previous_doc.get("source_sha256")
        print("source changed" if changed else "source unchanged")
        return 1 if changed else 0

    print(f"Parsed {len(projects)} projects from {SOURCE_URL}")
    for p in projects:
        if args.no_images:
            p.pop("image_src")
            p["img"] = previous.get(p["slug"], {}).get("img", "")
        else:
            p["img"] = download_image(p, previous)
        print(f"  - {p['name']} [{p['type']}]{'' if p['img'] else ' (no visual)'}")
    merge_curation(projects, curation)

    if not args.no_images:
        keep = {Path(p["img"]).name for p in projects if p["img"]}
        for f in IMG_DIR.glob("*"):
            if f.name not in keep and f.name != ".gitkeep":
                f.unlink()

    doc = {
        "source": SOURCE_URL,
        "source_sha256": source_hash,
        "updated": previous_doc.get("updated", ""),
        "intro": parse_intro(markdown),
        "capabilities": curation.get("capabilities", []),
        "projects": projects,
    }
    content_changed = {k: v for k, v in doc.items() if k != "updated"} != \
        {k: v for k, v in previous_doc.items() if k != "updated"}
    if content_changed or not doc["updated"]:
        doc["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"{'Updated' if content_changed else 'No changes in'} {DATA_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
