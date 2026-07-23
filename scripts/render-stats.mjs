#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { renderStatsCard } from "../src/cards/stats.js";
import { renderTopLanguages } from "../src/cards/top-languages.js";

const STATS_OPTIONS = {
  show_icons: true,
  hide_border: true,
  title_color: "0891b2",
  text_color: "ffffff",
  icon_color: "0891b2",
  bg_color: "1c1917",
};

const getStatsOptions = (availableFields = []) => {
  const available = new Set(availableFields);
  const hide = [];

  if (!available.has("commits")) {
    hide.push("commits");
  }
  if (!available.has("prs")) {
    hide.push("prs");
  }
  if (!available.has("issues")) {
    hide.push("issues");
  }
  if (!available.has("contribs")) {
    hide.push("contribs");
  }

  return {
    ...STATS_OPTIONS,
    hide,
    hide_rank: !available.has("rank"),
  };
};

const LANGUAGES_OPTIONS = {
  langs_count: 10,
  hide_border: true,
  title_color: "0891b2",
  text_color: "ffffff",
  icon_color: "0891b2",
  bg_color: "1c1917",
  locale: "en",
  custom_title: "Primary Languages (Approx.)",
};

const renderSnapshot = async ({ input, statsOutput, languagesOutput }) => {
  const snapshot = JSON.parse(await fs.readFile(input, "utf8"));
  const stats = {
    ...snapshot.stats,
    rank: snapshot.stats.rank || { level: "C", percentile: 100 },
  };
  const statsSvg = renderStatsCard(
    stats,
    getStatsOptions(snapshot.available_fields),
  );
  const languagesSvg = renderTopLanguages(snapshot.languages, LANGUAGES_OPTIONS);

  await fs.mkdir(path.dirname(statsOutput), { recursive: true });
  await fs.mkdir(path.dirname(languagesOutput), { recursive: true });
  await fs.writeFile(statsOutput, statsSvg, "utf8");
  await fs.writeFile(languagesOutput, languagesSvg, "utf8");
};

const run = async () => {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      "stats-output": { type: "string" },
      "languages-output": { type: "string" },
    },
  });

  if (!values.input || !values["stats-output"] || !values["languages-output"]) {
    throw new Error("Use --input, --stats-output, and --languages-output.");
  }

  await renderSnapshot({
    input: values.input,
    statsOutput: values["stats-output"],
    languagesOutput: values["languages-output"],
  });
};

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

export { getStatsOptions, renderSnapshot };
