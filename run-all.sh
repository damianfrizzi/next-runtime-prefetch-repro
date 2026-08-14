#!/usr/bin/env bash
# Runs the three configurations and prints the matrix.
set -euo pipefail
cd "$(dirname "$0")"
PAGE='app/item/[id]/page.tsx'
EXPORT_LINE="export const prefetch = 'force-disabled'"

restore() { grep -q "^$EXPORT_LINE" "$PAGE" || sed -i.bak "s|^// (export removed)$|$EXPORT_LINE|" "$PAGE"; rm -f "$PAGE.bak"; }
trap restore EXIT

echo "### 1. partialPrefetching: true  +  prefetch = 'force-disabled'"
PORT=3210 ./measure.sh | tail -6

echo
echo "### 2. partialPrefetching: true  +  no prefetch export"
sed -i.bak "s|^$EXPORT_LINE$|// (export removed)|" "$PAGE"; rm -f "$PAGE.bak"
PORT=3211 ./measure.sh | tail -6
restore

echo
echo "### 3. partialPrefetching: false  (control)"
PARTIAL_PREFETCHING=0 PORT=3212 ./measure.sh | tail -6
