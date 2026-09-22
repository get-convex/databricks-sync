import { syncStatusValidator } from "@dawin-convex/databricks-sync/validators";
import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { mutation, query } from "./_generated/server.js";

const syncName = "teams";

export const status = query({
  args: {},
  returns: v.union(v.null(), syncStatusValidator),
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
