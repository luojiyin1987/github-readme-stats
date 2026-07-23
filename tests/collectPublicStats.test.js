import { describe, expect, it, jest } from "@jest/globals";

import {
  collectPublicStats,
  fetchPublicJson,
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
        {
          fork: true,
          language: "TypeScript",
          size: 3,
          stargazers_count: 0,
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
    expect(snapshot.schema_version).toBe(2);
    expect(snapshot.visibility_scope).toBe("public");
    expect(snapshot.available_fields).toEqual(["stars", "languages"]);
    expect(snapshot.languages_scope).toBe(
      "primary-language-weighted-by-source-repository-size",
    );
    expect(snapshot.stats).not.toHaveProperty("totalCommits");
    expect(snapshot.stats).not.toHaveProperty("rank");
    expect(snapshot.languages.JavaScript.size).toBe(2048);
    expect(snapshot.languages).not.toHaveProperty("TypeScript");
    expect(requests).toHaveLength(2);
    expect(
      requests.every(({ options }) => !options.headers.Authorization),
    ).toBe(true);
  });

  it("retries a rate-limited 403 response", async () => {
    const sleepImpl = jest.fn(async () => {});
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "x-ratelimit-remaining": "0" }),
      })
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      fetchPublicJson("https://api.github.com/test", { fetchImpl, sleepImpl }),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff for a 5xx response", async () => {
    const sleepImpl = jest.fn(async () => {});
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ "x-ratelimit-reset": "4102444800" }),
      })
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await fetchPublicJson("https://api.github.com/test", {
      fetchImpl,
      sleepImpl,
    });

    expect(sleepImpl).toHaveBeenCalledWith(750);
  });

  it("retries a secondary rate limit after one minute", async () => {
    const sleepImpl = jest.fn(async () => {});
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        clone: () => ({
          json: async () => ({
            message: "You have exceeded a secondary rate limit.",
          }),
        }),
      })
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await fetchPublicJson("https://api.github.com/test", {
      fetchImpl,
      sleepImpl,
    });

    expect(sleepImpl).toHaveBeenCalledWith(60_000);
  });
});
