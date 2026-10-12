import "dotenv/config";
import express from "express";
import session from "express-session";
import { fileURLToPath } from "node:url";
import { connectDB } from "./db/connection.js";
import authRouter from "./routes/auth.js";
import licensesRouter from "./routes/licenses.js";
import reportsRouter from "./routes/reports.js";

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
  console.error(
    "SESSION_SECRET is not set. Copy .env.example to .env and fill it in."
  );
  process.exit(1);
}

const app = express();

// Hosts terminate HTTPS at a proxy; trusting it lets secure cookies work.
if (isProduction) app.set("trust proxy", 1);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));

app.use("/api/auth", authRouter);
app.use("/api/licenses", licensesRouter);
// Mount /api/packages here.
app.use("/api/reports", reportsRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status < 500 ? err.message : "Something went wrong on the server.",
  });
});

await connectDB();
app.listen(PORT, () => {
  console.log(`LicenseLens running at http://localhost:${PORT}`);
});
