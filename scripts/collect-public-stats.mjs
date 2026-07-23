#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const API_ROOT = "https://api.github.com";
const REQUEST_DELAY_MS = 750;
const MAX_RETRIES = 3;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const getRetryDelay = (response, attempt) => {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  return REQUEST_DELAY_MS * 2 ** attempt;
};

const fetchPublicJson = async (url, { fetchImpl = fetch, sleepImpl = sleep } = {}) => {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        break;
      }
      await sleepImpl(REQUEST_DELAY_MS * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      return response.json();
    }

    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === MAX_RETRIES) {
      throw new Error(`GitHub API request failed with status ${response.status}.`);
    }

    await sleepImpl(getRetryDelay(response, attempt));
  }

  throw lastError || new Error("GitHub API request failed.");
};

const collectPublicStats = async ({
  username,
  fetchImpl = fetch,
  sleepImpl = sleep,
  requestDelayMs = REQUEST_DELAY_MS,
}) => {
  if (!username) {
    throw new Error("Missing username.");
  }

  const request = async (url) => {
    const result = await fetchPublicJson(url, { fetchImpl, sleepImpl });
    await sleepImpl(requestDelayMs);
    return result;
  };

  const user = await request(`${API_ROOT}/users/${encodeURIComponent(username)}`);
  const repositories = [];

  for (let page = 1; ; page += 1) {
    const currentPage = await request(
      `${API_ROOT}/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`,
    );
    repositories.push(...currentPage);
    if (currentPage.length < 100) {
      break;
    }
  }

  const languages = repositories.reduce((result, repository) => {
    if (!repository.language) {
      return result;
    }

    const current = result[repository.language] || {
      name: repository.language,
      color: "#858585",
      size: 0,
      count: 0,
    };
    current.size += Math.max(repository.size || 0, 1) * 1024;
    current.count += 1;
    result[repository.language] = current;
    return result;
  }, {});

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    username,
    stats: {
      name: user.name || user.login || username,
      totalStars: repositories.reduce(
        (total, repository) => total + (repository.stargazers_count || 0),
        0,
      ),
      totalCommits: 0,
      totalIssues: 0,
      totalPRs: 0,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 0,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      contributedTo: null,
      rank: { level: "C", percentile: 100 },
      followers: user.followers || 0,
      repositories: repositories.length,
    },
    languages,
  };
};

const writeSnapshot = async (outputPath, snapshot) => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.rename(temporaryPath, outputPath);
};

const run = async () => {
  const { values } = parseArgs({
    options: {
      username: { type: "string", short: "u" },
      output: { type: "string", short: "o" },
    },
  });

  if (!values.username || !values.output) {
    throw new Error("Use --username and --output.");
  }

  const snapshot = await collectPublicStats({ username: values.username });
  await writeSnapshot(values.output, snapshot);
};

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

export { collectPublicStats, fetchPublicJson, writeSnapshot };
