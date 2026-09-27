'use strict';
/**
 * Trending Paigaams — data-driven ranking over the existing events analytics
 * table. No new tables; reads only.
 *
 * Ranking (per template):
 *   score = 1.0 × opens/views + 0.5 × previews + 0.75 × create clicks
 * with a simple time-decay: events in the last 3 days weigh double. Recent
 * bursts beat steady accumulation — an old template cannot stay "trending"
 * forever on historical views alone.
 *
 * Fallback chain — the homepage must never look empty:
 *   1. last 7 days engagement      (trending)
 *   2. last 30 days engagement     (popular)
 *   3. curated popularRank, if the admin set one
 *   4. newest templates
 * Returns EXACTLY 2 templates when at least 2 exist.
 */
const WEIGHT = { template_opened: 1, template_viewed: 1, template_previewed: 0.5, template_create_clicked: 0.75 };

/**
 * Pick the trending templates.
 * templates:      published templates (newest-first registry rows)
 * rows7 / rows30: q.eventsTemplateCounts(7 | 30) → [{ slug, event, n }]
 * rows7Fresh:     same, events from the last 3 days (drives the decay boost)
 * Returns exactly 2 (or as many as exist, capped at 2).
 */
function pickTrending(templates, rows7 = [], rows30 = [], rows7Fresh = []) {
  if (!Array.isArray(templates) || templates.length === 0) return [];
  const known = new Set(templates.map(t => t.slug));

  // scores(slug → weighted count) from one event aggregate.
  const scoresFrom = (rows, freshRows = null) => {
    const fresh = new Map((freshRows || []).map(r => [r.slug, r.n]));
    const out = new Map();
    for (const r of rows) {
      if (!known.has(r.slug)) continue; // unpublished / unknown templates never rank
      const w = WEIGHT[r.event] || 0;
      if (!w) continue;
      // time-decay: last-3-days events weigh double
      const boost = freshRows ? 1 + 0.5 * ((fresh.get(r.slug) || 0) / Math.max(1, r.n)) : 1;
      out.set(r.slug, (out.get(r.slug) || 0) + w * r.n * boost);
    }
    return out;
  };

  const tier1 = scoresFrom(rows7, rows7Fresh);
  const tier2 = scoresFrom(rows30);

  // Prefer 7-day signal; if fewer than 2 templates have 7-day activity,
  // fall back to 30-day, then curated rank, then newest.
  const pool = tier1.size >= 2 ? tier1 : tier2;
  let scored = templates
    .map(t => ({ ...t, trendingScore: pool.get(t.slug) || 0 }))
    .filter(t => t.trendingScore > 0);
  if (scored.length < 2) {
    const curated = templates.filter(t => Number(t.popularRank || 0) > 0);
    scored = curated.length >= 2
      ? curated.map(t => ({ ...t, trendingScore: 0 }))
      : templates.slice(0, 2).map(t => ({ ...t, trendingScore: 0 })); // tier 4: newest
  }
  scored.sort((a, b) => b.trendingScore - a.trendingScore);
  return scored.slice(0, 2);
}

module.exports = { pickTrending };
