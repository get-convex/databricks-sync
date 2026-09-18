"use node";

import { DBSQLClient } from "@databricks/sql";
import type {
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
} from "convex/server";
import type { Value } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import { buildSyncQuery, cursorToString, normalizeValue } from "./sql.js";

const DEFAULT_BATCH_SIZE = 20_000;
const DEFAULT_WRITE_CHUNK_SIZE = 1_000;
const MAX_BATCH_SIZE = 20_000;
const MAX_WRITE_CHUNK_SIZE = 1_000;

export type SyncRow = {
  values: Value[];
  deleted: boolean;
};

export type ApplyRowsArgs = {
  columns: string[];
  rows: SyncRow[];
};

export type DatabricksCredentials = {
  host: string;
  path: string;
  token: string;
  catalog?: string;
};

export type SyncConfig = {
  name: string;
  sourceTable: string;
  columns: string[];
  credentials: DatabricksCredentials;
  applyRows: FunctionReference<"mutation", "internal", ApplyRowsArgs, null>;
  continueWith: FunctionReference<
    "action",
    "internal",
    Record<string, never>,
    null
  >;
  cursorColumn: string;
  deletedColumn?: string;
  batchSize?: number;
  writeChunkSize?: number;
};

type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runMutation" | "scheduler"
>;

export class DatabricksSync {
  constructor(public readonly component: ComponentApi) {}

  async start(ctx: ActionCtx, config: SyncConfig) {
    validateConfig(config);
    const runId = crypto.randomUUID();
    const acquisition = await ctx.runMutation(this.component.state.acquire, {
      name: config.name,
      sourceTable: config.sourceTable,
      runId,
    });
    if (!acquisition.acquired) {
      return {
        status: "already_running" as const,
        cursor: acquisition.cursor,
        rowsRead: 0,
      };
    }

    try {
      return await this.runPage(ctx, config, runId, acquisition.cursor);
    } catch (error) {
      await ctx.runMutation(this.component.state.fail, {
        name: config.name,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async runPage(
    ctx: ActionCtx,
    config: SyncConfig,
    runId: string,
    cursor: string | null,
  ) {
    const cursorColumn = config.cursorColumn;
    const deletedColumn = config.deletedColumn ?? "_fivetran_deleted";
    const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    const writeChunkSize = config.writeChunkSize ?? DEFAULT_WRITE_CHUNK_SIZE;
    const query = buildSyncQuery({
      sourceTable: config.sourceTable,
      columns: config.columns,
      cursorColumn,
      deletedColumn,
      cursor,
      batchSize,
    });
    const rawRows = await executeQuery(query, cursor, config.credentials);

    let latestCursor = cursor;
    for (let offset = 0; offset < rawRows.length; offset += writeChunkSize) {
      const chunk = rawRows.slice(offset, offset + writeChunkSize);
      const rows = chunk.map((row) => ({
        values: config.columns.map((column) => normalizeValue(row[column])),
        deleted: Boolean(row[deletedColumn]),
      }));
      await ctx.runMutation(config.applyRows, {
        columns: config.columns,
        rows,
      });
      latestCursor = cursorToString(chunk.at(-1)?.[cursorColumn]);
      await ctx.runMutation(this.component.state.checkpoint, {
        name: config.name,
        runId,
        cursor: latestCursor,
        rowsProcessed: chunk.length,
      });
    }

    const hasMore = rawRows.length === batchSize;
    if (hasMore && latestCursor === cursor) {
      throw new Error(
        `Sync cannot advance because at least ${batchSize} rows share cursor ${latestCursor}`,
      );
    }
    await ctx.runMutation(this.component.state.complete, {
      name: config.name,
      runId,
    });
    if (hasMore) {
      await ctx.scheduler.runAfter(0, config.continueWith, {});
    }
    return {
      status: hasMore ? ("continuing" as const) : ("complete" as const),
      cursor: latestCursor,
      rowsRead: rawRows.length,
    };
  }
}

async function executeQuery(
  query: string,
  cursor: string | null,
  credentials: DatabricksCredentials,
) {
  const client = new DBSQLClient();
  const connection = await client.connect({
    token: credentials.token,
    host: credentials.host,
    path: credentials.path,
  });
  try {
    const session = await connection.openSession({
      ...(credentials.catalog ? { initialCatalog: credentials.catalog } : {}),
    });
    try {
      const operation = await session.executeStatement(query, {
        runAsync: true,
        ...(cursor === null ? {} : { ordinalParameters: [cursor] }),
      });
      try {
        return (await operation.fetchAll({ progress: false })) as Array<
          Record<string, unknown>
        >;
      } finally {
        await operation.close();
      }
    } finally {
      await session.close();
    }
  } finally {
    await connection.close();
  }
}

function validateConfig(config: SyncConfig) {
  if (config.name.trim() === "") {
    throw new Error("Sync name cannot be empty");
  }
  if (config.columns.length === 0) {
    throw new Error("At least one source column is required");
  }
  if (new Set(config.columns).size !== config.columns.length) {
    throw new Error("Source columns must be unique");
  }
  if (
    typeof config.cursorColumn !== "string" ||
    config.cursorColumn.trim() === ""
  ) {
    throw new Error("cursorColumn is required");
  }
  const cursorColumn = config.cursorColumn;
  const deletedColumn = config.deletedColumn ?? "_fivetran_deleted";
  if (cursorColumn === deletedColumn) {
    throw new Error("cursorColumn and deletedColumn must be different");
  }
  if (
    config.columns.includes(cursorColumn) ||
    config.columns.includes(deletedColumn)
  ) {
    throw new Error("Source columns must not include sync metadata columns");
  }
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  const writeChunkSize = config.writeChunkSize ?? DEFAULT_WRITE_CHUNK_SIZE;
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_BATCH_SIZE
  ) {
    throw new Error(
      `batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}`,
    );
  }
  if (
    !Number.isInteger(writeChunkSize) ||
    writeChunkSize < 1 ||
    writeChunkSize > MAX_WRITE_CHUNK_SIZE ||
    writeChunkSize > batchSize
  ) {
    throw new Error(
      `writeChunkSize must be an integer between 1 and ${Math.min(batchSize, MAX_WRITE_CHUNK_SIZE)}`,
    );
  }
}
