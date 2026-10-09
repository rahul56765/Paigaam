#!/usr/bin/env bash
# Railway build step for the wedding invitation film generator.
# Never fails the whole deploy: the rest of Paigaam must still ship if this part is unavailable.
set -u
cd "$(dirname "$0")/.."
if [ ! -f wedding-video/package.json ]; then echo "WEDDING: no wedding-video folder, skipping"; exit 0; fi
npm --prefix wedding-video ci --no-audit --no-fund || { echo "WEDDING: dependency install failed"; exit 0; }
npm --prefix wedding-video run build:editor || echo "WEDDING: editor build failed"
(cd wedding-video && npx remotion browser ensure) || echo "WEDDING: headless Chrome download failed (renders will be unavailable)"
exit 0
