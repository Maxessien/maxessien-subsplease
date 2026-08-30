import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSubsplease, SubspleaseError } from "../src/index.js";

/**
 * Mocked unit tests. Live smoke tests are guarded behind LIVE=1 and skipped
 * by default so the suite runs offline.
 */

const SCHEDULE_FIXTURE = JSON.stringify({
  tz: "America/New_York",
  schedule: {
    Monday: [
      {
        title: "Grand Blue S3",
        page: "grand-blue-s3",
        image_url: "/wp-content/uploads/2026/07/158194.jpg",
        time: "12:00",
      },
    ],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  },
});

const LATEST_FIXTURE = JSON.stringify({
  "Rilakkuma - 22": {
    time: "New",
    release_date: "Fri, 28 Aug 2026 21:00:25 -0400",
    show: "Rilakkuma",
    episode: "22",
    downloads: [
      { res: "480", magnet: "magnet:?xt=urn:btih:AAA" },
      { res: "1080", magnet: "magnet:?xt=urn:btih:BBB" },
    ],
  },
});

const SHOW_BY_SID_FIXTURE = JSON.stringify({
  batch: [],
  episode: {
    "Rilakkuma - 22": {
      time: "New",
      release_date: "Sat, 29 Aug 2026 09:00:25 +0800",
      show: "Rilakkuma",
      episode: "22",
      downloads: [
        {
          res: "1080",
          torrent: "https://nyaa.si/view/2152859/torrent",
          magnet: "magnet:?xt=urn:btih:CCC",
          xdcc: "%22Rilakkuma%22",
        },
      ],
    },
  },
});

const SHOWS_LIST_HTML = `
<div class="all-shows">
  <div class="all-shows-link"><a href="/shows/rilakkuma" title="Rilakkuma">Rilakkuma</a></div>
  <div class="all-shows-link"><a href="/shows/grand-blue-s3" title="Grand Blue S3">Grand Blue S3</a></div>
</div>`;

const SHOW_PAGE_HTML = `
<article>
  <header class="entry-header"><h1 class="entry-title">Rilakkuma</h1></header>
  <div class="entry-content">
    <div class="series-syn"><h2>Synopsis</h2><p>A relaxed bear.</p></div>
    <div class="series-release">
      <h2>Download</h2>
      <table id="show-release-table" cellpadding="0" border="0" cellspacing="0" sid="1149"></table>
    </div>
  </div>
</article>`;

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>SubsPlease RSS</title>
    <description>RSS feed for SubsPlease releases (All)</description>
    <link>https://subsplease.org</link>
    <item>
      <title>[SubsPlease] Rilakkuma - 22 (1080p) [48DA2737].mkv</title>
      <link>magnet:?xt=urn:btih:CCC&dn=Rilakkuma</link>
      <pubDate>Sat, 29 Aug 2026 09:00:25 +0800</pubDate>
      <description>Release</description>
      <enclosure length="97877545" type="application/x-bittorrent"/>
    </item>
  </channel>
