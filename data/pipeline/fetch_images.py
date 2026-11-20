"""Download one photo per settlement from Wikimedia Commons, with licence and author credits.

Which photo
  1. data/manual/settlement_images.csv, if it names a Commons file for the settlement (override;
     its optional `credit` column replaces the generated credit line);
  2. otherwise the settlement's Wikidata image (P18), found by its EKATTE code (Wikidata P3990).
  Settlements with neither are listed as missing; the frontend should fall back to an illustration.

Output (served by apps/web as static assets)
  apps/web/public/settlements/<ekatte>.jpg   1280 px wide thumbnail (smaller if the original is smaller)
  apps/web/public/settlements/index.json     per-settlement file, author, licence and source page

Every Commons photo is under a free licence, but most (CC BY / CC BY-SA) require the author
and licence to be shown next to the photo. index.json has a ready `credit` string for that.

Run:  python3 data/pipeline/fetch_images.py          (stdlib only; reads data/processed/settlements.csv)
API responses are cached under data/raw/wikimedia/<date>/. Images already downloaded from the same
Commons file are skipped, so re-runs only fetch what changed.
"""

from __future__ import annotations

import csv
import html
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN_DATE = date.today().isoformat()
SETTLEMENTS = ROOT / "data" / "processed" / "settlements.csv"
OVERRIDES = ROOT / "data" / "manual" / "settlement_images.csv"
RAW = ROOT / "data" / "raw" / "wikimedia" / RUN_DATE
OUT = ROOT / "apps" / "web" / "public" / "settlements"
UA = "settlement-image-fetch/0.1 (offline research pipeline)"

WIDTH = 1280          # a standard Wikimedia thumbnail step, so it is served from cache
MAX_AUTHOR = 80       # longer author fields get a generic credit; set `credit` in the override CSV to fix
PAUSE_S = 3.0        # between image downloads; upload.wikimedia.org throttles bursts with HTTP 429


def http_get(url: str, *, accept: str | None = None, tries: int = 5) -> bytes:
    headers = {"User-Agent": UA}
    if accept:
        headers["Accept"] = accept
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                wait = int(e.headers.get("Retry-After") or 0) or 5 * (attempt + 1)
                print(f"  HTTP {e.code}, waiting {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("unreachable")


def download(url: str, dest: Path) -> None:
    """Fetch an image file. Uses curl when available: upload.wikimedia.org rate-limits
    Python's urllib client much harder than curl, even at the same request rate."""
    if shutil.which("curl"):
        tmp = dest.with_suffix(dest.suffix + ".part")
        subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location",
                        "--retry", "4", "--retry-delay", "10", "--retry-all-errors",
                        "--user-agent", UA, "--output", str(tmp), url], check=True)
        tmp.replace(dest)
    else:
        dest.write_bytes(http_get(url))


def cached_json(name: str, url: str, **kw) -> dict:
    path = RAW / name
    if path.exists():
        return json.loads(path.read_text())
    data = json.loads(http_get(url, **kw))
    RAW.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False))
    return data


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, d):
        self.parts.append(d)


def plain(s: str | None) -> str:
    """Commons metadata fields are HTML; keep only the text."""
    if not s:
        return ""
    p = _Text()
    p.feed(s)
    return re.sub(r"\s+", " ", html.unescape("".join(p.parts))).strip()


def load_settlements() -> list[dict]:
    with SETTLEMENTS.open(newline="") as f:
        return list(csv.DictReader(f))


def load_overrides() -> dict[str, dict]:
    """ekatte -> {commons_file, credit}; either may be empty."""
    if not OVERRIDES.exists():
        return {}
    with OVERRIDES.open(newline="") as f:
        return {r["ekatte"].strip(): {"commons_file": (r.get("commons_file") or "").removeprefix("File:").strip(),
                                      "credit": (r.get("credit") or "").strip()}
                for r in csv.DictReader(f) if (r.get("ekatte") or "").strip()}


def _claim_values(entity: dict, prop: str) -> list[str]:
    return [c["mainsnak"]["datavalue"]["value"] for c in entity.get("claims", {}).get(prop, [])
            if c["mainsnak"].get("datavalue")]


def wikidata_images(ekattes: list[str]) -> dict[str, dict]:
    """Wikidata item and image (P18) per EKATTE code (P3990).

    Uses the regular Wikidata API (search + wbgetentities), not the SPARQL endpoint, which
    throttles scripted clients hard.
    """
    api = "https://www.wikidata.org/w/api.php?"
    qids: list[str] = []
    for i in range(0, len(ekattes), 30):
        search = "haswbstatement:" + "|".join(f"P3990={e}" for e in ekattes[i:i + 30])
        url = api + urllib.parse.urlencode({"action": "query", "format": "json", "list": "search",
                                            "srsearch": search, "srlimit": 100, "srnamespace": 0})
        data = cached_json(f"wikidata_search_{i // 30}.json", url)
        qids += [r["title"] for r in data["query"]["search"]]

    wanted = set(ekattes)
    out: dict[str, dict] = {}
    for i in range(0, len(qids), 50):
        url = api + urllib.parse.urlencode({"action": "wbgetentities", "format": "json",
                                            "ids": "|".join(qids[i:i + 50]), "props": "claims"})
        data = cached_json(f"wikidata_entities_{i // 50}.json", url)
        for qid, ent in data["entities"].items():
            images = _claim_values(ent, "P18")
            for ek in _claim_values(ent, "P3990"):
                if ek not in wanted:
                    continue
                # An EKATTE code should map to one item; prefer one that has an image.
                if ek not in out or (images and not out[ek]["file"]):
                    out[ek] = {"wikidata": qid, "file": images[0] if images else None}
    return out


