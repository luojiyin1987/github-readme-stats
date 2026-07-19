// @ts-check

import axios from "axios";
import { CustomError, MissingParamError } from "../common/error.js";

/**
 * WakaTime data fetcher.
 *
 * @param {{username: string, api_domain: string }} props Fetcher props.
 * @returns {Promise<import("./types").WakaTimeData>} WakaTime data response.
 */
const fetchWakatimeStats = async ({ username, api_domain }) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }

  try {
    const { data } = await axios.get(
      `https://${
        api_domain ? api_domain.replace(/\/$/gi, "") : "wakatime.com"
      }/api/v1/users/${username}/stats?is_including_today=true`,
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
