/// <reference types="vite/client" />
import { test } from "vitest";
import { convexTest } from "convex-test";
import component, { register } from "./test.js";

test("registers the component with a Convex test instance", () => {
  const t = convexTest(component.schema, component.modules);
  register(t, "nestedDatabricksSync");
});
