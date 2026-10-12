import { Router } from "express";
import { listLicenses } from "../lib/licenses.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(listLicenses());
});

export default router;
