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

const getRetryDelay = (
  response,
  attempt,
  { primaryRateLimited, secondaryRateLimited },
) => {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (
    (primaryRateLimited || secondaryRateLimited) &&
    Number.isFinite(retryAfter) &&
    retryAfter > 0
  ) {
    return retryAfter * 1000;
  }
  if (primaryRateLimited) {
    const rateLimitReset = Number(response.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(rateLimitReset) && rateLimitReset > 0) {
      return Math.max(rateLimitReset * 1000 - Date.now(), REQUEST_DELAY_MS);
    }
  }
  if (secondaryRateLimited) {
    return Math.max(60_000, REQUEST_DELAY_MS * 2 ** attempt);
  }
  return REQUEST_DELAY_MS * 2 ** attempt;
};

const isSecondaryRateLimited = async (response) => {
  if (response.status !== 403 || typeof response.clone !== "function") {
    return false;
  }
  try {
    const body = await response.clone().json();
    return /secondary rate limit/i.test(body?.message || "");
  } catch {
    return false;
  }
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

    const primaryRateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          response.headers.has("retry-after")));
    const secondaryRateLimited = await isSecondaryRateLimited(response);
    const isRetryable =
      primaryRateLimited || secondaryRateLimited || response.status >= 500;
    if (!isRetryable || attempt === MAX_RETRIES) {
      throw new Error(`GitHub API request failed with status ${response.status}.`);
    }

    await sleepImpl(
      getRetryDelay(response, attempt, {
        primaryRateLimited,
        secondaryRateLimited,
      }),
    );
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

  const sourceRepositories = repositories.filter((repository) => !repository.fork);
  const languages = sourceRepositories.reduce((result, repository) => {
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
    schema_version: 2,
    generated_at: new Date().toISOString(),
    username,
    visibility_scope: "public",
    stats_scope: "public-basic",
    languages_scope: "primary-language-weighted-by-source-repository-size",
    available_fields: ["stars", "languages"],
    stats: {
      name: user.name || user.login || username,
      totalStars: repositories.reduce(
        (total, repository) => total + (repository.stargazers_count || 0),
        0,
      ),
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
