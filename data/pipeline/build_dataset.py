"""Build the pilot settlement dataset: top-30 Bulgarian cities + 2 nearby settlements each.

Sources
  - OpenStreetMap (Geofabrik Bulgaria extract, processed locally with pyosmium)
  - Open-Meteo (elevation API + historical archive API)
  - Ookla Open Data (fixed + mobile performance tiles, read with DuckDB)
  - OSRM public demo server (car travel times)
  - data/manual/population.csv (optional, NSI/GRAO population by year)

Run:  data/pipeline/.venv/bin/python data/pipeline/build_dataset.py
Every network response is cached under data/raw/<source>/<date>/, so re-runs are cheap.
Delete a cache file to refetch it.
"""

from __future__ import annotations

import csv
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
import osmium
import shapely
from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[2]
RUN_DATE = "2026-11-20"  # date of the raw snapshot this run uses
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
OUT = ROOT / "data" / "processed"
MANUAL = ROOT / "data" / "manual"
PBF = RAW / "osm" / RUN_DATE / "bulgaria-latest.osm.pbf"
UA = "settlement-dataset-builder/0.1 (offline research pipeline)"

N_CITIES = 30
SAT_MIN_POP = 300            # nearby village must have at least this population (OSM tag)
SAT_MIN_KM, SAT_MAX_KM = 3.0, 30.0
FALLBACK_RADIUS_KM = {"village": 1.5, "town": 3.0, "city": 6.0}
POLY_SEARCH_KM = 40.0        # forests / water / protected areas further than this are ignored
MIN_UNNAMED_HA = 5.0         # unnamed forest / water polygons smaller than this are not counted

# Two full heating years (Jul-Jun) ending at the last complete June.
METEO_START, METEO_END = "2024-07-01", "2026-06-30"
METEO_YEARS = 2.0
OOKLA_QUARTER = (2026, 3)

# Oblast (ISO 3166-2) -> administrative centre name. Sofia oblast (BG-23) is governed from Sofia.
OBLAST_CENTRE = {
    "BG-01": "Благоевград", "BG-02": "Бургас", "BG-03": "Варна", "BG-04": "Велико Търново",
    "BG-05": "Видин", "BG-06": "Враца", "BG-07": "Габрово", "BG-08": "Добрич",
    "BG-09": "Кърджали", "BG-10": "Кюстендил", "BG-11": "Ловеч", "BG-12": "Монтана",
    "BG-13": "Пазарджик", "BG-14": "Перник", "BG-15": "Плевен", "BG-16": "Пловдив",
    "BG-17": "Разград", "BG-18": "Русе", "BG-19": "Силистра", "BG-20": "Сливен",
    "BG-21": "Смолян", "BG-22": "София", "BG-23": "София", "BG-24": "Стара Загора",
    "BG-25": "Търговище", "BG-26": "Хасково", "BG-27": "Шумен", "BG-28": "Ямбол",
}

# --------------------------------------------------------------------------- OSM categories
FOOD_SHOPS = {"supermarket", "convenience", "general", "grocery", "greengrocer", "bakery",
              "butcher", "deli", "food", "dairy", "frozen_food"}
CULTURE_AMENITY = {"theatre", "cinema", "library", "arts_centre", "community_centre", "concert_hall"}
FOOD_DRINK = {"restaurant", "cafe", "bar", "pub", "fast_food", "biergarten"}
WATER_EXCLUDE = {"wastewater", "sewage", "basin", "pond", "ditch", "drain", "canal",
                 "swimming_pool", "fountain", "reflecting_pool", "fish_pass", "moat",
                 "lock", "treatment"}

POI_CATEGORIES = {
    "school": "училище", "kindergarten": "детска градина", "doctor": "лекар",
    "hospital": "болница", "pharmacy": "аптека", "shop": "магазин (хранителен)",
    "bus_stop": "спирка", "train_station": "гара", "post_office": "поща",
    "vet": "ветеринар", "culture": "култура", "food_drink": "заведения",
}
POLY_CATEGORIES = {"forest": "гора", "water": "вода (реки и езера)", "protected": "защитена зона"}


