// @ts-check

import { renderStatsCard } from "../src/cards/stats.js";
import { guardAccess } from "../src/common/access.js";
import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
} from "../src/common/cache.js";
import { CustomError } from "../src/common/error.js";
import { validateUsername } from "../src/common/validate.js";
import { handleError, sendError } from "../src/common/handler.js";
import { parseArray, parseBoolean } from "../src/common/ops.js";
import { fetchStats } from "../src/fetchers/stats.js";
import { isLocaleAvailable } from "../src/translations.js";

// @ts-ignore
export default async (req, res) => {
  const {
    username,
    hide,
    hide_title,
    hide_border,
    card_width,
    hide_rank,
    show_icons,
    include_all_commits,
    commits_year,
    line_height,
    title_color,
    ring_color,
    icon_color,
    text_color,
    text_bold,
    bg_color,
    theme,
    cache_seconds,
    exclude_repo,
    custom_title,
    locale,
    disable_animations,
    border_radius,
    number_format,
    number_precision,
    border_color,
    rank_icon,
    show,
  } = req.query;
  res.setHeader("Content-Type", "image/svg+xml");

  const access = guardAccess({
    res,
    id: username,
    type: "username",
    colors: {
      title_color,
      text_color,
      bg_color,
      border_color,
      theme,
    },
  });
  if (!access.isPassed) {
    return access.result;
  }

  try {
    validateUsername(username);
  } catch (err) {
    return sendError(res, {
      message: "Something went wrong",
      secondaryMessage:
        err instanceof CustomError ? err.message : "Invalid username",
      colors: { title_color, text_color, bg_color, border_color, theme },
      showRepoLink: false,
    });
  }

  const colors = { title_color, text_color, bg_color, border_color, theme };

  try {
    if (locale && !isLocaleAvailable(locale)) {
      return sendError(res, {
        message: "Something went wrong",
        secondaryMessage: "Language not found",
        colors,
      });
    }

    const showStats = parseArray(show);

    let commitsYear;
    if (commits_year !== undefined && commits_year !== "") {
      const isValidYear =
        typeof commits_year === "string" && /^\d{4}$/.test(commits_year);
      const parsedYear = isValidYear ? Number(commits_year) : NaN;
      const currentYear = new Date().getUTCFullYear();
      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 2008 ||
        parsedYear > currentYear
      ) {
        return sendError(res, {
          message: "Something went wrong",
          secondaryMessage: "Invalid commits_year parameter",
          colors,
        });
      }
      commitsYear = parsedYear;
    }

    const stats = await fetchStats(
      username,
      parseBoolean(include_all_commits),
      parseArray(exclude_repo),
      showStats.includes("prs_merged") ||
        showStats.includes("prs_merged_percentage"),
      showStats.includes("discussions_started"),
      showStats.includes("discussions_answered"),
      commitsYear,
    );
    const cacheSeconds = resolveCacheSeconds({
      requested: parseInt(cache_seconds, 10),
      def: CACHE_TTL.STATS_CARD.DEFAULT,
      min: CACHE_TTL.STATS_CARD.MIN,
      max: CACHE_TTL.STATS_CARD.MAX,
    });

    setCacheHeaders(res, cacheSeconds);

    return res.send(
      renderStatsCard(stats, {
        hide: parseArray(hide),
        show_icons: parseBoolean(show_icons),
        hide_title: parseBoolean(hide_title),
        hide_border: parseBoolean(hide_border),
        card_width: parseInt(card_width, 10),
        hide_rank: parseBoolean(hide_rank),
        include_all_commits: parseBoolean(include_all_commits),
        commits_year: commitsYear,
        line_height,
        title_color,
        ring_color,
        icon_color,
        text_color,
        text_bold: parseBoolean(text_bold),
        bg_color,
        theme,
        custom_title,
        border_radius,
        border_color,
        number_format,
        number_precision: parseInt(number_precision, 10),
        locale: locale ? locale.toLowerCase() : null,
        disable_animations: parseBoolean(disable_animations),
        rank_icon,
        show: showStats,
      }),
    );
  } catch (err) {
    return handleError(res, err, colors);
  }
};
