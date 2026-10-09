#!/usr/bin/env bash
# Build both isolated Remotion invitation editors without blocking the core site.
set -u
cd "$(dirname "$0")/.."
for slug in wedding-video vivah-video; do
  if [ ! -f "$slug/package.json" ]; then echo "$slug: missing, skipping"; continue; fi
  npm --prefix "$slug" ci --no-audit --no-fund || { echo "$slug: dependency install failed; keeping the rest of Paigaam build available"; continue; }
  npm --prefix "$slug" run build:editor || echo "$slug: editor build failed; keeping the rest of Paigaam build available"
  (cd "$slug" && npx remotion browser ensure) || echo "$slug: headless Chrome download failed; renders will be unavailable"
done
exit 0