def poi_categories(t) -> list[str]:
    a, shop, hc = t.get("amenity"), t.get("shop"), t.get("healthcare")
    out = []
    if a == "school":
        out.append("school")
    if a == "kindergarten":
        out.append("kindergarten")
    if a in ("doctors", "clinic") or hc in ("doctor", "clinic", "centre"):
        out.append("doctor")
    if a == "hospital" or hc == "hospital":
        out.append("hospital")
    if a == "pharmacy" or hc == "pharmacy":
        out.append("pharmacy")
    if shop in FOOD_SHOPS:
        out.append("shop")
    if (t.get("highway") == "bus_stop" or a == "bus_station" or t.get("railway") == "tram_stop"
            or (t.get("public_transport") == "platform" and t.get("trolleybus") == "yes")):
        out.append("bus_stop")
    if (t.get("railway") in ("station", "halt") and t.get("station") not in ("subway", "light_rail", "monorail")
            and t.get("subway") != "yes" and t.get("usage") != "tourism"):
        out.append("train_station")
    if a == "post_office":
        out.append("post_office")
    if a == "veterinary":
        out.append("vet")
    if a in CULTURE_AMENITY or t.get("tourism") == "museum":
        out.append("culture")
    if a in FOOD_DRINK:
        out.append("food_drink")
    return out


def poly_category(t, is_line: bool) -> str | None:
    if is_line:
        return "water" if t.get("waterway") == "river" else None
    if t.get("landuse") == "forest" or t.get("natural") == "wood":
        return "forest"
    if (t.get("natural") == "water" and t.get("water") not in WATER_EXCLUDE
            and t.get("leisure") != "swimming_pool") or t.get("waterway") == "riverbank":
        return "water"
    if (t.get("boundary") in ("protected_area", "national_park") or t.get("leisure") == "nature_reserve"):
        return "protected"
    return None


# --------------------------------------------------------------------------- helpers
def log(*a):
    print(*a, file=sys.stderr, flush=True)


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    h = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371.0088 * 2 * np.arcsin(np.sqrt(h))


class Local:
    """Equirectangular projection in metres centred on one settlement (accurate to <0.5% within 40 km)."""

    def __init__(self, lon0, lat0):
        self.lon0, self.lat0 = lon0, lat0
        self.kx = 111_320.0 * math.cos(math.radians(lat0))
        self.ky = 110_574.0

    def xy(self, lon, lat):
        return (np.asarray(lon) - self.lon0) * self.kx, (np.asarray(lat) - self.lat0) * self.ky

    def fwd(self, geom):
        return shapely.transform(geom, lambda c: np.column_stack(((c[:, 0] - self.lon0) * self.kx,
                                                                   (c[:, 1] - self.lat0) * self.ky)))

    def inv(self, geom):
        return shapely.transform(geom, lambda c: np.column_stack((c[:, 0] / self.kx + self.lon0,
                                                                   c[:, 1] / self.ky + self.lat0)))


def parse_pop(v):
    if not v:
        return None
    digits = "".join(ch for ch in v.split(";")[0] if ch.isdigit())
    return int(digits) if digits else None


def http_json(url, cache: Path, tries=6):
    if cache.exists():
        return json.loads(cache.read_text())
    cache.parent.mkdir(parents=True, exist_ok=True)
    wait = 20
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read())
            cache.write_text(json.dumps(data, ensure_ascii=False))
            return data
        except urllib.error.HTTPError as e:
            body = e.read()[:300]
            log(f"  HTTP {e.code} ({body!r}); retry {i + 1}/{tries} in {wait}s")
            if e.code not in (429, 500, 502, 503, 504):
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            log(f"  network error {e}; retry {i + 1}/{tries} in {wait}s")
        time.sleep(wait)
        wait = min(wait * 2, 300)
    raise RuntimeError(f"giving up on {url}")


def cached(path: Path, fn):
    if path.exists():
        return json.loads(path.read_text())
    data = fn()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    return data


