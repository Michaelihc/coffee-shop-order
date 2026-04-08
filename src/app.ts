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
import { ensureUploadsDir } from "./services/file-storage-service";

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

function configureStaticAssets(app: express.Express) {
  const uploadsDir = ensureUploadsDir();

  app.use("/uploads", express.static(uploadsDir));
  app.use("/static/scripts", express.static(path.join(__dirname, "../lib/static/scripts")));
  app.use("/static", express.static(path.join(__dirname, "./static")));

  const clientDir = path.join(__dirname, "../lib/client");
  const clientIndexPath = path.join(clientDir, "index.html");

  function serveSpa(req: express.Request, res: express.Response) {
    if (fs.existsSync(clientIndexPath)) {
      res.sendFile(clientIndexPath);
      return;
    }

    send(req, path.join(__dirname, "views", "hello.html")).pipe(res);
  }

  app.use("/app/assets", express.static(path.join(clientDir, "assets")));
  app.get("/app", serveSpa);
  app.get("/app/*", serveSpa);

  app.get("/tab", (_req, res) => {
    res.redirect("/app");
  });

  app.get("/", (req, res) => {
    send(req, path.join(__dirname, "views", "hello.html")).pipe(res);
  });
}

function configureSecurity(app: express.Express) {
  app.use((req, res, next) => {
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
}

function configureRoutes(app: express.Express) {
  app.use(express.json());
  app.use(identityMiddleware);

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
}

async function initializeApplicationData() {
  await initDb();
  const db = getDb();
  migrateDatabase(db);
  seedIfEmpty(db);
}

export async function createApp(): Promise<express.Express> {
  await initializeApplicationData();

  const app = express();
  configureSecurity(app);
  configureRoutes(app);
  configureStaticAssets(app);

  return app;
}

export async function start(): Promise<void> {
  const app = await createApp();
  const sslOptions = {
    key: readOptionalFile(process.env.SSL_KEY_FILE),
    cert: readOptionalFile(process.env.SSL_CRT_FILE),
  };
  const port = process.env.port || process.env.PORT || 53000;

  if (sslOptions.key && sslOptions.cert) {
    https.createServer(sslOptions, app).listen(port, () => {
      console.log(`Express server listening on port ${port}`);
    });
    return;
  }

  app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
}
