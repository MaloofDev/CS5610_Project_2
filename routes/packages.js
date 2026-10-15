import { Router } from "express";
import { getDB } from "../db/connection.js";
import { filterOptions } from "mongodb/src/utils.js";

const router = Router();

const packages = () => getDB().collection("packages");

router.get("/", async (req, res) => {
  const search = (req.query.search || "").trim();
  const page = req.query.page || 1;
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

// router.post("/", async (req, res) => {});

export default router;
