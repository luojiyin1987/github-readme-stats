// @ts-check

import { describe, expect, it, jest } from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import api from "../api/index.js";
import topLangs from "../api/top-langs.js";
import pin from "../api/pin.js";
import gist from "../api/gist.js";
import wakatime from "../api/wakatime.js";

const mock = new MockAdapter(axios);

const buildRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
});

const cases = [
  {
    name: "stats",
    handler: api,
    query: { username: ["anuraghazra"] },
  },
  {
    name: "top-langs",
    handler: topLangs,
    query: { username: ["anuraghazra"] },
  },
  {
    name: "pin",
    handler: pin,
    query: { username: ["anuraghazra"], repo: "convoychat" },
  },
  {
    name: "gist",
    handler: gist,
    query: { id: ["abcdefabcdefabcdefabcd"] },
  },
  {
    name: "wakatime",
    handler: wakatime,
    query: { username: ["anuraghazra"] },
  },
];

describe("Error cache headers on invalid params (all API entry points)", () => {
  it.each(cases)(
    "should set error cache headers for /api/$name with invalid params",
    async ({ handler, query }) => {
      const req = { query };
      const res = buildRes();

      await handler(req, res);

      expect(mock.history.post).toHaveLength(0);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        expect.stringContaining("max-age="),
      );
    },
  );
});

describe("Error cache headers on every non-validation error path (P1-9)", () => {
  const localeCases = [
    {
      name: "stats",
      handler: api,
      query: { username: "anuraghazra", locale: "zzz" },
    },
    {
      name: "top-langs",
      handler: topLangs,
      query: { username: "anuraghazra", locale: "zzz" },
    },
    {
      name: "pin",
      handler: pin,
      query: { username: "anuraghazra", repo: "convoychat", locale: "zzz" },
    },
    {
      name: "gist",
      handler: gist,
      query: { id: "abcdefabcdefabcdefabcd", locale: "zzz" },
    },
    {
      name: "wakatime",
      handler: wakatime,
      query: { username: "anuraghazra", locale: "zzz" },
    },
  ];

  it.each(localeCases)(
    "should set error cache headers on unknown locale for /api/$name",
    async ({ handler, query }) => {
      const req = { query };
      const res = buildRes();

      await handler(req, res);

      expect(mock.history.post).toHaveLength(0);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        expect.stringContaining("max-age="),
      );
    },
  );

  it("should set error cache headers on invalid commits_year (stats)", async () => {
    const req = { query: { username: "anuraghazra", commits_year: "1800" } };
    const res = buildRes();

    await api(req, res);

    expect(mock.history.post).toHaveLength(0);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("max-age="),
    );
  });

  it("should set error cache headers on invalid layout (top-langs)", async () => {
    const req = { query: { username: "anuraghazra", layout: "bogus" } };
    const res = buildRes();

    await topLangs(req, res);

    expect(mock.history.post).toHaveLength(0);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("max-age="),
    );
  });

  it("should set error cache headers on invalid stats_format (top-langs)", async () => {
    const req = { query: { username: "anuraghazra", stats_format: "bogus" } };
    const res = buildRes();

    await topLangs(req, res);

    expect(mock.history.post).toHaveLength(0);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("max-age="),
    );
  });
});
