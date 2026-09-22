import type { Value } from "convex/values";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;
export const SYNC_CURSOR_ALIAS = "__convex_sync_cursor";

function quoteIdentifier(identifier: string) {
  if (!IDENTIFIER.test(identifier)) {
    throw new Error(`Invalid Databricks identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

export function quoteQualifiedIdentifier(identifier: string) {
  const parts = identifier.split(".");
  if (parts.length === 0 || parts.length > 3) {
    throw new Error(`Invalid Databricks table name: ${identifier}`);
  }
  return parts.map(quoteIdentifier).join(".");
}

export function buildSyncQuery(args: {
  sourceTable: string;
  columns: string[];
  cursorColumn: string;
  deletedColumn: string;
  cursor: string | null;
  batchSize: number;
}) {
  const selectedColumns = args.columns.map(quoteIdentifier);
  const cursorColumn = quoteIdentifier(args.cursorColumn);
  const cursorAlias = quoteIdentifier(SYNC_CURSOR_ALIAS);
  const deletedColumn = quoteIdentifier(args.deletedColumn);
  const table = quoteQualifiedIdentifier(args.sourceTable);
  const cursorProjection = `CAST(${cursorColumn} AS STRING) AS ${cursorAlias}`;
  const where =
    args.cursor === null
      ? ""
      : ` WHERE ${cursorColumn} >= CAST(? AS TIMESTAMP)`;
  return `SELECT ${[...selectedColumns, deletedColumn, cursorProjection].join(", ")} FROM ${table}${where} ORDER BY ${cursorColumn} ASC LIMIT ${args.batchSize}`;
}

export function normalizeValue(value: unknown): Value {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof ArrayBuffer) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    ) as ArrayBuffer;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (typeof value === "object") {
    const result: Record<string, Value> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) {
        result[key] = normalizeValue(child);
      }
    }
    return result;
  }
  throw new Error(`Unsupported Databricks value type: ${typeof value}`);
}

export function cursorToString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  throw new Error("The Databricks cursor column must be returned as a string");
}
