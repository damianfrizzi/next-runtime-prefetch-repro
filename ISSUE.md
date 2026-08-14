# Title

Runtime prefetch runs for every dynamic render, and a `prefetch` export cannot opt a route out

# Link to the code that reproduces this issue

https://github.com/damianfrizzi/next-runtime-prefetch-repro

# To Reproduce

```bash
git clone https://github.com/damianfrizzi/next-runtime-prefetch-repro
cd next-runtime-prefetch-repro
bun install
./run-all.sh
```

The route `app/item/[id]/page.tsx` is a cached shell. It uses `'use cache'` and `cacheLife('max')`.
The page gives the shell one request-time child as a prop. The child reads `searchParams`, so the
route builds as `◐ Partial Prerender`. The shell renders a Client Component with 200 rows, and each
row holds the token `REPRO_MARKER`. The count of that token gives the number of copies of the shell.

`measure.sh` sends a plain document request. The request carries no `RSC` header and no
`Next-Router-Prefetch` header. No `<Link>` is part of the flow.

# Current vs. Expected behavior

`run-all.sh` prints:

| # | Configuration | Bytes | Copies in Flight |
| - | --- | ---: | ---: |
| 1 | `partialPrefetching: true` and `prefetch = 'force-disabled'` | 54,251 | 2 |
| 2 | `partialPrefetching: true`, no `prefetch` export | 54,237 | 2 |
| 3 | `partialPrefetching: false` | 30,466 | 1 |

Row 1 and row 2 differ by 14 bytes. Those bytes are the export line itself.

## 1. `prefetch = 'force-disabled'` does not override the application default

The `partialPrefetching` reference says:

> A segment that exports an explicit `prefetch` value overrides the app-level default for that
> route.

I expect row 1 to hold one copy. It holds two. The gate reads the global flag first and stops:

```js
// server/app-render/app-render.js:475 (Flight) and :2003 (HTML)
if (Boolean(renderOpts.partialPrefetching) || await anySegmentHasPartialPrefetchingEnabled(tree)) {
```

`anySegmentHasPartialPrefetchingEnabled` returns `true` for `'partial'` and `'unstable_eager'`. It
cannot express an opt-out. `spawnRuntimePrefetchWithFilledCaches` then prerenders the whole route,
and it does not read the segment configuration.

A route can therefore opt in per segment. A route cannot opt out. The application flag is the only
control, and the adoption guide describes that flag as the end state:

> Once every route in scope has `prefetch = 'partial'`, enable the global flag and remove the
> per-route exports.

## 2. The runtime prefetch runs for each dynamic render, not per link

The runtime prefetching guide says:

> Runtime prefetching is opted into per link with `<Link prefetch={true}>`.

and:

> Generating it costs a server invocation per prefetchable link, so it is opt-in per link.

I expect a plain document request to carry one copy of the shell. It carries two. The source states
the purpose of the second copy: "so the client can cache runtime-prefetchable content during
hydration". A client that does not hydrate pays the same cost.

# Provide environment information

```
Operating System:
  Platform: darwin
  Arch: arm64
  Version: Darwin Kernel Version 25.5.0
  Available memory (MB): 49152
  Available CPU cores: 14
Binaries:
  Node: 26.5.0
  npm: 11.17.0
Relevant Packages:
  next: 16.3.1 // Latest available version is detected (16.3.1).
  react: 19.2.8
  react-dom: 19.2.8
  typescript: 7.0.2
Next.js Config:
  output: N/A
```

# Which area(s) are affected? (Select all that apply)

Partial Prerendering, Cache Components (`use cache`), Navigation, Runtime

# Which stage(s) are affected? (Select all that apply)

next build (local), Vercel (Deployed), next start (local)

# Additional context

A production application shows the cost. The route has the same shape: a cached shell and one
streamed child.

| | `partialPrefetching: true` | `partialPrefetching: false` |
| --- | ---: | ---: |
| document | 452,894 B | 299,762 B |
| wire, brotli | 45.7 KB | 38.7 KB |

The two copies are equal, so brotli compresses them well and the wire cost stays small. The client
parses both copies. On that route, 78 % of the requests carry a declared crawler user agent, and a
crawler never hydrates.

A route that reads `searchParams` therefore pays for a prefetch that most of its traffic discards,
and it has no way to decline. A fix for behaviour 1 also solves behaviour 2 for the routes that need
it: let `prefetch = 'force-disabled'` and `prefetch = 'auto'` gate the spawn, so a route can opt out
while the application flag stays on.
