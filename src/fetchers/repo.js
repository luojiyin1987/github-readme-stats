// @ts-check

import { MissingParamError } from "../common/error.js";
import { request } from "../common/http.js";
import { retryer } from "../common/retryer.js";

/**
 * Repo data fetcher.
 *
 * @param {object} variables Fetcher variables.
 * @param {string} token GitHub token.
 * @returns {Promise<import('axios').AxiosResponse>} The response.
 */

// Fields we need for a pinned repo card. Defined once as a reusable fragment
// so both the `user` and `organization` lookups below share the same shape.
const REPO_INFO_FRAGMENT = `
  fragment RepoInfo on Repository {
    name
    nameWithOwner # owner/name
    isPrivate # private repos are not pinnable
    isArchived
    isTemplate
    stargazers {
      totalCount # star count
    }
    description
    primaryLanguage {
      color
      id
      name
    }
    forkCount
  }
`;

const REPO_QUERY = `
  ${REPO_INFO_FRAGMENT}
  query getRepo($login: String!, $repo: String!) {
    # A repo may belong to a user or an organization with the same login.
    user(login: $login) {
      repository(name: $repo) {
        ...RepoInfo
      }
    }
    organization(login: $login) {
      repository(name: $repo) {
        ...RepoInfo
      }
    }
  }
`;

const fetcher = (variables, token) => {
  return request(
    {
      query: REPO_QUERY,
      variables,
    },
    {
      Authorization: `token ${token}`,
    },
  );
};

const urlExample = "/api/pin?username=USERNAME&amp;repo=REPO_NAME";

/**
 * @typedef {import("./types").RepositoryData} RepositoryData Repository data.
 */

/**
 * Fetch repository data.
 *
 * @param {string} username GitHub username.
 * @param {string} reponame GitHub repository name.
 * @returns {Promise<RepositoryData>} Repository data.
 */
const fetchRepo = async (username, reponame) => {
  if (!username && !reponame) {
    throw new MissingParamError(["username", "repo"], urlExample);
  }
  if (!username) {
    throw new MissingParamError(["username"], urlExample);
  }
  if (!reponame) {
    throw new MissingParamError(["repo"], urlExample);
  }

  let res = await retryer(fetcher, { login: username, repo: reponame });

  const data = res.data.data;

  if (!data.user && !data.organization) {
    throw new Error("Not found");
  }

  const isUser = data.organization === null && data.user;
  const isOrg = data.user === null && data.organization;

  if (isUser) {
    if (!data.user.repository || data.user.repository.isPrivate) {
      throw new Error("User Repository Not found");
    }
    return {
      ...data.user.repository,
      starCount: data.user.repository.stargazers.totalCount,
    };
  }

  if (isOrg) {
    if (
      !data.organization.repository ||
      data.organization.repository.isPrivate
    ) {
      throw new Error("Organization Repository Not found");
    }
    return {
      ...data.organization.repository,
      starCount: data.organization.repository.stargazers.totalCount,
    };
  }

  throw new Error("Unexpected behavior");
};

export { fetchRepo };
export default fetchRepo;
