import { describe, expect, test } from "vitest";
import {
  buildSyncQuery,
  cursorToString,
  normalizeValue,
  quoteQualifiedIdentifier,
  SYNC_CURSOR_ALIAS,
} from "./sql.js";

describe("Databricks SQL helpers", () => {
  test("builds an initial query with a string cursor projection", () => {
    expect(
      buildSyncQuery({
        sourceTable: "catalog.schema.customers",
        columns: ["id", "name"],
        cursorColumn: "_fivetran_synced",
        deletedColumn: "_fivetran_deleted",
        cursor: null,
        batchSize: 100,
      }),
    ).toBe(
      "SELECT `id`, `name`, `_fivetran_deleted`, CAST(`_fivetran_synced` AS STRING) AS `__convex_sync_cursor` FROM `catalog`.`schema`.`customers` ORDER BY `_fivetran_synced` ASC LIMIT 100",
    );
  });

  test("uses a bound parameter for incremental syncs", () => {
    expect(
      buildSyncQuery({
        sourceTable: "schema.customers",
        columns: ["id"],
        cursorColumn: "_fivetran_synced",
        deletedColumn: "_fivetran_deleted",
        cursor: "2026-01-01T00:00:00.000Z",
        batchSize: 20_000,
      }),
    ).toContain("WHERE `_fivetran_synced` >= CAST(? AS TIMESTAMP)");
  });

  test("rejects SQL fragments in identifiers", () => {
    expect(() =>
      quoteQualifiedIdentifier("schema.users; DROP TABLE users"),
    ).toThrowError(/Invalid Databricks identifier/);
  });

  test("normalizes timestamps and nested values", () => {
    expect(
      normalizeValue({
        happenedAt: new Date("2026-01-01T00:00:00.000Z"),
        values: [1n, null],
      }),
    ).toEqual({
      happenedAt: "2026-01-01T00:00:00.000Z",
      values: [1n, null],
    });
  });

  test("preserves a microsecond cursor exactly", () => {
    expect(cursorToString("2026-01-01 00:00:00.123456")).toBe(
      "2026-01-01 00:00:00.123456",
    );
    expect(SYNC_CURSOR_ALIAS).toBe("__convex_sync_cursor");
  });

  test("rejects unsupported values", () => {
    expect(() => normalizeValue(undefined)).toThrowError(
      /Unsupported Databricks value type/,
    );
    expect(() => cursorToString(123)).toThrowError(
      /cursor column must be returned as a string/,
    );
  });

  test("passes binary values through as ArrayBuffers", () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    expect(normalizeValue(buffer)).toBe(buffer);
    expect(normalizeValue(new Uint8Array([4, 5]))).toEqual(
      new Uint8Array([4, 5]).buffer,
    );
  });
});
