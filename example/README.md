# Databricks Sync example

This app demonstrates a complete sync of the Databricks
`fivetran.prod_postgres_public.teams` table into a Convex table owned by the
app.

Set these variables on the example deployment before starting it:

```sh
npx convex env set DATABRICKS_HOST dbc-f43966a6-a3a6.cloud.databricks.com
npx convex env set DATABRICKS_HTTP_PATH /sql/1.0/warehouses/ffef8fa681429d49
npx convex env set DATABRICKS_TOKEN your-token
npx convex env set DATABRICKS_CATALOG fivetran
npx convex env set DATABRICKS_SOURCE_TABLE fivetran.prod_postgres_public.teams
```

The sample reads `id`, `name`, `slug`, `creator`, `creation_ts`, `suspended`,
`default_region`, `_fivetran_synced`, and `_fivetran_deleted` from the source.

From the repository root, start the Convex backend:

```sh
npm run dev
```

In a second terminal, start the example UI:

```sh
npm run dev:frontend
```

Open `http://localhost:5173`. The backend syncs every 15 minutes; the example UI
also exposes a manual **Sync now** button.
