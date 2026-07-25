import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEvent = {
  request?: Request;
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (work: Promise<unknown>) => void;
};

function workerHarness(fetchImpl: typeof fetch) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const cachedUrls: string[] = [];
  const cache = {
    put: vi.fn(async (request: Request | string) => {
      cachedUrls.push(typeof request === "string" ? request : request.url);
    }),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => undefined as Response | undefined),
  };
  const self = {
    registration: { scope: "https://example.test/finanzas/" },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: (type: string, listener: (event: WorkerEvent) => void) => {
      listeners.set(type, listener);
    },
    location: { origin: "https://example.test" },
  };

  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  runInNewContext(source, {
    caches,
    fetch: fetchImpl,
    Promise,
    Request,
    Response,
    self,
    URL,
  });

  return { cache, cachedUrls, caches, listeners, self };
}

describe("PWA service worker", () => {
  it("precaches every application route under the deployed scope", async () => {
    const harness = workerHarness(vi.fn(async () => new Response("page", { status: 200 })) as typeof fetch);
    let installWork: Promise<unknown> | undefined;

    harness.listeners.get("install")?.({
      waitUntil: (work) => {
        installWork = work;
      },
    });
    await installWork;

    expect(harness.cachedUrls).toEqual(expect.arrayContaining([
      "https://example.test/finanzas/",
      "https://example.test/finanzas/dashboard/",
      "https://example.test/finanzas/movimientos/",
      "https://example.test/finanzas/movimientos/nuevo/",
    ]));
    expect(harness.cachedUrls).toHaveLength(10);
    expect(harness.self.skipWaiting).toHaveBeenCalledOnce();
  });

  it("uses only the matching cached page when an offline navigation fails", async () => {
    const harness = workerHarness(vi.fn(async () => {
      throw new Error("offline");
    }) as typeof fetch);
    const cachedPage = new Response("cached movements");
    harness.caches.match.mockResolvedValue(cachedPage);
    const request = new Request("https://example.test/finanzas/movimientos/?month=2026-07");
    Object.defineProperty(request, "mode", { value: "navigate" });
    let navigationResponse: Promise<Response> | undefined;

    harness.listeners.get("fetch")?.({
      request,
      respondWith: (response) => {
        navigationResponse = response;
      },
    });

    await expect(navigationResponse).resolves.toBe(cachedPage);
    expect(harness.caches.match).toHaveBeenCalledWith(request, { ignoreSearch: true });
  });
});
