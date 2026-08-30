import { requestJson, requestText, buildUrl, joinUrl, type RequestInitLike } from "./util.js";
import { SubspleaseError } from "./types.js";
import type {
  Episode,
  Download,
  DownloadResolution,
  Release,
  Schedule,
  ScheduleEntry,
  Weekday,
  LatestReleases,
  ShowListItem,
  Show,
  ShowEpisodes,
  RssFeed,
  RssFeedOptions,
  RssFeedType,
  RssResolution,
  SubspleaseOptions,
} from "./types.js";
import { parseShowsListHtml, parseShowPageHtml } from "./html.js";
import { parseRssXml } from "./rss.js";

const WEEKDAYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Raw API download object (snake_case keys, optional fields). */
interface RawDownload {
  res: string;
  magnet?: string;
  torrent?: string;
  xdcc?: string;
}

/** Raw API release/episode object. */
interface RawRelease {
  time: string;
  release_date: string;
  show: string;
  episode: string;
  downloads?: RawDownload[];
  image_url?: string;
  page?: string;
}

/** Raw schedule response from /api/?f=schedule. */
interface RawScheduleResponse {
  tz: string;
  schedule: Record<string, RawScheduleEntry[]>;
}

interface RawScheduleEntry {
  title: string;
  page: string;
  image_url: string;
  time: string;
}

/** Normalize a raw download into a typed Download (magnet required). */
function normalizeDownload(raw: RawDownload): Download | null {
  const magnet = raw.magnet;
  if (!magnet) return null;
  const res = normalizeResolution(raw.res);
  const download: Download = { res, magnet };
  if (raw.torrent) download.torrent = raw.torrent;
  if (raw.xdcc) download.xdcc = raw.xdcc;
  return download;
}

/** Map the API's resolution labels into the typed union. */
function normalizeResolution(res: string): DownloadResolution {
  const lower = res.toLowerCase();
  if (lower === "sd" || lower === "480" || lower === "480p") return "480";
  if (lower === "720" || lower === "720p") return "720";
  if (lower === "1080" || lower === "1080p") return "1080";
  return "1080";
}

/** Normalize a raw release/episode into the typed Episode shape. */
function normalizeEpisode(title: string, raw: RawRelease): Episode {
  const downloads = (raw.downloads ?? [])
    .map(normalizeDownload)
    .filter((d): d is Download => d !== null);
  return {
    title,
    show: raw.show,
    episode: raw.episode,
    time: raw.time,
    releaseDate: raw.release_date,
    downloads,
  };
}

/**
 * Subsplease API client. Construct via {@link createSubsplease}; do not use
 * `new` directly unless you are injecting a custom fetch transport.
 */
export class SubspleaseClient {
  private readonly baseUrl: string;
  private readonly timezone: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl?: typeof fetch;
  private readonly headers: Record<string, string>;
  private readonly userAgent: string;

  constructor(
    options: {
      baseUrl: string;
      timezone: string;
      timeoutMs: number;
      fetch?: typeof fetch;
      headers?: Record<string, string>;
      userAgent?: string;
    },
  ) {
    this.baseUrl = options.baseUrl;
    this.timezone = options.timezone;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetch;
    this.headers = { ...(options.headers ?? {}) };
    this.userAgent = options.userAgent ?? "@maxessien/subsplease/0.1 (+https://subsplease.org)";
  }

  /** Resolve a timezone for a call: the per-call override, else the default. */
  private tz(override?: string): string {
    return (override ?? this.timezone) || "Etc/GMT";
  }

  /** Build the shared request init for fetch wrappers. */
  private requestInit(): RequestInitLike {
    return {
      fetch: this.fetchImpl,
      headers: this.headers,
      timeoutMs: this.timeoutMs,
      userAgent: this.userAgent,
    };
  }

  /**
   * Fetch the weekly schedule.
   * @param timezone Optional IANA timezone for this call only.
   */
  async getSchedule(timezone?: string): Promise<Schedule> {
    const tz = this.tz(timezone);
    const url = buildUrl(this.baseUrl, "/api/", { f: "schedule", tz });
    const raw = await requestJson<RawScheduleResponse>(url, this.requestInit());

    const schedule = {} as Record<Weekday, ScheduleEntry[]>;
    for (const day of WEEKDAYS) {
      const entries = raw.schedule[day] ?? [];
      schedule[day] = entries.map((e) => ({
        title: e.title,
        page: e.page,
        imageUrl: joinUrl(this.baseUrl, e.image_url),
        time: e.time,
      }));
    }

    return { timezone: raw.tz, schedule };
  }

  /**
   * Fetch the latest releases feed (paginated).
   * @param options.page Page number, 1-based. Defaults to 1.
   * @param options.timezone Optional IANA timezone for this call only.
   */
  async getLatest(options?: { page?: number; timezone?: string }): Promise<LatestReleases> {
    const page = options?.page ?? 1;
    const tz = this.tz(options?.timezone);
    const url = buildUrl(this.baseUrl, "/api/", { f: "latest", tz, p: page });
    const raw = await requestJson<Record<string, RawRelease>>(url, this.requestInit());
    const releases = Object.entries(raw).map(([title, r]) => this.normalizeRelease(title, r));
    return { releases };
  }

