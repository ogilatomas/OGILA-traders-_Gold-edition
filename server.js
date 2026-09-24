const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true }
}));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_req, res) => {
  res.json({
    appName: "OGILA TRADERS",
    derivOAuthConfigured: Boolean(process.env.DERIV_CLIENT_ID),
    mode: "demo",
    message: "Set DERIV_CLIENT_ID and DERIV_REDIRECT_URI to enable your Deriv OAuth integration."
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "OGILA TRADERS" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`OGILA TRADERS running on port ${PORT}`);
});