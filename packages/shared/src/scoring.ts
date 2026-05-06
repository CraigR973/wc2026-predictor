export interface MatchResult {
  homeScore: number;
  awayScore: number;
}

export interface ScoreBreakdown {
  totalGoals: number;
  correctResult: number;
  exactScore: number;
  total: number;
  noPrediction: boolean;
}

export function scoreMatchPrediction(
  prediction: MatchResult | null,
  actual: MatchResult,
): ScoreBreakdown {
  if (!prediction) {
    return { totalGoals: 0, correctResult: 0, exactScore: 0, total: 0, noPrediction: true };
  }

  const actualTotal = actual.homeScore + actual.awayScore;
  const predTotal = prediction.homeScore + prediction.awayScore;

  const totalGoals = predTotal === actualTotal ? 2 : 0;

  const actualResult = Math.sign(actual.homeScore - actual.awayScore);
  const predResult = Math.sign(prediction.homeScore - prediction.awayScore);
  const correctResult = predResult === actualResult ? 3 : 0;

  const exactScore =
    prediction.homeScore === actual.homeScore && prediction.awayScore === actual.awayScore ? 5 : 0;

  return {
    totalGoals,
    correctResult,
    exactScore,
    total: totalGoals + correctResult + exactScore,
    noPrediction: false,
  };
}
