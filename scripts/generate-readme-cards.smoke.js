#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generateReadmeCards } from "./generate-readme-cards.js";

const run = async () => {
  const outputDir = path.join(os.tmpdir(), "github-readme-stats-smoke");
  const { statsPath, topLangsPath } = await generateReadmeCards({
    username: "octocat",
    outputDir,
    dryRun: true,
  });

  await fs.access(statsPath);
  await fs.access(topLangsPath);

  process.stdout.write("Smoke test OK\n");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
