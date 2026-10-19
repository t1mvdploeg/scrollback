# Phase 2: Links

Goal: `<kb>/links.tsv`, one post per line: `<collection><TAB><url>`. The collection is a short slug the user recognises (`ig-ai`, `tt-dev`). Append only; skip URLs whose id is already in the file.

## Option A: the user pastes links

Accept any mix of URLs, one per line or separated by spaces. Keep only links to a single post (`/reel/`, `/p/`, `/video/`, `/photo/`, or a TikTok short link); tell the user which links you dropped, such as profile or collection pages. Ask for a collection name if none is given (default `unsorted`). Drop tracking parameters (`?igsh=…`, `?is_from_webapp=…`). Keep short links (`vm.tiktok.com/…`) as they are; yt-dlp resolves them.

## Option B: scroll a saved collection with Claude in Chrome

`<kb>/collections.tsv` remembers the collections: `<collection><TAB><url of the collection page>`, one per line. It is what makes "add my newly saved posts" a single step.

1. Which collections:
   - `collections.tsv` exists: go through every collection in it without asking. Add another one only when the user names it.
   - It does not exist: ask which collections to process, find their pages (see below) and write them to `collections.tsv` with a slug each. If `links.tsv` already has slugs, reuse them for the same collections.
   - Finding the pages, with the user logged in: on Instagram open the profile, then Saved; the collections are the links with `/saved/` in them. On TikTok open the profile, then Favourites, then Collections; they are the links with `/collection/`. Only collect from collections the user named.
2. Use one visible tab. A background tab throttles timers and the scroll loop times out. Open the collection's URL in it.
3. Run this in the page, with the ids already in `links.tsv` for `KNOWN` (the last path segment of each URL, space-separated). It keeps links in a `Set` while scrolling, because Instagram only renders the visible part of the grid, stops when four scrolls in a row add nothing, and returns only the links that are new. Rerunning continues the same set.

Keep the `await` in front: without it the tool returns `{}` before the loop ends. Links inside TikTok's notification panel (`data-e2e="inbox-…"`) are skipped; they point to other people's videos.

```js
await (async () => {
  const known = new Set('KNOWN'.split(' '));
  const id = u => u.replace(/\/$/, '').split('/').pop();
  const seen = new Set(window.__scrollback || []);
  const pick = () => document
    .querySelectorAll('a[href*="/reel/"], a[href*="/p/"], a[href*="/video/"], a[href*="/photo/"]')
    .forEach(a => { if (!a.closest('[data-e2e^="inbox"]')) seen.add(a.href.split('?')[0]); });
  for (let still = 0, last = -1; still < 4; ) {
    pick();
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 3000));
    still = seen.size === last ? still + 1 : 0;
    last = seen.size;
  }
  pick();
  window.__scrollback = [...seen];
  const fresh = window.__scrollback.filter(u => !known.has(id(u)));
  return { total: seen.size, known: seen.size - fresh.length, fresh: fresh.join('\n') };
})()
```

4. Check `total` against what the collection shows before trusting `fresh`.
   - Instagram stops loading at the first 12 posts when only `window.scrollTo` scrolls. Do one real scroll first (Claude in Chrome's scroll action on the page), then run step 3 with 3000 ms.
   - A count one or two too high after repeating means deleted posts. Go on.
5. The tool may block output that looks like base64, such as Instagram shortcodes, and it cuts long output off. Returning only the new links keeps it short; if it is still blocked, return each URL with spaces between the characters and remove them afterwards: replace `fresh.join('\n')` with `fresh.map(u => u.split('').join(' ')).join(' | ')`.
6. Append the new links to `links.tsv` with the collection slug. Instagram gives links with the account name in them (`/<account>/reel/<id>/`); write them as `https://www.instagram.com/reel/<id>/` (or `/p/<id>/`). The set is gone once the tab opens the next collection.

Report the number of new links per collection, and which collections had none.
