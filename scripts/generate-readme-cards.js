#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import statsHandler from "../api/index.js";
import topLangsHandler from "../api/top-langs.js";
import { parseBoolean } from "../src/common/ops.js";
import { renderStatsCard } from "../src/cards/stats.js";
import { renderTopLanguages } from "../src/cards/top-languages.js";
import { fetchStats } from "../src/fetchers/stats.js";
import { fetchTopLanguages } from "../src/fetchers/top-languages.js";

const DEFAULT_STATS_OPTIONS = {
  show_icons: true,
  hide_border: true,
  title_color: "0891b2",
  text_color: "ffffff",
  icon_color: "0891b2",
  bg_color: "1c1917",
};

const DEFAULT_TOP_LANGS_OPTIONS = {
  langs_count: 10,
  hide_border: true,
  title_color: "0891b2",
  text_color: "ffffff",
  icon_color: "0891b2",
  bg_color: "1c1917",
  locale: "en",
};

const USAGE = `
Generate static GitHub README cards.

Usage:
  node scripts/generate-readme-cards --username <name> [options]

Options:
  --username           GitHub username (or set GITHUB_USERNAME)
  --output-dir         Output directory (default: generated)
  --stats-output       Override stats SVG output path
  --top-langs-output   Override top languages SVG output path
  --stats-query        Query string or URL for stats card (or STATS_QUERY)
  --top-langs-query    Query string or URL for top languages (or TOP_LANGS_QUERY)
  --stats-options      JSON string of stats options (or STATS_OPTIONS)
  --top-langs-options  JSON string of top language options (or TOP_LANGS_OPTIONS)
  --dry-run            Use sample data (no API calls)
  -h, --help           Show this help text
`;

