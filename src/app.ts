import "./config/load-runtime-env";
import express from "express";
import fs from "fs";
import https from "https";
import path from "path";
import send from "send";

import { getDb, initDb } from "./db/connection";
import { migrateDatabase } from "./db/schema";
import { seedIfEmpty } from "./db/seed";
import { identityMiddleware } from "./middleware/identity";

import meRouter from "./routes/me";
import menuRouter from "./routes/menu";
import pickupWindowsRouter from "./routes/pickup-windows";
import ordersRouter from "./routes/orders";
import notificationsRouter from "./routes/notifications";
import adminQueueRouter from "./routes/admin/queue";
import adminInventoryRouter from "./routes/admin/inventory";
import adminWindowsRouter from "./routes/admin/windows";
import adminGridRouter from "./routes/admin/grid";
import adminStaffRouter from "./routes/admin/staff";
import adminSettingsRouter from "./routes/admin/settings";
import adminReportsRouter from "./routes/admin/reports";
import adminDashboardRouter from "./routes/admin/dashboard";

function readOptionalFile(filePath?: string) {
  if (!filePath || !fs.existsSync(filePath)) {
    return undefined;
  }

  return fs.readFileSync(filePath);
}

// Initialize database (async for sql.js)
async function start() {
  await initDb();
  const db = getDb();
  migrateDatabase(db);
  seedIfEmpty(db);

  const app = express();

const sslOptions = {
  key: readOptionalFile(process.env.SSL_KEY_FILE),
  cert: readOptionalFile(process.env.SSL_CRT_FILE),
};

app.use((req, res, next) => {
  // Teams renders tabs in an iframe, so the app must explicitly allow Microsoft hosts.
  res.setHeader(
    "Content-Security-Policy",
    [
      "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com",
      "https://*.cloud.microsoft https://*.microsoft365.com https://*.office.com",
      "https://outlook.office.com https://outlook.office365.com",
    ].join(" ")
  );
  res.setHeader("X-Frame-Options", "ALLOW-FROM https://teams.microsoft.com");
  next();
});

// JSON body parsing for API routes
app.use(express.json());

// Identity middleware — extracts Teams user context from headers
app.use(identityMiddleware);

// API routes
app.use("/api/me", meRouter);
app.use("/api/menu", menuRouter);
app.use("/api/pickup-windows", pickupWindowsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admin/orders", adminQueueRouter);
app.use("/api/admin/inventory", adminInventoryRouter);
app.use("/api/admin/windows", adminWindowsRouter);
app.use("/api/admin/grid", adminGridRouter);
app.use("/api/admin/staff", adminStaffRouter);
app.use("/api/admin/settings", adminSettingsRouter);
app.use("/api/admin/reports", adminReportsRouter);
app.use("/api/admin/dashboard", adminDashboardRouter);

// Static assets
const uploadsDir = process.env.DB_PATH
  ? path.join(path.dirname(process.env.DB_PATH), "images")
  : path.join(process.cwd(), "data", "images");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

app.use("/static/scripts", express.static(path.join(__dirname, "../lib/static/scripts")));
app.use("/static", express.static(path.join(__dirname, "./static")));

// Serve the React SPA for client routes
const clientDir = path.join(__dirname, "../lib/client");
const clientIndexPath = path.join(clientDir, "index.html");

function serveSpa(_req: express.Request, res: express.Response) {
  if (fs.existsSync(clientIndexPath)) {
    res.sendFile(clientIndexPath);
  } else {
    send(_req, path.join(__dirname, "views", "hello.html")).pipe(res);
  }
}

// Serve static assets from the React build (js, css, etc.)
app.use("/app/assets", express.static(path.join(clientDir, "assets")));

// SPA fallback: all /app routes serve index.html for client-side routing
app.get("/app", serveSpa);
app.get("/app/*", serveSpa);

// /tab — redirect to the React SPA (Teams may still use the old contentUrl)
app.get("/tab", (_req, res) => {
  res.redirect("/app");
});

// Root — serve the starter page
app.get("/", (req, res) => {
  send(req, path.join(__dirname, "views", "hello.html")).pipe(res);
});

// Create HTTP server
const port = process.env.port || process.env.PORT || 53000;

  if (sslOptions.key && sslOptions.cert) {
    https.createServer(sslOptions, app).listen(port, () => {
      console.log(`Express server listening on port ${port}`);
    });
  } else {
    app.listen(port, () => {
      console.log(`Express server listening on port ${port}`);
    });
  }
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
