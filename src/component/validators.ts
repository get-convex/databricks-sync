import { v } from "convex/values";

export const syncRowValidator = v.object({
  values: v.array(v.any()),
  deleted: v.boolean(),
});

export const applyRowsArgsValidator = v.object({
  columns: v.array(v.string()),
  rows: v.array(syncRowValidator),
});

export const syncStatusValidator = v.object({
  name: v.string(),
  sourceTable: v.string(),
  cursor: v.union(v.string(), v.null()),
  isRunning: v.boolean(),
  rowsProcessed: v.number(),
  lastStartedAt: v.union(v.number(), v.null()),
  lastCompletedAt: v.union(v.number(), v.null()),
  lastError: v.union(v.string(), v.null()),
});
