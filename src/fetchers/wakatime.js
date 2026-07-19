// @ts-check

import axios from "axios";
import { CustomError, MissingParamError } from "../common/error.js";

/**
 * WakaTime data fetcher.
 *
 * @param {{username: string, api_domain: string }} props Fetcher props.
 * @returns {Promise<import("./types").WakaTimeData>} WakaTime data response.
 */
const DEFAULT_WAKATIME_DOMAIN = "wakatime.com";

/**
 * Reject domains that could be used for SSRF: IP literals, private ranges,
 * credentials, ports, or embedded path/host separators.
 * @param {string} domain The api_domain value to validate.
 * @returns {boolean} True when the domain is a safe registered-name host.
 */
const isValidWakatimeDomain = (domain) => {
  if (typeof domain !== "string" || domain.length === 0) {
    return false;
  }
  // Only allow registered-name hosts (no scheme, userinfo, port, path, query).
  if (!/^[a-z0-9.-]+$/i.test(domain)) {
    return false;
  }
  // Reject IPv4 literals and IPv6 (brackets) to avoid intranet probing.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain) || domain.includes(":")) {
    return false;
  }
  // Block obviously private/internal hostnames.
  if (
    domain.endsWith(".internal") ||
    domain.endsWith(".local") ||
    domain.endsWith(".localhost") ||
    domain === "localhost"
  ) {
    return false;
  }
  return true;
};

const fetchWakatimeStats = async ({ username, api_domain }) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }

  const domain = api_domain
    ? api_domain.replace(/\/$/gi, "")
    : DEFAULT_WAKATIME_DOMAIN;
  if (!isValidWakatimeDomain(domain)) {
    throw new CustomError(
      `Invalid WakaTime api_domain: '${domain}'`,
      CustomError.WAKATIME_FETCH_ERROR,
    );
  }

  try {
    const { data } = await axios.get(
      `https://${domain}/api/v1/users/${username}/stats?is_including_today=true`,
    );

    return data.data;
  } catch (err) {
    const status = err?.response?.status;
    if (status >= 200 && status <= 299) {
      throw err;
    }
    if (status === 404) {
      throw new CustomError(
        `Could not resolve to a User with the login of '${username}'`,
        CustomError.WAKATIME_USER_NOT_FOUND,
      );
    }
    throw new CustomError(
      `Could not fetch WakaTime stats for '${username}'`,
      CustomError.WAKATIME_FETCH_ERROR,
    );
  }
};

export { fetchWakatimeStats };
export default fetchWakatimeStats;
