import { describe, expect, it } from "@jest/globals";

import { collectPublicStats } from "../scripts/collect-public-stats.mjs";

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
    expect(snapshot.visibility_scope).toBe("public");
    expect(snapshot.available_fields).toEqual(["stars", "languages"]);
    expect(snapshot.stats).not.toHaveProperty("totalCommits");
    expect(snapshot.stats).not.toHaveProperty("rank");
    expect(snapshot.languages.JavaScript.size).toBe(2048);
    expect(requests).toHaveLength(2);
    expect(
      requests.every(({ options }) => !options.headers.Authorization),
    ).toBe(true);
  });
});
