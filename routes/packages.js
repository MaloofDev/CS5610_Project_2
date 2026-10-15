import { Router } from "express";
import { getDB } from "../db/connection.js";

const router = Router();

const packages = () => getDB().collection("packages");

router.get("/", async (req, res) => {
  const ecosystem = req.query.ecosystem || "";
  const tags = req.query.tag || "";
  const licenseType = req.query.licensetype || "";
  const filter = {};
  if (ecosystem) filter.ecosystem = ecosystem;
  if (tags) filter.tags = tags;
  if (licenseType) filter.licenseType = licenseType;
  const list = await packages().find(filter).limit(6).toArray();
  res.json(list);
});

router.post("/", async (req, res) => {});

export default router;
