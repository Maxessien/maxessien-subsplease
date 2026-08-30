/**
 * Type definitions for @maxessien/subsplease.
 *
 * These map directly onto the shapes returned by the subsplease.org JSON API,
 * RSS feeds, and parsed HTML pages. Field names are normalized to camelCase;
 * the raw API uses snake_case (e.g. `image_url`, `release_date`).
 */

/** A day of the week, as used in the schedule response. */
export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

/** Possible torrent/magnet resolutions. `"sd"` appears in RSS filters. */
export type DownloadResolution = "480" | "720" | "1080" | "sd";

/** A single download link for an episode (magnet is always present; torrent/xdcc only on show-by-sid responses). */
export interface Download {
  /** Resolution label, e.g. "480", "720", "1080". */
  res: DownloadResolution;
  /** Magnet URI. */
  magnet: string;
  /** Direct .torrent URL (only present on `getShowBySid`/`getShow` episode downloads). */
  torrent?: string;
  /** XDCC search/query string (only present on `getShowBySid`/`getShow` episode downloads). */
  xdcc?: string;
}

/** One entry in the weekly schedule. */
export interface ScheduleEntry {
  /** Display title of the show. */
  title: string;
  /** URL slug used on subsplease, e.g. "grand-blue-s3". */
  page: string;
  /** Path to the show's poster image (joined to the base URL by the client). */
  imageUrl: string;
  /** Localized air time, e.g. "08:30". */
  time: string;
}

/** The full weekly schedule. */
export interface Schedule {
  /** Timezone the times are localized to. */
  timezone: string;
  /** Map of weekday to scheduled shows. */
  schedule: Record<Weekday, ScheduleEntry[]>;
}

/** A release returned by the latest feed or search. */
export interface Release {
  /** Full release title, e.g. "Rilakkuma - 22". */
  title: string;
  /** Show name only, e.g. "Rilakkuma". */
  show: string;
  /** Episode label, e.g. "22" or "01-12" (batches). */
  episode: string;
  /** Short status/time label, e.g. "New" or a relative time. */
  time: string;
  /** Raw release date string from the API, e.g. "Sat, 29 Aug 2026 09:00:25 +0800". */
  releaseDate: string;
  /** Available downloads. Latest/search releases only expose `magnet`. */
  downloads: Download[];
}

/** Response of `getLatest` and `search`. */
export interface LatestReleases {
  releases: Release[];
}

/** A show listed on the `/shows/` index page. */
export interface ShowListItem {
  /** URL slug, e.g. "rilakkuma". */
  slug: string;
  /** Display title. */
  title: string;
}

/** One episode of a show (from the show-by-sid API). */
export interface Episode {
  /** Full release title, e.g. "Rilakkuma - 22". */
  title: string;
  /** Show name. */
  show: string;
  /** Episode label. */
  episode: string;
  /** Short status/time label. */
  time: string;
  /** Raw release date string from the API. */
  releaseDate: string;
  /** Downloads (magnet + torrent + xdcc). */
  downloads: Download[];
}

/** Raw shape of the `/api/?f=show&sid=` response, before normalization. */
export interface ShowEpisodes {
  /** Batch releases (e.g. full cour packs). */
  batches: Episode[];
  /** Individual episode releases. */
  episodes: Episode[];
}

/** A full show, combining parsed page metadata with API episodes. */
export interface Show {
  /** Internal subsplease show id (from the show page HTML). */
  sid: number;
  /** URL slug. */
  slug: string;
  /** Display title. */
  title: string;
  /** Synopsis text, if present on the page. */
  synopsis?: string;
  /** Poster image URL (absolute), if present on the page. */
  imageUrl?: string;
  /** Batch releases. */
  batches: Episode[];
  /** Individual episode releases. */
  episodes: Episode[];
}

/** RSS feed type. `torrent` = .torrent links, `magnet` = magnet URIs. */
export type RssFeedType = "torrent" | "magnet";

/** RSS resolution filter. Only applies to magnet feeds; `all` = no filter. */
export type RssResolution = "sd" | "720" | "1080" | "all";

/** Options for `getRssFeed`. */
export interface RssFeedOptions {
  /** Feed type: torrent links or magnet links. */
  type?: RssFeedType;
  /** Resolution filter (magnet feeds only). Defaults to "all". */
  resolution?: RssResolution;
}

/** A single item in an RSS feed. */
export interface RssItem {
  /** Item title, e.g. "[SubsPlease] Rilakkuma - 22 (1080p) [48DA2737].mkv". */
  title: string;
  /** The link from the feed (a magnet URI for magnet feeds, a torrent/page URL otherwise). */
  link: string;
  /** Magnet URI, if the link is a magnet. */
  magnet?: string;
  /** Torrent/page URL, if the link is not a magnet. */
  torrent?: string;
  /** Publication date string. */
  pubDate: string;
  /** Item size, if reported. */
  size?: string;
  /** Description text, if present. */
  description?: string;
}

/** The parsed RSS feed. */
export interface RssFeed {
  /** Feed channel title. */
  title: string;
  /** Feed channel description. */
  description: string;
  /** Feed items. */
  items: RssItem[];
}

/** Options for constructing a client. */
export interface SubspleaseOptions {
  /** Base URL. Defaults to "https://subsplease.org". */
  baseUrl?: string;
  /** Default IANA timezone for schedule/latest/search/show, e.g. "America/New_York". Defaults to "Etc/GMT". */
  timezone?: string;
  /** Request timeout in ms. Defaults to 15000. */
  timeout?: number;
  /** Custom fetch implementation (Node < 18, tests, proxies). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
  /** User-Agent header. Defaults to a subsplease client UA. */
  userAgent?: string;
}

/** Error thrown by all client methods. */
export class SubspleaseError extends Error {
  /** HTTP status code, if the request reached the server. */
  readonly status?: number;
  /** The endpoint/URL that failed. */
  readonly endpoint: string;
  /** Underlying cause. */
  override readonly cause?: unknown;

  constructor(message: string, endpoint: string, status?: number, cause?: unknown) {
    super(message);
    this.name = "SubspleaseError";
    this.endpoint = endpoint;
    if (status !== undefined) {
      this.status = status;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
