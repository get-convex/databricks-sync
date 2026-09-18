/// <reference types="vite/client" />
import { test } from "vitest";
import { convexTest } from "convex-test";
const modules = import.meta.glob("../component/_generated/**/*.*s");

import {
  defineSchema,
  type GenericSchema,
  type SchemaDefinition,
} from "convex/server";
import { type ComponentApi } from "../component/_generated/component.js";
import { componentsGeneric } from "convex/server";
import { register } from "../test.js";

export function initConvexTest<
  Schema extends SchemaDefinition<GenericSchema, boolean>,
>(schema?: Schema) {
  const t = convexTest(schema ?? defineSchema({}), modules);
  register(t);
  return t;
}
export const components = componentsGeneric() as unknown as {
  databricksSync: ComponentApi;
};

test("setup", () => {
  initConvexTest();
});
