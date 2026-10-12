import { Router } from "express";
import { getDB, USERNAME_COLLATION } from "../db/connection.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";

const router = Router();

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const LOGIN_FAILED = "Wrong username or password. Check both and try again.";

function readCredentials(body) {
  return {
    username: typeof body?.username === "string" ? body.username.trim() : "",
    password: typeof body?.password === "string" ? body.password : "",
  };
}

router.post("/signup", async (req, res) => {
  const { username, password } = readCredentials(req.body);

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      error:
        "Usernames must be 3 to 30 characters: letters, numbers, dots, dashes, or underscores.",
    });
  }
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return res.status(400).json({
      error: `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  const { passwordHash, salt } = await hashPassword(password);

  try {
    const result = await getDB()
      .collection("users")
      .insertOne({ username, passwordHash, salt, createdAt: new Date() });
    res.status(201).json({ userId: result.insertedId.toString(), username });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "That username is taken. Try another one." });
    }
    throw err;
  }
});

router.post("/login", async (req, res, next) => {
  const { username, password } = readCredentials(req.body);

  const user =
    username && password
      ? await getDB()
          .collection("users")
          .findOne({ username }, { collation: USERNAME_COLLATION })
      : null;

  if (!user || !(await verifyPassword(password, user))) {
    return res.status(401).json({ error: LOGIN_FAILED });
  }

  // New session ID on login prevents session fixation.
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    res.json({ userId: req.session.userId, username: user.username });
  });
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  res.json({ userId: req.session.userId, username: req.session.username });
});

export default router;
