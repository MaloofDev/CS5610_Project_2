// Safe to re-run: seeded packages update in place (keeping their _ids), and user-added packages are untouched.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { closeDB, connectDB, USERNAME_COLLATION } from "../db/connection.js";
import { getLicenseInfo } from "../lib/licenses.js";
import { hashPassword } from "../lib/passwords.js";

const packages = JSON.parse(
  await readFile(new URL("./packages.json", import.meta.url), "utf8")
);

async function seedPackages(db) {
  const collection = db.collection("packages");
  await collection.createIndex({ name: 1, ecosystem: 1 });

  const operations = packages.map((pkg) => {
    const doc = {
      name: pkg.name,
      ecosystem: pkg.ecosystem,
      version: pkg.version,
      license: pkg.license,
      // Recomputed so edits to licenses.json apply without re-fetching.
      licenseType: getLicenseInfo(pkg.license).type,
      description: pkg.description,
      homepage: pkg.homepage,
      repository: pkg.repository,
      tags: pkg.tags,
      ownerId: null,
    };
    return {
      updateOne: {
        filter: { name: doc.name, ecosystem: doc.ecosystem, ownerId: null },
        update: { $set: doc },
        upsert: true,
      },
    };
  });

  const result = await collection.bulkWrite(operations, { ordered: false });
  console.log(
    `Seeded ${packages.length} packages: ${result.upsertedCount} added, ${result.modifiedCount} updated.`
  );
}

// Re-seeding resets the admin password to ADMIN_PASSWORD.
async function seedAdmin(db) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.warn(
      "Skipped admin user: set ADMIN_PASSWORD (8+ characters) in .env."
    );
    return;
  }

  const { passwordHash, salt } = await hashPassword(password);
  const result = await db.collection("users").updateOne(
    { username },
    {
      $set: { passwordHash, salt, isAdmin: true },
      $setOnInsert: { username, createdAt: new Date() },
    },
    { upsert: true, collation: USERNAME_COLLATION }
  );
  console.log(
    `Admin user "${username}" ${result.upsertedCount ? "created" : "updated"}.`
  );
}

try {
  const db = await connectDB();
  await seedPackages(db);
  await seedAdmin(db);
} finally {
  await closeDB();
}