# --------------------------------------------------------------------------- 1. places + selection
def read_places():
    log("OSM pass 1: place nodes")
    places = []
    fp = osmium.FileProcessor(str(PBF), osmium.osm.NODE).with_filter(osmium.filter.KeyFilter("place"))
    for n in fp:
        t = n.tags
        if t.get("place") not in ("city", "town", "village"):
            continue
        places.append({
            "osm_id": f"node/{n.id}", "name": t.get("name"), "name_en": t.get("name:en") or t.get("int_name"),
            "place": t["place"], "population_osm": parse_pop(t.get("population")),
            "population_osm_date": t.get("population:date") or t.get("source:population"),
            "ekatte": t.get("ekatte"), "capital": t.get("capital"),
            "lat": round(n.location.lat, 6), "lon": round(n.location.lon, 6),
        })
    return places


def select(places):
    # A place is Bulgarian if it carries an EKATTE code (all BG settlements in OSM do; foreign ones don't).
    bg = [p for p in places if p["ekatte"] and p["name"]]
    urban = sorted((p for p in bg if p["place"] in ("city", "town") and p["population_osm"]),
                   key=lambda p: -p["population_osm"])
    cities = urban[:N_CITIES]
    taken = {p["osm_id"] for p in cities}
    lat = np.array([p["lat"] for p in bg]); lon = np.array([p["lon"] for p in bg])
    out = []
    for rank, c in enumerate(cities, 1):
        c = dict(c, role="city", city_rank=rank, parent_city=c["name"], parent_ekatte=c["ekatte"],
                 km_from_parent=0.0)
        out.append(c)
        d = haversine_km(c["lat"], c["lon"], lat, lon)
        cand = [(d[i], bg[i]) for i in np.argsort(d)
                if SAT_MIN_KM <= d[i] <= SAT_MAX_KM and bg[i]["osm_id"] not in taken]
        picks = []
        # slot 1: nearest small town (if any within range), slot 2+: nearest sizeable village
        town = next((x for x in cand if x[1]["place"] == "town"), None)
        if town:
            picks.append(town)
        for x in cand:
            if len(picks) == 2:
                break
            if x[1]["place"] == "village" and (x[1]["population_osm"] or 0) >= SAT_MIN_POP and x not in picks:
                picks.append(x)
        for x in cand:  # fallback: villages without a population tag
            if len(picks) == 2:
                break
            if x[1]["place"] == "village" and x[1]["population_osm"] is None and x not in picks:
                picks.append(x)
        for dist, p in picks:
            taken.add(p["osm_id"])
            out.append(dict(p, role="nearby", city_rank=rank, parent_city=c["name"],
                            parent_ekatte=c["ekatte"], km_from_parent=round(float(dist), 1)))
    return out


