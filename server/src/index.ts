// Scaffold only. This file exists so the setup can be verified end to end;
// routes, services and the session engine are not written yet.
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "english-coach-server" });
});

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
