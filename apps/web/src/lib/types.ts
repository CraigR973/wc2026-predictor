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
