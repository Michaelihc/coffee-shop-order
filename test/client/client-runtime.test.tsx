// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import { usePoller } from "../../src/client/hooks/usePoller";
import {
  getTeamsDeepLinkSubPageId,
  resolveTeamsSubPagePath,
} from "../../src/client/teams-deep-link";
import { getTokenExpiryTimestamp, isTokenUsable } from "../../src/client/teams-auth";

function createTestJwt(expSeconds: number): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: expSeconds })}.signature`;
}

describe("client runtime helpers", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  it("refreshes cached tokens once they are near expiry", () => {
    const freshToken = createTestJwt(Math.floor(Date.now() / 1000) + 120);
    const staleToken = createTestJwt(Math.floor(Date.now() / 1000) + 30);

    expect(getTokenExpiryTimestamp(freshToken)).not.toBeNull();
    expect(isTokenUsable(freshToken)).toBe(true);
    expect(isTokenUsable(staleToken)).toBe(false);
  });

  it("reads Teams deep links from either context or URL query fallbacks", () => {
    expect(
      getTeamsDeepLinkSubPageId(
        { page: { subPageId: "orders" } } as never,
        ""
      )
    ).toBe("orders");

    expect(
      getTeamsDeepLinkSubPageId(
        { page: { subEntityId: "orders" } } as never,
        ""
      )
    ).toBe("orders");

    expect(
      getTeamsDeepLinkSubPageId(
        null,
        "?context=%7B%22subEntityId%22%3A%22orders%22%7D"
      )
    ).toBe("orders");

    expect(
      getTeamsDeepLinkSubPageId(
        null,
        "?webUrl=https%3A%2F%2Fexample.com%2Fapp%2Forders"
      )
    ).toBe("orders");

    expect(resolveTeamsSubPagePath("orders", false)).toBe("/orders");
    expect(resolveTeamsSubPagePath("orders", true)).toBeNull();
  });

  it("does not start another poll while the previous one is still running", async () => {
    vi.useFakeTimers();

    const resolvers: Array<() => void> = [];
    let callCount = 0;
    let maxConcurrentCalls = 0;
    let activeCalls = 0;

    function TestComponent() {
      usePoller(async () => {
        callCount += 1;
        activeCalls += 1;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls);

        await new Promise<void>((resolve) => {
          resolvers.push(() => {
            activeCalls -= 1;
            resolve();
          });
        });
      }, 10);

      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<TestComponent />);
      await Promise.resolve();
    });

    expect(callCount).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });

    expect(callCount).toBe(1);
    expect(maxConcurrentCalls).toBe(1);

    await act(async () => {
      resolvers.shift()?.();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(10);
      await Promise.resolve();
    });

    expect(callCount).toBe(2);
    expect(maxConcurrentCalls).toBe(1);
  });
});
