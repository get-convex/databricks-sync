import { defineApp } from "convex/server";
import { v } from "convex/values";
import databricksSync from "@dawin-convex/databricks-sync/convex.config.js";

const app = defineApp({
  env: {
    DATABRICKS_HOST: v.string(),
    DATABRICKS_HTTP_PATH: v.string(),
    DATABRICKS_TOKEN: v.string(),
    DATABRICKS_CATALOG: v.optional(v.string()),
    DATABRICKS_SOURCE_TABLE: v.string(),
  },
});

app.use(databricksSync);

export default app;
