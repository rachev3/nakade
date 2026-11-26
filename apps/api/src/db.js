// Loads the engine input from MongoDB: the 90 pilot settlements written by data/pipeline/seed-mongo.mjs.
import { MongoClient } from "mongodb";

export async function loadSettlements({ uri = process.env.MONGODB_URI, db = process.env.MONGODB_DB ?? "nakade" } = {}) {
  if (!uri) throw new Error("MONGODB_URI is not set (see data/pipeline/env.example)");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    return await client.db(db).collection("settlements").find({}).toArray();
  } finally {
    await client.close();
  }
}
