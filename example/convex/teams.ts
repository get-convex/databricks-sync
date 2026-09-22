import type { ApplyRowsArgs } from "@dawin-convex/databricks-sync";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server.js";

const EXPECTED_COLUMNS = [
  "id",
  "name",
  "slug",
  "creator",
  "creation_ts",
  "suspended",
  "default_region",
];

export const applyRows = internalMutation({
  args: {
    columns: v.array(v.string()),
    rows: v.array(
      v.object({
        values: v.array(v.any()),
        deleted: v.boolean(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args: ApplyRowsArgs) => {
    if (args.columns.join("\0") !== EXPECTED_COLUMNS.join("\0")) {
      throw new Error(`Unexpected columns: ${args.columns.join(", ")}`);
    }

    for (const row of args.rows) {
      const externalId = requireId(row.values[0], "id");
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .unique();

      if (row.deleted) {
        if (existing) {
          await ctx.db.delete("teams", existing._id);
        }
        continue;
      }

      const team = {
        externalId,
        name: nullableString(row.values[1], "name"),
        slug: nullableString(row.values[2], "slug"),
        creator: nullableId(row.values[3], "creator"),
        creationTs: nullableString(row.values[4], "creation_ts"),
        suspended: nullableBoolean(row.values[5], "suspended"),
        defaultRegion: nullableString(row.values[6], "default_region"),
      };
      if (existing) {
        await ctx.db.replace("teams", existing._id, team);
      } else {
        await ctx.db.insert("teams", team);
      }
    }
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      _creationTime: v.number(),
      externalId: v.string(),
      name: v.union(v.string(), v.null()),
      slug: v.union(v.string(), v.null()),
      creator: v.union(v.string(), v.null()),
      creationTs: v.union(v.string(), v.null()),
      suspended: v.union(v.boolean(), v.null()),
      defaultRegion: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("teams").order("desc").take(100);
  },
});

function requireId(value: unknown, column: string) {
  if (
    typeof value === "bigint" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isSafeInteger(value))
  ) {
    return String(value);
  }
  throw new Error(`Expected ${column} to be a safe integer, bigint, or string`);
}

function nullableId(value: unknown, column: string) {
  return value === null ? null : requireId(value, column);
}

function nullableString(value: unknown, column: string) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${column} to be a string`);
  }
  return value;
}

function nullableBoolean(value: unknown, column: string) {
  if (value === null || typeof value === "boolean") {
    return value;
  }
  throw new Error(`Expected ${column} to be a boolean`);
}
