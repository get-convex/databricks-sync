import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  syncs: defineTable({
    name: v.string(),
    sourceTable: v.string(),
    cursor: v.optional(v.string()),
    isRunning: v.boolean(),
    runId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    rowsProcessed: v.number(),
    lastStartedAt: v.optional(v.number()),
    lastCompletedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_name", ["name"]),
});
