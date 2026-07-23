import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { getStatsOptions, renderSnapshot } from "../scripts/render-stats.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true })),
  );
});

describe("renderSnapshot", () => {
  it("hides fields that are not available in the snapshot", () => {
    expect(getStatsOptions(["stars", "languages"])).toMatchObject({
      hide: ["commits", "prs", "issues", "contribs"],
      hide_rank: true,
    });
  });

  it("renders both cards from a public snapshot", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "grs-render-"));
    temporaryDirectories.push(directory);
    const input = path.join(directory, "stats.json");
    const statsOutput = path.join(directory, "stats.svg");
    const languagesOutput = path.join(directory, "top-langs.svg");

    await fs.writeFile(
      input,
      JSON.stringify({
        stats: {
          name: "Octocat",
          totalStars: 4,
        },
        available_fields: ["stars", "languages"],
        languages: {
          JavaScript: {
            name: "JavaScript",
            color: "#858585",
            size: 1024,
            count: 1,
          },
        },
      }),
    );

    await renderSnapshot({ input, statsOutput, languagesOutput });

    await expect(fs.readFile(statsOutput, "utf8")).resolves.toContain("<svg");
    await expect(fs.readFile(languagesOutput, "utf8")).resolves.toContain(
      "<svg",
    );
  });
});
