import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("team sync callback", () => {
  test("upserts and deletes Databricks rows idempotently", async () => {
    const t = initConvexTest();
    const columns = [
      "id",
      "name",
      "slug",
      "creator",
      "creation_ts",
      "suspended",
      "default_region",
    ];
    await t.mutation(internal.teams.applyRows, {
      columns,
      rows: [
        {
          values: [
            101n,
            "Convex",
            "convex",
            7n,
            "2026-01-01T00:00:00.000Z",
            false,
            "aws-us-east-1",
          ],
          deleted: false,
        },
      ],
    });
    await t.mutation(internal.teams.applyRows, {
      columns,
      rows: [
        {
          values: [
            101n,
            "Convex, Inc.",
            "convex",
            7n,
            "2026-01-01T00:00:00.000Z",
            false,
            "aws-us-west-2",
          ],
          deleted: false,
        },
      ],
    });

    expect(await t.query(api.teams.list, {})).toMatchObject([
      {
        externalId: "101",
        name: "Convex, Inc.",
        defaultRegion: "aws-us-west-2",
      },
    ]);

    await t.mutation(internal.teams.applyRows, {
      columns,
      rows: [
        {
          values: [
            101n,
            "Convex, Inc.",
            "convex",
            7n,
            "2026-01-01T00:00:00.000Z",
            false,
            "aws-us-west-2",
          ],
          deleted: true,
        },
      ],
    });
    expect(await t.query(api.teams.list, {})).toEqual([]);
  });
});
