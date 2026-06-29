import { spawnSync } from "node:child_process";

run("npm", ["run", "automation:watchdog"]);
run("npm", ["run", "automation:digest"]);

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
