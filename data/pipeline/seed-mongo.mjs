// Seed MongoDB with the 90 pilot settlements (data/processed/settlements_enriched.json).
// The database holds only these 90 places; everything else (census, labour, listings, OSM, ...)
// is folded into their facts by enrich-settlements.mjs.
//
// Usage (from data/pipeline):
//   npm install
//   npm run enrich        # rebuild data/processed/settlements_enriched.json (needs csv/)
//   npm run seed          # MONGODB_URI / MONGODB_DB from .env (see env.example)
//   npm run seed:dry      # show what would be written
//
// Every run re-creates `settlements` and drops the collections listed in OBSOLETE, so it is safe to re-run.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { MongoClient } from "mongodb";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENRICHED = join(ROOT, "data", "processed", "settlements_enriched.json");

// Collections written by earlier versions of this script; removed so the DB holds only the 90 places.
const OBSOLETE = ["origins", "places", "census", "labour", "listings", "property_clusters", "osm_places"];

const { values: args } = parseArgs({
  options: {
    uri: { type: "string", default: process.env.MONGODB_URI ?? "mongodb://localhost:27017" },
    db: { type: "string", default: process.env.MONGODB_DB ?? "nakade" },
    "dry-run": { type: "boolean", default: false },
  },
});

if (!existsSync(ENRICHED)) {
  console.error(`Missing ${ENRICHED}. Run: npm run enrich`);
  process.exit(1);
}

const importedAt = new Date();
const { settlements } = JSON.parse(readFileSync(ENRICHED, "utf8"));
const docs = settlements.map((s) => ({
  _id: s.ekatte,
  ...s,
  location: { type: "Point", coordinates: [s.lon, s.lat] },
  imported_at: importedAt,
}));

if (args["dry-run"]) {
  console.log(`Dry run: would write ${docs.length} settlements and drop ${OBSOLETE.join(", ")}.`);
  process.exit(0);
}

const client = new MongoClient(args.uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(args.db);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  const coll = db.collection("settlements");
  if (existing.has("settlements")) await coll.drop();
  await coll.insertMany(docs);
  await coll.createIndex({ location: "2dsphere" });
  await coll.createIndex({ role: 1, type: 1 });
  await coll.createIndex({ parent_town_ekatte: 1 });
  console.log(`settlements: ${docs.length} docs`);

  for (const name of OBSOLETE.filter((n) => existing.has(n))) {
    await db.collection(name).drop();
    console.log(`dropped: ${name}`);
  }
  console.log("Done.");
} catch (err) {
  console.error(`Seed failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
