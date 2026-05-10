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
  correct_result: boolean;
  correct_goals: boolean;
  exact_score: boolean;
  no_prediction: boolean;
}

export interface PredictionResponse {
  match_id: string;
  predicted_home: number | null;
  predicted_away: number | null;
  points: number | null;
  points_breakdown: PointsBreakdown | null;
}
