import { describe, expect, test } from "vitest";
import {
  buildSyncQuery,
  cursorToString,
  normalizeValue,
  quoteQualifiedIdentifier,
} from "./sql.js";

describe("Databricks SQL helpers", () => {
  test("builds an initial Fivetran query", () => {
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
      "SELECT `id`, `name`, `_fivetran_deleted`, `_fivetran_synced` FROM `catalog`.`schema`.`customers` ORDER BY `_fivetran_synced` ASC LIMIT 100",
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
    ).toContain("WHERE `_fivetran_synced` >= ?");
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
    expect(cursorToString(new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});
