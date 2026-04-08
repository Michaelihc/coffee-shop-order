import { afterEach, describe, expect, it } from "vitest";

import {
  allowUnsafeHeaderAuth,
  enableNotificationDebugRoutes,
  isLocalDevMode,
} from "../../src/config/runtime-mode";

const ORIGINAL_ENV = {
  TEAMSFX_ENV: process.env.TEAMSFX_ENV,
  ENV_NAME: process.env.ENV_NAME,
  NODE_ENV: process.env.NODE_ENV,
  ALLOW_UNSAFE_HEADER_AUTH: process.env.ALLOW_UNSAFE_HEADER_AUTH,
  ENABLE_NOTIFICATION_DEBUG_ROUTES: process.env.ENABLE_NOTIFICATION_DEBUG_ROUTES,
};

afterEach(() => {
  process.env.TEAMSFX_ENV = ORIGINAL_ENV.TEAMSFX_ENV;
  process.env.ENV_NAME = ORIGINAL_ENV.ENV_NAME;
  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  process.env.ALLOW_UNSAFE_HEADER_AUTH = ORIGINAL_ENV.ALLOW_UNSAFE_HEADER_AUTH;
  process.env.ENABLE_NOTIFICATION_DEBUG_ROUTES = ORIGINAL_ENV.ENABLE_NOTIFICATION_DEBUG_ROUTES;
});

describe("runtime-mode safety defaults", () => {
  it("does not enable unsafe header auth from NODE_ENV alone", () => {
    delete process.env.TEAMSFX_ENV;
    delete process.env.ENV_NAME;
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_UNSAFE_HEADER_AUTH;

    expect(isLocalDevMode()).toBe(false);
    expect(allowUnsafeHeaderAuth()).toBe(false);
  });

  it("enables local-only helpers when the Teams environment is explicitly local", () => {
    process.env.TEAMSFX_ENV = "local";
    delete process.env.ALLOW_UNSAFE_HEADER_AUTH;
    delete process.env.ENABLE_NOTIFICATION_DEBUG_ROUTES;

    expect(isLocalDevMode()).toBe(true);
    expect(allowUnsafeHeaderAuth()).toBe(true);
    expect(enableNotificationDebugRoutes()).toBe(true);
  });
});