</rss>`;

function mockFetch(map: Record<string, string>) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = typeof url === "string" ? url : url.toString();
    const key = Object.keys(map).find((k) => u.includes(k));
    if (!key) {
      return new Response("not found", { status: 404 });
    }
    return new Response(map[key], {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("createSubsplease", () => {
  it("uses default base url and timezone", () => {
    const sp = createSubsplease();
    expect(sp.getBaseUrl()).toBe("https://subsplease.org");
    expect(sp.getDefaultTimezone()).toBe("Etc/GMT");
  });

  it("strips trailing slash from base url", () => {
    const sp = createSubsplease({ baseUrl: "https://subsplease.org/" });
    expect(sp.getBaseUrl()).toBe("https://subsplease.org");
  });
});

describe("getSchedule (mocked)", () => {
  it("returns normalized schedule with absolute image urls", async () => {
    const fetchImpl = mockFetch({ "f=schedule": SCHEDULE_FIXTURE });
    const sp = createSubsplease({
      timezone: "America/New_York",
      fetch: fetchImpl as unknown as typeof fetch,
    });

    const schedule = await sp.getSchedule();
    expect(schedule.timezone).toBe("America/New_York");
    const monday = schedule.schedule.Monday;
    expect(monday).toHaveLength(1);
    const entry = monday[0]!;
    expect(entry.title).toBe("Grand Blue S3");
    expect(entry.page).toBe("grand-blue-s3");
    expect(entry.time).toBe("12:00");
    expect(entry.imageUrl).toBe(
      "https://subsplease.org/wp-content/uploads/2026/07/158194.jpg",
    );
  });
});

describe("getLatest (mocked)", () => {
  it("returns releases with magnet-only downloads", async () => {
    const fetchImpl = mockFetch({ "f=latest": LATEST_FIXTURE });
    const sp = createSubsplease({ fetch: fetchImpl as unknown as typeof fetch });

    const { releases } = await sp.getLatest({ page: 1 });
    expect(releases).toHaveLength(1);
    const r = releases[0]!;
    expect(r.title).toBe("Rilakkuma - 22");
    expect(r.show).toBe("Rilakkuma");
    expect(r.episode).toBe("22");
    expect(r.downloads).toHaveLength(2);
    const hd = r.downloads.find((d) => d.res === "1080");
    expect(hd?.magnet).toBe("magnet:?xt=urn:btih:BBB");
    expect(hd?.torrent).toBeUndefined();
  });
});

describe("getShowsList (mocked)", () => {
  it("parses show slugs and titles", async () => {
    const fetchImpl = mockFetch({ "/shows/": SHOWS_LIST_HTML });
    const sp = createSubsplease({ fetch: fetchImpl as unknown as typeof fetch });

    const shows = await sp.getShowsList();
    expect(shows).toEqual([
      { slug: "rilakkuma", title: "Rilakkuma" },
      { slug: "grand-blue-s3", title: "Grand Blue S3" },
    ]);
  });
});

describe("getShowBySid (mocked)", () => {
  it("returns episodes with torrent + xdcc", async () => {
    const fetchImpl = mockFetch({ "f=show": SHOW_BY_SID_FIXTURE });
    const sp = createSubsplease({ fetch: fetchImpl as unknown as typeof fetch });

    const { episodes, batches } = await sp.getShowBySid(1149, "America/New_York");
    expect(batches).toEqual([]);
    expect(episodes).toHaveLength(1);
    const ep = episodes[0]!;
    expect(ep.episode).toBe("22");
    expect(ep.downloads).toHaveLength(1);
    const dl = ep.downloads[0]!;
    expect(dl.res).toBe("1080");
    expect(dl.magnet).toBe("magnet:?xt=urn:btih:CCC");
    expect(dl.torrent).toBe("https://nyaa.si/view/2152859/torrent");
    expect(dl.xdcc).toBe("%22Rilakkuma%22");
  });
});

describe("getShow (mocked)", () => {
  it("parses the page for sid/meta then fetches episodes", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/shows/rilakkuma")) {
        return new Response(SHOW_PAGE_HTML, { status: 200 });
      }
      if (u.includes("f=show")) {
        return new Response(SHOW_BY_SID_FIXTURE, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    const sp = createSubsplease({ fetch: fetchImpl as unknown as typeof fetch });

    const show = await sp.getShow("rilakkuma", { timezone: "America/New_York" });
    expect(show.sid).toBe(1149);
    expect(show.slug).toBe("rilakkuma");
    expect(show.title).toBe("Rilakkuma");
    expect(show.synopsis).toBe("A relaxed bear.");
    expect(show.episodes).toHaveLength(1);
  });

  it("throws when the show page has no sid", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("<div>no table</div>", { status: 200 }),
    );
    const sp = createSubsplease({ fetch: fetchImpl as unknown as typeof fetch });

    await expect(sp.getShow("nope")).rejects.toThrow(SubspleaseError);
  });
});

describe("getRssFeed (mocked)", () => {
  it("parses magnet feed items", async () => {
    const fetchImpl = mockFetch({ "/rss/": RSS_FIXTURE });
    const sp = createSubsplease({ fetch: fetchImpl as unknown as typeof fetch });

    const feed = await sp.getRssFeed({ type: "magnet", resolution: "1080" });
    expect(feed.title).toBe("SubsPlease RSS");
    expect(feed.items).toHaveLength(1);
    const item = feed.items[0]!;
    expect(item.magnet).toBe("magnet:?xt=urn:btih:CCC&dn=Rilakkuma");
    expect(item.pubDate).toContain("2026");
    expect(item.size).toBe("97877545");
  });
});

describe("live smoke tests", () => {
  const run = process.env["LIVE"] === "1" ? describe : describe.skip;
  run("live", () => {
    it("fetches a real schedule", async () => {
      const sp = createSubsplease({ timezone: "America/New_York" });
      const schedule = await sp.getSchedule();
      expect(Object.keys(schedule.schedule)).toHaveLength(7);
    });

    it("fetches the real shows list", async () => {
      const sp = createSubsplease();
      const shows = await sp.getShowsList();
      expect(shows.length).toBeGreaterThan(100);
    });
  });
});
