import { execFileSync } from "node:child_process";

/** Every run starts from the same seeded class, roster, rubric, and responses. */
export default function globalSetup() {
  execFileSync("npx", ["tsx", "lib/db/reset.ts"], { stdio: "inherit" });
}
