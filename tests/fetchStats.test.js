import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { calculateRank } from "../src/calculateRank.js";
import { fetchStats } from "../src/fetchers/stats.js";

// Test parameters.
const data_stats = {
  data: {
    user: {
      name: "Anurag Hazra",
      contributions: {
        totalCommitContributions: 100,
      },
      pullRequests: { totalCount: 300 },
      mergedPullRequests: { totalCount: 240 },
      openIssues: { totalCount: 100 },
      closedIssues: { totalCount: 100 },
      followers: { totalCount: 100 },
      repositoryDiscussions: { totalCount: 10 },
      repositoryDiscussionComments: { totalCount: 40 },
    },
  },
};

const data_year2003 = JSON.parse(JSON.stringify(data_stats));
data_year2003.data.user.contributions.totalCommitContributions = 428;

const data_public_stats = {
  data: {
    user: {
      name: "Anurag Hazra",
      login: "anuraghazra",
      followers: { totalCount: 100 },
    },
  },
};

const data_repo_page1 = {
  data: {
    user: {
      repositories: {
        totalCount: 5,
        nodes: [
          { name: "test-repo-1", stargazers: { totalCount: 100 } },
          { name: "test-repo-2", stargazers: { totalCount: 100 } },
          { name: "test-repo-3", stargazers: { totalCount: 100 } },
        ],
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor",
        },
      },
    },
  },
};

const data_contributed_to = {
  data: {
    user: {
      repositoriesContributedTo: { totalCount: 61 },
    },
  },
};

const data_contributed_to_resource_limit = {
  errors: [
    {
      type: "RESOURCE_LIMITS_EXCEEDED",
      message: "Resource limits for this query exceeded.",
    },
  ],
};

const data_contributed_to_other_error = {
  errors: [
    {
      type: "SOME_OTHER_ERROR",
      message: "Something else went wrong.",
    },
  ],
};

const data_integration_access_error = {
  errors: [
    {
      type: "FORBIDDEN",
      message: "Resource not accessible by integration",
    },
  ],
};

const data_contributed_to_empty_user = {
  data: {
    user: null,
  },
};

const data_reviews = {
  data: {
    user: {
      contributions: {
        totalPullRequestReviewContributions: 50,
      },
    },
  },
};

const data_without_pull_requests = {
  data: {
    user: {
      ...data_stats.data.user,
      contributions: {
        ...data_stats.data.user.contributions,
        totalPullRequestReviewContributions: 50,
      },
      pullRequests: { totalCount: 0 },
      mergedPullRequests: { totalCount: 0 },
      repositories: data_repo_page1.data.user.repositories,
      repositoriesContributedTo: { totalCount: 61 },
    },
  },
};

const data_repo = {
  data: {
    user: {
      repositories: {
        nodes: [
          { name: "test-repo-4", stargazers: { totalCount: 50 } },
          { name: "test-repo-5", stargazers: { totalCount: 50 } },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: "cursor",
        },
      },
    },
  },
};

const data_repo_zero_stars = {
  data: {
    user: {
      repositories: {
        totalCount: 5,
        nodes: [
          { name: "test-repo-1", stargazers: { totalCount: 100 } },
          { name: "test-repo-2", stargazers: { totalCount: 100 } },
          { name: "test-repo-3", stargazers: { totalCount: 100 } },
          { name: "test-repo-4", stargazers: { totalCount: 0 } },
          { name: "test-repo-5", stargazers: { totalCount: 0 } },
        ],
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor",
        },
      },
    },
  },
};

const error = {
  errors: [
    {
      type: "NOT_FOUND",
      path: ["user"],
      locations: [],
      message: "Could not resolve to a User with the login of 'noname'.",
    },
  ],
};

const mock = new MockAdapter(axios);

