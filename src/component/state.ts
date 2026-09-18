import { v } from "convex/values";
import { mutation, query, type DatabaseReader } from "./_generated/server.js";
import { syncStatusValidator } from "./validators.js";

const LEASE_DURATION_MS = 15 * 60 * 1000;

async function getSync(db: DatabaseReader, name: string) {
  return await db
    .query("syncs")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
}

export const get = query({
  args: { name: v.string() },
  returns: v.union(v.null(), syncStatusValidator),
  handler: async (ctx, args) => {
    const sync = await getSync(ctx.db, args.name);
    if (!sync) {
      return null;
    }
    return {
      name: sync.name,
      sourceTable: sync.sourceTable,
      cursor: sync.cursor ?? null,
      isRunning: sync.isRunning,
      rowsProcessed: sync.rowsProcessed,
      lastStartedAt: sync.lastStartedAt ?? null,
      lastCompletedAt: sync.lastCompletedAt ?? null,
      lastError: sync.lastError ?? null,
    };
  },
});

export const reset = mutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sync = await getSync(ctx.db, args.name);
    if (sync?.isRunning) {
      throw new Error(`Cannot reset running sync ${args.name}`);
    }
    if (sync) {
      await ctx.db.delete("syncs", sync._id);
    }
    return null;
  },
});

export const acquire = mutation({
  args: {
    name: v.string(),
    sourceTable: v.string(),
    runId: v.string(),
  },
  returns: v.object({
    acquired: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const sync = await getSync(ctx.db, args.name);
    if (sync && sync.sourceTable !== args.sourceTable) {
      throw new Error(
        `Sync ${args.name} already targets ${sync.sourceTable}; reset it before changing sourceTable`,
      );
    }
    if (
      sync?.isRunning &&
      sync.leaseExpiresAt !== undefined &&
      sync.leaseExpiresAt > now
    ) {
      return { acquired: false, cursor: sync.cursor ?? null };
    }

    if (sync) {
      await ctx.db.patch("syncs", sync._id, {
        sourceTable: args.sourceTable,
        isRunning: true,
        runId: args.runId,
        leaseExpiresAt: now + LEASE_DURATION_MS,
        lastStartedAt: now,
        lastError: undefined,
      });
      return { acquired: true, cursor: sync.cursor ?? null };
    }

    await ctx.db.insert("syncs", {
      name: args.name,
      sourceTable: args.sourceTable,
      isRunning: true,
      runId: args.runId,
      leaseExpiresAt: now + LEASE_DURATION_MS,
      rowsProcessed: 0,
      lastStartedAt: now,
    });
    return { acquired: true, cursor: null };
  },
});

export const checkpoint = mutation({
  args: {
    name: v.string(),
    runId: v.string(),
    cursor: v.string(),
    rowsProcessed: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sync = await getSync(ctx.db, args.name);
    if (!sync?.isRunning || sync.runId !== args.runId) {
      throw new Error(`Sync lease lost for ${args.name}`);
    }
    await ctx.db.patch("syncs", sync._id, {
      cursor: args.cursor,
      rowsProcessed: sync.rowsProcessed + args.rowsProcessed,
      leaseExpiresAt: Date.now() + LEASE_DURATION_MS,
    });
    return null;
  },
});

export const complete = mutation({
  args: { name: v.string(), runId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sync = await getSync(ctx.db, args.name);
    if (!sync?.isRunning || sync.runId !== args.runId) {
      throw new Error(`Sync lease lost for ${args.name}`);
    }
    await ctx.db.patch("syncs", sync._id, {
      isRunning: false,
      runId: undefined,
      leaseExpiresAt: undefined,
      lastCompletedAt: Date.now(),
    });
    return null;
  },
});

export const fail = mutation({
  args: { name: v.string(), runId: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sync = await getSync(ctx.db, args.name);
    if (!sync || sync.runId !== args.runId) {
      return null;
    }
    await ctx.db.patch("syncs", sync._id, {
      isRunning: false,
      runId: undefined,
      leaseExpiresAt: undefined,
      lastError: args.error,
    });
    return null;
  },
});
