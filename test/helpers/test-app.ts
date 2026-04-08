import fs from "fs";
import os from "os";
import path from "path";
import type express from "express";

import { createApp } from "../../src/app";
import { getDb, resetDbForTests } from "../../src/db/connection";
import { setPaymentProvider } from "../../src/services/payment";

export interface TestAppContext {
  app: express.Express;
  tempDir: string;
  cleanup: () => void;
}

export async function createTestApp(): Promise<TestAppContext> {
  resetDbForTests();
  setPaymentProvider(null);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coffee-shop-order-"));
  process.env.DB_PATH = path.join(tempDir, "coffee-shop.db");
  process.env.ALLOW_UNSAFE_HEADER_AUTH = "true";
  process.env.TEAMSFX_ENV = "local";
  process.env.BUSINESS_TIMEZONE = "Asia/Shanghai";
  delete process.env.DEV_ADMIN_AAD_IDS;
  delete process.env.DEV_STAFF_AAD_IDS;

  const app = await createApp();

  return {
    app,
    tempDir,
    cleanup: () => {
      setPaymentProvider(null);
      resetDbForTests();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

export function getTestDb() {
  return getDb();
}

export function adminHeaders() {
  return {
    "X-Teams-User-Id": "dev-user",
    "X-Teams-User-Name": "Dev Admin",
  };
}
