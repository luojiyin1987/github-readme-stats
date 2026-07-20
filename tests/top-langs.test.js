// @ts-check

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import topLangs from "../api/top-langs.js";
import { renderTopLanguages } from "../src/cards/top-languages.js";
import { renderError } from "../src/common/render.js";
import { CACHE_TTL, DURATIONS } from "../src/common/cache.js";

const data_langs = {
  data: {
    user: {
      repositories: {
        nodes: [
          {
            languages: {
              edges: [{ size: 150, node: { color: "#0f0", name: "HTML" } }],
            },
          },
          {
            languages: {
              edges: [{ size: 100, node: { color: "#0f0", name: "HTML" } }],
            },
          },
          {
            languages: {
              edges: [
                { size: 100, node: { color: "#0ff", name: "javascript" } },
              ],
            },
          },
          {
            languages: {
              edges: [
                { size: 100, node: { color: "#0ff", name: "javascript" } },
              ],
            },
          },
        ],
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
      message: "Could not fetch user",
    },
  ],
};

const langs = {
  HTML: {
    color: "#0f0",
    name: "HTML",
    size: 250,
    score: 1,
  },
  javascript: {
    color: "#0ff",
    name: "javascript",
    size: 200,
    score: 0.8,
  },
};

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe("Test /api/top-langs", () => {
  it("should test the request", async () => {
    const req = {
      query: {
        username: "anuraghazra",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(renderTopLanguages(langs));
  });

  it("should work with the query options", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        hide_title: true,
        card_width: 100,
        title_color: "fff",
        icon_color: "fff",
        text_color: "fff",
        bg_color: "fff",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderTopLanguages(langs, {
        hide_title: true,
        card_width: 100,
        title_color: "fff",
        icon_color: "fff",
        text_color: "fff",
        bg_color: "fff",
      }),
    );
  });

  it("should render error card on user data fetch error", async () => {
    const req = {
      query: {
        username: "anuraghazra",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, error);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: error.errors[0].message,
        secondaryMessage:
          "Make sure the provided username is not an organization",
      }),
    );
  });

  it("should render error card on incorrect layout input", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        layout: ["pie"],
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: "Something went wrong",
        secondaryMessage: "Incorrect layout input",
      }),
    );
  });

  it("should render error card if username in blacklist", async () => {
    const req = {
      query: {
        username: "renovate-bot",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: "This username is blacklisted",
        secondaryMessage: "Please deploy your own instance",
        renderOptions: { show_repo_link: false },
      }),
    );
  });

  it("should render error card if wrong locale provided", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        locale: "asdf",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: "Something went wrong",
        secondaryMessage: "Locale not found",
      }),
    );
  });

  it("should have proper cache", async () => {
    const req = {
      query: {
        username: "anuraghazra",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      `max-age=${CACHE_TTL.TOP_LANGS_CARD.DEFAULT}, ` +
        `s-maxage=${CACHE_TTL.TOP_LANGS_CARD.DEFAULT}, ` +
        `stale-while-revalidate=${DURATIONS.ONE_DAY}`,
    );
  });

  it("should compute a finite card for valid numeric weights (P1-10)", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        size_weight: "0",
        count_weight: "0",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(mock.history.post).toHaveLength(1);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    // size_weight=0 -> Math.pow(size, 0) = 1 for every language, so a finite
    // card must render with no NaN/Infinity leaking into the SVG output.
    const svg = res.send.mock.calls[0][0];
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
  });

  it("should display raw byte sizes in stats_format=bytes (P1-13)", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        stats_format: "bytes",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(mock.history.post).toHaveLength(1);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    const svg = res.send.mock.calls[0][0];
    // The raw byte size must be preserved (not overwritten by the normalized
    // weighted score), so bytes mode shows real sizes.
    expect(svg).toContain("250.0 B");
    expect(svg).toContain("200.0 B");
    expect(svg).not.toContain("undefined");
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
  });

  it.each([
    { size_weight: "abc" },
    { count_weight: "abc" },
    { size_weight: ["2", "1"] },
    { size_weight: "1e309" },
    { size_weight: "-1e309" },
    { size_weight: "" },
  ])(
    "should reject invalid weight %o without calling GitHub (P1-11)",
    async (query) => {
      const req = {
        query: { username: "anuraghazra", ...query },
      };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await topLangs(req, res);

      expect(mock.history.post).toHaveLength(0);
      expect(res.send).toHaveBeenCalledTimes(1);
      // P2: a client-side weight error must NOT prompt an issue link.
      const svg = res.send.mock.calls[0][0];
      expect(svg).toContain("Invalid language weight provided.");
      expect(svg).not.toContain("file an issue");
    },
  );

  const data_langs_large = {
    data: {
      user: {
        repositories: {
          nodes: [
            {
              languages: {
                edges: [{ size: 5000, node: { color: "#0f0", name: "HTML" } }],
              },
            },
            {
              languages: {
                edges: [
                  { size: 2000, node: { color: "#0ff", name: "javascript" } },
                ],
              },
            },
          ],
        },
      },
    },
  };

  it.each(["100", "-100"])(
    "should compute a finite card for extreme weight %s on large repos (P1-12)",
    async (weight) => {
      const req = {
        query: {
          username: "anuraghazra",
          size_weight: weight,
          count_weight: "0",
        },
      };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };
      mock
        .onPost("https://api.github.com/graphql")
        .reply(200, data_langs_large);

      await topLangs(req, res);

      expect(mock.history.post).toHaveLength(1);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "image/svg+xml",
      );
      const svg = res.send.mock.calls[0][0];
      // Previously `5000 ** 100` overflowed to Infinity (size_weight=100) and
      // large negative weights underflowed to 0 (0/0 -> NaN). Both extremes
      // must now render a finite, valid card.
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("Infinity");
      expect(svg).toContain("HTML");
      expect(svg).toContain("javascript");
    },
  );
});
