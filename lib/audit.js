import { getLicenseInfo } from "./licenses.js";
import { evaluateLicense, STATUS_COLORS } from "./licenseRules.js";

const MAX_ALTERNATIVES = 3;

/**
 * Checks each dependency against the packages collection. Read-only.
 * @param {import('mongodb').Db} db
 * @param {{ ecosystem: string, goal: object, dependencies: { name: string, version: string }[] }} audit
 * @returns {Promise<{ results: object[], summary: { green: number, yellow: number, red: number } }>}
 */
export async function runAudit(db, { ecosystem, goal, dependencies }) {
  const packages = db.collection("packages");
  const found = await findPackages(packages, ecosystem, dependencies);

  const results = await Promise.all(
    dependencies.map(async ({ name, version }) => {
      const pkg = found.get(lookupKey(ecosystem, name));
      if (!pkg) {
        return {
          name,
          version,
          packageId: null,
          license: null,
          status: "review",
          reason: "Not in the database yet, so its license can't be checked.",
          alternatives: [],
        };
      }

      const { status, reason } = evaluateLicense(pkg.license, goal);
      const alternatives =
        status === "conflict"
          ? await findAlternatives(packages, pkg, goal)
          : [];
      return {
        name,
        version,
        packageId: pkg._id,
        license: getLicenseInfo(pkg.license).id,
        status,
        reason,
        alternatives,
      };
    })
  );

  const summary = { green: 0, yellow: 0, red: 0 };
  for (const row of results) summary[STATUS_COLORS[row.status]] += 1;
  return { results, summary };
}

// Names match case-insensitively, and PyPI also treats "-", "_" and "." as the same.
function lookupKey(ecosystem, name) {
  const key = name.toLowerCase();
  return ecosystem.toLowerCase() === "pypi" ? key.replace(/[-_.]+/g, "-") : key;
}

async function findPackages(packages, ecosystem, dependencies) {
  const isPyPI = ecosystem.toLowerCase() === "pypi";
  const names = dependencies.map(({ name }) => {
    const pattern = isPyPI
      ? name
          .split(/[-_.]+/)
          .map(escapeRegExp)
          .join("[-_.]+")
      : escapeRegExp(name);
    return new RegExp(`^${pattern}$`, "i");
  });

  const docs = await packages
    .find({
      ecosystem: new RegExp(`^${escapeRegExp(ecosystem)}$`, "i"),
      name: { $in: names },
    })
    .toArray();

  // Seeded records win over user-added copies of the same package.
  const byKey = new Map();
  for (const doc of docs) {
    const key = lookupKey(ecosystem, doc.name);
    if (!byKey.has(key) || doc.ownerId === null) byKey.set(key, doc);
  }
  return byKey;
}

async function findAlternatives(packages, pkg, goal) {
  if (!pkg.tags?.length) return [];

  const candidates = await packages
    .find(
      {
        _id: { $ne: pkg._id },
        ecosystem: pkg.ecosystem,
        licenseType: "permissive",
        tags: { $in: pkg.tags },
      },
      { sort: { _id: 1 } }
    )
    .toArray();

  // Rarer shared tags count for more, so "mysql" outweighs "database".
  const tagCounts = new Map();
  for (const tag of candidates.flatMap((c) => c.tags)) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const score = (candidate) =>
    candidate.tags
      .filter((tag) => pkg.tags.includes(tag))
      .reduce((total, tag) => total + 1 / tagCounts.get(tag), 0);

  return candidates
    .filter((c) => evaluateLicense(c.license, goal).status === "ok")
    .sort((a, b) => score(b) - score(a))
    .slice(0, MAX_ALTERNATIVES)
    .map((c) => ({
      packageId: c._id,
      name: c.name,
      license: getLicenseInfo(c.license).id,
    }));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
