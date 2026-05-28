import type { LeaderboardEntry } from './types';

/**
 * Deduplicate leaderboard entries by (player_id, leagueSlug) (keep first
 * occurrence) and recompute ranks locally using standard competition ranking
 * (1224 style). Run defensively even after the backend dedup bug is fixed.
 *
 * Each response is already scoped to one league, so leagueSlug is constant for
 * a given call; threading it explicitly documents intent and guards a future
 * stacked-leagues view from collapsing the same player across leagues.
 */
export function dedupedLeaderboard(
  entries: LeaderboardEntry[],
  leagueSlug: string,
): LeaderboardEntry[] {
  const seen = new Set<string>();
  const unique: LeaderboardEntry[] = [];
  for (const e of entries) {
    const key = `${e.player_id}:${leagueSlug}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }

  // Sort descending by total_points so ranking is deterministic regardless of
  // what order the backend returned.
  unique.sort((a, b) => b.total_points - a.total_points);

  // Standard competition ranking: same points → same rank; next rank skips.
  let rank = 1;
  return unique.map((e, i) => {
    if (i > 0 && e.total_points < unique[i - 1].total_points) {
      rank = i + 1;
    }
    return { ...e, rank };
  });
}