# --------------------------------------------------------------------------- 2. OSM features
def osm_features(sel, places):
    log("OSM pass 2: admin areas, POIs, forests, water, protected areas (several minutes)")
    sel_ekatte = {s["ekatte"] for s in sel}
    sel_pts = shapely.points([[s["lon"], s["lat"]] for s in sel])
    near_tree = shapely.STRtree(shapely.buffer(sel_pts, POLY_SEARCH_KM / 75.0))  # ~deg, generous

    wkb = osmium.geom.WKBFactory()
    oblasts, municipalities, zemlishta = [], [], {}
    pois = defaultdict(list)            # cat -> [(lon, lat, name)]
    polys = []                          # (cat, dedupe key, name|None, geom lon/lat)
    keys = ("boundary", "landuse", "natural", "leisure", "amenity", "shop", "healthcare", "tourism",
            "railway", "highway", "public_transport", "waterway")
    fp = (osmium.FileProcessor(str(PBF))
          .with_locations()
          .with_areas(osmium.filter.KeyFilter("boundary", "landuse", "natural", "leisure", "amenity",
                                              "shop", "healthcare", "tourism", "waterway"))
          .with_filter(osmium.filter.KeyFilter(*keys)))
    n_seen = 0
    for o in fp:
        n_seen += 1
        if n_seen % 500_000 == 0:
            log(f"  ... {n_seen:,} tagged objects")
        t = o.tags
        if o.is_node():
            for cat in poi_categories(t):
                pois[cat].append((o.location.lon, o.location.lat, t.get("name")))
            continue
        if o.is_way():
            if t.get("waterway") == "river" and len(o.nodes) > 1:
                try:
                    g = shapely.from_wkb(wkb.create_linestring(o))
                except Exception:
                    continue
                if near_tree.query(g).size:
                    polys.append(("water", t.get("name") or f"river/{o.id}", t.get("name"), g))
            continue
        if not o.is_area():
            continue
        if t.get("boundary") == "administrative":
            lvl = t.get("admin_level")
            if lvl not in ("4", "5", "8", "9", "10"):
                continue
            try:
                g = shapely.from_wkb(wkb.create_multipolygon(o))
            except Exception:
                continue
            if lvl == "4" and t.get("ISO3166-2", "").startswith("BG-"):
                oblasts.append({"name": t.get("name"), "iso": t["ISO3166-2"], "geom": g})
            elif lvl == "5" and t.get("ekatte"):
                municipalities.append({"name": t.get("name"), "code": t["ekatte"], "geom": g})
            elif lvl in ("8", "9", "10") and t.get("ekatte") in sel_ekatte:
                zemlishta[t["ekatte"]] = g
            continue
        cats = poi_categories(t)
        pc = poly_category(t, False)
        if not cats and not pc:
            continue
        try:
            g = shapely.from_wkb(wkb.create_multipolygon(o))
        except Exception:
            continue
        if cats:
            c = g.representative_point()
            for cat in cats:
                pois[cat].append((c.x, c.y, t.get("name")))
        if pc and near_tree.query(g).size:
            key = t.get("name") or f"{'way' if o.from_way() else 'rel'}/{o.orig_id()}"
            polys.append((pc, key, t.get("name"), g))
    log(f"  POIs: {{{', '.join(f'{k}: {len(v)}' for k, v in pois.items())}}}; polygons near selection: {len(polys)}")
    log(f"  oblasts {len(oblasts)}, municipalities {len(municipalities)}, zemlishta matched {len(zemlishta)}/{len(sel)}")

    # Oblast centres (needed for OSRM): the named centre city, as an OSM place node.
    by_name = defaultdict(list)
    for p in places:
        if p["place"] in ("city", "town") and p["ekatte"]:
            by_name[p["name"]].append(p)
    centres = {}
    for iso, nm in OBLAST_CENTRE.items():
        cands = sorted(by_name.get(nm, []), key=lambda p: -(p["population_osm"] or 0))
        if not cands:
            raise RuntimeError(f"oblast centre {nm} not found")
        centres[iso] = cands[0]

    poly_tree = shapely.STRtree([g for *_, g in polys])
    poi_np = {cat: np.array([(x, y) for x, y, _ in v]) for cat, v in pois.items()}
    poi_names = {cat: [n for _, _, n in v] for cat, v in pois.items()}

    results = {}
    for s in sel:
        pt = Point(s["lon"], s["lat"])
        L = Local(s["lon"], s["lat"])
        r = {}
        ob = next((o for o in oblasts if o["geom"].contains(pt)), None)
        mu = next((m for m in municipalities if m["geom"].contains(pt)), None)
        r["oblast"] = ob["name"] if ob else None
        r["oblast_iso"] = ob["iso"] if ob else None
        r["municipality"] = mu["name"] if mu else None
        r["municipality_code"] = mu["code"] if mu else None

        if s["ekatte"] in zemlishta:
            area_ll = zemlishta[s["ekatte"]]
            area_loc = L.fwd(area_ll)
            r["area_basis"] = "osm_zemlishte"
        else:
            rad = FALLBACK_RADIUS_KM[s["place"]] * 1000
            area_loc = Point(0, 0).buffer(rad, 64)
            area_ll = L.inv(area_loc)
            r["area_basis"] = f"radius_{rad / 1000:g}km"
        r["area_km2"] = round(area_loc.area / 1e6, 2)
        shapely.prepare(area_loc)

        for cat in POI_CATEGORIES:
            arr = poi_np.get(cat)
            if arr is None or not len(arr):
                r[f"{cat}_nearest_km"] = None; r[f"{cat}_count"] = 0
                continue
            x, y = L.xy(arr[:, 0], arr[:, 1])
            d = np.hypot(x, y)
            i = int(np.argmin(d))
            r[f"{cat}_nearest_km"] = round(float(d[i]) / 1000, 2)
            r[f"{cat}_nearest_name"] = poi_names[cat][i]
            inside = shapely.contains_xy(area_loc, x, y)
            if cat == "train_station":   # stations are often mapped twice (node + area): dedupe by name
                names = {poi_names[cat][j] or j for j in np.nonzero(inside)[0]}
                r[f"{cat}_count"] = len(names)
            else:
                r[f"{cat}_count"] = int(inside.sum())

        win = POLY_SEARCH_KM * 1000
        bbox = L.inv(shapely.box(-win, -win, win, win))
        idx = poly_tree.query(bbox)
        by_cat = defaultdict(list)
        for j in idx:
            by_cat[polys[j][0]].append(j)
        for cat in POLY_CATEGORIES:
            js = by_cat.get(cat, [])
            if not js:
                r[f"{cat}_nearest_km"] = None; r[f"{cat}_count"] = 0
                continue
            geoms = L.fwd(np.array([polys[j][3] for j in js]))
            d = shapely.distance(geoms, Point(0, 0))
            k = int(np.argmin(d))
            r[f"{cat}_nearest_km"] = round(float(d[k]) / 1000, 2)
            r[f"{cat}_nearest_name"] = polys[js[k]][2]
            hit = shapely.intersects(geoms, area_loc)
            # Count distinct named features, plus unnamed ones of at least MIN_UNNAMED_HA
            # (so that tiny unnamed ponds / forest fragments do not inflate the count).
            big = shapely.area(geoms) >= MIN_UNNAMED_HA * 10_000
            r[f"{cat}_count"] = len({polys[js[m]][1] for m in np.nonzero(hit)[0]
                                     if polys[js[m]][2] or big[m]})
            if cat == "forest":
                inter = shapely.intersection(geoms[hit], area_loc) if hit.any() else []
                share = shapely.union_all(inter).area / area_loc.area if len(inter) else 0.0
                r["forest_share_pct"] = round(100 * share, 1)
        results[s["ekatte"]] = r
    centres_out = {iso: {"name": c["name"], "ekatte": c["ekatte"], "lat": c["lat"], "lon": c["lon"]}
                   for iso, c in centres.items()}
    areas_ll = {}
    for s in sel:  # keep settlement areas (lon/lat WKT) for the Ookla step
        r = results[s["ekatte"]]
        L = Local(s["lon"], s["lat"])
        if r["area_basis"] == "osm_zemlishte":
            areas_ll[s["ekatte"]] = shapely.to_wkt(zemlishta[s["ekatte"]], rounding_precision=6)
        else:
            rad = float(r["area_basis"].split("_")[1][:-2]) * 1000
            areas_ll[s["ekatte"]] = shapely.to_wkt(L.inv(Point(0, 0).buffer(rad, 64)), rounding_precision=6)
    return {"settlements": results, "oblast_centres": centres_out, "areas_wkt": areas_ll,
            "poi_totals": {k: len(v) for k, v in pois.items()}}


