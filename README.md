# Convex Databricks Sync

Incrementally replicate Databricks tables into Convex. The package owns the
Databricks connection, batching, checkpoint, concurrency lease, and background
continuation. Your app provides an idempotent mutation that validates each
source row and writes it into app-owned tables.

The caller explicitly supplies the incremental cursor column. The deletion
column defaults to `_fivetran_deleted` and is configurable.

## Install

```sh
npm install @convex-dev/databricks-sync
```

The Databricks driver contains native dependencies. Mark it as external in the
app's `convex.json`:

```json
{
  "node": {
    "externalPackages": ["@databricks/sql"],
    "nodeVersion": "22"
  }
}
```

Declare typed environment variables on the app and mount the component:

```ts
// convex/convex.config.ts
import databricksSync from "@convex-dev/databricks-sync/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    DATABRICKS_HOST: v.string(),
    DATABRICKS_HTTP_PATH: v.string(),
    DATABRICKS_TOKEN: v.string(),
    DATABRICKS_CATALOG: v.optional(v.string()),
  },
});

app.use(databricksSync);

export default app;
```

Set the variables on the Convex deployment:

```sh
npx convex env set DATABRICKS_HOST dbc-example.cloud.databricks.com
npx convex env set DATABRICKS_HTTP_PATH /sql/1.0/warehouses/example
npx convex env set DATABRICKS_TOKEN your-token
npx convex env set DATABRICKS_CATALOG main
```

## Use

Define an internal, idempotent mutation in the app. A row contains values in the
same order as `columns`, plus the configured deletion flag:

```ts
// convex/customers.ts
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const applyRows = internalMutation({
  args: {
    columns: v.array(v.string()),
    rows: v.array(v.object({ values: v.array(v.any()), deleted: v.boolean() })),
  },
  returns: v.null(),
  handler: async (ctx, { columns, rows }) => {
    // Validate columns and values, then upsert or delete app-owned documents.
    // This mutation must be idempotent because the checkpoint boundary is replayed.
    return null;
  },
});
```

Invoke the component from an action:

```ts
// convex/sync.ts
"use node";

import { DatabricksSync } from "@convex-dev/databricks-sync";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, env, internalAction } from "./_generated/server";

const databricks = new DatabricksSync(components.databricksSync);
const runResult = v.object({
  status: v.union(
    v.literal("already_running"),
    v.literal("complete"),
    v.literal("continuing"),
  ),
  cursor: v.union(v.string(), v.null()),
  rowsRead: v.number(),
});
type RunResult = {
  status: "already_running" | "complete" | "continuing";
  cursor: string | null;
  rowsRead: number;
};

export const run = action({
  args: {},
  returns: runResult,
  handler: async (ctx): Promise<RunResult> => {
    return await syncCustomers(ctx);
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
  name: "customers",
  sourceTable: "main.default.customers",
  cursorColumn: "_fivetran_synced",
  columns: ["id", "name", "email", "updated_at"],
  credentials: {
    host: env.DATABRICKS_HOST,
    path: env.DATABRICKS_HTTP_PATH,
    token: env.DATABRICKS_TOKEN,
    ...(env.DATABRICKS_CATALOG ? { catalog: env.DATABRICKS_CATALOG } : {}),
  },
  applyRows: internal.customers.applyRows,
  continueWith: internal.sync.continueRun,
};

async function syncCustomers(
  ctx: Parameters<typeof databricks.start>[0],
): Promise<RunResult> {
  return await databricks.start(ctx, syncConfig);
}
```

`start` processes one Databricks page immediately. When a full page is returned,
the component schedules the next page in the background. A second invocation
while the lease is active returns `already_running`.

Wrap `components.databricksSync.state.get` in an app query to expose progress,
and `components.databricksSync.state.reset` in an app mutation to clear a
stopped sync's checkpoint. These wrappers stay in the default Convex runtime;
only the Databricks action uses `"use node"`.

## Configuration

`DatabricksSync.start` accepts:

| Option           | Default             | Purpose                                            |
| ---------------- | ------------------- | -------------------------------------------------- |
| `name`           | required            | Stable identifier for the sync and its checkpoint  |
| `sourceTable`    | required            | One-, two-, or three-part Databricks table name    |
| `columns`        | required            | Source columns delivered to `applyRows`            |
| `credentials`    | required            | Host, HTTP path, token, and optional catalog       |
| `applyRows`      | required            | Internal app mutation that applies each chunk      |
| `continueWith`   | required            | Internal action accepting the continuation `runId` |
| `cursorColumn`   | required            | Incremental timestamp column                       |
| `deletedColumn`  | `_fivetran_deleted` | Soft-delete flag                                   |
| `batchSize`      | `20000`             | Rows fetched per Databricks query, max 20,000      |
| `writeChunkSize` | `1000`              | Rows sent to each app mutation, max 1,000          |

Table and column identifiers are validated and quoted. Cursor values are sent as
bound query parameters. The cursor is projected as a string so Databricks
timestamp precision is preserved; other dates are converted to ISO strings
before crossing the component boundary.

The cursor query deliberately uses `>=` so rows at the checkpoint boundary may
be replayed. The app mutation therefore must be idempotent. If an entire page
has one cursor value, the component stops with an error instead of looping
forever.

## Example

The [`example`](./example) app mounts the packaged component with typed
environment variables, syncs a customer table every 15 minutes, supports a
manual run, and displays status and synced rows.

```sh
npm install
npm run dev
```

## Development

```sh
npm run build:codegen
npm test
npm run lint
npm run typecheck
```

Found a bug or have a feature request?
[Open an issue](https://github.com/get-convex/databricks-sync/issues).
