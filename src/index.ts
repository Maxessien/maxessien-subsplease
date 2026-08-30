/**
 * @maxessien/subsplease
 *
 * A typed API client that fetches and parses [subsplease.org](https://subsplease.org)
 * (anime subtitles) into clean, fully-typed responses: weekly schedules, the full
 * show list, per-show episodes with magnet/torrent/xdcc download links, search, and
 * RSS feeds.
 *
 * @example
 * ```ts
 * import { createSubsplease } from "@maxessien/subsplease";
 *
 * const sp = createSubsplease({ timezone: "America/New_York" });
 *
 * // Weekly schedule
 * const schedule = await sp.getSchedule();
 *
 * // Every show on the site
 * const shows = await sp.getShowsList();
 *
 * // Episodes + download links for a show (parses the show page, then the API)
 * const rilakkuma = await sp.getShow("rilakkuma");
 * for (const ep of rilakkuma.episodes) {
 *   const hd = ep.downloads.find((d) => d.res === "1080");
 *   console.log(ep.episode, hd?.magnet);
 * }
 * ```
 *
 * @module
 */

export type {
  SubspleaseOptions,
  Weekday,
  Schedule,
  ScheduleEntry,
  LatestReleases,
  Release,
  ShowListItem,
  Show,
  Episode,
  Download,
  DownloadResolution,
  ShowEpisodes,
  RssFeed,
  RssFeedOptions,
  RssItem,
  RssFeedType,
  RssResolution,
} from "./types.js";

export { SubspleaseError } from "./types.js";
export { createSubsplease, SubspleaseClient } from "./client.js";
