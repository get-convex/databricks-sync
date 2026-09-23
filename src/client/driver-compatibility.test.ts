// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest";

const driver = vi.hoisted(() => ({
  connect: vi.fn(),
  openSession: vi.fn(),
  executeStatement: vi.fn(),
  fetchAll: vi.fn(),
  closeOperation: vi.fn(),
  closeSession: vi.fn(),
  closeConnection: vi.fn(),
}));

vi.mock("@databricks/sql", () => ({
  DBSQLClient: class {
    connect = driver.connect;
  },
}));

import { DatabricksSync } from "./index.js";

describe("Databricks driver compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    driver.fetchAll.mockResolvedValue([
      {
        id: "team-1",
        name: "Core",
        _fivetran_deleted: false,
        __convex_sync_cursor: "2026-09-22 12:34:56.123456",
      },
    ]);
    driver.closeOperation.mockResolvedValue(undefined);
    driver.closeSession.mockResolvedValue(undefined);
    driver.closeConnection.mockResolvedValue(undefined);
    driver.executeStatement.mockResolvedValue({
      fetchAll: driver.fetchAll,
      close: driver.closeOperation,
    });
    driver.openSession.mockResolvedValue({
      executeStatement: driver.executeStatement,
      close: driver.closeSession,
    });
    driver.connect.mockResolvedValue({
      openSession: driver.openSession,
      close: driver.closeConnection,
    });
  });

  test("uses the connection, session, statement, fetch, and cleanup APIs", async () => {
    const component = {
      state: {
        acquire: "state.acquire",
        checkpoint: "state.checkpoint",
        complete: "state.complete",
        fail: "state.fail",
        resume: "state.resume",
      },
    };
    const runMutation = vi.fn(async (reference: string) => {
      if (reference === component.state.acquire) {
        return { acquired: true, cursor: null };
      }
      return null;
    });
    const ctx = {
      runMutation,
      scheduler: { runAfter: vi.fn() },
    } as unknown as Parameters<DatabricksSync["start"]>[0];
    const databricks = new DatabricksSync(component as never);

    const result = await databricks.start(ctx, {
      name: "teams",
      sourceTable: "main.public.teams",
      cursorColumn: "_fivetran_synced",
      columns: ["id", "name"],
      credentials: {
        host: "dbc-example.cloud.databricks.com",
        path: "/sql/1.0/warehouses/example",
        token: "test-token",
        catalog: "main",
      },
      applyRows: "teams.applyRows" as never,
      continueWith: "sync.continueRun" as never,
    });

    expect(driver.connect).toHaveBeenCalledWith({
      host: "dbc-example.cloud.databricks.com",
      path: "/sql/1.0/warehouses/example",
      token: "test-token",
    });
    expect(driver.openSession).toHaveBeenCalledWith({ initialCatalog: "main" });
    expect(driver.executeStatement).toHaveBeenCalledWith(
      expect.stringContaining("FROM `main`.`public`.`teams`"),
      { runAsync: true },
    );
    expect(driver.fetchAll).toHaveBeenCalledWith({ progress: false });
    expect(runMutation).toHaveBeenCalledWith("teams.applyRows", {
      columns: ["id", "name"],
      rows: [{ values: ["team-1", "Core"], deleted: false }],
    });
    expect(driver.closeOperation).toHaveBeenCalledOnce();
    expect(driver.closeSession).toHaveBeenCalledOnce();
    expect(driver.closeConnection).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "complete",
      cursor: "2026-09-22 12:34:56.123456",
      rowsRead: 1,
    });
  });
});
