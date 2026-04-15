import { afterEach, describe, expect, it } from "vitest";

import {
  buildTeamsDeepLink,
  getTeamsTabEndpoint,
} from "../../src/services/teams-notification-service";

describe("teams notification service", () => {
  afterEach(() => {
    delete process.env.TAB_ENDPOINT;
    delete process.env.WEBSITE_HOSTNAME;
  });

  it("prefers the configured tab endpoint when present", () => {
    process.env.TAB_ENDPOINT = "https://configured.example.com/";
    process.env.WEBSITE_HOSTNAME = "azure.example.com";

    expect(getTeamsTabEndpoint()).toBe("https://configured.example.com");
  });

  it("falls back to the Azure website hostname when tab endpoint is missing", () => {
    process.env.WEBSITE_HOSTNAME = "tab275266.azurewebsites.net";

    expect(getTeamsTabEndpoint()).toBe("https://tab275266.azurewebsites.net");
  });

  it("builds a deep link that carries both Teams subpage identifiers", () => {
    process.env.WEBSITE_HOSTNAME = "tab275266.azurewebsites.net";

    const deepLink = buildTeamsDeepLink("teams-app-id", "tenant-id", "/orders");

    expect(deepLink).not.toBeNull();

    const url = new URL(deepLink!);
    expect(url.searchParams.get("webUrl")).toBe(
      "https://tab275266.azurewebsites.net/app/orders"
    );

    const context = JSON.parse(url.searchParams.get("context") ?? "{}") as {
      subEntityId?: string;
      subPageId?: string;
    };
    expect(context).toEqual({
      subEntityId: "orders",
      subPageId: "orders",
    });
  });
});
