import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teams: defineTable({
    externalId: v.string(),
    name: v.union(v.string(), v.null()),
    slug: v.union(v.string(), v.null()),
    creator: v.union(v.string(), v.null()),
    creationTs: v.union(v.string(), v.null()),
    suspended: v.union(v.boolean(), v.null()),
    defaultRegion: v.union(v.string(), v.null()),
  }).index("by_external_id", ["externalId"]),
});