# --------------------------------------------------------------------------- 3. Open-Meteo
def meteo(sel):
    raw = RAW / "open-meteo" / RUN_DATE
    lats = ",".join(str(s["lat"]) for s in sel); lons = ",".join(str(s["lon"]) for s in sel)
    elev = http_json(f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}",
                     raw / "elevation.json")["elevation"]
    out = {}
    batch = 5
    for b in range(0, len(sel), batch):
        chunk = sel[b:b + batch]
        q = urllib.parse.urlencode({
            "latitude": ",".join(str(s["lat"]) for s in chunk),
            "longitude": ",".join(str(s["lon"]) for s in chunk),
            "start_date": METEO_START, "end_date": METEO_END,
            "daily": "temperature_2m_mean", "timezone": "Europe/Sofia",
        })
        cache = raw / f"archive_{b:03d}.json"
        fresh = not cache.exists()
        log(f"  Open-Meteo archive batch {b // batch + 1}/{math.ceil(len(sel) / batch)}{'' if fresh else ' (cached)'}")
        data = http_json(f"https://archive-api.open-meteo.com/v1/archive?{q}", cache)
        if isinstance(data, dict):
            data = [data]
        for s, d in zip(chunk, data):
            days = d["daily"]["time"]; tm = d["daily"]["temperature_2m_mean"]
            vals = [(dd, t) for dd, t in zip(days, tm) if t is not None]
            hdd = sum(18 - t for _, t in vals if t <= 15)          # Eurostat HDD definition
            cdd = sum(t - 21 for _, t in vals if t >= 24)          # Eurostat CDD definition
            jan = [t for dd, t in vals if dd[5:7] == "01"]
            out[s["ekatte"]] = {
                "hdd_per_year": round(hdd / METEO_YEARS), "cdd_per_year": round(cdd / METEO_YEARS),
                "jan_mean_temp_c": round(sum(jan) / len(jan), 1) if jan else None,
                "meteo_days": len(vals), "meteo_grid_elevation_m": d.get("elevation"),
            }
        if fresh:
            time.sleep(25)  # stay under Open-Meteo's free-tier per-minute weight
    for s, e in zip(sel, elev):
        out[s["ekatte"]]["elevation_m"] = round(e) if e is not None else None
    return out