const parseJson = (value, label) => {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${error.message}`);
  }
};

const parseQueryInput = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  let queryString = trimmed;
  if (
    trimmed.includes("?") ||
    trimmed.startsWith("http") ||
    trimmed.startsWith("/")
  ) {
    try {
      queryString = new URL(trimmed, "http://localhost").search;
    } catch {
      queryString = trimmed;
    }
  }
  if (queryString.startsWith("?")) {
    queryString = queryString.slice(1);
  }
  return Object.fromEntries(new URLSearchParams(queryString));
};

const runApiHandler = async (handler, query) => {
  let body = "";
  const res = {
    setHeader: () => {},
    send: (value) => {
      body = value;
      return value;
    },
  };
  const req = { query };
  await handler(req, res);
  return body;
};

const toArray = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeStatsOptions = (options) => {
  return {
    ...options,
    hide: toArray(options.hide),
    show: toArray(options.show),
  };
};

const normalizeTopLangsOptions = (options) => {
  return {
    ...options,
    hide: toArray(options.hide),
    langs_count:
      options.langs_count === undefined
        ? undefined
        : Number(options.langs_count),
  };
};

const buildStatsFetchOptions = (options) => {
  const show = toArray(options.show);
  return {
    includeAllCommits: Boolean(options.include_all_commits),
    excludeRepo: toArray(options.exclude_repo),
    includeMergedPullRequests:
      show.includes("prs_merged") || show.includes("prs_merged_percentage"),
    includeDiscussions: show.includes("discussions_started"),
    includeDiscussionsAnswers: show.includes("discussions_answered"),
    commitsYear:
      options.commits_year === undefined
        ? undefined
        : Number(options.commits_year),
  };
};

const buildTopLangsFetchOptions = (options) => {
  return {
    excludeRepo: toArray(options.exclude_repo),
    sizeWeight:
      options.size_weight === undefined ? 1 : Number(options.size_weight),
    countWeight:
      options.count_weight === undefined ? 0 : Number(options.count_weight),
  };
};

const getSampleStats = (username) => {
  return {
    name: username || "Octocat",
    totalStars: 1234,
    totalCommits: 5678,
    totalIssues: 42,
    totalPRs: 120,
    totalPRsMerged: 85,
    mergedPRsPercentage: 70.8,
    totalReviews: 64,
    totalDiscussionsStarted: 3,
    totalDiscussionsAnswered: 9,
    contributedTo: 18,
    rank: { level: "A", percentile: 10 },
  };
};

const getSampleTopLangs = () => {
  return {
    JavaScript: {
      name: "JavaScript",
      color: "#f1e05a",
      size: 70000,
      count: 6,
    },
    TypeScript: {
      name: "TypeScript",
      color: "#2b7489",
      size: 52000,
      count: 4,
    },
    HTML: {
      name: "HTML",
      color: "#e34c26",
      size: 24000,
      count: 3,
    },
    CSS: {
      name: "CSS",
      color: "#563d7c",
      size: 18000,
      count: 2,
    },
  };
};

const ensureToken = ({ dryRun }) => {
  if (dryRun) {
    return;
  }
  process.env.PAT_1 = process.env.PAT_1 || process.env.GITHUB_TOKEN;
  if (!process.env.PAT_1) {
    throw new Error(
      "Missing GitHub token. Set GITHUB_TOKEN or PAT_1 environment variable.",
    );
  }
};

const resolveOutputPath = ({ outputDir, filename, explicitPath }) => {
  if (explicitPath) {
    return explicitPath;
  }
  return path.join(outputDir, filename);
};

export const generateReadmeCards = async ({
  username,
  outputDir = "generated",
  statsOutput,
  topLangsOutput,
  statsOptions = {},
  topLangsOptions = {},
  statsQuery,
  topLangsQuery,
  dryRun = false,
} = {}) => {
  const resolvedStatsQuery = parseQueryInput(statsQuery);
  const resolvedTopLangsQuery = parseQueryInput(topLangsQuery);
  const resolvedUsername =
    username || resolvedStatsQuery?.username || resolvedTopLangsQuery?.username;
  const hasStatsQuery =
    resolvedStatsQuery && Object.keys(resolvedStatsQuery).length > 0;
  const hasTopLangsQuery =
    resolvedTopLangsQuery && Object.keys(resolvedTopLangsQuery).length > 0;

  if (!resolvedUsername) {
    throw new Error(
      "Missing --username (or GITHUB_USERNAME) and no username in query.",
    );
  }
  if (dryRun && (hasStatsQuery || hasTopLangsQuery)) {
    throw new Error(
      "dry-run cannot be used with --stats-query or --top-langs-query.",
    );
  }

  ensureToken({ dryRun });

  const normalizedStatsOptions = normalizeStatsOptions({
    ...DEFAULT_STATS_OPTIONS,
    ...statsOptions,
  });
  const normalizedTopLangsOptions = normalizeTopLangsOptions({
    ...DEFAULT_TOP_LANGS_OPTIONS,
    ...topLangsOptions,
  });

  const statsPath = resolveOutputPath({
    outputDir,
    filename: `${resolvedUsername}-stats.svg`,
    explicitPath: statsOutput,
  });
  const topLangsPath = resolveOutputPath({
    outputDir,
    filename: `${resolvedUsername}-top-langs.svg`,
    explicitPath: topLangsOutput,
  });

  if (statsPath === topLangsPath) {
    throw new Error("Stats and top languages output paths must be different.");
  }

  await fs.mkdir(path.dirname(statsPath), { recursive: true });
  await fs.mkdir(path.dirname(topLangsPath), { recursive: true });

  const statsFetchOptions = hasStatsQuery
    ? null
    : buildStatsFetchOptions(normalizedStatsOptions);
  const topLangsFetchOptions = hasTopLangsQuery
    ? null
    : buildTopLangsFetchOptions(normalizedTopLangsOptions);

  const stats = hasStatsQuery
    ? null
    : dryRun
      ? getSampleStats(resolvedUsername)
      : await fetchStats(
          resolvedUsername,
          statsFetchOptions.includeAllCommits,
          statsFetchOptions.excludeRepo,
          statsFetchOptions.includeMergedPullRequests,
          statsFetchOptions.includeDiscussions,
          statsFetchOptions.includeDiscussionsAnswers,
          statsFetchOptions.commitsYear,
        );

  const topLangs = hasTopLangsQuery
    ? null
    : dryRun
      ? getSampleTopLangs()
      : await fetchTopLanguages(
          resolvedUsername,
          topLangsFetchOptions.excludeRepo,
          topLangsFetchOptions.sizeWeight,
          topLangsFetchOptions.countWeight,
        );

  const statsSvg = hasStatsQuery
    ? await runApiHandler(statsHandler, resolvedStatsQuery)
    : renderStatsCard(stats, normalizedStatsOptions);
  const topLangsSvg = hasTopLangsQuery
    ? await runApiHandler(topLangsHandler, resolvedTopLangsQuery)
    : renderTopLanguages(topLangs, normalizedTopLangsOptions);

  await fs.writeFile(statsPath, statsSvg, "utf8");
  await fs.writeFile(topLangsPath, topLangsSvg, "utf8");

  return { statsPath, topLangsPath };
};

const run = async () => {
  const { values } = parseArgs({
    options: {
      username: { type: "string", short: "u" },
      "output-dir": { type: "string" },
      "stats-output": { type: "string" },
      "top-langs-output": { type: "string" },
      "stats-query": { type: "string" },
      "top-langs-query": { type: "string" },
      "stats-options": { type: "string" },
      "top-langs-options": { type: "string" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }

  const username = values.username || process.env.GITHUB_USERNAME;
  const outputDir =
    values["output-dir"] || process.env.OUTPUT_DIR || "generated";
  const statsQuery = parseQueryInput(
    values["stats-query"] || process.env.STATS_QUERY,
  );
  const topLangsQuery = parseQueryInput(
    values["top-langs-query"] || process.env.TOP_LANGS_QUERY,
  );

  const statsOptions = {
    ...parseJson(values["stats-options"] || process.env.STATS_OPTIONS, "stats"),
  };
  const topLangsOptions = {
    ...parseJson(
      values["top-langs-options"] || process.env.TOP_LANGS_OPTIONS,
      "top-langs",
    ),
  };

  const dryRunFlag = values["dry-run"] ?? process.env.DRY_RUN;
  const dryRun = parseBoolean(dryRunFlag) ?? false;

  const { statsPath, topLangsPath } = await generateReadmeCards({
    username,
    outputDir,
    statsOutput: values["stats-output"],
    topLangsOutput: values["top-langs-output"],
    statsOptions,
    topLangsOptions,
    statsQuery,
    topLangsQuery,
    dryRun,
  });

  process.stdout.write(`Wrote SVGs:\n- ${statsPath}\n- ${topLangsPath}\n`);
};

const modulePath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isDirectRun =
  argvPath === modulePath || argvPath === modulePath.replace(/\.js$/, "");

if (isDirectRun) {
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
