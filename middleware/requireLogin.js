import { ObjectId } from "mongodb";

/**
 * Responds 401 unless logged in. Otherwise sets req.userId (an ObjectId) for ownerId checks.
 * @type {import('express').RequestHandler}
 */
export function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "You need to log in first." });
  }
  req.userId = new ObjectId(req.session.userId);
  next();
}