# --------------------------------------------------------------------------- 4. Ookla
def ookla(sel, areas_wkt):
    import duckdb
    y, q = OOKLA_QUARTER
    raw = RAW / "ookla" / RUN_DATE
    raw.mkdir(parents=True, exist_ok=True)
    month = {1: "01", 2: "04", 3: "07", 4: "10"}[q]
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    tiles = {}
    for kind in ("fixed", "mobile"):
        local = raw / f"{kind}_{y}q{q}_bg.parquet"
        if not local.exists():
            url = (f"https://ookla-open-data.s3.amazonaws.com/parquet/performance/type={kind}/"
                   f"year={y}/quarter={q}/{y}-{month}-01_performance_{kind}_tiles.parquet")
            log(f"  Ookla {kind}: extracting Bulgaria bbox from {url}")
            con.execute(f"""COPY (SELECT quadkey, tile_x, tile_y, avg_d_kbps, avg_u_kbps, avg_lat_ms, tests, devices
                                  FROM read_parquet('{url}')
                                  WHERE tile_x BETWEEN 22.3 AND 28.7 AND tile_y BETWEEN 41.2 AND 44.3)
                            TO '{local}' (FORMAT parquet)""")
        tiles[kind] = np.array(con.execute(
            f"SELECT tile_x, tile_y, avg_d_kbps, avg_u_kbps, avg_lat_ms, tests FROM read_parquet('{local}')").fetchall(),
            dtype=float)
    out = {}
    for s in sel:
        area = shapely.from_wkt(areas_wkt[s["ekatte"]])
        r = {}
        for kind, a in tiles.items():
            inside = shapely.contains_xy(area, a[:, 0], a[:, 1])
            basis = "settlement_area"
            if inside.sum() == 0:  # no tests inside: use tiles within 3 km of the centre
                inside = haversine_km(s["lat"], s["lon"], a[:, 1], a[:, 0]) <= 3.0
                basis = "within_3km"
            sub = a[inside]
            if not len(sub):
                r.update({f"{kind}_down_mbps": None, f"{kind}_up_mbps": None, f"{kind}_latency_ms": None,
                          f"{kind}_tests": 0, f"{kind}_basis": "no_data"})
                continue
            w = sub[:, 5]
            r[f"{kind}_down_mbps"] = round(float((sub[:, 2] * w).sum() / w.sum()) / 1000, 1)
            r[f"{kind}_up_mbps"] = round(float((sub[:, 3] * w).sum() / w.sum()) / 1000, 1)
            r[f"{kind}_latency_ms"] = round(float((sub[:, 4] * w).sum() / w.sum()))
            r[f"{kind}_tests"] = int(w.sum())
            r[f"{kind}_basis"] = basis
        out[s["ekatte"]] = r
    return out