def commons_info(files: list[str]) -> dict[str, dict]:
    """imageinfo for Commons files, 50 per request. Keys are file names without 'File:'."""
    info: dict[str, dict] = {}
    for i in range(0, len(files), 50):
        chunk = files[i:i + 50]
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "format": "json", "formatversion": 2,
            "titles": "|".join("File:" + f for f in chunk),
            "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": WIDTH,
        })
        data = cached_json(f"commons_imageinfo_{i // 50}.json", url)
        q = data["query"]
        renamed = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for page in q["pages"]:
            title = renamed.get(page["title"], page["title"]).removeprefix("File:")
            if page.get("missing") or not page.get("imageinfo"):
                info[title] = {}
                continue
            info[title] = page["imageinfo"][0]
    return info


def credit_fields(ii: dict) -> dict:
    meta = ii.get("extmetadata", {})
    field = lambda k: plain(meta.get(k, {}).get("value"))
    author = field("Artist") or field("Credit") or "Unknown author"
    author = re.sub(r"^(.+?)\1+$", r"\1", author)          # "Unknown authorUnknown author"
    licence = field("LicenseShortName") or "see source page"
    # Collages and long notes don't fit under a photo; the source page lists every author.
    short = author if len(author) <= MAX_AUTHOR else "Wikimedia Commons contributors"
    return {
        "author": author,
        "licence": licence,
        "licence_url": field("LicenseUrl") or None,
        "attribution_required": field("AttributionRequired") != "false",
        "credit": f"{short}, {licence}, via Wikimedia Commons",
    }


def main() -> None:
    settlements = load_settlements()
    overrides = load_overrides()
    wd = wikidata_images([s["ekatte"] for s in settlements])

    chosen: dict[str, tuple[str, str]] = {}   # ekatte -> (commons file, source)
    for s in settlements:
        ek = s["ekatte"]
        if overrides.get(ek, {}).get("commons_file"):
            chosen[ek] = (overrides[ek]["commons_file"], "manual")
        elif wd.get(ek, {}).get("file"):
            chosen[ek] = (wd[ek]["file"], "wikidata_p18")

    info = commons_info(sorted({f for f, _ in chosen.values()}))

    OUT.mkdir(parents=True, exist_ok=True)
    index_path = OUT / "index.json"
    previous = json.loads(index_path.read_text())["settlements"] if index_path.exists() else {}

    entries: dict[str, dict] = {}
    missing: list[dict] = []
    downloaded = 0
    for s in settlements:
        ek = s["ekatte"]
        base = {"name": s["name"], "name_en": s["name_en"], "role": s["role"],
                "wikidata": wd.get(ek, {}).get("wikidata")}
        if ek not in chosen:
            missing.append({**base, "ekatte": ek, "reason": "no Wikidata image (P18) and no manual override"})
            continue
        file, source = chosen[ek]
        ii = info.get(file) or {}
        if not ii.get("thumburl"):
            missing.append({**base, "ekatte": ek, "reason": f"Commons file not found: {file}"})
            continue

        ext = ".png" if ii["thumburl"].lower().endswith(".png") else ".jpg"
        local = OUT / f"{ek}{ext}"
        prev = previous.get(ek, {})
        if not (local.exists() and prev.get("commons_file") == file):
            for old in OUT.glob(f"{ek}.*"):
                if old.suffix in (".jpg", ".png"):
                    old.unlink()
            print(f"  {s['name']}: {file}", flush=True)
            try:
                download(ii["thumburl"], local)
            except (subprocess.CalledProcessError, urllib.error.URLError) as e:
                print(f"  failed: {e}", file=sys.stderr, flush=True)
                missing.append({**base, "ekatte": ek, "reason": f"download failed ({file}); re-run"})
                time.sleep(PAUSE_S)
                continue
            downloaded += 1
            time.sleep(PAUSE_S)

        entries[ek] = {
            **base,
            "src": f"/settlements/{local.name}",
            "width": ii.get("thumbwidth"),
            "height": ii.get("thumbheight"),
            "source": source,
            "commons_file": file,
            "commons_page": ii.get("descriptionurl"),
            **credit_fields(ii),
        }
        if overrides.get(ek, {}).get("credit"):
            entries[ek]["credit"] = overrides[ek]["credit"]

    # Drop images of settlements that are no longer chosen.
    keep = {Path(e["src"]).name for e in entries.values()}
    for f in OUT.iterdir():
        if f.suffix in (".jpg", ".png") and f.name not in keep:
            f.unlink()

    index_path.write_text(json.dumps({
        "generated": RUN_DATE,
        "about": "One Wikimedia Commons photo per settlement. Show `credit` (author, licence) next to each photo.",
        "settlements": entries,
        "missing": missing,
    }, ensure_ascii=False, indent=1) + "\n")

    print(f"{len(entries)}/{len(settlements)} settlements have a photo "
          f"({downloaded} downloaded this run); {len(missing)} missing")
    for m in missing:
        print(f"  missing: {m['ekatte']} {m['name']} ({m['role']}) - {m['reason']}")


if __name__ == "__main__":
    main()
