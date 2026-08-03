const express = require("express");

const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    environment: process.env.APP_ENV || "development",
    version: process.env.APP_VERSION || "unknown",
    timestamp: new Date().toISOString()
  });
});

app.get("/api", (req, res) => {
  res.status(200).json({
    message: "API deployed through Jenkins to Amazon EKS",
    environment: process.env.APP_ENV || "development",
    secretConfigured: Boolean(process.env.DEMO_SECRET)
  });
});

/*
 * Bounded CPU workload used only for demonstrating HPA.
 * Maximum duration is capped to avoid an uncontrolled busy loop.
 */
app.get("/api/work", (req, res) => {
  const requestedMs = Number(req.query.ms || 100);
  const durationMs = Math.min(Math.max(requestedMs, 1), 500);
  const finishAt = Date.now() + durationMs;

  while (Date.now() < finishAt) {
    Math.sqrt(Math.random() * 100000);
  }

  res.status(200).json({
    message: "CPU workload completed",
    durationMs
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

module.exports = app;
