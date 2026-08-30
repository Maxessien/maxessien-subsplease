import { load } from "cheerio";
import type { RssFeed, RssItem } from "./types.js";

/**
 * Parse a subsplease RSS XML document into a typed feed.
 *
 * Torrent feeds (`/rss/?t`) put a magnet or torrent URL in `<link>`.
 * Magnet feeds (`/rss/?r=...`) put a magnet URI in `<link>`. enclosure/size
 * metadata is best-effort.
 */
export function parseRssXml(xml: string): RssFeed {
  const $ = load(xml, { xml: true });

  const title = $("channel > title").first().text().trim() || "SubsPlease RSS";
  const description =
    $("channel > description").first().text().trim() || "RSS feed for SubsPlease releases";

  const items: RssItem[] = [];
  $("channel > item").each((_, el) => {
    const $item = $(el);
    const itemTitle = $item.find("title").first().text().trim();
    const link = $item.find("link").first().text().trim();
    const pubDate = $item.find("pubDate").first().text().trim();
    const description = $item.find("description").first().text().trim() || undefined;

    // Size may come from <enclosure length="..."> or the
    // <subsplease:size>93.34 MiB</subsplease:size> element used by live feeds.
    const enclosureLength = $item.find("enclosure").attr("length");
    const subspleaseSize = $item.find("subsplease\\:size").text().trim();
    const size = subspleaseSize
      ? subspleaseSize
      : enclosureLength
        ? enclosureLength
        : undefined;

    if (!itemTitle && !link) return;

    const item: RssItem = {
      title: itemTitle,
      link,
      pubDate,
    };
    if (description) item.description = description;
    if (size) item.size = size;

    if (link.startsWith("magnet:")) {
      item.magnet = link;
    } else if (link) {
      item.torrent = link;
    }

    items.push(item);
  });

  return { title, description, items };
}