# --------------------------------------------------------------------------- 5. OSRM
def osrm(sel, centres):
    raw = RAW / "osrm" / RUN_DATE
    cen = sorted({c["ekatte"]: c for c in centres.values()}.values(), key=lambda c: c["name"])
    out = {s["ekatte"]: {} for s in sel}
    step = 20
    for b in range(0, len(sel), step):
        chunk = sel[b:b + step]
        coords = ";".join(f"{p['lon']},{p['lat']}" for p in chunk + cen)
        src = ";".join(str(i) for i in range(len(chunk)))
        dst = ";".join(str(len(chunk) + i) for i in range(len(cen)))
        url = (f"https://router.project-osrm.org/table/v1/driving/{coords}"
               f"?sources={src}&destinations={dst}&annotations=duration,distance")
        log(f"  OSRM table {b // step + 1}/{math.ceil(len(sel) / step)}")
        data = http_json(url, raw / f"table_{b:03d}.json")
        if data.get("code") != "Ok":
            raise RuntimeError(data)
        for i, s in enumerate(chunk):
            for j, c in enumerate(cen):
                dur, dist = data["durations"][i][j], data["distances"][i][j]
                same = s["ekatte"] == c["ekatte"]
                out[s["ekatte"]][c["ekatte"]] = {
                    "centre": c["name"],
                    "minutes": 0 if same else (round(dur / 60) if dur is not None else None),
                    "km": 0.0 if same else (round(dist / 1000, 1) if dist is not None else None),
                }
        time.sleep(2)
    return out, cen


# --------------------------------------------------------------------------- 6. manual population
def manual_population():
    f = MANUAL / "population.csv"
    if not f.exists():
        return {}, []
    rows = list(csv.DictReader(f.open(encoding="utf-8")))
    by = defaultdict(dict)
    years = set()
    for r in rows:
        if not r.get("ekatte") or not r.get("population"):
            continue
        by[r["ekatte"].strip().zfill(5)][r["year"].strip()] = int(r["population"])
        years.add(r["year"].strip())
    return by, sorted(years)


