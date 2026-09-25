/**
 * Reddit DOM adapter: the only module that knows what Reddit's markup looks
 * like. Two frontends are supported:
 *
 *  - Current desktop site ("shreddit"): each post is a <shreddit-post> custom
 *    element whose attributes carry the metadata we need
 *    (subreddit-prefixed-name, subreddit-name, post-title, permalink, id).
 *    These attributes are part of the server-rendered HTML, so they are
 *    present as soon as the element is parsed. In feeds the post is wrapped in
 *    an <article> followed by an <hr> separator.
 *    Ads use a different element (<shreddit-ad-post>) and are never touched.
 *
 *  - old.reddit.com (also www.reddit.com for users who opted out of the
 *    redesign): posts are <div class="thing link"> with data-subreddit,
 *    data-fullname, data-permalink. Promoted posts are skipped.
 *
 * Extraction prefers these semantic attributes and falls back to parsing the
 * permalink, never to CSS utility class names.
 */

import type { PostMetadata } from "../filtering/engine";
import { stripSubredditPrefix } from "../filtering/normalization";

export const POST_SELECTOR = "shreddit-post, div.thing.link";

export interface ExtractedPost extends PostMetadata {
  /** Stable identity used for de-duplication (post id, else permalink). */
  key: string;
}

/** Areas where a post-like element is not a feed post and must be left alone. */
const EXCLUDED_ANCESTORS = [
  "shreddit-comment",
  "shreddit-comment-tree",
  "#right-sidebar-container",
  "[slot='right-sidebar']",
  "aside",
  ".side", // old reddit sidebar
  "#siteTable_organic", // old reddit spotlight box
].join(",");

export function isFeedPost(el: Element): boolean {
  if (!el.matches(POST_SELECTOR)) return false;
  // A post nested inside another post is a crosspost preview, not a feed item.
  if (el.parentElement?.closest(POST_SELECTOR)) return false;
  if (el.closest(EXCLUDED_ANCESTORS)) return false;
  if (el.localName === "shreddit-post") {
    if (el.hasAttribute("promoted") || el.getAttribute("is-promoted") === "true") return false;
  } else if (el.getAttribute("data-promoted") === "true" || el.classList.contains("promoted")) {
    return false;
  }
  return true;
}

const PERMALINK_SUB = /\/r\/([A-Za-z0-9_]{2,21})\/comments\/([a-z0-9]+)/i;

export function extractPost(el: Element): ExtractedPost | null {
  return el.localName === "shreddit-post" ? extractShreddit(el) : extractOld(el);
}

function extractShreddit(el: Element): ExtractedPost | null {
  const permalink = el.getAttribute("permalink") ?? el.querySelector("a[href*='/comments/']")?.getAttribute("href") ?? "";
  const fromLink = PERMALINK_SUB.exec(permalink);
  const subreddit = stripSubredditPrefix(
    el.getAttribute("subreddit-prefixed-name") ?? el.getAttribute("subreddit-name") ?? fromLink?.[1] ?? "",
  );
  if (!subreddit) return null;
  const title =
    el.getAttribute("post-title") ??
    el.querySelector("[slot='title']")?.textContent?.trim() ??
    el.closest("article")?.getAttribute("aria-label") ??
    "";
  const id = el.getAttribute("id") ?? (fromLink ? `t3_${fromLink[2]}` : "");
  const key = id || permalink;
  if (!key) return null;
  return {
    key,
    subreddit,
    title,
    postId: id || undefined,
    url: permalink || undefined,
    postType: el.getAttribute("post-type") ?? undefined,
    domain: el.getAttribute("domain") ?? undefined,
  };
}

function extractOld(el: Element): ExtractedPost | null {
  const permalink = el.getAttribute("data-permalink") ?? "";
  const subreddit = stripSubredditPrefix(el.getAttribute("data-subreddit") ?? PERMALINK_SUB.exec(permalink)?.[1] ?? "");
  if (!subreddit) return null;
  const id = el.getAttribute("data-fullname") ?? "";
  const key = id || permalink;
  if (!key) return null;
  return {
    key,
    subreddit,
    title: el.querySelector("a.title")?.textContent?.trim() ?? "",
    postId: id || undefined,
    url: permalink || undefined,
    domain: el.getAttribute("data-domain") ?? undefined,
  };
}

/**
 * The element to hide for a post: the feed <article> wrapper when it wraps
 * exactly this post, otherwise the post element itself.
 */
export function hideTarget(post: Element): Element {
  const article = post.parentElement?.closest("article");
  if (article && article.querySelector(POST_SELECTOR) === post) return article;
  return post;
}

/** A separator directly after the hidden block (shreddit uses <hr>), hidden alongside it. */
export function separatorAfter(target: Element): Element | null {
  const next = target.nextElementSibling;
  return next && next.localName === "hr" ? next : null;
}

/** Find the post element for an arbitrary element inside (or wrapping) a post. */
export function postFromEventTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const direct = target.closest(POST_SELECTOR);
  if (direct) return isFeedPost(direct) ? direct : null;
  const article = target.closest("article");
  const inner = article?.querySelector(POST_SELECTOR);
  return inner && isFeedPost(inner) ? inner : null;
}
