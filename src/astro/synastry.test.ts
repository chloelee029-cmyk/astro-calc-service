import assert from 'node:assert/strict';
import test from 'node:test';
import type { SynastryResponse } from '../types';
import { calculateSynastryScores, determineSynastryTheme } from './synastry';

type Aspect = SynastryResponse['crossAspects'][number];

function aspect(from: Aspect['from'], to: Aspect['to'], type: Aspect['type'], score: number): Aspect {
  return { from, to, type, orb: 1, score };
}

test('negative aspects are not deducted twice from a dimension score', () => {
  const scores = calculateSynastryScores([
    aspect('Moon', 'Mercury', 'Square', -56),
  ]);

  assert.equal(scores.emotional, 43);
  assert.equal(scores.communication, 43);
});

test('challenge caps preserve differences between otherwise very high dimensions', () => {
  const scores = calculateSynastryScores([
    aspect('Moon', 'Sun', 'Sextile', 70),
    aspect('Moon', 'Moon', 'Sextile', 69),
    aspect('Moon', 'Mercury', 'Sextile', 67),
    aspect('Moon', 'Jupiter', 'Trine', 90),
    aspect('Moon', 'Saturn', 'Conjunction', 66),
    aspect('Venus', 'Venus', 'Trine', 4),
    aspect('Venus', 'Uranus', 'Conjunction', 63),
    aspect('Venus', 'Neptune', 'Conjunction', 37),
    aspect('Venus', 'Pluto', 'Sextile', 80),
    aspect('Jupiter', 'Sun', 'Sextile', 70),
    aspect('Jupiter', 'Mercury', 'Sextile', 73),
    aspect('Jupiter', 'Jupiter', 'Trine', 85),
    aspect('Jupiter', 'Saturn', 'Trine', 81),
    aspect('Saturn', 'Sun', 'Trine', 63),
    aspect('Saturn', 'Moon', 'Conjunction', 43),
    aspect('Saturn', 'Mercury', 'Trine', 59),
    aspect('Saturn', 'Jupiter', 'Sextile', 52),
    aspect('Saturn', 'Saturn', 'Sextile', 55),
    aspect('Uranus', 'Mercury', 'Trine', 36),
    aspect('Uranus', 'Jupiter', 'Sextile', 24),
    aspect('Uranus', 'Saturn', 'Sextile', 21),
    aspect('Neptune', 'Mercury', 'Trine', 78),
    aspect('Neptune', 'Jupiter', 'Sextile', 68),
    aspect('Neptune', 'Saturn', 'Sextile', 71),
    aspect('Pluto', 'Mercury', 'Opposition', -11),
    aspect('Pluto', 'Jupiter', 'Conjunction', 14),
    aspect('Pluto', 'Saturn', 'Trine', 24),
    aspect('Sun', 'Saturn', 'Square', -39),
    aspect('Moon', 'Jupiter', 'Opposition', -70),
    aspect('Jupiter', 'Mars', 'Square', -41),
    aspect('Saturn', 'Mars', 'Square', -64),
    aspect('Neptune', 'Mars', 'Square', -62),
  ]);

  assert.deepEqual(scores, {
    emotional: 89,
    communication: 88,
    longTerm: 84,
  });
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
