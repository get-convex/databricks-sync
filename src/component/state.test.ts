import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("sync state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("locks, checkpoints, and completes a sync", async () => {
    const t = initConvexTest();
    const acquired = await t.mutation(api.state.acquire, {
      name: "customers",
      sourceTable: "main.default.customers",
      runId: "run-1",
    });
    expect(acquired).toEqual({ acquired: true, cursor: null });

    const duplicate = await t.mutation(api.state.acquire, {
      name: "customers",
      sourceTable: "main.default.customers",
      runId: "run-2",
    });
    expect(duplicate.acquired).toBe(false);

    await t.mutation(api.state.checkpoint, {
      name: "customers",
      runId: "run-1",
      cursor: "2026-01-01T00:00:00.000Z",
      rowsProcessed: 12,
    });
    await t.mutation(api.state.complete, {
      name: "customers",
      runId: "run-1",
    });

    expect(await t.query(api.state.get, { name: "customers" })).toMatchObject({
      cursor: "2026-01-01T00:00:00.000Z",
      isRunning: false,
      rowsProcessed: 12,
    });
  });

  test("requires a reset before changing the source table", async () => {
    const t = initConvexTest();
    await t.mutation(api.state.acquire, {
      name: "customers",
      sourceTable: "main.default.customers",
      runId: "run-1",
    });
    await t.mutation(api.state.complete, {
      name: "customers",
      runId: "run-1",
    });

    await expect(
      t.mutation(api.state.acquire, {
        name: "customers",
        sourceTable: "main.default.other_customers",
        runId: "run-2",
      }),
    ).rejects.toThrowError(/reset it before changing sourceTable/);
  });
});
