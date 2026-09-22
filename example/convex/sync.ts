"use node";

import { DatabricksSync } from "@dawin-convex/databricks-sync";
import { v } from "convex/values";
import { components, internal } from "./_generated/api.js";
import { action, env, internalAction } from "./_generated/server.js";

const syncName = "teams";
const databricks = new DatabricksSync(components.databricksSync);
type RunResult = {
  status: "already_running" | "complete" | "continuing";
  cursor: string | null;
  rowsRead: number;
};

const runResult = v.object({
  status: v.union(
    v.literal("already_running"),
    v.literal("complete"),
    v.literal("continuing"),
  ),
  cursor: v.union(v.string(), v.null()),
  rowsRead: v.number(),
});

export const runNow = action({
  args: {},
  returns: runResult,
  handler: async (ctx): Promise<RunResult> => {
    return await startTeamSync(ctx);
  },
});

export const runScheduled = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await startTeamSync(ctx);
    return null;
  },
});

export const continueRun = internalAction({
  args: { runId: v.string() },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    await databricks.continue(ctx, syncConfig, runId);
    return null;
  },
});

const syncConfig = {
  name: syncName,
  sourceTable: env.DATABRICKS_SOURCE_TABLE,
  cursorColumn: "_fivetran_synced",
  columns: [
    "id",
    "name",
    "slug",
    "creator",
    "creation_ts",
    "suspended",
    "default_region",
  ],
  credentials: {
    host: env.DATABRICKS_HOST,
    path: env.DATABRICKS_HTTP_PATH,
    token: env.DATABRICKS_TOKEN,
    ...(env.DATABRICKS_CATALOG ? { catalog: env.DATABRICKS_CATALOG } : {}),
  },
  applyRows: internal.teams.applyRows,
  continueWith: internal.sync.continueRun,
};

async function startTeamSync(
  ctx: Parameters<typeof databricks.start>[0],
): Promise<RunResult> {
  return await databricks.start(ctx, syncConfig);
}
