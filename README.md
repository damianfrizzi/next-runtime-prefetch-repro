# Runtime prefetch in every dynamic render

Next.js 16.3.1, `cacheComponents: true`, `partialPrefetching: true`.

This project shows two behaviours that do not agree with the documentation.

## The route

`app/item/[id]/page.tsx` is a cached shell. It uses `'use cache'` and `cacheLife('max')`. The page
gives the shell one request-time child as a prop. The `use cache` reference calls this the
pass-through pattern. The child reads `searchParams`, so the route builds as `◐ Partial Prerender`.

The shell renders a Client Component with 200 rows. Each row holds the token `REPRO_MARKER`. The
count of that token gives the number of copies of the shell. A correct response holds two copies:
the rendered markup, and the inlined Flight payload.

## How to run

```bash
bun install
./run-all.sh
```

## Result

| # | Configuration | Bytes | Copies in Flight |
| - | --- | ---: | ---: |
| 1 | `partialPrefetching: true` and `prefetch = 'force-disabled'` | 54,251 | **2** |
| 2 | `partialPrefetching: true`, no `prefetch` export | 54,237 | **2** |
| 3 | `partialPrefetching: false` | 30,466 | 1 |

Row 1 and row 2 differ by 14 bytes. Those bytes are the export line. The segment configuration
changes nothing else.

## Behaviour 1: `prefetch = 'force-disabled'` does not override the application default

`docs/app/api-reference/config/next-config-js/partialPrefetching` says:

> A segment that exports an explicit `prefetch` value overrides the app-level default for that
> route.

The value does not reach the runtime prefetch. The gate reads the global flag first, then stops:

```js
// server/app-render/app-render.js:475 (Flight) and :2003 (HTML)
if (Boolean(renderOpts.partialPrefetching) || await anySegmentHasPartialPrefetchingEnabled(tree)) {
```

`anySegmentHasPartialPrefetchingEnabled` returns `true` for `'partial'` and `'unstable_eager'`. It
cannot express an opt-out. `spawnRuntimePrefetchWithFilledCaches` then prerenders the whole route.
It does not read the segment configuration.

A route can therefore opt in per segment. A route cannot opt out. The application flag is the only
control. The adoption guide describes that flag as the end state:

> Once every route in scope has `prefetch = 'partial'`, enable the global flag and remove the
> per-route exports.

## Behaviour 2: the runtime prefetch runs for each dynamic render

`docs/app/guides/runtime-prefetching` says:

> Runtime prefetching is opted into per link with `<Link prefetch={true}>`.

and:

> Generating it costs a server invocation per prefetchable link, so it is opt-in per link.

`measure.sh` sends a plain document request. The request carries no `RSC` header and no
`Next-Router-Prefetch` header. No `<Link>` is part of the flow. The response carries the second
Flight copy.

The source states the purpose: "so the client can cache runtime-prefetchable content during
hydration". A client that does not hydrate pays the same cost. Crawlers do not hydrate.

## Cost in a production application

A production route uses the same shape: a cached shell and one streamed panel.

| | `partialPrefetching: true` | `partialPrefetching: false` |
| --- | ---: | ---: |
| document | 452,894 B | 299,762 B |
| wire, brotli | 45.7 KB | 38.7 KB |

The two copies are equal, so brotli compresses them well and the wire cost stays small. The client
parses both copies. On that route, 78 % of the requests carry a declared crawler user agent.

## A possible fix

Let `prefetch = 'force-disabled'` and `prefetch = 'auto'` gate the spawn. A route can then opt out,
and the application flag can stay on.
