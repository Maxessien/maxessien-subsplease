# @maxessien/subsplease

A typed API client that fetches and parses [subsplease.org](https://subsplease.org)
(anime subtitles) into clean, fully-typed responses: weekly schedules, the full
show list, per-show episodes with magnet/torrent/xdcc download links, release
search, and RSS feeds.

Works in Node 18+ and modern browsers (uses global `fetch`). No runtime
dependencies beyond [`cheerio`](https://github.com/cheeriojs/cheerio) for HTML
parsing.

## Install

```sh
npm install @maxessien/subsplease
# or
bun add @maxessien/subsplease
```

## Quick start

```ts
import { createSubsplease } from "@maxessien/subsplease";

const sp = createSubsplease({ timezone: "America/New_York" });

// Weekly schedule, localized to your timezone
const schedule = await sp.getSchedule();
for (const [day, entries] of Object.entries(schedule.schedule)) {
  for (const show of entries) {
    console.log(day, show.time, show.title);
  }
}

// Every show on the site (slug + title)
const shows = await sp.getShowsList();

// Episodes + download links for a show. This parses the show page for its
// internal id, then fetches episode magnet/torrent/xdcc links.
const rilakkuma = await sp.getShow("rilakkuma");
for (const ep of rilakkuma.episodes) {
  const hd = ep.downloads.find((d) => d.res === "1080");
  console.log(`Episode ${ep.episode}: ${hd?.magnet}`);
}

// Latest releases feed (paginated)
const latest = await sp.getLatest({ page: 1 });

// Search
const results = await sp.search("frieren");

// RSS: magnet links at 1080p
const feed = await sp.getRssFeed({ type: "magnet", resolution: "1080" });
```

## API

### `createSubsplease(options?)`

Create a client.

| Option | Type | Default |
|---|---|---|
| `baseUrl` | `string` | `"https://subsplease.org"` |
| `timezone` | `string` (IANA) | `"Etc/GMT"` |
| `timeout` | `number` (ms) | `15000` |
| `fetch` | `typeof fetch` | global `fetch` |
| `headers` | `Record<string, string>` | `{}` |
| `userAgent` | `string` | `"@maxessien/subsplease/0.1 ..."` |

### Methods

| Method | Returns | Description |
|---|---|---|
| `getSchedule(timezone?)` | `Schedule` | Weekly schedule (Mon–Sun). |
| `getLatest({ page?, timezone? })` | `LatestReleases` | Latest releases feed. |
| `search(term, { timezone? })` | `LatestReleases` | Search releases. |
| `getShowsList()` | `ShowListItem[]` | All shows (slug + title). |
| `getShow(slug, { timezone? })` | `Show` | Show metadata + episodes + batches. Parses the show page for the internal `sid`. |
| `getShowBySid(sid, timezone?)` | `ShowEpisodes` | Episodes + batches by internal id. |
| `getRssFeed({ type?, resolution? })` | `RssFeed` | Torrent or magnet RSS feed. |

All methods return typed promises and throw `SubspleaseError` (with `status`,
`endpoint`, `cause`) on failure.

## Types

```ts
interface Schedule {
  timezone: string;
  schedule: Record<Weekday, ScheduleEntry[]>;
}
interface ScheduleEntry { title: string; page: string; imageUrl: string; time: string }

interface LatestReleases { releases: Release[] }
interface Release {
  title: string; show: string; episode: string;
  time: string; releaseDate: string; downloads: Download[];
}

interface Show {
  sid: number; slug: string; title: string;
  synopsis?: string; imageUrl?: string;
  episodes: Episode[]; batches: Episode[];
}
interface Episode {
  title: string; show: string; episode: string;
  time: string; releaseDate: string; downloads: Download[];
}
interface Download {
  res: "480" | "720" | "1080" | "sd";
  magnet: string; torrent?: string; xdcc?: string;
}

interface RssItem {
  title: string; link: string; magnet?: string; torrent?: string;
  pubDate: string; size?: string; description?: string;
}
```

## Build

```sh
bun run --filter @maxessien/subsplease build     # tsup → dist/
bun run --filter @maxessien/subsplease test      # vitest (mocked, offline)
LIVE=1 bun run --filter @maxessien/subsplease test   # + live smoke tests
```

## License

MIT
