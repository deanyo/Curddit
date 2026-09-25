/**
 * Representative markup modelled on Reddit's current ("shreddit") feed and
 * old.reddit.com listings. Only the parts the adapter relies on are included.
 */

export function shredditPost(opts: { id: string; sub: string; title: string; attrs?: boolean }): string {
  const { id, sub, title, attrs = true } = opts;
  const permalink = `/r/${sub}/comments/${id}/some_slug/`;
  const a = attrs
    ? ` id="t3_${id}" permalink="${permalink}" subreddit-prefixed-name="r/${sub}" subreddit-name="${sub}" post-title="${title}" post-type="image" domain="i.redd.it" author="someone" score="123"`
    : "";
  return `
    <article class="w-full m-0" aria-label="${title}" data-post-id="t3_${id}">
      <shreddit-post${a} class="block relative cursor-pointer">
        <a slot="full-post-link" href="${permalink}"><faceplate-screen-reader-content>${title}</faceplate-screen-reader-content></a>
        <a slot="title" id="post-title-t3_${id}" href="${permalink}">${title}</a>
        <shreddit-post-overflow-menu slot="overflow-menu"></shreddit-post-overflow-menu>
      </shreddit-post>
    </article>
    <hr class="border-0 border-b-sm border-solid border-b-neutral-border-weak">`;
}

export function shredditAd(): string {
  return `<shreddit-ad-post id="t3_ad1" subreddit-prefixed-name="u/advertiser" post-title="Buy things"></shreddit-ad-post><hr>`;
}

export function shredditPage(feed: string): string {
  return `
    <shreddit-app>
      <header><nav id="nav"><a href="/r/popular/">Popular</a></nav></header>
      <main id="main-content">
        <shreddit-feed>${feed}</shreddit-feed>
      </main>
      <aside id="right-sidebar-container">
        ${shredditPost({ id: "side1", sub: "TeenIndia", title: "Sidebar recent post" })}
      </aside>
    </shreddit-app>`;
}

export function oldRedditThing(opts: { id: string; sub: string; title: string; promoted?: boolean }): string {
  const { id, sub, title, promoted } = opts;
  return `
    <div class=" thing id-t3_${id} link${promoted ? " promoted" : ""}" data-fullname="t3_${id}" data-subreddit="${sub}"
         data-subreddit-prefixed="r/${sub}" data-permalink="/r/${sub}/comments/${id}/slug/" data-domain="i.redd.it"
         ${promoted ? 'data-promoted="true"' : ""}>
      <div class="entry"><p class="title"><a class="title" href="/r/${sub}/comments/${id}/slug/">${title}</a></p></div>
    </div>
    <div class="clearleft"></div>`;
}
