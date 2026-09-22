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
    expect(
      await t.mutation(api.state.resume, {
        name: "customers",
        sourceTable: "main.default.customers",
        runId: "run-1",
      }),
    ).toEqual({ cursor: "2026-01-01T00:00:00.000Z" });
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

  test("allows a new run after the previous lease expires", async () => {
    const t = initConvexTest();
    await t.mutation(api.state.acquire, {
      name: "customers",
      sourceTable: "main.default.customers",
      runId: "stale-run",
    });

    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(
      await t.mutation(api.state.acquire, {
        name: "customers",
        sourceTable: "main.default.customers",
        runId: "current-run",
      }),
    ).toEqual({ acquired: true, cursor: null });

    await expect(
      t.mutation(api.state.checkpoint, {
        name: "customers",
        runId: "stale-run",
        cursor: "2026-01-01 00:16:00.000001",
        rowsProcessed: 1,
      }),
    ).rejects.toThrowError(/lease lost/);
    await t.mutation(api.state.fail, {
      name: "customers",
      runId: "stale-run",
      error: "stale worker failed",
    });
    expect(await t.query(api.state.get, { name: "customers" })).toMatchObject({
      isRunning: true,
      lastError: null,
    });
  });

  test("records a failure from the active lease owner", async () => {
    const t = initConvexTest();
    await t.mutation(api.state.acquire, {
      name: "customers",
      sourceTable: "main.default.customers",
      runId: "run-1",
    });
    await t.mutation(api.state.fail, {
      name: "customers",
      runId: "run-1",
      error: "warehouse unavailable",
    });

    expect(await t.query(api.state.get, { name: "customers" })).toMatchObject({
      isRunning: false,
      lastError: "warehouse unavailable",
    });
  });

  test("rejects reset while active and permits it after lease expiry", async () => {
    const t = initConvexTest();
    await t.mutation(api.state.acquire, {
      name: "customers",
      sourceTable: "main.default.customers",
      runId: "run-1",
    });

    await expect(
      t.mutation(api.state.reset, { name: "customers" }),
    ).rejects.toThrowError(/Cannot reset running sync/);
    vi.advanceTimersByTime(16 * 60 * 1000);
    await expect(
      t.mutation(api.state.complete, {
        name: "customers",
        runId: "run-1",
      }),
    ).rejects.toThrowError(/lease lost/);
    await t.mutation(api.state.reset, { name: "customers" });
    expect(await t.query(api.state.get, { name: "customers" })).toBeNull();
  });
});
