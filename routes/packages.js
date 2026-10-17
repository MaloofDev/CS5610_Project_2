import { Router } from "express";
import { getDB } from "../db/connection.js";
import { ObjectId } from "mongodb";
import { requireLogin } from "../middleware/requireLogin.js";

const router = Router();

const packages = () => getDB().collection("packages");
const trimValue = (value) => (typeof value === "string" ? value.trim() : "");

// Get package details to display on browse page - 6 at a time
router.get("/", async (req, res) => {
  const search = (req.query.search || "").trim();
  let page = req.query.page || 1;
  if (page < 1) page = 1;
  const limit = 6;
  const ecosystem = req.query.ecosystem || "";
  const tags = req.query.tag || "";
  const licenseType = req.query.licenseType || "";
  const filter = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (ecosystem) filter.ecosystem = ecosystem;
  if (tags) filter.tags = tags;
  if (licenseType) filter.licenseType = licenseType;
  const list = await packages()
    .find(filter)
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
  const totalDocs = await getDB().collection("packages").countDocuments(filter);
  const totalPages = Math.ceil(totalDocs / limit);
  res.json({ items: list, page, totalDocs, totalPages });
});

// Get package details to display on detail page
router.get("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "The package was not found!" });
  }
  const packageId = new ObjectId(req.params.id);
  const filter = {};
  filter._id = packageId;
  const packageInfo = await packages().findOne(filter);
  if (!packageInfo) {
    return res.status(404).json({ error: "The package was not found!" });
  }
  res.json(packageInfo);
});

// Create a new package
router.post("/", requireLogin, async (req, res) => {
  const name = trimValue(req.body.name);
  const ecosystem = trimValue(req.body.ecosystem);
  const license = trimValue(req.body.license);
  const licenseType = trimValue(req.body.licenseType);
  const version = trimValue(req.body.version);
  const homepage = trimValue(req.body.homepage);
  const repository = trimValue(req.body.repository);
  const tags = trimValue(req.body.tags);
  const description = trimValue(req.body.description);
  const entry = {};
  if (!name) {
    return res.status(400).json({ error: "The name is required!" });
  } else {
    entry.name = name;
  }

  if (!ecosystem) {
    return res.status(400).json({ error: "The ecosystem is required!" });
  } else {
    entry.ecosystem = ecosystem;
  }

  if (!license) {
    return res.status(400).json({ error: "The license is required!" });
  } else {
    entry.license = license;
  }

  if (!licenseType) {
    return res.status(400).json({ error: "The license type is required!" });
  } else {
    entry.licenseType = licenseType;
  }

  entry.version = version;
  entry.homepage = homepage;
  entry.repository = repository;
  entry.tags = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  entry.description = description;
  entry.ownerId = req.userId;

  const { insertedId } = await packages().insertOne(entry);
  res.status(201).json({ _id: insertedId });
});

// Edit a package detail
router.patch("/:id", requireLogin, async (req, res) => {
  // Verifies this id is valid against node_modules/mongodb/ ObjectId.isValid function
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "The package was not found!" });
  }

  // Convert package id into an object for mongo comparison
  const packageId = new ObjectId(req.params.id);

  // check to see if the package exists
  const packageExists = await packages().findOne({ _id: req.packageId });
  if (!packageExists) {
    return res.status(404).json({ error: "The package was not found!" });
  }

  // Verify the user owns the package
  if (!packages.ownerId?.equals(req.userId)) {
    res.status(403).json({
      error: "You cannot delete a package that does not belong to you!",
    });
    return;
  }

  const updates = {};

  // If all are true delete package
  await packages().updateOne({ $set: updates }, { returnDocument: "after" });
  res.status(204).end();
});

// Delete a package you own in the system
router.delete("/:id", requireLogin, async (req, res) => {
  // Verifies this id is valid against node_modules/mongodb/ ObjectId.isValid function
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "The package was not found!" });
  }

  // Convert package id into an object for mongo comparison
  const packageId = new ObjectId(req.params.id);

  // check to see if the package exists
  const packageExists = await packages().findOne({ _id: req.packageId });
  if (!packageExists) {
    return res.status(404).json({ error: "The package was not found!" });
  }

  // Verify the user owns the package
  if (!packages.ownerId?.equals(req.userId)) {
    res.status(403).json({
      error: "You cannot delete a package that does not belong to you!",
    });
    return;
  }

  // If all are true delete package
  await packages().deleteOne({ _id: packageId });
  res.status(204).end();
});

export default router;
