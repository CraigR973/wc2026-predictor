export interface TeamRef {
  id: string;
  name: string;
  code: string;
  flag_emoji: string;
}

export interface MatchResponse {
  id: string;
  match_number: number;
  stage: string;
  group_id: string | null;
  home_team: TeamRef | null;
  away_team: TeamRef | null;
  home_team_placeholder: string | null;
  away_team_placeholder: string | null;
  kickoff_utc: string;
  venue: string | null;
  status: 'scheduled' | 'locked' | 'live' | 'completed' | 'postponed' | 'cancelled';
  actual_home_score: number | null;
  actual_away_score: number | null;
  extra_time: boolean;
  penalties: boolean;
  postponed_reason: string | null;
}

export interface TeamStanding {
  position: number;
  team_id: string;
  team_name: string;
  team_code: string;
  flag_emoji: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface GroupResponse {
  id: string;
  name: string;
  standings: TeamStanding[];
}

export interface PointsBreakdown {
  goals: number;
  result: number;
  exact: number;
  total: number;
  no_prediction: boolean;
}

export interface PredictionResponse {
  id: string;
  player_id: string;
  match_id: string;
  predicted_home: number | null;
  predicted_away: number | null;
  submitted_at: string | null;
  update_count: number;
  points_awarded: number | null;
  points_breakdown: PointsBreakdown | null;
  updated_at: string;
}

export interface MatchPredictionItem {
  player_id: string;
  player_name: string;
  predicted_home: number | null;
  predicted_away: number | null;
  points_awarded: number | null;
  points_breakdown: PointsBreakdown | null;
}

export interface MatchPredictionsResponse {
  match_id: string;
  predictions: MatchPredictionItem[];
}

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  player_name: string;
  total_points: number;
  match_points: number;
  knockout_winner_points: number;
  special_points: number;
  is_active: boolean;
}

export interface SnapshotPoint {
  snapshot_at: string;
  total_points: number;
  rank: number;
}

export interface HistoryEntry {
  player_id: string;
  player_name: string;
  snapshots: SnapshotPoint[];
}

export interface RoundEntry {
  rank: number;
  player_id: string;
  player_name: string;
  points: number;
}

export interface KnockoutPredictionResponse {
  id: string;
  player_id: string;
  match_id: string;
  predicted_winner_id: string | null;
  submitted_at: string | null;
  update_count: number;
  points_awarded: number | null;
  updated_at: string;
}

export type SpecialType = 'tournament_winner' | 'golden_boot' | 'top_scoring_team';

export interface SpecialPredictionItem {
  id: string;
  prediction_type: SpecialType;
  predicted_team_id: string | null;
  predicted_player_name: string | null;
  submitted_at: string | null;
  points_awarded: number | null;
}

export interface MySpecialsResponse {
  is_locked: boolean;
  lock_at: string | null;
  predictions: SpecialPredictionItem[];
}

export interface PlayerSpecialsItem {
  player_id: string;
  player_name: string;
  predictions: SpecialPredictionItem[];
}

export interface PlayerStats {
  player_id: string;
  player_name: string;
  total_predictions_settled: number;
  accuracy_pct: number;
  exact_rate_pct: number;
  avg_pts_per_prediction: number;
  total_points: number;
  best_round: string | null;
  best_round_points: number | null;
  worst_round: string | null;
  worst_round_points: number | null;
  current_streak: number;
  avg_prediction_timing_mins: number | null;
}

export interface PlayerListItem {
  id: string;
  display_name: string;
  role: string;
  timezone: string;
  is_deleted: boolean;
  created_at: string;
}

export interface H2HPlayerRef {
  id: string;
  name: string;
}

export interface H2HSummary {
  player_a_wins: number;
  player_b_wins: number;
  draws: number;
}

export interface H2HMatchEntry {
  match_id: string;
  stage: string;
  kickoff_utc: string;
  home_team_name: string | null;
  away_team_name: string | null;
  home_team_flag: string | null;
  away_team_flag: string | null;
  actual_home: number | null;
  actual_away: number | null;
  player_a_predicted_home: number | null;
  player_a_predicted_away: number | null;
  player_a_points: number;
  player_b_predicted_home: number | null;
  player_b_predicted_away: number | null;
  player_b_points: number;
  winner: 'a' | 'b' | 'draw';
}

export interface H2HResponse {
  player_a: H2HPlayerRef;
  player_b: H2HPlayerRef;
  summary: H2HSummary;
  matches: H2HMatchEntry[];
}

export interface LeagueSummary {
  slug: string;
  name: string;
  description: string | null;
  privacy: 'open' | 'request' | 'private';
  member_count: number;
  max_members: number | null;
  created_at: string;
}

/** Shape returned by GET /api/v1/leagues/{slug} — includes member list with roles. */
export interface LeagueDetail extends LeagueSummary {
  id: string;
  created_by: string;
  join_code: string | null;
  members: Array<{ id: string; display_name: string; role: 'player' | 'admin'; joined_at: string }> | null;
}

export interface LeagueMember {
  player_id: string;
  display_name: string;
  league_display_name: string | null;
  role: 'player' | 'admin';
  joined_at: string;
}

export interface JoinRequest {
  id: string;
  player_id: string;
  display_name: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
}

export interface LeagueInvite {
  id: string;
  token: string;
  created_by_display_name: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  invitee_email: string | null;
}

export interface CrossLeagueSummary {
  avg_rank: number | null;
  total_points: number;
  leagues_count: number;
  per_league: Array<{
    slug: string;
    name: string;
    rank: number | null;
    member_count: number;
  }>;
}

export interface RecentPrediction {
  match_id: string;
  stage: string;
  kickoff_utc: string;
  home_team_name: string | null;
  away_team_name: string | null;
  home_team_flag: string | null;
  away_team_flag: string | null;
  actual_home: number | null;
  actual_away: number | null;
  predicted_home: number | null;
  predicted_away: number | null;
  points_awarded: number | null;
  points_breakdown: PointsBreakdown | null;
}