beforeEach(() => {
  process.env.FETCH_MULTI_PAGE_STARS = "false"; // Set to `false` to fetch only one page of stars.
  mock.onPost("https://api.github.com/graphql").reply((cfg) => {
    let req = JSON.parse(cfg.data);

    if (req.query.includes("repositoriesContributedTo")) {
      return [200, data_contributed_to];
    }
    if (req.query.includes("totalPullRequestReviewContributions")) {
      return [200, data_reviews];
    }
    if (req.query.includes("query publicUserInfo")) {
      return [200, data_public_stats];
    }
    if (req.query.includes("totalCommitContributions")) {
      if (
        req.variables &&
        req.variables.startTime &&
        req.variables.startTime.startsWith("2003")
      ) {
        return [200, data_year2003];
      }
      return [200, data_stats];
    }
    return [200, req.variables.after ? data_repo : data_repo_page1];
  });
});

afterEach(() => {
  mock.reset();
});

describe("Test fetchStats", () => {
  it("should fetch correct stats", async () => {
    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should stop fetching when there are repos with zero stars", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_stats)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_repo_zero_stars)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_contributed_to)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_reviews);

    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should throw error", async () => {
    mock.reset();
    mock.onPost("https://api.github.com/graphql").reply(200, error);

    await expect(fetchStats("anuraghazra")).rejects.toThrow(
      "Could not resolve to a User with the login of 'noname'.",
    );
  });

  it("should return null contributedTo when repositoriesContributedTo hits RESOURCE_LIMITS_EXCEEDED", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_stats)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_repo_page1)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_contributed_to_resource_limit)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_reviews);

    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: null,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should omit inaccessible contributed repositories for an Actions token", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_stats)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_repo_page1)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_integration_access_error)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_reviews);

    const stats = await fetchStats("anuraghazra");

    expect(stats.contributedTo).toBeNull();
    expect(stats.totalReviews).toBe(50);
  });

  it("should omit inaccessible reviews for an Actions token", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_stats)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_repo_page1)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_contributed_to)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_integration_access_error);

    const stats = await fetchStats("anuraghazra");

    expect(stats.contributedTo).toBe(61);
    expect(stats.totalReviews).toBe(0);
  });

  it("should still fail when repositoriesContributedTo returns a non-resource-limit error", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_stats)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_repo_page1)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_contributed_to_other_error);

    await expect(fetchStats("anuraghazra")).rejects.toThrow(
      "Something else went wrong.",
    );
  });

  it("should return null contributedTo when contributed-to query returns empty user", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_stats)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_repo_page1)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_contributed_to_empty_user)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_reviews);

    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: null,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should fail when contributed-to request returns HTTP 500", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_stats)
      .onPost("https://api.github.com/graphql")
      .replyOnce(200, data_repo_page1)
      .onPost("https://api.github.com/graphql")
      .replyOnce(500, { message: "Internal Server Error" });

    await expect(fetchStats("anuraghazra")).rejects.toThrow(
      "Internal Server Error",
    );

    expect(mock.history.post).toHaveLength(3);
  });

  it("should fetch total commits", async () => {
    mock
      .onGet("https://api.github.com/search/commits?q=author:anuraghazra")
      .reply(200, { total_count: 1000 });

    let stats = await fetchStats("anuraghazra", true);
    const rank = calculateRank({
      all_commits: true,
      commits: 1000,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 1000,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should throw specific error when include_all_commits true and invalid username", async () => {
    await expect(fetchStats("asdf///---", true)).rejects.toThrow(
      new Error("Invalid username provided."),
    );
  });

  it("should use public fields when public_only is true", async () => {
    const graphqlQueries = [];
    mock.reset();
    mock.onPost("https://api.github.com/graphql").reply((cfg) => {
      const req = JSON.parse(cfg.data);
      graphqlQueries.push(req.query);

      if (req.query.includes("query publicUserInfo")) {
        return [200, data_public_stats];
      }
      if (req.query.includes("repositories(first")) {
        return [200, data_repo_page1];
      }
      return [200, data_integration_access_error];
    });
    const stats = await fetchStats(
      "anuraghazra",
      false,
      [],
      false,
      false,
      false,
      undefined,
      true,
    );

    expect(stats.totalCommits).toBe(0);
    expect(stats.totalPRs).toBe(0);
    expect(stats.totalIssues).toBe(0);
    expect(stats.contributedTo).toBeNull();
    expect(stats.totalReviews).toBe(0);
    expect(stats.totalStars).toBe(300);
    expect(mock.history.get).toHaveLength(0);
    expect(graphqlQueries).toHaveLength(2);
    expect(graphqlQueries.join("\n")).not.toContain("contributionsCollection");
    expect(graphqlQueries.join("\n")).not.toContain(
      "repositoriesContributedTo",
    );
    expect(graphqlQueries.join("\n")).not.toContain("pullRequests");
    expect(graphqlQueries.join("\n")).not.toContain("issues(");
  });

  it("should throw specific error when include_all_commits true and API returns error", async () => {
    mock
      .onGet("https://api.github.com/search/commits?q=author:anuraghazra")
      .reply(200, { error: "Some test error message" });

    await expect(fetchStats("anuraghazra", true)).rejects.toThrow(
      new Error("Could not fetch total commits."),
    );
  });

  it("should exclude stars of the `test-repo-1` repository", async () => {
    mock
      .onGet("https://api.github.com/search/commits?q=author:anuraghazra")
      .reply(200, { total_count: 1000 });

    let stats = await fetchStats("anuraghazra", true, ["test-repo-1"]);
    const rank = calculateRank({
      all_commits: true,
      commits: 1000,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 200,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 1000,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 200,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should fetch two pages of stars if 'FETCH_MULTI_PAGE_STARS' env variable is set to `true`", async () => {
    process.env.FETCH_MULTI_PAGE_STARS = true;

    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 400,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 400,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should fetch one page of stars if 'FETCH_MULTI_PAGE_STARS' env variable is set to `false`", async () => {
    process.env.FETCH_MULTI_PAGE_STARS = "false";

    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should fetch one page of stars if 'FETCH_MULTI_PAGE_STARS' env variable is not set", async () => {
    process.env.FETCH_MULTI_PAGE_STARS = undefined;

    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should not fetch additional stats data when it not requested", async () => {
    let stats = await fetchStats("anuraghazra");
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should fetch additional stats when it requested", async () => {
    let stats = await fetchStats("anuraghazra", false, [], true, true, true);
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 240,
      mergedPRsPercentage: 80,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 10,
      totalDiscussionsAnswered: 40,
      rank,
    });
  });

  it("should get commits of provided year", async () => {
    let stats = await fetchStats(
      "anuraghazra",
      false,
      [],
      false,
      false,
      false,
      2003,
    );

    const rank = calculateRank({
      all_commits: false,
      commits: 428,
      prs: 300,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 428,
      totalIssues: 200,
      totalPRs: 300,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });

  it("should return correct data when user don't have any pull requests", async () => {
    mock.reset();
    mock
      .onPost("https://api.github.com/graphql")
      .reply(200, data_without_pull_requests);
    const stats = await fetchStats("anuraghazra", false, [], true);
    const rank = calculateRank({
      all_commits: false,
      commits: 100,
      prs: 0,
      reviews: 50,
      issues: 200,
      repos: 5,
      stars: 300,
      followers: 100,
    });

    expect(stats).toStrictEqual({
      contributedTo: 61,
      name: "Anurag Hazra",
      totalCommits: 100,
      totalIssues: 200,
      totalPRs: 0,
      totalPRsMerged: 0,
      mergedPRsPercentage: 0,
      totalReviews: 50,
      totalStars: 300,
      totalDiscussionsStarted: 0,
      totalDiscussionsAnswered: 0,
      rank,
    });
  });
});
