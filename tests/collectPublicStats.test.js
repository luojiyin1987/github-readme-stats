import { describe, expect, it, jest } from "@jest/globals";

import {
  collectProfileStats,
  collectPublicStats,
} from "../scripts/collect-public-stats.mjs";

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => data,
});

describe("collectPublicStats", () => {
  it("collects public profile and repository data without authorization", async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/users/octocat")) {
        return jsonResponse({
          name: "The Octocat",
          login: "octocat",
          followers: 10,
        });
      }
      return jsonResponse([
        {
          language: "JavaScript",
          size: 2,
          stargazers_count: 4,
        },
      ]);
    };

    const snapshot = await collectPublicStats({
      username: "octocat",
      fetchImpl,
      sleepImpl: async () => {},
      requestDelayMs: 0,
    });

    expect(snapshot.stats.totalStars).toBe(4);
    expect(snapshot.languages.JavaScript.size).toBe(2048);
    expect(requests).toHaveLength(2);
    expect(
      requests.every(({ options }) => !options.headers.Authorization),
    ).toBe(true);
  });

  it("uses the token-backed fetchers for rank data", async () => {
    const stats = {
      name: "The Octocat",
      totalStars: 4,
      totalCommits: 10,
      totalIssues: 2,
      totalPRs: 3,
      totalPRsMerged: 1,
      mergedPRsPercentage: 33.3,
      totalReviews: 5,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      contributedTo: 2,
      rank: { level: "A", percentile: 20 },
    };
    const languages = {
      JavaScript: {
        name: "JavaScript",
        color: "#f1e05a",
        size: 2048,
        count: 1,
      },
    };
    const fetchStatsImpl = jest.fn(async () => stats);
    const fetchTopLanguagesImpl = jest.fn(async () => languages);

    const snapshot = await collectProfileStats({
      username: "octocat",
      token: "test-token",
      fetchStatsImpl,
      fetchTopLanguagesImpl,
    });

    expect(snapshot.stats.rank.level).toBe("A");
    expect(snapshot.languages).toBe(languages);
    expect(fetchStatsImpl).toHaveBeenCalledWith("octocat");
    expect(fetchTopLanguagesImpl).toHaveBeenCalledWith("octocat");
  });
});
