import assert from 'node:assert/strict';
import test from 'node:test';
import type { SynastryResponse } from '../types';
import { calculateSynastryScores, determineSynastryTheme } from './synastry';

type Aspect = SynastryResponse['crossAspects'][number];

function aspect(from: Aspect['from'], to: Aspect['to'], type: Aspect['type'], score: number): Aspect {
  return { from, to, type, orb: 1, score };
}

test('synastry scores are capped when strong supportive aspects include major challenges', () => {
  const scores = calculateSynastryScores([
    aspect('Moon', 'Jupiter', 'Trine', 90),
    aspect('Moon', 'Mercury', 'Sextile', 67),
    aspect('Venus', 'Pluto', 'Sextile', 80),
    aspect('Jupiter', 'Jupiter', 'Trine', 85),
    aspect('Jupiter', 'Saturn', 'Trine', 81),
    aspect('Saturn', 'Mercury', 'Trine', 59),
    aspect('Moon', 'Jupiter', 'Opposition', -70),
    aspect('Saturn', 'Mars', 'Square', -64),
    aspect('Neptune', 'Mars', 'Square', -62),
  ]);

  assert.equal(scores.emotional < 100, true);
  assert.equal(scores.longTerm < 100, true);
  assert.equal(Math.max(scores.emotional, scores.communication, scores.longTerm) <= 88, true);
});

test('synastry theme requires each dimension to be sufficiently strong', () => {
  assert.equal(
    determineSynastryTheme({ emotional: 43, communication: 83, longTerm: 95 }),
    'Growth Through Communication',
  );
  assert.equal(
    determineSynastryTheme({ emotional: 58, communication: 61, longTerm: 64 }),
    'Growth Through Communication',
  );
  assert.equal(
    determineSynastryTheme({ emotional: 75, communication: 72, longTerm: 80 }),
    'Supportive Partnership Arc',
  );
});
