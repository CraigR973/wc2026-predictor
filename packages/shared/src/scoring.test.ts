import { describe, expect, it } from 'vitest';

import { scoreMatchPrediction } from './scoring';

describe('scoreMatchPrediction', () => {
  describe('no prediction', () => {
    it('returns zero points and noPrediction=true', () => {
      const result = scoreMatchPrediction(null, { homeScore: 2, awayScore: 1 }, 'group');
      expect(result).toEqual({
        totalGoals: 0,
        correctResult: 0,
        exactScore: 0,
        total: 0,
        noPrediction: true,
      });
    });
  });

  describe('group stage', () => {
    it('exact score: 2 + 3 + 5 = 10', () => {
      const result = scoreMatchPrediction(
        { homeScore: 2, awayScore: 1 },
        { homeScore: 2, awayScore: 1 },
        'group',
      );
      expect(result.totalGoals).toBe(2);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(5);
      expect(result.total).toBe(10);
    });

    it('correct W/D/L + correct total goals, wrong scoreline: 2 + 3 = 5', () => {
      const result = scoreMatchPrediction(
        { homeScore: 3, awayScore: 0 },
        { homeScore: 2, awayScore: 1 },
        'group',
      );
      expect(result.totalGoals).toBe(2);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(5);
    });

    it('correct W/D/L only: 3 points', () => {
      const result = scoreMatchPrediction(
        { homeScore: 1, awayScore: 0 },
        { homeScore: 2, awayScore: 1 },
        'group',
      );
      expect(result.totalGoals).toBe(0);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(3);
    });

    it('predicted draw, actual draw, exact score: 2 + 3 + 5 = 10', () => {
      const result = scoreMatchPrediction(
        { homeScore: 1, awayScore: 1 },
        { homeScore: 1, awayScore: 1 },
        'group',
      );
      expect(result.totalGoals).toBe(2);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(5);
      expect(result.total).toBe(10);
    });

    it('predicted draw, actual draw, different totals: 0 + 3 + 0 = 3', () => {
      const result = scoreMatchPrediction(
        { homeScore: 1, awayScore: 1 },
        { homeScore: 2, awayScore: 2 },
        'group',
      );
      expect(result.totalGoals).toBe(0);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(3);
    });

    it('wrong result and wrong total: 0', () => {
      const result = scoreMatchPrediction(
        { homeScore: 0, awayScore: 5 },
        { homeScore: 2, awayScore: 1 },
        'group',
      );
      expect(result.totalGoals).toBe(0);
      expect(result.correctResult).toBe(0);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('knockout stage — identical to group (draws now earn result points)', () => {
    it('knockout: exact 1-1 draw → 10 pts (goals + result + exact)', () => {
      const result = scoreMatchPrediction(
        { homeScore: 1, awayScore: 1 },
        { homeScore: 1, awayScore: 1 },
        'r16',
      );
      expect(result.totalGoals).toBe(2);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(5);
      expect(result.total).toBe(10);
    });

    it('knockout: predicted draw, actual win → no result points (different direction)', () => {
      const result = scoreMatchPrediction(
        { homeScore: 1, awayScore: 1 },
        { homeScore: 2, awayScore: 1 },
        'qf',
      );
      expect(result.totalGoals).toBe(0);
      expect(result.correctResult).toBe(0);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(0);
    });

    it('knockout: predicted win, actual draw → no result points (different direction)', () => {
      const result = scoreMatchPrediction(
        { homeScore: 2, awayScore: 1 },
        { homeScore: 1, awayScore: 1 },
        'sf',
      );
      expect(result.correctResult).toBe(0);
      expect(result.total).toBe(0);
    });

    it('knockout: correctly calling a draw direction earns +3 result points', () => {
      const result = scoreMatchPrediction(
        { homeScore: 2, awayScore: 2 },
        { homeScore: 1, awayScore: 1 },
        'r16',
      );
      // goals: 4 vs 2 → 0; result: both draw → 3; exact: 0
      expect(result.totalGoals).toBe(0);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(3);
    });

    it('knockout: win-on-win unchanged (exact) → 10', () => {
      const result = scoreMatchPrediction(
        { homeScore: 2, awayScore: 1 },
        { homeScore: 2, awayScore: 1 },
        'r32',
      );
      expect(result.totalGoals).toBe(2);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(5);
      expect(result.total).toBe(10);
    });

    it('knockout: win-on-win correct result, wrong scoreline → 5', () => {
      const result = scoreMatchPrediction(
        { homeScore: 3, awayScore: 0 },
        { homeScore: 2, awayScore: 1 },
        'final',
      );
      expect(result.totalGoals).toBe(2);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(5);
    });

    it('knockout: loss-on-loss correct result only → 3 points', () => {
      const result = scoreMatchPrediction(
        { homeScore: 0, awayScore: 2 },
        { homeScore: 1, awayScore: 3 },
        'third_place',
      );
      expect(result.totalGoals).toBe(0);
      expect(result.correctResult).toBe(3);
      expect(result.exactScore).toBe(0);
      expect(result.total).toBe(3);
    });
  });
});
