// @ts-check

import { renderRepoCard } from "../src/cards/repo.js";
import { guardAccess } from "../src/common/access.js";
import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
} from "../src/common/cache.js";
import { CustomError } from "../src/common/error.js";
import { validateRepoName, validateUsername } from "../src/common/validate.js";
import { handleError, sendError } from "../src/common/handler.js";
import { parseBoolean } from "../src/common/ops.js";
import { fetchRepo } from "../src/fetchers/repo.js";
import { isLocaleAvailable } from "../src/translations.js";

// @ts-ignore
export default async (req, res) => {
  const {
    username,
    repo,
    hide_border,
    title_color,
    icon_color,
    text_color,
    bg_color,
    theme,
    show_owner,
    cache_seconds,
    locale,
    border_radius,
    border_color,
    description_lines_count,
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
    validateRepoName(repo);
  } catch (err) {
    return sendError(res, {
      message: "Something went wrong",
      secondaryMessage:
        err instanceof CustomError ? err.message : "Invalid username or repo",
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

    const repoData = await fetchRepo(username, repo);
    const cacheSeconds = resolveCacheSeconds({
      requested: parseInt(cache_seconds, 10),
      def: CACHE_TTL.PIN_CARD.DEFAULT,
      min: CACHE_TTL.PIN_CARD.MIN,
      max: CACHE_TTL.PIN_CARD.MAX,
    });

    setCacheHeaders(res, cacheSeconds);

    return res.send(
      renderRepoCard(repoData, {
        hide_border: parseBoolean(hide_border),
        title_color,
        icon_color,
        text_color,
        bg_color,
        theme,
        border_radius,
        border_color,
        show_owner: parseBoolean(show_owner),
        locale: locale ? locale.toLowerCase() : null,
        description_lines_count,
      }),
    );
  } catch (err) {
    return handleError(res, err, colors);
  }
};
