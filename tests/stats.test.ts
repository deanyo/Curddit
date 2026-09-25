import { beforeEach, describe, expect, it, vi } from "vitest";

function fakeArea() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (key: string) => (key in data ? { [key]: structuredClone(data[key]) } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => void Object.assign(data, structuredClone(items))),
  };
}

let session: ReturnType<typeof fakeArea>;
let local: ReturnType<typeof fakeArea>;

beforeEach(() => {
  vi.resetModules();
  session = fakeArea();
  local = fakeArea();
  (globalThis as unknown as { browser: unknown }).browser = { storage: { session, local } };
});

describe("stats tracker", () => {
  it("counts per category and de-duplicates across concurrent reports (e.g. two tabs)", async () => {
    const { recordHidden } = await import("../src/background/stats-tracker");
    await Promise.all([
      recordHidden([{ key: "t3_a", category: "india" }, { key: "t3_b", category: "webcomics" }]),
      recordHidden([{ key: "t3_a", category: "india" }, { key: "t3_c", category: "india" }]),
      recordHidden([{ key: "t3_b", category: "webcomics" }]),
    ]);
    expect(session.data.sessionStats).toEqual({ totalHidden: 3, byCategory: { india: 2, webcomics: 1 } });
    expect(local.data.lifetimeStats).toEqual({ totalHidden: 3 });
  });

  it("reset clears session counts but keeps lifetime and does not recount seen posts", async () => {
    const { recordHidden, resetSessionStats } = await import("../src/background/stats-tracker");
    await recordHidden([{ key: "t3_a", category: "india" }]);
    await resetSessionStats();
    await recordHidden([{ key: "t3_a", category: "india" }, { key: "t3_z", category: "india" }]);
    expect(session.data.sessionStats).toEqual({ totalHidden: 1, byCategory: { india: 1 } });
    expect(local.data.lifetimeStats).toEqual({ totalHidden: 2 });
  });

  it("bounds the seen-post list", async () => {
    const { recordHidden, MAX_SEEN } = await import("../src/background/stats-tracker");
    const items = Array.from({ length: MAX_SEEN + 50 }, (_, i) => ({ key: `k${i}`, category: "c" }));
    await recordHidden(items);
    expect((session.data.seenPostKeys as string[]).length).toBe(MAX_SEEN);
  });
});
