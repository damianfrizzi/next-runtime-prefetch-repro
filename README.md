# Runtime prefetch rides on every dynamic render, and `prefetch` cannot opt out

Next.js 16.3.1 · `cacheComponents: true` · `partialPrefetching: true`

## Shape

`app/item/[id]/page.tsx` is a cached shell (`'use cache'`, `cacheLife('max')`) with one request-time
hole handed in as a prop — the pass-through pattern from the `use cache` reference. The hole reads
`searchParams`, so the route builds as `◐ Partial Prerender`.

The shell renders a Client Component with 200 rows. Each row carries the token `REPRO_MARKER`, so
counting the token counts the copies of the shell. A correct response holds two: once as rendered
markup, once in the inlined Flight payload.

## Run

```bash
bun install
./run-all.sh
```

## Result

| # | Configuration | Bytes | Copies in Flight |
| - | --- | ---: | ---: |
| 1 | `partialPrefetching: true` + `prefetch = 'force-disabled'` | 54,251 | **2** |
| 2 | `partialPrefetching: true`, no `prefetch` export | 54,237 | **2** |
| 3 | `partialPrefetching: false` | 30,466 | 1 |

Rows 1 and 2 differ by the 14 bytes of the line itself. The segment config changes nothing else.

## 1. `prefetch = 'force-disabled'` does not override the app-level default

`docs/app/api-reference/config/next-config-js/partialPrefetching` says:

> A segment that exports an explicit `prefetch` value overrides the app-level default for that
> route.

It does not reach the runtime prefetch. The gate reads the global flag first and short-circuits:

```js
// server/app-render/app-render.js:475 (Flight) and :2003 (HTML)
if (Boolean(renderOpts.partialPrefetching) || await anySegmentHasPartialPrefetchingEnabled(tree)) {
```

`anySegmentHasPartialPrefetchingEnabled` only ever returns `true` — it recognises `'partial'` and
`'unstable_eager'` and has no way to express an opt-out. `spawnRuntimePrefetchWithFilledCaches` then
prerenders the whole route without reading the segment config at all.

So a route can opt **in** per segment, and cannot opt **out**. The only control is the app-level
flag, which the adoption guide describes as the end state:

> Once every route in scope has `prefetch = 'partial'`, enable the global flag and remove the
> per-route exports.

## 2. The runtime prefetch is spawned per dynamic render, not per link

`docs/app/guides/runtime-prefetching` says:

> Runtime prefetching is opted into per link with `<Link prefetch={true}>`.

and

> Generating it costs a server invocation per prefetchable link, so it is opt-in per link.

`measure.sh` sends a plain document request — no `RSC` header, no `Next-Router-Prefetch`, no `<Link>`
anywhere in the flow. The second Flight copy is in the response anyway.

The source states the purpose: "so the client can cache runtime-prefetchable content during
hydration". A client that never hydrates still pays for it. On a content site where crawlers are the
majority of traffic, that is most of the requests.

## Why this matters

Measured on a production app — a film detail route with a cached shell and one streamed panel, the
same shape as this reproduction:

| | `partialPrefetching: true` | `false` |
| --- | ---: | ---: |
| document | 452,894 B | 299,762 B |
| on the wire, brotli | 45.7 KB | 38.7 KB |

Brotli hides most of it on the wire because the two copies are identical. The client still parses
and allocates both. On that route, 78% of requests carry a declared crawler user agent.

## What would fix it

Let `prefetch = 'force-disabled'` (and `'auto'`) gate the spawn, so a route can opt out without
turning the app-level flag off. A second useful control would be skipping the runtime prefetch on
requests that are not navigations, since the embedded copy only pays off for a client that hydrates.
