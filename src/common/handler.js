// @ts-check

import { MissingParamError, retrieveSecondaryMessage } from "./error.js";
import { renderError } from "./render.js";
import { setErrorCacheHeaders } from "./cache.js";

/**
 * @typedef {object} CardColors
 * @property {string=} title_color
 * @property {string=} text_color
 * @property {string=} bg_color
 * @property {string=} border_color
 * @property {string=} theme
 */

/**
 * Render and send an error card, always attaching the project's error cache
 * headers so transient failures are not cached indefinitely by upstream CDNs.
 *
 * @param {object} res The response object.
 * @param {object} args Function arguments.
 * @param {string} args.message Main error message.
 * @param {string=} args.secondaryMessage Secondary error message.
 * @param {CardColors=} args.colors Card colors / theme for the error card.
 * @param {boolean=} args.showRepoLink Whether to show the repo link on the error
 *   card. Defaults to `true`; set `false` for client-side (param) errors.
 * @returns {any} The result of `res.send`.
 */
const sendError = (
  res,
  { message, secondaryMessage = "", colors = {}, showRepoLink = true },
) => {
  setErrorCacheHeaders(res);
  return res.send(
    renderError({
      message,
      secondaryMessage,
      renderOptions: {
        title_color: colors.title_color,
        text_color: colors.text_color,
        bg_color: colors.bg_color,
        border_color: colors.border_color,
        theme: colors.theme,
        show_repo_link: showRepoLink,
      },
    }),
  );
};

/**
 * Render and send an error card from a thrown error, used by the shared
 * `try/catch` wrapper of every API handler. Mirrors the prior per-handler
 * behavior: `MissingParamError` shows the repo link, other errors hide it by
 * default, and non-`Error` values fall back to a generic message.
 *
 * @param {object} res The response object.
 * @param {unknown} err The thrown value.
 * @param {CardColors=} colors Card colors / theme for the error card.
 * @returns {any} The result of `res.send`.
 */
const handleError = (res, err, colors = {}) => {
  if (err instanceof Error) {
    return sendError(res, {
      message: err.message,
      secondaryMessage: retrieveSecondaryMessage(err),
      colors,
      showRepoLink: !(err instanceof MissingParamError),
    });
  }
  return sendError(res, {
    message: "An unknown error occurred",
    colors,
    showRepoLink: true,
  });
};

export { sendError, handleError };
