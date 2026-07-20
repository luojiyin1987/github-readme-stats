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
