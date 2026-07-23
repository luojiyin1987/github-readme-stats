// @ts-check

import { isLocaleAvailable } from "../src/translations.js";
import { renderGistCard } from "../src/cards/gist.js";
import { fetchGist } from "../src/fetchers/gist.js";
import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
} from "../src/common/cache.js";
import { guardAccess } from "../src/common/access.js";
import { CustomError } from "../src/common/error.js";
import { validateGistId } from "../src/common/validate.js";
import { handleError, sendError } from "../src/common/handler.js";
import { parseBoolean } from "../src/common/ops.js";

// @ts-ignore
export default async (req, res) => {
  const {
    id,
    title_color,
    icon_color,
    text_color,
    bg_color,
    theme,
    cache_seconds,
    locale,
    border_radius,
    border_color,
    show_owner,
    hide_border,
  } = req.query;

  res.setHeader("Content-Type", "image/svg+xml");

  const access = guardAccess({
    res,
    id,
    type: "gist",
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
    validateGistId(id);
  } catch (err) {
    return sendError(res, {
      message: "Something went wrong",
      secondaryMessage:
        err instanceof CustomError ? err.message : "Invalid gist ID",
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

    const gistData = await fetchGist(id);
    const cacheSeconds = resolveCacheSeconds({
      requested: parseInt(cache_seconds, 10),
      def: CACHE_TTL.GIST_CARD.DEFAULT,
      min: CACHE_TTL.GIST_CARD.MIN,
      max: CACHE_TTL.GIST_CARD.MAX,
    });

    setCacheHeaders(res, cacheSeconds);

    return res.send(
      renderGistCard(gistData, {
        title_color,
        icon_color,
        text_color,
        bg_color,
        theme,
        border_radius,
        border_color,
        locale: locale ? locale.toLowerCase() : null,
        show_owner: parseBoolean(show_owner),
        hide_border: parseBoolean(hide_border),
      }),
    );
  } catch (err) {
    return handleError(res, err, colors);
  }
};
