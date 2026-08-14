#!/usr/bin/env bash
# Counts how many copies of the cached shell one dynamic response carries.
#
#   ./measure.sh                        # partialPrefetching: true (app-level default)
#   PARTIAL_PREFETCHING=0 ./measure.sh  # control
#
# `REPRO_MARKER` appears 200 times per copy. A correct response holds two: once as rendered
# markup, once in the inlined Flight payload. A third copy is the runtime prefetch.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-3210}"

echo "== build (partialPrefetching=${PARTIAL_PREFETCHING:-1}) =="
rm -rf .next
bun run build 2>&1 | grep -E "^\s*[├└│┌].*/item" || true

bun run start --port "$PORT" > .server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
until curl -s -o /dev/null -m 2 "http://localhost:$PORT/"; do sleep 1; done

# A plain document request: no RSC header, no Next-Router-Prefetch, no <Link> involved.
# This is what a crawler sends.
curl -s -o /dev/null "http://localhost:$PORT/item/1"
curl -s "http://localhost:$PORT/item/1" -o .response.html

node -e '
const fs = require("fs")
const body = fs.readFileSync(".response.html", "utf8")
const markup = body.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
const count = (s) => (s.match(/REPRO_MARKER/g) || []).length
const inMarkup = count(markup)
const inFlight = count(body) - inMarkup
console.log("== result ==")
console.log(`  bytes                 : ${body.length}`)
console.log(`  copies in markup      : ${inMarkup / 200}   (expected 1)`)
console.log(`  copies in Flight      : ${inFlight / 200}   (expected 1)`)
console.log(`  runtime prefetch copy : ${inFlight / 200 > 1 ? "PRESENT" : "absent"}`)
'
