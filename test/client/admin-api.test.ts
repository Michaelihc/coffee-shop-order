// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadAuthenticatedFile } from "../../src/client/admin-api";
import { seedOrNotify } from "../../src/client/notification-polling";

describe("client admin helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("downloads authenticated CSV files with request headers", async () => {
    localStorage.setItem("coffee-shop-lang", "en-US");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("csv-body", {
          status: 200,
          headers: {
            "Content-Disposition": 'attachment; filename="student-balances.csv"',
          },
        })
      );
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const createObjectUrlSpy = vi.fn(() => "blob:download");
    const revokeObjectUrlSpy = vi.fn();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlSpy,
    });

    await downloadAuthenticatedFile(
      "/api/admin/reports/balance/csv",
      "fallback.csv"
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/reports/balance/csv",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Teams-User-Locale": "en-US",
        }),
      })
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:download");
  });

  it("seeds notification polling before emitting diffs", () => {
    const onNotify = vi.fn();

    let state = seedOrNotify(
      { hasSeeded: false, previous: [] as string[] },
      ["first"],
      onNotify
    );

    expect(onNotify).not.toHaveBeenCalled();
    expect(state).toEqual({
      hasSeeded: true,
      previous: ["first"],
    });

    state = seedOrNotify(state, ["second"], onNotify);

    expect(onNotify).toHaveBeenCalledWith(["first"], ["second"]);
    expect(state.previous).toEqual(["second"]);
  });
});
