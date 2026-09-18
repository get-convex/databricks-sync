/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    state: {
      acquire: FunctionReference<
        "mutation",
        "internal",
        { name: string; runId: string; sourceTable: string },
        { acquired: boolean; cursor: string | null },
        Name
      >;
      checkpoint: FunctionReference<
        "mutation",
        "internal",
        { cursor: string; name: string; rowsProcessed: number; runId: string },
        null,
        Name
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        { name: string; runId: string },
        null,
        Name
      >;
      fail: FunctionReference<
        "mutation",
        "internal",
        { error: string; name: string; runId: string },
        null,
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { name: string },
        null | {
          cursor: string | null;
          isRunning: boolean;
          lastCompletedAt: number | null;
          lastError: string | null;
          lastStartedAt: number | null;
          name: string;
          rowsProcessed: number;
          sourceTable: string;
        },
        Name
      >;
      reset: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        null,
        Name
      >;
    };
  };
