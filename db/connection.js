import { MongoClient } from "mongodb";

let client;
let db;

// Case-insensitive, so "Priya" and "priya" are the same account.
export const USERNAME_COLLATION = { locale: "en", strength: 2 };

/**
 * Connects once and returns the shared database handle.
 * @returns {Promise<import('mongodb').Db>}
 */
export async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.DB_NAME || "licenselens";

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  await db
    .collection("users")
    .createIndex(
      { username: 1 },
      { unique: true, collation: USERNAME_COLLATION }
    );
  await db.collection("reports").createIndex({ ownerId: 1, updatedAt: -1 });

  console.log(`Connected to MongoDB database "${dbName}"`);
  return db;
}

/**
 * Returns the database handle. Throws if connectDB() hasn't run yet.
 * @returns {import('mongodb').Db}
 */
export function getDB() {
  if (!db) throw new Error("Database not connected. Call connectDB() first.");
  return db;
}

export async function closeDB() {
  await client?.close();
  client = undefined;
  db = undefined;
}
