import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

crons.interval(
  "sync teams from Databricks",
  { minutes: 15 },
  internal.sync.runScheduled,
);

export default crons;
