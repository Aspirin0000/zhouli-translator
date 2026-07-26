import { execFileSync } from "node:child_process";

execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "zhouli-analytics",
    "--remote",
    "--file",
    "analytics/queries/delete-expired-cases.sql",
  ],
  { stdio: "inherit" },
);
