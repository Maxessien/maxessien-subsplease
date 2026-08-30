import { load } from "cheerio";
import { joinUrl } from "./util.js";
import type { ShowListItem } from "./types.js";

/** Parsed metadata from a show page. */
export interface ShowPageMeta {
  /** Internal subsplease show id, or null if the table is absent. */
  sid: number | null;
  /** Display title (h1.entry-title), if present. */
  title: string | null;
  /** Synopsis text (div.series-syn p), if present. */
  synopsis: string | null;
  /** Absolute poster image URL, if present. */
  imageUrl: string | null;
}

/**
 * Parse the `/shows/` index page HTML into a list of `{ slug, title }`.
 * The page renders each show as:
 *   <div class="all-shows-link"><a href="/shows/<slug>" title="Title">Title</a></div>
 */
export function parseShowsListHtml(html: string): ShowListItem[] {
  const $ = load(html);
  const shows: ShowListItem[] = [];

  $(".all-shows-link a").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href") ?? "";
    const title = ($a.attr("title") ?? $a.text().trim()) || "";
    const slug = extractSlug(href);
    if (slug && title) {
      shows.push({ slug, title });
    }
  });

  return shows;
}

/**
 * Parse a show page for its `sid`, title, synopsis, and image.
 * The sid lives on: <table id="show-release-table" sid="NNNN">.
 */
export function parseShowPageHtml(html: string, baseUrl: string): ShowPageMeta {
  const $ = load(html);

  let sid: number | null = null;
  const sidAttr = $("#show-release-table").attr("sid");
  if (sidAttr) {
    const parsed = Number.parseInt(sidAttr, 10);
    sid = Number.isNaN(parsed) ? null : parsed;
  }

  const title = $(".entry-title").first().text().trim() || null;

  let synopsis: string | null = null;
  const synText = $(".series-syn p").first().text().trim();
  if (synText) synopsis = synText;

  let imageUrl: string | null = null;
  const imgSrc =
    $(".entry-content img.img-responsive").first().attr("src") ??
    $("img.wp-post-thumbnail").first().attr("src") ??
    $(".series-syn img").first().attr("src") ??
    undefined;
  if (imgSrc) {
    imageUrl = joinUrl(baseUrl, imgSrc);
  }

  return { sid, title, synopsis, imageUrl };
}

/** Extract the trailing slug from a `/shows/<slug>` href. */
export function extractSlug(href: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://subsplease.org");
    const match = url.pathname.match(/^\/shows\/([^/]+)\/?$/);
    return match ? (match[1] ?? null) : null;
  } catch {
    const match = href.match(/^\/shows\/([^/]+)\/?$/);
    return match ? (match[1] ?? null) : null;
  }
}
