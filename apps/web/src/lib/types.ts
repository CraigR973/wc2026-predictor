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

export interface PredictionResponse {
  id: string;
  player_id: string;
  match_id: string;
  predicted_home: number | null;
  predicted_away: number | null;
  submitted_at: string | null;
  update_count: number;
  points_awarded: number | null;
  updated_at: string;
}

export interface MatchPredictionItem {
  player_id: string;
  player_name: string;
  predicted_home: number | null;
  predicted_away: number | null;
  points_awarded: number | null;
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
