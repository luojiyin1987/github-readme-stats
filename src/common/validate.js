// @ts-check

import githubUsernameRegex from "github-username-regex";
import { CustomError } from "./error.js";

const REPO_NAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const GIST_ID_REGEX = /^[a-f0-9]{20,}$/i;

/**
 * Validate a GitHub username at the API boundary.
 *
 * @param {string} username The raw `username` query value.
 * @returns {void}
 * @throws {CustomError} When the username is missing or malformed.
 */
const validateUsername = (username) => {
  if (
    typeof username !== "string" ||
    !username ||
    !githubUsernameRegex.test(username)
  ) {
    throw new CustomError(
      "Invalid username provided.",
      CustomError.GITHUB_REST_API_ERROR,
    );
  }
};

/**
 * Validate a GitHub repository name at the API boundary.
 *
 * @param {string} reponame The raw `repo` query value.
 * @returns {void}
 * @throws {CustomError} When the name is missing or malformed.
 */
const validateRepoName = (reponame) => {
  if (
    typeof reponame !== "string" ||
    !reponame ||
    !REPO_NAME_REGEX.test(reponame)
  ) {
    throw new CustomError(
      "Invalid repository name provided.",
      CustomError.GITHUB_REST_API_ERROR,
    );
  }
};

/**
 * Validate a GitHub gist ID at the API boundary.
 *
 * @param {string} id The raw `id` query value.
 * @returns {void}
 * @throws {CustomError} When the id is missing or malformed.
 */
const validateGistId = (id) => {
  if (typeof id !== "string" || !id || !GIST_ID_REGEX.test(id)) {
    throw new CustomError(
      "Invalid gist ID provided.",
      CustomError.GITHUB_REST_API_ERROR,
    );
  }
};

export { validateUsername, validateRepoName, validateGistId };
