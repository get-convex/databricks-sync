import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { mutation, query } from "./_generated/server.js";

const syncName = "teams";

export const status = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      sourceTable: v.string(),
      cursor: v.union(v.string(), v.null()),
      isRunning: v.boolean(),
      rowsProcessed: v.number(),
      lastStartedAt: v.union(v.number(), v.null()),
      lastCompletedAt: v.union(v.number(), v.null()),
      lastError: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.runQuery(components.databricksSync.state.get, {
      name: syncName,
    });
  },
});

export const reset = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(components.databricksSync.state.reset, {
      name: syncName,
    });
    return null;
  },
});
