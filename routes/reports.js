import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";
import { runAudit } from "../lib/audit.js";
import { getLicenseInfo } from "../lib/licenses.js";
import { GOAL_TYPES } from "../lib/licenseRules.js";
import { INPUT_TYPES, parseDependencies } from "../lib/parsers.js";
import { requireLogin } from "../middleware/requireLogin.js";

const router = Router();
router.use(requireLogin);

const MAX_NAME_LENGTH = 100;
const MAX_INPUT_LENGTH = 50_000;
const NAME_ERROR = `Give the report a name up to ${MAX_NAME_LENGTH} characters.`;
// Every input type except a plain list implies its ecosystem.
const INPUT_ECOSYSTEMS = { "package.json": "npm", "requirements.txt": "PyPI" };

const reports = () => getDB().collection("reports");
const trimmed = (value) => (typeof value === "string" ? value.trim() : "");

function readName(value) {
  const name = trimmed(value);
  return name && name.length <= MAX_NAME_LENGTH ? name : null;
}

/** Validates a new audit. Returns { error } or { audit }. */
function readAudit(body = {}) {
  const name = readName(body.name);
  if (!name) return { error: NAME_ERROR };

  const { inputType, goal } = body;
  if (!INPUT_TYPES.includes(inputType)) {
    return { error: "Choose package.json, requirements.txt, or Plain list." };
  }

  const ecosystem = INPUT_ECOSYSTEMS[inputType] ?? trimmed(body.ecosystem);
  if (!ecosystem || ecosystem.length > 40) {
    return { error: "Enter the ecosystem for your list, like npm or Cargo." };
  }

  if (!GOAL_TYPES.includes(goal?.type)) {
    return { error: "Choose a closed-source or open-source goal." };
  }
  const goalLicense = getLicenseInfo(goal.license);
  if (goal.type === "open-source" && goalLicense.type === "unknown") {
    return { error: "Choose the open-source license your project uses." };
  }

  const input = trimmed(body.input);
  if (!input) return { error: "Paste your dependencies first." };
  if (input.length > MAX_INPUT_LENGTH) {
    return { error: "That input is too long. Split it into smaller audits." };
  }

  return {
    audit: {
      name,
      inputType,
      ecosystem,
      goal:
        goal.type === "open-source"
          ? { type: goal.type, license: goalLicense.id }
          : { type: goal.type },
      input,
    },
  };
}

// Parser errors are written for users, so they go back as 400s.
async function check(res, { inputType, ecosystem, goal, input }) {
  let dependencies;
  try {
    dependencies = parseDependencies(inputType, input);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return null;
  }
  return runAudit(getDB(), { ecosystem, goal, dependencies });
}

/** Sends 404 or 403 and returns null unless the report belongs to the user. */
async function findOwnReport(req, res) {
  const id = ObjectId.isValid(req.params.id)
    ? new ObjectId(req.params.id)
    : null;
  const report = id && (await reports().findOne({ _id: id }));
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return null;
  }
  if (!report.ownerId?.equals(req.userId)) {
    res.status(403).json({ error: "That report belongs to someone else." });
    return null;
  }
  return report;
}

router.get("/", async (req, res) => {
  const list = await reports()
    .find(
      { ownerId: req.userId },
      { projection: { input: 0, results: 0 }, sort: { updatedAt: -1 } }
    )
    .toArray();
  res.json(list);
});

router.post("/", async (req, res) => {
  const { audit, error } = readAudit(req.body);
  if (error) return res.status(400).json({ error });

  const outcome = await check(res, audit);
  if (!outcome) return;

  const now = new Date();
  const { insertedId } = await reports().insertOne({
    ownerId: req.userId,
    ...audit,
    ...outcome,
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ _id: insertedId });
});

router.get("/:id", async (req, res) => {
  const report = await findOwnReport(req, res);
  if (report) res.json(report);
});

router.patch("/:id", async (req, res) => {
  const report = await findOwnReport(req, res);
  if (!report) return;

  const name = readName(req.body?.name);
  if (!name) return res.status(400).json({ error: NAME_ERROR });

  const updated = await reports().findOneAndUpdate(
    { _id: report._id },
    { $set: { name, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  res.json(updated);
});

// Re-checks the saved input against the current package database.
router.post("/:id/rerun", async (req, res) => {
  const report = await findOwnReport(req, res);
  if (!report) return;

  const outcome = await check(res, report);
  if (!outcome) return;

  const updated = await reports().findOneAndUpdate(
    { _id: report._id },
    { $set: { ...outcome, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const report = await findOwnReport(req, res);
  if (!report) return;

  await reports().deleteOne({ _id: report._id });
  res.status(204).end();
});

export default router;