  /**
   * Search releases by term.
   * @param term Search query.
   * @param options.timezone Optional IANA timezone for this call only.
   */
  async search(term: string, options?: { timezone?: string }): Promise<LatestReleases> {
    const tz = this.tz(options?.timezone);
    const url = buildUrl(this.baseUrl, "/api/", { f: "search", tz, s: term });
    const raw = await requestJson<Record<string, RawRelease>>(url, this.requestInit());
    const releases = Object.entries(raw).map(([title, r]) => this.normalizeRelease(title, r));
    return { releases };
  }

  /** Normalize a latest/search release (magnet-only downloads). */
  private normalizeRelease(title: string, raw: RawRelease): Release {
    const downloads = (raw.downloads ?? [])
      .map(normalizeDownload)
      .filter((d): d is Download => d !== null);
    return {
      title,
      show: raw.show,
      episode: raw.episode,
      time: raw.time,
      releaseDate: raw.release_date,
      downloads,
    };
  }

  /**
   * Fetch every show listed on the `/shows/` index page (slug + title).
   */
  async getShowsList(): Promise<ShowListItem[]> {
    const url = buildUrl(this.baseUrl, "/shows/", undefined);
    const html = await requestText(url, this.requestInit());
    return parseShowsListHtml(html);
  }

  /**
   * Fetch a show by URL slug. Parses the show page for its internal `sid`,
   * title, synopsis, and image, then fetches episodes + batches from the API.
   * @param slug Show slug, e.g. "rilakkuma".
   * @param options.timezone Optional IANA timezone for this call only.
   */
  async getShow(slug: string, options?: { timezone?: string }): Promise<Show> {
    const tz = this.tz(options?.timezone);
    const pageUrl = buildUrl(this.baseUrl, `/shows/${slug}/`, undefined);
    const html = await requestText(pageUrl, this.requestInit());
    const meta = parseShowPageHtml(html, this.baseUrl);

    if (meta.sid === null) {
      throw new SubspleaseError(
        `Could not find a show id (sid) on the show page for "${slug}"`,
        pageUrl,
      );
    }

    const bySid = await this.getShowBySid(meta.sid, tz);
    const show: Show = {
      sid: meta.sid,
      slug,
      title: meta.title ?? slug,
      episodes: bySid.episodes,
      batches: bySid.batches,
    };
    if (meta.synopsis) show.synopsis = meta.synopsis;
    if (meta.imageUrl) show.imageUrl = meta.imageUrl;
    return show;
  }

  /**
   * Fetch episodes + batches for a show by its internal subsplease id (`sid`).
   * @param sid Internal show id (found on the show page HTML).
   * @param timezone Optional IANA timezone for this call only.
   */
  async getShowBySid(sid: number, timezone?: string): Promise<ShowEpisodes> {
    const tz = this.tz(timezone);
    const url = buildUrl(this.baseUrl, "/api/", { f: "show", tz, sid });
    const raw = await requestJson<{
      batch: Record<string, RawRelease>;
      episode: Record<string, RawRelease>;
    }>(url, this.requestInit());

    const episodes = Object.entries(raw.episode ?? {}).map(([title, r]) =>
      normalizeEpisode(title, r),
    );
    const batches = Object.entries(raw.batch ?? {}).map(([title, r]) =>
      normalizeEpisode(title, r),
    );

    return { episodes, batches };
  }

  /**
   * Fetch an RSS feed (torrent or magnet, optionally filtered by resolution).
   * @param options.type "torrent" (.torrent links) or "magnet". Defaults to "torrent".
   * @param options.resolution Resolution filter for magnet feeds. Defaults to "all".
   */
  async getRssFeed(options?: RssFeedOptions): Promise<RssFeed> {
    const type: RssFeedType = options?.type ?? "torrent";
    const resolution: RssResolution = options?.resolution ?? "all";

    let path: string;
    if (type === "torrent") {
      path = resolution === "all" ? "/rss/?t" : `/rss/?t&r=${resolution}`;
    } else {
      path = resolution === "all" ? "/rss/?r=all" : `/rss/?r=${resolution}`;
    }

    const url = buildUrl(this.baseUrl, path, undefined);
    const xml = await requestText(url, this.requestInit());
    return parseRssXml(xml);
  }

  /** The base URL this client is configured with. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** The default timezone this client uses. */
  getDefaultTimezone(): string {
    return this.timezone;
  }
}

/**
 * Create a Subsplease client.
 * @example
 * ```ts
 * const sp = createSubsplease({ timezone: "America/New_York" });
 * ```
 */
export function createSubsplease(options?: SubspleaseOptions): SubspleaseClient {
  const baseUrl = (options?.baseUrl ?? "https://subsplease.org").replace(/\/$/, "");
  return new SubspleaseClient({
    baseUrl,
    timezone: options?.timezone ?? "Etc/GMT",
    timeoutMs: options?.timeout ?? 15000,
    fetch: options?.fetch,
    headers: options?.headers,
    userAgent: options?.userAgent,
  });
}