# --------------------------------------------------------------------------- assemble
def main():
    INTERIM.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    places = cached(INTERIM / "osm_places.json", read_places)
    sel = cached(INTERIM / "selection.json", lambda: select(places))
    log(f"selected {len(sel)} settlements ({sum(s['role'] == 'city' for s in sel)} cities)")
    feats = cached(INTERIM / "osm_features.json", lambda: osm_features(sel, places))
    met = cached(INTERIM / "meteo.json", lambda: meteo(sel))
    ook = cached(INTERIM / "ookla.json", lambda: ookla(sel, feats["areas_wkt"]))
    drive = cached(INTERIM / "osrm.json", lambda: osrm(sel, feats["oblast_centres"])[0])
    pop_manual, pop_years = manual_population()

    sofia = next(s for s in sel if s["name"] == "София" and s["role"] == "city")
    sofia_hdd = met[sofia["ekatte"]]["hdd_per_year"]

    rows, drive_rows = [], []
    for s in sel:
        e = s["ekatte"]
        f = feats["settlements"][e]
        m = met[e]
        own_centre = OBLAST_CENTRE.get(f["oblast_iso"])
        centre_e = feats["oblast_centres"][f["oblast_iso"]]["ekatte"] if f["oblast_iso"] else None
        dc = drive[e].get(centre_e, {}) if centre_e else {}
        row = {
            "ekatte": e, "name": s["name"], "name_en": s["name_en"],
            "type": {"city": "град", "town": "град", "village": "село"}[s["place"]],
            "osm_place": s["place"], "role": s["role"], "city_rank": s["city_rank"],
            "parent_city": s["parent_city"], "km_from_parent": s["km_from_parent"],
            "oblast": f["oblast"], "oblast_iso": f["oblast_iso"],
            "municipality": f["municipality"], "municipality_code": f["municipality_code"],
            "population_osm": s["population_osm"], "population_osm_date": s["population_osm_date"],
            "lat": s["lat"], "lon": s["lon"], "osm_id": s["osm_id"],
            "area_basis": f["area_basis"], "area_km2": f["area_km2"],
        }
        for cat in list(POI_CATEGORIES) + list(POLY_CATEGORIES):
            row[f"{cat}_nearest_km"] = f.get(f"{cat}_nearest_km")
            row[f"{cat}_count"] = f.get(f"{cat}_count")
        row["forest_share_pct"] = f.get("forest_share_pct", 0.0)
        row.update({
            "elevation_m": m["elevation_m"], "hdd_per_year": m["hdd_per_year"],
            "cdd_per_year": m["cdd_per_year"], "jan_mean_temp_c": m["jan_mean_temp_c"],
            "heating_vs_sofia_pct": round(100 * m["hdd_per_year"] / sofia_hdd) if sofia_hdd else None,
        })
        o = ook[e]
        for kind in ("fixed", "mobile"):
            for k in ("down_mbps", "up_mbps", "latency_ms", "tests", "basis"):
                row[f"internet_{kind}_{k}"] = o.get(f"{kind}_{k}")
        row.update({"oblast_centre": own_centre, "drive_min_to_oblast_centre": dc.get("minutes"),
                    "drive_km_to_oblast_centre": dc.get("km")})
        for y in pop_years:
            row[f"population_{y}"] = pop_manual.get(e, {}).get(y)
        rows.append(row)
        for ce, d in drive[e].items():
            drive_rows.append({"ekatte": e, "name": s["name"], "centre_ekatte": ce, "centre": d["centre"],
                               "drive_min": d["minutes"], "drive_km": d["km"]})

    with (OUT / "settlements.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    with (OUT / "drive_to_oblast_centres.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(drive_rows[0])); w.writeheader(); w.writerows(drive_rows)
    js = []
    for r in rows:
        j = dict(r)
        j["drive_to_oblast_centres"] = {d["centre"]: {"min": d["minutes"], "km": d["km"]}
                                        for d in drive[r["ekatte"]].values()}
        js.append(j)
    (OUT / "settlements.json").write_text(json.dumps(
        {"generated": str(date.today()), "snapshot": RUN_DATE, "settlements": js}, ensure_ascii=False, indent=1))

    # run report
    lines = [f"# Run report — {RUN_DATE}", "",
             f"- Settlements: {len(rows)} ({sum(r['role'] == 'city' for r in rows)} cities, "
             f"{sum(r['role'] == 'nearby' for r in rows)} nearby)",
             f"- Area basis: {sum(r['area_basis'] == 'osm_zemlishte' for r in rows)} OSM землище, "
             f"{sum(r['area_basis'] != 'osm_zemlishte' for r in rows)} radius fallback",
             f"- Manual population years: {', '.join(pop_years) or 'none (data/manual/population.csv empty)'}",
             f"- OSM POI totals (Bulgaria): {feats['poi_totals']}", "", "## Missing values per column", ""]
    for k in rows[0]:
        miss = sum(r[k] is None for r in rows)
        if miss:
            lines.append(f"- `{k}`: {miss}")
    lines += ["", "## Ookla fallbacks", ""]
    for r in rows:
        for kind in ("fixed", "mobile"):
            if r[f"internet_{kind}_basis"] != "settlement_area":
                lines.append(f"- {r['name']} ({kind}): {r[f'internet_{kind}_basis']}")
    (OUT / "run_report.md").write_text("\n".join(lines) + "\n")
    log(f"wrote {OUT / 'settlements.csv'} ({len(rows)} rows, {len(rows[0])} columns)")


if __name__ == "__main__":
    main()
